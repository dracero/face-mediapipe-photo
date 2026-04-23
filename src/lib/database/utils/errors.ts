// Jerarquía de errores personalizada para el sistema de almacenamiento de fotos
// Requisitos: 7.1, 7.4, 5.4

import { DatabaseLogger } from './logger';

/**
 * Clase base abstracta para todos los errores del sistema de almacenamiento de fotos
 */
export abstract class PhotoStorageError extends Error {
  abstract readonly code: string;
  abstract readonly retryable: boolean;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;
  
  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;
    
    // Capturar stack trace si está disponible
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convierte el error a un objeto serializable
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack
    };
  }

  /**
   * Obtiene una descripción amigable del error
   */
  getUserFriendlyMessage(): string {
    return this.message;
  }

  /**
   * Verifica si este error debería ser reintentado
   */
  shouldRetry(): boolean {
    return this.retryable;
  }
}

/**
 * Error de conexión a la base de datos
 * Requisito: 5.4
 */
export class DatabaseConnectionError extends PhotoStorageError {
  readonly code = 'DB_CONNECTION_ERROR';
  readonly retryable = true;

  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }

  getUserFriendlyMessage(): string {
    return 'No se pudo conectar a la base de datos. Por favor, inténtalo de nuevo.';
  }
}

/**
 * Error de validación de datos
 * Requisitos: 7.2, 7.3
 */
export class ValidationError extends PhotoStorageError {
  readonly code = 'VALIDATION_ERROR';
  readonly retryable = false;
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any, context?: Record<string, any>) {
    super(message, { ...context, field, value });
    this.field = field;
    this.value = value;
  }

  getUserFriendlyMessage(): string {
    if (this.field) {
      return `Error en el campo "${this.field}": ${this.message}`;
    }
    return `Error de validación: ${this.message}`;
  }
}

/**
 * Error de integridad de datos
 * Requisito: 7.1
 */
export class DataIntegrityError extends PhotoStorageError {
  readonly code = 'DATA_INTEGRITY_ERROR';
  readonly retryable = false;

  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }

  getUserFriendlyMessage(): string {
    return 'Se detectó un problema de integridad en los datos. Por favor, contacta al soporte técnico.';
  }
}

/**
 * Error de rendimiento (operación demasiado lenta)
 * Requisitos: 10.1, 10.2
 */
export class PerformanceError extends PhotoStorageError {
  readonly code = 'PERFORMANCE_ERROR';
  readonly retryable = true;
  public readonly duration?: number;
  public readonly threshold?: number;

  constructor(message: string, duration?: number, threshold?: number, context?: Record<string, any>) {
    super(message, { ...context, duration, threshold });
    this.duration = duration;
    this.threshold = threshold;
  }

  getUserFriendlyMessage(): string {
    return 'La operación está tardando más de lo esperado. Por favor, inténtalo de nuevo.';
  }
}

/**
 * Error de configuración del sistema
 */
export class ConfigurationError extends PhotoStorageError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly retryable = false;

  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }

  getUserFriendlyMessage(): string {
    return 'Error de configuración del sistema. Por favor, verifica la configuración.';
  }
}

/**
 * Error de límite de recursos (tamaño de archivo, etc.)
 */
export class ResourceLimitError extends PhotoStorageError {
  readonly code = 'RESOURCE_LIMIT_ERROR';
  readonly retryable = false;
  public readonly limit?: number;
  public readonly actual?: number;

  constructor(message: string, limit?: number, actual?: number, context?: Record<string, any>) {
    super(message, { ...context, limit, actual });
    this.limit = limit;
    this.actual = actual;
  }

  getUserFriendlyMessage(): string {
    if (this.limit && this.actual) {
      return `Se excedió el límite permitido. Límite: ${this.limit}, Actual: ${this.actual}`;
    }
    return `Se excedió un límite del sistema: ${this.message}`;
  }
}

/**
 * Error de operación no soportada
 */
export class UnsupportedOperationError extends PhotoStorageError {
  readonly code = 'UNSUPPORTED_OPERATION_ERROR';
  readonly retryable = false;

  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }

  getUserFriendlyMessage(): string {
    return `Operación no soportada: ${this.message}`;
  }
}

/**
 * Error de timeout en operaciones
 */
export class TimeoutError extends PhotoStorageError {
  readonly code = 'TIMEOUT_ERROR';
  readonly retryable = true;
  public readonly timeoutMs?: number;

  constructor(message: string, timeoutMs?: number, context?: Record<string, any>) {
    super(message, { ...context, timeoutMs });
    this.timeoutMs = timeoutMs;
  }

  getUserFriendlyMessage(): string {
    return 'La operación tardó demasiado tiempo. Por favor, inténtalo de nuevo.';
  }
}

/**
 * Gestor de estrategias de reintento para errores recuperables
 */
export class RetryManager {
  private logger = DatabaseLogger.getInstance();

  /**
   * Ejecuta una operación con reintentos automáticos
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
    backoffMultiplier: number = 2
  ): Promise<T> {
    let lastError: Error;
    let currentDelay = delayMs;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Si no es un error recuperable o es el último intento, lanzar error
        if (!(error instanceof PhotoStorageError) || !error.retryable || attempt > maxRetries) {
          this.logger.logError(lastError, `Operation failed after ${attempt} attempts`);
          throw lastError;
        }

        // Log del intento fallido
        this.logger.logDebug(`Attempt ${attempt} failed, retrying in ${currentDelay}ms`, {
          error: error.message,
          code: error.code
        });

        // Esperar antes del siguiente intento
        await this.delay(currentDelay);
        currentDelay *= backoffMultiplier;
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Utilidades para manejo de errores
 */
export class ErrorUtils {
  private static logger = DatabaseLogger.getInstance();

  /**
   * Convierte cualquier error en un PhotoStorageError apropiado
   */
  static normalizeError(error: any, context?: Record<string, any>): PhotoStorageError {
    if (error instanceof PhotoStorageError) {
      return error;
    }

    const message = error?.message || 'Unknown error occurred';

    // Detectar tipos de error comunes y convertirlos
    if (message.includes('SQLITE_BUSY') || message.includes('database is locked')) {
      return new DatabaseConnectionError('Database is busy', context);
    }

    if (message.includes('SQLITE_CONSTRAINT') || message.includes('constraint')) {
      return new ValidationError('Database constraint violation', undefined, undefined, context);
    }

    if (message.includes('timeout') || message.includes('SQLITE_BUSY_TIMEOUT')) {
      return new TimeoutError('Operation timed out', undefined, context);
    }

    if (message.includes('file size') || message.includes('too large')) {
      return new ResourceLimitError('Resource limit exceeded', undefined, undefined, context);
    }

    // Error genérico
    return new ValidationError(message, undefined, undefined, context);
  }

  /**
   * Registra un error con contexto completo
   */
  static logError(error: Error, operation: string, context?: Record<string, any>): void {
    const normalizedError = this.normalizeError(error, context);
    
    this.logger.logError(normalizedError, operation, {
      code: normalizedError.code,
      retryable: normalizedError.retryable,
      timestamp: normalizedError.timestamp,
      context: normalizedError.context
    });
  }

  /**
   * Crea un error de validación con detalles específicos
   */
  static createValidationError(field: string, value: any, reason: string): ValidationError {
    return new ValidationError(reason, field, value);
  }

  /**
   * Crea un error de rendimiento con métricas
   */
  static createPerformanceError(operation: string, duration: number, threshold: number): PerformanceError {
    return new PerformanceError(
      `${operation} took ${duration}ms (threshold: ${threshold}ms)`,
      duration,
      threshold
    );
  }
}

// Instancia global del gestor de reintentos
export const retryManager = new RetryManager();