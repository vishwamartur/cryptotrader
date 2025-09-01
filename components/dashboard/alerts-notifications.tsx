'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { useErrorHandler } from '@/components/error-boundary';

interface Alert {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
  dismissed?: boolean;
}

interface AlertsNotificationsProps {
  alerts?: Alert[] | null; // Made optional and nullable to handle undefined/null cases
  theme: 'light' | 'dark';
  onDismiss: (alertId: string) => void;
  maxVisible?: number; // Allow customization of max visible alerts
  enableErrorLogging?: boolean; // Allow disabling error logging for testing
}

export function AlertsNotifications({
  alerts,
  theme,
  onDismiss,
  maxVisible = 5,
  enableErrorLogging = true
}: AlertsNotificationsProps) {
  const [visibleAlerts, setVisibleAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const handleError = useErrorHandler();

  // Stable error logging function to prevent dependency issues
  const logError = useCallback((error: Error) => {
    if (enableErrorLogging) {
      handleError(error);
    }
  }, [enableErrorLogging, handleError]);

  // Safe array filtering with comprehensive error handling
  useEffect(() => {
    const filterAndSetAlerts = (alertsArray: Alert[] | null | undefined) => {
      try {
        // Reset error state on successful operation
        setError(null);

        // Handle null, undefined, or non-array cases
        if (!alertsArray) {
          console.debug('AlertsNotifications: alerts is null or undefined, using empty array');
          setVisibleAlerts([]);
          return;
        }

        if (!Array.isArray(alertsArray)) {
          const errorMsg = `AlertsNotifications: alerts is not an array, received: ${typeof alertsArray}`;
          console.error(errorMsg, alertsArray);

          logError(new Error(errorMsg));

          setError('Invalid alerts data format');
          setVisibleAlerts([]);
          return;
        }

        // Filter out dismissed alerts and limit to maxVisible
        const filtered = alertsArray
          .filter((alert) => {
            // Additional safety check for each alert object
            if (!alert || typeof alert !== 'object') {
              console.warn('AlertsNotifications: Invalid alert object found:', alert);
              return false;
            }

            // Check if alert has required properties
            if (!alert.id || !alert.type || !alert.title) {
              console.warn('AlertsNotifications: Alert missing required properties:', alert);
              return false;
            }

            return !alert.dismissed;
          })
          .slice(0, maxVisible);

        setVisibleAlerts(filtered);
        console.debug(`AlertsNotifications: Filtered ${alertsArray.length} alerts to ${filtered.length} visible alerts`);

      } catch (error) {
        const errorMsg = `AlertsNotifications: Error filtering alerts: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg, error);

        logError(error instanceof Error ? error : new Error(errorMsg));

        setError('Failed to process alerts');
        setVisibleAlerts([]);
      }
    };

    filterAndSetAlerts(alerts);
  }, [alerts, maxVisible, logError]);

  // Safe dismiss handler with error handling
  const handleDismiss = useCallback((alertId: string) => {
    try {
      if (!alertId || typeof alertId !== 'string') {
        console.warn('AlertsNotifications: Invalid alert ID for dismiss:', alertId);
        return;
      }

      console.debug(`AlertsNotifications: Dismissing alert ${alertId}`);
      onDismiss(alertId);

      // Optimistically remove from visible alerts
      setVisibleAlerts(prev => prev.filter(alert => alert.id !== alertId));

    } catch (error) {
      const errorMsg = `AlertsNotifications: Error dismissing alert ${alertId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg, error);

      logError(error instanceof Error ? error : new Error(errorMsg));
    }
  }, [onDismiss, logError]);

  const getAlertIcon = useCallback((type: string) => {
    try {
      switch (type) {
        case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
        case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
        case 'info': return <Info className="w-4 h-4 text-blue-500" />;
        default:
          console.debug(`AlertsNotifications: Unknown alert type: ${type}, using default icon`);
          return <Info className="w-4 h-4 text-blue-500" />;
      }
    } catch (error) {
      console.warn('AlertsNotifications: Error getting alert icon:', error);
      return <Info className="w-4 h-4 text-blue-500" />;
    }
  }, []);

  const getAlertColor = useCallback((type: string) => {
    try {
      switch (type) {
        case 'success': return 'border-green-500/20 bg-green-500/5';
        case 'warning': return 'border-yellow-500/20 bg-yellow-500/5';
        case 'error': return 'border-red-500/20 bg-red-500/5';
        case 'info': return 'border-blue-500/20 bg-blue-500/5';
        default:
          console.debug(`AlertsNotifications: Unknown alert type: ${type}, using default color`);
          return 'border-blue-500/20 bg-blue-500/5';
      }
    } catch (error) {
      console.warn('AlertsNotifications: Error getting alert color:', error);
      return 'border-blue-500/20 bg-blue-500/5';
    }
  }, []);

  // Safe timestamp formatting
  const formatTimestamp = useCallback((timestamp: number): string => {
    try {
      if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) {
        console.debug('AlertsNotifications: Invalid timestamp:', timestamp);
        return 'Invalid time';
      }

      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        console.debug('AlertsNotifications: Invalid date from timestamp:', timestamp);
        return 'Invalid time';
      }

      return date.toLocaleTimeString('en-US', {
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.warn('AlertsNotifications: Error formatting timestamp:', error);
      return 'Unknown time';
    }
  }, []);

  // Show error state if there's an error
  if (error) {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-sm">
        <Card className="border-red-500/20 bg-red-500/5 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="font-medium text-sm text-red-700 dark:text-red-300">
                  Alerts Error
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Don't render if no visible alerts
  if (!visibleAlerts || visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {visibleAlerts.map((alert) => {
        // Additional safety check for each alert during render
        if (!alert || !alert.id) {
          console.warn('AlertsNotifications: Skipping invalid alert during render:', alert);
          return null;
        }

        return (
          <Card
            key={alert.id}
            className={`${getAlertColor(alert.type || 'info')} ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            } shadow-lg animate-in slide-in-from-right duration-300`}
          >
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                {getAlertIcon(alert.type || 'info')}
                <div className="flex-1 space-y-1">
                  <div className="font-medium text-sm">
                    {alert.title || 'Untitled Alert'}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    {alert.message || 'No message'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimestamp(alert.timestamp)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismiss(alert.id)}
                  className="h-6 w-6 p-0"
                  aria-label={`Dismiss ${alert.title || 'alert'}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
