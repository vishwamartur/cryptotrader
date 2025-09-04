import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedDashboard } from '@/components/unified-dashboard';

// Mock GSAP
jest.mock('gsap', () => ({
  registerPlugin: jest.fn(),
  context: jest.fn(() => ({
    revert: jest.fn()
  })),
  set: jest.fn(),
  to: jest.fn()
}));

jest.mock('gsap/ScrollTrigger', () => ({}));

// Mock components
jest.mock('@/components/market-overview', () => ({
  MarketOverview: () => <div data-testid="market-overview">Market Overview</div>
}));

jest.mock('@/components/portfolio', () => ({
  Portfolio: () => <div data-testid="portfolio">Portfolio</div>
}));

jest.mock('@/components/navigation', () => ({
  Navigation: ({ theme, connectionStatus }: any) => (
    <div data-testid="navigation" data-theme={theme} data-connection={connectionStatus}>
      Navigation
    </div>
  )
}));

jest.mock('@/components/trading-interface', () => ({
  TradingInterface: () => <div data-testid="trading-interface">Trading Interface</div>
}));

jest.mock('@/components/ai-trading-panel', () => ({
  AITradingPanel: () => <div data-testid="ai-trading-panel">AI Trading Panel</div>
}));

jest.mock('@/components/autonomous-agent-panel', () => ({
  AutonomousAgentPanel: () => <div data-testid="autonomous-agent-panel">Autonomous Agent Panel</div>
}));

jest.mock('@/components/risk-dashboard', () => ({
  RiskDashboard: () => <div data-testid="risk-dashboard">Risk Dashboard</div>
}));

jest.mock('@/components/trade-monitor', () => ({
  TradeMonitor: () => <div data-testid="trade-monitor">Trade Monitor</div>
}));

jest.mock('@/components/advanced-trading-panel', () => ({
  AdvancedTradingPanel: () => <div data-testid="advanced-trading-panel">Advanced Trading Panel</div>
}));

// Mock advanced dashboard components
jest.mock('@/components/dashboard/live-price-feeds', () => ({
  LivePriceFeeds: ({ theme }: any) => <div data-testid="live-price-feeds" data-theme={theme}>Live Price Feeds</div>
}));

jest.mock('@/components/dashboard/portfolio-tracker', () => ({
  PortfolioTracker: ({ theme }: any) => <div data-testid="portfolio-tracker" data-theme={theme}>Portfolio Tracker</div>
}));

jest.mock('@/components/dashboard/ai-trading-signals', () => ({
  AITradingSignals: ({ theme }: any) => <div data-testid="ai-trading-signals" data-theme={theme}>AI Trading Signals</div>
}));

jest.mock('@/components/dashboard/system-health', () => ({
  SystemHealth: ({ theme }: any) => <div data-testid="system-health" data-theme={theme}>System Health</div>
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock document methods
Object.defineProperty(document, 'documentElement', {
  value: {
    classList: {
      toggle: jest.fn(),
    },
    requestFullscreen: jest.fn(),
  },
});

Object.defineProperty(document, 'exitFullscreen', {
  value: jest.fn(),
});

describe('UnifiedDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('Initial Render', () => {
    it('should render the unified dashboard with navigation', () => {
      render(<UnifiedDashboard />);
      
      expect(screen.getByTestId('navigation')).toBeInTheDocument();
      expect(screen.getByText('Welcome to CryptoTrader')).toBeInTheDocument();
    });

    it('should show welcome section by default', () => {
      render(<UnifiedDashboard />);
      
      expect(screen.getByText('Welcome to CryptoTrader')).toBeInTheDocument();
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    it('should apply dark theme by default', () => {
      render(<UnifiedDashboard />);
      
      const navigation = screen.getByTestId('navigation');
      expect(navigation).toHaveAttribute('data-theme', 'dark');
    });
  });

  describe('Welcome Flow', () => {
    it('should hide welcome section when Get Started is clicked', async () => {
      render(<UnifiedDashboard />);
      
      const getStartedButton = screen.getByText('Get Started');
      fireEvent.click(getStartedButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Welcome to CryptoTrader')).not.toBeInTheDocument();
      });
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('dashboard-welcome-dismissed', 'true');
    });

    it('should not show welcome section if previously dismissed', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'dashboard-welcome-dismissed') return 'true';
        return null;
      });
      
      render(<UnifiedDashboard />);
      
      expect(screen.queryByText('Welcome to CryptoTrader')).not.toBeInTheDocument();
      expect(screen.getByTestId('market-overview')).toBeInTheDocument();
    });
  });

  describe('View Switching', () => {
    it('should switch between different dashboard views', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'dashboard-welcome-dismissed') return 'true';
        return null;
      });

      render(<UnifiedDashboard />);

      // Should start in overview view
      expect(screen.getByTestId('market-overview')).toBeInTheDocument();
      expect(screen.getByTestId('portfolio')).toBeInTheDocument();

      // Switch to trading view
      const tradingButton = screen.getByText('Trading');
      fireEvent.click(tradingButton);

      await waitFor(() => {
        expect(screen.getByTestId('trading-interface')).toBeInTheDocument();
        expect(screen.getByTestId('ai-trading-panel')).toBeInTheDocument();
      });

      // Switch to analytics view
      const analyticsButton = screen.getByText('Analytics');
      fireEvent.click(analyticsButton);

      await waitFor(() => {
        expect(screen.getByTestId('live-price-feeds')).toBeInTheDocument();
      });
    });

    it('should show correct components in overview view', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'dashboard-welcome-dismissed') return 'true';
        return null;
      });

      render(<UnifiedDashboard />);

      expect(screen.getByTestId('market-overview')).toBeInTheDocument();
      expect(screen.getByTestId('portfolio')).toBeInTheDocument();
      expect(screen.getByTestId('live-price-feeds')).toBeInTheDocument();
      expect(screen.getByTestId('risk-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('system-health')).toBeInTheDocument();
    });

    it('should accept initial view parameter', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'dashboard-welcome-dismissed') return 'true';
        return null;
      });

      render(<UnifiedDashboard initialView="analytics" />);

      // Should start in analytics view
      expect(screen.getByTestId('live-price-feeds')).toBeInTheDocument();
    });
  });

  describe('Theme Management', () => {
    it('should toggle theme when theme button is clicked', async () => {
      render(<UnifiedDashboard />);
      
      const themeButton = screen.getByRole('button', { name: /sun|moon/i });
      fireEvent.click(themeButton);
      
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'dashboard-layout',
          expect.stringContaining('"theme":"light"')
        );
      });
    });

    it('should load saved theme from localStorage', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'dashboard-theme') return 'light';
        return null;
      });
      
      render(<UnifiedDashboard />);
      
      const navigation = screen.getByTestId('navigation');
      expect(navigation).toHaveAttribute('data-theme', 'light');
    });
  });

  describe('Connection Status', () => {
    it('should show connection status in navigation', () => {
      render(<UnifiedDashboard />);
      
      const navigation = screen.getByTestId('navigation');
      expect(navigation).toHaveAttribute('data-connection', 'connecting');
    });

    it('should update connection status to connected', async () => {
      render(<UnifiedDashboard />);
      
      await waitFor(() => {
        const navigation = screen.getByTestId('navigation');
        expect(navigation).toHaveAttribute('data-connection', 'connected');
      });
    });
  });

  describe('Dashboard Controls', () => {
    it('should toggle notifications when notification button is clicked', async () => {
      render(<UnifiedDashboard />);
      
      const notificationButton = screen.getByRole('button', { name: /bell/i });
      fireEvent.click(notificationButton);
      
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'dashboard-layout',
          expect.stringContaining('"notifications":false')
        );
      });
    });

    it('should export dashboard data when export button is clicked', () => {
      // Mock URL.createObjectURL and related methods
      const mockCreateObjectURL = jest.fn(() => 'mock-url');
      const mockRevokeObjectURL = jest.fn();
      const mockClick = jest.fn();
      
      Object.defineProperty(URL, 'createObjectURL', { value: mockCreateObjectURL });
      Object.defineProperty(URL, 'revokeObjectURL', { value: mockRevokeObjectURL });
      
      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick,
      };
      
      jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      
      render(<UnifiedDashboard />);
      
      const exportButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(exportButton);
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-url');
    });

    it('should toggle fullscreen when fullscreen button is clicked', () => {
      render(<UnifiedDashboard />);
      
      const fullscreenButton = screen.getByRole('button', { name: /maximize2|minimize2/i });
      fireEvent.click(fullscreenButton);
      
      expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
    });
  });

  describe('Data Attributes', () => {
    it('should add data attributes for navigation quick actions', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'dashboard-welcome-dismissed') return 'true';
        return null;
      });
      
      render(<UnifiedDashboard />);
      fireEvent.click(screen.getByText('Trading'));

      const aiTradingPanel = screen.getByTestId('ai-trading-panel').closest('[data-component="ai-trading-panel"]');
      const riskDashboard = screen.getByTestId('risk-dashboard').closest('[data-component="risk-dashboard"]');
      const tradingInterface = screen.getByTestId('trading-interface').closest('[data-component="trading-interface"]');
      
      expect(aiTradingPanel).toBeInTheDocument();
      expect(riskDashboard).toBeInTheDocument();
      expect(tradingInterface).toBeInTheDocument();
    });
  });

  describe('Advanced View Tabs', () => {
    it('should show advanced dashboard components in advanced view', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'dashboard-welcome-dismissed') return 'true';
        return null;
      });
      
      render(<UnifiedDashboard />);
      
      // Switch to advanced view
      const advancedButton = screen.getByText('Advanced');
      fireEvent.click(advancedButton);
      
      await waitFor(() => {
        // Should show tabs
        expect(screen.getByText('Real-time')).toBeInTheDocument();
        expect(screen.getByText('Monitoring')).toBeInTheDocument();
        expect(screen.getByText('Analytics')).toBeInTheDocument();
        expect(screen.getByText('Controls')).toBeInTheDocument();
      });
      
      // Real-time tab should be active by default and show components
      expect(screen.getByTestId('live-price-feeds')).toBeInTheDocument();
      expect(screen.getByTestId('portfolio-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('ai-trading-signals')).toBeInTheDocument();
    });

    it('should switch between advanced view tabs', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'dashboard-welcome-dismissed') return 'true';
        return null;
      });
      
      render(<UnifiedDashboard />);
      
      // Switch to advanced view
      const advancedButton = screen.getByText('Advanced');
      fireEvent.click(advancedButton);
      
      await waitFor(() => {
        expect(screen.getByText('Monitoring')).toBeInTheDocument();
      });
      
      // Click monitoring tab
      const monitoringTab = screen.getByText('Monitoring');
      fireEvent.click(monitoringTab);
      
      await waitFor(() => {
        expect(screen.getByTestId('system-health')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should apply correct CSS classes for responsive layout', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'dashboard-welcome-dismissed') return 'true';
        return null;
      });
      
      render(<UnifiedDashboard />);
      
      const marketOverview = screen.getByTestId('market-overview').closest('.lg\\:col-span-3');
      const portfolio = screen.getByTestId('portfolio').closest('.lg\\:col-span-1');
      
      expect(marketOverview).toBeInTheDocument();
      expect(portfolio).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      expect(() => render(<UnifiedDashboard />)).not.toThrow();
    });

    it('should handle fullscreen API errors gracefully', () => {
      Object.defineProperty(document.documentElement, 'requestFullscreen', {
        value: () => {
          throw new Error('Fullscreen error');
        },
      });
      
      render(<UnifiedDashboard />);
      
      const fullscreenButton = screen.getByRole('button', { name: /maximize2/i });
      expect(() => fireEvent.click(fullscreenButton)).not.toThrow();
    });
  });
});
