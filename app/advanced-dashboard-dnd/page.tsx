'use client';

import { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  BellOff,
  GripVertical
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
    id: 'ai-signals',
    title: 'AI Trading Signals',
    component: AITradingSignals,
    size: 'large',
    category: 'realtime',
    priority: 3
  },
  {
    id: 'system-health',
    title: 'System Health',
    component: SystemHealth,
    size: 'small',
    category: 'monitoring',
    priority: 4
  },
  {
    id: 'trading-positions',
    title: 'Active Positions',
    component: TradingPositions,
    size: 'medium',
    category: 'realtime',
    priority: 5
  },
  {
    id: 'quick-actions',
    title: 'Quick Actions',
    component: QuickActions,
    size: 'small',
    category: 'controls',
    priority: 6
  }
];

export default function AdvancedDashboardDnD() {
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

  // Theme management
  useEffect(() => {
    document.documentElement.classList.toggle('dark', layout.theme === 'dark');
    localStorage.setItem('dashboard-theme', layout.theme);
  }, [layout.theme]);

  // Load saved preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('dashboard-theme') as 'light' | 'dark' || 'dark';
    const savedLayout = localStorage.getItem('dashboard-layout-dnd');
    
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
    localStorage.setItem('dashboard-layout-dnd', JSON.stringify(newLayout));
    setLayout(newLayout);
  }, []);

  // Handle drag and drop
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const newWidgets = Array.from(layout.widgets);
    const [reorderedWidget] = newWidgets.splice(result.source.index, 1);
    newWidgets.splice(result.destination.index, 0, reorderedWidget);

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
      alerts: alerts.slice(0, 100)
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cryptotrader-dashboard-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
              <h1 className="text-2xl font-bold">Advanced Dashboard (Drag & Drop)</h1>
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
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="container mx-auto px-4 py-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="dashboard">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={`grid gap-6 auto-rows-min`}
                style={{
                  gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`
                }}
              >
                {layout.widgets.map((widget, index) => {
                  const WidgetComponent = widget.component;
                  
                  return (
                    <Draggable key={widget.id} draggableId={widget.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${getWidgetSizeClass(widget.size)} ${
                            snapshot.isDragging ? 'opacity-50 rotate-2 scale-105' : ''
                          }`}
                        >
                          <Card className={`h-full transition-all duration-200 ${
                            layout.theme === 'dark' 
                              ? 'bg-gray-800 border-gray-700' 
                              : 'bg-white border-gray-200'
                          } ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-500' : 'hover:shadow-lg'}`}>
                            <CardHeader 
                              {...provided.dragHandleProps}
                              className="cursor-move pb-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <GripVertical className="w-4 h-4 text-gray-400" />
                                  <CardTitle className="text-lg">{widget.title}</CardTitle>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {widget.category}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <WidgetComponent 
                                theme={layout.theme}
                                autoRefresh={layout.autoRefresh}
                                refreshInterval={layout.refreshInterval}
                              />
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </main>

      {/* Alerts Notifications */}
      {layout.notifications && (
        <AlertsNotifications 
          alerts={alerts}
          theme={layout.theme}
          onDismiss={(alertId) => setAlerts(prev => prev.filter(a => a.id !== alertId))}
        />
      )}
    </div>
  );
}
