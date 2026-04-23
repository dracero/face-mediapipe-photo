// Validadores de entrada para el sistema de almacenamiento de fotos
// Requisitos: 2.4, 7.2, 7.3

import { DATABASE_CONFIG } from '../config';

/**
 * Valida el nombre de una persona
 * Requisitos: 2.4, 7.2, 7.3
 */
export function validatePersonName(name: string): string[] {
  const errors: string[] = [];

  // Verificar que no sea null/undefined
  if (name === null || name === undefined) {
    errors.push('El nombre es requerido');
    return errors;
  }

  // Convertir a string si no lo es
  const nameStr = String(name);

  // Verificar que no esté vacío después de trim
  if (nameStr.trim().length === 0) {
    errors.push('El nombre no puede estar vacío');
    return errors;
  }

  // Verificar longitud máxima
  if (nameStr.trim().length > DATABASE_CONFIG.limits.maxNameLength) {
    errors.push(`El nombre no puede exceder ${DATABASE_CONFIG.limits.maxNameLength} caracteres`);
  }

  // Verificar caracteres permitidos (letras, espacios, acentos)
  const validNamePattern = /^[a-zA-ZÀ-ÿñÑ\s]+$/;
  if (!validNamePattern.test(nameStr.trim())) {
    errors.push('El nombre solo puede contener letras y espacios');
  }

  // Verificar que no tenga múltiples espacios consecutivos
  if (/\s{2,}/.test(nameStr.trim())) {
    errors.push('El nombre no puede tener espacios múltiples consecutivos');
  }

  // Verificar que no empiece o termine con espacio (después del trim esto no debería pasar)
  if (nameStr !== nameStr.trim()) {
    errors.push('El nombre no puede empezar o terminar con espacios');
  }

  return errors;
}

/**
 * Valida los datos de una foto en formato base64
 * Requisitos: 3.1, 7.2, 7.3
 */
export function validatePhotoData(photoData: string): string[] {
  const errors: string[] = [];

  // Verificar que no sea null/undefined
  if (photoData === null || photoData === undefined) {
    errors.push('Los datos de la foto son requeridos');
    return errors;
  }

  // Convertir a string si no lo es
  const dataStr = String(photoData);

  // Verificar que no esté vacío
  if (dataStr.length === 0) {
    errors.push('Los datos de la foto no pueden estar vacíos');
    return errors;
  }

  // Verificar formato data URL
  if (!dataStr.startsWith('data:image/')) {
    errors.push('Los datos de la foto deben estar en formato data URL (data:image/...)');
    return errors;
  }

  // Verificar que tenga la estructura correcta
  const parts = dataStr.split(',');
  if (parts.length !== 2) {
    errors.push('Formato de datos de imagen inválido');
    return errors;
  }

  const [header, base64Data] = parts;

  // Verificar header
  if (!header.includes('base64')) {
    errors.push('Los datos de la imagen deben estar codificados en base64');
  }

  // Verificar tipos MIME soportados
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const mimeType = header.match(/data:([^;]+);/)?.[1];
  if (!mimeType || !supportedTypes.includes(mimeType)) {
    errors.push('Tipo de imagen no soportado. Use JPEG, PNG o WebP');
  }

  // Verificar que los datos base64 no estén vacíos
  if (!base64Data || base64Data.length === 0) {
    errors.push('Los datos base64 de la imagen están vacíos');
    return errors;
  }

  // Verificar que sea base64 válido
  try {
    // Intentar decodificar para verificar validez
    atob(base64Data);
  } catch (error) {
    errors.push('Los datos base64 de la imagen son inválidos');
    return errors;
  }

  // Verificar tamaño máximo
  const sizeInBytes = Math.ceil(base64Data.length * 0.75); // Aproximación del tamaño real
  if (sizeInBytes > DATABASE_CONFIG.limits.maxImageSize) {
    const maxSizeMB = (DATABASE_CONFIG.limits.maxImageSize / (1024 * 1024)).toFixed(1);
    const actualSizeMB = (sizeInBytes / (1024 * 1024)).toFixed(1);
    errors.push(`La imagen es demasiado grande. Máximo: ${maxSizeMB}MB, Actual: ${actualSizeMB}MB`);
  }

  // Verificar tamaño mínimo (debe tener al menos algunos bytes de datos)
  if (base64Data.length < 100) {
    errors.push('Los datos de la imagen son demasiado pequeños para ser una imagen válida');
  }

  return errors;
}

/**
 * Valida un ID de persona
 */
export function validatePersonId(id: any): string[] {
  const errors: string[] = [];

  if (id === null || id === undefined) {
    errors.push('El ID de persona es requerido');
    return errors;
  }

  const numId = Number(id);
  if (isNaN(numId) || !Number.isInteger(numId) || numId <= 0) {
    errors.push('El ID de persona debe ser un número entero positivo');
  }

  return errors;
}

/**
 * Valida una fecha
 */
export function validateDate(date: any, fieldName: string = 'fecha'): string[] {
  const errors: string[] = [];

  if (date === null || date === undefined) {
    return errors; // Las fechas suelen ser opcionales
  }

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    errors.push(`${fieldName} tiene un formato inválido`);
    return errors;
  }

  // No permitir fechas muy futuras (más de 1 día)
  const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (dateObj > oneDayFromNow) {
    errors.push(`${fieldName} no puede estar muy en el futuro`);
  }

  // No permitir fechas muy antiguas (antes del año 2000)
  const year2000 = new Date('2000-01-01');
  if (dateObj < year2000) {
    errors.push(`${fieldName} no puede ser anterior al año 2000`);
  }

  return errors;
}

/**
 * Sanitiza un nombre de persona
 */
export function sanitizePersonName(name: string): string {
  if (!name) return '';
  
  return String(name)
    .trim()
    .replace(/\s+/g, ' ') // Reemplazar múltiples espacios con uno solo
    .substring(0, DATABASE_CONFIG.limits.maxNameLength);
}

/**
 * Sanitiza datos de foto base64
 */
export function sanitizePhotoData(photoData: string): string {
  if (!photoData) return '';
  
  const dataStr = String(photoData).trim();
  
  // Verificar formato básico
  if (!dataStr.startsWith('data:image/')) {
    throw new Error('Formato de imagen inválido');
  }
  
  const parts = dataStr.split(',');
  if (parts.length !== 2) {
    throw new Error('Formato de datos de imagen inválido');
  }
  
  const [header, base64Data] = parts;
  
  // Limpiar datos base64 (solo caracteres válidos)
  const cleanBase64 = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
  
  return `${header},${cleanBase64}`;
}

/**
 * Función de utilidad para validar múltiples campos
 */
export function validateFields(validations: Array<() => string[]>): string[] {
  const allErrors: string[] = [];
  
  for (const validation of validations) {
    const errors = validation();
    allErrors.push(...errors);
  }
  
  return allErrors;
}

/**
 * Función de utilidad para verificar si un valor es válido
 */
export function isValid(validationFn: () => string[]): boolean {
  return validationFn().length === 0;
}