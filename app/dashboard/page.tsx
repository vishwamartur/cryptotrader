'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, ArrowRight, Zap } from 'lucide-react';

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

interface AIAnalysis {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  positionSize: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  timestamp: number;
}

interface Strategy {
  name: string;
  description: string;
  category: string;
  riskLevel: string;
  complexity: string;
}

export default function DashboardPage() {
  const router = useRouter();

  // Auto-redirect to advanced dashboard after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/advanced-dashboard');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleUpgradeNow = () => {
    router.push('/advanced-dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        {/* Migration Notice */}
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-6">
            <Zap className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl font-bold text-gray-900">
            Dashboard Upgrade Available!
          </h1>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            We've built a powerful new Advanced Dashboard with real-time widgets,
            customizable layouts, and enhanced trading features.
          </p>
        </div>

        {/* Feature Comparison */}
        <div className="grid md:grid-cols-2 gap-8 my-12">
          {/* Old Dashboard */}
          <Card className="border-2 border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>Current Dashboard</span>
                <Badge variant="outline">Basic</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-left space-y-3">
              <div className="flex items-center space-x-2 text-gray-600">
                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                <span>Static market data display</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                <span>Basic AI analysis</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                <span>Simple strategy list</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                <span>Fixed layout</span>
              </div>
            </CardContent>
          </Card>

          {/* New Dashboard */}
          <Card className="border-2 border-blue-500 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>Advanced Dashboard</span>
                <Badge className="bg-blue-600">Pro</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-left space-y-3">
              <div className="flex items-center space-x-2 text-blue-700">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>Real-time live price feeds</span>
              </div>
              <div className="flex items-center space-x-2 text-blue-700">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>Advanced AI trading signals</span>
              </div>
              <div className="flex items-center space-x-2 text-blue-700">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>ML models & predictions</span>
              </div>
              <div className="flex items-center space-x-2 text-blue-700">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>Customizable widget layout</span>
              </div>
              <div className="flex items-center space-x-2 text-blue-700">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>Dark/Light theme support</span>
              </div>
              <div className="flex items-center space-x-2 text-blue-700">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>Portfolio tracking & risk management</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
          <Button
            onClick={handleUpgradeNow}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
          >
            <Zap className="mr-2 h-5 w-5" />
            Upgrade Now
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={handleUpgradeNow}
            className="px-8 py-3 text-lg"
          >
            <ArrowRight className="mr-2 h-5 w-5" />
            View Advanced Dashboard
          </Button>
        </div>

        {/* Auto-redirect notice */}
        <div className="mt-8 p-4 bg-blue-100 rounded-lg border border-blue-200">
          <div className="flex items-center justify-center space-x-2 text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">
              Automatically redirecting to Advanced Dashboard in 3 seconds...
            </span>
          </div>
        </div>

        {/* Migration Benefits */}
        <div className="mt-12 text-left max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            What's New in Advanced Dashboard
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Real-time Data</h3>
              <p className="text-sm text-gray-600">
                Live price feeds, real-time portfolio tracking, and instant market updates
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">AI-Powered</h3>
              <p className="text-sm text-gray-600">
                Advanced ML models, predictive analytics, and intelligent trading signals
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto">
                <ArrowRight className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Customizable</h3>
              <p className="text-sm text-gray-600">
                Drag-and-drop widgets, personalized layouts, and theme customization
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
