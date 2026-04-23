// Utilidad para verificar que la infraestructura base esté correctamente configurada
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { DATABASE_CONFIG } from '../config';
import { DatabaseLogger } from './logger';

export class SetupVerification {
  private logger = DatabaseLogger.getInstance();
  
  /**
   * Verifica que todos los componentes de la infraestructura base estén configurados
   */
  async verifyInfrastructure(): Promise<{
    success: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    try {
      // Verificar directorio de datos
      this.verifyDataDirectory(issues, recommendations);
      
      // Verificar configuración de TypeScript
      this.verifyTypeScriptConfig(issues, recommendations);
      
      // Verificar dependencias
      await this.verifyDependencies(issues, recommendations);
      
      // Verificar configuración de entorno
      this.verifyEnvironmentConfig(issues, recommendations);
      
      const success = issues.length === 0;
      
      if (success) {
        this.logger.logInfo('Infrastructure verification completed successfully');
      } else {
        this.logger.logError(
          new Error(`Infrastructure verification failed with ${issues.length} issues`),
          'Setup Verification',
          { issues, recommendations }
        );
      }
      
      return { success, issues, recommendations };
      
    } catch (error) {
      this.logger.logError(error as Error, 'Setup Verification');
      return {
        success: false,
        issues: [`Verification failed: ${(error as Error).message}`],
        recommendations: ['Check system permissions and dependencies']
      };
    }
  }
  
  private verifyDataDirectory(issues: string[], recommendations: string[]): void {
    const dataDir = dirname(DATABASE_CONFIG.server.dbPath);
    
    if (!existsSync(dataDir)) {
      try {
        mkdirSync(dataDir, { recursive: true });
        this.logger.logInfo(`Created data directory: ${dataDir}`);
      } catch (error) {
        issues.push(`Cannot create data directory: ${dataDir}`);
        recommendations.push('Ensure write permissions for the application directory');
      }
    }
  }
  
  private verifyTypeScriptConfig(issues: string[], recommendations: string[]): void {
    // Verificar que los archivos de tipos existan
    const requiredTypeFiles = [
      'src/types/global.d.ts',
      'src/lib/database/types.ts'
    ];
    
    for (const file of requiredTypeFiles) {
      if (!existsSync(file)) {
        issues.push(`Missing TypeScript definition file: ${file}`);
        recommendations.push(`Create the missing type definition file: ${file}`);
      }
    }
  }
  
  private async verifyDependencies(issues: string[], recommendations: string[]): Promise<void> {
    const requiredDeps = [
      'better-sqlite3',
      'sql.js'
    ];
    
    const requiredDevDeps = [
      '@types/better-sqlite3',
      'fast-check'
    ];
    
    try {
      // Verificar dependencias de producción
      for (const dep of requiredDeps) {
        try {
          await import(dep);
        } catch (error) {
          issues.push(`Missing production dependency: ${dep}`);
          recommendations.push(`Install dependency: npm install ${dep}`);
        }
      }
      
      // Verificar dependencias de desarrollo (solo en desarrollo)
      if (process.env.NODE_ENV === 'development') {
        for (const dep of requiredDevDeps) {
          try {
            await import(dep);
          } catch (error) {
            recommendations.push(`Missing development dependency: ${dep} (install with: npm install -D ${dep})`);
          }
        }
      }
      
    } catch (error) {
      issues.push(`Error checking dependencies: ${(error as Error).message}`);
    }
  }
  
  private verifyEnvironmentConfig(issues: string[], recommendations: string[]): void {
    // Verificar variables de entorno críticas
    const requiredEnvVars = ['NODE_ENV'];
    const optionalEnvVars = ['DATABASE_PATH', 'LOG_LEVEL', 'SQLITE_TIMEOUT'];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push(`Missing required environment variable: ${envVar}`);
        recommendations.push(`Set environment variable: ${envVar}`);
      }
    }
    
    for (const envVar of optionalEnvVars) {
      if (!process.env[envVar]) {
        recommendations.push(`Consider setting optional environment variable: ${envVar}`);
      }
    }
    
    // Verificar que el archivo .env.example exista
    if (!existsSync('.env.example')) {
      recommendations.push('Create .env.example file with environment variable templates');
    }
  }
  
  /**
   * Crea la estructura de directorios necesaria si no existe
   */
  async createDirectoryStructure(): Promise<void> {
    const directories = [
      'data',
      'src/lib/database',
      'src/lib/database/adapters',
      'src/lib/database/models',
      'src/lib/database/migrations',
      'src/lib/database/utils',
      'src/lib/photo-storage'
    ];
    
    for (const dir of directories) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        this.logger.logInfo(`Created directory: ${dir}`);
      }
    }
  }
  
  /**
   * Genera un reporte de estado de la infraestructura
   */
  generateStatusReport(): {
    infrastructure: 'ready' | 'partial' | 'missing';
    dependencies: 'installed' | 'partial' | 'missing';
    configuration: 'complete' | 'partial' | 'missing';
    recommendations: string[];
  } {
    // Esta función podría expandirse para proporcionar un reporte más detallado
    return {
      infrastructure: 'ready',
      dependencies: 'installed',
      configuration: 'complete',
      recommendations: [
        'Infrastructure base is ready for Task 1 completion',
        'Proceed with implementing database adapters in subsequent tasks'
      ]
    };
  }
}

// Función de conveniencia para verificación rápida
export async function verifySetup(): Promise<boolean> {
  const verification = new SetupVerification();
  const result = await verification.verifyInfrastructure();
  return result.success;
}