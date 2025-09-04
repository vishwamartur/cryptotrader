'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Target,
  X
} from 'lucide-react';
import { useWebSocketPortfolio } from '@/hooks/use-websocket-portfolio';
import { useWebSocketMarketData } from '@/hooks/use-websocket-market-data';

interface TradingPositionsProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

export function TradingPositions({ theme, autoRefresh, refreshInterval }: TradingPositionsProps) {
  // Use WebSocket-based portfolio data for real-time position updates
  const portfolio = useWebSocketPortfolio({
    autoConnect: true,
    environment: 'production',
    enableMockFallback: true
  });

  // Use WebSocket-based market data for real-time pricing
  const marketData = useWebSocketMarketData({
    autoConnect: true,
    subscribeToAllSymbols: true,
    channels: ['v2/ticker']
  });

  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  if (!portfolio?.positions || portfolio.positions.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Active Positions</h3>
        <Card className={`${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">No active positions</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Active Positions</h3>
        <Badge variant="outline">{portfolio.positions.length} positions</Badge>
      </div>
      
      <div className="space-y-3">
        {portfolio.positions.map((position, index) => (
          <Card key={index} className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
            selectedPosition === position.symbol ? 'ring-2 ring-blue-500' : ''
          } ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
          onClick={() => setSelectedPosition(selectedPosition === position.symbol ? null : position.symbol)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">{position.symbol.replace('-', '/')}</span>
                    <Badge variant={position.side === 'long' ? 'default' : 'secondary'}>
                      {position.side.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500">
                    Size: {position.size.toFixed(4)} @ ${position.entryPrice.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Current: ${position.currentPrice.toFixed(2)}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-lg font-semibold ${
                    position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
                  </div>
                  <div className={`text-sm ${
                    position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    ({position.unrealizedPnL >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%)
                  </div>
                </div>
              </div>
              
              {selectedPosition === position.symbol && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Market Value:</span>
                      <div className="font-medium">${(position.currentPrice * position.size).toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Cost Basis:</span>
                      <div className="font-medium">${(position.entryPrice * position.size).toFixed(2)}</div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Target className="w-3 h-3 mr-1" />
                      Modify
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1">
                      <X className="w-3 h-3 mr-1" />
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
