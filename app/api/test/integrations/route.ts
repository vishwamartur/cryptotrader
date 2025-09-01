import { NextRequest, NextResponse } from 'next/server';
import { apiHealthService } from '@/lib/crypto-apis/api-health-service';
import { cryptoAPIManager } from '@/lib/crypto-apis/api-manager';
import { sentimentAPIManager } from '@/lib/crypto-apis/sentiment-manager';
import { santimentService } from '@/lib/crypto-apis/santiment-service';
import { pineconeService } from '@/lib/ml/services/pinecone-service';
import { apiConfigService } from '@/lib/config/api-config';

/**
 * GET /api/test/integrations
 * Run comprehensive integration tests for all APIs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get('type') || 'basic';
    const includePerformance = searchParams.get('performance') === 'true';
    const testSymbols = searchParams.get('symbols')?.split(',') || ['BTC', 'ETH'];

    console.log(`Running ${testType} integration tests...`);

    const testResults = {
      timestamp: new Date().toISOString(),
      testType,
      testSymbols,
      results: [] as any[],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      }
    };

    const startTime = Date.now();

    // Test 1: Configuration Validation
    const configTest = await runConfigurationTest();
    testResults.results.push(configTest);

    // Test 2: Price Data APIs
    const priceTest = await runPriceDataTest(testSymbols);
    testResults.results.push(priceTest);

    // Test 3: Sentiment APIs
    const sentimentTest = await runSentimentTest(testSymbols);
    testResults.results.push(sentimentTest);

    // Test 4: Santiment API
    const santimentTest = await runSantimentTest(testSymbols);
    testResults.results.push(santimentTest);

    // Test 5: Pinecone Vector DB
    const pineconeTest = await runPineconeTest();
    testResults.results.push(pineconeTest);

    // Test 6: API Health Monitoring
    const healthTest = await runHealthMonitoringTest();
    testResults.results.push(healthTest);

    // Performance tests (if requested)
    if (includePerformance) {
      const performanceTest = await runPerformanceTest(testSymbols);
      testResults.results.push(performanceTest);
    }

    // Calculate summary
    testResults.summary.total = testResults.results.length;
    testResults.summary.passed = testResults.results.filter(r => r.status === 'passed').length;
    testResults.summary.failed = testResults.results.filter(r => r.status === 'failed').length;
    testResults.summary.skipped = testResults.results.filter(r => r.status === 'skipped').length;
    testResults.summary.duration = Date.now() - startTime;

    const overallStatus = testResults.summary.failed === 0 ? 'passed' : 
                         testResults.summary.passed > testResults.summary.failed ? 'partial' : 'failed';

    return NextResponse.json({
      success: true,
      status: overallStatus,
      data: testResults,
      recommendations: generateTestRecommendations(testResults.results)
    });

  } catch (error) {
    console.error('Error running integration tests:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Integration tests failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/test/integrations
 * Run specific integration tests
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tests, symbols = ['BTC', 'ETH'], timeout = 30000 } = body;

    if (!tests || !Array.isArray(tests)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request body',
          message: 'Please provide tests as an array of test names'
        },
        { status: 400 }
      );
    }

    const validTests = [
      'configuration', 'price_data', 'sentiment', 'santiment', 
      'pinecone', 'health_monitoring', 'performance'
    ];

    const invalidTests = tests.filter((test: string) => !validTests.includes(test));
    if (invalidTests.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid test names',
          message: `Invalid tests: ${invalidTests.join(', ')}. Valid options: ${validTests.join(', ')}`
        },
        { status: 400 }
      );
    }

    console.log(`Running specific tests: ${tests.join(', ')}`);

    const testResults = {
      timestamp: new Date().toISOString(),
      requestedTests: tests,
      symbols,
      timeout,
      results: [] as any[]
    };

    const startTime = Date.now();

    // Run requested tests
    for (const testName of tests) {
      try {
        let result;
        switch (testName) {
          case 'configuration':
            result = await runConfigurationTest();
            break;
          case 'price_data':
            result = await runPriceDataTest(symbols);
            break;
          case 'sentiment':
            result = await runSentimentTest(symbols);
            break;
          case 'santiment':
            result = await runSantimentTest(symbols);
            break;
          case 'pinecone':
            result = await runPineconeTest();
            break;
          case 'health_monitoring':
            result = await runHealthMonitoringTest();
            break;
          case 'performance':
            result = await runPerformanceTest(symbols);
            break;
        }
        
        if (result) {
          testResults.results.push(result);
        }
      } catch (error) {
        testResults.results.push({
          name: testName,
          status: 'failed',
          duration: 0,
          error: error instanceof Error ? error.message : 'Test execution failed',
          details: null
        });
      }
    }

    const totalDuration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        ...testResults,
        summary: {
          total: testResults.results.length,
          passed: testResults.results.filter(r => r.status === 'passed').length,
          failed: testResults.results.filter(r => r.status === 'failed').length,
          skipped: testResults.results.filter(r => r.status === 'skipped').length,
          duration: totalDuration
        }
      }
    });

  } catch (error) {
    console.error('Error in specific integration tests:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Specific integration tests failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Test implementation functions
async function runConfigurationTest() {
  const startTime = Date.now();
  
  try {
    const validation = apiConfigService.validateConfiguration();
    const summary = apiConfigService.getConfigurationSummary();
    
    const status = validation.isValid ? 'passed' : 'failed';
    
    return {
      name: 'Configuration Validation',
      status,
      duration: Date.now() - startTime,
      details: {
        validation,
        summary,
        configuredAPIs: summary.configured,
        totalAPIs: summary.total,
        configurationRate: summary.configurationRate
      }
    };
  } catch (error) {
    return {
      name: 'Configuration Validation',
      status: 'failed',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Configuration test failed',
      details: null
    };
  }
}

async function runPriceDataTest(symbols: string[]) {
  const startTime = Date.now();
  
  try {
    const prices = await cryptoAPIManager.getPrices(symbols);
    const marketData = await cryptoAPIManager.getMarketData();
    
    const status = prices.length > 0 && marketData ? 'passed' : 'failed';
    
    return {
      name: 'Price Data APIs',
      status,
      duration: Date.now() - startTime,
      details: {
        pricesRetrieved: prices.length,
        requestedSymbols: symbols.length,
        marketDataAvailable: !!marketData,
        sources: [...new Set(prices.map(p => p.source))]
      }
    };
  } catch (error) {
    return {
      name: 'Price Data APIs',
      status: 'failed',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Price data test failed',
      details: null
    };
  }
}

async function runSentimentTest(symbols: string[]) {
  const startTime = Date.now();
  
  try {
    const sentiment = await sentimentAPIManager.getSentiment(symbols);
    
    const status = sentiment.length > 0 ? 'passed' : 'failed';
    
    return {
      name: 'Sentiment Analysis APIs',
      status,
      duration: Date.now() - startTime,
      details: {
        sentimentRetrieved: sentiment.length,
        requestedSymbols: symbols.length,
        sources: [...new Set(sentiment.flatMap(s => s.sources))]
      }
    };
  } catch (error) {
    return {
      name: 'Sentiment Analysis APIs',
      status: 'failed',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Sentiment test failed',
      details: null
    };
  }
}

async function runSantimentTest(symbols: string[]) {
  const startTime = Date.now();
  
  try {
    const isHealthy = await santimentService.healthCheck();
    
    if (!isHealthy) {
      return {
        name: 'Santiment API',
        status: 'skipped',
        duration: Date.now() - startTime,
        details: { reason: 'API not configured or unhealthy' }
      };
    }

    const socialData = await santimentService.getSocialSentiment(symbols.slice(0, 2), 1);
    const onChainData = await santimentService.getOnChainData(symbols.slice(0, 2), 1);
    
    const status = socialData.length > 0 && onChainData.length > 0 ? 'passed' : 'failed';
    
    return {
      name: 'Santiment API',
      status,
      duration: Date.now() - startTime,
      details: {
        socialDataRetrieved: socialData.length,
        onChainDataRetrieved: onChainData.length,
        requestedSymbols: symbols.slice(0, 2).length
      }
    };
  } catch (error) {
    return {
      name: 'Santiment API',
      status: 'failed',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Santiment test failed',
      details: null
    };
  }
}

async function runPineconeTest() {
  const startTime = Date.now();
  
  try {
    const isHealthy = await pineconeService.healthCheck();
    
    if (!isHealthy) {
      return {
        name: 'Pinecone Vector DB',
        status: 'skipped',
        duration: Date.now() - startTime,
        details: { reason: 'API not configured or unhealthy' }
      };
    }

    // Test vector operations
    const testVector = Array.from({ length: 128 }, () => Math.random());
    const vectorId = await pineconeService.storeTradingPattern('TEST', 'price_pattern', testVector, {
      test: true,
      timestamp: Date.now()
    });

    const queryResults = await pineconeService.queryVectors(testVector, { topK: 5 });
    
    // Clean up test data
    await pineconeService.deleteVectors([vectorId]);
    
    return {
      name: 'Pinecone Vector DB',
      status: 'passed',
      duration: Date.now() - startTime,
      details: {
        vectorStored: !!vectorId,
        queryResults: queryResults.length,
        vectorDimensions: testVector.length
      }
    };
  } catch (error) {
    return {
      name: 'Pinecone Vector DB',
      status: 'failed',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Pinecone test failed',
      details: null
    };
  }
}

async function runHealthMonitoringTest() {
  const startTime = Date.now();
  
  try {
    const healthReport = await apiHealthService.getOverallHealthReport();
    
    const status = healthReport.status !== 'unhealthy' ? 'passed' : 'failed';
    
    return {
      name: 'API Health Monitoring',
      status,
      duration: Date.now() - startTime,
      details: {
        overallStatus: healthReport.status,
        totalAPIs: healthReport.summary.total,
        healthyAPIs: healthReport.summary.healthy,
        unhealthyAPIs: healthReport.summary.unhealthy
      }
    };
  } catch (error) {
    return {
      name: 'API Health Monitoring',
      status: 'failed',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Health monitoring test failed',
      details: null
    };
  }
}

async function runPerformanceTest(symbols: string[]) {
  const startTime = Date.now();
  
  try {
    const iterations = 3;
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const iterationStart = Date.now();
      await cryptoAPIManager.getPrices([symbols[0]]);
      results.push(Date.now() - iterationStart);
    }
    
    const averageTime = results.reduce((sum, time) => sum + time, 0) / results.length;
    const status = averageTime < 5000 ? 'passed' : 'failed'; // 5 second threshold
    
    return {
      name: 'Performance Test',
      status,
      duration: Date.now() - startTime,
      details: {
        iterations,
        averageResponseTime: averageTime,
        minTime: Math.min(...results),
        maxTime: Math.max(...results),
        threshold: 5000
      }
    };
  } catch (error) {
    return {
      name: 'Performance Test',
      status: 'failed',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Performance test failed',
      details: null
    };
  }
}

function generateTestRecommendations(results: any[]) {
  const recommendations = [];
  
  const failedTests = results.filter(r => r.status === 'failed');
  if (failedTests.length > 0) {
    recommendations.push({
      priority: 'high',
      title: 'Failed Tests',
      description: `${failedTests.length} test(s) failed. Check API configurations and network connectivity.`,
      tests: failedTests.map(t => t.name)
    });
  }
  
  const skippedTests = results.filter(r => r.status === 'skipped');
  if (skippedTests.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Skipped Tests',
      description: `${skippedTests.length} test(s) skipped due to missing configuration.`,
      tests: skippedTests.map(t => t.name)
    });
  }
  
  const slowTests = results.filter(r => r.duration > 10000);
  if (slowTests.length > 0) {
    recommendations.push({
      priority: 'low',
      title: 'Slow Performance',
      description: 'Some tests are running slowly. Consider optimizing API calls.',
      tests: slowTests.map(t => t.name)
    });
  }
  
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'info',
      title: 'All Tests Passed',
      description: 'All integration tests completed successfully.',
      tests: []
    });
  }
  
  return recommendations;
}
