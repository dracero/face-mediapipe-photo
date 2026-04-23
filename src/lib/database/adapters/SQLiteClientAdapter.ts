// Adaptador SQLite para entorno cliente usando sql.js (WebAssembly)
// Requisitos: 9.5, 5.1, 5.2, 5.3

import type { DatabaseAdapter, Person, FacePhoto } from '../types';
import { PersonModel } from '../models/PersonModel';
import { FacePhotoModel } from '../models/FacePhotoModel';
import { DatabaseConnectionError, ValidationError, DataIntegrityError } from '../utils/errors';
import { DatabaseLogger } from '../utils/logger';
import { DATABASE_CONFIG } from '../config';

// Tipos para sql.js
interface SqlJsDatabase {
  exec(sql: string): any[];
  prepare(sql: string): SqlJsStatement;
  export(): Uint8Array;
  close(): void;
}

interface SqlJsStatement {
  run(params?: any[]): void;
  get(params?: any[]): any;
  all(params?: any[]): any[];
  free(): void;
}

export class SQLiteClientAdapter implements DatabaseAdapter {
  private SQL: any = null;
  private db: SqlJsDatabase | null = null;
  private readonly logger = DatabaseLogger.getInstance();
  private readonly dbName: string;
  private isInitialized = false;

  constructor(dbName?: string) {
    this.dbName = dbName || DATABASE_CONFIG.client.dbName;
  }

  /**
   * Inicializa la base de datos WebAssembly y carga datos persistentes
   * Requisitos: 9.5, 5.1
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.db) {
      return;
    }

    const startTime = Date.now();

    try {
      // Cargar sql.js WebAssembly dinámicamente
      const initSqlJs = await import('sql.js').then(m => m.default);
      this.SQL = await initSqlJs(DATABASE_CONFIG.client.wasmConfig);

      // Intentar cargar base de datos existente desde OPFS
      const existingData = await this.loadFromOPFS();

      if (existingData) {
        this.db = new this.SQL.Database(existingData);
        this.logger.logInfo('Loaded existing database from OPFS', { 
          size: existingData.length 
        });
      } else {
        this.db = new this.SQL.Database();
        await this.runMigrations();
        this.logger.logInfo('Created new database');
      }

      // Verificar integridad
      await this.verifyIntegrity();

      this.isInitialized = true;
      const duration = Date.now() - startTime;
      this.logger.logInitialization('SQLiteClientAdapter', true, duration);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logInitialization('SQLiteClientAdapter', false, duration);
      this.logger.logError(error as Error, 'SQLiteClientAdapter initialization');
      throw new DatabaseConnectionError(`Failed to initialize SQLite client: ${(error as Error).message}`);
    }
  }

  /**
   * Cierra la conexión y guarda datos en OPFS
   * Requisitos: 5.2
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.saveToOPFS();
        this.db.close();
        this.db = null;
        this.isInitialized = false;
        this.logger.logInfo('SQLiteClientAdapter connection closed and data saved');
      } catch (error) {
        this.logger.logError(error as Error, 'SQLiteClientAdapter close');
        throw new DatabaseConnectionError(`Failed to close database: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Crea una nueva persona
   * Requisitos: 2.1, 2.2, 2.3
   */
  async createPerson(name: string): Promise<Person> {
    await this.ensureInitialized();

    return this.logger.measureTime('createPerson', async () => {
      // Validar entrada
      const personModel = PersonModel.fromInput({ name });
      
      try {
        const stmt = this.db!.prepare(`
          INSERT INTO people (name, created_at) 
          VALUES (?, datetime('now'))
        `);
        stmt.run([personModel.name]);
        stmt.free();

        // Obtener el ID del último registro insertado
        const lastIdResult = this.db!.exec('SELECT last_insert_rowid() as id');
        const lastId = lastIdResult[0]?.values[0][0] as number;

        // Recuperar el registro creado
        const selectStmt = this.db!.prepare('SELECT * FROM people WHERE id = ?');
        const row = selectStmt.get([lastId]);
        selectStmt.free();

        if (!row) {
          throw new DataIntegrityError('Failed to retrieve created person');
        }

        const createdPerson = PersonModel.fromRow({
          id: row[0],
          name: row[1],
          created_at: row[2]
        });

        // Guardar cambios en OPFS
        await this.saveToOPFS();

        this.logger.logInfo('Person created', { id: createdPerson.id, name: createdPerson.name });
        return {
          id: createdPerson.id,
          name: createdPerson.name,
          created_at: createdPerson.created_at.toISOString()
        };

      } catch (error) {
        this.logger.logError(error as Error, 'createPerson', { name });
        throw new ValidationError(`Failed to create person: ${(error as Error).message}`);
      }
    });
  }

  /**
   * Obtiene una persona por ID
   * Requisitos: 4.1, 4.2
   */
  async getPersonById(id: number): Promise<Person | null> {
    await this.ensureInitialized();

    return this.logger.measureTime('getPersonById', async () => {
      try {
        const stmt = this.db!.prepare('SELECT * FROM people WHERE id = ?');
        const row = stmt.get([id]);
        stmt.free();

        if (!row) {
          return null;
        }

        const person = PersonModel.fromRow({
          id: row[0],
          name: row[1],
          created_at: row[2]
        });

        return {
          id: person.id,
          name: person.name,
          created_at: person.created_at.toISOString()
        };
      } catch (error) {
        this.logger.logError(error as Error, 'getPersonById', { id });
        throw new ValidationError(`Failed to get person: ${(error as Error).message}`);
      }
    });
  }

  /**
   * Obtiene todas las personas
   * Requisitos: 4.1, 4.4
   */
  async getAllPeople(): Promise<Person[]> {
    await this.ensureInitialized();

    return this.logger.measureTime('getAllPeople', async () => {
      try {
        const result = this.db!.exec('SELECT * FROM people ORDER BY created_at DESC');
        
        if (!result[0]) {
          return [];
        }

        return result[0].values.map((row: any[]) => {
          const person = PersonModel.fromRow({
            id: row[0],
            name: row[1],
            created_at: row[2]
          });
          return person.toJSON();
        });
      } catch (error) {
        this.logger.logError(error as Error, 'getAllPeople');
        throw new ValidationError(`Failed to get people: ${(error as Error).message}`);
      }
    });
  }

  /**
   * Crea una nueva foto facial
   * Requisitos: 3.1, 3.2, 3.3, 3.4
   */
  async createFacePhoto(personId: number, photoData: string): Promise<FacePhoto> {
    await this.ensureInitialized();

    return this.logger.measureTime('createFacePhoto', async () => {
      // Validar entrada
      const photoModel = FacePhotoModel.fromInput({ person_id: personId, photo_data: photoData });
      
      // Verificar que la persona existe
      const personExists = await this.getPersonById(personId);
      if (!personExists) {
        throw new ValidationError(`Person with ID ${personId} does not exist`);
      }

      try {
        const stmt = this.db!.prepare(`
          INSERT INTO face_photos (person_id, photo_data, captured_at) 
          VALUES (?, ?, datetime('now'))
        `);
        stmt.run([photoModel.person_id, photoModel.photo_data]);
        stmt.free();

        // Obtener el ID del último registro insertado
        const lastIdResult = this.db!.exec('SELECT last_insert_rowid() as id');
        const lastId = lastIdResult[0]?.values[0][0] as number;

        // Recuperar el registro creado con información de persona
        const selectResult = this.db!.exec(`
          SELECT fp.*, p.name as person_name
          FROM face_photos fp
          JOIN people p ON fp.person_id = p.id
          WHERE fp.id = ${lastId}
        `);

        if (!selectResult[0] || !selectResult[0].values[0]) {
          throw new DataIntegrityError('Failed to retrieve created face photo');
        }

        const row = selectResult[0].values[0];
        const createdPhoto = FacePhotoModel.fromRow({
          id: row[0],
          person_id: row[1],
          photo_data: row[2],
          captured_at: row[3],
          person_name: row[4]
        });

        // Guardar cambios en OPFS
        await this.saveToOPFS();

        this.logger.logInfo('Face photo created', { 
          id: createdPhoto.id, 
          person_id: createdPhoto.person_id,
          size: createdPhoto.getFormattedSize()
        });

        return createdPhoto.toJSON();

      } catch (error) {
        this.logger.logError(error as Error, 'createFacePhoto', { personId });
        throw new ValidationError(`Failed to create face photo: ${(error as Error).message}`);
      }
    });
  }

  /**
   * Obtiene fotos por ID de persona
   * Requisitos: 4.1, 4.2, 4.3
   */
  async getFacePhotosByPersonId(personId: number): Promise<FacePhoto[]> {
    await this.ensureInitialized();

    return this.logger.measureTime('getFacePhotosByPersonId', async () => {
      try {
        const result = this.db!.exec(`
          SELECT fp.*, p.name as person_name
          FROM face_photos fp
          JOIN people p ON fp.person_id = p.id
          WHERE fp.person_id = ${personId}
          ORDER BY fp.captured_at DESC
        `);

        if (!result[0]) {
          return [];
        }

        return result[0].values.map((row: any[]) => {
          const photo = FacePhotoModel.fromRow({
            id: row[0],
            person_id: row[1],
            photo_data: row[2],
            captured_at: row[3],
            person_name: row[4]
          });
          return photo.toJSON();
        });
      } catch (error) {
        this.logger.logError(error as Error, 'getFacePhotosByPersonId', { personId });
        throw new ValidationError(`Failed to get face photos: ${(error as Error).message}`);
      }
    });
  }

  /**
   * Obtiene todas las fotos faciales
   * Requisitos: 4.1, 4.3, 4.4
   */
  async getAllFacePhotos(): Promise<FacePhoto[]> {
    await this.ensureInitialized();

    return this.logger.measureTime('getAllFacePhotos', async () => {
      try {
        const result = this.db!.exec(`
          SELECT fp.*, p.name as person_name
          FROM face_photos fp
          JOIN people p ON fp.person_id = p.id
          ORDER BY fp.captured_at DESC
        `);

        if (!result[0]) {
          return [];
        }

        return result[0].values.map((row: any[]) => {
          const photo = FacePhotoModel.fromRow({
            id: row[0],
            person_id: row[1],
            photo_data: row[2],
            captured_at: row[3],
            person_name: row[4]
          });
          return photo.toJSON();
        });
      } catch (error) {
        this.logger.logError(error as Error, 'getAllFacePhotos');
        throw new ValidationError(`Failed to get face photos: ${(error as Error).message}`);
      }
    });
  }

  /**
   * Elimina una foto facial
   * Requisitos: 5.1, 5.2
   */
  async deleteFacePhoto(id: number): Promise<boolean> {
    await this.ensureInitialized();

    return this.logger.measureTime('deleteFacePhoto', async () => {
      try {
        // Verificar si existe antes de eliminar
        const checkStmt = this.db!.prepare('SELECT id FROM face_photos WHERE id = ?');
        const exists = checkStmt.get([id]);
        checkStmt.free();

        if (!exists) {
          return false;
        }

        const stmt = this.db!.prepare('DELETE FROM face_photos WHERE id = ?');
        stmt.run([id]);
        stmt.free();

        // Guardar cambios en OPFS
        await this.saveToOPFS();

        this.logger.logInfo('Face photo deleted', { id });
        return true;

      } catch (error) {
        this.logger.logError(error as Error, 'deleteFacePhoto', { id });
        throw new ValidationError(`Failed to delete face photo: ${(error as Error).message}`);
      }
    });
  }

  /**
   * Obtiene estadísticas de la base de datos
   */
  async getStats(): Promise<{ people: number; photos: number; totalSize: number }> {
    await this.ensureInitialized();

    const peopleResult = this.db!.exec('SELECT COUNT(*) as count FROM people');
    const photosResult = this.db!.exec('SELECT COUNT(*) as count, SUM(length(photo_data)) as size FROM face_photos');

    const peopleCount = peopleResult[0]?.values[0][0] as number || 0;
    const photosCount = photosResult[0]?.values[0][0] as number || 0;
    const totalSize = photosResult[0]?.values[0][1] as number || 0;

    return {
      people: peopleCount,
      photos: photosCount,
      totalSize: totalSize
    };
  }

  // Métodos privados

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }
  }

  /**
   * Carga la base de datos desde OPFS (Origin Private File System)
   */
  private async loadFromOPFS(): Promise<Uint8Array | null> {
    try {
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        const opfsRoot = await (navigator.storage as any).getDirectory();
        const fileHandle = await opfsRoot.getFileHandle(this.dbName);
        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        
        this.logger.logDebug('Database loaded from OPFS', { size: arrayBuffer.byteLength });
        return new Uint8Array(arrayBuffer);
      }
    } catch (error) {
      // Base de datos no existe aún o OPFS no disponible
      this.logger.logDebug('No existing database found in OPFS or OPFS not available');
      return null;
    }
    return null;
  }

  /**
   * Guarda la base de datos en OPFS
   */
  private async saveToOPFS(): Promise<void> {
    if (!this.db) return;

    try {
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        const data = this.db.export();
        const opfsRoot = await (navigator.storage as any).getDirectory();
        const fileHandle = await opfsRoot.getFileHandle(this.dbName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
        
        this.logger.logDebug('Database saved to OPFS', { size: data.length });
      } else {
        this.logger.logDebug('OPFS not available, data not persisted');
      }
    } catch (error) {
      this.logger.logError(error as Error, 'saveToOPFS');
      // No lanzar error, la persistencia es opcional
    }
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Esquema inicial simplificado para sql.js
      const migrationSQL = `
        CREATE TABLE IF NOT EXISTS people (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL CHECK(length(trim(name)) > 0 AND length(trim(name)) <= 100),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS face_photos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          person_id INTEGER NOT NULL,
          photo_data TEXT NOT NULL CHECK(length(photo_data) > 0),
          captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_face_photos_person_id ON face_photos(person_id);
        CREATE INDEX IF NOT EXISTS idx_face_photos_captured_at ON face_photos(captured_at DESC);
        CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);
      `;

      this.db.exec(migrationSQL);
      this.logger.logInfo('Client migration executed successfully');

    } catch (error) {
      this.logger.logError(error as Error, 'runMigrations');
      throw new DatabaseConnectionError(`Client migration failed: ${(error as Error).message}`);
    }
  }

  private async verifyIntegrity(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Verificar que las tablas existen
      const result = this.db.exec(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('people', 'face_photos')
      `);

      if (!result[0] || result[0].values.length < 2) {
        throw new DataIntegrityError('Required tables not found');
      }
      
      this.logger.logDebug('Client database integrity verified');
    } catch (error) {
      this.logger.logError(error as Error, 'verifyIntegrity');
      throw new DataIntegrityError(`Client integrity verification failed: ${(error as Error).message}`);
    }
  }

  /**
   * Método para obtener la instancia de base de datos (para testing)
   */
  getDatabase(): SqlJsDatabase | null {
    return this.db;
  }

  /**
   * Método para verificar si está inicializado
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Método para forzar guardado manual
   */
  async forceSave(): Promise<void> {
    await this.saveToOPFS();
  }
}