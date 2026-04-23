# Sistema de Base de Datos SQLite - Infraestructura Base

## Resumen

Este directorio contiene la infraestructura base para el sistema de almacenamiento de fotos faciales en SQLite local, reemplazando la dependencia de Supabase.

## Estructura de Archivos

```
src/lib/database/
├── README.md                    # Este archivo
├── index.ts                     # Punto de entrada principal
├── config.ts                    # Configuración centralizada
├── types.ts                     # Definiciones de tipos TypeScript
├── DatabaseManager.ts           # Gestor principal (pendiente)
├── adapters/                    # Adaptadores de base de datos
│   ├── SQLiteServerAdapter.ts   # Implementación servidor (pendiente)
│   └── SQLiteClientAdapter.ts   # Implementación cliente (pendiente)
├── models/                      # Modelos de datos
│   ├── PersonModel.ts           # Modelo de persona (pendiente)
│   └── FacePhotoModel.ts        # Modelo de foto facial (pendiente)
├── migrations/                  # Scripts de migración
│   └── 001_initial_schema.sql   # Esquema inicial ✅
└── utils/                       # Utilidades
    ├── errors.ts                # Clases de error personalizadas ✅
    ├── validators.ts            # Validadores de entrada ✅
    ├── logger.ts                # Sistema de logging ✅
    └── setup-verification.ts    # Verificación de infraestructura ✅
```

## Estado de Implementación

### ✅ Completado (Tarea 1)
- **Dependencias SQLite**: `better-sqlite3` y `sql.js` instaladas
- **Configuración TypeScript**: Tipos y configuración completa
- **Estructura de directorios**: Todos los directorios creados
- **Configuración base**: Archivos de configuración y utilidades
- **Sistema de logging**: Logger centralizado implementado
- **Validadores**: Validación de entrada implementada
- **Manejo de errores**: Jerarquía de errores personalizada
- **Verificación**: Script de verificación de infraestructura

### 🔄 Pendiente (Tareas siguientes)
- **DatabaseManager**: Gestor principal de base de datos
- **Adaptadores**: Implementaciones servidor y cliente
- **Modelos**: Clases PersonModel y FacePhotoModel
- **Sistema de almacenamiento**: PhotoStorageSystem
- **Capa de compatibilidad**: SupabaseCompatLayer

## Configuración

### Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```bash
NODE_ENV=development
DATABASE_PATH=./data/photos.db
LOG_LEVEL=info
SQLITE_VERBOSE=false
SQLITE_TIMEOUT=5000
```

### Verificación de Infraestructura

Ejecuta el script de verificación para confirmar que todo está configurado:

```bash
NODE_ENV=development npm run verify:infrastructure
```

## Dependencias

### Producción
- `better-sqlite3`: Motor SQLite nativo para servidor (Node.js)
- `sql.js`: Motor SQLite WebAssembly para cliente (navegador)

### Desarrollo
- `@types/better-sqlite3`: Tipos TypeScript para better-sqlite3
- `fast-check`: Biblioteca para property-based testing
- `tsx`: Ejecutor TypeScript para scripts
- `vitest`: Framework de testing

## Configuración de Astro

El proyecto está configurado con:
- **Output**: `server` para soporte SSR
- **Vite optimizeDeps**: Excluye `better-sqlite3` del bundle cliente
- **Global**: Configurado para compatibilidad con `sql.js`

## Próximos Pasos

1. **Tarea 2**: Implementar esquema de base de datos y migraciones
2. **Tarea 3**: Implementar modelos de datos y validación
3. **Tarea 4**: Implementar adaptador de base de datos para servidor
4. **Tarea 5**: Implementar adaptador de base de datos para cliente

## Arquitectura

El sistema utiliza una arquitectura híbrida:
- **Servidor (Node.js)**: `better-sqlite3` para máximo rendimiento
- **Cliente (Navegador)**: `sql.js` (WebAssembly) para compatibilidad universal
- **Detección automática**: El `DatabaseManager` detecta el entorno y carga el adaptador apropiado

## Logging y Debugging

El sistema incluye logging estructurado:
- Queries SQL (en modo desarrollo)
- Métricas de rendimiento
- Errores con contexto
- Información de inicialización

Para habilitar logging detallado:
```bash
NODE_ENV=development SQLITE_VERBOSE=true LOG_LEVEL=debug
```