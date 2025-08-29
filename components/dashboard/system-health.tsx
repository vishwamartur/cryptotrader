'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Wifi, 
  WifiOff,
  Server,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { useRealtimeData } from '@/hooks/use-realtime-data';

interface SystemHealthProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

interface HealthMetricProps {
  title: string;
  value: string | number;
  status: 'healthy' | 'warning' | 'critical';
  icon: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
  theme: 'light' | 'dark';
}

function HealthMetric({ 
  title, 
  value, 
  status, 
  icon, 
  description, 
  trend, 
  theme 
}: HealthMetricProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500 bg-green-500/10';
      case 'warning': return 'text-yellow-500 bg-yellow-500/10';
      case 'critical': return 'text-red-500 bg-red-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-3 h-3" />;
      case 'warning': return <AlertTriangle className="w-3 h-3" />;
      case 'critical': return <AlertTriangle className="w-3 h-3" />;
      default: return <Activity className="w-3 h-3" />;
    }
  };

  return (
    <Card className={`${
      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className={`p-2 rounded-full ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              }`}>
                {icon}
              </div>
              <div>
                <div className="text-sm text-gray-500">{title}</div>
                <div className="text-lg font-semibold">{value}</div>
              </div>
            </div>
            {description && (
              <div className="text-xs text-gray-400">{description}</div>
            )}
          </div>
          
          <div className="flex flex-col items-end space-y-1">
            <Badge className={getStatusColor(status)}>
              {getStatusIcon(status)}
              <span className="ml-1 capitalize">{status}</span>
            </Badge>
            {trend && (
              <div className={`text-xs flex items-center ${
                trend === 'up' ? 'text-green-500' : 
                trend === 'down' ? 'text-red-500' : 'text-gray-500'
              }`}>
                <TrendingUp className={`w-3 h-3 mr-1 ${
                  trend === 'down' ? 'rotate-180' : ''
                }`} />
                {trend}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ServiceStatusProps {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  uptime: number;
  responseTime: number;
  theme: 'light' | 'dark';
}

function ServiceStatus({ name, status, uptime, responseTime, theme }: ServiceStatusProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
      <div className="flex items-center space-x-3">
        <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-sm text-gray-500">
            Uptime: {formatUptime(uptime)}
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className="font-medium">{responseTime}ms</div>
        <div className="text-sm text-gray-500 capitalize">{status}</div>
      </div>
    </div>
  );
}

export function SystemHealth({ theme, autoRefresh, refreshInterval }: SystemHealthProps) {
  const { systemHealth, connectionStatus, lastUpdate } = useRealtimeData();
  const [performanceHistory, setPerformanceHistory] = useState<number[]>([]);

  // Update performance history
  useEffect(() => {
    if (systemHealth.latency) {
      setPerformanceHistory(prev => [...prev.slice(-19), systemHealth.latency]);
    }
  }, [systemHealth.latency]);

  // Calculate system status
  const getOverallStatus = () => {
    if (systemHealth.apiStatus === 'offline' || systemHealth.websocketStatus === 'disconnected') {
      return 'critical';
    }
    if (systemHealth.apiStatus === 'degraded' || systemHealth.errorRate > 0.05 || systemHealth.latency > 1000) {
      return 'warning';
    }
    return 'healthy';
  };

  const overallStatus = getOverallStatus();

  // Mock additional services for demonstration
  const services = [
    {
      name: 'Trading API',
      status: systemHealth.apiStatus,
      uptime: systemHealth.uptime,
      responseTime: Math.round(systemHealth.latency)
    },
    {
      name: 'WebSocket Feed',
      status: systemHealth.websocketStatus === 'connected' ? 'online' : 
              systemHealth.websocketStatus === 'reconnecting' ? 'degraded' : 'offline',
      uptime: systemHealth.uptime,
      responseTime: Math.round(systemHealth.latency * 0.8)
    },
    {
      name: 'AI Engine',
      status: 'online',
      uptime: systemHealth.uptime,
      responseTime: Math.round(systemHealth.latency * 1.5)
    },
    {
      name: 'Risk Manager',
      status: systemHealth.errorRate > 0.1 ? 'degraded' : 'online',
      uptime: systemHealth.uptime,
      responseTime: Math.round(systemHealth.latency * 0.6)
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">System Health</h3>
          <Badge className={
            overallStatus === 'healthy' ? 'bg-green-500/10 text-green-500' :
            overallStatus === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
            'bg-red-500/10 text-red-500'
          }>
            {overallStatus === 'healthy' ? <CheckCircle className="w-3 h-3 mr-1" /> :
             <AlertTriangle className="w-3 h-3 mr-1" />}
            {overallStatus.toUpperCase()}
          </Badge>
        </div>
        
        <div className="text-xs text-gray-500">
          Last check: {new Date(systemHealth.lastUpdate).toLocaleTimeString()}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HealthMetric
          title="API Latency"
          value={`${Math.round(systemHealth.latency)}ms`}
          status={systemHealth.latency > 1000 ? 'critical' : 
                  systemHealth.latency > 500 ? 'warning' : 'healthy'}
          icon={<Zap className="w-4 h-4" />}
          description="Average response time"
          trend={performanceHistory.length >= 2 ? 
            (performanceHistory[performanceHistory.length - 1] > performanceHistory[performanceHistory.length - 2] ? 'up' : 'down') : 
            'stable'}
          theme={theme}
        />
        
        <HealthMetric
          title="Error Rate"
          value={`${(systemHealth.errorRate * 100).toFixed(2)}%`}
          status={systemHealth.errorRate > 0.05 ? 'critical' : 
                  systemHealth.errorRate > 0.01 ? 'warning' : 'healthy'}
          icon={<AlertTriangle className="w-4 h-4" />}
          description="Failed requests per minute"
          theme={theme}
        />
        
        <HealthMetric
          title="System Uptime"
          value={`${Math.floor(systemHealth.uptime / 3600)}h ${Math.floor((systemHealth.uptime % 3600) / 60)}m`}
          status="healthy"
          icon={<Clock className="w-4 h-4" />}
          description="Continuous operation time"
          theme={theme}
        />
        
        <HealthMetric
          title="Connection Status"
          value={connectionStatus}
          status={connectionStatus === 'connected' ? 'healthy' : 'critical'}
          icon={connectionStatus === 'connected' ? 
            <Wifi className="w-4 h-4" /> : 
            <WifiOff className="w-4 h-4" />}
          description="WebSocket connection"
          theme={theme}
        />
      </div>

      {/* Performance Chart */}
      <Card className={`${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Latency Trend</h4>
              <div className="text-sm text-gray-500">Last 20 measurements</div>
            </div>
            
            <div className="h-24 flex items-end space-x-1">
              {performanceHistory.map((latency, index) => {
                const height = Math.max(4, (latency / Math.max(...performanceHistory, 100)) * 80);
                const color = latency > 1000 ? 'bg-red-500' : 
                             latency > 500 ? 'bg-yellow-500' : 'bg-green-500';
                
                return (
                  <div
                    key={index}
                    className={`flex-1 ${color} rounded-t transition-all duration-300`}
                    style={{ height: `${height}px` }}
                    title={`${Math.round(latency)}ms`}
                  />
                );
              })}
            </div>
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>0ms</span>
              <span>{Math.max(...performanceHistory, 100).toFixed(0)}ms</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Status */}
      <Card className={`${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h4 className="font-semibold">Service Status</h4>
            <div className="space-y-3">
              {services.map((service, index) => (
                <ServiceStatus
                  key={index}
                  name={service.name}
                  status={service.status as any}
                  uptime={service.uptime}
                  responseTime={service.responseTime}
                  theme={theme}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Resources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Server className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">CPU Usage</span>
              </div>
              <div className="space-y-2">
                <Progress value={45} className="h-2" />
                <div className="text-xs text-gray-500">45% of available cores</div>
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
                <BarChart3 className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Memory</span>
              </div>
              <div className="space-y-2">
                <Progress value={62} className="h-2" />
                <div className="text-xs text-gray-500">2.4GB / 4GB used</div>
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
                <Database className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">Storage</span>
              </div>
              <div className="space-y-2">
                <Progress value={28} className="h-2" />
                <div className="text-xs text-gray-500">14GB / 50GB used</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
