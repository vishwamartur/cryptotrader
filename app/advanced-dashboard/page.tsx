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

interface DashboardLayout {
  widgets: DashboardWidget[];
  columns: number;
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
  notifications: boolean;
}

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
    id: 'portfolio-tracker',
    title: 'Portfolio Tracker',
    component: PortfolioTracker,
    size: 'medium',
    category: 'realtime',
    priority: 2
  },
  {
    id: 'trading-positions',
    title: 'Active Positions',
    component: TradingPositions,
    size: 'medium',
    category: 'realtime',
    priority: 3
  },
  {
    id: 'ai-signals',
    title: 'AI Trading Signals',
    component: AITradingSignals,
    size: 'large',
    category: 'realtime',
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
    category: 'monitoring',
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
    id: 'quick-actions',
    title: 'Quick Actions',
    component: QuickActions,
    size: 'small',
    category: 'controls',
    priority: 11
  },
  {
    id: 'ml-models',
    title: 'ML Models Overview',
    component: MLModelsOverview,
    size: 'large',
    category: 'analytics',
    priority: 12
  },
  {
    id: 'ml-predictions',
    title: 'ML Predictions Feed',
    component: MLPredictionsFeed,
    size: 'medium',
    category: 'realtime',
    priority: 13
  },
  {
    id: 'delta-connection',
    title: 'Delta Exchange Status',
    component: DeltaConnectionStatus,
    size: 'small',
    category: 'monitoring',
    priority: 14
  },
  {
    id: 'alerts',
    title: 'Alerts & Notifications',
    component: AlertsNotifications,
    size: 'small',
    category: 'monitoring',
    priority: 15
  }
];

export default function AdvancedDashboard() {
  // Dashboard state
  const [layout, setLayout] = useState<DashboardLayout>({
    widgets: DEFAULT_WIDGETS,
    columns: 3,
    theme: 'dark',
    autoRefresh: true,
    refreshInterval: 1000,
    notifications: true
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Theme management
  useEffect(() => {
    document.documentElement.classList.toggle('dark', layout.theme === 'dark');
    localStorage.setItem('dashboard-theme', layout.theme);
  }, [layout.theme]);

  // Load saved preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('dashboard-theme') as 'light' | 'dark' || 'dark';
    const savedLayout = localStorage.getItem('dashboard-layout');
    
    if (savedLayout) {
      try {
        const parsedLayout = JSON.parse(savedLayout);
        setLayout(prev => ({ ...prev, ...parsedLayout, theme: savedTheme }));
      } catch (error) {
        console.error('Failed to load saved layout:', error);
      }
    } else {
      setLayout(prev => ({ ...prev, theme: savedTheme }));
    }
  }, []);

  // Save layout changes
  const saveLayout = useCallback((newLayout: DashboardLayout) => {
    localStorage.setItem('dashboard-layout', JSON.stringify(newLayout));
    setLayout(newLayout);
  }, []);

  // Handle widget reordering (simplified without drag-and-drop)
  const moveWidget = (widgetId: string, direction: 'up' | 'down') => {
    const currentIndex = layout.widgets.findIndex(w => w.id === widgetId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= layout.widgets.length) return;

    const newWidgets = [...layout.widgets];
    [newWidgets[currentIndex], newWidgets[newIndex]] = [newWidgets[newIndex], newWidgets[currentIndex]];

    saveLayout({ ...layout, widgets: newWidgets });
  };

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = layout.theme === 'light' ? 'dark' : 'light';
    saveLayout({ ...layout, theme: newTheme });
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Export dashboard data
  const exportData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      layout,
      connectionStatus,
      alerts: alerts.slice(0, 100) // Last 100 alerts
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cryptotrader-dashboard-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Widget management functions
  const toggleWidget = useCallback((widgetId: string) => {
    const widget = DEFAULT_WIDGETS.find(w => w.id === widgetId);
    if (!widget) return;

    const isActive = layout.widgets.some(w => w.id === widgetId);
    if (isActive) {
      saveLayout({ ...layout, widgets: layout.widgets.filter(w => w.id !== widgetId) });
    } else {
      const newWidgets = [...layout.widgets, widget].sort((a, b) => a.priority - b.priority);
      saveLayout({ ...layout, widgets: newWidgets });
    }
  }, [layout]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => (a.id === id ? { ...a, dismissed: true } : a)));
  }, []);

  // Filter widgets by category
  const filteredWidgets = selectedCategory === 'all'
    ? layout.widgets
    : layout.widgets.filter(widget => widget.category === selectedCategory);

  // Get widget size classes
  const getWidgetSizeClass = (size: string) => {
    switch (size) {
      case 'small': return 'col-span-1 row-span-1';
      case 'medium': return 'col-span-2 row-span-1';
      case 'large': return 'col-span-3 row-span-2';
      default: return 'col-span-1 row-span-1';
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      layout.theme === 'dark' 
        ? 'bg-gray-900 text-white' 
        : 'bg-gray-50 text-gray-900'
    }`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-sm ${
        layout.theme === 'dark' 
          ? 'bg-gray-900/80 border-gray-800' 
          : 'bg-white/80 border-gray-200'
      }`}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">CryptoTrader Dashboard</h1>
              <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
                {connectionStatus === 'connected' ? (
                  <><Wifi className="w-3 h-3 mr-1" /> Connected</>
                ) : (
                  <><WifiOff className="w-3 h-3 mr-1" /> {connectionStatus}</>
                )}
              </Badge>
              <span className="text-sm text-gray-500">
                Last update: {lastUpdate.toLocaleTimeString()}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Category Filter */}
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="realtime">Real-time</TabsTrigger>
                  <TabsTrigger value="monitoring">Monitor</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="controls">Controls</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Notifications toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => saveLayout({ ...layout, notifications: !layout.notifications })}
              >
                {layout.notifications ? (
                  <Bell className="w-4 h-4" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
              </Button>

              {/* Theme toggle */}
              <Button variant="ghost" size="sm" onClick={toggleTheme}>
                {layout.theme === 'light' ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
              </Button>

              {/* Export data */}
              <Button variant="ghost" size="sm" onClick={exportData}>
                <Download className="w-4 h-4" />
              </Button>

              {/* Fullscreen toggle */}
              <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>

              {/* Settings */}
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="container mx-auto px-4 py-6">
        <div
          className={`grid gap-6 auto-rows-min`}
          style={{
            gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`
          }}
        >
          {filteredWidgets.map((widget, index) => {
            const WidgetComponent = widget.component;

            return (
              <div
                key={widget.id}
                className={`${getWidgetSizeClass(widget.size)}`}
              >
                <Card className={`h-full transition-all duration-200 hover:shadow-lg ${
                  layout.theme === 'dark'
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-white border-gray-200'
                }`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{widget.title}</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {widget.category}
                        </Badge>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveWidget(widget.id, 'up')}
                            disabled={index === 0}
                            className="h-6 w-6 p-0"
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveWidget(widget.id, 'down')}
                            disabled={index === filteredWidgets.length - 1}
                            className="h-6 w-6 p-0"
                          >
                            ↓
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {widget.id === 'alerts' ? (
                      <AlertsNotifications
                        theme={layout.theme}
                        alerts={alerts}
                        onDismiss={dismissAlert}
                      />
                    ) : (
                      <WidgetComponent
                        theme={layout.theme}
                        autoRefresh={layout.autoRefresh}
                        refreshInterval={layout.refreshInterval}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </main>


    </div>
  );
}
