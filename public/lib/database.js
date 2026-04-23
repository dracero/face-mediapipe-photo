// Cliente SQLite para el navegador usando sql.js
// Se auto-inicializa en el primer uso — no requiere llamada manual a initializeDatabase()

const DB_NAME = 'photos.db';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_NAME_LENGTH = 100;

let SQL = null;
let db = null;
let _initPromise = null;

// ── Carga de sql.js ───────────────────────────────────────────────────────────

async function loadSqlJs() {
  if (SQL) return SQL;

  // Intentar import dinámico primero
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js');
    const init = mod.default ?? mod;
    SQL = await init({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}`
    });
    return SQL;
  } catch (_) {
    // fallback: script tag
  }

  return new Promise((resolve, reject) => {
    if (window.initSqlJs) {
      window.initSqlJs({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}` })
        .then(s => { SQL = s; resolve(SQL); })
        .catch(reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js';
    script.onload = () => {
      window.initSqlJs({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}` })
        .then(s => { SQL = s; resolve(SQL); })
        .catch(reject);
    };
    script.onerror = () => reject(new Error('No se pudo cargar sql.js'));
    document.head.appendChild(script);
  });
}

// ── OPFS ─────────────────────────────────────────────────────────────────────

async function opfsSupported() {
  return 'storage' in navigator && 'getDirectory' in navigator.storage;
}

async function loadFromOPFS() {
  if (!(await opfsSupported())) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(DB_NAME);
    const file = await fh.getFile();
    const buf = await file.arrayBuffer();
    console.log(`📂 Base de datos cargada desde OPFS (${buf.byteLength} bytes)`);
    return new Uint8Array(buf);
  } catch (e) {
    if (e.name !== 'NotFoundError') console.warn('⚠️ Error leyendo OPFS:', e);
    return null;
  }
}

async function saveToOPFS() {
  if (!db || !(await opfsSupported())) return;
  try {
    const data = db.export();
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(DB_NAME, { create: true });
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
    console.log(`💾 Base de datos guardada en OPFS (${data.length} bytes)`);
  } catch (e) {
    console.warn('⚠️ Error guardando en OPFS:', e);
  }
}

// ── Inicialización ────────────────────────────────────────────────────────────

async function initialize() {
  if (db) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    console.log('🔄 Inicializando base de datos SQLite...');
    await loadSqlJs();

    const existing = await loadFromOPFS();
    if (existing) {
      db = new SQL.Database(existing);
      console.log('📂 Base de datos existente cargada');
    } else {
      db = new SQL.Database();
      console.log('🆕 Nueva base de datos creada');
      db.exec(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS people (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT    NOT NULL CHECK(length(trim(name)) > 0 AND length(trim(name)) <= 100),
          created_at TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS face_photos (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          person_id   INTEGER NOT NULL,
          photo_data  TEXT    NOT NULL CHECK(length(photo_data) > 0),
          captured_at TEXT    DEFAULT (datetime('now')),
          FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_fp_person   ON face_photos(person_id);
        CREATE INDEX IF NOT EXISTS idx_fp_captured ON face_photos(captured_at DESC);
        CREATE INDEX IF NOT EXISTS idx_p_name      ON people(name);
      `);
      await saveToOPFS();
    }
    console.log('✅ Base de datos lista');
  })();

  try {
    await _initPromise;
  } finally {
    _initPromise = null;
  }
}

// ── Validación ────────────────────────────────────────────────────────────────

function validateName(name) {
  if (!name || typeof name !== 'string' || name.trim().length === 0)
    throw new Error('El nombre es requerido');
  if (name.trim().length > MAX_NAME_LENGTH)
    throw new Error(`El nombre no puede exceder ${MAX_NAME_LENGTH} caracteres`);
  if (!/^[a-zA-ZÀ-ÿñÑ\s]+$/.test(name.trim()))
    throw new Error('El nombre solo puede contener letras y espacios');
}

function validatePhoto(photoData) {
  if (!photoData || typeof photoData !== 'string')
    throw new Error('Los datos de la foto son requeridos');
  if (!photoData.startsWith('data:image/'))
    throw new Error('La foto debe ser un data URL de imagen');
  const parts = photoData.split(',');
  if (parts.length !== 2 || !parts[0].includes('base64'))
    throw new Error('Formato de imagen inválido');
  const bytes = Math.ceil(parts[1].length * 0.75);
  if (bytes > MAX_IMAGE_SIZE)
    throw new Error('La imagen es demasiado grande (máximo 10MB)');
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function createPerson(name) {
  await initialize();
  validateName(name);
  const trimmed = name.trim();

  const stmt = db.prepare('INSERT INTO people (name) VALUES (?)');
  stmt.run([trimmed]);
  stmt.free();

  const [[id]] = db.exec('SELECT last_insert_rowid()')[0].values;
  const row = db.exec('SELECT id, name, created_at FROM people WHERE id = ?', [id])[0].values[0];
  await saveToOPFS();

  return { id: row[0], name: row[1], created_at: row[2] };
}

async function findPeopleByName(name) {
  await initialize();
  const res = db.exec('SELECT id, name, created_at FROM people WHERE name = ? ORDER BY created_at DESC', [name.trim()]);
  if (!res[0]) return [];
  return res[0].values.map(([id, name, created_at]) => ({ id, name, created_at }));
}

async function getAllPeople() {
  await initialize();
  const res = db.exec('SELECT id, name, created_at FROM people ORDER BY created_at DESC');
  if (!res[0]) return [];
  return res[0].values.map(([id, name, created_at]) => ({ id, name, created_at }));
}

async function createFacePhoto(personId, photoData) {
  await initialize();
  validatePhoto(photoData);

  const personCheck = db.exec('SELECT id FROM people WHERE id = ?', [personId]);
  if (!personCheck[0]) throw new Error(`Persona con ID ${personId} no existe`);

  const stmt = db.prepare('INSERT INTO face_photos (person_id, photo_data) VALUES (?, ?)');
  stmt.run([personId, photoData]);
  stmt.free();

  const [[id]] = db.exec('SELECT last_insert_rowid()')[0].values;
  const res = db.exec(`
    SELECT fp.id, fp.person_id, fp.photo_data, fp.captured_at, p.name AS person_name
    FROM face_photos fp JOIN people p ON fp.person_id = p.id
    WHERE fp.id = ?`, [id]);
  const row = res[0].values[0];
  await saveToOPFS();

  return { id: row[0], person_id: row[1], photo_data: row[2], captured_at: row[3], person_name: row[4] };
}

async function getAllFacePhotos() {
  await initialize();
  const res = db.exec(`
    SELECT fp.id, fp.person_id, fp.photo_data, fp.captured_at, p.name AS person_name
    FROM face_photos fp JOIN people p ON fp.person_id = p.id
    ORDER BY fp.captured_at DESC`);
  if (!res[0]) return [];
  return res[0].values.map(([id, person_id, photo_data, captured_at, person_name]) =>
    ({ id, person_id, photo_data, captured_at, person_name }));
}

// ── QueryBuilder compatible con Supabase ──────────────────────────────────────

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this._wheres = [];
    this._order = null;
    this._limit = null;
  }

  select(_cols) { return this; } // ignorado — siempre devolvemos todos los campos

  eq(col, val) {
    this._wheres.push({ col, val });
    return this;
  }

  order(col, { ascending = true } = {}) {
    this._order = { col, ascending };
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  async insert(data) {
    try {
      let result;
      if (this.table === 'people') {
        result = await createPerson(data.name);
      } else if (this.table === 'face_photos') {
        result = await createFacePhoto(data.person_id, data.photo_data);
      } else {
        throw new Error(`Tabla no soportada: ${this.table}`);
      }
      return { data: result, error: null };
    } catch (error) {
      console.error(`Error insertando en ${this.table}:`, error);
      return { data: null, error };
    }
  }

  // Hace que el QueryBuilder sea "thenable" — se puede usar con await directamente
  then(resolve, reject) {
    return this._execute().then(resolve, reject);
  }

  async _execute() {
    try {
      let rows;
      if (this.table === 'people') {
        rows = await getAllPeople();
      } else if (this.table === 'face_photos') {
        rows = await getAllFacePhotos();
      } else {
        throw new Error(`Tabla no soportada: ${this.table}`);
      }

      // Filtros WHERE
      for (const { col, val } of this._wheres) {
        rows = rows.filter(r => r[col] === val);
      }

      // Ordenamiento
      if (this._order) {
        const { col, ascending } = this._order;
        rows.sort((a, b) => {
          if (a[col] < b[col]) return ascending ? -1 : 1;
          if (a[col] > b[col]) return ascending ? 1 : -1;
          return 0;
        });
      }

      // Límite
      if (this._limit != null) rows = rows.slice(0, this._limit);

      return { data: rows, error: null };
    } catch (error) {
      console.error(`Error en query de ${this.table}:`, error);
      return { data: null, error };
    }
  }
}

// ── Borrar base de datos ──────────────────────────────────────────────────────

export async function clearDatabase() {
  // Cerrar y destruir la instancia en memoria
  if (db) {
    db.close();
    db = null;
  }
  SQL = null;
  _initPromise = null;

  // Borrar el archivo en OPFS
  if (await opfsSupported()) {
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(DB_NAME);
      console.log('🗑️ Base de datos eliminada de OPFS');
    } catch (e) {
      if (e.name !== 'NotFoundError') console.warn('⚠️ Error borrando OPFS:', e);
    }
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

export const supabase = {
  from(table) {
    return new QueryBuilder(table);
  }
};

// Exponer en window para compatibilidad con scripts no-module
window.supabase = supabase;
window.clearDatabase = clearDatabase;
