// Declaraciones de tipos globales para el proyecto

// Extensiones para Navigator (OPFS)
interface Navigator {
  storage?: {
    getDirectory(): Promise<FileSystemDirectoryHandle>;
  };
}

// Extensiones para FileSystem API
interface FileSystemDirectoryHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

interface FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
}

// Declaraciones para sql.js si los tipos no están disponibles
declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  interface Database {
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  interface Statement {
    run(params?: any[]): void;
    get(params?: any[]): any;
    all(params?: any[]): any[];
    free(): void;
  }

  interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  interface InitSqlJsConfig {
    locateFile?: (file: string) => string;
    wasmBinary?: ArrayBuffer;
  }

  function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>;
  export = initSqlJs;
}

// Variables de entorno
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    DATABASE_PATH?: string;
    LOG_LEVEL?: string;
    SQLITE_VERBOSE?: string;
    SQLITE_TIMEOUT?: string;
  }
}