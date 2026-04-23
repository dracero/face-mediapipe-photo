// Definiciones de tipos para el sistema de base de datos SQLite

// Interfaces principales para datos de base de datos
export interface Person {
  id: number;
  name: string;
  created_at: string;
}

export interface FacePhoto {
  id: number;
  person_id: number;
  photo_data: string;
  captured_at: string;
  person_name?: string; // Para consultas con JOIN
}

// Interfaces para datos de entrada (pueden tener campos opcionales)
export interface PersonData {
  id?: number;
  name: string;
  created_at?: string | Date;
}

export interface FacePhotoData {
  id?: number;
  person_id: number;
  photo_data: string;
  captured_at?: string | Date;
  person_name?: string;
  photo_size?: number;
}

// Interfaz del adaptador de base de datos
export interface DatabaseAdapter {
  initialize(): Promise<void>;
  close(): Promise<void>;
  
  // Operaciones de personas
  createPerson(name: string): Promise<Person>;
  getPersonById(id: number): Promise<Person | null>;
  getAllPeople(): Promise<Person[]>;
  
  // Operaciones de fotos
  createFacePhoto(personId: number, photoData: string): Promise<FacePhoto>;
  getFacePhotosByPersonId(personId: number): Promise<FacePhoto[]>;
  getAllFacePhotos(): Promise<FacePhoto[]>;
  deleteFacePhoto(id: number): Promise<boolean>;
}

// Tipos para configuración
export interface DatabaseConfig {
  server: {
    dbPath: string;
    options: {
      readonly: boolean;
      fileMustExist: boolean;
      timeout: number;
      verbose?: (message?: any, ...additionalArgs: any[]) => void;
    };
  };
  client: {
    dbName: string;
    wasmConfig: {
      locateFile: (file: string) => string;
      wasmBinary?: ArrayBuffer;
    };
  };
  pragmas: readonly string[];
  limits: {
    maxImageSize: number;
    maxNameLength: number;
    connectionTimeout: number;
    queryTimeout: number;
  };
  logging: {
    enabled: boolean;
    level: string;
    logQueries: boolean;
  };
}

// Tipos para errores
export interface ErrorContext {
  [key: string]: any;
}

// Tipos para estadísticas
export interface DatabaseStats {
  people: number;
  photos: number;
  totalSize: number;
}