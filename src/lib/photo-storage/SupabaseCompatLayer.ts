// Capa de compatibilidad con API de Supabase usando SQLite local
// Requisitos: 6.1, 6.2, 6.3, 6.4, 9.1, 9.3

import { DatabaseManager } from '../database/DatabaseManager';
import type { Person, FacePhoto } from '../database/types';
import { ValidationError } from '../database/utils/errors';
import { DatabaseLogger } from '../database/utils/logger';

// Tipos compatibles con Supabase
export interface SupabaseResponse<T> {
  data: T | null;
  error: Error | null;
}

export interface SupabaseMultiResponse<T> {
  data: T[] | null;
  error: Error | null;
}

// Interfaz del QueryBuilder compatible con Supabase
interface QueryBuilder<T = any> {
  select(columns?: string): QueryBuilder<T>;
  insert(data: any): Promise<SupabaseResponse<T>>;
  update(data: any): Promise<SupabaseResponse<T>>;
  delete(): Promise<SupabaseResponse<T>>;
  eq(column: string, value: any): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  
  // Métodos para ejecutar la consulta
  then<TResult1 = SupabaseMultiResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: SupabaseMultiResponse<T>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2>;
}

class SQLiteQueryBuilder<T = any> implements QueryBuilder<T> {
  private table: string;
  private dbManager: DatabaseManager;
  private logger = DatabaseLogger.getInstance();
  private selectColumns: string = '*';
  private whereConditions: Array<{ column: string; value: any; operator: string }> = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;

  constructor(table: string, dbManager: DatabaseManager) {
    this.table = table;
    this.dbManager = dbManager;
  }

  /**
   * Especifica las columnas a seleccionar
   */
  select(columns: string = '*'): QueryBuilder<T> {
    this.selectColumns = columns;
    return this;
  }

  /**
   * Inserta un nuevo registro
   * Requisitos: 6.1, 6.2
   */
  async insert(data: any): Promise<SupabaseResponse<T>> {
    try {
      let result: any;

      if (this.table === 'people') {
        if (!data.name) {
          throw new ValidationError('Name is required for people');
        }
        result = await this.dbManager.createPerson(data.name);
      } else if (this.table === 'face_photos') {
        if (!data.person_id || !data.photo_data) {
          throw new ValidationError('person_id and photo_data are required for face_photos');
        }
        result = await this.dbManager.createFacePhoto(data.person_id, data.photo_data);
      } else {
        throw new ValidationError(`Unsupported table: ${this.table}`);
      }

      this.logger.logInfo(`Inserted record into ${this.table}`, { id: result.id });
      return { data: result as T, error: null };

    } catch (error) {
      this.logger.logError(error as Error, `insert into ${this.table}`, data);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Actualiza registros (implementación básica)
   */
  async update(data: any): Promise<SupabaseResponse<T>> {
    // Por ahora, la actualización no está implementada en los adaptadores base
    // Se puede extender según necesidades futuras
    return { 
      data: null, 
      error: new Error('Update operation not implemented yet') 
    };
  }

  /**
   * Elimina registros
   */
  async delete(): Promise<SupabaseResponse<T>> {
    try {
      if (this.table === 'face_photos' && this.whereConditions.length > 0) {
        const idCondition = this.whereConditions.find(c => c.column === 'id');
        if (idCondition) {
          const deleted = await this.dbManager.deleteFacePhoto(idCondition.value);
          return { data: deleted as any, error: null };
        }
      }

      return { 
        data: null, 
        error: new Error('Delete operation requires specific conditions') 
      };

    } catch (error) {
      this.logger.logError(error as Error, `delete from ${this.table}`);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Añade condición de igualdad
   */
  eq(column: string, value: any): QueryBuilder<T> {
    this.whereConditions.push({ column, value, operator: '=' });
    return this;
  }

  /**
   * Especifica ordenamiento
   */
  order(column: string, options: { ascending?: boolean } = {}): QueryBuilder<T> {
    this.orderBy = { column, ascending: options.ascending ?? true };
    return this;
  }

  /**
   * Limita el número de resultados
   */
  limit(count: number): QueryBuilder<T> {
    this.limitCount = count;
    return this;
  }

  /**
   * Ejecuta la consulta (implementación de Promise.then)
   * Requisitos: 6.3, 6.4
   */
  async then<TResult1 = SupabaseMultiResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: SupabaseMultiResponse<T>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.executeQuery();
      
      if (onfulfilled) {
        return onfulfilled(result);
      }
      return result as any;

    } catch (error) {
      if (onrejected) {
        return onrejected(error);
      }
      throw error;
    }
  }

  /**
   * Ejecuta la consulta construida
   */
  private async executeQuery(): Promise<SupabaseMultiResponse<T>> {
    try {
      let results: any[] = [];

      if (this.table === 'people') {
        if (this.whereConditions.length > 0) {
          const idCondition = this.whereConditions.find(c => c.column === 'id');
          if (idCondition) {
            const person = await this.dbManager.getPersonById(idCondition.value);
            results = person ? [person] : [];
          }
        } else {
          results = await this.dbManager.getAllPeople();
        }
      } else if (this.table === 'face_photos') {
        if (this.whereConditions.length > 0) {
          const personIdCondition = this.whereConditions.find(c => c.column === 'person_id');
          if (personIdCondition) {
            results = await this.dbManager.getFacePhotosByPersonId(personIdCondition.value);
          }
        } else {
          results = await this.dbManager.getAllFacePhotos();
        }
      }

      // Aplicar ordenamiento si se especificó
      if (this.orderBy && results.length > 0) {
        results = this.applySorting(results);
      }

      // Aplicar límite si se especificó
      if (this.limitCount && results.length > this.limitCount) {
        results = results.slice(0, this.limitCount);
      }

      this.logger.logInfo(`Query executed on ${this.table}`, { 
        resultCount: results.length,
        conditions: this.whereConditions.length,
        orderBy: this.orderBy?.column,
        limit: this.limitCount
      });

      return { data: results as T[], error: null };

    } catch (error) {
      this.logger.logError(error as Error, `executeQuery on ${this.table}`);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Aplica ordenamiento a los resultados
   */
  private applySorting(results: any[]): any[] {
    if (!this.orderBy) return results;

    return results.sort((a, b) => {
      const aVal = a[this.orderBy!.column];
      const bVal = b[this.orderBy!.column];

      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;

      return this.orderBy!.ascending ? comparison : -comparison;
    });
  }
}

/**
 * Capa de compatibilidad principal con API de Supabase
 * Requisitos: 6.1, 6.2, 6.3, 6.4, 9.1, 9.3
 */
export class SupabaseCompatLayer {
  private dbManager: DatabaseManager;
  private logger = DatabaseLogger.getInstance();

  constructor() {
    this.dbManager = DatabaseManager.getInstance();
  }

  /**
   * Método principal compatible con supabase.from()
   * Requisitos: 6.1, 6.2
   */
  from(table: 'people' | 'face_photos'): QueryBuilder {
    this.logger.logDebug(`Creating query builder for table: ${table}`);
    return new SQLiteQueryBuilder(table, this.dbManager);
  }

  /**
   * Inicializa la capa de compatibilidad
   */
  async initialize(): Promise<void> {
    await this.dbManager.initialize();
    this.logger.logInfo('SupabaseCompatLayer initialized');
  }

  /**
   * Cierra las conexiones
   */
  async close(): Promise<void> {
    await this.dbManager.close();
    this.logger.logInfo('SupabaseCompatLayer closed');
  }

  /**
   * Obtiene estadísticas de uso
   */
  async getStats() {
    return this.dbManager.getStats();
  }

  /**
   * Verifica el estado de la conexión
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      const stats = await this.dbManager.getStats();
      return { 
        status: 'ok', 
        message: `Connected. ${stats?.people || 0} people, ${stats?.photos || 0} photos` 
      };
    } catch (error) {
      return { 
        status: 'error', 
        message: (error as Error).message 
      };
    }
  }
}

// Instancia global compatible con Supabase
const supabaseCompat = new SupabaseCompatLayer();

/**
 * Objeto global que reemplaza la importación de Supabase
 * Uso: import { supabase } from './SupabaseCompatLayer'
 * Requisitos: 6.1, 6.2, 6.3, 6.4
 */
export const supabase = {
  from: (table: 'people' | 'face_photos') => supabaseCompat.from(table),
  
  // Métodos adicionales para compatibilidad completa
  initialize: () => supabaseCompat.initialize(),
  close: () => supabaseCompat.close(),
  getStats: () => supabaseCompat.getStats(),
  healthCheck: () => supabaseCompat.healthCheck(),
};

// Exportar tipos para uso externo
export type { SupabaseResponse, SupabaseMultiResponse, QueryBuilder };

// Función de conveniencia para inicialización
export async function initializeSupabaseCompat(): Promise<void> {
  await supabaseCompat.initialize();
}

// Función de conveniencia para verificar compatibilidad
export function isSupabaseCompatible(): boolean {
  return typeof supabase.from === 'function';
}