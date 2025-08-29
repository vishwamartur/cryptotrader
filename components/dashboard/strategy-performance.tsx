'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';

interface StrategyPerformanceProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

export function StrategyPerformance({ theme }: StrategyPerformanceProps) {
  const strategies = [
    {
      name: 'Moving Average Crossover',
      winRate: 68,
      totalTrades: 45,
      pnl: 1250.50,
      status: 'active'
    },
    {
      name: 'Mean Reversion',
      winRate: 72,
      totalTrades: 32,
      pnl: 890.25,
      status: 'active'
    },
    {
      name: 'Momentum',
      winRate: 55,
      totalTrades: 28,
      pnl: -125.75,
      status: 'paused'
    }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Strategy Performance</h3>
      
      <div className="space-y-3">
        {strategies.map((strategy, index) => (
          <Card key={index} className={`${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{strategy.name}</span>
                  <Badge variant={strategy.status === 'active' ? 'default' : 'secondary'}>
                    {strategy.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Win Rate</div>
                    <div className="font-medium">{strategy.winRate}%</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Trades</div>
                    <div className="font-medium">{strategy.totalTrades}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">P&L</div>
                    <div className={`font-medium ${
                      strategy.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {strategy.pnl >= 0 ? '+' : ''}${strategy.pnl.toFixed(2)}
                    </div>
                  </div>
                </div>
                
                <Progress value={strategy.winRate} className="h-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
