/**
 * Santiment API Service
 * Provides cryptocurrency sentiment analysis and on-chain data
 */

export interface SantimentMetric {
  datetime: string;
  value: number;
}

export interface SantimentSocialData {
  symbol: string;
  socialSentiment: number;
  socialVolume: number;
  socialDominance: number;
  lastUpdated: string;
}

export interface SantimentOnChainData {
  symbol: string;
  activeAddresses: number;
  transactionVolume: number;
  networkGrowth: number;
  circulation: number;
  velocity: number;
  lastUpdated: string;
}

export interface SantimentPriceData {
  symbol: string;
  price: number;
  volume: number;
  marketcap: number;
  lastUpdated: string;
}

export class SantimentService {
  private readonly baseUrl = 'https://api.santiment.net/graphql';
  private readonly apiKey: string;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 300000; // 5 minutes

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SANTIMENT_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Santiment API key not provided. Service will use mock data.');
    }
  }

  private async makeGraphQLRequest(query: string, variables: Record<string, any> = {}): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Santiment API key not configured');
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Apikey ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`Santiment API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  private getCacheKey(method: string, params: any): string {
    return `santiment_${method}_${JSON.stringify(params)}`;
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

  async getSocialSentiment(symbols: string[], days: number = 1): Promise<SantimentSocialData[]> {
    const cacheKey = this.getCacheKey('social_sentiment', { symbols, days });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (!this.apiKey) {
      return this.getMockSocialData(symbols);
    }

    const results: SantimentSocialData[] = [];
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const toDate = new Date().toISOString();

    for (const symbol of symbols) {
      try {
        const slug = this.symbolToSlug(symbol);
        
        const query = `
          query($slug: String!, $from: DateTime!, $to: DateTime!) {
            socialSentiment: getMetric(metric: "social_sentiment_positive_total") {
              timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") {
                datetime
                value
              }
            }
            socialVolume: getMetric(metric: "social_volume_total") {
              timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") {
                datetime
                value
              }
            }
            socialDominance: getMetric(metric: "social_dominance_total") {
              timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") {
                datetime
                value
              }
            }
          }
        `;

        const data = await this.makeGraphQLRequest(query, {
          slug,
          from: fromDate,
          to: toDate
        });

        const latestSentiment = data.socialSentiment?.timeseriesData?.slice(-1)[0];
        const latestVolume = data.socialVolume?.timeseriesData?.slice(-1)[0];
        const latestDominance = data.socialDominance?.timeseriesData?.slice(-1)[0];

        results.push({
          symbol,
          socialSentiment: latestSentiment?.value || 0,
          socialVolume: latestVolume?.value || 0,
          socialDominance: latestDominance?.value || 0,
          lastUpdated: new Date().toISOString()
        });

      } catch (error) {
        console.warn('Failed to get Santiment social data for %s:', symbol, error);
        // Add mock data for failed requests
        results.push({
          symbol,
          socialSentiment: Math.random() * 100,
          socialVolume: Math.random() * 1000,
          socialDominance: Math.random() * 10,
          lastUpdated: new Date().toISOString()
        });
      }
    }

    this.setCache(cacheKey, results);
    return results;
  }

  async getOnChainData(symbols: string[], days: number = 1): Promise<SantimentOnChainData[]> {
    const cacheKey = this.getCacheKey('onchain_data', { symbols, days });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (!this.apiKey) {
      return this.getMockOnChainData(symbols);
    }

    const results: SantimentOnChainData[] = [];
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const toDate = new Date().toISOString();

    for (const symbol of symbols) {
      try {
        const slug = this.symbolToSlug(symbol);
        
        const query = `
          query($slug: String!, $from: DateTime!, $to: DateTime!) {
            activeAddresses: getMetric(metric: "active_addresses_24h") {
              timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") {
                datetime
                value
              }
            }
            transactionVolume: getMetric(metric: "transaction_volume") {
              timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") {
                datetime
                value
              }
            }
            networkGrowth: getMetric(metric: "network_growth") {
              timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") {
                datetime
                value
              }
            }
            circulation: getMetric(metric: "circulation") {
              timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") {
                datetime
                value
              }
            }
            velocity: getMetric(metric: "velocity") {
              timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") {
                datetime
                value
              }
            }
          }
        `;

        const data = await this.makeGraphQLRequest(query, {
          slug,
          from: fromDate,
          to: toDate
        });

        const latestActiveAddresses = data.activeAddresses?.timeseriesData?.slice(-1)[0];
        const latestTransactionVolume = data.transactionVolume?.timeseriesData?.slice(-1)[0];
        const latestNetworkGrowth = data.networkGrowth?.timeseriesData?.slice(-1)[0];
        const latestCirculation = data.circulation?.timeseriesData?.slice(-1)[0];
        const latestVelocity = data.velocity?.timeseriesData?.slice(-1)[0];

        results.push({
          symbol,
          activeAddresses: latestActiveAddresses?.value || 0,
          transactionVolume: latestTransactionVolume?.value || 0,
          networkGrowth: latestNetworkGrowth?.value || 0,
          circulation: latestCirculation?.value || 0,
          velocity: latestVelocity?.value || 0,
          lastUpdated: new Date().toISOString()
        });

      } catch (error) {
        console.warn(`Failed to get Santiment on-chain data for ${symbol}:`, error);
        // Add mock data for failed requests
        results.push({
          symbol,
          activeAddresses: Math.floor(Math.random() * 100000),
          transactionVolume: Math.random() * 1000000,
          networkGrowth: Math.random() * 1000,
          circulation: Math.random() * 1000000000,
          velocity: Math.random() * 10,
          lastUpdated: new Date().toISOString()
        });
      }
    }

    this.setCache(cacheKey, results);
    return results;
  }

  private symbolToSlug(symbol: string): string {
    // Map common symbols to Santiment slugs
    const symbolMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'ADA': 'cardano',
      'SOL': 'solana',
      'DOT': 'polkadot',
      'MATIC': 'polygon',
      'AVAX': 'avalanche',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'AAVE': 'aave',
      'COMP': 'compound',
      'MKR': 'maker',
      'SNX': 'synthetix',
      'YFI': 'yearn-finance',
      'SUSHI': 'sushiswap',
      'CRV': 'curve-dao-token',
      'BAL': 'balancer',
      'REN': 'republic-protocol',
      'KNC': 'kyber-network',
      'ZRX': '0x',
      'LRC': 'loopring',
      'BAND': 'band-protocol',
      'OCEAN': 'ocean-protocol'
    };

    return symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
  }

  private getMockSocialData(symbols: string[]): SantimentSocialData[] {
    return symbols.map(symbol => ({
      symbol,
      socialSentiment: Math.random() * 100,
      socialVolume: Math.random() * 1000,
      socialDominance: Math.random() * 10,
      lastUpdated: new Date().toISOString()
    }));
  }

  private getMockOnChainData(symbols: string[]): SantimentOnChainData[] {
    return symbols.map(symbol => ({
      symbol,
      activeAddresses: Math.floor(Math.random() * 100000),
      transactionVolume: Math.random() * 1000000,
      networkGrowth: Math.random() * 1000,
      circulation: Math.random() * 1000000000,
      velocity: Math.random() * 10,
      lastUpdated: new Date().toISOString()
    }));
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const query = `
        query {
          getMetric(metric: "price_usd") {
            metadata {
              metric
            }
          }
        }
      `;

      await this.makeGraphQLRequest(query);
      return true;
    } catch (error) {
      console.error('Santiment health check failed:', error);
      return false;
    }
  }
}

export const santimentService = new SantimentService();
