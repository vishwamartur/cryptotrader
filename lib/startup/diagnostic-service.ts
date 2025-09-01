/**
 * Application Startup Diagnostic Service
 * Performs comprehensive checks to ensure the application can start properly
 */

import { apiConfigService } from '../config/api-config';
import { apiHealthService } from '../crypto-apis/api-health-service';

export interface StartupCheck {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  duration: number;
  message: string;
  details?: any;
  critical: boolean;
}

export interface StartupDiagnostic {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  canStart: boolean;
  checks: StartupCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
    critical: number;
    criticalFailed: number;
  };
  recommendations: string[];
  nextSteps: string[];
}

export class StartupDiagnosticService {
  private static instance: StartupDiagnosticService;

  static getInstance(): StartupDiagnosticService {
    if (!StartupDiagnosticService.instance) {
      StartupDiagnosticService.instance = new StartupDiagnosticService();
    }
    return StartupDiagnosticService.instance;
  }

  async runFullDiagnostic(): Promise<StartupDiagnostic> {
    const startTime = Date.now();
    const checks: StartupCheck[] = [];

    console.log('🚀 Running startup diagnostic...');

    // Critical checks
    checks.push(await this.checkEnvironmentVariables());
    checks.push(await this.checkRequiredAPIs());
    checks.push(await this.checkDatabaseConfiguration());
    checks.push(await this.checkApplicationConfiguration());

    // Important but non-critical checks
    checks.push(await this.checkOptionalAPIs());
    checks.push(await this.checkFeatureFlags());
    checks.push(await this.checkNetworkConnectivity());
    checks.push(await this.checkSystemResources());

    // Calculate summary
    const summary = {
      total: checks.length,
      passed: checks.filter(c => c.status === 'passed').length,
      failed: checks.filter(c => c.status === 'failed').length,
      warnings: checks.filter(c => c.status === 'warning').length,
      skipped: checks.filter(c => c.status === 'skipped').length,
      critical: checks.filter(c => c.critical).length,
      criticalFailed: checks.filter(c => c.critical && c.status === 'failed').length
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'critical';
    const canStart = summary.criticalFailed === 0;

    if (summary.criticalFailed > 0) {
      overallStatus = 'critical';
    } else if (summary.failed > 0 || summary.warnings > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const diagnostic: StartupDiagnostic = {
      timestamp: new Date().toISOString(),
      overallStatus,
      canStart,
      checks,
      summary,
      recommendations: this.generateRecommendations(checks),
      nextSteps: this.generateNextSteps(checks, canStart)
    };

    const totalDuration = Date.now() - startTime;
    console.log(`✅ Startup diagnostic completed in ${totalDuration}ms`);
    console.log(`📊 Status: ${overallStatus.toUpperCase()}, Can Start: ${canStart ? 'YES' : 'NO'}`);

    return diagnostic;
  }

  private async checkEnvironmentVariables(): Promise<StartupCheck> {
    const startTime = Date.now();
    
    try {
      const requiredEnvVars = [
        'NODE_ENV',
        'NEXT_PUBLIC_APP_NAME',
        'NEXT_PUBLIC_APP_VERSION'
      ];

      const missing = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missing.length > 0) {
        return {
          name: 'Environment Variables',
          status: 'failed',
          duration: Date.now() - startTime,
          message: `Missing required environment variables: ${missing.join(', ')}`,
          critical: true,
          details: { missing, total: requiredEnvVars.length }
        };
      }

      return {
        name: 'Environment Variables',
        status: 'passed',
        duration: Date.now() - startTime,
        message: 'All required environment variables are set',
        critical: true,
        details: { checked: requiredEnvVars.length }
      };
    } catch (error) {
      return {
        name: 'Environment Variables',
        status: 'failed',
        duration: Date.now() - startTime,
        message: `Environment check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        critical: true
      };
    }
  }

  private async checkRequiredAPIs(): Promise<StartupCheck> {
    const startTime = Date.now();
    
    try {
      const requiredAPIs = apiConfigService.getRequiredAPIs();
      const missingRequired = apiConfigService.getMissingRequiredAPIs();

      if (missingRequired.length > 0) {
        return {
          name: 'Required APIs',
          status: 'failed',
          duration: Date.now() - startTime,
          message: `Missing required API keys: ${missingRequired.map(api => api.name).join(', ')}`,
          critical: true,
          details: {
            missing: missingRequired.map(api => ({
              name: api.name,
              description: api.description,
              documentationUrl: api.documentationUrl
            })),
            total: requiredAPIs.length
          }
        };
      }

      return {
        name: 'Required APIs',
        status: 'passed',
        duration: Date.now() - startTime,
        message: 'All required API keys are configured',
        critical: true,
        details: { configured: requiredAPIs.length }
      };
    } catch (error) {
      return {
        name: 'Required APIs',
        status: 'failed',
        duration: Date.now() - startTime,
        message: `API configuration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        critical: true
      };
    }
  }

  private async checkDatabaseConfiguration(): Promise<StartupCheck> {
    const startTime = Date.now();
    
    try {
      const dbConfig = apiConfigService.getDatabaseConfiguration();

      if (!dbConfig.url) {
        return {
          name: 'Database Configuration',
          status: 'failed',
          duration: Date.now() - startTime,
          message: 'Database URL is not configured',
          critical: true,
          details: { url: 'NOT_CONFIGURED' }
        };
      }

      // Basic URL validation
      try {
        new URL(dbConfig.url);
      } catch {
        return {
          name: 'Database Configuration',
          status: 'failed',
          duration: Date.now() - startTime,
          message: 'Database URL format is invalid',
          critical: true,
          details: { url: 'INVALID_FORMAT' }
        };
      }

      return {
        name: 'Database Configuration',
        status: 'passed',
        duration: Date.now() - startTime,
        message: 'Database configuration is valid',
        critical: true,
        details: {
          url: 'CONFIGURED',
          poolMin: dbConfig.poolMin,
          poolMax: dbConfig.poolMax,
          logging: dbConfig.logging
        }
      };
    } catch (error) {
      return {
        name: 'Database Configuration',
        status: 'failed',
        duration: Date.now() - startTime,
        message: `Database configuration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        critical: true
      };
    }
  }

  private async checkApplicationConfiguration(): Promise<StartupCheck> {
    const startTime = Date.now();
    
    try {
      const appConfig = apiConfigService.getApplicationConfiguration();
      const issues = [];

      if (!appConfig.name) issues.push('App name not set');
      if (!appConfig.version) issues.push('App version not set');
      if (!appConfig.url) issues.push('App URL not set');
      if (!appConfig.apiBaseUrl) issues.push('API base URL not set');

      if (issues.length > 0) {
        return {
          name: 'Application Configuration',
          status: 'warning',
          duration: Date.now() - startTime,
          message: `Configuration issues: ${issues.join(', ')}`,
          critical: false,
          details: { issues, config: appConfig }
        };
      }

      return {
        name: 'Application Configuration',
        status: 'passed',
        duration: Date.now() - startTime,
        message: 'Application configuration is complete',
        critical: false,
        details: appConfig
      };
    } catch (error) {
      return {
        name: 'Application Configuration',
        status: 'failed',
        duration: Date.now() - startTime,
        message: `Application configuration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        critical: false
      };
    }
  }

  private async checkOptionalAPIs(): Promise<StartupCheck> {
    const startTime = Date.now();
    
    try {
      const allAPIs = apiConfigService.getAllConfigurations();
      const configuredAPIs = apiConfigService.getConfiguredAPIs();
      const optionalAPIs = allAPIs.filter(api => !api.isRequired);
      const configuredOptional = optionalAPIs.filter(api => api.isConfigured);

      const configurationRate = Math.round((configuredAPIs.length / allAPIs.length) * 100);

      let status: 'passed' | 'warning' | 'failed';
      let message: string;

      if (configurationRate >= 70) {
        status = 'passed';
        message = `Good API coverage: ${configurationRate}% of APIs configured`;
      } else if (configurationRate >= 40) {
        status = 'warning';
        message = `Moderate API coverage: ${configurationRate}% of APIs configured`;
      } else {
        status = 'warning';
        message = `Low API coverage: ${configurationRate}% of APIs configured`;
      }

      return {
        name: 'Optional APIs',
        status,
        duration: Date.now() - startTime,
        message,
        critical: false,
        details: {
          total: allAPIs.length,
          configured: configuredAPIs.length,
          optional: optionalAPIs.length,
          configuredOptional: configuredOptional.length,
          configurationRate
        }
      };
    } catch (error) {
      return {
        name: 'Optional APIs',
        status: 'failed',
        duration: Date.now() - startTime,
        message: `Optional API check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        critical: false
      };
    }
  }

  private async checkFeatureFlags(): Promise<StartupCheck> {
    const startTime = Date.now();
    
    try {
      const features = apiConfigService.getFeatureFlags();
      const enabledFeatures = Object.entries(features).filter(([_, enabled]) => enabled);

      return {
        name: 'Feature Flags',
        status: 'passed',
        duration: Date.now() - startTime,
        message: `${enabledFeatures.length} features enabled`,
        critical: false,
        details: {
          features,
          enabledCount: enabledFeatures.length,
          totalCount: Object.keys(features).length
        }
      };
    } catch (error) {
      return {
        name: 'Feature Flags',
        status: 'failed',
        duration: Date.now() - startTime,
        message: `Feature flags check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        critical: false
      };
    }
  }

  private async checkNetworkConnectivity(): Promise<StartupCheck> {
    const startTime = Date.now();
    
    try {
      // Test basic internet connectivity
      const response = await fetch('https://api.coingecko.com/api/v3/ping', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        return {
          name: 'Network Connectivity',
          status: 'passed',
          duration: Date.now() - startTime,
          message: 'Network connectivity is working',
          critical: false,
          details: { testUrl: 'api.coingecko.com', responseTime: Date.now() - startTime }
        };
      } else {
        return {
          name: 'Network Connectivity',
          status: 'warning',
          duration: Date.now() - startTime,
          message: 'Network connectivity issues detected',
          critical: false,
          details: { status: response.status, statusText: response.statusText }
        };
      }
    } catch (error) {
      return {
        name: 'Network Connectivity',
        status: 'warning',
        duration: Date.now() - startTime,
        message: `Network connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        critical: false
      };
    }
  }

  private async checkSystemResources(): Promise<StartupCheck> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const warnings = [];

      if (memoryMB > 500) warnings.push('High memory usage');
      if (process.uptime() < 10) warnings.push('Recent restart');

      const status = warnings.length > 0 ? 'warning' : 'passed';
      const message = warnings.length > 0 
        ? `System warnings: ${warnings.join(', ')}`
        : 'System resources are normal';

      return {
        name: 'System Resources',
        status,
        duration: Date.now() - startTime,
        message,
        critical: false,
        details: {
          memoryUsageMB: memoryMB,
          uptimeSeconds: Math.round(process.uptime()),
          nodeVersion: process.version,
          platform: process.platform,
          warnings
        }
      };
    } catch (error) {
      return {
        name: 'System Resources',
        status: 'failed',
        duration: Date.now() - startTime,
        message: `System resources check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        critical: false
      };
    }
  }

  private generateRecommendations(checks: StartupCheck[]): string[] {
    const recommendations = [];

    const failedCritical = checks.filter(c => c.critical && c.status === 'failed');
    if (failedCritical.length > 0) {
      recommendations.push(`URGENT: Fix critical issues: ${failedCritical.map(c => c.name).join(', ')}`);
    }

    const failed = checks.filter(c => !c.critical && c.status === 'failed');
    if (failed.length > 0) {
      recommendations.push(`Address failed checks: ${failed.map(c => c.name).join(', ')}`);
    }

    const warnings = checks.filter(c => c.status === 'warning');
    if (warnings.length > 0) {
      recommendations.push(`Review warnings: ${warnings.map(c => c.name).join(', ')}`);
    }

    if (recommendations.length === 0) {
      recommendations.push('All systems are functioning normally');
    }

    return recommendations;
  }

  private generateNextSteps(checks: StartupCheck[], canStart: boolean): string[] {
    const steps = [];

    if (!canStart) {
      steps.push('🚨 Application cannot start safely');
      
      const criticalIssues = checks.filter(c => c.critical && c.status === 'failed');
      criticalIssues.forEach((check, index) => {
        steps.push(`${index + 1}. Fix ${check.name}: ${check.message}`);
      });
    } else {
      steps.push('✅ Application can start');
      
      const warnings = checks.filter(c => c.status === 'warning' || (c.status === 'failed' && !c.critical));
      if (warnings.length > 0) {
        steps.push('📋 Recommended improvements:');
        warnings.forEach((check, index) => {
          steps.push(`   ${index + 1}. ${check.name}: ${check.message}`);
        });
      }
    }

    return steps;
  }
}

export const startupDiagnosticService = StartupDiagnosticService.getInstance();
