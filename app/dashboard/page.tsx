'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

interface AIAnalysis {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  positionSize: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  timestamp: number;
}

interface Strategy {
  name: string;
  description: string;
  category: string;
  riskLevel: string;
  complexity: string;
}

export default function DashboardPage() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch market data
  const fetchMarketData = async () => {
    try {
      const response = await fetch('/api/market/realtime/BTC-USD');
      if (!response.ok) throw new Error('Failed to fetch market data');
      const result = await response.json();
      setMarketData(result.data);
    } catch (err) {
      console.error('Market data error:', err);
      setError('Failed to fetch market data');
    }
  };

  // Fetch AI analysis
  const fetchAIAnalysis = async () => {
    if (!marketData) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketData: [marketData],
          positions: [],
          balance: 10000
        })
      });
      
      if (!response.ok) throw new Error('Failed to get AI analysis');
      const result = await response.json();
      setAiAnalysis(result.data);
    } catch (err) {
      console.error('AI analysis error:', err);
      setError('Failed to get AI analysis');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available strategies
  const fetchStrategies = async () => {
    try {
      const response = await fetch('/api/strategies/list');
      if (!response.ok) throw new Error('Failed to fetch strategies');
      const result = await response.json();
      setStrategies(result.data.strategies);
    } catch (err) {
      console.error('Strategies error:', err);
      setError('Failed to fetch strategies');
    }
  };

  useEffect(() => {
    fetchMarketData();
    fetchStrategies();
  }, []);

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'BUY': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'SELL': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY': return 'bg-green-100 text-green-800';
      case 'SELL': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">CryptoTrader Dashboard</h1>
        <Badge variant="outline">MVP Demo</Badge>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Market Data Card */}
        <Card>
          <CardHeader>
            <CardTitle>Market Data</CardTitle>
            <CardDescription>Real-time BTC-USD price</CardDescription>
          </CardHeader>
          <CardContent>
            {marketData ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold">${marketData.price.toLocaleString()}</div>
                <div className={`flex items-center space-x-2 ${marketData.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {marketData.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span>{marketData.change >= 0 ? '+' : ''}{marketData.change.toFixed(2)} ({marketData.changePercent.toFixed(2)}%)</span>
                </div>
                <div className="text-sm text-gray-500">
                  Volume: {marketData.volume.toLocaleString()}
                </div>
                <Button onClick={fetchMarketData} size="sm" className="w-full">
                  Refresh Data
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Analysis Card */}
        <Card>
          <CardHeader>
            <CardTitle>AI Analysis</CardTitle>
            <CardDescription>Claude 3.5 Sonnet trading recommendation</CardDescription>
          </CardHeader>
          <CardContent>
            {aiAnalysis ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  {getSignalIcon(aiAnalysis.signal)}
                  <Badge className={getSignalColor(aiAnalysis.signal)}>
                    {aiAnalysis.signal}
                  </Badge>
                  <span className="text-sm">({Math.round(aiAnalysis.confidence * 100)}% confidence)</span>
                </div>
                <div className="text-sm text-gray-600">
                  {aiAnalysis.reasoning}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Entry: ${aiAnalysis.entryPrice.toFixed(2)}</div>
                  <div>Size: ${aiAnalysis.positionSize}</div>
                  <div>Stop: ${aiAnalysis.stopLoss.toFixed(2)}</div>
                  <div>Target: ${aiAnalysis.takeProfit.toFixed(2)}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-500">
                  Get AI-powered trading analysis
                </div>
                <Button 
                  onClick={fetchAIAnalysis} 
                  disabled={loading || !marketData}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Get AI Analysis'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Strategies Card */}
        <Card>
          <CardHeader>
            <CardTitle>Available Strategies</CardTitle>
            <CardDescription>Quantitative trading strategies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {strategies.map((strategy) => (
                <div key={strategy.name} className="p-2 border rounded-lg">
                  <div className="font-medium text-sm">{strategy.name}</div>
                  <div className="text-xs text-gray-500">{strategy.category}</div>
                  <Badge variant="outline" className="text-xs mt-1">
                    {strategy.riskLevel}
                  </Badge>
                </div>
              ))}
              {strategies.length === 0 && (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Status */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Status</CardTitle>
          <CardDescription>Current portfolio overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">$12,500</div>
              <div className="text-sm text-gray-500">Total Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">+$2,500</div>
              <div className="text-sm text-gray-500">Total P&L</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">+$150</div>
              <div className="text-sm text-gray-500">Daily P&L</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">3</div>
              <div className="text-sm text-gray-500">Positions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>API endpoints and system health</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">Market Data</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">AI Engine</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">Strategies</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">Portfolio</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
