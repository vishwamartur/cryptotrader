# Multi-API Cryptocurrency Data Integration

## Overview

The CryptoTrader application now includes comprehensive integration with multiple cryptocurrency data providers, offering redundancy, better data coverage, and improved reliability. This implementation includes price data, market analytics, sentiment analysis, and real-time news from various sources.

## 🚀 Features

### Price Data Providers
- **CoinGecko** - Free tier with comprehensive data
- **CoinCap** - High rate limits and real-time data
- **Coinpaprika** - Extensive historical data
- **CoinMarketCap** - Industry standard (API key required)
- **CryptoCompare** - Professional data feeds (API key required)
- **Nomics** - Institutional-grade data (API key required)

### Sentiment Analysis Providers
- **Santiment** - Social sentiment and on-chain metrics
- **Predicoin** - News sentiment from 100+ sources
- **BittsAnalytics** - Social media analysis
- **Mosaic.io** - Comprehensive cryptoasset coverage
- **Decryptz** - Enterprise-grade sentiment data
- **CryptoQokka** - Market sentiment overview

### News & Data Providers
- **CoinGecko News** - Curated crypto news
- **CryptoCompare News** - Real-time news feeds
- **Kaiko** - Institutional market data
- **Blockmarkets** - Professional data feeds

## 📊 API Endpoints

### Price Data
```
GET /api/crypto-data/prices?symbols=BTC,ETH,ADA
POST /api/crypto-data/prices
```

### Market Data
```
GET /api/crypto-data/market
POST /api/crypto-data/market
```

### Sentiment Analysis
```
GET /api/crypto-data/sentiment?symbols=BTC,ETH
POST /api/crypto-data/sentiment
```

### News
```
GET /api/crypto-data/news?limit=10
POST /api/crypto-data/news
```

### System Status
```
GET /api/crypto-data/status
POST /api/crypto-data/status
```

## 🔧 Configuration

### Environment Variables

Add the following to your `.env.local` file:

```bash
# Price Data Providers (Optional - Free tiers available)
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key_here
CRYPTOCOMPARE_API_KEY=your_cryptocompare_api_key_here
NOMICS_API_KEY=your_nomics_api_key_here

# Sentiment Analysis Providers
SANTIMENT_API_KEY=your_santiment_api_key_here
PREDICOIN_API_KEY=your_predicoin_api_key_here
BITTSANALYTICS_API_KEY=your_bittsanalytics_api_key_here
MOSAIC_API_KEY=your_mosaic_api_key_here
DECRYPTZ_API_KEY=your_decryptz_api_key_here
DANEEL_API_KEY=your_daneel_api_key_here

# News and Data Providers
KAIKO_API_KEY=your_kaiko_api_key_here
BLOCKMARKETS_API_KEY=your_blockmarkets_api_key_here
```

### Provider Priority

Providers are automatically prioritized based on:
1. **Priority Level** (1 = highest)
2. **Rate Limits**
3. **Response Time**
4. **Reliability**

## 🎯 Usage Examples

### Basic Price Data
```typescript
// Get prices for multiple cryptocurrencies
const response = await fetch('/api/crypto-data/prices?symbols=BTC,ETH,ADA');
const data = await response.json();

console.log(data.data.prices);
// [
//   {
//     symbol: 'BTC',
//     price: 45000,
//     change24h: 2.5,
//     changePercent24h: 2.5,
//     volume24h: 25000000000,
//     marketCap: 850000000000,
//     source: 'CoinGecko'
//   }
// ]
```

### Advanced Price Filtering
```typescript
const response = await fetch('/api/crypto-data/prices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symbols: ['BTC', 'ETH', 'ADA', 'SOL'],
    options: {
      minPrice: 1,
      maxPrice: 100000,
      sortBy: 'marketCap',
      sortOrder: 'desc',
      limit: 10
    }
  })
});
```

### Sentiment Analysis
```typescript
const response = await fetch('/api/crypto-data/sentiment?symbols=BTC,ETH');
const data = await response.json();

console.log(data.data.sentiment);
// [
//   {
//     symbol: 'BTC',
//     sentiment: 'bullish',
//     score: 0.75,
//     confidence: 0.85,
//     socialVolume: 15000,
//     newsVolume: 250
//   }
// ]
```

### Market Data with Analysis
```typescript
const response = await fetch('/api/crypto-data/market', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    timeframe: '24h',
    includeComparison: true
  })
});

const data = await response.json();
console.log(data.data.analysis);
// {
//   marketTrend: 'bullish',
//   volumeTrend: 'high',
//   dominanceTrend: 'stable',
//   riskLevel: 'medium'
// }
```

## 🔍 Monitoring & Health Checks

### System Status
```typescript
const response = await fetch('/api/crypto-data/status?detailed=true&testConnections=true');
const data = await response.json();

console.log(data.data.systemHealth);
// {
//   status: 'healthy',
//   healthyProviders: 8,
//   totalProviders: 10,
//   healthPercentage: 80
// }
```

### Performance Diagnostics
```typescript
const response = await fetch('/api/crypto-data/status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    runPerformanceTest: true,
    testSymbols: ['BTC', 'ETH'],
    includeLatencyTest: true
  })
});
```

## 🎨 Dashboard Integration

### Multi-API Dashboard
Visit `/multi-api-dashboard` to see the comprehensive dashboard featuring:

- **Real-time Price Data** from multiple providers
- **Market Sentiment Analysis** with confidence scores
- **Latest Crypto News** with sentiment analysis
- **API Provider Status** monitoring
- **Performance Metrics** and health checks

### Dashboard Features
- **Auto-refresh** every 30 seconds
- **Provider Fallback** for reliability
- **Data Aggregation** from multiple sources
- **Real-time Status** monitoring
- **Interactive Filtering** and sorting

## 🛡️ Error Handling & Fallbacks

### Automatic Failover
The system automatically switches between providers when:
- Rate limits are exceeded
- API endpoints are unavailable
- Response times are too slow
- Data quality is poor

### Mock Data Fallbacks
When all providers fail, the system provides:
- **Realistic Mock Data** for development
- **Error Notifications** for debugging
- **Graceful Degradation** of features
- **Status Indicators** for users

## 📈 Rate Limiting & Caching

### Built-in Rate Limiting
- **Per-provider** rate limit tracking
- **Automatic backoff** when limits approached
- **Request queuing** for optimal usage
- **Usage statistics** monitoring

### Intelligent Caching
- **30-second cache** for price data
- **5-minute cache** for sentiment data
- **Cache invalidation** on errors
- **Memory-efficient** storage

## 🔒 Security & Best Practices

### API Key Management
- **Environment variables** for sensitive data
- **No hardcoded keys** in source code
- **Optional configuration** for all providers
- **Graceful fallbacks** without keys

### Request Security
- **HTTPS only** for all external requests
- **Request validation** and sanitization
- **Error message** sanitization
- **Rate limit protection**

## 🚀 Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env.local
   # Add your API keys (optional)
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Visit Dashboard**
   ```
   http://localhost:3000/multi-api-dashboard
   ```

## 📚 API Documentation

For detailed API documentation, visit the individual endpoint documentation or use the built-in API explorer at `/api-docs` (coming soon).

## 🤝 Contributing

When adding new providers:
1. Update the provider configuration in `api-manager.ts`
2. Add environment variable documentation
3. Implement provider-specific data transformation
4. Add health check endpoints
5. Update the dashboard components

## 📄 License

This multi-API integration is part of the CryptoTrader project and follows the same license terms.
