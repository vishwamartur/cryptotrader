/**
 * Centralized API Configuration Service
 * Manages all API keys and configuration settings
 */

export interface APIConfiguration {
  name: string;
  key?: string;
  isConfigured: boolean;
  isRequired: boolean;
  description: string;
  documentationUrl?: string;
}

export interface DatabaseConfiguration {
  url: string;
  poolMin: number;
  poolMax: number;
  poolIdleTimeout: number;
  poolConnectTimeout: number;
  logging: boolean;
}

export interface ApplicationConfiguration {
  name: string;
  version: string;
  environment: string;
  url: string;
  apiBaseUrl: string;
  wsUrl: string;
  liveMode: boolean;
}

export interface TradingConfiguration {
  mode: 'paper' | 'live';
  riskLevel: 'low' | 'medium' | 'high';
  maxPositionSize: number;
}

export interface FeatureFlags {
  enableAITrading: boolean;
  enableLiveTrading: boolean;
  enableBacktesting: boolean;
  enablePortfolioOptimization: boolean;
}

export class APIConfigService {
  private static instance: APIConfigService;
  private configurations: Map<string, APIConfiguration> = new Map();

  static getInstance(): APIConfigService {
    if (!APIConfigService.instance) {
      APIConfigService.instance = new APIConfigService();
    }
    return APIConfigService.instance;
  }

  constructor() {
    this.initializeConfigurations();
  }

  private initializeConfigurations() {
    // Core APIs (Required)
    this.addConfiguration({
      name: 'Perplexity AI',
      key: process.env.PERPLEXITY_API_KEY,
      isRequired: true,
      description: 'AI-powered market analysis and insights',
      documentationUrl: 'https://docs.perplexity.ai/'
    });

    this.addConfiguration({
      name: 'Delta Exchange',
      key: process.env.DELTA_API_KEY,
      isRequired: true,
      description: 'Cryptocurrency derivatives trading platform',
      documentationUrl: 'https://docs.delta.exchange/'
    });

    // Price Data APIs (Optional but recommended)
    this.addConfiguration({
      name: 'CoinMarketCap',
      key: process.env.COINMARKETCAP_API_KEY,
      isRequired: false,
      description: 'Comprehensive cryptocurrency market data',
      documentationUrl: 'https://coinmarketcap.com/api/documentation/v1/'
    });

    this.addConfiguration({
      name: 'CryptoCompare',
      key: process.env.CRYPTOCOMPARE_API_KEY,
      isRequired: false,
      description: 'Real-time and historical cryptocurrency data',
      documentationUrl: 'https://min-api.cryptocompare.com/documentation'
    });

    this.addConfiguration({
      name: 'CoinAPI',
      key: process.env.COINAPI_KEY,
      isRequired: false,
      description: 'Professional cryptocurrency market data',
      documentationUrl: 'https://docs.coinapi.io/'
    });

    this.addConfiguration({
      name: 'Nomics',
      key: process.env.NOMICS_API_KEY,
      isRequired: false,
      description: 'Cryptocurrency market data and analytics',
      documentationUrl: 'https://nomics.com/docs/'
    });

    this.addConfiguration({
      name: 'CoinLayer',
      key: process.env.COINLAYER_API_KEY,
      isRequired: false,
      description: 'Real-time cryptocurrency exchange rates',
      documentationUrl: 'https://coinlayer.com/documentation'
    });

    // Sentiment Analysis APIs (Optional)
    this.addConfiguration({
      name: 'Santiment',
      key: process.env.SANTIMENT_API_KEY,
      isRequired: false,
      description: 'Social sentiment and on-chain metrics',
      documentationUrl: 'https://api.santiment.net/graphql'
    });

    this.addConfiguration({
      name: 'Predicoin',
      key: process.env.PREDICOIN_API_KEY,
      isRequired: false,
      description: 'News sentiment from 100+ sources',
      documentationUrl: 'https://predicoin.com/api'
    });

    this.addConfiguration({
      name: 'BittsAnalytics',
      key: process.env.BITTSANALYTICS_API_KEY,
      isRequired: false,
      description: 'Social media sentiment analysis',
      documentationUrl: 'https://bittsanalytics.com/api'
    });

    this.addConfiguration({
      name: 'Mosaic',
      key: process.env.MOSAIC_API_KEY,
      isRequired: false,
      description: 'Comprehensive cryptoasset coverage',
      documentationUrl: 'https://mosaic.io/api'
    });

    this.addConfiguration({
      name: 'Decryptz',
      key: process.env.DECRYPTZ_API_KEY,
      isRequired: false,
      description: 'Enterprise-grade sentiment data',
      documentationUrl: 'https://decryptz.com/api'
    });

    this.addConfiguration({
      name: 'Daneel',
      key: process.env.DANEEL_API_KEY,
      isRequired: false,
      description: 'AI-powered market sentiment analysis',
      documentationUrl: 'https://daneel.io/api'
    });

    // News & Data APIs (Optional)
    this.addConfiguration({
      name: 'Kaiko',
      key: process.env.KAIKO_API_KEY,
      isRequired: false,
      description: 'Institutional market data',
      documentationUrl: 'https://docs.kaiko.com/'
    });

    this.addConfiguration({
      name: 'Blockmarkets',
      key: process.env.BLOCKMARKETS_API_KEY,
      isRequired: false,
      description: 'Professional data feeds',
      documentationUrl: 'https://blockmarkets.io/api'
    });

    this.addConfiguration({
      name: 'Zloadr',
      key: process.env.ZLOADR_API_KEY,
      isRequired: false,
      description: 'Cryptocurrency news aggregation',
      documentationUrl: 'https://zloadr.com/api'
    });

    this.addConfiguration({
      name: 'DataLight',
      key: process.env.DATALIGHT_API_KEY,
      isRequired: false,
      description: 'Blockchain analytics and insights',
      documentationUrl: 'https://datalight.me/api'
    });

    // Vector Database (Optional but recommended for ML)
    this.addConfiguration({
      name: 'Pinecone',
      key: process.env.PINECONE_API_KEY,
      isRequired: false,
      description: 'Vector database for ML features',
      documentationUrl: 'https://docs.pinecone.io/'
    });
  }

  private addConfiguration(config: Omit<APIConfiguration, 'isConfigured'>) {
    const fullConfig: APIConfiguration = {
      ...config,
      isConfigured: !!config.key && config.key.trim() !== ''
    };
    
    this.configurations.set(config.name, fullConfig);
  }

  getConfiguration(name: string): APIConfiguration | null {
    return this.configurations.get(name) || null;
  }

  getAllConfigurations(): APIConfiguration[] {
    return Array.from(this.configurations.values());
  }

  getConfiguredAPIs(): APIConfiguration[] {
    return this.getAllConfigurations().filter(config => config.isConfigured);
  }

  getUnconfiguredAPIs(): APIConfiguration[] {
    return this.getAllConfigurations().filter(config => !config.isConfigured);
  }

  getRequiredAPIs(): APIConfiguration[] {
    return this.getAllConfigurations().filter(config => config.isRequired);
  }

  getMissingRequiredAPIs(): APIConfiguration[] {
    return this.getRequiredAPIs().filter(config => !config.isConfigured);
  }

  getDatabaseConfiguration(): DatabaseConfiguration {
    return {
      url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/cryptotrader',
      poolMin: parseInt(process.env.DB_POOL_MIN || '2'),
      poolMax: parseInt(process.env.DB_POOL_MAX || '20'),
      poolIdleTimeout: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '20000'),
      poolConnectTimeout: parseInt(process.env.DB_POOL_CONNECT_TIMEOUT || '10000'),
      logging: process.env.DB_LOGGING === 'true'
    };
  }

  getApplicationConfiguration(): ApplicationConfiguration {
    return {
      name: process.env.NEXT_PUBLIC_APP_NAME || 'CryptoTrader',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api',
      wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
      liveMode: true // Always live mode - no demo mode support
    };
  }

  getTradingConfiguration(): TradingConfiguration {
    return {
      mode: (process.env.TRADING_MODE as 'paper' | 'live') || 'paper',
      riskLevel: (process.env.RISK_LEVEL as 'low' | 'medium' | 'high') || 'medium',
      maxPositionSize: parseInt(process.env.MAX_POSITION_SIZE || '1000')
    };
  }

  getFeatureFlags(): FeatureFlags {
    return {
      enableAITrading: process.env.NEXT_PUBLIC_ENABLE_AI_TRADING === 'true',
      enableLiveTrading: process.env.NEXT_PUBLIC_ENABLE_LIVE_TRADING === 'true',
      enableBacktesting: process.env.NEXT_PUBLIC_ENABLE_BACKTESTING === 'true',
      enablePortfolioOptimization: process.env.NEXT_PUBLIC_ENABLE_PORTFOLIO_OPTIMIZATION === 'true'
    };
  }

  getConfigurationSummary() {
    const all = this.getAllConfigurations();
    const configured = this.getConfiguredAPIs();
    const required = this.getRequiredAPIs();
    const missingRequired = this.getMissingRequiredAPIs();

    return {
      total: all.length,
      configured: configured.length,
      configurationRate: Math.round((configured.length / all.length) * 100),
      required: required.length,
      missingRequired: missingRequired.length,
      isFullyConfigured: missingRequired.length === 0,
      categories: {
        priceData: all.filter(api => 
          ['CoinMarketCap', 'CryptoCompare', 'CoinAPI', 'Nomics', 'CoinLayer'].includes(api.name)
        ).length,
        sentiment: all.filter(api => 
          ['Santiment', 'Predicoin', 'BittsAnalytics', 'Mosaic', 'Decryptz', 'Daneel'].includes(api.name)
        ).length,
        newsData: all.filter(api => 
          ['Kaiko', 'Blockmarkets', 'Zloadr', 'DataLight'].includes(api.name)
        ).length,
        core: required.length,
        ml: all.filter(api => api.name === 'Pinecone').length
      }
    };
  }

  validateConfiguration(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required APIs
    const missingRequired = this.getMissingRequiredAPIs();
    if (missingRequired.length > 0) {
      errors.push(`Missing required API keys: ${missingRequired.map(api => api.name).join(', ')}`);
    }

    // Check database configuration
    const dbConfig = this.getDatabaseConfiguration();
    if (!dbConfig.url) {
      errors.push('Database URL is not configured');
    }

    // Check if at least one price data provider is configured
    const priceProviders = ['CoinMarketCap', 'CryptoCompare', 'CoinAPI'];
    const configuredPriceProviders = priceProviders.filter(name => 
      this.getConfiguration(name)?.isConfigured
    );
    
    if (configuredPriceProviders.length === 0) {
      warnings.push('No premium price data providers configured. Using free providers only.');
    }

    // Check sentiment providers
    const sentimentProviders = ['Santiment', 'Predicoin', 'BittsAnalytics'];
    const configuredSentimentProviders = sentimentProviders.filter(name => 
      this.getConfiguration(name)?.isConfigured
    );
    
    if (configuredSentimentProviders.length === 0) {
      warnings.push('No sentiment analysis providers configured. Sentiment features will use mock data.');
    }

    // Check ML features
    if (!this.getConfiguration('Pinecone')?.isConfigured) {
      warnings.push('Pinecone not configured. ML pattern matching features will use mock data.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export const apiConfigService = APIConfigService.getInstance();
