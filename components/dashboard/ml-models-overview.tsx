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
  Activity, 
  Zap,
  Target,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface MLModel {
  id: string;
  name: string;
  type: string;
  version: string;
  status: string;
  accuracy: number;
  sharpeRatio: number;
  maxDrawdown: number;
  lastTrainedAt: string;
  performance: any;
}

interface MLModelsOverviewProps {
  theme?: 'light' | 'dark';
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function MLModelsOverview({ 
  theme = 'dark', 
  autoRefresh = true, 
  refreshInterval = 30000 
}: MLModelsOverviewProps) {
  const [models, setModels] = useState<MLModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch ML models data
  const fetchModels = async () => {
    try {
      setError(null);
      const response = await fetch('/api/ml/models?activeOnly=true');
      const data = await response.json();
      
      if (data.success) {
        setModels(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch ML models');
      }
      
      setLastUpdate(new Date());
    } catch (err) {
      setError('Network error while fetching ML models');
      console.error('ML models fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchModels();
    
    if (autoRefresh) {
      const interval = setInterval(fetchModels, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'training':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get model type icon
  const getModelTypeIcon = (type: string) => {
    switch (type) {
      case 'lstm':
        return <Brain className="w-4 h-4 text-blue-500" />;
      case 'ensemble':
        return <BarChart3 className="w-4 h-4 text-purple-500" />;
      case 'reinforcement':
        return <Zap className="w-4 h-4 text-orange-500" />;
      default:
        return <Target className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get performance color
  const getPerformanceColor = (value: number, type: 'accuracy' | 'sharpe' | 'drawdown') => {
    if (type === 'accuracy') {
      if (value >= 0.8) return 'text-green-500';
      if (value >= 0.6) return 'text-yellow-500';
      return 'text-red-500';
    }
    if (type === 'sharpe') {
      if (value >= 1.5) return 'text-green-500';
      if (value >= 1.0) return 'text-yellow-500';
      return 'text-red-500';
    }
    if (type === 'drawdown') {
      if (value <= 0.05) return 'text-green-500';
      if (value <= 0.1) return 'text-yellow-500';
      return 'text-red-500';
    }
    return 'text-gray-500';
  };

  if (loading) {
    return (
      <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>ML Models Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="ml-2">Loading ML models...</span>
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
            <span>ML Models Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-red-500">
            <AlertTriangle className="w-6 h-6 mr-2" />
            <span>{error}</span>
          </div>
          <Button onClick={fetchModels} variant="outline" className="w-full mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeModels = models.filter(model => model.status === 'active');
  const trainingModels = models.filter(model => model.status === 'training');
  const avgAccuracy = models.length > 0 
    ? models.reduce((sum, model) => sum + (Number(model.accuracy) || 0), 0) / models.length 
    : 0;

  return (
    <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="w-5 h-5" />
              <span>ML Models Overview</span>
            </CardTitle>
            <CardDescription>
              Machine learning models performance and status
            </CardDescription>
          </div>
          <Button onClick={fetchModels} variant="ghost" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">{activeModels.length}</div>
            <div className="text-sm text-gray-500">Active Models</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-500">{trainingModels.length}</div>
            <div className="text-sm text-gray-500">Training</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">{(avgAccuracy * 100).toFixed(1)}%</div>
            <div className="text-sm text-gray-500">Avg Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{models.length}</div>
            <div className="text-sm text-gray-500">Total Models</div>
          </div>
        </div>

        {/* Models List */}
        <div className="space-y-4">
          {models.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No ML models found</p>
              <p className="text-sm">Train your first model to get started</p>
            </div>
          ) : (
            models.slice(0, 5).map((model) => (
              <div
                key={model.id}
                className={`p-4 rounded-lg border ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {getModelTypeIcon(model.type)}
                    <div>
                      <h4 className="font-semibold">{model.name}</h4>
                      <p className="text-sm text-gray-500">v{model.version}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(model.status)}
                    <Badge variant={model.status === 'active' ? 'default' : 'secondary'}>
                      {model.status}
                    </Badge>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <div className="text-sm text-gray-500">Accuracy</div>
                    <div className={`font-semibold ${getPerformanceColor(Number(model.accuracy) || 0, 'accuracy')}`}>
                      {((Number(model.accuracy) || 0) * 100).toFixed(1)}%
                    </div>
                    <Progress 
                      value={(Number(model.accuracy) || 0) * 100} 
                      className="h-1 mt-1"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Sharpe Ratio</div>
                    <div className={`font-semibold ${getPerformanceColor(Number(model.sharpeRatio) || 0, 'sharpe')}`}>
                      {(Number(model.sharpeRatio) || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Max Drawdown</div>
                    <div className={`font-semibold ${getPerformanceColor(Number(model.maxDrawdown) || 0, 'drawdown')}`}>
                      {((Number(model.maxDrawdown) || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Last Trained */}
                <div className="text-xs text-gray-500">
                  Last trained: {new Date(model.lastTrainedAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Show more button if there are more models */}
        {models.length > 5 && (
          <Button variant="outline" className="w-full">
            View All {models.length} Models
          </Button>
        )}

        {/* Last Update */}
        <div className="text-xs text-gray-500 text-center">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
