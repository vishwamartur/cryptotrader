import { NextRequest, NextResponse } from 'next/server';
import { MLModelService } from '@/lib/ml/services/ml-model-service';
import { LSTMModel } from '@/lib/ml/models/lstm-model';
import { EnsembleModel } from '@/lib/ml/models/ensemble-model';

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
        // For demo purposes, we'll create a mock prediction
        // In production, you'd train the model first
        prediction = {
          symbol,
          predictedPrice: 47000 + (Math.random() - 0.5) * 2000,
          predictedDirection: Math.random() > 0.5 ? 'up' : 'down',
          confidence: 0.7 + Math.random() * 0.25,
          predictionTime: new Date(),
          targetTime: new Date(Date.now() + 60 * 60 * 1000),
          features: {
            modelType: 'lstm',
            sequenceLength: lstmConfig.sequenceLength,
            predictionHorizon: lstmConfig.predictionHorizon,
          },
        };
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
    if (modelId && prediction) {
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
          id: storedPrediction.id,
          stored: true,
        },
        message: 'Prediction created and stored successfully',
        timestamp: new Date().toISOString(),
      });
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
