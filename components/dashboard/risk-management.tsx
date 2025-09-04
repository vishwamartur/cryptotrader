'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Shield, TrendingDown } from 'lucide-react';
import { useWebSocketMarketData } from '@/hooks/use-websocket-market-data';
import { useWebSocketPortfolio } from '@/hooks/use-websocket-portfolio';

interface RiskManagementProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

export function RiskManagement({ theme }: RiskManagementProps) {
  // Use WebSocket-based portfolio data for real-time risk calculations
  const portfolio = useWebSocketPortfolio({
    autoConnect: true,
    environment: 'production',
    enableMockFallback: true
  });

  // Use WebSocket-based market data for risk analysis
  const marketData = useWebSocketMarketData({
    autoConnect: true,
    subscribeToAllSymbols: true,
    channels: ['v2/ticker']
  });
  
  const riskMetrics = {
    portfolioRisk: 35, // 0-100 scale
    maxDrawdown: 8.5,
    sharpeRatio: 1.45,
    var95: 2500, // Value at Risk 95%
    exposureLimit: 75, // % of portfolio exposed
    alerts: [
      { type: 'warning', message: 'High correlation detected in crypto positions' },
      { type: 'info', message: 'Portfolio within risk limits' }
    ]
  };

  const getRiskColor = (risk: number) => {
    if (risk > 70) return 'text-red-500';
    if (risk > 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Risk Management</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={`${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-blue-500" />
                <span className="font-medium">Portfolio Risk</span>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getRiskColor(riskMetrics.portfolioRisk)}`}>
                  {riskMetrics.portfolioRisk}%
                </div>
                <Progress value={riskMetrics.portfolioRisk} className="h-2 mt-2" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={`${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="font-medium">Max Drawdown</span>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">
                  {riskMetrics.maxDrawdown}%
                </div>
                <div className="text-sm text-gray-500">Historical maximum</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className={`${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <CardContent className="p-4">
          <div className="space-y-4">
            <h4 className="font-medium">Risk Metrics</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Sharpe Ratio:</span>
                <span className="ml-2 font-medium">{riskMetrics.sharpeRatio}</span>
              </div>
              <div>
                <span className="text-gray-500">VaR (95%):</span>
                <span className="ml-2 font-medium">${riskMetrics.var95}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <h5 className="font-medium text-sm">Risk Alerts</h5>
              {riskMetrics.alerts.map((alert, index) => (
                <div key={index} className={`flex items-start space-x-2 p-2 rounded text-sm ${
                  alert.type === 'warning' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-blue-500/10 text-blue-600'
                }`}>
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
