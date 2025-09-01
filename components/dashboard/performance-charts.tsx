'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Calendar } from 'lucide-react';

// Client-side only chart value display component to prevent hydration mismatch
function ClientChartValue({ value, prefix = '$', suffix = '', className = '' }: {
  value: number | undefined;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (value !== undefined) {
      setDisplayValue(`${prefix}${value.toFixed(2)}${suffix}`);
    }
  }, [value, prefix, suffix]);

  // Show placeholder during server-side rendering and initial hydration
  if (!isClient) {
    return <span className={`text-gray-400 ${className}`}>---.--</span>;
  }

  return <span className={className}>{displayValue}</span>;
}

interface PerformanceChartsProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

export function PerformanceCharts({ theme }: PerformanceChartsProps) {
  const [timeframe, setTimeframe] = useState<'1D' | '7D' | '30D' | '1Y'>('7D');
  const [chartType, setChartType] = useState<'pnl' | 'equity' | 'drawdown'>('pnl');
  const [chartData, setChartData] = useState<Array<{ x: number; y: number }>>([]);
  const [isClient, setIsClient] = useState(false);

  // Generate chart data with consistent seed for hydration safety
  const generateChartData = (timeframe: string, seed: number = 42) => {
    const points = timeframe === '1D' ? 24 : timeframe === '7D' ? 7 : timeframe === '30D' ? 30 : 365;

    // Use a seeded random function for consistent results
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    return Array.from({ length: points }, (_, i) => ({
      x: i,
      y: seededRandom(seed + i) * 1000 + 500 + (i * 10)
    }));
  };

  // Initialize chart data on client-side only
  useEffect(() => {
    setIsClient(true);
    setChartData(generateChartData(timeframe));
  }, [timeframe]);

  // Update chart data when timeframe changes (client-side only)
  useEffect(() => {
    if (isClient) {
      setChartData(generateChartData(timeframe));
    }
  }, [timeframe, isClient]);

  const maxValue = chartData.length > 0 ? Math.max(...chartData.map(d => d.y)) : 0;
  const minValue = chartData.length > 0 ? Math.min(...chartData.map(d => d.y)) : 0;
  const currentValue = chartData.length > 0 ? chartData[chartData.length - 1]?.y : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Performance Charts</h3>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            {(['pnl', 'equity', 'drawdown'] as const).map((type) => (
              <Button
                key={type}
                variant={chartType === type ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType(type)}
                className="text-xs capitalize"
              >
                {type}
              </Button>
            ))}
          </div>
          <div className="flex items-center space-x-1">
            {(['1D', '7D', '30D', '1Y'] as const).map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeframe(tf)}
                className="text-xs"
              >
                {tf}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      <Card className={`${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="font-medium capitalize">{chartType} Chart</span>
              </div>
              <div className="text-sm text-gray-500">
                {timeframe} timeframe
              </div>
            </div>
            
            {/* Simple SVG Chart */}
            <div className="h-48 w-full">
              <svg width="100%" height="100%" viewBox="0 0 400 200" className="border rounded">
                <defs>
                  <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                
                {/* Chart line - only render when data is available */}
                {chartData.length > 0 && (
                  <>
                    <polyline
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      points={chartData.map((point, index) =>
                        `${(index / (chartData.length - 1)) * 380 + 10},${190 - ((point.y - minValue) / (maxValue - minValue)) * 170}`
                      ).join(' ')}
                    />

                    {/* Fill area */}
                    <polygon
                      fill="url(#chartGradient)"
                      points={[
                        ...chartData.map((point, index) =>
                          `${(index / (chartData.length - 1)) * 380 + 10},${190 - ((point.y - minValue) / (maxValue - minValue)) * 170}`
                        ),
                        `${390},190`,
                        `10,190`
                      ].join(' ')}
                    />
                  </>
                )}

                {/* Loading placeholder when no data */}
                {chartData.length === 0 && (
                  <text
                    x="200"
                    y="100"
                    textAnchor="middle"
                    className="fill-gray-400 text-sm"
                  >
                    Loading chart data...
                  </text>
                )}
                
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map(i => (
                  <line
                    key={i}
                    x1="10"
                    y1={10 + i * 45}
                    x2="390"
                    y2={10 + i * 45}
                    stroke={theme === 'dark' ? '#374151' : '#e5e7eb'}
                    strokeWidth="1"
                    opacity="0.5"
                  />
                ))}
              </svg>
            </div>
            
            {/* Chart stats */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-gray-500">Current</div>
                <div className="font-medium">
                  <ClientChartValue value={currentValue} />
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">High</div>
                <div className="font-medium text-green-500">
                  <ClientChartValue value={maxValue} />
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">Low</div>
                <div className="font-medium text-red-500">
                  <ClientChartValue value={minValue} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
