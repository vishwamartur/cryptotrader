import { NextRequest, NextResponse } from 'next/server';
import { MLStrategyService } from '@/lib/ml/services/ml-strategy-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Get ML strategy performance and analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get('strategyId');
    const action = searchParams.get('action');
    const daysRaw = Number(searchParams.get('days'));
    const limitRaw = Number(searchParams.get('limit'));
    const days = Number.isFinite(daysRaw) ? Math.min(Math.max(1, daysRaw), 365) : 30;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 10;

    if (action === 'top-performing') {
      const topStrategies = await MLStrategyService.getTopPerformingStrategies(limit);
      
      return NextResponse.json({
        success: true,
        data: topStrategies,
        count: topStrategies.length,
        timestamp: new Date().toISOString(),
      });
    }

    if (strategyId) {
      if (action === 'analytics') {
        const analytics = await MLStrategyService.getStrategyAnalytics(strategyId, days);
        
        return NextResponse.json({
          success: true,
          data: analytics,
          timestamp: new Date().toISOString(),
        });
      }

      if (action === 'monitor') {
        const monitoring = await MLStrategyService.monitorAndRetrain(strategyId);
        
        return NextResponse.json({
          success: true,
          data: monitoring,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid request. Specify strategyId and/or action parameter',
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  } catch (error) {
    console.error('ML strategy fetch error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch ML strategy data',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Execute ML trading strategy
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, strategyId, portfolioId, strategyConfig, symbol } = body;

    if (action === 'execute') {
      if (!strategyId || !portfolioId) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields: strategyId, portfolioId',
          timestamp: new Date().toISOString(),
        }, { status: 400 });
      }

      const result = await MLStrategyService.executeStrategy(strategyId, portfolioId);
      
      return NextResponse.json({
        success: true,
        data: result,
        message: `Strategy executed with ${result.signals.length} signals and ${result.executedTrades.length} trades`,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'generate-signal') {
      if (!strategyConfig || !symbol || !portfolioId) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields: strategyConfig, symbol, portfolioId',
          timestamp: new Date().toISOString(),
        }, { status: 400 });
      }

      const signal = await MLStrategyService.generateTradingSignal(
        strategyConfig,
        symbol,
        portfolioId
      );
      
      return NextResponse.json({
        success: true,
        data: signal,
        message: signal ? 'Trading signal generated successfully' : 'No signal generated',
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'backtest') {
      const {
        startDate,
        endDate,
      } = body;

      if (!strategyConfig || !symbol || !startDate || !endDate) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields: strategyConfig, symbol, startDate, endDate',
          timestamp: new Date().toISOString(),
        }, { status: 400 });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.valueOf()) || isNaN(end.valueOf()) || start >= end) {
        return NextResponse.json({
          success: false,
          error: 'Invalid date range',
          timestamp: new Date().toISOString(),
        }, { status: 400 });
      }

      const backtestResult = await MLStrategyService.backtestStrategy(
        strategyConfig,
        symbol,
        start,
        end
      );
      
      return NextResponse.json({
        success: true,
        data: backtestResult,
        message: 'Backtest completed successfully',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use "execute", "generate-signal", or "backtest"',
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  } catch (error) {
    console.error('ML strategy execution error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to execute ML strategy action',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
