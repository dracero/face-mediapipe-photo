// Gestor principal de base de datos con detección automática de entorno
// Requisitos: 9.1, 9.2, 9.3, 9.4

import type { DatabaseAdapter } from './types';
import { DatabaseConnectionError } from './utils/errors';
import { DatabaseLogger } from './utils/logger';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private adapter: DatabaseAdapter | null = null;
  private readonly logger = DatabaseLogger.getInstance();
  private initializationPromise: Promise<void> | null = null;
  private isInitializing = false;

  private constructor() {
    // Constructor privado para patrón singleton
  }

  /**
   * Obtiene la instancia singleton del DatabaseManager
   * Requisito: 9.1
   */
  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Inicializa el adaptador apropiado según el entorno de ejecución
   * Requisitos: 9.1, 9.2, 9.3
   */
  async initialize(): Promise<void> {
    // Si ya está inicializando, esperar a que termine
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Si ya está inicializado, no hacer nada
    if (this.adapter) {
      return;
    }

    // Crear promesa de inicialización para evitar múltiples inicializaciones concurrentes
    this.initializationPromise = this.performInitialization();
    
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async performInitialization(): Promise<void> {
    if (this.isInitializing) {
      throw new DatabaseConnectionError('DatabaseManager is already initializing');
    }

    this.isInitializing = true;
    const startTime = Date.now();

    try {
      const environment = this.detectEnvironment();
      this.logger.logInfo(`Detected environment: ${environment}`);

      if (environment === 'server') {
        // Entorno servidor (Node.js) - usar better-sqlite3
        const { SQLiteServerAdapter } = await import('./adapters/SQLiteServerAdapter');
        this.adapter = new SQLiteServerAdapter();
        this.logger.logDebug('Created SQLiteServerAdapter');
      } else {
        // Entorno cliente (navegador) - usar sql.js
        const { SQLiteClientAdapter } = await import('./adapters/SQLiteClientAdapter');
        this.adapter = new SQLiteClientAdapter();
        this.logger.logDebug('Created SQLiteClientAdapter');
      }

      // Inicializar el adaptador seleccionado
      await this.adapter.initialize();

      const duration = Date.now() - startTime;
      this.logger.logInfo(`DatabaseManager initialized successfully`, {
        environment,
        adapter: this.adapter.constructor.name,
        duration
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logError(error as Error, 'DatabaseManager initialization', { duration });
      
      // Limpiar estado en caso de error
      this.adapter = null;
      
      throw new DatabaseConnectionError(
        `Failed to initialize DatabaseManager: ${(error as Error).message}`
      );
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Detecta el entorno de ejecución (servidor vs cliente)
   * Requisito: 9.2
   */
  private detectEnvironment(): 'server' | 'client' {
    // Verificar si estamos en un entorno Node.js
    if (typeof window === 'undefined' && 
        typeof global !== 'undefined' && 
        typeof process !== 'undefined' && 
        process.versions && 
        process.versions.node) {
      return 'server';
    }

    // Verificar si estamos en un navegador
    if (typeof window !== 'undefined' && 
        typeof document !== 'undefined') {
      return 'client';
    }

    // Por defecto, asumir cliente si no se puede determinar
    this.logger.logDebug('Could not definitively detect environment, defaulting to client');
    return 'client';
  }

  /**
   * Obtiene el adaptador de base de datos inicializado
   * Requisito: 9.3
   */
  getAdapter(): DatabaseAdapter {
    if (!this.adapter) {
      throw new DatabaseConnectionError(
        'DatabaseManager not initialized. Call initialize() first.'
      );
    }
    return this.adapter;
  }

  /**
   * Verifica si el DatabaseManager está inicializado
   */
  isInitialized(): boolean {
    return this.adapter !== null && !this.isInitializing;
  }

  /**
   * Verifica si el DatabaseManager está en proceso de inicialización
   */
  isCurrentlyInitializing(): boolean {
    return this.isInitializing || this.initializationPromise !== null;
  }

  /**
   * Obtiene información sobre el estado actual
   */
  getStatus(): {
    initialized: boolean;
    initializing: boolean;
    environment: 'server' | 'client' | 'unknown';
    adapterType: string | null;
  } {
    return {
      initialized: this.isInitialized(),
      initializing: this.isInitializing,
      environment: this.adapter ? this.detectEnvironment() : 'unknown',
      adapterType: this.adapter ? this.adapter.constructor.name : null
    };
  }

  /**
   * Cierra la conexión de base de datos
   * Requisito: 9.4
   */
  async close(): Promise<void> {
    if (this.adapter) {
      try {
        await this.adapter.close();
        this.logger.logInfo('DatabaseManager closed successfully');
      } catch (error) {
        this.logger.logError(error as Error, 'DatabaseManager close');
        throw new DatabaseConnectionError(`Failed to close DatabaseManager: ${(error as Error).message}`);
      } finally {
        this.adapter = null;
      }
    }
  }

  /**
   * Reinicia el DatabaseManager (cierra y permite reinicialización)
   */
  async restart(): Promise<void> {
    await this.close();
    await this.initialize();
  }

  /**
   * Método de conveniencia para asegurar inicialización antes de operaciones
   */
  async ensureInitialized(): Promise<DatabaseAdapter> {
    if (!this.isInitialized()) {
      await this.initialize();
    }
    return this.getAdapter();
  }

  // Métodos de conveniencia que delegan al adaptador

  /**
   * Crea una nueva persona
   */
  async createPerson(name: string) {
    const adapter = await this.ensureInitialized();
    return adapter.createPerson(name);
  }

  /**
   * Obtiene una persona por ID
   */
  async getPersonById(id: number) {
    const adapter = await this.ensureInitialized();
    return adapter.getPersonById(id);
  }

  /**
   * Obtiene todas las personas
   */
  async getAllPeople() {
    const adapter = await this.ensureInitialized();
    return adapter.getAllPeople();
  }

  /**
   * Crea una nueva foto facial
   */
  async createFacePhoto(personId: number, photoData: string) {
    const adapter = await this.ensureInitialized();
    return adapter.createFacePhoto(personId, photoData);
  }

  /**
   * Obtiene fotos por ID de persona
   */
  async getFacePhotosByPersonId(personId: number) {
    const adapter = await this.ensureInitialized();
    return adapter.getFacePhotosByPersonId(personId);
  }

  /**
   * Obtiene todas las fotos faciales
   */
  async getAllFacePhotos() {
    const adapter = await this.ensureInitialized();
    return adapter.getAllFacePhotos();
  }

  /**
   * Elimina una foto facial
   */
  async deleteFacePhoto(id: number) {
    const adapter = await this.ensureInitialized();
    return adapter.deleteFacePhoto(id);
  }

  /**
   * Obtiene estadísticas de la base de datos (si el adaptador lo soporta)
   */
  async getStats(): Promise<{ people: number; photos: number; totalSize: number } | null> {
    const adapter = await this.ensureInitialized();
    
    // Verificar si el adaptador tiene método getStats
    if ('getStats' in adapter && typeof adapter.getStats === 'function') {
      return (adapter as any).getStats();
    }
    
    return null;
  }

  /**
   * Resetea la instancia singleton (útil para testing)
   * ⚠️ Solo usar en entornos de testing
   */
  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      if (DatabaseManager.instance) {
        DatabaseManager.instance.close().catch(console.error);
        DatabaseManager.instance = null as any;
      }
    } else {
      throw new Error('resetInstance() only available in test/development environments');
    }
  }

  /**
   * Método para testing que permite inyectar un adaptador mock
   * ⚠️ Solo usar en entornos de testing
   */
  static setTestAdapter(adapter: DatabaseAdapter): void {
    if (process.env.NODE_ENV === 'test') {
      const instance = DatabaseManager.getInstance();
      instance.adapter = adapter;
    } else {
      throw new Error('setTestAdapter() only available in test environment');
    }
  }
}

// Función de conveniencia para obtener la instancia global
export function getDatabaseManager(): DatabaseManager {
  return DatabaseManager.getInstance();
}

// Función de conveniencia para inicialización rápida
export async function initializeDatabase(): Promise<DatabaseManager> {
  const manager = DatabaseManager.getInstance();
  await manager.initialize();
  return manager;
}