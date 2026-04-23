// Modelo de datos para fotos faciales con validación completa
// Requisitos: 3.1, 7.2, 7.3

import { ValidationError } from '../utils/errors';
import { validatePhotoData } from '../utils/validators';
import { DATABASE_CONFIG } from '../config';

export interface FacePhotoData {
  id?: number;
  person_id: number;
  photo_data: string;
  captured_at?: string | Date;
  person_name?: string; // Para consultas con JOIN
  photo_size?: number;  // Calculado automáticamente
}

export class FacePhotoModel {
  public readonly id: number;
  public readonly person_id: number;
  public readonly photo_data: string;
  public readonly captured_at: Date;
  public readonly person_name?: string;
  public readonly photo_size: number;

  constructor(data: FacePhotoData) {
    // Validar datos antes de crear la instancia
    const validationErrors = FacePhotoModel.validate(data);
    if (validationErrors.length > 0) {
      throw new ValidationError(`Invalid face photo data: ${validationErrors.join(', ')}`);
    }

    this.id = data.id || 0; // 0 para nuevos registros
    this.person_id = data.person_id;
    this.photo_data = data.photo_data;
    this.captured_at = data.captured_at ? new Date(data.captured_at) : new Date();
    this.person_name = data.person_name;
    this.photo_size = data.photo_size || this.calculatePhotoSize();
  }

  /**
   * Crea una instancia FacePhotoModel desde una fila de base de datos
   */
  static fromRow(row: any): FacePhotoModel {
    if (!row) {
      throw new ValidationError('Cannot create FacePhotoModel from null/undefined row');
    }

    return new FacePhotoModel({
      id: row.id,
      person_id: row.person_id,
      photo_data: row.photo_data,
      captured_at: row.captured_at,
      person_name: row.person_name, // Puede venir de JOIN
      photo_size: row.photo_size
    });
  }

  /**
   * Crea una instancia FacePhotoModel desde datos de entrada del usuario
   */
  static fromInput(input: { person_id: number; photo_data: string }): FacePhotoModel {
    return new FacePhotoModel({
      person_id: input.person_id,
      photo_data: input.photo_data
    });
  }

  /**
   * Valida los datos de una foto facial
   * Requisitos: 3.1, 7.2, 7.3
   */
  static validate(data: FacePhotoData): string[] {
    const errors: string[] = [];

    // Validar que el objeto no sea null/undefined
    if (!data) {
      errors.push('Face photo data is required');
      return errors;
    }

    // Validar person_id
    if (!data.person_id || !Number.isInteger(data.person_id) || data.person_id <= 0) {
      errors.push('Valid person_id is required (positive integer)');
    }

    // Validar photo_data usando el validador centralizado
    const photoErrors = validatePhotoData(data.photo_data);
    errors.push(...photoErrors);

    // Validar ID si está presente
    if (data.id !== undefined) {
      if (!Number.isInteger(data.id) || data.id < 0) {
        errors.push('ID must be a non-negative integer');
      }
    }

    // Validar fecha si está presente
    if (data.captured_at !== undefined) {
      const date = new Date(data.captured_at);
      if (isNaN(date.getTime())) {
        errors.push('Invalid captured_at date format');
      }
      
      // No permitir fechas futuras (con margen de 1 minuto)
      const now = new Date();
      const oneMinuteFromNow = new Date(now.getTime() + 60000);
      if (date > oneMinuteFromNow) {
        errors.push('captured_at cannot be in the future');
      }
    }

    // Validar person_name si está presente (para consultas con JOIN)
    if (data.person_name !== undefined) {
      if (typeof data.person_name !== 'string') {
        errors.push('person_name must be a string');
      } else if (data.person_name.trim().length === 0) {
        errors.push('person_name cannot be empty');
      }
    }

    return errors;
  }

  /**
   * Valida la instancia actual
   */
  validate(): string[] {
    return FacePhotoModel.validate({
      id: this.id,
      person_id: this.person_id,
      photo_data: this.photo_data,
      captured_at: this.captured_at,
      person_name: this.person_name,
      photo_size: this.photo_size
    });
  }

  /**
   * Verifica si la instancia es válida
   */
  isValid(): boolean {
    return this.validate().length === 0;
  }

  /**
   * Calcula el tamaño aproximado de la foto en bytes
   */
  private calculatePhotoSize(): number {
    if (!this.photo_data) return 0;
    
    // Extraer la parte base64 (después de la coma)
    const base64Data = this.photo_data.split(',')[1] || '';
    
    // Calcular tamaño aproximado: cada 4 caracteres base64 = 3 bytes
    return Math.ceil(base64Data.length * 0.75);
  }

  /**
   * Obtiene el tamaño de la foto en bytes
   */
  getPhotoSize(): number {
    return this.photo_size;
  }

  /**
   * Obtiene el tamaño de la foto formateado para humanos
   */
  getFormattedSize(): string {
    const bytes = this.photo_size;
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Verifica si la foto excede el tamaño máximo permitido
   */
  exceedsMaxSize(): boolean {
    return this.photo_size > DATABASE_CONFIG.limits.maxImageSize;
  }

  /**
   * Obtiene el tipo MIME de la imagen
   */
  getMimeType(): string | null {
    const match = this.photo_data.match(/^data:([^;]+);base64,/);
    return match ? match[1] : null;
  }

  /**
   * Obtiene la extensión de archivo basada en el tipo MIME
   */
  getFileExtension(): string {
    const mimeType = this.getMimeType();
    switch (mimeType) {
      case 'image/jpeg': return 'jpg';
      case 'image/png': return 'png';
      case 'image/webp': return 'webp';
      case 'image/gif': return 'gif';
      default: return 'bin';
    }
  }

  /**
   * Verifica si el formato de imagen es soportado
   */
  isSupportedFormat(): boolean {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    return supportedTypes.includes(this.getMimeType() || '');
  }

  /**
   * Convierte la instancia a un objeto plano para serialización
   */
  toJSON(): FacePhotoData {
    return {
      id: this.id || undefined,
      person_id: this.person_id,
      photo_data: this.photo_data,
      captured_at: this.captured_at.toISOString(),
      person_name: this.person_name,
      photo_size: this.photo_size
    };
  }

  /**
   * Convierte la instancia a formato compatible con base de datos
   */
  toDbRow(): { person_id: number; photo_data: string; captured_at?: string } {
    const row: { person_id: number; photo_data: string; captured_at?: string } = {
      person_id: this.person_id,
      photo_data: this.photo_data
    };

    // Solo incluir captured_at si no es un nuevo registro
    if (this.id > 0) {
      row.captured_at = this.captured_at.toISOString();
    }

    return row;
  }

  /**
   * Crea una copia de la instancia con nuevos datos
   */
  update(updates: Partial<FacePhotoData>): FacePhotoModel {
    return new FacePhotoModel({
      id: this.id,
      person_id: updates.person_id !== undefined ? updates.person_id : this.person_id,
      photo_data: updates.photo_data !== undefined ? updates.photo_data : this.photo_data,
      captured_at: updates.captured_at !== undefined ? updates.captured_at : this.captured_at,
      person_name: updates.person_name !== undefined ? updates.person_name : this.person_name
    });
  }

  /**
   * Compara dos instancias de FacePhotoModel
   */
  equals(other: FacePhotoModel): boolean {
    if (!other || !(other instanceof FacePhotoModel)) {
      return false;
    }

    return (
      this.id === other.id &&
      this.person_id === other.person_id &&
      this.photo_data === other.photo_data &&
      this.captured_at.getTime() === other.captured_at.getTime()
    );
  }

  /**
   * Genera una representación string de la instancia
   */
  toString(): string {
    const sizeStr = this.getFormattedSize();
    const typeStr = this.getMimeType() || 'unknown';
    return `FacePhotoModel(id=${this.id}, person_id=${this.person_id}, size=${sizeStr}, type=${typeStr})`;
  }

  /**
   * Obtiene la edad de la foto en días
   */
  getAgeInDays(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.captured_at.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Verifica si es un nuevo registro (sin ID asignado)
   */
  isNewRecord(): boolean {
    return !this.id || this.id === 0;
  }

  /**
   * Genera un hash simple para comparación rápida
   */
  getHash(): string {
    const data = `${this.id}:${this.person_id}:${this.captured_at.getTime()}`;
    return btoa(data).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * Obtiene una versión thumbnail de los datos base64 (solo los primeros caracteres)
   */
  getThumbnailData(maxLength: number = 100): string {
    if (this.photo_data.length <= maxLength) {
      return this.photo_data;
    }
    
    const [header, base64] = this.photo_data.split(',');
    const truncatedBase64 = base64.substring(0, maxLength - header.length - 1);
    return `${header},${truncatedBase64}...`;
  }

  /**
   * Valida que los datos base64 sean válidos
   */
  static isValidBase64(data: string): boolean {
    try {
      // Extraer la parte base64
      const base64Data = data.split(',')[1] || '';
      
      // Intentar decodificar y recodificar
      const decoded = atob(base64Data);
      const reencoded = btoa(decoded);
      
      return reencoded === base64Data;
    } catch {
      return false;
    }
  }

  /**
   * Sanitiza los datos de foto removiendo caracteres peligrosos
   */
  static sanitizePhotoData(photoData: string): string {
    if (!photoData) return '';
    
    // Verificar formato básico
    if (!photoData.startsWith('data:image/')) {
      throw new ValidationError('Photo data must start with data:image/');
    }
    
    // Extraer y validar partes
    const [header, base64] = photoData.split(',');
    if (!header || !base64) {
      throw new ValidationError('Invalid photo data format');
    }
    
    // Limpiar base64 (solo caracteres válidos)
    const cleanBase64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
    
    return `${header},${cleanBase64}`;
  }
}

// Función de conveniencia para crear FacePhotoModel desde entrada de usuario
export function createFacePhotoFromInput(person_id: number, photo_data: string): FacePhotoModel {
  const sanitizedData = FacePhotoModel.sanitizePhotoData(photo_data);
  return FacePhotoModel.fromInput({ person_id, photo_data: sanitizedData });
}

// Función de conveniencia para validar datos de foto rápidamente
export function isValidPhotoData(photo_data: string): boolean {
  return validatePhotoData(photo_data).length === 0;
}

// Exportar tipos para uso externo
export type { FacePhotoData };