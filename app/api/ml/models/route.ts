import { NextRequest, NextResponse } from 'next/server';
import { MLModelService } from '@/lib/ml/services/ml-model-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Get ML models
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    
    let models;
    
    if (type) {
      models = await MLModelService.getModelsByType(type, activeOnly);
    } else {
      models = activeOnly
        ? await MLModelService.getActiveModels()
        : await MLModelService.getAllModels();
    }

    return NextResponse.json({
      success: true,
      data: models,
      count: models.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('ML models fetch error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch ML models',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Create new ML model
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      type,
      version,
      description,
      parameters,
      architecture,
    } = body;

    if (!name || !type || !version || !parameters) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: name, type, version, parameters',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const modelData = {
      name,
      type,
      version,
      description: description || '',
      parameters,
      architecture: architecture || {},
      performance: {},
      status: 'training' as const,
    };

    const model = await MLModelService.createModel(modelData);

    return NextResponse.json({
      success: true,
      data: model,
      message: 'ML model created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('ML model creation error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create ML model',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Update ML model
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, ...updates } = body;

    if (!modelId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: modelId',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const updatedModel = await MLModelService.updateModel(modelId, updates);

    if (!updatedModel) {
      return NextResponse.json({
        success: false,
        error: 'Model not found',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updatedModel,
      message: 'ML model updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('ML model update error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to update ML model',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
