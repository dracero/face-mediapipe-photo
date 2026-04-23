# Documento de Requisitos

## Introducción

Esta funcionalidad implementa el almacenamiento persistente de fotos faciales capturadas en una base de datos SQLite local, reemplazando la dependencia actual de Supabase. El sistema permitirá guardar, recuperar y gestionar fotos de rostros junto con sus metadatos asociados para su posterior comparación y análisis.

## Glosario

- **Photo_Storage_System**: Sistema de almacenamiento de fotos en SQLite
- **Face_Photo**: Imagen facial capturada con sus metadatos asociados
- **Person_Record**: Registro de una persona con su información básica
- **Database_Manager**: Componente que gestiona las operaciones de base de datos SQLite
- **Photo_Data**: Datos binarios de la imagen codificados en base64
- **Capture_Component**: Componente FaceCapture.astro que captura fotos
- **Compare_Component**: Componente compare.astro que compara rostros
- **SQLite_Database**: Base de datos SQLite local para almacenamiento

## Requisitos

### Requisito 1: Inicialización de Base de Datos

**User Story:** Como desarrollador, quiero que la base de datos SQLite se inicialice automáticamente, para que el sistema pueda almacenar fotos sin configuración manual.

#### Criterios de Aceptación

1. WHEN la aplicación se inicia por primera vez, THE Database_Manager SHALL crear la base de datos SQLite si no existe
2. THE Database_Manager SHALL crear la tabla 'people' con campos id, name, created_at
3. THE Database_Manager SHALL crear la tabla 'face_photos' con campos id, person_id, photo_data, captured_at
4. THE Database_Manager SHALL establecer las relaciones de clave foránea entre las tablas
5. IF la base de datos ya existe, THEN THE Database_Manager SHALL verificar la integridad del esquema

### Requisito 2: Almacenamiento de Personas

**User Story:** Como usuario, quiero registrar personas en el sistema, para que pueda asociar las fotos capturadas con identidades específicas.

#### Criterios de Aceptación

1. WHEN se proporciona un nombre de persona válido, THE Photo_Storage_System SHALL crear un nuevo registro en la tabla 'people'
2. THE Photo_Storage_System SHALL generar un ID único para cada persona
3. THE Photo_Storage_System SHALL registrar la fecha y hora de creación del registro
4. IF el nombre está vacío o contiene solo espacios, THEN THE Photo_Storage_System SHALL retornar un error descriptivo
5. THE Photo_Storage_System SHALL permitir nombres duplicados pero con IDs únicos

### Requisito 3: Almacenamiento de Fotos Faciales

**User Story:** Como usuario, quiero que las fotos capturadas se guarden automáticamente en la base de datos, para que persistan entre sesiones de la aplicación.

#### Criterios de Aceptación

1. WHEN el Capture_Component captura una foto facial, THE Photo_Storage_System SHALL convertir la imagen a formato base64
2. THE Photo_Storage_System SHALL almacenar la Photo_Data en la tabla 'face_photos'
3. THE Photo_Storage_System SHALL asociar la foto con el Person_Record correspondiente mediante person_id
4. THE Photo_Storage_System SHALL registrar la fecha y hora de captura
5. IF el almacenamiento falla, THEN THE Photo_Storage_System SHALL retornar un error específico sin corromper datos existentes

### Requisito 4: Recuperación de Fotos para Comparación

**User Story:** Como usuario, quiero que el sistema de comparación acceda a todas las fotos almacenadas, para que pueda comparar rostros contra la base de datos completa.

#### Criterios de Aceptación

1. WHEN el Compare_Component solicita fotos almacenadas, THE Photo_Storage_System SHALL retornar todas las fotos con sus metadatos
2. THE Photo_Storage_System SHALL incluir información de la persona asociada (nombre, ID)
3. THE Photo_Storage_System SHALL retornar las fotos en formato base64 listo para procesamiento
4. THE Photo_Storage_System SHALL ordenar los resultados por fecha de captura descendente
5. IF no hay fotos almacenadas, THEN THE Photo_Storage_System SHALL retornar una lista vacía sin errores

### Requisito 5: Gestión de Conexiones de Base de Datos

**User Story:** Como desarrollador, quiero que las conexiones a SQLite se gestionen eficientemente, para que el sistema sea estable y no consuma recursos innecesarios.

#### Criterios de Aceptación

1. THE Database_Manager SHALL abrir conexiones SQLite solo cuando sea necesario
2. THE Database_Manager SHALL cerrar conexiones automáticamente después de cada operación
3. THE Database_Manager SHALL manejar conexiones concurrentes de forma segura
4. IF una conexión falla, THEN THE Database_Manager SHALL reintentar la operación una vez
5. THE Database_Manager SHALL registrar errores de conexión para diagnóstico

### Requisito 6: Migración desde Supabase

**User Story:** Como desarrollador, quiero reemplazar completamente la integración con Supabase, para que la aplicación funcione sin dependencias externas.

#### Criterios de Aceptación

1. THE Photo_Storage_System SHALL reemplazar todas las llamadas a supabase.from('people')
2. THE Photo_Storage_System SHALL reemplazar todas las llamadas a supabase.from('face_photos')
3. THE Photo_Storage_System SHALL mantener la misma estructura de datos que la implementación Supabase
4. THE Photo_Storage_System SHALL preservar la funcionalidad existente de captura y comparación
5. THE Photo_Storage_System SHALL eliminar la dependencia del cliente Supabase del código

### Requisito 7: Manejo de Errores y Validación

**User Story:** Como usuario, quiero recibir mensajes de error claros cuando algo falla, para que pueda entender y resolver problemas de almacenamiento.

#### Criterios de Aceptación

1. WHEN ocurre un error de base de datos, THE Photo_Storage_System SHALL retornar mensajes de error descriptivos
2. THE Photo_Storage_System SHALL validar que los datos de imagen sean válidos antes del almacenamiento
3. THE Photo_Storage_System SHALL validar que los nombres de persona cumplan criterios mínimos
4. IF la base de datos está bloqueada, THEN THE Photo_Storage_System SHALL esperar y reintentar la operación
5. THE Photo_Storage_System SHALL registrar errores críticos para depuración

### Requisito 8: Configuración de SQLite

**User Story:** Como desarrollador, quiero que SQLite se configure automáticamente con las mejores prácticas, para que el rendimiento y la integridad de datos sean óptimos.

#### Criterios de Aceptación

1. THE Database_Manager SHALL habilitar claves foráneas (PRAGMA foreign_keys = ON)
2. THE Database_Manager SHALL configurar el modo WAL para mejor concurrencia
3. THE Database_Manager SHALL establecer un timeout apropiado para operaciones
4. THE Database_Manager SHALL crear índices en campos de búsqueda frecuente
5. THE Database_Manager SHALL configurar la codificación UTF-8 para soporte de caracteres especiales

### Requisito 9: Integración con Componentes Astro

**User Story:** Como desarrollador, quiero que la funcionalidad SQLite se integre seamlessly con los componentes Astro existentes, para que no requiera cambios arquitectónicos mayores.

#### Criterios de Aceptación

1. THE Photo_Storage_System SHALL proporcionar una API JavaScript compatible con el código cliente existente
2. THE Photo_Storage_System SHALL funcionar tanto en el lado servidor como cliente de Astro
3. THE Photo_Storage_System SHALL mantener la misma interfaz de promesas que la implementación Supabase
4. THE Photo_Storage_System SHALL ser importable como módulo ES6
5. WHERE se ejecute en el navegador, THE Photo_Storage_System SHALL usar una implementación compatible con WebAssembly

### Requisito 10: Rendimiento y Optimización

**User Story:** Como usuario, quiero que las operaciones de base de datos sean rápidas, para que la captura y comparación de fotos sea fluida.

#### Criterios de Aceptación

1. THE Photo_Storage_System SHALL completar operaciones de inserción en menos de 100ms
2. THE Photo_Storage_System SHALL completar consultas de recuperación en menos de 200ms
3. THE Photo_Storage_System SHALL optimizar el almacenamiento de imágenes base64
4. THE Photo_Storage_System SHALL implementar paginación para consultas de muchos registros
5. THE Photo_Storage_System SHALL usar transacciones para operaciones múltiples