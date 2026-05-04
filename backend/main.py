"""
Backend API para FaceCapture.
Usa DeepFace para detección de rostro y OpenCV para análisis de landmarks (ojos/boca).
Guarda fotos en MongoDB Atlas.
"""

import base64
import io
import logging
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

import cv2
import numpy as np
from bson import ObjectId
from deepface import DeepFace
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pymongo import MongoClient
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── MongoDB ────────────────────────────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "face_capture")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "fotos")
mongo_client = MongoClient(MONGO_URI)
mongo_db = mongo_client[MONGO_DB]
photos_collection = mongo_db[MONGO_COLLECTION]

# ── Constantes ─────────────────────────────────────────────────────────────────
# 4 cm ≈ 1.5748 in → a 300 DPI = 472 px
PHOTO_SIZE_PX = 472
PHOTO_DPI = 300

# ── MediaPipe FaceLandmarker (Tasks API) ───────────────────────────────────────
import os
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_landmarker.task")
_base_options = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
_options = mp_vision.FaceLandmarkerOptions(
    base_options=_base_options,
    output_face_blendshapes=True,
    num_faces=1,
)
face_landmarker = mp_vision.FaceLandmarker.create_from_options(_options)

# Umbrales para blendshapes (0.0 = no activo, 1.0 = máximo)
BLINK_THRESHOLD = 0.35    # > 0.35 = ojo cerrado
JAW_OPEN_THRESHOLD = 0.3  # > 0.3 = boca abierta


# ── FastAPI ────────────────────────────────────────────────────────────────────
app = FastAPI(title="FaceCapture API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Utilidades ─────────────────────────────────────────────────────────────────

def decode_image(data_url: str) -> np.ndarray | None:
    """Decodifica un data-URL base64 a un array BGR de OpenCV."""
    try:
        if "," in data_url:
            data_url = data_url.split(",", 1)[1]
        raw = base64.b64decode(data_url)
        arr = np.frombuffer(raw, np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


def analyze_face(img_bgr: np.ndarray) -> dict:
    """
    Analiza un frame usando MediaPipe FaceLandmarker + blendshapes.
    - Detección de rostro: MediaPipe (integrado en FaceLandmarker).
    - Ojos: blendshapes eyeBlinkLeft / eyeBlinkRight.
    - Boca: blendshape jawOpen.
    - Iluminación: brillo promedio y uniformidad (izq vs der) del rostro.
    """
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)

    result = face_landmarker.detect(mp_image)

    has_face = len(result.face_landmarks) > 0

    if not has_face:
        avg_brightness = float(np.mean(gray))
        return {
            "face_detected": False,
            "eyes_open": False,
            "mouth_closed": False,
            "good_lighting": avg_brightness > 80,
            "lighting_msg": "",
            "ready": False,
        }

    # --- Analizar iluminación del rostro ---
    lms = result.face_landmarks[0]
    # Obtener bounding box del rostro desde landmarks
    xs = [lm.x * w for lm in lms]
    ys = [lm.y * h for lm in lms]
    fx1, fx2 = int(max(0, min(xs))), int(min(w, max(xs)))
    fy1, fy2 = int(max(0, min(ys))), int(min(h, max(ys)))
    face_roi = gray[fy1:fy2, fx1:fx2]

    good_lighting = True
    lighting_msg = ""
    if face_roi.size > 0:
        face_brightness = float(np.mean(face_roi))
        # Dividir rostro en mitad izquierda y derecha
        mid_x = face_roi.shape[1] // 2
        left_half = face_roi[:, :mid_x]
        right_half = face_roi[:, mid_x:]
        left_brightness = float(np.mean(left_half)) if left_half.size > 0 else 0
        right_brightness = float(np.mean(right_half)) if right_half.size > 0 else 0
        # Diferencia entre lados (detecta sombras laterales)
        side_diff = abs(left_brightness - right_brightness)

        if face_brightness < 80:
            good_lighting = False
            lighting_msg = "poca luz en el rostro"
        elif side_diff > 40:
            good_lighting = False
            darker = "izquierdo" if left_brightness < right_brightness else "derecho"
            lighting_msg = f"sombra en lado {darker}"
    else:
        face_brightness = 0.0

    # --- Extraer blendshapes ---
    blendshapes = {}
    if result.face_blendshapes and len(result.face_blendshapes) > 0:
        for bs in result.face_blendshapes[0]:
            blendshapes[bs.category_name] = bs.score

    blink_left = blendshapes.get("eyeBlinkLeft", 0)
    blink_right = blendshapes.get("eyeBlinkRight", 0)
    jaw_open = blendshapes.get("jawOpen", 0)

    eyes_open = blink_left < BLINK_THRESHOLD and blink_right < BLINK_THRESHOLD
    mouth_closed = jaw_open < JAW_OPEN_THRESHOLD

    # --- Calcular área de recorte 4×4 (preview) ---
    # Centro del rostro desplazado hacia arriba para incluir toda la cabeza
    face_w = fx2 - fx1
    face_h = fy2 - fy1
    cx = (fx1 + fx2) / 2
    cy = (fy1 + fy2) / 2 - face_h * 0.15  # Subir 15% para frente/cabeza
    pad = 0.55
    size = max(face_w, face_h) * (1 + pad)
    crop_x1 = max(0, cx - size / 2)
    crop_y1 = max(0, cy - size / 2)
    crop_x2 = min(w, crop_x1 + size)
    crop_y2 = min(h, crop_y1 + size)
    # Normalizar a 0-1 para el frontend
    crop_box = {
        "x1": round(crop_x1 / w, 4),
        "y1": round(crop_y1 / h, 4),
        "x2": round(crop_x2 / w, 4),
        "y2": round(crop_y2 / h, 4),
    }

    ready = bool(has_face and eyes_open and mouth_closed and good_lighting)

    return {
        "face_detected": True,
        "eyes_open": bool(eyes_open),
        "mouth_closed": bool(mouth_closed),
        "good_lighting": bool(good_lighting),
        "lighting_msg": lighting_msg,
        "ready": bool(ready),
        "crop_box": crop_box,
        "blink_l": round(float(blink_left), 3),
        "blink_r": round(float(blink_right), 3),
        "jaw_open": round(float(jaw_open), 3),
    }


def crop_face_4x4(img_bgr: np.ndarray) -> str | None:
    """
    Detecta rostro con DeepFace, lo recorta y redimensiona a 4cm×4cm (472×472px).
    Devuelve data-URL JPEG.
    """
    try:
        faces = DeepFace.extract_faces(
            img_path=img_bgr,
            detector_backend="retinaface",
            enforce_detection=True,
            align=True,
        )
        if not faces:
            return None

        fa = faces[0]["facial_area"]
        x, y, w_f, h_f = fa["x"], fa["y"], fa["w"], fa["h"]
        h_img, w_img = img_bgr.shape[:2]

        # Expandir 55% y subir centro para incluir toda la cabeza
        pad = 0.55
        cx, cy = x + w_f // 2, y + h_f // 2 - int(h_f * 0.15)
        size = int(max(w_f, h_f) * (1 + pad))

        x1 = max(0, cx - size // 2)
        y1 = max(0, cy - size // 2)
        x2 = min(w_img, x1 + size)
        y2 = min(h_img, y1 + size)

        crop = img_bgr[y1:y2, x1:x2]
        if crop.size == 0:
            return None

        # Redimensionar a 472×472
        crop_resized = cv2.resize(
            crop, (PHOTO_SIZE_PX, PHOTO_SIZE_PX), interpolation=cv2.INTER_LANCZOS4
        )

        # Convertir a PIL y guardar como JPEG con DPI correcto
        rgb = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb)

        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=92, dpi=(PHOTO_DPI, PHOTO_DPI))
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{b64}"

    except Exception as e:
        logger.error(f"Error recortando rostro: {e}")
        return None


# ── WebSocket para análisis en tiempo real ─────────────────────────────────────

@app.websocket("/ws/analyze")
async def ws_analyze(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket conectado")
    try:
        while True:
            try:
                data = await websocket.receive_text()
                img = decode_image(data)
                if img is None:
                    await websocket.send_json({"error": "Imagen inválida"})
                    continue
                result = analyze_face(img)
                await websocket.send_json(result)
            except WebSocketDisconnect:
                raise
            except Exception as e:
                logger.error(f"Error en análisis WS: {e}")
                await websocket.send_json({"error": "Error interno"})
    except WebSocketDisconnect:
        logger.info("WebSocket desconectado")


# ── REST endpoints para fotos en MongoDB ───────────────────────────────────────

class CaptureRequest(BaseModel):
    name: str
    image: str  # data-URL base64


@app.post("/api/photos")
async def save_photo(req: CaptureRequest):
    """Recibe un frame, recorta el rostro a 4×4 cm y lo guarda en MongoDB."""
    img = decode_image(req.image)
    if img is None:
        return {"error": "Imagen inválida"}, 400

    # Espejamos porque la webcam viene invertida
    img = cv2.flip(img, 1)

    cropped = crop_face_4x4(img)
    if cropped is None:
        return {"error": "No se pudo detectar el rostro"}, 400

    doc = {
        "name": req.name.strip(),
        "photo_data": cropped,
        "captured_at": datetime.now(timezone.utc),
    }
    result = photos_collection.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["captured_at"] = doc["captured_at"].isoformat()

    return {"ok": True, "photo": doc}


@app.get("/api/photos")
async def get_photos():
    """Devuelve todas las fotos de la colección."""
    cursor = photos_collection.find().sort("captured_at", -1)
    photos = []
    for doc in cursor:
        photos.append(
            {
                "_id": str(doc["_id"]),
                "name": doc.get("name", ""),
                "photo_data": doc.get("photo_data", ""),
                "captured_at": doc.get("captured_at", "").isoformat()
                if hasattr(doc.get("captured_at", ""), "isoformat")
                else str(doc.get("captured_at", "")),
            }
        )
    return {"photos": photos}


@app.delete("/api/photos/{photo_id}")
async def delete_photo(photo_id: str):
    """Borra una foto de la colección."""
    result = photos_collection.delete_one({"_id": ObjectId(photo_id)})
    if result.deleted_count == 0:
        return {"error": "Foto no encontrada"}, 404
    return {"ok": True}


@app.get("/api/health")
async def health():
    return {"status": "ok"}
