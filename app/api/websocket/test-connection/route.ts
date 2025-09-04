import { NextResponse } from "next/server";
import { testWebSocketConnection, validateWebSocketURL } from "@/lib/websocket-validator";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const timeoutStr = searchParams.get('timeout');
    const timeout = timeoutStr ? parseInt(timeoutStr, 10) : 5000;

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'WebSocket URL parameter is required',
        usage: 'GET /api/websocket/test-connection?url=wss://example.com&timeout=5000'
      }, { status: 400 });
    }

    // First validate the URL format
    const validation = validateWebSocketURL(url);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: validation.error,
        suggestions: validation.suggestions,
        url
      }, { status: 400 });
    }

    // Test the connection
    console.log(`[WebSocket Test] Testing connection to: ${url}`);
    const testResult = await testWebSocketConnection(url, timeout);

    if (testResult.success) {
      return NextResponse.json({
        success: true,
        message: 'WebSocket connection test successful',
        url: testResult.url,
        responseTime: testResult.responseTime,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        error: testResult.error,
        url: testResult.url,
        responseTime: testResult.responseTime,
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }

  } catch (error) {
    console.error('[WebSocket Test] Error testing connection:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { urls, timeout = 5000 } = body;

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json({
        success: false,
        error: 'URLs array is required in request body',
        usage: 'POST /api/websocket/test-connection with body: { "urls": ["wss://example1.com", "wss://example2.com"], "timeout": 5000 }'
      }, { status: 400 });
    }

    console.log(`[WebSocket Test] Testing ${urls.length} WebSocket connections`);
    
    // Test all URLs concurrently
    const testPromises = urls.map(url => testWebSocketConnection(url, timeout));
    const results = await Promise.all(testPromises);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return NextResponse.json({
      success: true,
      message: `Tested ${urls.length} WebSocket connections`,
      summary: {
        total: urls.length,
        successful: successful.length,
        failed: failed.length
      },
      results: results.map(result => ({
        url: result.url,
        success: result.success,
        error: result.error,
        responseTime: result.responseTime
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[WebSocket Test] Error testing multiple connections:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
