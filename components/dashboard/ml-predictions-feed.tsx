'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Target,
  Clock,
  RefreshCw,
  AlertTriangle,
  Zap
} from 'lucide-react';

interface MLPrediction {
  id: string;
  symbol: string;
  predictionType: string;
  prediction: any;
  confidence: number;
  predictionTime: string;
  targetTime: string;
  modelId: string;
  accuracy?: number;
  actualValue?: number;
}

interface MLPredictionsFeedProps {
  theme?: 'light' | 'dark';
  autoRefresh?: boolean;
  refreshInterval?: number;
  symbols?: string[];
}

export function MLPredictionsFeed({ 
  theme = 'dark', 
  autoRefresh = true, 
  refreshInterval = 15000,
  symbols = ['BTC-USD', 'ETH-USD', 'ADA-USD']
}: MLPredictionsFeedProps) {
  const [predictions, setPredictions] = useState<MLPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all');

  // Fetch ML predictions
  const fetchPredictions = async () => {
    try {
      setError(null);
      
      // Fetch predictions for each symbol
      const allPredictions: MLPrediction[] = [];
      
      for (const symbol of symbols) {
        try {
          const response = await fetch(`/api/ml/predictions?symbol=${symbol}&type=price&hours=24`);
          const data = await response.json();
          
          if (data.success && data.data) {
            allPredictions.push(...data.data);
          }
        } catch (err) {
          console.error(`Failed to fetch predictions for ${symbol}:`, err);
        }
      }
      
      // Sort by prediction time (most recent first)
      allPredictions.sort((a, b) => 
        new Date(b.predictionTime).getTime() - new Date(a.predictionTime).getTime()
      );
      
      setPredictions(allPredictions);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Network error while fetching ML predictions');
      console.error('ML predictions fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchPredictions();
    
    if (autoRefresh) {
      const interval = setInterval(fetchPredictions, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Get direction icon
  const getDirectionIcon = (prediction: any) => {
    if (!prediction || typeof prediction !== 'object') return <Minus className="w-4 h-4 text-gray-500" />;
    
    const direction = prediction.direction;
    if (direction === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (direction === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Get time until target
  const getTimeUntilTarget = (targetTime: string) => {
    const target = new Date(targetTime);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 0) return 'Expired';
    if (diffHours === 0) return 'Now';
    if (diffHours === 1) return '1 hour';
    return `${diffHours} hours`;
  };

  // Filter predictions by selected symbol
  const filteredPredictions = selectedSymbol === 'all' 
    ? predictions 
    : predictions.filter(p => p.symbol === selectedSymbol);

  if (loading) {
    return (
      <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>ML Predictions Feed</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="ml-2">Loading predictions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>ML Predictions Feed</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-red-500">
            <AlertTriangle className="w-6 h-6 mr-2" />
            <span>{error}</span>
          </div>
          <Button onClick={fetchPredictions} variant="outline" className="w-full mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="w-5 h-5" />
              <span>ML Predictions Feed</span>
            </CardTitle>
            <CardDescription>
              Real-time machine learning predictions and signals
            </CardDescription>
          </div>
          <Button onClick={fetchPredictions} variant="ghost" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Symbol Filter */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedSymbol === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedSymbol('all')}
          >
            All
          </Button>
          {symbols.map(symbol => (
            <Button
              key={symbol}
              variant={selectedSymbol === symbol ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedSymbol(symbol)}
            >
              {symbol}
            </Button>
          ))}
        </div>

        {/* Predictions List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredPredictions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No predictions found</p>
              <p className="text-sm">ML models will generate predictions automatically</p>
            </div>
          ) : (
            filteredPredictions.slice(0, 10).map((prediction) => {
              const predictionValue = prediction.prediction?.value || prediction.prediction?.price || 0;
              const direction = prediction.prediction?.direction || 'sideways';
              const timeUntilTarget = getTimeUntilTarget(prediction.targetTime);
              const isExpired = timeUntilTarget === 'Expired';
              
              return (
                <div
                  key={prediction.id}
                  className={`p-4 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600' 
                      : 'bg-gray-50 border-gray-200'
                  } ${isExpired ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">{prediction.symbol}</Badge>
                      {getDirectionIcon(prediction.prediction)}
                      <span className="font-semibold">
                        ${typeof predictionValue === 'number' ? predictionValue.toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-500">{timeUntilTarget}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="text-xs text-gray-500">Confidence</div>
                        <div className={`font-semibold ${getConfidenceColor(prediction.confidence)}`}>
                          {(prediction.confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                      {prediction.accuracy !== undefined && (
                        <div>
                          <div className="text-xs text-gray-500">Accuracy</div>
                          <div className={`font-semibold ${getConfidenceColor(prediction.accuracy)}`}>
                            {(prediction.accuracy * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {prediction.predictionType}
                    </Badge>
                  </div>

                  <Progress 
                    value={prediction.confidence * 100} 
                    className="h-1 mb-2"
                  />

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      Predicted: {new Date(prediction.predictionTime).toLocaleTimeString()}
                    </span>
                    <span>
                      Target: {new Date(prediction.targetTime).toLocaleTimeString()}
                    </span>
                  </div>

                  {prediction.actualValue && (
                    <div className="mt-2 pt-2 border-t border-gray-600">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Actual Value:</span>
                        <span className="font-semibold">
                          ${prediction.actualValue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Generate New Prediction Button */}
        <div className="pt-4 border-t border-gray-600">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={async () => {
              try {
                const response = await fetch('/api/ml/predictions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    modelType: 'ensemble',
                    symbol: symbols[0],
                    predictionType: 'price',
                    timeframe: '1h',
                  }),
                });
                
                if (response.ok) {
                  fetchPredictions(); // Refresh predictions
                }
              } catch (err) {
                console.error('Failed to generate prediction:', err);
              }
            }}
          >
            <Zap className="w-4 h-4 mr-2" />
            Generate New Prediction
          </Button>
        </div>

        {/* Last Update */}
        <div className="text-xs text-gray-500 text-center">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
