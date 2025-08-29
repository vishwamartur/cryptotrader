'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useRealtimeData } from '@/hooks/use-realtime-data';

interface OrderExecutionProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

export function OrderExecution({ theme }: OrderExecutionProps) {
  const { orderExecutions } = useRealtimeData();
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'filled': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'rejected': return <XCircle className="w-3 h-3 text-red-500" />;
      case 'pending': return <Clock className="w-3 h-3 text-yellow-500" />;
      default: return <AlertCircle className="w-3 h-3 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filled': return 'bg-green-500/10 text-green-500';
      case 'rejected': return 'bg-red-500/10 text-red-500';
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const avgLatency = orderExecutions.length > 0 
    ? orderExecutions.reduce((sum, order) => sum + order.latency, 0) / orderExecutions.length 
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Order Execution</h3>
        <Badge variant="outline">
          Avg: {avgLatency.toFixed(0)}ms
        </Badge>
      </div>
      
      <Card className={`${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <CardContent className="p-4">
          <div className="space-y-3">
            {orderExecutions.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                No recent orders
              </div>
            ) : (
              orderExecutions.slice(0, 5).map((order) => (
                <div key={order.orderId} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(order.status)}
                    <div>
                      <div className="text-sm font-medium">
                        {order.side.toUpperCase()} {order.symbol.replace('-', '/')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.size} @ ${order.price}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                    <div className="text-xs text-gray-500 mt-1">
                      {order.latency.toFixed(0)}ms
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
