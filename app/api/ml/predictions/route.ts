import { NextRequest, NextResponse } from 'next/server';
import { MLModelService } from '@/lib/ml/services/ml-model-service';
import { LSTMModel } from '@/lib/ml/models/lstm-model';
import { EnsembleModel } from '@/lib/ml/models/ensemble-model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // up to 5 minutes for predictions

// Get ML predictions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const symbol = searchParams.get('symbol');
    const predictionType = searchParams.get('type') || 'price';
    const hours = parseInt(searchParams.get('hours') || '24');
    const limit = parseInt(searchParams.get('limit') || '100');

    let predictions;

    if (modelId && symbol) {
      predictions = await MLModelService.getModelPredictions(modelId, symbol, limit);
    } else if (symbol && predictionType) {
      predictions = await MLModelService.getRecentPredictions(symbol, predictionType, hours);
    } else if (modelId) {
      predictions = await MLModelService.getModelPredictions(modelId, undefined, limit);
    } else {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: modelId or symbol',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: predictions,
      count: predictions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('ML predictions fetch error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch ML predictions',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Create new prediction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      modelType,
      modelId,
      symbol,
      predictionType = 'price',
      timeframe = '1h',
      config,
    } = body;

    if (!symbol) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: symbol',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    let prediction;

    if (modelType === 'lstm') {
      // Use LSTM model for prediction
      const lstmConfig = config || {
        sequenceLength: 24,
        features: ['price', 'volume', 'sma_5', 'sma_20', 'rsi_14'],
        hiddenUnits: [50, 30],
        dropout: 0.2,
        learningRate: 0.001,
        predictionHorizon: 1,
      };

      const lstmModel = new LSTMModel(lstmConfig);

      try {
        // Check if model is trained before making predictions
        if (!lstmModel.isTrained()) {
          return NextResponse.json({
            success: false,
            error: 'LSTM model needs to be trained before making predictions',
            code: 'MODEL_NOT_TRAINED',
            timestamp: new Date().toISOString(),
          }, { status: 503 });
        }

        console.log(`Generating LSTM prediction for ${symbol}...`);

        // Generate real prediction using trained model
        const modelPrediction = await lstmModel.predict(symbol);

        prediction = {
          symbol,
          predictedPrice: modelPrediction.predictedPrice,
          predictedDirection: modelPrediction.predictedDirection,
          confidence: modelPrediction.confidence,
          predictionTime: new Date(),
          targetTime: new Date(Date.now() + lstmConfig.predictionHorizon * 60 * 60 * 1000),
          features: {
            modelType: 'lstm',
            sequenceLength: lstmConfig.sequenceLength,
            predictionHorizon: lstmConfig.predictionHorizon,
            inputFeatures: modelPrediction.features,
          },
        };
      } catch (error) {
        console.error('LSTM prediction failed:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to generate LSTM prediction',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }, { status: 500 });
      } finally {
        lstmModel.dispose();
      }
    } else if (modelType === 'ensemble') {
      // Use ensemble model for prediction
      const ensembleConfig = config || {
        models: {
          lstm: { weight: 0.4, config: {} },
          randomForest: { weight: 0.25, config: {} },
          xgboost: { weight: 0.25, config: {} },
          svm: { weight: 0.1, config: {} },
        },
        votingStrategy: 'weighted',
        confidenceThreshold: 0.6,
      };

      const ensembleModel = new EnsembleModel(ensembleConfig);
      
      try {
        await ensembleModel.initializeModels(symbol);
        const ensemblePred = await ensembleModel.predict(symbol);
        
        prediction = {
          symbol: ensemblePred.symbol,
          predictedPrice: ensemblePred.ensemblePrediction.price,
          predictedDirection: ensemblePred.ensemblePrediction.direction,
          confidence: ensemblePred.ensemblePrediction.confidence,
          predictionTime: ensemblePred.predictionTime,
          targetTime: ensemblePred.targetTime,
          features: {
            modelType: 'ensemble',
            consensus: ensemblePred.ensemblePrediction.consensus,
            individualPredictions: ensemblePred.predictions,
          },
        };
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

    // Store prediction in database if modelId is provided
    // Validate prediction before returning
    if (!prediction || !prediction.predictedPrice || !prediction.confidence) {
      return NextResponse.json({
        success: false,
        error: 'Invalid prediction generated - missing required fields',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    // Store prediction in database if modelId is provided
    if (modelId && prediction) {
      try {
        const predictionData = {
          modelId,
          symbol,
          predictionType,
          timeframe,
          inputData: prediction.features,
          prediction: {
            value: prediction.predictedPrice,
            direction: prediction.predictedDirection,
          },
          confidence: prediction.confidence.toString(),
          predictionTime: prediction.predictionTime,
          targetTime: prediction.targetTime,
        };

        const storedPrediction = await MLModelService.createPrediction(predictionData);

        return NextResponse.json({
          success: true,
          data: {
            ...prediction,
            id: storedPrediction?.id,
            stored: true,
          },
          message: 'Prediction created and stored successfully',
          timestamp: new Date().toISOString(),
        });
      } catch (storageError) {
        console.error('Failed to store prediction:', storageError);
        // Continue to return prediction even if storage fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...prediction,
        stored: false,
      },
      message: 'Prediction created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('ML prediction creation error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create ML prediction',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Validate prediction
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { predictionId, actualValue } = body;

    if (!predictionId || actualValue === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: predictionId, actualValue',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const validatedPrediction = await MLModelService.validatePrediction(
      predictionId,
      Number(actualValue)
    );

    if (!validatedPrediction) {
      return NextResponse.json({
        success: false,
        error: 'Prediction not found',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: validatedPrediction,
      message: 'Prediction validated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('ML prediction validation error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to validate ML prediction',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
