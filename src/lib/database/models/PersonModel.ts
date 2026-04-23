// Modelo de datos para personas con validación completa
// Requisitos: 2.4, 7.2, 7.3

import { ValidationError } from '../utils/errors';
import { validatePersonName } from '../utils/validators';

export interface PersonData {
  id?: number;
  name: string;
  created_at?: string | Date;
}

export class PersonModel {
  public readonly id: number;
  public readonly name: string;
  public readonly created_at: Date;

  constructor(data: PersonData) {
    // Validar datos antes de crear la instancia
    const validationErrors = PersonModel.validate(data);
    if (validationErrors.length > 0) {
      throw new ValidationError(`Invalid person data: ${validationErrors.join(', ')}`);
    }

    this.id = data.id || 0; // 0 para nuevos registros, se asignará en DB
    this.name = data.name.trim();
    this.created_at = data.created_at ? new Date(data.created_at) : new Date();
  }

  /**
   * Crea una instancia PersonModel desde una fila de base de datos
   */
  static fromRow(row: any): PersonModel {
    if (!row) {
      throw new ValidationError('Cannot create PersonModel from null/undefined row');
    }

    return new PersonModel({
      id: row.id,
      name: row.name,
      created_at: row.created_at
    });
  }

  /**
   * Crea una instancia PersonModel desde datos de entrada del usuario
   */
  static fromInput(input: { name: string }): PersonModel {
    return new PersonModel({
      name: input.name
    });
  }

  /**
   * Valida los datos de una persona
   * Requisitos: 2.4, 7.2, 7.3
   */
  static validate(data: PersonData): string[] {
    const errors: string[] = [];

    // Validar que el objeto no sea null/undefined
    if (!data) {
      errors.push('Person data is required');
      return errors;
    }

    // Validar nombre usando el validador centralizado
    const nameErrors = validatePersonName(data.name);
    errors.push(...nameErrors);

    // Validar ID si está presente
    if (data.id !== undefined) {
      if (!Number.isInteger(data.id) || data.id < 0) {
        errors.push('ID must be a non-negative integer');
      }
    }

    // Validar fecha si está presente
    if (data.created_at !== undefined) {
      const date = new Date(data.created_at);
      if (isNaN(date.getTime())) {
        errors.push('Invalid created_at date format');
      }
      
      // No permitir fechas futuras
      if (date > new Date()) {
        errors.push('created_at cannot be in the future');
      }
    }

    return errors;
  }

  /**
   * Valida la instancia actual
   */
  validate(): string[] {
    return PersonModel.validate({
      id: this.id,
      name: this.name,
      created_at: this.created_at
    });
  }

  /**
   * Verifica si la instancia es válida
   */
  isValid(): boolean {
    return this.validate().length === 0;
  }

  /**
   * Convierte la instancia a un objeto plano para serialización
   */
  toJSON(): PersonData {
    return {
      id: this.id || undefined,
      name: this.name,
      created_at: this.created_at.toISOString()
    };
  }

  /**
   * Convierte la instancia a formato compatible con base de datos
   */
  toDbRow(): { name: string; created_at?: string } {
    const row: { name: string; created_at?: string } = {
      name: this.name
    };

    // Solo incluir created_at si no es un nuevo registro
    if (this.id > 0) {
      row.created_at = this.created_at.toISOString();
    }

    return row;
  }

  /**
   * Crea una copia de la instancia con nuevos datos
   */
  update(updates: Partial<PersonData>): PersonModel {
    return new PersonModel({
      id: this.id,
      name: updates.name !== undefined ? updates.name : this.name,
      created_at: updates.created_at !== undefined ? updates.created_at : this.created_at
    });
  }

  /**
   * Compara dos instancias de PersonModel
   */
  equals(other: PersonModel): boolean {
    if (!other || !(other instanceof PersonModel)) {
      return false;
    }

    return (
      this.id === other.id &&
      this.name === other.name &&
      this.created_at.getTime() === other.created_at.getTime()
    );
  }

  /**
   * Genera una representación string de la instancia
   */
  toString(): string {
    return `PersonModel(id=${this.id}, name="${this.name}", created_at=${this.created_at.toISOString()})`;
  }

  /**
   * Obtiene el nombre formateado para mostrar
   */
  getDisplayName(): string {
    return this.name.trim();
  }

  /**
   * Obtiene la edad del registro en días
   */
  getAgeInDays(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.created_at.getTime());
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
    const data = `${this.id}:${this.name}:${this.created_at.getTime()}`;
    return btoa(data).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * Valida que el nombre no contenga caracteres peligrosos
   */
  private static validateSafeName(name: string): boolean {
    // Prevenir inyección SQL y XSS básico
    const dangerousPatterns = [
      /[<>]/,           // HTML tags
      /['"]/,           // Quotes que podrían causar inyección SQL
      /[;]/,            // Terminadores SQL
      /--/,             // Comentarios SQL
      /\/\*/,           // Comentarios SQL multilinea
    ];

    return !dangerousPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Sanitiza el nombre removiendo caracteres peligrosos
   */
  static sanitizeName(name: string): string {
    if (!name) return '';
    
    return name
      .trim()
      .replace(/[<>'"`;]/g, '') // Remover caracteres peligrosos
      .replace(/--/g, '')       // Remover comentarios SQL
      .replace(/\/\*/g, '')     // Remover comentarios SQL
      .replace(/\s+/g, ' ')     // Normalizar espacios
      .substring(0, 100);       // Limitar longitud
  }
}

// Función de conveniencia para crear PersonModel desde entrada de usuario
export function createPersonFromInput(name: string): PersonModel {
  const sanitizedName = PersonModel.sanitizeName(name);
  return PersonModel.fromInput({ name: sanitizedName });
}

// Función de conveniencia para validar nombre rápidamente
export function isValidPersonName(name: string): boolean {
  return validatePersonName(name).length === 0;
}

// Exportar tipos para uso externo
export type { PersonData };