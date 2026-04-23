-- =====================================================
-- Migración Inicial: Esquema SQLite para Photo Storage
-- =====================================================
-- Versión: 001
-- Descripción: Esquema inicial con tablas people y face_photos
-- Requisitos: 1.2, 1.3, 1.4, 8.4
-- =====================================================

-- Configuración inicial de SQLite para rendimiento y integridad
PRAGMA foreign_keys = ON;              -- Habilitar claves foráneas (Req 8.4)
PRAGMA journal_mode = WAL;             -- Modo WAL para mejor concurrencia (Req 8.2)
PRAGMA synchronous = NORMAL;           -- Balance entre rendimiento e integridad
PRAGMA cache_size = 1000;              -- Cache de 1000 páginas para rendimiento
PRAGMA temp_store = MEMORY;            -- Almacenar temporales en memoria
PRAGMA encoding = "UTF-8";             -- Soporte completo de caracteres (Req 8.5)
PRAGMA busy_timeout = 5000;            -- Timeout de 5 segundos para operaciones
PRAGMA auto_vacuum = INCREMENTAL;      -- Limpieza automática incremental

-- =====================================================
-- Tabla de personas
-- =====================================================
-- Almacena información básica de personas registradas
-- Requisitos: 1.2, 2.1, 2.2, 2.3, 2.5
CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL 
        CHECK(length(trim(name)) > 0)           -- No vacío (Req 2.4)
        CHECK(length(trim(name)) <= 100)        -- Máximo 100 caracteres
        CHECK(trim(name) GLOB '[A-Za-zÀ-ÿñÑ ]*'), -- Solo letras y espacios
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Constraints adicionales
    CONSTRAINT valid_name_format CHECK(
        name IS NOT NULL AND 
        length(trim(name)) BETWEEN 1 AND 100 AND
        trim(name) NOT LIKE '% %% %'            -- No múltiples espacios consecutivos
    )
);

-- =====================================================
-- Tabla de fotos faciales
-- =====================================================
-- Almacena fotos capturadas asociadas a personas
-- Requisitos: 1.3, 3.1, 3.2, 3.3, 3.4
CREATE TABLE IF NOT EXISTS face_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL,
    photo_data TEXT NOT NULL 
        CHECK(length(photo_data) > 0)           -- No vacío
        CHECK(photo_data LIKE 'data:image/%'),  -- Formato base64 válido
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Metadatos adicionales para optimización
    photo_size INTEGER GENERATED ALWAYS AS (
        CAST(length(photo_data) * 0.75 AS INTEGER)
    ) STORED,                                   -- Tamaño aproximado en bytes
    
    -- Clave foránea con integridad referencial (Req 1.4)
    FOREIGN KEY (person_id) REFERENCES people(id) 
        ON DELETE CASCADE                       -- Eliminar fotos si se elimina persona
        ON UPDATE CASCADE,                      -- Actualizar si cambia ID persona
    
    -- Constraints adicionales
    CONSTRAINT valid_photo_data CHECK(
        photo_data IS NOT NULL AND
        length(photo_data) > 22 AND             -- Mínimo para imagen válida
        (photo_data LIKE 'data:image/jpeg;base64,%' OR
         photo_data LIKE 'data:image/png;base64,%' OR
         photo_data LIKE 'data:image/webp;base64,%')
    )
);

-- =====================================================
-- Índices para optimización de consultas
-- =====================================================
-- Requisitos: 8.4, 10.1, 10.2, 10.3

-- Índices para tabla people
CREATE INDEX IF NOT EXISTS idx_people_name 
    ON people(name COLLATE NOCASE);             -- Búsqueda por nombre (case-insensitive)

CREATE INDEX IF NOT EXISTS idx_people_created_at 
    ON people(created_at DESC);                 -- Ordenamiento por fecha de creación

-- Índices para tabla face_photos
CREATE INDEX IF NOT EXISTS idx_face_photos_person_id 
    ON face_photos(person_id);                  -- Búsqueda por persona (Req 4.2)

CREATE INDEX IF NOT EXISTS idx_face_photos_captured_at 
    ON face_photos(captured_at DESC);           -- Ordenamiento por fecha de captura (Req 4.4)

CREATE INDEX IF NOT EXISTS idx_face_photos_person_captured 
    ON face_photos(person_id, captured_at DESC); -- Índice compuesto para consultas frecuentes

CREATE INDEX IF NOT EXISTS idx_face_photos_size 
    ON face_photos(photo_size);                 -- Optimización por tamaño de foto

-- =====================================================
-- Triggers de validación y mantenimiento
-- =====================================================
-- Requisitos: 7.2, 7.3, 10.3

-- Trigger: Validación de tamaño de foto antes de inserción
CREATE TRIGGER IF NOT EXISTS validate_photo_size_insert
BEFORE INSERT ON face_photos
FOR EACH ROW
WHEN length(NEW.photo_data) > 13421772         -- 10MB en caracteres base64 (10MB * 4/3)
BEGIN
    SELECT RAISE(ABORT, 'Photo data exceeds maximum size of 10MB');
END;

-- Trigger: Validación de tamaño de foto antes de actualización
CREATE TRIGGER IF NOT EXISTS validate_photo_size_update
BEFORE UPDATE ON face_photos
FOR EACH ROW
WHEN length(NEW.photo_data) > 13421772         -- 10MB en caracteres base64
BEGIN
    SELECT RAISE(ABORT, 'Photo data exceeds maximum size of 10MB');
END;

-- Trigger: Validación de formato base64 en inserción
CREATE TRIGGER IF NOT EXISTS validate_photo_format_insert
BEFORE INSERT ON face_photos
FOR EACH ROW
WHEN NEW.photo_data NOT GLOB 'data:image/*;base64,*'
BEGIN
    SELECT RAISE(ABORT, 'Invalid photo format. Must be base64 encoded image data.');
END;

-- Trigger: Validación de formato base64 en actualización
CREATE TRIGGER IF NOT EXISTS validate_photo_format_update
BEFORE UPDATE ON face_photos
FOR EACH ROW
WHEN NEW.photo_data NOT GLOB 'data:image/*;base64,*'
BEGIN
    SELECT RAISE(ABORT, 'Invalid photo format. Must be base64 encoded image data.');
END;

-- Trigger: Validación de nombre de persona en inserción
CREATE TRIGGER IF NOT EXISTS validate_person_name_insert
BEFORE INSERT ON people
FOR EACH ROW
WHEN trim(NEW.name) = '' OR 
     length(trim(NEW.name)) > 100 OR
     NEW.name GLOB '*[^A-Za-zÀ-ÿñÑ ]*'
BEGIN
    SELECT RAISE(ABORT, 'Invalid person name. Must be 1-100 characters, letters and spaces only.');
END;

-- Trigger: Validación de nombre de persona en actualización
CREATE TRIGGER IF NOT EXISTS validate_person_name_update
BEFORE UPDATE ON people
FOR EACH ROW
WHEN trim(NEW.name) = '' OR 
     length(trim(NEW.name)) > 100 OR
     NEW.name GLOB '*[^A-Za-zÀ-ÿñÑ ]*'
BEGIN
    SELECT RAISE(ABORT, 'Invalid person name. Must be 1-100 characters, letters and spaces only.');
END;

-- Trigger: Auditoría de eliminación de personas
CREATE TRIGGER IF NOT EXISTS audit_person_deletion
AFTER DELETE ON people
FOR EACH ROW
BEGIN
    INSERT INTO sqlite_temp_master (type, name, tbl_name, rootpage, sql)
    SELECT 'audit', 'person_deleted_' || datetime('now'), 'people', 0, 
           'Person deleted: ID=' || OLD.id || ', Name=' || OLD.name || ', Date=' || datetime('now');
END;

-- =====================================================
-- Vistas para consultas optimizadas
-- =====================================================
-- Requisitos: 4.1, 4.2, 4.3, 4.4

-- Vista: Fotos con información de persona
CREATE VIEW IF NOT EXISTS photos_with_person AS
SELECT 
    fp.id,
    fp.person_id,
    fp.photo_data,
    fp.captured_at,
    fp.photo_size,
    p.name as person_name,
    p.created_at as person_created_at
FROM face_photos fp
JOIN people p ON fp.person_id = p.id
ORDER BY fp.captured_at DESC;

-- Vista: Estadísticas por persona
CREATE VIEW IF NOT EXISTS person_stats AS
SELECT 
    p.id,
    p.name,
    p.created_at,
    COUNT(fp.id) as photo_count,
    MAX(fp.captured_at) as last_photo_date,
    SUM(fp.photo_size) as total_photo_size
FROM people p
LEFT JOIN face_photos fp ON p.id = fp.person_id
GROUP BY p.id, p.name, p.created_at
ORDER BY p.created_at DESC;

-- =====================================================
-- Configuración final y verificación
-- =====================================================

-- Verificar integridad del esquema
PRAGMA integrity_check;

-- Analizar estadísticas para optimización
ANALYZE;

-- =====================================================
-- Fin de migración 001_initial_schema.sql
-- =====================================================