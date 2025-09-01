import { NextRequest, NextResponse } from 'next/server';
import { cryptoAPIManager } from '@/lib/crypto-apis/api-manager';

/**
 * GET /api/crypto-data/news
 * Fetch cryptocurrency news from multiple providers
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const category = searchParams.get('category');
    const source = searchParams.get('source');
    
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid limit parameter',
          message: 'Limit must be between 1 and 100'
        },
        { status: 400 }
      );
    }

    console.log(`Fetching ${limit} news articles`);

    // Get news from multiple providers
    const news = await cryptoAPIManager.getNews(limit);
    
    // Apply filters
    let filteredNews = news;
    
    if (category) {
      filteredNews = filteredNews.filter(article => 
        article.title.toLowerCase().includes(category.toLowerCase()) ||
        article.description.toLowerCase().includes(category.toLowerCase())
      );
    }
    
    if (source) {
      filteredNews = filteredNews.filter(article => 
        article.source.toLowerCase().includes(source.toLowerCase())
      );
    }

    // Analyze news sentiment (basic keyword analysis)
    const analyzedNews = filteredNews.map(article => ({
      ...article,
      sentiment: analyzeNewsSentiment(article.title + ' ' + article.description),
      keywords: extractKeywords(article.title + ' ' + article.description),
      readingTime: Math.ceil((article.description.split(' ').length) / 200) // ~200 words per minute
    }));

    // Generate news summary
    const summary = {
      totalArticles: analyzedNews.length,
      sources: [...new Set(analyzedNews.map(a => a.source))],
      sentimentDistribution: {
        positive: analyzedNews.filter(a => a.sentiment === 'positive').length,
        negative: analyzedNews.filter(a => a.sentiment === 'negative').length,
        neutral: analyzedNews.filter(a => a.sentiment === 'neutral').length
      },
      topKeywords: getTopKeywords(analyzedNews),
      averageReadingTime: Math.ceil(
        analyzedNews.reduce((sum, a) => sum + a.readingTime, 0) / analyzedNews.length
      ) || 0
    };

    return NextResponse.json({
      success: true,
      data: {
        news: analyzedNews,
        summary,
        metadata: {
          requestedLimit: limit,
          actualCount: analyzedNews.length,
          filters: { category, source },
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error fetching crypto news:', error);
    
    // Return mock news if providers fail
    const mockNews = generateMockNews(10);
    
    return NextResponse.json({
      success: true,
      data: {
        news: mockNews,
        summary: {
          totalArticles: mockNews.length,
          sources: ['Mock News'],
          sentimentDistribution: { positive: 3, negative: 2, neutral: 5 },
          topKeywords: ['Bitcoin', 'Ethereum', 'Crypto', 'Market', 'Price'],
          averageReadingTime: 2
        },
        metadata: {
          warning: 'Using mock data due to provider failures',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      }
    });
  }
}

/**
 * POST /api/crypto-data/news
 * Advanced news search with filtering and analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      keywords = [],
      limit = 20,
      timeframe = '24h',
      sentiment,
      sources = [],
      includeAnalysis = true
    } = body;
    
    if (limit < 1 || limit > 200) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid limit parameter',
          message: 'Limit must be between 1 and 200'
        },
        { status: 400 }
      );
    }

    console.log(`POST: Fetching news with keywords: ${keywords.join(', ')}`);

    // Get news
    const news = await cryptoAPIManager.getNews(limit);
    
    // Apply advanced filtering
    let filteredNews = news;
    
    // Filter by keywords
    if (keywords.length > 0) {
      filteredNews = filteredNews.filter(article => {
        const content = (article.title + ' ' + article.description).toLowerCase();
        return keywords.some(keyword => content.includes(keyword.toLowerCase()));
      });
    }
    
    // Filter by sources
    if (sources.length > 0) {
      filteredNews = filteredNews.filter(article => 
        sources.some(source => article.source.toLowerCase().includes(source.toLowerCase()))
      );
    }
    
    // Filter by timeframe
    const timeframeHours = {
      '1h': 1,
      '6h': 6,
      '24h': 24,
      '7d': 168,
      '30d': 720
    };
    
    const hoursAgo = timeframeHours[timeframe as keyof typeof timeframeHours] || 24;
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    filteredNews = filteredNews.filter(article => 
      new Date(article.publishedAt) > cutoffTime
    );

    // Analyze news if requested
    let analyzedNews = filteredNews;
    if (includeAnalysis) {
      analyzedNews = filteredNews.map(article => ({
        ...article,
        sentiment: analyzeNewsSentiment(article.title + ' ' + article.description),
        keywords: extractKeywords(article.title + ' ' + article.description),
        readingTime: Math.ceil((article.description.split(' ').length) / 200),
        relevanceScore: calculateRelevanceScore(article, keywords)
      }));
      
      // Sort by relevance if keywords provided
      if (keywords.length > 0) {
        analyzedNews.sort((a, b) => b.relevanceScore - a.relevanceScore);
      }
    }
    
    // Filter by sentiment if specified
    if (sentiment) {
      analyzedNews = analyzedNews.filter(article => article.sentiment === sentiment);
    }

    // Generate advanced analytics
    const analytics = {
      totalFound: filteredNews.length,
      sentimentTrends: analyzeSentimentTrends(analyzedNews),
      keywordFrequency: getKeywordFrequency(analyzedNews),
      sourceAnalysis: getSourceAnalysis(analyzedNews),
      timeDistribution: getTimeDistribution(analyzedNews),
      topStories: analyzedNews.slice(0, 5).map(article => ({
        title: article.title,
        source: article.source,
        sentiment: article.sentiment,
        relevanceScore: article.relevanceScore || 0
      }))
    };

    return NextResponse.json({
      success: true,
      data: {
        news: analyzedNews,
        analytics,
        filters: {
          keywords,
          timeframe,
          sentiment,
          sources,
          limit
        },
        metadata: {
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - Date.now() // Would be actual processing time
        }
      }
    });

  } catch (error) {
    console.error('Error in POST news search:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search crypto news',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Helper functions
function analyzeNewsSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const positiveWords = ['bullish', 'surge', 'rally', 'gain', 'rise', 'up', 'growth', 'positive', 'breakthrough', 'adoption'];
  const negativeWords = ['bearish', 'crash', 'fall', 'drop', 'decline', 'down', 'loss', 'negative', 'concern', 'risk'];
  
  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function extractKeywords(text: string): string[] {
  const cryptoKeywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain', 'defi', 'nft', 'altcoin'];
  const lowerText = text.toLowerCase();
  
  return cryptoKeywords.filter(keyword => lowerText.includes(keyword));
}

function getTopKeywords(news: any[]): string[] {
  const keywordCount = new Map();
  
  news.forEach(article => {
    article.keywords.forEach((keyword: string) => {
      keywordCount.set(keyword, (keywordCount.get(keyword) || 0) + 1);
    });
  });
  
  return Array.from(keywordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword]) => keyword);
}

function calculateRelevanceScore(article: any, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  
  const content = (article.title + ' ' + article.description).toLowerCase();
  let score = 0;
  
  keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    const titleMatches = (article.title.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
    const descMatches = (article.description.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
    
    score += titleMatches * 3 + descMatches; // Title matches weighted higher
  });
  
  return score;
}

function analyzeSentimentTrends(news: any[]) {
  const hourlyTrends = new Map();
  
  news.forEach(article => {
    const hour = new Date(article.publishedAt).getHours();
    if (!hourlyTrends.has(hour)) {
      hourlyTrends.set(hour, { positive: 0, negative: 0, neutral: 0 });
    }
    hourlyTrends.get(hour)[article.sentiment]++;
  });
  
  return Object.fromEntries(hourlyTrends);
}

function getKeywordFrequency(news: any[]) {
  const frequency = new Map();
  
  news.forEach(article => {
    if (article.keywords) {
      article.keywords.forEach((keyword: string) => {
        frequency.set(keyword, (frequency.get(keyword) || 0) + 1);
      });
    }
  });
  
  return Object.fromEntries(frequency);
}

function getSourceAnalysis(news: any[]) {
  const sources = new Map();
  
  news.forEach(article => {
    if (!sources.has(article.source)) {
      sources.set(article.source, {
        count: 0,
        sentiments: { positive: 0, negative: 0, neutral: 0 }
      });
    }
    
    const sourceData = sources.get(article.source);
    sourceData.count++;
    sourceData.sentiments[article.sentiment]++;
  });
  
  return Object.fromEntries(sources);
}

function getTimeDistribution(news: any[]) {
  const distribution = new Map();
  
  news.forEach(article => {
    const date = new Date(article.publishedAt).toDateString();
    distribution.set(date, (distribution.get(date) || 0) + 1);
  });
  
  return Object.fromEntries(distribution);
}

function generateMockNews(count: number) {
  const mockTitles = [
    'Bitcoin Reaches New All-Time High Amid Institutional Adoption',
    'Ethereum 2.0 Upgrade Shows Promising Results',
    'Major Bank Announces Cryptocurrency Trading Services',
    'DeFi Protocol Launches Revolutionary Yield Farming Feature',
    'Regulatory Clarity Boosts Crypto Market Confidence',
    'NFT Market Sees Unprecedented Growth in Digital Art',
    'Central Bank Digital Currency Pilot Program Begins',
    'Crypto Exchange Reports Record Trading Volumes',
    'Blockchain Technology Adoption Accelerates in Enterprise',
    'Altcoin Season Brings Massive Gains to Alternative Cryptocurrencies'
  ];
  
  return Array.from({ length: count }, (_, i) => ({
    title: mockTitles[i % mockTitles.length],
    description: `Mock news article description for ${mockTitles[i % mockTitles.length]}. This is placeholder content for testing purposes.`,
    url: `https://example.com/news/${i + 1}`,
    source: 'Mock News',
    publishedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
    sentiment: ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)] as any,
    keywords: ['bitcoin', 'crypto', 'blockchain'],
    readingTime: Math.ceil(Math.random() * 5) + 1
  }));
}
