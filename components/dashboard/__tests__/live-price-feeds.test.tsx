import { render, screen } from '@testing-library/react';
import { LivePriceFeeds } from '../live-price-feeds';

// Mock the useDynamicMarketData hook
jest.mock('@/hooks/use-dynamic-market-data', () => ({
  useDynamicMarketData: () => ({
    marketData: new Map([
      ['BTC-USD', {
        symbol: 'BTC-USD',
        price: 45000,
        change: 1250,
        changePercent: 2.85,
        volume: 1500000000,
        high24h: 46000,
        low24h: 43500,
        bid: 44995,
        ask: 45005,
        bidSize: 1.5,
        askSize: 2.1,
        timestamp: Date.now()
      }]
    ]),
    products: new Map([
      ['BTC-USD', {
        id: 1,
        symbol: 'BTC-USD',
        description: 'Bitcoin USD',
        productType: 'spot',
        underlyingAsset: 'BTC',
        quotingAsset: 'USD',
        settlingAsset: 'USD',
        tradingStatus: 'online',
        state: 'active'
      }]
    ]),
    connectionStatus: 'connected',
    lastUpdate: Date.now(),
    isLoading: false,
    error: null
  })
}));

describe('LivePriceFeeds Component', () => {
  const defaultProps = {
    theme: 'light' as const,
    autoRefresh: true,
    refreshInterval: 1000
  };

  beforeEach(() => {
    // Mock console.error to catch any runtime errors
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render without runtime errors when data is complete', () => {
    render(<LivePriceFeeds {...defaultProps} />);
    
    // Should display the price card without errors
    expect(screen.getByText('BTC-USD')).toBeInTheDocument();
    expect(screen.getByText('$45,000.00')).toBeInTheDocument();
    expect(screen.getByText('+2.85%')).toBeInTheDocument();
  });

  it('should handle undefined changePercent gracefully', () => {
    // Mock data with undefined changePercent
    const mockHook = require('@/hooks/use-dynamic-market-data');
    mockHook.useDynamicMarketData.mockReturnValue({
      marketData: new Map([
        ['BTC-USD', {
          symbol: 'BTC-USD',
          price: 45000,
          change: 1250,
          changePercent: undefined, // This should not cause an error
          volume: 1500000000,
          high24h: 46000,
          low24h: 43500,
          bid: 44995,
          ask: 45005,
          bidSize: 1.5,
          askSize: 2.1,
          timestamp: Date.now()
        }]
      ]),
      products: new Map([
        ['BTC-USD', {
          id: 1,
          symbol: 'BTC-USD',
          description: 'Bitcoin USD',
          productType: 'spot',
          underlyingAsset: 'BTC',
          quotingAsset: 'USD',
          settlingAsset: 'USD',
          tradingStatus: 'online',
          state: 'active'
        }]
      ]),
      connectionStatus: 'connected',
      lastUpdate: Date.now(),
      isLoading: false,
      error: null
    });

    render(<LivePriceFeeds {...defaultProps} />);
    
    // Should display fallback value instead of crashing
    expect(screen.getByText('0.00%')).toBeInTheDocument();
    
    // Should not have any console errors
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Cannot read properties of undefined')
    );
  });

  it('should handle undefined price properties gracefully', () => {
    const mockHook = require('@/hooks/use-dynamic-market-data');
    mockHook.useDynamicMarketData.mockReturnValue({
      marketData: new Map([
        ['BTC-USD', {
          symbol: 'BTC-USD',
          price: undefined,
          change: undefined,
          changePercent: undefined,
          volume: undefined,
          high24h: undefined,
          low24h: undefined,
          bid: undefined,
          ask: undefined,
          bidSize: 1.5,
          askSize: 2.1,
          timestamp: Date.now()
        }]
      ]),
      products: new Map([
        ['BTC-USD', {
          id: 1,
          symbol: 'BTC-USD',
          description: 'Bitcoin USD',
          productType: 'spot',
          underlyingAsset: 'BTC',
          quotingAsset: 'USD',
          settlingAsset: 'USD',
          tradingStatus: 'online',
          state: 'active'
        }]
      ]),
      connectionStatus: 'connected',
      lastUpdate: Date.now(),
      isLoading: false,
      error: null
    });

    render(<LivePriceFeeds {...defaultProps} />);
    
    // Should display fallback values instead of crashing
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('0.00%')).toBeInTheDocument();
    
    // Should not have any runtime errors
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Cannot read properties of undefined')
    );
  });

  it('should handle null and NaN values in safeToFixed function', () => {
    const mockHook = require('@/hooks/use-dynamic-market-data');
    mockHook.useDynamicMarketData.mockReturnValue({
      marketData: new Map([
        ['BTC-USD', {
          symbol: 'BTC-USD',
          price: NaN,
          change: null,
          changePercent: NaN,
          volume: null,
          high24h: NaN,
          low24h: null,
          bid: NaN,
          ask: null,
          bidSize: 1.5,
          askSize: 2.1,
          timestamp: Date.now()
        }]
      ]),
      products: new Map([
        ['BTC-USD', {
          id: 1,
          symbol: 'BTC-USD',
          description: 'Bitcoin USD',
          productType: 'spot',
          underlyingAsset: 'BTC',
          quotingAsset: 'USD',
          settlingAsset: 'USD',
          tradingStatus: 'online',
          state: 'active'
        }]
      ]),
      connectionStatus: 'connected',
      lastUpdate: Date.now(),
      isLoading: false,
      error: null
    });

    render(<LivePriceFeeds {...defaultProps} />);
    
    // Should handle NaN and null values gracefully
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('0.00%')).toBeInTheDocument();
  });
});
