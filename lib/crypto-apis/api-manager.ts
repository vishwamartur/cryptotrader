/**
 * Comprehensive Cryptocurrency API Manager
 * Integrates multiple crypto data providers for redundancy and comprehensive coverage
 */

export interface CryptoPrice {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: string;
  source: string;
}

export interface MarketData {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  activeCryptocurrencies: number;
  lastUpdated: string;
}

export interface SentimentData {
  symbol: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number; // -1 to 1
  sources: string[];
  lastUpdated: string;
}

export interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface APIProvider {
  name: string;
  baseUrl: string;
  apiKey?: string;
  rateLimit: number; // requests per minute
  priority: number; // 1 = highest priority
  isActive: boolean;
  endpoints: {
    prices?: string;
    marketData?: string;
    news?: string;
    sentiment?: string;
  };
}

export class CryptoAPIManager {
  private providers: Map<string, APIProvider> = new Map();
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Free tier providers (no API key required)
    this.addProvider({
      name: 'CoinGecko',
      baseUrl: 'https://api.coingecko.com/api/v3',
      rateLimit: 10, // 10-50 calls/minute on free tier
      priority: 1,
      isActive: true,
      endpoints: {
        prices: '/simple/price',
        marketData: '/global',
        news: '/news'
      }
    });

    this.addProvider({
      name: 'CoinCap',
      baseUrl: 'https://api.coincap.io/v2',
      rateLimit: 200, // 200 requests/minute
      priority: 2,
      isActive: true,
      endpoints: {
        prices: '/assets',
        marketData: '/assets'
      }
    });

    this.addProvider({
      name: 'Coinpaprika',
      baseUrl: 'https://api.coinpaprika.com/v1',
      rateLimit: 20, // 20,000 calls/month free
      priority: 3,
      isActive: true,
      endpoints: {
        prices: '/tickers',
        marketData: '/global'
      }
    });

    this.addProvider({
      name: 'Cryptonator',
      baseUrl: 'https://api.cryptonator.com/api/full',
      rateLimit: 60,
      priority: 4,
      isActive: true,
      endpoints: {
        prices: '/'
      }
    });

    // API key required providers (configured via environment)
    if (process.env.COINMARKETCAP_API_KEY) {
      this.addProvider({
        name: 'CoinMarketCap',
        baseUrl: 'https://pro-api.coinmarketcap.com/v1',
        apiKey: process.env.COINMARKETCAP_API_KEY,
        rateLimit: 333, // 10,000 calls/month = ~333/day
        priority: 1,
        isActive: true,
        endpoints: {
          prices: '/cryptocurrency/quotes/latest',
          marketData: '/global-metrics/quotes/latest'
        }
      });
    }

    if (process.env.CRYPTOCOMPARE_API_KEY) {
      this.addProvider({
        name: 'CryptoCompare',
        baseUrl: 'https://min-api.cryptocompare.com/data',
        apiKey: process.env.CRYPTOCOMPARE_API_KEY,
        rateLimit: 100,
        priority: 2,
        isActive: true,
        endpoints: {
          prices: '/pricemultifull',
          news: '/v2/news/'
        }
      });
    }

    if (process.env.NOMICS_API_KEY) {
      this.addProvider({
        name: 'Nomics',
        baseUrl: 'https://api.nomics.com/v1',
        apiKey: process.env.NOMICS_API_KEY,
        rateLimit: 100,
        priority: 3,
        isActive: true,
        endpoints: {
          prices: '/currencies/ticker',
          marketData: '/market-cap/history'
        }
      });
    }

    if (process.env.COINAPI_KEY) {
      this.addProvider({
        name: 'CoinAPI',
        baseUrl: 'https://rest.coinapi.io/v1',
        apiKey: process.env.COINAPI_KEY,
        rateLimit: 100, // Adjust based on your plan
        priority: 2,
        isActive: true,
        endpoints: {
          prices: '/exchangerate',
          marketData: '/assets'
        }
      });
    }
  }

  private addProvider(provider: APIProvider) {
    this.providers.set(provider.name, provider);
    this.rateLimiters.set(provider.name, { count: 0, resetTime: Date.now() + 60000 });
  }

  private async makeRequest(providerName: string, endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const provider = this.providers.get(providerName);
    if (!provider || !provider.isActive) {
      throw new Error(`Provider ${providerName} not available`);
    }

    // Check rate limit
    const rateLimiter = this.rateLimiters.get(providerName)!;
    if (Date.now() > rateLimiter.resetTime) {
      rateLimiter.count = 0;
      rateLimiter.resetTime = Date.now() + 60000;
    }

    if (rateLimiter.count >= provider.rateLimit) {
      throw new Error(`Rate limit exceeded for ${providerName}`);
    }

    // Build URL
    const url = new URL(endpoint, provider.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value.toString());
    });

    // Add API key if required
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (provider.apiKey) {
      if (providerName === 'CoinMarketCap') {
        headers['X-CMC_PRO_API_KEY'] = provider.apiKey;
      } else if (providerName === 'CryptoCompare') {
        headers['authorization'] = `Apikey ${provider.apiKey}`;
      } else if (providerName === 'CoinAPI') {
        headers['X-CoinAPI-Key'] = provider.apiKey;
      } else {
        url.searchParams.append('key', provider.apiKey);
      }
    }

    try {
      const response = await fetch(url.toString(), { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      rateLimiter.count++;
      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${providerName}:`, error);
      throw error;
    }
  }

  private getCacheKey(method: string, params: any): string {
    return `${method}_${JSON.stringify(params)}`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_DURATION
    });
  }

  async getPrices(symbols: string[]): Promise<CryptoPrice[]> {
    const cacheKey = this.getCacheKey('prices', symbols);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const providers = Array.from(this.providers.values())
      .filter(p => p.isActive && p.endpoints.prices)
      .sort((a, b) => a.priority - b.priority);

    for (const provider of providers) {
      try {
        let prices: CryptoPrice[] = [];

        switch (provider.name) {
          case 'CoinGecko':
            prices = await this.getCoinGeckoPrices(symbols);
            break;
          case 'CoinCap':
            prices = await this.getCoinCapPrices(symbols);
            break;
          case 'Coinpaprika':
            prices = await this.getCoinpaprikaPrices(symbols);
            break;
          case 'CoinMarketCap':
            prices = await this.getCoinMarketCapPrices(symbols);
            break;
          case 'CoinAPI':
            prices = await this.getCoinAPIPrices(symbols);
            break;
          case 'CryptoCompare':
            prices = await this.getCryptoComparePrices(symbols);
            break;
          default:
            continue;
        }

        if (prices.length > 0) {
          this.setCache(cacheKey, prices);
          return prices;
        }
      } catch (error) {
        console.warn(`Failed to get prices from ${provider.name}:`, error);
        continue;
      }
    }

    throw new Error('All price providers failed');
  }

  private async getCoinGeckoPrices(symbols: string[]): Promise<CryptoPrice[]> {
    // Map symbols to CoinGecko IDs
    const symbolToId: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'ADA': 'cardano',
      'SOL': 'solana',
      'DOT': 'polkadot',
      'MATIC': 'polygon',
      'AVAX': 'avalanche-2',
      'LINK': 'chainlink',
      'UNI': 'uniswap'
    };

    const ids = symbols.map(s => symbolToId[s] || s.toLowerCase()).join(',');
    const data = await this.makeRequest('CoinGecko', '/simple/price', {
      ids,
      vs_currencies: 'usd',
      include_24hr_change: 'true',
      include_24hr_vol: 'true',
      include_market_cap: 'true',
      include_last_updated_at: 'true'
    });

    // Create reverse mapping for symbol lookup
    const idToSymbol: Record<string, string> = {};
    Object.entries(symbolToId).forEach(([symbol, id]) => {
      idToSymbol[id] = symbol;
    });

    return Object.entries(data).map(([id, info]: [string, any]) => ({
      symbol: idToSymbol[id] || id.toUpperCase(),
      price: info.usd || 0,
      change24h: info.usd_24h_change || 0,
      changePercent24h: info.usd_24h_change || 0,
      volume24h: info.usd_24h_vol || 0,
      marketCap: info.usd_market_cap || 0,
      lastUpdated: new Date(info.last_updated_at * 1000).toISOString(),
      source: 'CoinGecko'
    }));
  }

  private async getCoinCapPrices(symbols: string[]): Promise<CryptoPrice[]> {
    const data = await this.makeRequest('CoinCap', '/assets', {
      limit: 100
    });

    return data.data
      .filter((asset: any) => symbols.includes(asset.symbol))
      .map((asset: any) => ({
        symbol: asset.symbol,
        price: parseFloat(asset.priceUsd) || 0,
        change24h: parseFloat(asset.changePercent24Hr) || 0,
        changePercent24h: parseFloat(asset.changePercent24Hr) || 0,
        volume24h: parseFloat(asset.volumeUsd24Hr) || 0,
        marketCap: parseFloat(asset.marketCapUsd) || 0,
        lastUpdated: new Date().toISOString(),
        source: 'CoinCap'
      }));
  }

  private async getCoinpaprikaPrices(symbols: string[]): Promise<CryptoPrice[]> {
    const data = await this.makeRequest('Coinpaprika', '/tickers', {
      limit: 100
    });

    return data
      .filter((ticker: any) => symbols.includes(ticker.symbol))
      .map((ticker: any) => ({
        symbol: ticker.symbol,
        price: ticker.quotes?.USD?.price || 0,
        change24h: ticker.quotes?.USD?.percent_change_24h || 0,
        changePercent24h: ticker.quotes?.USD?.percent_change_24h || 0,
        volume24h: ticker.quotes?.USD?.volume_24h || 0,
        marketCap: ticker.quotes?.USD?.market_cap || 0,
        lastUpdated: ticker.last_updated,
        source: 'Coinpaprika'
      }));
  }

  private async getCoinMarketCapPrices(symbols: string[]): Promise<CryptoPrice[]> {
    const data = await this.makeRequest('CoinMarketCap', '/cryptocurrency/quotes/latest', {
      symbol: symbols.join(','),
      convert: 'USD'
    });

    return Object.values(data.data).map((crypto: any) => ({
      symbol: crypto.symbol,
      price: crypto.quote.USD.price,
      change24h: crypto.quote.USD.percent_change_24h,
      changePercent24h: crypto.quote.USD.percent_change_24h,
      volume24h: crypto.quote.USD.volume_24h,
      marketCap: crypto.quote.USD.market_cap,
      lastUpdated: crypto.quote.USD.last_updated,
      source: 'CoinMarketCap'
    }));
  }

  private async getCoinAPIPrices(symbols: string[]): Promise<CryptoPrice[]> {
    const prices: CryptoPrice[] = [];

    // CoinAPI requires individual requests for each symbol
    for (const symbol of symbols) {
      try {
        const data = await this.makeRequest('CoinAPI', `/exchangerate/${symbol}/USD`, {});

        prices.push({
          symbol: symbol,
          price: data.rate || 0,
          change24h: 0, // CoinAPI doesn't provide 24h change in this endpoint
          changePercent24h: 0,
          volume24h: 0, // Would need separate endpoint for volume
          marketCap: 0, // Would need separate endpoint for market cap
          lastUpdated: data.time || new Date().toISOString(),
          source: 'CoinAPI'
        });
      } catch (error) {
        console.warn(`Failed to get CoinAPI price for ${symbol}:`, error);
        continue;
      }
    }

    return prices;
  }

  private async getCryptoComparePrices(symbols: string[]): Promise<CryptoPrice[]> {
    const prices: CryptoPrice[] = [];

    // CryptoCompare can handle multiple symbols in one request
    try {
      const data = await this.makeRequest('CryptoCompare', '/pricemultifull', {
        fsyms: symbols.join(','),
        tsyms: 'USD'
      });

      if (data.RAW) {
        for (const symbol of symbols) {
          if (data.RAW[symbol] && data.RAW[symbol].USD) {
            const coinData = data.RAW[symbol].USD;
            prices.push({
              symbol: symbol,
              price: coinData.PRICE || 0,
              change24h: coinData.CHANGE24HOUR || 0,
              changePercent24h: coinData.CHANGEPCT24HOUR || 0,
              volume24h: coinData.VOLUME24HOUR || 0,
              marketCap: coinData.MKTCAP || 0,
              lastUpdated: new Date(coinData.LASTUPDATE * 1000).toISOString(),
              source: 'CryptoCompare'
            });
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get CryptoCompare prices:', error);
    }

    return prices;
  }

  async getMarketData(): Promise<MarketData> {
    const cacheKey = this.getCacheKey('marketData', {});
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const providers = Array.from(this.providers.values())
      .filter(p => p.isActive && p.endpoints.marketData)
      .sort((a, b) => a.priority - b.priority);

    for (const provider of providers) {
      try {
        let marketData: MarketData;

        switch (provider.name) {
          case 'CoinGecko':
            marketData = await this.getCoinGeckoMarketData();
            break;
          case 'CoinMarketCap':
            marketData = await this.getCoinMarketCapMarketData();
            break;
          case 'Coinpaprika':
            marketData = await this.getCoinpaprikaMarketData();
            break;
          default:
            continue;
        }

        this.setCache(cacheKey, marketData);
        return marketData;
      } catch (error) {
        console.warn(`Failed to get market data from ${provider.name}:`, error);
        continue;
      }
    }

    throw new Error('All market data providers failed');
  }

  private async getCoinGeckoMarketData(): Promise<MarketData> {
    const data = await this.makeRequest('CoinGecko', '/global', {});

    return {
      totalMarketCap: data.data.total_market_cap.usd,
      totalVolume24h: data.data.total_volume.usd,
      btcDominance: data.data.market_cap_percentage.btc,
      activeCryptocurrencies: data.data.active_cryptocurrencies,
      lastUpdated: new Date().toISOString()
    };
  }

  private async getCoinMarketCapMarketData(): Promise<MarketData> {
    const data = await this.makeRequest('CoinMarketCap', '/global-metrics/quotes/latest', {});

    return {
      totalMarketCap: data.data.quote.USD.total_market_cap,
      totalVolume24h: data.data.quote.USD.total_volume_24h,
      btcDominance: data.data.btc_dominance,
      activeCryptocurrencies: data.data.active_cryptocurrencies,
      lastUpdated: data.data.last_updated
    };
  }

  private async getCoinpaprikaMarketData(): Promise<MarketData> {
    const data = await this.makeRequest('Coinpaprika', '/global', {});

    return {
      totalMarketCap: data.market_cap_usd,
      totalVolume24h: data.volume_24h_usd,
      btcDominance: data.bitcoin_dominance_percentage,
      activeCryptocurrencies: data.cryptocurrencies_number,
      lastUpdated: new Date().toISOString()
    };
  }

  async getNews(limit: number = 10): Promise<NewsItem[]> {
    const cacheKey = this.getCacheKey('news', { limit });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const providers = Array.from(this.providers.values())
      .filter(p => p.isActive && p.endpoints.news)
      .sort((a, b) => a.priority - b.priority);

    for (const provider of providers) {
      try {
        let news: NewsItem[] = [];

        switch (provider.name) {
          case 'CoinGecko':
            news = await this.getCoinGeckoNews(limit);
            break;
          case 'CryptoCompare':
            news = await this.getCryptoCompareNews(limit);
            break;
          default:
            continue;
        }

        if (news.length > 0) {
          this.setCache(cacheKey, news);
          return news;
        }
      } catch (error) {
        console.warn(`Failed to get news from ${provider.name}:`, error);
        continue;
      }
    }

    return []; // Return empty array if all providers fail
  }

  private async getCoinGeckoNews(limit: number): Promise<NewsItem[]> {
    const data = await this.makeRequest('CoinGecko', '/news', {});

    return data.data.slice(0, limit).map((item: any) => ({
      title: item.title,
      description: item.description,
      url: item.url,
      source: item.news_site,
      publishedAt: item.published_at
    }));
  }

  private async getCryptoCompareNews(limit: number): Promise<NewsItem[]> {
    const data = await this.makeRequest('CryptoCompare', '/v2/news/', {
      lang: 'EN',
      sortOrder: 'latest'
    });

    return data.Data.slice(0, limit).map((item: any) => ({
      title: item.title,
      description: item.body,
      url: item.url,
      source: item.source_info.name,
      publishedAt: new Date(item.published_on * 1000).toISOString()
    }));
  }

  // Health check for all providers
  async checkProvidersHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, provider] of this.providers) {
      try {
        // Simple health check - try to make a basic request
        if (provider.endpoints.prices) {
          await this.makeRequest(name, provider.endpoints.prices, { limit: 1 });
        }
        health[name] = true;
      } catch (error) {
        health[name] = false;
      }
    }

    return health;
  }

  // Get provider statistics
  getProviderStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name, provider] of this.providers) {
      const rateLimiter = this.rateLimiters.get(name)!;
      stats[name] = {
        isActive: provider.isActive,
        priority: provider.priority,
        rateLimit: provider.rateLimit,
        currentUsage: rateLimiter.count,
        resetTime: new Date(rateLimiter.resetTime).toISOString()
      };
    }

    return stats;
  }
}

export const cryptoAPIManager = new CryptoAPIManager();
