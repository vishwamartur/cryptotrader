'use client';

import React from 'react';
import { AlertsNotifications } from './alerts-notifications';
import { ErrorBoundary } from '@/components/error-boundary';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Alert {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
  dismissed?: boolean;
}

interface AlertsNotificationsWrapperProps {
  alerts?: Alert[] | null;
  theme: 'light' | 'dark';
  onDismiss: (alertId: string) => void;
  maxVisible?: number;
  enableErrorLogging?: boolean;
}

/**
 * Error Fallback Component for Alerts Notifications
 */
const AlertsErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => {
  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Card className="border-red-500/20 bg-red-500/5 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="font-medium text-sm text-red-700 dark:text-red-300">
                Alerts System Error
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">
                {error.message || 'Failed to load alerts notifications'}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={retry}
                  className="h-7 px-2 text-xs border-red-200 text-red-700 hover:bg-red-50"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Enhanced Alerts Notifications Wrapper with Error Boundary
 * Provides comprehensive error handling for the alerts notifications component
 */
export function AlertsNotificationsWrapper({
  alerts,
  theme,
  onDismiss,
  maxVisible = 5,
  enableErrorLogging = true
}: AlertsNotificationsWrapperProps) {
  
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('AlertsNotificationsWrapper: Error caught by boundary:', error, errorInfo);
    
    // Log to monitoring system if available
    if (enableErrorLogging && typeof window !== 'undefined') {
      try {
        fetch('/api/health/detailed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'alerts_notifications_error',
            error: {
              message: error.message,
              stack: error.stack,
              name: error.name,
              componentStack: errorInfo.componentStack
            },
            context: {
              alertsCount: Array.isArray(alerts) ? alerts.length : 'not-array',
              alertsType: typeof alerts,
              theme,
              maxVisible
            },
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
          })
        }).catch(monitoringError => {
          console.warn('Failed to log alerts error to monitoring:', monitoringError);
        });
      } catch (monitoringError) {
        console.warn('Error logging alerts error to monitoring system:', monitoringError);
      }
    }
  };

  return (
    <ErrorBoundary
      fallback={AlertsErrorFallback}
      onError={handleError}
    >
      <AlertsNotifications
        alerts={alerts}
        theme={theme}
        onDismiss={onDismiss}
        maxVisible={maxVisible}
        enableErrorLogging={enableErrorLogging}
      />
    </ErrorBoundary>
  );
}

/**
 * Safe Alerts Notifications Hook
 * Provides additional safety layer for alerts data
 */
export function useSafeAlerts(alerts: Alert[] | null | undefined): {
  safeAlerts: Alert[];
  hasValidAlerts: boolean;
  alertsError: string | null;
} {
  const [alertsError, setAlertsError] = React.useState<string | null>(null);

  const safeAlerts = React.useMemo(() => {
    try {
      setAlertsError(null);

      if (!alerts) {
        return [];
      }

      if (!Array.isArray(alerts)) {
        setAlertsError(`Invalid alerts data type: ${typeof alerts}`);
        return [];
      }

      // Filter and validate alerts
      const validAlerts = alerts.filter((alert, index) => {
        if (!alert || typeof alert !== 'object') {
          console.warn('useSafeAlerts: Invalid alert at index %d:', index, alert);
          return false;
        }

        if (!alert.id || typeof alert.id !== 'string') {
          console.warn('useSafeAlerts: Alert missing valid ID at index %d:', index, alert);
          return false;
        }

        if (!alert.type || !['success', 'warning', 'error', 'info'].includes(alert.type)) {
          console.warn('useSafeAlerts: Alert has invalid type at index %d:', index, alert);
          return false;
        }

        if (!alert.title || typeof alert.title !== 'string') {
          console.warn('useSafeAlerts: Alert missing valid title at index %d:', index, alert);
          return false;
        }

        if (!alert.timestamp || typeof alert.timestamp !== 'number' || isNaN(alert.timestamp)) {
          console.warn('useSafeAlerts: Alert has invalid timestamp at index %d:', index, alert);
          return false;
        }

        return true;
      });

      if (validAlerts.length !== alerts.length) {
        console.warn('useSafeAlerts: Filtered %d invalid alerts', alerts.length - validAlerts.length);
      }

      return validAlerts;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error processing alerts';
      console.error('useSafeAlerts: Error processing alerts:', error);
      setAlertsError(errorMessage);
      return [];
    }
  }, [alerts]);

  return {
    safeAlerts,
    hasValidAlerts: safeAlerts.length > 0,
    alertsError
  };
}

/**
 * Alerts Notifications with Built-in Safety
 * Combines the wrapper and hook for maximum safety
 */
export function SafeAlertsNotifications({
  alerts,
  theme,
  onDismiss,
  maxVisible = 5,
  enableErrorLogging = true
}: AlertsNotificationsWrapperProps) {
  const { safeAlerts, alertsError } = useSafeAlerts(alerts);

  // Show error state if there's a processing error
  if (alertsError) {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-sm">
        <Card className="border-yellow-500/20 bg-yellow-500/5 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="font-medium text-sm text-yellow-700 dark:text-yellow-300">
                  Alerts Processing Warning
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400">
                  {alertsError}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AlertsNotificationsWrapper
      alerts={safeAlerts}
      theme={theme}
      onDismiss={onDismiss}
      maxVisible={maxVisible}
      enableErrorLogging={enableErrorLogging}
    />
  );
}

export default AlertsNotificationsWrapper;
