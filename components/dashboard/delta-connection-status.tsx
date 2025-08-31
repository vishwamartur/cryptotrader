'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface ConnectionStatus {
  success: boolean;
  message: string;
  data?: {
    apiKeyMasked: string;
    balanceCount: number;
    productsCount: number;
    timestamp: string;
  };
  error?: string;
  details?: string;
  code?: string;
}

export function DeltaConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const testConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/delta/test-connection');
      const data = await response.json();
      setStatus(data);
      setLastChecked(new Date());
    } catch (error) {
      setStatus({
        success: false,
        message: 'Failed to test connection',
        error: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const getStatusIcon = () => {
    if (loading) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (!status) return <AlertCircle className="h-4 w-4 text-gray-500" />;
    if (status.success) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = () => {
    if (loading) return <Badge variant="outline">Testing...</Badge>;
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    if (status.success) return <Badge className="bg-green-100 text-green-800">Connected</Badge>;
    
    // Different badges for different error types
    switch (status.code) {
      case 'MISSING_CREDENTIALS':
        return <Badge className="bg-yellow-100 text-yellow-800">Not Configured</Badge>;
      case 'INVALID_CREDENTIALS':
        return <Badge className="bg-red-100 text-red-800">Invalid Credentials</Badge>;
      case 'INSUFFICIENT_PERMISSIONS':
        return <Badge className="bg-orange-100 text-orange-800">Insufficient Permissions</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-800">Connection Failed</Badge>;
    }
  };

  const getHelpMessage = () => {
    if (!status || status.success) return null;
    
    switch (status.code) {
      case 'MISSING_CREDENTIALS':
        return (
          <div className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
            <p className="font-medium">API credentials not configured</p>
            <p>Please set DELTA_API_KEY and DELTA_API_SECRET environment variables.</p>
          </div>
        );
      case 'INVALID_CREDENTIALS':
        return (
          <div className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">
            <p className="font-medium">Invalid API credentials</p>
            <p>Please verify your API key and secret are correct.</p>
            <a 
              href="https://www.delta.exchange/app/account/api" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center mt-2 text-blue-600 hover:text-blue-800"
            >
              Manage API Keys <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </div>
        );
      case 'INSUFFICIENT_PERMISSIONS':
        return (
          <div className="text-sm text-orange-700 bg-orange-50 p-3 rounded-lg">
            <p className="font-medium">Insufficient permissions</p>
            <p>Please enable trading permissions for your API key.</p>
          </div>
        );
      default:
        return (
          <div className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">
            <p className="font-medium">Connection failed</p>
            <p>{status.details || status.error}</p>
          </div>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          {getStatusIcon()}
          <span>Delta Exchange</span>
          {getStatusBadge()}
        </CardTitle>
        <CardDescription>
          API connection status and credentials verification
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.success && status.data && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">API Key:</span>
                <div className="font-mono text-xs">{status.data.apiKeyMasked}</div>
              </div>
              <div>
                <span className="text-gray-500">Balances:</span>
                <div className="font-semibold">{status.data.balanceCount}</div>
              </div>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Products Available:</span>
              <span className="ml-2 font-semibold">{status.data.productsCount}</span>
            </div>
          </div>
        )}

        {getHelpMessage()}

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-500">
            {lastChecked && `Last checked: ${lastChecked.toLocaleTimeString()}`}
          </div>
          <Button
            onClick={testConnection}
            disabled={loading}
            size="sm"
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-3 w-3" />
                Test Connection
              </>
            )}
          </Button>
        </div>

        {status?.success && (
          <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
            ✅ Ready for live trading with Delta Exchange
          </div>
        )}
      </CardContent>
    </Card>
  );
}
