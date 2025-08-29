import { NextRequest, NextResponse } from 'next/server';
import { checkDatabaseConnection, getDatabaseStatus } from '@/lib/database/connection';

export async function GET(request: NextRequest) {
  try {
    const status = await getDatabaseStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        database: status,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Database health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
