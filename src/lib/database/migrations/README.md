# Migraciones de Base de Datos

Este directorio contiene las migraciones SQL para el sistema de almacenamiento de fotos SQLite.

## 001_initial_schema.sql

**Descripción**: Migración inicial que crea el esquema completo para el almacenamiento de fotos faciales.

**Requisitos implementados**: 1.2, 1.3, 1.4, 8.4

### Componentes incluidos:

#### Configuración SQLite
- **Claves foráneas habilitadas**: Garantiza integridad referencial
- **Modo WAL**: Mejor concurrencia para operaciones simultáneas
- **Encoding UTF-8**: Soporte completo de caracteres internacionales
- **Timeouts y cache**: Optimización de rendimiento

#### Tablas

**`people`**
- Almacena información básica de personas registradas
- Validaciones: nombres de 1-100 caracteres, solo letras y espacios
- Timestamps automáticos de creación

**`face_photos`**
- Almacena fotos faciales en formato base64
- Validaciones: formato de imagen válido, tamaño máximo 10MB
- Relación con personas mediante clave foránea
- Campo calculado `photo_size` para optimización

#### Índices de Optimización
- **Búsqueda por nombre**: Índice case-insensitive en `people.name`
- **Ordenamiento temporal**: Índices en campos de fecha para consultas rápidas
- **Búsqueda por persona**: Índice en `face_photos.person_id`
- **Índice compuesto**: Optimización para consultas frecuentes persona+fecha

#### Triggers de Validación
- **Tamaño de foto**: Previene almacenamiento de imágenes > 10MB
- **Formato de imagen**: Valida formato base64 correcto
- **Nombres válidos**: Valida formato y longitud de nombres
- **Auditoría**: Registra eliminaciones de personas

#### Vistas Optimizadas
- **`photos_with_person`**: Consulta optimizada de fotos con información de persona
- **`person_stats`**: Estadísticas agregadas por persona (conteo de fotos, tamaños, etc.)

### Verificación
La migración incluye comandos de verificación de integridad y análisis de estadísticas para asegurar el correcto funcionamiento del esquema.

### Uso
Este archivo es ejecutado automáticamente por el `DatabaseManager` durante la inicialización del sistema cuando detecta que las tablas no existen.