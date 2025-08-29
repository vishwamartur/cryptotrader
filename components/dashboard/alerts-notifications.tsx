'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  X, 
  AlertTriangle, 
  Info, 
  CheckCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface Alert {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
  dismissed?: boolean;
}

interface AlertsNotificationsProps {
  alerts: Alert[];
  theme: 'light' | 'dark';
  onDismiss: (alertId: string) => void;
}

export function AlertsNotifications({ alerts, theme, onDismiss }: AlertsNotificationsProps) {
  const [visibleAlerts, setVisibleAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    setVisibleAlerts(alerts.filter(alert => !alert.dismissed).slice(0, 5));
  }, [alerts]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-green-500/20 bg-green-500/5';
      case 'warning': return 'border-yellow-500/20 bg-yellow-500/5';
      case 'error': return 'border-red-500/20 bg-red-500/5';
      default: return 'border-blue-500/20 bg-blue-500/5';
    }
  };

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {visibleAlerts.map((alert) => (
        <Card
          key={alert.id}
          className={`${getAlertColor(alert.type)} ${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } shadow-lg animate-in slide-in-from-right duration-300`}
        >
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              {getAlertIcon(alert.type)}
              <div className="flex-1 space-y-1">
                <div className="font-medium text-sm">{alert.title}</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  {alert.message}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDismiss(alert.id)}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
