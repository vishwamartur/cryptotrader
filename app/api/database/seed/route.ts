import { NextRequest, NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/database/seed';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({
        success: false,
        error: 'Database seeding can only be run in development mode',
      }, { status: 403 });
    }

    const result = await seedDatabase();
    
    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        demoUserId: result.demoUser.id,
        portfolioId: result.defaultPortfolio.id,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database seeding failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Database seeding failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
