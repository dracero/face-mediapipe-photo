// Configuración centralizada para el sistema de base de datos SQLite
import { join } from 'path';

export const DATABASE_CONFIG = {
  // Configuración del servidor (better-sqlite3)
  server: {
    dbPath: process.env.DATABASE_PATH || join(process.cwd(), 'data', 'photos.db'),
    options: {
      readonly: false,
      fileMustExist: false,
      timeout: parseInt(process.env.SQLITE_TIMEOUT || '5000'),
      verbose: process.env.NODE_ENV === 'development' && process.env.SQLITE_VERBOSE === 'true' 
        ? console.log 
        : undefined,
    },
  },
  
  // Configuración del cliente (sql.js)
  client: {
    dbName: 'photos.db',
    wasmConfig: {
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${file}`,
      wasmBinary: undefined, // Auto-load
    },
  },
  
  // Pragmas de SQLite para optimización
  pragmas: [
    'PRAGMA foreign_keys = ON',
    'PRAGMA journal_mode = WAL',
    'PRAGMA synchronous = NORMAL',
    'PRAGMA cache_size = 1000',
    'PRAGMA temp_store = MEMORY',
    'PRAGMA encoding = "UTF-8"',
  ] as const,
  
  // Límites y validaciones
  limits: {
    maxImageSize: 10 * 1024 * 1024, // 10MB en bytes
    maxNameLength: 100,
    connectionTimeout: 5000,
    queryTimeout: 30000,
  },
  
  // Configuración de logging
  logging: {
    enabled: process.env.NODE_ENV === 'development',
    level: process.env.LOG_LEVEL || 'info',
    logQueries: process.env.SQLITE_VERBOSE === 'true',
  },
} as const;

// Tipos derivados de la configuración
export type DatabaseConfig = typeof DATABASE_CONFIG;
export type PragmaStatement = typeof DATABASE_CONFIG.pragmas[number];