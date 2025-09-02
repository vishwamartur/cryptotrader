import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { Navigation } from '@/components/navigation';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe('Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/');
  });

  describe('Basic Rendering', () => {
    it('should render navigation with brand and logo', () => {
      render(<Navigation />);
      
      expect(screen.getByText('CryptoTrader')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /cryptotrader/i })).toHaveAttribute('href', '/');
    });

    it('should show connection status badge', () => {
      render(<Navigation connectionStatus="connected" />);
      
      expect(screen.getByText('connected')).toBeInTheDocument();
    });

    it('should apply correct theme classes', () => {
      const { container } = render(<Navigation theme="dark" />);
      
      expect(container.firstChild).toHaveClass('bg-gray-900/80', 'border-gray-800');
    });

    it('should apply light theme classes', () => {
      const { container } = render(<Navigation theme="light" />);
      
      expect(container.firstChild).toHaveClass('bg-white/80', 'border-gray-200');
    });
  });

  describe('Navigation Items', () => {
    it('should render all navigation items', () => {
      render(<Navigation />);
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Advanced')).toBeInTheDocument();
      expect(screen.getByText('Multi-API')).toBeInTheDocument();
      expect(screen.getByText('DnD Dashboard')).toBeInTheDocument();
    });

    it('should highlight active navigation item', () => {
      mockUsePathname.mockReturnValue('/advanced-dashboard');
      render(<Navigation />);
      
      const advancedLink = screen.getByRole('link', { name: /advanced/i });
      expect(advancedLink.firstChild).not.toHaveClass('ghost');
    });

    it('should show correct href for navigation items', () => {
      render(<Navigation />);
      
      expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /advanced/i })).toHaveAttribute('href', '/advanced-dashboard');
      expect(screen.getByRole('link', { name: /multi-api/i })).toHaveAttribute('href', '/multi-api-dashboard');
      expect(screen.getByRole('link', { name: /dnd dashboard/i })).toHaveAttribute('href', '/advanced-dashboard-dnd');
    });
  });

  describe('Quick Actions Dropdown', () => {
    it('should render quick actions dropdown', () => {
      render(<Navigation />);
      
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });

    it('should show quick actions when dropdown is opened', async () => {
      render(<Navigation />);
      
      const quickActionsButton = screen.getByText('Quick Actions');
      fireEvent.click(quickActionsButton);
      
      await waitFor(() => {
        expect(screen.getByText('AI Trading')).toBeInTheDocument();
        expect(screen.getByText('Risk Monitor')).toBeInTheDocument();
        expect(screen.getByText('Quick Trade')).toBeInTheDocument();
      });
    });

    it('should handle quick action clicks', async () => {
      // Mock querySelector to simulate finding elements
      const mockScrollIntoView = jest.fn();
      const mockElement = { scrollIntoView: mockScrollIntoView };
      
      jest.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === '[data-component="ai-trading-panel"]') {
          return mockElement as any;
        }
        return null;
      });
      
      render(<Navigation />);
      
      const quickActionsButton = screen.getByText('Quick Actions');
      fireEvent.click(quickActionsButton);
      
      await waitFor(() => {
        expect(screen.getByText('AI Trading')).toBeInTheDocument();
      });
      
      const aiTradingAction = screen.getByText('AI Trading');
      fireEvent.click(aiTradingAction);
      
      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('should handle quick actions when elements are not found', async () => {
      jest.spyOn(document, 'querySelector').mockReturnValue(null);
      
      render(<Navigation />);
      
      const quickActionsButton = screen.getByText('Quick Actions');
      fireEvent.click(quickActionsButton);
      
      await waitFor(() => {
        expect(screen.getByText('AI Trading')).toBeInTheDocument();
      });
      
      const aiTradingAction = screen.getByText('AI Trading');
      expect(() => fireEvent.click(aiTradingAction)).not.toThrow();
    });
  });

  describe('User Menu Dropdown', () => {
    it('should render user menu dropdown', () => {
      render(<Navigation />);
      
      expect(screen.getByText('Account')).toBeInTheDocument();
    });

    it('should show user menu items when dropdown is opened', async () => {
      render(<Navigation />);
      
      const accountButton = screen.getByText('Account');
      fireEvent.click(accountButton);
      
      await waitFor(() => {
        expect(screen.getByText('My Account')).toBeInTheDocument();
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Sign out')).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Navigation', () => {
    it('should show mobile menu toggle button', () => {
      render(<Navigation />);
      
      const mobileToggle = screen.getByRole('button', { name: /menu/i });
      expect(mobileToggle).toBeInTheDocument();
    });

    it('should toggle mobile menu when button is clicked', async () => {
      render(<Navigation />);
      
      const mobileToggle = screen.getByRole('button', { name: /menu/i });
      fireEvent.click(mobileToggle);
      
      await waitFor(() => {
        // Mobile menu should show navigation items with descriptions
        expect(screen.getByText('Main trading dashboard')).toBeInTheDocument();
        expect(screen.getByText('Advanced analytics and monitoring')).toBeInTheDocument();
      });
    });

    it('should close mobile menu when navigation item is clicked', async () => {
      render(<Navigation />);
      
      const mobileToggle = screen.getByRole('button', { name: /menu/i });
      fireEvent.click(mobileToggle);
      
      await waitFor(() => {
        expect(screen.getByText('Main trading dashboard')).toBeInTheDocument();
      });
      
      const dashboardLink = screen.getAllByText('Dashboard')[1]; // Mobile version
      fireEvent.click(dashboardLink);
      
      await waitFor(() => {
        expect(screen.queryByText('Main trading dashboard')).not.toBeInTheDocument();
      });
    });

    it('should show connection status in mobile menu', async () => {
      render(<Navigation connectionStatus="connected" />);
      
      const mobileToggle = screen.getByRole('button', { name: /menu/i });
      fireEvent.click(mobileToggle);
      
      await waitFor(() => {
        expect(screen.getByText('Connection: connected')).toBeInTheDocument();
      });
    });
  });

  describe('Connection Status', () => {
    it('should show connected status with correct styling', () => {
      render(<Navigation connectionStatus="connected" />);
      
      const badge = screen.getByText('connected');
      expect(badge).toBeInTheDocument();
    });

    it('should show disconnected status with correct styling', () => {
      render(<Navigation connectionStatus="disconnected" />);
      
      const badge = screen.getByText('disconnected');
      expect(badge).toBeInTheDocument();
    });

    it('should show connecting status by default', () => {
      render(<Navigation />);
      
      const badge = screen.getByText('connecting');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should hide desktop navigation items on mobile', () => {
      render(<Navigation />);
      
      // Desktop navigation should have md:flex class
      const desktopNav = screen.getByText('Dashboard').closest('.hidden.md\\:flex');
      expect(desktopNav).toBeInTheDocument();
    });

    it('should hide mobile toggle on desktop', () => {
      render(<Navigation />);
      
      const mobileToggle = screen.getByRole('button', { name: /menu/i });
      expect(mobileToggle).toHaveClass('md:hidden');
    });

    it('should show abbreviated text on small screens', () => {
      render(<Navigation />);
      
      // Quick Actions should have hidden sm:inline class for text
      const quickActionsText = screen.getByText('Quick Actions');
      expect(quickActionsText).toHaveClass('hidden', 'sm:inline');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<Navigation />);
      
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /quick actions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<Navigation />);
      
      const quickActionsButton = screen.getByText('Quick Actions');
      quickActionsButton.focus();
      expect(document.activeElement).toBe(quickActionsButton);
    });
  });

  describe('Error Handling', () => {
    it('should handle pathname errors gracefully', () => {
      mockUsePathname.mockImplementation(() => {
        throw new Error('Pathname error');
      });
      
      expect(() => render(<Navigation />)).not.toThrow();
    });

    it('should handle missing DOM elements gracefully', () => {
      jest.spyOn(document, 'querySelector').mockImplementation(() => {
        throw new Error('DOM error');
      });
      
      render(<Navigation />);
      
      const quickActionsButton = screen.getByText('Quick Actions');
      fireEvent.click(quickActionsButton);
      
      expect(() => {
        const aiTradingAction = screen.getByText('AI Trading');
        fireEvent.click(aiTradingAction);
      }).not.toThrow();
    });
  });

  describe('Theme Integration', () => {
    it('should pass theme to child components correctly', () => {
      render(<Navigation theme="dark" />);
      
      // Navigation should apply dark theme classes
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('bg-gray-900/80', 'border-gray-800');
    });

    it('should default to dark theme', () => {
      render(<Navigation />);
      
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('bg-gray-900/80', 'border-gray-800');
    });
  });
});
