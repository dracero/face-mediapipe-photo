#!/usr/bin/env tsx
// Script para verificar que la infraestructura base esté correctamente configurada

import { SetupVerification } from '../src/lib/database/utils/setup-verification';
import { DATABASE_CONFIG } from '../src/lib/database/config';

async function main() {
  console.log('🔍 Verificando infraestructura base de SQLite Photo Storage...\n');
  
  const verification = new SetupVerification();
  
  try {
    // Crear estructura de directorios si es necesario
    await verification.createDirectoryStructure();
    console.log('✅ Estructura de directorios verificada\n');
    
    // Verificar infraestructura completa
    const result = await verification.verifyInfrastructure();
    
    if (result.success) {
      console.log('🎉 ¡Infraestructura base configurada correctamente!\n');
      
      // Mostrar configuración actual
      console.log('📋 Configuración actual:');
      console.log(`   - Base de datos: ${DATABASE_CONFIG.server.dbPath}`);
      console.log(`   - Timeout: ${DATABASE_CONFIG.server.options.timeout}ms`);
      console.log(`   - Logging: ${DATABASE_CONFIG.logging.enabled ? 'habilitado' : 'deshabilitado'}`);
      console.log(`   - Entorno: ${process.env.NODE_ENV || 'no definido'}\n`);
      
      // Generar reporte de estado
      const statusReport = verification.generateStatusReport();
      console.log('📊 Estado del sistema:');
      console.log(`   - Infraestructura: ${statusReport.infrastructure}`);
      console.log(`   - Dependencias: ${statusReport.dependencies}`);
      console.log(`   - Configuración: ${statusReport.configuration}\n`);
      
      if (statusReport.recommendations.length > 0) {
        console.log('💡 Recomendaciones:');
        statusReport.recommendations.forEach(rec => console.log(`   - ${rec}`));
      }
      
    } else {
      console.log('❌ Se encontraron problemas en la infraestructura:\n');
      
      result.issues.forEach(issue => console.log(`   ❌ ${issue}`));
      
      if (result.recommendations.length > 0) {
        console.log('\n💡 Recomendaciones para resolver los problemas:');
        result.recommendations.forEach(rec => console.log(`   - ${rec}`));
      }
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Error durante la verificación:', error);
    process.exit(1);
  }
}

// Ejecutar verificación
main().catch(console.error);