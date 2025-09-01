import { NextRequest, NextResponse } from 'next/server';
import { startupDiagnosticService } from '@/lib/startup/diagnostic-service';

/**
 * GET /api/startup
 * Run startup diagnostics to check if the application can start properly
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const includeDetails = searchParams.get('details') === 'true';

    console.log('🚀 Running startup diagnostics...');

    const diagnostic = await startupDiagnosticService.runFullDiagnostic();

    // Return different formats based on request
    if (format === 'summary') {
      return NextResponse.json({
        success: true,
        canStart: diagnostic.canStart,
        status: diagnostic.overallStatus,
        summary: diagnostic.summary,
        timestamp: diagnostic.timestamp
      });
    }

    if (format === 'text') {
      const textReport = generateTextReport(diagnostic);
      return new NextResponse(textReport, {
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // Default JSON format
    const response: any = {
      success: true,
      data: {
        canStart: diagnostic.canStart,
        status: diagnostic.overallStatus,
        summary: diagnostic.summary,
        recommendations: diagnostic.recommendations,
        nextSteps: diagnostic.nextSteps,
        timestamp: diagnostic.timestamp
      }
    };

    if (includeDetails) {
      response.data.checks = diagnostic.checks;
    } else {
      // Include only essential check information
      response.data.checks = diagnostic.checks.map(check => ({
        name: check.name,
        status: check.status,
        critical: check.critical,
        message: check.message
      }));
    }

    // Set appropriate HTTP status
    const httpStatus = diagnostic.canStart ? 200 : 503;

    return NextResponse.json(response, { status: httpStatus });

  } catch (error) {
    console.error('Error running startup diagnostics:', error);
    
    return NextResponse.json(
      {
        success: false,
        canStart: false,
        status: 'critical',
        error: 'Startup diagnostics failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/startup
 * Run specific startup checks or perform startup actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, checks } = body;

    if (!action) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing action parameter',
          message: 'Please specify action: "check", "validate", or "fix"'
        },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'check':
        result = await handleCheckAction(checks);
        break;
      
      case 'validate':
        result = await handleValidateAction();
        break;
      
      case 'fix':
        result = await handleFixAction();
        break;

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action',
            message: 'Supported actions: check, validate, fix'
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in startup POST:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Startup operation failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Handler functions
async function handleCheckAction(specificChecks?: string[]) {
  const diagnostic = await startupDiagnosticService.runFullDiagnostic();
  
  if (specificChecks && Array.isArray(specificChecks)) {
    const filteredChecks = diagnostic.checks.filter(check => 
      specificChecks.some(name => 
        check.name.toLowerCase().includes(name.toLowerCase())
      )
    );
    
    return {
      requestedChecks: specificChecks,
      checks: filteredChecks,
      summary: {
        total: filteredChecks.length,
        passed: filteredChecks.filter(c => c.status === 'passed').length,
        failed: filteredChecks.filter(c => c.status === 'failed').length,
        warnings: filteredChecks.filter(c => c.status === 'warning').length
      }
    };
  }
  
  return diagnostic;
}

async function handleValidateAction() {
  const diagnostic = await startupDiagnosticService.runFullDiagnostic();
  
  const validation = {
    isValid: diagnostic.canStart,
    status: diagnostic.overallStatus,
    criticalIssues: diagnostic.checks.filter(c => c.critical && c.status === 'failed'),
    warnings: diagnostic.checks.filter(c => c.status === 'warning'),
    recommendations: diagnostic.recommendations,
    readinessScore: calculateReadinessScore(diagnostic)
  };
  
  return validation;
}

async function handleFixAction() {
  // This would implement automatic fixes for common issues
  // For now, return guidance on manual fixes
  const diagnostic = await startupDiagnosticService.runFullDiagnostic();
  const fixableIssues = diagnostic.checks.filter(c => c.status === 'failed');
  
  const fixes = fixableIssues.map(issue => ({
    check: issue.name,
    issue: issue.message,
    autoFixable: false, // Most issues require manual intervention
    instructions: generateFixInstructions(issue)
  }));
  
  return {
    fixableIssues: fixes.length,
    fixes,
    note: 'Most configuration issues require manual intervention. Please follow the provided instructions.'
  };
}

function calculateReadinessScore(diagnostic: any): number {
  const totalChecks = diagnostic.checks.length;
  const passedChecks = diagnostic.checks.filter((c: any) => c.status === 'passed').length;
  const criticalFailed = diagnostic.checks.filter((c: any) => c.critical && c.status === 'failed').length;
  
  // Base score from passed checks
  let score = (passedChecks / totalChecks) * 100;
  
  // Heavy penalty for critical failures
  score -= (criticalFailed * 25);
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateFixInstructions(issue: any): string[] {
  const instructions = [];
  
  switch (issue.name) {
    case 'Environment Variables':
      instructions.push('Check your .env.local file');
      instructions.push('Ensure all required environment variables are set');
      instructions.push('Restart the application after making changes');
      break;
      
    case 'Required APIs':
      instructions.push('Obtain API keys from the respective providers');
      instructions.push('Add the API keys to your .env.local file');
      instructions.push('Check the documentation URLs provided in the configuration');
      break;
      
    case 'Database Configuration':
      instructions.push('Set up a PostgreSQL database');
      instructions.push('Configure the DATABASE_URL environment variable');
      instructions.push('Run database migrations if needed');
      break;
      
    default:
      instructions.push('Review the error message for specific guidance');
      instructions.push('Check the application logs for more details');
      instructions.push('Consult the documentation for this component');
  }
  
  return instructions;
}

function generateTextReport(diagnostic: any): string {
  const lines = [];
  
  lines.push('🚀 CRYPTOTRADER STARTUP DIAGNOSTIC REPORT');
  lines.push('=' .repeat(50));
  lines.push('');
  lines.push(`Timestamp: ${diagnostic.timestamp}`);
  lines.push(`Overall Status: ${diagnostic.overallStatus.toUpperCase()}`);
  lines.push(`Can Start: ${diagnostic.canStart ? 'YES ✅' : 'NO ❌'}`);
  lines.push('');
  
  lines.push('📊 SUMMARY');
  lines.push('-'.repeat(20));
  lines.push(`Total Checks: ${diagnostic.summary.total}`);
  lines.push(`Passed: ${diagnostic.summary.passed} ✅`);
  lines.push(`Failed: ${diagnostic.summary.failed} ❌`);
  lines.push(`Warnings: ${diagnostic.summary.warnings} ⚠️`);
  lines.push(`Critical Failed: ${diagnostic.summary.criticalFailed} 🚨`);
  lines.push('');
  
  lines.push('🔍 DETAILED CHECKS');
  lines.push('-'.repeat(30));
  diagnostic.checks.forEach((check: any) => {
    const icon = check.status === 'passed' ? '✅' : 
                 check.status === 'failed' ? '❌' : 
                 check.status === 'warning' ? '⚠️' : '⏭️';
    const critical = check.critical ? ' [CRITICAL]' : '';
    lines.push(`${icon} ${check.name}${critical}`);
    lines.push(`   ${check.message}`);
    if (check.duration) {
      lines.push(`   Duration: ${check.duration}ms`);
    }
    lines.push('');
  });
  
  if (diagnostic.recommendations.length > 0) {
    lines.push('💡 RECOMMENDATIONS');
    lines.push('-'.repeat(25));
    diagnostic.recommendations.forEach((rec: string, index: number) => {
      lines.push(`${index + 1}. ${rec}`);
    });
    lines.push('');
  }
  
  if (diagnostic.nextSteps.length > 0) {
    lines.push('📋 NEXT STEPS');
    lines.push('-'.repeat(20));
    diagnostic.nextSteps.forEach((step: string) => {
      lines.push(`• ${step}`);
    });
    lines.push('');
  }
  
  lines.push('=' .repeat(50));
  lines.push('End of Report');
  
  return lines.join('\n');
}
