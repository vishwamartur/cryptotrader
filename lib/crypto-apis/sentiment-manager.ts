/**
 * Cryptocurrency Sentiment Analysis API Manager
 * Integrates multiple sentiment data providers
 */

import { santimentService, SantimentSocialData } from './santiment-service';

export interface SentimentData {
  symbol: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number; // -1 to 1 (-1 = very bearish, 1 = very bullish)
  confidence: number; // 0 to 1
  sources: string[];
  socialVolume: number;
  newsVolume: number;
  lastUpdated: string;
  details?: {
    fear_greed_index?: number;
    social_sentiment?: number;
    news_sentiment?: number;
    technical_sentiment?: number;
  };
}

export interface SentimentProvider {
  name: string;
  baseUrl: string;
  apiKey?: string;
  rateLimit: number;
  priority: number;
  isActive: boolean;
  endpoints: {
    sentiment?: string;
    social?: string;
    news?: string;
  };
}

export class SentimentAPIManager {
  private providers: Map<string, SentimentProvider> = new Map();
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 300000; // 5 minutes for sentiment data

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Free/Demo providers
    this.addProvider({
      name: 'CryptoQokka',
      baseUrl: 'https://api.cryptoqokka.com/v1',
      rateLimit: 60,
      priority: 4,
      isActive: true,
      endpoints: {
        sentiment: '/sentiment'
      }
    });

    // API key required providers
    if (process.env.SANTIMENT_API_KEY) {
      this.addProvider({
        name: 'Santiment',
        baseUrl: 'https://api.santiment.net/graphql',
        apiKey: process.env.SANTIMENT_API_KEY,
        rateLimit: 100,
        priority: 1,
        isActive: true,
        endpoints: {
          sentiment: '/graphql',
          social: '/graphql'
        }
      });
    }

    if (process.env.PREDICOIN_API_KEY) {
      this.addProvider({
        name: 'Predicoin',
        baseUrl: 'https://api.predicoin.com/v1',
        apiKey: process.env.PREDICOIN_API_KEY,
        rateLimit: 100,
        priority: 2,
        isActive: true,
        endpoints: {
          sentiment: '/sentiment',
          news: '/news-sentiment'
        }
      });
    }

    if (process.env.BITTSANALYTICS_API_KEY) {
      this.addProvider({
        name: 'BittsAnalytics',
        baseUrl: 'https://api.bittsanalytics.com/v1',
        apiKey: process.env.BITTSANALYTICS_API_KEY,
        rateLimit: 50,
        priority: 3,
        isActive: true,
        endpoints: {
          sentiment: '/sentiment',
          social: '/social-sentiment'
        }
      });
    }

    if (process.env.MOSAIC_API_KEY) {
      this.addProvider({
        name: 'Mosaic',
        baseUrl: 'https://api.mosaic.io/v1',
        apiKey: process.env.MOSAIC_API_KEY,
        rateLimit: 100,
        priority: 2,
        isActive: true,
        endpoints: {
          sentiment: '/sentiment'
        }
      });
    }

    if (process.env.DECRYPTZ_API_KEY) {
      this.addProvider({
        name: 'Decryptz',
        baseUrl: 'https://api.decryptz.com/v1',
        apiKey: process.env.DECRYPTZ_API_KEY,
        rateLimit: 200,
        priority: 1,
        isActive: true,
        endpoints: {
          sentiment: '/sentiment',
          social: '/social',
          news: '/news'
        }
      });
    }

    if (process.env.DANEEL_API_KEY) {
      this.addProvider({
        name: 'Daneel',
        baseUrl: 'https://api.daneel.io/v1',
        apiKey: process.env.DANEEL_API_KEY,
        rateLimit: 100,
        priority: 3,
        isActive: true,
        endpoints: {
          sentiment: '/sentiment',
          news: '/market-news'
        }
      });
    }
  }

  private addProvider(provider: SentimentProvider) {
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
    
    // Add API key and params based on provider
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (provider.apiKey) {
      if (providerName === 'Santiment') {
        headers['Authorization'] = `Apikey ${provider.apiKey}`;
      } else {
        headers['X-API-Key'] = provider.apiKey;
      }
    }

    // For GET requests, add params to URL
    if (Object.keys(params).length > 0) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value.toString());
      });
    }

    try {
      const response = await fetch(url.toString(), { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      rateLimiter.count++;
      return await response.json();
    } catch (error) {
      console.error(`Sentiment API request failed for ${providerName}:`, error);
      throw error;
    }
  }

  private getCacheKey(method: string, params: any): string {
    return `sentiment_${method}_${JSON.stringify(params)}`;
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

  async getSentiment(symbols: string[]): Promise<SentimentData[]> {
    const cacheKey = this.getCacheKey('sentiment', symbols);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const providers = Array.from(this.providers.values())
      .filter(p => p.isActive && p.endpoints.sentiment)
      .sort((a, b) => a.priority - b.priority);

    const sentimentData: SentimentData[] = [];

    // Try to get sentiment from multiple providers and aggregate
    for (const provider of providers) {
      try {
        let providerSentiment: SentimentData[] = [];

        switch (provider.name) {
          case 'Santiment':
            providerSentiment = await this.getSantimentData(symbols);
            break;
          case 'Predicoin':
            providerSentiment = await this.getPredicoinSentiment(symbols);
            break;
          case 'BittsAnalytics':
            providerSentiment = await this.getBittsAnalyticsSentiment(symbols);
            break;
          case 'CryptoQokka':
            providerSentiment = await this.getCryptoQokkaSentiment(symbols);
            break;
          default:
            continue;
        }

        // Merge sentiment data
        for (const sentiment of providerSentiment) {
          const existing = sentimentData.find(s => s.symbol === sentiment.symbol);
          if (existing) {
            // Aggregate multiple sources
            existing.sources.push(...sentiment.sources);
            existing.score = (existing.score + sentiment.score) / 2;
            existing.confidence = Math.max(existing.confidence, sentiment.confidence);
            existing.socialVolume += sentiment.socialVolume;
            existing.newsVolume += sentiment.newsVolume;
          } else {
            sentimentData.push(sentiment);
          }
        }
      } catch (error) {
        console.warn(`Failed to get sentiment from ${provider.name}:`, error);
        continue;
      }
    }

    // If we have data, cache and return it
    if (sentimentData.length > 0) {
      this.setCache(cacheKey, sentimentData);
      return sentimentData;
    }

    // Return mock sentiment data if all providers fail
    return this.getMockSentimentData(symbols);
  }

  private async getSantimentData(symbols: string[]): Promise<SentimentData[]> {
    try {
      const socialData = await santimentService.getSocialSentiment(symbols, 1);

      return socialData.map(data => {
        // Convert Santiment social sentiment to our sentiment format
        let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        let score = 0;

        if (data.socialSentiment > 60) {
          sentiment = 'bullish';
          score = (data.socialSentiment - 50) / 50; // Convert to -1 to 1 scale
        } else if (data.socialSentiment < 40) {
          sentiment = 'bearish';
          score = (data.socialSentiment - 50) / 50; // Convert to -1 to 1 scale
        } else {
          sentiment = 'neutral';
          score = (data.socialSentiment - 50) / 100; // Small deviation from neutral
        }

        return {
          symbol: data.symbol,
          sentiment,
          score: Math.max(-1, Math.min(1, score)), // Clamp to -1 to 1
          confidence: 0.8, // High confidence for Santiment data
          sources: ['Santiment'],
          socialVolume: data.socialVolume,
          newsVolume: Math.floor(data.socialDominance * 10), // Approximate news volume
          lastUpdated: data.lastUpdated,
          details: {
            social_sentiment: data.socialSentiment,
            social_dominance: data.socialDominance
          }
        };
      });
    } catch (error) {
      console.warn('Failed to get Santiment data:', error);
      // Return mock data as fallback
      return symbols.map(symbol => ({
        symbol,
        sentiment: 'neutral' as const,
        score: Math.random() * 0.4 - 0.2,
        confidence: 0.3,
        sources: ['Santiment (Mock)'],
        socialVolume: Math.floor(Math.random() * 1000),
        newsVolume: Math.floor(Math.random() * 100),
        lastUpdated: new Date().toISOString()
      }));
    }
  }

  private async getPredicoinSentiment(symbols: string[]): Promise<SentimentData[]> {
    const results: SentimentData[] = [];
    
    for (const symbol of symbols) {
      try {
        const data = await this.makeRequest('Predicoin', '/sentiment', { symbol });
        
        results.push({
          symbol,
          sentiment: data.sentiment || 'neutral',
          score: data.score || 0,
          confidence: data.confidence || 0.5,
          sources: ['Predicoin'],
          socialVolume: data.social_volume || 0,
          newsVolume: data.news_volume || 0,
          lastUpdated: data.timestamp || new Date().toISOString()
        });
      } catch (error) {
        console.warn(`Failed to get Predicoin sentiment for ${symbol}:`, error);
      }
    }
    
    return results;
  }

  private async getBittsAnalyticsSentiment(symbols: string[]): Promise<SentimentData[]> {
    const data = await this.makeRequest('BittsAnalytics', '/sentiment', { 
      symbols: symbols.join(',') 
    });
    
    return data.map((item: any) => ({
      symbol: item.symbol,
      sentiment: item.sentiment,
      score: item.sentiment_score,
      confidence: item.confidence,
      sources: ['BittsAnalytics'],
      socialVolume: item.social_mentions,
      newsVolume: item.news_mentions,
      lastUpdated: item.updated_at
    }));
  }

  private async getCryptoQokkaSentiment(symbols: string[]): Promise<SentimentData[]> {
    const results: SentimentData[] = [];
    
    for (const symbol of symbols) {
      try {
        const data = await this.makeRequest('CryptoQokka', '/sentiment', { coin: symbol });
        
        results.push({
          symbol,
          sentiment: data.overall_sentiment || 'neutral',
          score: (data.sentiment_score || 50) / 50 - 1, // Convert 0-100 to -1 to 1
          confidence: 0.6,
          sources: ['CryptoQokka'],
          socialVolume: data.social_volume || 0,
          newsVolume: data.news_count || 0,
          lastUpdated: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Failed to get CryptoQokka sentiment for %s:', symbol, error);
      }
    }
    
    return results;
  }

  private getMockSentimentData(symbols: string[]): SentimentData[] {
    return symbols.map(symbol => ({
      symbol,
      sentiment: 'neutral' as const,
      score: Math.random() * 0.4 - 0.2, // Random score between -0.2 and 0.2
      confidence: 0.3,
      sources: ['Mock Data'],
      socialVolume: Math.floor(Math.random() * 1000),
      newsVolume: Math.floor(Math.random() * 100),
      lastUpdated: new Date().toISOString(),
      details: {
        fear_greed_index: Math.floor(Math.random() * 100),
        social_sentiment: Math.random() * 2 - 1,
        news_sentiment: Math.random() * 2 - 1,
        technical_sentiment: Math.random() * 2 - 1
      }
    }));
  }

  // Health check for sentiment providers
  async checkProvidersHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        if (provider.endpoints.sentiment) {
          await this.makeRequest(name, provider.endpoints.sentiment, { limit: 1 });
        }
        health[name] = true;
      } catch (error) {
        health[name] = false;
      }
    }
    
    return health;
  }
}

export const sentimentAPIManager = new SentimentAPIManager();
