import { Metadata } from 'next';
import { MultiAPIDashboard } from '@/components/dashboard/multi-api-dashboard';

export const metadata: Metadata = {
  title: 'Multi-API Crypto Dashboard | CryptoTrader',
  description: 'Comprehensive cryptocurrency dashboard with data from multiple API providers including CoinGecko, CoinMarketCap, sentiment analysis, and real-time news.',
  keywords: 'cryptocurrency, crypto dashboard, multi-api, real-time data, sentiment analysis, crypto news, market data',
};

export default function MultiAPIDashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <MultiAPIDashboard />
    </div>
  );
}
