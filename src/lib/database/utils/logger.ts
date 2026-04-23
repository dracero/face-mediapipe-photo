// Sistema de logging para operaciones de base de datos
import { DATABASE_CONFIG } from '../config';

export class DatabaseLogger {
  private static instance: DatabaseLogger;
  
  static getInstance(): DatabaseLogger {
    if (!DatabaseLogger.instance) {
      DatabaseLogger.instance = new DatabaseLogger();
    }
    return DatabaseLogger.instance;
  }
  
  private constructor() {}
  
  logQuery(query: string, params: any[] = [], duration?: number): void {
    if (!DATABASE_CONFIG.logging.enabled || !DATABASE_CONFIG.logging.logQueries) {
      return;
    }
    
    const durationStr = duration !== undefined ? ` | Duration: ${duration}ms` : '';
    console.log(`[DB QUERY] ${query} | Params: ${JSON.stringify(params)}${durationStr}`);
  }
  
  logError(error: Error, context: string, metadata?: Record<string, any>): void {
    const metadataStr = metadata ? ` | Metadata: ${JSON.stringify(metadata)}` : '';
    console.error(`[DB ERROR] ${context}: ${error.message}${metadataStr}`, error);
  }
  
  logPerformance(operation: string, duration: number, threshold: number = 100): void {
    if (!DATABASE_CONFIG.logging.enabled) {
      return;
    }
    
    if (duration > threshold) {
      console.warn(`[DB PERFORMANCE] ${operation} took ${duration}ms (threshold: ${threshold}ms)`);
    } else if (DATABASE_CONFIG.logging.level === 'debug') {
      console.debug(`[DB PERFORMANCE] ${operation} completed in ${duration}ms`);
    }
  }
  
  logInfo(message: string, metadata?: Record<string, any>): void {
    if (!DATABASE_CONFIG.logging.enabled) {
      return;
    }
    
    const metadataStr = metadata ? ` | ${JSON.stringify(metadata)}` : '';
    console.info(`[DB INFO] ${message}${metadataStr}`);
  }
  
  logDebug(message: string, metadata?: Record<string, any>): void {
    if (!DATABASE_CONFIG.logging.enabled || DATABASE_CONFIG.logging.level !== 'debug') {
      return;
    }
    
    const metadataStr = metadata ? ` | ${JSON.stringify(metadata)}` : '';
    console.debug(`[DB DEBUG] ${message}${metadataStr}`);
  }
  
  // Método para medir tiempo de ejecución
  async measureTime<T>(
    operation: string, 
    fn: () => Promise<T>, 
    threshold?: number
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.logPerformance(operation, duration, threshold);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logError(error as Error, `${operation} (failed after ${duration}ms)`);
      throw error;
    }
  }
  
  // Método para logging de inicialización
  logInitialization(adapter: string, success: boolean, duration?: number): void {
    if (!DATABASE_CONFIG.logging.enabled) {
      return;
    }
    
    const status = success ? 'SUCCESS' : 'FAILED';
    const durationStr = duration !== undefined ? ` in ${duration}ms` : '';
    console.info(`[DB INIT] ${adapter} adapter initialization ${status}${durationStr}`);
  }
}