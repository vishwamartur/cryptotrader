'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Settings,
  Maximize2,
  Minimize2,
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  Moon,
  Sun,
  Bell,
  BellOff
} from 'lucide-react';

// Import dashboard components
import { LivePriceFeeds } from '@/components/dashboard/live-price-feeds';
import { PortfolioTracker } from '@/components/dashboard/portfolio-tracker';
import { TradingPositions } from '@/components/dashboard/trading-positions';
import { MarketSentiment } from '@/components/dashboard/market-sentiment';
import { AITradingSignals } from '@/components/dashboard/ai-trading-signals';
import { SystemHealth } from '@/components/dashboard/system-health';
import { StrategyPerformance } from '@/components/dashboard/strategy-performance';
import { RiskManagement } from '@/components/dashboard/risk-management';
import { OrderExecution } from '@/components/dashboard/order-execution';
import { PerformanceCharts } from '@/components/dashboard/performance-charts';
import { AlertsNotifications } from '@/components/dashboard/alerts-notifications';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { MLModelsOverview } from '@/components/dashboard/ml-models-overview';
import { MLPredictionsFeed } from '@/components/dashboard/ml-predictions-feed';
import { DeltaConnectionStatus } from '@/components/dashboard/delta-connection-status';

// Types
interface DashboardWidget {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  size: 'small' | 'medium' | 'large';
  category: 'realtime' | 'monitoring' | 'analytics' | 'controls';
  priority: number;
}

// Default widget configuration
const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: 'live-prices',
    title: 'Live Price Feeds',
    component: LivePriceFeeds,
    size: 'large',
    category: 'realtime',
    priority: 1
  },
  {
    id: 'portfolio',
    title: 'Portfolio Tracker',
    component: PortfolioTracker,
    size: 'medium',
    category: 'monitoring',
    priority: 2
  },
  {
    id: 'positions',
    title: 'Trading Positions',
    component: TradingPositions,
    size: 'medium',
    category: 'monitoring',
    priority: 3
  },
  {
    id: 'ai-signals',
    title: 'AI Trading Signals',
    component: AITradingSignals,
    size: 'medium',
    category: 'analytics',
    priority: 4
  },
  {
    id: 'market-sentiment',
    title: 'Market Sentiment',
    component: MarketSentiment,
    size: 'small',
    category: 'analytics',
    priority: 5
  },
  {
    id: 'system-health',
    title: 'System Health',
    component: SystemHealth,
    size: 'small',
    category: 'monitoring',
    priority: 6
  },
  {
    id: 'strategy-performance',
    title: 'Strategy Performance',
    component: StrategyPerformance,
    size: 'medium',
    category: 'analytics',
    priority: 7
  },
  {
    id: 'risk-management',
    title: 'Risk Management',
    component: RiskManagement,
    size: 'medium',
    category: 'monitoring',
    priority: 8
  },
  {
    id: 'order-execution',
    title: 'Order Execution',
    component: OrderExecution,
    size: 'small',
    category: 'controls',
    priority: 9
  },
  {
    id: 'performance-charts',
    title: 'Performance Charts',
    component: PerformanceCharts,
    size: 'large',
    category: 'analytics',
    priority: 10
  },
  {
    id: 'alerts',
    title: 'Alerts & Notifications',
    component: AlertsNotifications,
    size: 'small',
    category: 'monitoring',
    priority: 11
  },
  {
    id: 'quick-actions',
    title: 'Quick Actions',
    component: QuickActions,
    size: 'small',
    category: 'controls',
    priority: 12
  },
  {
    id: 'ml-models',
    title: 'ML Models Overview',
    component: MLModelsOverview,
    size: 'medium',
    category: 'analytics',
    priority: 13
  },
  {
    id: 'ml-predictions',
    title: 'ML Predictions Feed',
    component: MLPredictionsFeed,
    size: 'medium',
    category: 'realtime',
    priority: 14
  },
  {
    id: 'delta-connection',
    title: 'Delta Exchange Status',
    component: DeltaConnectionStatus,
    size: 'small',
    category: 'monitoring',
    priority: 15
  }
];

export default function DashboardPage() {
  const [activeWidgets, setActiveWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isConnected, setIsConnected] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds

  // Alerts state for Alerts & Notifications widget
  type Alert = {
    id: string;
    type: 'success' | 'warning' | 'error' | 'info';
    title: string;
    message: string;
    timestamp: number;
    dismissed?: boolean;
  };
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => (a.id === id ? { ...a, dismissed: true } : a)));
  }, []);

  // Theme management
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Trigger refresh for all widgets
      window.dispatchEvent(new CustomEvent('dashboard-refresh'));
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Connection status monitoring
  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(navigator.onLine);
    };

    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    // Initialize connection status on mount
    checkConnection();

    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, []);

  const toggleWidget = useCallback((widgetId: string) => {
    setActiveWidgets(prev => {
      const widget = DEFAULT_WIDGETS.find(w => w.id === widgetId);
      if (!widget) return prev;

      const isActive = prev.some(w => w.id === widgetId);
      if (isActive) {
        return prev.filter(w => w.id !== widgetId);
      } else {
        return [...prev, widget].sort((a, b) => a.priority - b.priority);
      }
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    } catch (e) {
      // no-op; some browsers can throw
    }
  }, []);

  // Sync fullscreen state with actual fullscreen status
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const exportDashboard = useCallback(() => {
    const dashboardData = {
      widgets: activeWidgets.map(w => ({ id: w.id, title: w.title })),
      settings: {
        isDarkMode,
        selectedCategory,
        notifications,
        autoRefresh,
        refreshInterval
      },
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(dashboardData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeWidgets, isDarkMode, selectedCategory, notifications, autoRefresh, refreshInterval]);

  const filteredWidgets = selectedCategory === 'all'
    ? activeWidgets
    : activeWidgets.filter(widget => widget.category === selectedCategory);

  const getWidgetGridClass = (size: string) => {
    switch (size) {
      case 'small': return 'col-span-1 row-span-1';
      case 'medium': return 'col-span-2 row-span-1';
      case 'large': return 'col-span-3 row-span-2';
      default: return 'col-span-1 row-span-1';
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Header */}
      <div className={`sticky top-0 z-50 border-b backdrop-blur-sm ${
        isDarkMode ? 'bg-gray-900/80 border-gray-700' : 'bg-white/80 border-gray-200'
      }`}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <h1 className={`text-2xl font-bold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              CryptoTrader Dashboard
            </h1>

            <div className="flex items-center space-x-2">
              {isConnected ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <Wifi className="w-4 h-4" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-red-600">
                  <WifiOff className="w-4 h-4" />
                  <span className="text-sm font-medium">Offline</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            {/* Notifications Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNotifications(!notifications)}
              className="p-2"
            >
              {notifications ? (
                <Bell className="w-4 h-4" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
            </Button>

            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('dashboard-refresh'))}
              className="p-2"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>

            {/* Export Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={exportDashboard}
              className="p-2"
            >
              <Download className="w-4 h-4" />
            </Button>

            {/* Fullscreen Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="p-2"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Controls */}
        <div className="mb-6">
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All Widgets</TabsTrigger>
              <TabsTrigger value="realtime">Real-time</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="controls">Controls</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Widget Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-fr">
          {filteredWidgets.map((widget) => {
            const WidgetComponent = widget.component;
            return (
              <div
                key={widget.id}
                className={`${getWidgetGridClass(widget.size)} transition-all duration-300 hover:scale-[1.02]`}
              >
                <Card className={`h-full ${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                } shadow-lg hover:shadow-xl transition-shadow duration-300`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className={`text-sm font-medium ${
                        isDarkMode ? 'text-gray-200' : 'text-gray-700'
                      }`}>
                        {widget.title}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          widget.category === 'realtime' ? 'border-green-500 text-green-600' :
                          widget.category === 'monitoring' ? 'border-blue-500 text-blue-600' :
                          widget.category === 'analytics' ? 'border-purple-500 text-purple-600' :
                          'border-orange-500 text-orange-600'
                        }`}
                      >
                        {widget.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 h-full">
                    {widget.id === 'alerts' ? (
                      <AlertsNotifications
                        theme={isDarkMode ? 'dark' : 'light'}
                        alerts={alerts}
                        onDismiss={dismissAlert}
                      />
                    ) : (
                      <WidgetComponent
                        theme={isDarkMode ? 'dark' : 'light'}
                        autoRefresh={autoRefresh}
                        // child widgets expect ms; page slider is seconds
                        refreshInterval={refreshInterval * 1000}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Widget Management */}
        <div className="mt-8">
          <Card className={`${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <CardHeader>
              <CardTitle className={`flex items-center space-x-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-900'
              }`}>
                <Settings className="w-5 h-5" />
                <span>Dashboard Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Widget Toggles */}
                <div>
                  <h3 className={`font-medium mb-3 ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Active Widgets
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {DEFAULT_WIDGETS.map((widget) => (
                      <div key={widget.id} className="flex items-center justify-between">
                        <span className={`text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          {widget.title}
                        </span>
                        <Switch
                          checked={activeWidgets.some(w => w.id === widget.id)}
                          onCheckedChange={() => toggleWidget(widget.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Auto-refresh Settings */}
                <div>
                  <h3 className={`font-medium mb-3 ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Auto-refresh
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        Enable auto-refresh
                      </span>
                      <Switch
                        checked={autoRefresh}
                        onCheckedChange={setAutoRefresh}
                      />
                    </div>
                    {autoRefresh && (
                      <div>
                        <label className={`text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          Refresh interval: {refreshInterval}s
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="300"
                          step="10"
                          value={refreshInterval}
                          onChange={(e) => setRefreshInterval(Number(e.target.value))}
                          className="w-full mt-1"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Display Settings */}
                <div>
                  <h3 className={`font-medium mb-3 ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Display
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        Dark mode
                      </span>
                      <Switch
                        checked={isDarkMode}
                        onCheckedChange={setIsDarkMode}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        Notifications
                      </span>
                      <Switch
                        checked={notifications}
                        onCheckedChange={setNotifications}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
