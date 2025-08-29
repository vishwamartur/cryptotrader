'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Square, 
  AlertTriangle, 
  RefreshCw, 
  Download,
  Settings,
  Zap
} from 'lucide-react';

interface QuickActionsProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

export function QuickActions({ theme }: QuickActionsProps) {
  const [isEmergencyStop, setIsEmergencyStop] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleEmergencyStop = async () => {
    setIsEmergencyStop(true);
    // Simulate emergency stop
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsEmergencyStop(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const handleExport = () => {
    // Export functionality
    console.log('Exporting data...');
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Quick Actions</h3>
      
      <Card className={`${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleEmergencyStop}
              disabled={isEmergencyStop}
            >
              <Square className="w-4 h-4 mr-2" />
              {isEmergencyStop ? 'Stopping...' : 'Emergency Stop'}
            </Button>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
            </Button>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={handleExport}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
            
            <Button
              variant="ghost"
              className="w-full"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className={`${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">System Status</h4>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Trading Engine</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Risk Manager</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">AI Engine</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>Standby</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
