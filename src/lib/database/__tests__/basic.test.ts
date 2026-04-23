// Pruebas básicas del sistema de almacenamiento SQLite
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../DatabaseManager';
import { PersonModel } from '../models/PersonModel';
import { FacePhotoModel } from '../models/FacePhotoModel';

describe('Sistema de Almacenamiento SQLite', () => {
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    // Usar una instancia fresca para cada prueba
    DatabaseManager.resetInstance();
    dbManager = DatabaseManager.getInstance();
    await dbManager.initialize();
  });

  afterEach(async () => {
    await dbManager.close();
  });

  describe('PersonModel', () => {
    it('debería crear una persona válida', () => {
      const person = PersonModel.fromInput({ name: 'Juan Pérez' });
      expect(person.name).toBe('Juan Pérez');
      expect(person.isValid()).toBe(true);
    });

    it('debería validar nombres correctamente', () => {
      expect(() => PersonModel.fromInput({ name: '' })).toThrow();
      expect(() => PersonModel.fromInput({ name: '   ' })).toThrow();
      expect(() => PersonModel.fromInput({ name: 'A'.repeat(101) })).toThrow();
    });

    it('debería sanitizar nombres correctamente', () => {
      const sanitized = PersonModel.sanitizeName('  Juan<script>  ');
      expect(sanitized).toBe('Juanscript');
    });
  });

  describe('FacePhotoModel', () => {
    const validPhotoData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';

    it('debería crear una foto válida', () => {
      const photo = FacePhotoModel.fromInput({
        person_id: 1,
        photo_data: validPhotoData
      });
      expect(photo.person_id).toBe(1);
      expect(photo.photo_data).toBe(validPhotoData);
      expect(photo.isValid()).toBe(true);
    });

    it('debería validar datos de foto correctamente', () => {
      expect(() => FacePhotoModel.fromInput({
        person_id: 0,
        photo_data: validPhotoData
      })).toThrow();

      expect(() => FacePhotoModel.fromInput({
        person_id: 1,
        photo_data: 'invalid-data'
      })).toThrow();
    });

    it('debería calcular el tamaño de la foto', () => {
      const photo = FacePhotoModel.fromInput({
        person_id: 1,
        photo_data: validPhotoData
      });
      expect(photo.getPhotoSize()).toBeGreaterThan(0);
    });

    it('debería detectar el tipo MIME', () => {
      const photo = FacePhotoModel.fromInput({
        person_id: 1,
        photo_data: validPhotoData
      });
      expect(photo.getMimeType()).toBe('image/jpeg');
      expect(photo.getFileExtension()).toBe('jpg');
    });
  });

  describe('DatabaseManager', () => {
    it('debería detectar el entorno correctamente', () => {
      const status = dbManager.getStatus();
      expect(status.initialized).toBe(true);
      expect(['server', 'client']).toContain(status.environment);
    });

    it('debería crear y recuperar personas', async () => {
      const person = await dbManager.createPerson('Test Person');
      expect(person.name).toBe('Test Person');
      expect(person.id).toBeGreaterThan(0);

      const retrieved = await dbManager.getPersonById(person.id!);
      expect(retrieved).toBeTruthy();
      expect(retrieved!.name).toBe('Test Person');
    });

    it('debería listar todas las personas', async () => {
      await dbManager.createPerson('Person 1');
      await dbManager.createPerson('Person 2');

      const people = await dbManager.getAllPeople();
      expect(people.length).toBeGreaterThanOrEqual(2);
    });

    it('debería crear y recuperar fotos', async () => {
      const person = await dbManager.createPerson('Photo Test Person');
      
      const photo = await dbManager.createFacePhoto(person.id!, validPhotoData);
      expect(photo.person_id).toBe(person.id);
      expect(photo.photo_data).toBe(validPhotoData);

      const photos = await dbManager.getFacePhotosByPersonId(person.id!);
      expect(photos.length).toBe(1);
      expect(photos[0].id).toBe(photo.id);
    });

    it('debería obtener estadísticas', async () => {
      const stats = await dbManager.getStats();
      expect(stats).toBeTruthy();
      expect(typeof stats!.people).toBe('number');
      expect(typeof stats!.photos).toBe('number');
      expect(typeof stats!.totalSize).toBe('number');
    });
  });

  describe('Integración completa', () => {
    it('debería manejar un flujo completo de captura', async () => {
      // Crear persona
      const person = await dbManager.createPerson('Integration Test');
      expect(person.id).toBeGreaterThan(0);

      // Crear foto
      const photo = await dbManager.createFacePhoto(person.id!, validPhotoData);
      expect(photo.id).toBeGreaterThan(0);

      // Verificar que la foto está asociada correctamente
      const personPhotos = await dbManager.getFacePhotosByPersonId(person.id!);
      expect(personPhotos.length).toBe(1);
      expect(personPhotos[0].id).toBe(photo.id);

      // Verificar en la lista general
      const allPhotos = await dbManager.getAllFacePhotos();
      const foundPhoto = allPhotos.find(p => p.id === photo.id);
      expect(foundPhoto).toBeTruthy();
      expect(foundPhoto!.person_name).toBe('Integration Test');
    });

    it('debería manejar múltiples fotos por persona', async () => {
      const person = await dbManager.createPerson('Multi Photo Person');
      
      // Crear múltiples fotos
      const photo1 = await dbManager.createFacePhoto(person.id!, validPhotoData);
      const photo2 = await dbManager.createFacePhoto(person.id!, validPhotoData);
      
      const photos = await dbManager.getFacePhotosByPersonId(person.id!);
      expect(photos.length).toBe(2);
      
      const photoIds = photos.map(p => p.id);
      expect(photoIds).toContain(photo1.id);
      expect(photoIds).toContain(photo2.id);
    });
  });
});