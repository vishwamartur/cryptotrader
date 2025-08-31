import { NextRequest, NextResponse } from 'next/server';
import { MLModelService } from '@/lib/ml/services/ml-model-service';
import { LSTMModel } from '@/lib/ml/models/lstm-model';
import { EnsembleModel } from '@/lib/ml/models/ensemble-model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 900; // up to 15 minutes
import { isMLTrainingEnabled, validateModelConfig } from '@/lib/ml/config/ml-config';

// Get training jobs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const status = searchParams.get('status');
    const limitRaw = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 10;

    let trainingJobs;

    if (status === 'pending') {
      trainingJobs = await MLModelService.getPendingTrainingJobs();
    } else if (modelId) {
      trainingJobs = await MLModelService.getModelTrainingJobs(modelId, limit);
    } else {
      // Get recent training jobs across all models
      trainingJobs = await MLModelService.getRecentTrainingJobs(limit);
    }

    return NextResponse.json({
      success: true,
      data: trainingJobs,
      count: trainingJobs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Training jobs fetch error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch training jobs',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Start model training
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      modelType,
      symbol,
      trainingDays = 30,
      config,
      jobType = 'initial',
    } = body;

    if (!modelType || !symbol) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: modelType, symbol',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // Check if ML training is enabled and safe
    if (!isMLTrainingEnabled()) {
      return NextResponse.json({
        success: false,
        error: 'Model training is not enabled. Set ML_TRAINING_ENABLED=true or run in development mode.',
        timestamp: new Date().toISOString(),
      }, { status: 403 });
    }

    // Validate model configuration
    if (config) {
      const validation = validateModelConfig(config);
      if (!validation.valid) {
        return NextResponse.json({
          success: false,
          error: 'Invalid model configuration',
          details: validation.errors,
          timestamp: new Date().toISOString(),
        }, { status: 400 });
      }
    }

    let trainingResult;

    if (modelType === 'lstm') {
      // Train LSTM model
      const lstmConfig = config || {
        sequenceLength: 24,
        features: [
          'price', 'volume', 'sma_5', 'sma_20', 'rsi_14', 'macd',
          'bb_upper', 'bb_lower', 'atr_14', 'price_momentum_1h'
        ],
        hiddenUnits: [50, 30],
        dropout: 0.2,
        learningRate: 0.001,
        batchSize: 32,
        epochs: 100,
        validationSplit: 0.2,
        predictionHorizon: 1,
      };

      const lstmModel = new LSTMModel(lstmConfig);
      
      try {
        console.log(`Starting LSTM training for ${symbol}...`);
        trainingResult = await lstmModel.train(symbol, trainingDays);
        
        // Validate the trained model
        const validation = await lstmModel.validateModel(symbol, 7);
        trainingResult.validation = validation;
        
        console.log('LSTM training completed successfully');
      } catch (error) {
        console.error('LSTM training failed:', error);
        throw error;
      } finally {
        lstmModel.dispose();
      }
    } else if (modelType === 'ensemble') {
      // Train ensemble model
      const ensembleConfig = config || {
        models: {
          lstm: { 
            weight: 0.4, 
            config: {
              sequenceLength: 24,
              hiddenUnits: [50, 30],
              dropout: 0.2,
              epochs: 50,
            }
          },
          randomForest: { weight: 0.25, config: { nEstimators: 100 } },
          xgboost: { weight: 0.25, config: { nEstimators: 200 } },
          svm: { weight: 0.1, config: { kernel: 'rbf' } },
        },
        votingStrategy: 'weighted',
        confidenceThreshold: 0.6,
      };

      const ensembleModel = new EnsembleModel(ensembleConfig);
      
      try {
        console.log(`Starting ensemble training for ${symbol}...`);
        await ensembleModel.initializeModels(symbol);
        trainingResult = await ensembleModel.train(symbol, trainingDays);
        
        console.log('Ensemble training completed successfully');
      } catch (error) {
        console.error('Ensemble training failed:', error);
        throw error;
      } finally {
        ensembleModel.dispose();
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'Unsupported model type. Use "lstm" or "ensemble"',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // Create training job record
    const trainingJobData = {
      modelId: trainingResult.modelId,
      jobType,
      status: 'completed' as const,
      parameters: config || {},
      trainingData: {
        symbol,
        trainingDays,
        modelType,
      },
      results: trainingResult,
      startedAt: new Date(),
      completedAt: new Date(),
    };

    const trainingJob = await MLModelService.createTrainingJob(trainingJobData);

    return NextResponse.json({
      success: true,
      data: {
        trainingJob,
        trainingResult,
      },
      message: `${modelType.toUpperCase()} model training completed successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Model training error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to train ML model',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Update training job status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, status, results, logs, errorMessage } = body;

    if (!jobId || !status) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: jobId, status',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const updates: any = { status };
    
    if (results) updates.results = results;
    if (logs) updates.logs = logs;
    if (errorMessage) updates.errorMessage = errorMessage;
    
    if (status === 'running' && !updates.startedAt) {
      updates.startedAt = new Date();
    }
    
    if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
    }

    const updatedJob = await MLModelService.updateTrainingJob(jobId, updates);

    if (!updatedJob) {
      return NextResponse.json({
        success: false,
        error: 'Training job not found',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updatedJob,
      message: 'Training job updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Training job update error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to update training job',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
