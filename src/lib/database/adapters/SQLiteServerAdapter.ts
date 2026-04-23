// Adaptador SQLite para entorno servidor usando better-sqlite3
// Requisitos: 1.1, 5.1, 5.2, 5.3, 8.1, 8.2

import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import type { DatabaseAdapter, Person, FacePhoto } from '../types';
import { PersonModel } from '../models/PersonModel';
import { FacePhotoModel } from '../models/FacePhotoModel';
import { DatabaseConnectionError, ValidationError, DataIntegrityError } from '../utils/errors';
import { DatabaseLogger } from '../utils/logger';
import { DATABASE_CONFIG } from '../config';

export class SQLiteServerAdapter implements DatabaseAdapter {
  private db: Database.Database | null = null;
  private readonly logger = DatabaseLogger.getInstance();
  private readonly dbPath: string;
  private isInitialized = false;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || DATABASE_CONFIG.server.dbPath;
  }

  /**
   * Inicializa la base de datos y ejecuta migraciones
   * Requisitos: 1.1, 8.1, 8.2
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.db) {
      return;
    }

    const startTime = Date.now();

    try {
      // Crear directorio si no existe
      await this.ensureDataDirectory();

      // Inicializar base de datos
      this.db = new Database(this.dbPath, DATABASE_CONFIG.server.options);

      // Configurar pragmas para optimización
      await this.configurePragmas();

      // Ejecutar migraciones
      await this.runMigrations();

      // Verificar integridad
      await this.verifyIntegrity();

      this.isInitialized = true;
      const duration = Date.now() - startTime;
      this.logger.logInitialization('SQLiteServerAdapter', true, duration);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logInitialization('SQLiteServerAdapter', false, duration);
      this.logger.logError(error as Error, 'SQLiteServerAdapter initialization');
      throw new DatabaseConnectionError(`Failed to initialize SQLite database: ${(error as Error).message}`);
    }
  }

  /**
   * Cierra la conexión a la base de datos
   * Requisitos: 5.2
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        this.isInitialized = false;
        this.logger.logInfo('SQLiteServerAdapter connection closed');
      } catch (error) {
        this.logger.logError(error as Error, 'SQLiteServerAdapter close');
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
      
      const stmt = this.db!.prepare(`
        INSERT INTO people (name, created_at) 
        VALUES (?, datetime('now'))
      `);

      try {
        const result = stmt.run(personModel.name);
        
        // Recuperar el registro creado
        const selectStmt = this.db!.prepare(`
          SELECT * FROM people WHERE id = ?
        `);
        
        const row = selectStmt.get(result.lastInsertRowid);
        if (!row) {
          throw new DataIntegrityError('Failed to retrieve created person');
        }

        const createdPerson = PersonModel.fromRow(row);
        this.logger.logInfo('Person created', { id: createdPerson.id, name: createdPerson.name });
        
        return {
          id: createdPerson.id,
          name: createdPerson.name,
          created_at: createdPerson.created_at.toISOString()
        };
      } catch (error) {
        this.logger.logError(error as Error, 'createPerson', { name });
        if ((error as Error).message.includes('UNIQUE constraint')) {
          throw new ValidationError('Person with this name already exists');
        }
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
      const stmt = this.db!.prepare(`
        SELECT * FROM people WHERE id = ?
      `);

      try {
        const row = stmt.get(id);
        if (!row) {
          return null;
        }

        const person = PersonModel.fromRow(row);
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
      const stmt = this.db!.prepare(`
        SELECT * FROM people ORDER BY created_at DESC
      `);

      try {
        const rows = stmt.all();
        return rows.map(row => {
          const person = PersonModel.fromRow(row);
          return {
            id: person.id,
            name: person.name,
            created_at: person.created_at.toISOString()
          };
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

      const stmt = this.db!.prepare(`
        INSERT INTO face_photos (person_id, photo_data, captured_at) 
        VALUES (?, ?, datetime('now'))
      `);

      try {
        const result = stmt.run(photoModel.person_id, photoModel.photo_data);
        
        // Recuperar el registro creado con información de persona
        const selectStmt = this.db!.prepare(`
          SELECT fp.*, p.name as person_name
          FROM face_photos fp
          JOIN people p ON fp.person_id = p.id
          WHERE fp.id = ?
        `);
        
        const row = selectStmt.get(result.lastInsertRowid);
        if (!row) {
          throw new DataIntegrityError('Failed to retrieve created face photo');
        }

        const createdPhoto = FacePhotoModel.fromRow(row);
        this.logger.logInfo('Face photo created', { 
          id: createdPhoto.id, 
          person_id: createdPhoto.person_id,
          size: createdPhoto.getFormattedSize()
        });
        
        return {
          id: createdPhoto.id,
          person_id: createdPhoto.person_id,
          photo_data: createdPhoto.photo_data,
          captured_at: createdPhoto.captured_at.toISOString(),
          person_name: createdPhoto.person_name
        };
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
      const stmt = this.db!.prepare(`
        SELECT fp.*, p.name as person_name
        FROM face_photos fp
        JOIN people p ON fp.person_id = p.id
        WHERE fp.person_id = ?
        ORDER BY fp.captured_at DESC
      `);

      try {
        const rows = stmt.all(personId);
        return rows.map(row => {
          const photo = FacePhotoModel.fromRow(row);
          return {
            id: photo.id,
            person_id: photo.person_id,
            photo_data: photo.photo_data,
            captured_at: photo.captured_at.toISOString(),
            person_name: photo.person_name
          };
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
      const stmt = this.db!.prepare(`
        SELECT fp.*, p.name as person_name
        FROM face_photos fp
        JOIN people p ON fp.person_id = p.id
        ORDER BY fp.captured_at DESC
      `);

      try {
        const rows = stmt.all();
        return rows.map(row => {
          const photo = FacePhotoModel.fromRow(row);
          return {
            id: photo.id,
            person_id: photo.person_id,
            photo_data: photo.photo_data,
            captured_at: photo.captured_at.toISOString(),
            person_name: photo.person_name
          };
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
      const stmt = this.db!.prepare(`
        DELETE FROM face_photos WHERE id = ?
      `);

      try {
        const result = stmt.run(id);
        const deleted = result.changes > 0;
        
        if (deleted) {
          this.logger.logInfo('Face photo deleted', { id });
        }
        
        return deleted;
      } catch (error) {
        this.logger.logError(error as Error, 'deleteFacePhoto', { id });
        throw new ValidationError(`Failed to delete face photo: ${(error as Error).message}`);
      }
    });
  }

  /**
   * Ejecuta una transacción
   * Requisitos: 5.3, 10.5
   */
  async executeTransaction<T>(operations: (adapter: SQLiteServerAdapter) => Promise<T>): Promise<T> {
    await this.ensureInitialized();

    return this.logger.measureTime('transaction', async () => {
      const transaction = this.db!.transaction(() => {
        return operations(this);
      });

      try {
        return transaction();
      } catch (error) {
        this.logger.logError(error as Error, 'transaction');
        throw new ValidationError(`Transaction failed: ${(error as Error).message}`);
      }
    });
  }

  /**
   * Obtiene estadísticas de la base de datos
   */
  async getStats(): Promise<{ people: number; photos: number; totalSize: number }> {
    await this.ensureInitialized();

    const peopleStmt = this.db!.prepare('SELECT COUNT(*) as count FROM people');
    const photosStmt = this.db!.prepare('SELECT COUNT(*) as count, SUM(length(photo_data)) as size FROM face_photos');

    const peopleResult = peopleStmt.get() as { count: number };
    const photosResult = photosStmt.get() as { count: number; size: number };

    return {
      people: peopleResult.count,
      photos: photosResult.count,
      totalSize: photosResult.size || 0
    };
  }

  // Métodos privados

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }
  }

  private async ensureDataDirectory(): Promise<void> {
    const dataDir = dirname(this.dbPath);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
      this.logger.logInfo(`Created data directory: ${dataDir}`);
    }
  }

  private async configurePragmas(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    for (const pragma of DATABASE_CONFIG.pragmas) {
      this.db.pragma(pragma.replace('PRAGMA ', ''));
    }

    this.logger.logDebug('SQLite pragmas configured', { pragmas: DATABASE_CONFIG.pragmas });
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Verificar si las tablas ya existen
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('people', 'face_photos')
      `).all();

      if (tables.length === 0) {
        // Ejecutar migración inicial
        const migrationPath = join(__dirname, '../migrations/001_initial_schema.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf-8');
        
        // Ejecutar en partes para evitar problemas con múltiples statements
        const statements = migrationSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
          if (statement.toUpperCase().startsWith('PRAGMA')) {
            // Los pragmas ya se configuraron anteriormente
            continue;
          }
          this.db.exec(statement);
        }

        this.logger.logInfo('Initial migration executed successfully');
      } else {
        this.logger.logDebug('Database schema already exists, skipping migration');
      }
    } catch (error) {
      this.logger.logError(error as Error, 'runMigrations');
      throw new DatabaseConnectionError(`Migration failed: ${(error as Error).message}`);
    }
  }

  private async verifyIntegrity(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = this.db.pragma('integrity_check') as Array<{ integrity_check: string }>;
      if (result[0]?.integrity_check !== 'ok') {
        throw new DataIntegrityError('Database integrity check failed');
      }
      
      this.logger.logDebug('Database integrity verified');
    } catch (error) {
      this.logger.logError(error as Error, 'verifyIntegrity');
      throw new DataIntegrityError(`Integrity verification failed: ${(error as Error).message}`);
    }
  }

  /**
   * Método para obtener la instancia de base de datos (para testing)
   */
  getDatabase(): Database.Database | null {
    return this.db;
  }

  /**
   * Método para verificar si está inicializado
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }
}