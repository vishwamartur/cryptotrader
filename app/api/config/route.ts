import { NextRequest, NextResponse } from 'next/server';
import { apiConfigService } from '@/lib/config/api-config';

/**
 * GET /api/config
 * Get application configuration and API status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');
    const includeKeys = searchParams.get('includeKeys') === 'true';
    const validate = searchParams.get('validate') === 'true';

    const response: any = {
      success: true,
      data: {
        timestamp: new Date().toISOString()
      }
    };

    // Get specific section or all configuration
    switch (section) {
      case 'apis':
        response.data.apis = includeKeys 
          ? apiConfigService.getAllConfigurations()
          : apiConfigService.getAllConfigurations().map(api => ({
              name: api.name,
              isConfigured: api.isConfigured,
              isRequired: api.isRequired,
              description: api.description,
              documentationUrl: api.documentationUrl
            }));
        break;

      case 'database':
        const dbConfig = apiConfigService.getDatabaseConfiguration();
        response.data.database = includeKeys ? dbConfig : {
          poolMin: dbConfig.poolMin,
          poolMax: dbConfig.poolMax,
          poolIdleTimeout: dbConfig.poolIdleTimeout,
          poolConnectTimeout: dbConfig.poolConnectTimeout,
          logging: dbConfig.logging,
          isConfigured: !!dbConfig.url
        };
        break;

      case 'application':
        response.data.application = apiConfigService.getApplicationConfiguration();
        break;

      case 'trading':
        response.data.trading = apiConfigService.getTradingConfiguration();
        break;

      case 'features':
        response.data.features = apiConfigService.getFeatureFlags();
        break;

      case 'summary':
        response.data.summary = apiConfigService.getConfigurationSummary();
        break;

      default:
        // Return all configuration sections (without sensitive keys)
        response.data = {
          apis: apiConfigService.getAllConfigurations().map(api => ({
            name: api.name,
            isConfigured: api.isConfigured,
            isRequired: api.isRequired,
            description: api.description,
            documentationUrl: api.documentationUrl
          })),
          database: {
            poolMin: apiConfigService.getDatabaseConfiguration().poolMin,
            poolMax: apiConfigService.getDatabaseConfiguration().poolMax,
            poolIdleTimeout: apiConfigService.getDatabaseConfiguration().poolIdleTimeout,
            poolConnectTimeout: apiConfigService.getDatabaseConfiguration().poolConnectTimeout,
            logging: apiConfigService.getDatabaseConfiguration().logging,
            isConfigured: !!apiConfigService.getDatabaseConfiguration().url
          },
          application: apiConfigService.getApplicationConfiguration(),
          trading: apiConfigService.getTradingConfiguration(),
          features: apiConfigService.getFeatureFlags(),
          summary: apiConfigService.getConfigurationSummary(),
          timestamp: new Date().toISOString()
        };
    }

    // Add validation if requested
    if (validate) {
      response.data.validation = apiConfigService.validateConfiguration();
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error getting configuration:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get configuration',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config
 * Validate configuration or get specific configuration details
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing action parameter',
          message: 'Please specify action: "validate", "check_apis", or "get_recommendations"'
        },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'validate':
        result = await handleValidateConfiguration(params);
        break;
      
      case 'check_apis':
        result = await handleCheckAPIs(params);
        break;
      
      case 'get_recommendations':
        result = await handleGetRecommendations(params);
        break;

      case 'check_requirements':
        result = await handleCheckRequirements(params);
        break;

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action',
            message: 'Supported actions: validate, check_apis, get_recommendations, check_requirements'
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in configuration POST:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Configuration operation failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Handler functions
async function handleValidateConfiguration(params: any) {
  const validation = apiConfigService.validateConfiguration();
  const summary = apiConfigService.getConfigurationSummary();

  return {
    validation,
    summary,
    recommendations: generateConfigurationRecommendations(validation, summary)
  };
}

async function handleCheckAPIs(params: any) {
  const { category } = params;
  
  let apis;
  if (category) {
    const allAPIs = apiConfigService.getAllConfigurations();
    switch (category.toLowerCase()) {
      case 'required':
        apis = apiConfigService.getRequiredAPIs();
        break;
      case 'configured':
        apis = apiConfigService.getConfiguredAPIs();
        break;
      case 'unconfigured':
        apis = apiConfigService.getUnconfiguredAPIs();
        break;
      case 'price':
        apis = allAPIs.filter(api => 
          ['CoinMarketCap', 'CryptoCompare', 'CoinAPI', 'Nomics', 'CoinLayer'].includes(api.name)
        );
        break;
      case 'sentiment':
        apis = allAPIs.filter(api => 
          ['Santiment', 'Predicoin', 'BittsAnalytics', 'Mosaic', 'Decryptz', 'Daneel'].includes(api.name)
        );
        break;
      default:
        apis = allAPIs;
    }
  } else {
    apis = apiConfigService.getAllConfigurations();
  }

  return {
    category: category || 'all',
    apis: apis.map(api => ({
      name: api.name,
      isConfigured: api.isConfigured,
      isRequired: api.isRequired,
      description: api.description,
      documentationUrl: api.documentationUrl
    })),
    count: apis.length,
    configuredCount: apis.filter(api => api.isConfigured).length
  };
}

async function handleGetRecommendations(params: any) {
  const validation = apiConfigService.validateConfiguration();
  const summary = apiConfigService.getConfigurationSummary();
  const recommendations = generateConfigurationRecommendations(validation, summary);

  return {
    recommendations,
    priority: {
      high: recommendations.filter(r => r.priority === 'high'),
      medium: recommendations.filter(r => r.priority === 'medium'),
      low: recommendations.filter(r => r.priority === 'low')
    },
    summary
  };
}

async function handleCheckRequirements(params: any) {
  const required = apiConfigService.getRequiredAPIs();
  const missing = apiConfigService.getMissingRequiredAPIs();
  const dbConfig = apiConfigService.getDatabaseConfiguration();

  return {
    requirements: {
      apis: {
        total: required.length,
        configured: required.length - missing.length,
        missing: missing.map(api => ({
          name: api.name,
          description: api.description,
          documentationUrl: api.documentationUrl
        }))
      },
      database: {
        isConfigured: !!dbConfig.url,
        url: !!dbConfig.url ? '[CONFIGURED]' : '[NOT CONFIGURED]'
      }
    },
    isReady: missing.length === 0 && !!dbConfig.url,
    nextSteps: generateNextSteps(missing, !dbConfig.url)
  };
}

function generateConfigurationRecommendations(validation: any, summary: any) {
  const recommendations = [];

  // High priority recommendations
  if (validation.errors.length > 0) {
    recommendations.push({
      priority: 'high',
      type: 'error',
      title: 'Critical Configuration Issues',
      description: 'Fix these issues to ensure proper application functionality',
      items: validation.errors
    });
  }

  if (summary.missingRequired > 0) {
    recommendations.push({
      priority: 'high',
      type: 'requirement',
      title: 'Missing Required APIs',
      description: 'Configure these APIs for core functionality',
      items: apiConfigService.getMissingRequiredAPIs().map(api => 
        `${api.name}: ${api.description}`
      )
    });
  }

  // Medium priority recommendations
  if (validation.warnings.length > 0) {
    recommendations.push({
      priority: 'medium',
      type: 'warning',
      title: 'Configuration Warnings',
      description: 'Address these for optimal functionality',
      items: validation.warnings
    });
  }

  if (summary.configurationRate < 50) {
    recommendations.push({
      priority: 'medium',
      type: 'optimization',
      title: 'Low Configuration Rate',
      description: 'Consider configuring more APIs for better redundancy and features',
      items: [`Only ${summary.configurationRate}% of APIs are configured`]
    });
  }

  // Low priority recommendations
  const unconfiguredOptional = apiConfigService.getUnconfiguredAPIs().filter(api => !api.isRequired);
  if (unconfiguredOptional.length > 0) {
    recommendations.push({
      priority: 'low',
      type: 'enhancement',
      title: 'Optional API Enhancements',
      description: 'Configure these for additional features and redundancy',
      items: unconfiguredOptional.slice(0, 3).map(api => 
        `${api.name}: ${api.description}`
      )
    });
  }

  return recommendations;
}

function generateNextSteps(missingAPIs: any[], missingDB: boolean) {
  const steps = [];

  if (missingDB) {
    steps.push({
      step: 1,
      title: 'Configure Database',
      description: 'Set up PostgreSQL database and configure DATABASE_URL',
      priority: 'critical'
    });
  }

  if (missingAPIs.length > 0) {
    missingAPIs.forEach((api, index) => {
      steps.push({
        step: steps.length + 1,
        title: `Configure ${api.name}`,
        description: `Get API key from ${api.documentationUrl || 'provider website'}`,
        priority: 'high'
      });
    });
  }

  if (steps.length === 0) {
    steps.push({
      step: 1,
      title: 'All Requirements Met',
      description: 'Your application is properly configured and ready to use',
      priority: 'info'
    });
  }

  return steps;
}
