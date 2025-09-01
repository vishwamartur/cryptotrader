import { NextRequest, NextResponse } from 'next/server';
import { apiHealthService } from '@/lib/crypto-apis/api-health-service';

/**
 * GET /api/health/apis
 * Get comprehensive health status of all API integrations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    const testIntegration = searchParams.get('testIntegration') === 'true';

    console.log('Checking API health status...');

    // Get overall health report
    const healthReport = await apiHealthService.getOverallHealthReport();

    const response: any = {
      success: true,
      data: {
        overall: {
          status: healthReport.status,
          timestamp: healthReport.timestamp,
          summary: healthReport.summary
        },
        apis: healthReport.apis
      }
    };

    // Add detailed information if requested
    if (detailed) {
      response.data.details = {
        configuredAPIs: healthReport.apis.filter(api => api.status !== 'not_configured').length,
        averageResponseTime: calculateAverageResponseTime(healthReport.apis),
        criticalAPIs: healthReport.apis.filter(api => 
          ['Delta Exchange', 'Perplexity AI'].includes(api.name) && api.status !== 'healthy'
        ),
        recommendations: generateRecommendations(healthReport.apis)
      };
    }

    // Test integration functionality if requested
    if (testIntegration) {
      console.log('Testing crypto data integration...');
      const integrationTest = await apiHealthService.testCryptoDataIntegration();
      response.data.integrationTest = integrationTest;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error checking API health:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check API health',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/health/apis
 * Test specific APIs or perform targeted health checks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apis, action = 'check' } = body;

    if (!apis || !Array.isArray(apis)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request body',
          message: 'Please provide apis as an array of API names to test'
        },
        { status: 400 }
      );
    }

    const validAPIs = [
      'perplexity', 'delta', 'coinmarketcap', 'cryptocompare', 
      'coinapi', 'santiment', 'pinecone'
    ];

    const invalidAPIs = apis.filter((api: string) => !validAPIs.includes(api.toLowerCase()));
    if (invalidAPIs.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid API names',
          message: `Invalid APIs: ${invalidAPIs.join(', ')}. Valid options: ${validAPIs.join(', ')}`
        },
        { status: 400 }
      );
    }

    console.log(`Testing specific APIs: ${apis.join(', ')}`);

    const results: any = {};

    // Test each requested API
    for (const apiName of apis) {
      try {
        switch (apiName.toLowerCase()) {
          case 'perplexity':
            results.perplexity = await apiHealthService.checkPerplexityAPI();
            break;
          case 'delta':
            results.delta = await apiHealthService.checkDeltaExchangeAPI();
            break;
          case 'coinmarketcap':
          case 'cryptocompare':
          case 'coinapi':
            const cryptoAPIs = await apiHealthService.checkCryptoDataAPIs();
            const targetAPI = cryptoAPIs.find(api => 
              api.name.toLowerCase().replace(/\s+/g, '') === apiName.toLowerCase()
            );
            if (targetAPI) {
              results[apiName] = targetAPI;
            }
            break;
          case 'santiment':
            results.santiment = await apiHealthService.checkSantimentAPI();
            break;
          case 'pinecone':
            results.pinecone = await apiHealthService.checkPineconeAPI();
            break;
        }
      } catch (error) {
        results[apiName] = {
          name: apiName,
          status: 'unhealthy',
          lastChecked: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Test failed'
        };
      }
    }

    // Calculate summary for tested APIs
    const testedAPIs = Object.values(results);
    const summary = {
      tested: testedAPIs.length,
      healthy: testedAPIs.filter((api: any) => api.status === 'healthy').length,
      unhealthy: testedAPIs.filter((api: any) => api.status === 'unhealthy').length,
      notConfigured: testedAPIs.filter((api: any) => api.status === 'not_configured').length
    };

    return NextResponse.json({
      success: true,
      data: {
        action,
        requestedAPIs: apis,
        results,
        summary,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in targeted API health check:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform targeted health check',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Helper functions
function calculateAverageResponseTime(apis: any[]): number {
  const apisWithResponseTime = apis.filter(api => api.responseTime !== undefined);
  if (apisWithResponseTime.length === 0) return 0;
  
  const totalTime = apisWithResponseTime.reduce((sum, api) => sum + api.responseTime, 0);
  return Math.round(totalTime / apisWithResponseTime.length);
}

function generateRecommendations(apis: any[]): string[] {
  const recommendations: string[] = [];
  
  const unhealthyAPIs = apis.filter(api => api.status === 'unhealthy');
  const notConfiguredAPIs = apis.filter(api => api.status === 'not_configured');
  const slowAPIs = apis.filter(api => api.responseTime && api.responseTime > 5000);

  if (unhealthyAPIs.length > 0) {
    recommendations.push(`Check configuration for unhealthy APIs: ${unhealthyAPIs.map(api => api.name).join(', ')}`);
  }

  if (notConfiguredAPIs.length > 0) {
    recommendations.push(`Configure API keys for: ${notConfiguredAPIs.map(api => api.name).join(', ')}`);
  }

  if (slowAPIs.length > 0) {
    recommendations.push(`Monitor slow response times for: ${slowAPIs.map(api => api.name).join(', ')}`);
  }

  const criticalAPIs = ['Delta Exchange', 'Perplexity AI'];
  const unhealthyCritical = unhealthyAPIs.filter(api => criticalAPIs.includes(api.name));
  if (unhealthyCritical.length > 0) {
    recommendations.push(`URGENT: Critical APIs are unhealthy: ${unhealthyCritical.map(api => api.name).join(', ')}`);
  }

  if (recommendations.length === 0) {
    recommendations.push('All APIs are functioning normally');
  }

  return recommendations;
}
