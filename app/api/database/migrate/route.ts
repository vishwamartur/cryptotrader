import { NextRequest, NextResponse } from 'next/server';
import { runMigrations } from '@/lib/database/migrate';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({
        success: false,
        error: 'Migrations can only be run in development mode',
      }, { status: 403 });
    }

    await runMigrations();
    
    return NextResponse.json({
      success: true,
      message: 'Database migrations completed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Migration failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
