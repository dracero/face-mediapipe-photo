# Plan de Implementación: Almacenamiento de Fotos en SQLite

## Resumen

Este plan implementa el sistema de almacenamiento persistente de fotos faciales en SQLite local, reemplazando completamente la dependencia de Supabase. La implementación utiliza una arquitectura híbrida con `better-sqlite3` en el servidor y `sql.js` en el cliente, manteniendo compatibilidad completa con la API existente.

## Tareas

- [x] 1. Configurar infraestructura base y dependencias
  - Instalar dependencias SQLite (better-sqlite3, sql.js)
  - Configurar TypeScript y tipos necesarios
  - Crear estructura de directorios para el sistema de base de datos
  - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 2. Implementar esquema de base de datos y migraciones
  - [x] 2.1 Crear archivo de migración inicial con esquema SQL
    - Definir tablas `people` y `face_photos` con constraints
    - Configurar índices para optimización de consultas
    - Establecer relaciones de clave foránea y triggers de validación
    - _Requisitos: 1.2, 1.3, 1.4, 8.4_

  - [ ]* 2.2 Escribir prueba de propiedad para integridad del esquema
    - **Propiedad 1: Integridad del Esquema de Base de Datos**
    - **Valida: Requisitos 1.5**

- [ ] 3. Implementar modelos de datos y validación
  - [x] 3.1 Crear PersonModel con validación
    - Implementar clase PersonModel con métodos de validación
    - Validar nombres (longitud, caracteres permitidos, no vacío)
    - _Requisitos: 2.4, 7.2, 7.3_

  - [x] 3.2 Crear FacePhotoModel con validación
    - Implementar clase FacePhotoModel con validación de imágenes
    - Validar formato base64, tamaño máximo, integridad de datos
    - _Requisitos: 3.1, 7.2, 7.3_

  - [ ]* 3.3 Escribir pruebas de propiedad para validación universal
    - **Propiedad 3: Validación Universal de Entrada**
    - **Valida: Requisitos 2.4, 7.2, 7.3**

- [ ] 4. Implementar adaptador de base de datos para servidor
  - [x] 4.1 Crear SQLiteServerAdapter con better-sqlite3
    - Implementar inicialización, configuración de pragmas
    - Crear métodos para operaciones CRUD de personas y fotos
    - Gestionar conexiones y transacciones de forma segura
    - _Requisitos: 1.1, 5.1, 5.2, 5.3, 8.1, 8.2_

  - [ ]* 4.2 Escribir pruebas de propiedad para unicidad de IDs
    - **Propiedad 2: Unicidad de Identificadores**
    - **Valida: Requisitos 2.2**

  - [ ]* 4.3 Escribir pruebas de propiedad para gestión de recursos
    - **Propiedad 8: Gestión Eficiente de Recursos**
    - **Valida: Requisitos 5.1, 5.2, 5.3**

- [ ] 5. Implementar adaptador de base de datos para cliente
  - [x] 5.1 Crear SQLiteClientAdapter con sql.js
    - Implementar carga de WebAssembly y persistencia OPFS
    - Crear métodos equivalentes para operaciones CRUD
    - Manejar sincronización con almacenamiento persistente
    - _Requisitos: 9.5, 5.1, 5.2, 5.3_

  - [ ]* 5.2 Escribir pruebas de propiedad para preservación de timestamps
    - **Propiedad 4: Preservación de Timestamps**
    - **Valida: Requisitos 2.3, 3.4**

  - [ ]* 5.3 Escribir pruebas de propiedad para integridad referencial
    - **Propiedad 5: Integridad Referencial**
    - **Valida: Requisitos 3.3, 4.2**

- [ ] 6. Checkpoint - Verificar adaptadores de base de datos
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 7. Implementar DatabaseManager y detección de entorno
  - [x] 7.1 Crear DatabaseManager con patrón singleton
    - Implementar detección automática de entorno (servidor/cliente)
    - Cargar adaptador apropiado según el entorno
    - Proporcionar API unificada para ambos adaptadores
    - _Requisitos: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 7.2 Escribir pruebas de propiedad para atomicidad de operaciones
    - **Propiedad 6: Atomicidad de Operaciones**
    - **Valida: Requisitos 3.5, 5.4, 7.1, 7.4**

- [ ] 8. Implementar capa de compatibilidad con Supabase
  - [x] 8.1 Crear SupabaseCompatLayer y QueryBuilder
    - Implementar API compatible con supabase.from().select()
    - Crear métodos insert, select, eq, order con misma interfaz
    - Mantener estructura de respuesta { data, error }
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 9.1, 9.3_

  - [ ]* 8.2 Escribir pruebas de propiedad para completitud de recuperación
    - **Propiedad 7: Completitud de Recuperación**
    - **Valida: Requisitos 4.1, 4.3, 4.4**

  - [ ]* 8.3 Escribir pruebas de propiedad para compatibilidad de API
    - **Propiedad 9: Compatibilidad de API**
    - **Valida: Requisitos 6.3, 6.4, 9.1, 9.2, 9.3**

- [ ] 9. Implementar sistema de manejo de errores
  - [x] 9.1 Crear jerarquía de errores personalizados
    - Definir clases DatabaseConnectionError, ValidationError, etc.
    - Implementar estrategias de reintento para errores recuperables
    - Crear sistema de logging estructurado para diagnóstico
    - _Requisitos: 7.1, 7.4, 5.4_

  - [ ]* 9.2 Escribir pruebas unitarias para manejo de errores
    - Verificar mensajes de error descriptivos
    - Probar estrategias de reintento y recuperación
    - _Requisitos: 7.1, 7.4_

- [ ] 10. Checkpoint - Verificar sistema completo
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [ ] 11. Migrar componente FaceCapture.astro
  - [x] 11.1 Actualizar imports y reemplazar llamadas Supabase
    - Reemplazar import de supabase por nueva capa de compatibilidad
    - Actualizar todas las llamadas a supabase.from('people') y supabase.from('face_photos')
    - Mantener la misma lógica de captura y almacenamiento
    - _Requisitos: 6.1, 6.2, 6.5, 9.4_

  - [ ]* 11.2 Escribir pruebas de integración para captura
    - Verificar flujo completo de captura y almacenamiento
    - Probar manejo de errores en captura
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 12. Migrar componente compare.astro
  - [x] 12.1 Actualizar imports y reemplazar llamadas Supabase
    - Reemplazar import de supabase por nueva capa de compatibilidad
    - Actualizar consultas de personas y fotos para comparación
    - Mantener la misma lógica de comparación facial
    - _Requisitos: 6.1, 6.2, 6.5, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 12.2 Escribir pruebas de integración para comparación
    - Verificar recuperación correcta de fotos almacenadas
    - Probar ordenamiento y formato de datos
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 13. Implementar optimizaciones de rendimiento
  - [x] 13.1 Configurar índices y optimizaciones SQLite
    - Implementar configuración de pragmas para rendimiento
    - Crear índices estratégicos en campos de búsqueda frecuente
    - Configurar modo WAL y cache para mejor concurrencia
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5, 10.3, 10.4, 10.5_

  - [ ]* 13.2 Escribir pruebas de propiedad para rendimiento temporal
    - **Propiedad 10: Rendimiento Temporal**
    - **Valida: Requisitos 10.1, 10.2**

  - [ ]* 13.3 Escribir pruebas de propiedad para optimización de almacenamiento
    - **Propiedad 11: Optimización de Almacenamiento**
    - **Valida: Requisitos 10.3, 10.4, 10.5**

- [ ] 14. Configurar build y dependencias del proyecto
  - [x] 14.1 Actualizar configuración de Astro y Vite
    - Configurar exclusión de better-sqlite3 del bundle cliente
    - Configurar soporte para sql.js WebAssembly
    - Actualizar astro.config.mjs para modo híbrido
    - _Requisitos: 9.2, 9.5_

  - [x] 14.2 Actualizar package.json con nuevas dependencias
    - Agregar better-sqlite3 y sql.js como dependencias
    - Agregar tipos TypeScript necesarios
    - Remover dependencias de Supabase del proyecto
    - _Requisitos: 6.5_

- [ ] 15. Verificación final y limpieza
  - [x] 15.1 Ejecutar suite completa de tests
    - Verificar que todas las pruebas de propiedad pasen
    - Ejecutar pruebas de integración end-to-end
    - Validar rendimiento según métricas establecidas
    - _Requisitos: 10.1, 10.2_

  - [x] 15.2 Limpiar código y dependencias obsoletas
    - Remover todas las referencias a Supabase del código
    - Limpiar imports no utilizados y código comentado
    - Verificar que no queden dependencias de Supabase
    - _Requisitos: 6.5_

- [ ] 16. Checkpoint final - Verificación completa del sistema
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental del progreso
- Las pruebas de propiedad validan propiedades universales de corrección
- Las pruebas unitarias validan ejemplos específicos y casos de borde
- La migración mantiene compatibilidad completa con la funcionalidad existente
- El sistema funciona tanto en entorno servidor (Node.js) como cliente (navegador)