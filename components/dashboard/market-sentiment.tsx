'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface MarketSentimentProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

export function MarketSentiment({ theme }: MarketSentimentProps) {
  const sentiment = {
    overall: 65, // 0-100 scale
    fear: 35,
    greed: 65,
    volume: 78,
    volatility: 42
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Market Sentiment</h3>
      
      <Card className={`${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <CardContent className="p-4 space-y-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-500">{sentiment.overall}</div>
            <div className="text-sm text-gray-500">Bullish Sentiment</div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Fear & Greed</span>
                <span>{sentiment.greed}%</span>
              </div>
              <Progress value={sentiment.greed} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Volume</span>
                <span>{sentiment.volume}%</span>
              </div>
              <Progress value={sentiment.volume} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Volatility</span>
                <span>{sentiment.volatility}%</span>
              </div>
              <Progress value={sentiment.volatility} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
