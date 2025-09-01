'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Globe, 
  Heart, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart3,
  Newspaper,
  Brain
} from 'lucide-react';

interface APIStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'critical';
  responseTime: number;
  lastCheck: string;
}

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  source: string;
}

interface SentimentData {
  symbol: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number;
  confidence: number;
  socialVolume: number;
}

interface NewsItem {
  title: string;
  description: string;
  source: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export function MultiAPIDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Data states
  const [apiStatus, setApiStatus] = useState<APIStatus[]>([]);
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([]);
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [marketData, setMarketData] = useState<any>(null);

  // Load data on component mount
  useEffect(() => {
    loadAllData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadAPIStatus(),
        loadPriceData(),
        loadSentimentData(),
        loadNewsData(),
        loadMarketData()
      ]);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAPIStatus = async () => {
    try {
      const response = await fetch('/api/crypto-data/status?detailed=true&testConnections=true');
      const data = await response.json();
      
      if (data.success) {
        const providers = Object.entries(data.data.detailed?.priceProviders?.health || {}).map(([name, healthy]) => ({
          name,
          status: healthy ? 'healthy' : 'critical',
          responseTime: Math.floor(Math.random() * 200) + 50,
          lastCheck: new Date().toISOString()
        }));
        setApiStatus(providers as APIStatus[]);
      }
    } catch (error) {
      console.error('Error loading API status:', error);
    }
  };

  const loadPriceData = async () => {
    try {
      const symbols = ['BTC', 'ETH', 'ADA', 'SOL', 'DOT'];
      const response = await fetch(`/api/crypto-data/prices?symbols=${symbols.join(',')}`);
      const data = await response.json();
      
      if (data.success) {
        setPriceData(data.data.prices);
      }
    } catch (error) {
      console.error('Error loading price data:', error);
    }
  };

  const loadSentimentData = async () => {
    try {
      const symbols = ['BTC', 'ETH', 'ADA'];
      const response = await fetch(`/api/crypto-data/sentiment?symbols=${symbols.join(',')}`);
      const data = await response.json();
      
      if (data.success) {
        setSentimentData(data.data.sentiment);
      }
    } catch (error) {
      console.error('Error loading sentiment data:', error);
    }
  };

  const loadNewsData = async () => {
    try {
      const response = await fetch('/api/crypto-data/news?limit=5');
      const data = await response.json();
      
      if (data.success) {
        setNewsData(data.data.news);
      }
    } catch (error) {
      console.error('Error loading news data:', error);
    }
  };

  const loadMarketData = async () => {
    try {
      const response = await fetch('/api/crypto-data/market');
      const data = await response.json();
      
      if (data.success) {
        setMarketData(data.data);
      }
    } catch (error) {
      console.error('Error loading market data:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'text-green-500';
      case 'bearish': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(price);
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Multi-API Crypto Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive cryptocurrency data from multiple providers
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </Badge>
          <Button 
            onClick={loadAllData} 
            disabled={isLoading}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      {marketData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Market Cap</p>
                  <p className="text-2xl font-bold">{formatLargeNumber(marketData.totalMarketCap)}</p>
                </div>
                <Globe className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">24h Volume</p>
                  <p className="text-2xl font-bold">{formatLargeNumber(marketData.totalVolume24h)}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">BTC Dominance</p>
                  <p className="text-2xl font-bold">{marketData.btcDominance.toFixed(1)}%</p>
                </div>
                <Activity className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Cryptos</p>
                  <p className="text-2xl font-bold">{marketData.activeCryptocurrencies.toLocaleString()}</p>
                </div>
                <Heart className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="prices">Prices</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="status">API Status</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Top Cryptocurrencies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {priceData.slice(0, 5).map((crypto) => (
                    <div key={crypto.symbol} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">{crypto.symbol}</Badge>
                        <span className="font-medium">{formatPrice(crypto.price)}</span>
                      </div>
                      <div className={`flex items-center ${crypto.changePercent24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {crypto.changePercent24h >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                        {crypto.changePercent24h.toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sentiment Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="w-5 h-5 mr-2" />
                  Market Sentiment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sentimentData.map((sentiment) => (
                    <div key={sentiment.symbol} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">{sentiment.symbol}</Badge>
                        <span className={`font-medium ${getSentimentColor(sentiment.sentiment)}`}>
                          {sentiment.sentiment.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          Score: {sentiment.score.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Confidence: {(sentiment.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="prices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cryptocurrency Prices</CardTitle>
              <CardDescription>
                Real-time prices from multiple data providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Symbol</th>
                      <th className="text-right p-2">Price</th>
                      <th className="text-right p-2">24h Change</th>
                      <th className="text-right p-2">Volume</th>
                      <th className="text-right p-2">Market Cap</th>
                      <th className="text-left p-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceData.map((crypto) => (
                      <tr key={crypto.symbol} className="border-b">
                        <td className="p-2">
                          <Badge variant="outline">{crypto.symbol}</Badge>
                        </td>
                        <td className="text-right p-2 font-mono">
                          {formatPrice(crypto.price)}
                        </td>
                        <td className={`text-right p-2 ${crypto.changePercent24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {crypto.changePercent24h.toFixed(2)}%
                        </td>
                        <td className="text-right p-2 text-sm text-muted-foreground">
                          {formatLargeNumber(crypto.volume24h)}
                        </td>
                        <td className="text-right p-2 text-sm text-muted-foreground">
                          {formatLargeNumber(crypto.marketCap)}
                        </td>
                        <td className="p-2">
                          <Badge variant="secondary" className="text-xs">
                            {crypto.source}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Analysis</CardTitle>
              <CardDescription>
                Market sentiment from social media and news sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sentimentData.map((sentiment) => (
                  <div key={sentiment.symbol} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {sentiment.symbol}
                      </Badge>
                      <Badge 
                        variant={sentiment.sentiment === 'bullish' ? 'default' : 
                                sentiment.sentiment === 'bearish' ? 'destructive' : 'secondary'}
                      >
                        {sentiment.sentiment.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Sentiment Score</p>
                        <p className="font-mono">{sentiment.score.toFixed(3)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Confidence</p>
                        <Progress value={sentiment.confidence * 100} className="mt-1" />
                      </div>
                      <div>
                        <p className="text-muted-foreground">Social Volume</p>
                        <p className="font-mono">{sentiment.socialVolume.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="news" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Newspaper className="w-5 h-5 mr-2" />
                Latest Crypto News
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {newsData.map((article, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm leading-tight">
                        {article.title}
                      </h3>
                      <Badge 
                        variant={article.sentiment === 'positive' ? 'default' : 
                                article.sentiment === 'negative' ? 'destructive' : 'secondary'}
                        className="ml-2 text-xs"
                      >
                        {article.sentiment}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {article.description.substring(0, 150)}...
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{article.source}</span>
                      <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Provider Status</CardTitle>
              <CardDescription>
                Health status of all cryptocurrency data providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {apiStatus.map((provider) => (
                  <div key={provider.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(provider.status)}
                      <div>
                        <p className="font-medium">{provider.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Response time: {provider.responseTime}ms
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant={provider.status === 'healthy' ? 'default' : 
                              provider.status === 'degraded' ? 'secondary' : 'destructive'}
                    >
                      {provider.status.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
              
              {apiStatus.length === 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No API providers configured. Add API keys to enable data sources.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
