/**
 * Pinecone Vector Database Service
 * Handles vector storage and retrieval for ML features and trading patterns
 */

export interface VectorMetadata {
  symbol: string;
  timestamp: number;
  type: 'price_pattern' | 'sentiment' | 'technical_indicator' | 'market_regime' | 'trading_signal';
  timeframe: string;
  source: string;
  confidence?: number;
  [key: string]: any;
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

export interface QueryResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
  values?: number[];
}

export interface SimilaritySearchOptions {
  topK?: number;
  filter?: Record<string, any>;
  includeValues?: boolean;
  includeMetadata?: boolean;
}

export class PineconeService {
  private readonly apiKey: string;
  private readonly environment: string;
  private readonly indexName: string;
  private readonly baseUrl: string;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 300000; // 5 minutes

  constructor(
    apiKey?: string,
    environment: string = 'us-west1-gcp-free',
    indexName: string = 'crypto-trading-patterns'
  ) {
    this.apiKey = apiKey || process.env.PINECONE_API_KEY || '';
    this.environment = environment;
    this.indexName = indexName;
    this.baseUrl = `https://${indexName}-${environment}.svc.pinecone.io`;
    
    if (!this.apiKey) {
      console.warn('Pinecone API key not provided. Service will use mock data.');
    }
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Pinecone API key not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinecone API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (response.status === 204) {
      return null; // No content
    }

    return await response.json();
  }

  private getCacheKey(method: string, params: any): string {
    return `pinecone_${method}_${JSON.stringify(params)}`;
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

  async upsertVectors(vectors: VectorRecord[]): Promise<void> {
    if (!this.apiKey) {
      console.log('Mock: Would upsert', vectors.length, 'vectors to Pinecone');
      return;
    }

    try {
      await this.makeRequest('/vectors/upsert', 'POST', {
        vectors: vectors.map(v => ({
          id: v.id,
          values: v.values,
          metadata: v.metadata
        }))
      });

      console.log(`Successfully upserted ${vectors.length} vectors to Pinecone`);
    } catch (error) {
      console.error('Failed to upsert vectors:', error);
      throw error;
    }
  }

  async queryVectors(
    vector: number[],
    options: SimilaritySearchOptions = {}
  ): Promise<QueryResult[]> {
    const {
      topK = 10,
      filter = {},
      includeValues = false,
      includeMetadata = true
    } = options;

    const cacheKey = this.getCacheKey('query', { vector: vector.slice(0, 5), topK, filter });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (!this.apiKey) {
      return this.getMockQueryResults(topK);
    }

    try {
      const response = await this.makeRequest('/query', 'POST', {
        vector,
        topK,
        filter,
        includeValues,
        includeMetadata
      });

      const results = response.matches || [];
      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Failed to query vectors:', error);
      return this.getMockQueryResults(topK);
    }
  }

  async findSimilarPatterns(
    patternVector: number[],
    symbol?: string,
    patternType?: string,
    topK: number = 5
  ): Promise<QueryResult[]> {
    const filter: Record<string, any> = {};
    
    if (symbol) {
      filter.symbol = symbol;
    }
    
    if (patternType) {
      filter.type = patternType;
    }

    return this.queryVectors(patternVector, {
      topK,
      filter,
      includeValues: false,
      includeMetadata: true
    });
  }

  async storeTradingPattern(
    symbol: string,
    patternType: 'price_pattern' | 'sentiment' | 'technical_indicator',
    vector: number[],
    metadata: Partial<VectorMetadata> = {}
  ): Promise<string> {
    const id = `${symbol}_${patternType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const vectorRecord: VectorRecord = {
      id,
      values: vector,
      metadata: {
        symbol,
        timestamp: Date.now(),
        type: patternType,
        timeframe: '1h',
        source: 'crypto-trader',
        ...metadata
      }
    };

    await this.upsertVectors([vectorRecord]);
    return id;
  }

  async storeMarketRegime(
    regime: 'bull' | 'bear' | 'sideways' | 'volatile',
    features: number[],
    symbols: string[],
    confidence: number
  ): Promise<string> {
    const id = `market_regime_${regime}_${Date.now()}`;
    
    const vectorRecord: VectorRecord = {
      id,
      values: features,
      metadata: {
        symbol: symbols.join(','),
        timestamp: Date.now(),
        type: 'market_regime',
        timeframe: '1d',
        source: 'market-analysis',
        confidence,
        regime,
        symbolCount: symbols.length
      }
    };

    await this.upsertVectors([vectorRecord]);
    return id;
  }

  async findSimilarMarketConditions(
    currentFeatures: number[],
    topK: number = 10
  ): Promise<QueryResult[]> {
    return this.queryVectors(currentFeatures, {
      topK,
      filter: { type: 'market_regime' },
      includeValues: false,
      includeMetadata: true
    });
  }

  async deleteVectors(ids: string[]): Promise<void> {
    if (!this.apiKey) {
      console.log('Mock: Would delete vectors:', ids);
      return;
    }

    try {
      await this.makeRequest('/vectors/delete', 'POST', {
        ids
      });

      console.log(`Successfully deleted ${ids.length} vectors from Pinecone`);
    } catch (error) {
      console.error('Failed to delete vectors:', error);
      throw error;
    }
  }

  async getIndexStats(): Promise<any> {
    if (!this.apiKey) {
      return {
        totalVectorCount: 1000,
        dimension: 128,
        indexFullness: 0.1,
        namespaces: {
          '': {
            vectorCount: 1000
          }
        }
      };
    }

    try {
      return await this.makeRequest('/describe_index_stats', 'POST');
    } catch (error) {
      console.error('Failed to get index stats:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      await this.getIndexStats();
      return true;
    } catch (error) {
      console.error('Pinecone health check failed:', error);
      return false;
    }
  }

  private getMockQueryResults(topK: number): QueryResult[] {
    const mockResults: QueryResult[] = [];
    
    for (let i = 0; i < Math.min(topK, 5); i++) {
      mockResults.push({
        id: `mock_pattern_${i}`,
        score: 0.9 - (i * 0.1),
        metadata: {
          symbol: ['BTC', 'ETH', 'ADA', 'SOL', 'DOT'][i],
          timestamp: Date.now() - (i * 3600000),
          type: 'price_pattern',
          timeframe: '1h',
          source: 'mock-data',
          confidence: 0.8 - (i * 0.1)
        }
      });
    }
    
    return mockResults;
  }

  // Utility method to create embeddings from price data
  static createPricePatternEmbedding(prices: number[], volumes: number[] = []): number[] {
    const embedding: number[] = [];
    
    // Normalize prices to relative changes
    for (let i = 1; i < prices.length; i++) {
      const change = (prices[i] - prices[i-1]) / prices[i-1];
      embedding.push(change);
    }
    
    // Add volume features if available
    if (volumes.length > 0) {
      for (let i = 1; i < volumes.length; i++) {
        const volumeChange = (volumes[i] - volumes[i-1]) / volumes[i-1];
        embedding.push(volumeChange);
      }
    }
    
    // Pad or truncate to fixed size (128 dimensions)
    const targetSize = 128;
    while (embedding.length < targetSize) {
      embedding.push(0);
    }
    
    return embedding.slice(0, targetSize);
  }

  // Utility method to create embeddings from technical indicators
  static createTechnicalIndicatorEmbedding(indicators: Record<string, number>): number[] {
    const embedding: number[] = [];
    
    // Common technical indicators
    const indicatorKeys = [
      'rsi', 'macd', 'macd_signal', 'macd_histogram',
      'bb_upper', 'bb_middle', 'bb_lower', 'bb_width',
      'sma_20', 'sma_50', 'sma_200',
      'ema_12', 'ema_26',
      'stoch_k', 'stoch_d',
      'atr', 'adx', 'cci', 'williams_r'
    ];
    
    for (const key of indicatorKeys) {
      embedding.push(indicators[key] || 0);
    }
    
    // Pad to 128 dimensions
    while (embedding.length < 128) {
      embedding.push(0);
    }
    
    return embedding.slice(0, 128);
  }
}

export const pineconeService = new PineconeService();
