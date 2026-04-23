// Punto de entrada principal del sistema de base de datos SQLite
// Exporta todas las funcionalidades necesarias para el almacenamiento de fotos

// Gestor principal
export { DatabaseManager, getDatabaseManager, initializeDatabase } from './DatabaseManager';

// Adaptadores (para uso avanzado)
export { SQLiteServerAdapter } from './adapters/SQLiteServerAdapter';
export { SQLiteClientAdapter } from './adapters/SQLiteClientAdapter';

// Modelos de datos
export { PersonModel, createPersonFromInput, isValidPersonName } from './models/PersonModel';
export { FacePhotoModel, createFacePhotoFromInput, isValidPhotoData } from './models/FacePhotoModel';

// Tipos
export type { 
  DatabaseAdapter, 
  Person, 
  FacePhoto, 
  PersonData, 
  FacePhotoData 
} from './types';

// Errores
export { 
  PhotoStorageError,
  DatabaseConnectionError, 
  ValidationError, 
  DataIntegrityError,
  PerformanceError 
} from './utils/errors';

// Utilidades
export { DatabaseLogger } from './utils/logger';
export { validatePersonName, validatePhotoData } from './utils/validators';

// Configuración
export { DATABASE_CONFIG } from './config';

// Capa de compatibilidad con Supabase
export { 
  supabase, 
  SupabaseCompatLayer,
  initializeSupabaseCompat,
  isSupabaseCompatible 
} from '../photo-storage/SupabaseCompatLayer';

export type { 
  SupabaseResponse, 
  SupabaseMultiResponse, 
  QueryBuilder 
} from '../photo-storage/SupabaseCompatLayer';