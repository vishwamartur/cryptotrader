import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PerformanceCharts } from '../performance-charts';

describe('PerformanceCharts Component', () => {
  const defaultProps = {
    theme: 'light' as const,
    autoRefresh: true,
    refreshInterval: 1000
  };

  beforeEach(() => {
    // Mock console.error to catch hydration warnings
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render without hydration mismatch errors', () => {
    render(<PerformanceCharts {...defaultProps} />);
    
    // Should display the component title
    expect(screen.getByText('Performance Charts')).toBeInTheDocument();
    
    // Should display chart type buttons
    expect(screen.getByText('pnl')).toBeInTheDocument();
    expect(screen.getByText('equity')).toBeInTheDocument();
    expect(screen.getByText('drawdown')).toBeInTheDocument();
    
    // Should display timeframe buttons
    expect(screen.getByText('1D')).toBeInTheDocument();
    expect(screen.getByText('7D')).toBeInTheDocument();
    expect(screen.getByText('30D')).toBeInTheDocument();
    expect(screen.getByText('1Y')).toBeInTheDocument();
  });

  it('should show placeholders during server-side rendering', () => {
    render(<PerformanceCharts {...defaultProps} />);
    
    // Should show placeholder values initially
    const placeholders = screen.getAllByText('---.--');
    expect(placeholders).toHaveLength(3); // Current, High, Low
  });

  it('should display actual values after client-side hydration', async () => {
    render(<PerformanceCharts {...defaultProps} />);
    
    // Wait for client-side hydration to complete
    await waitFor(() => {
      // Should no longer show placeholders
      expect(screen.queryByText('---.--')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    // Should show actual dollar values
    const dollarValues = screen.getAllByText(/^\$\d+\.\d{2}$/);
    expect(dollarValues.length).toBeGreaterThan(0);
  });

  it('should prevent hydration mismatch errors', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<PerformanceCharts {...defaultProps} />);
    
    // Should not have any hydration mismatch errors
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Hydration failed')
    );
    
    consoleSpy.mockRestore();
  });

  it('should update chart data when timeframe changes', async () => {
    render(<PerformanceCharts {...defaultProps} />);
    
    // Wait for initial hydration
    await waitFor(() => {
      expect(screen.queryByText('---.--')).not.toBeInTheDocument();
    });

    // Click on different timeframe
    fireEvent.click(screen.getByText('1D'));
    
    // Should still display values (may be different due to data regeneration)
    await waitFor(() => {
      const dollarValues = screen.getAllByText(/^\$\d+\.\d{2}$/);
      expect(dollarValues.length).toBeGreaterThan(0);
    });
  });

  it('should update chart data when chart type changes', async () => {
    render(<PerformanceCharts {...defaultProps} />);
    
    // Wait for initial hydration
    await waitFor(() => {
      expect(screen.queryByText('---.--')).not.toBeInTheDocument();
    });

    // Click on different chart type
    fireEvent.click(screen.getByText('equity'));
    
    // Should still display values
    await waitFor(() => {
      const dollarValues = screen.getAllByText(/^\$\d+\.\d{2}$/);
      expect(dollarValues.length).toBeGreaterThan(0);
    });
  });

  it('should handle dark theme properly', () => {
    render(<PerformanceCharts {...defaultProps} theme="dark" />);
    
    // Should render without errors in dark theme
    expect(screen.getByText('Performance Charts')).toBeInTheDocument();
  });

  it('should show loading state when chart data is empty', () => {
    render(<PerformanceCharts {...defaultProps} />);
    
    // Should show loading text in the chart area initially
    expect(screen.getByText('Loading chart data...')).toBeInTheDocument();
  });

  it('should use consistent data generation for hydration safety', async () => {
    // Render the same component multiple times
    const { unmount } = render(<PerformanceCharts {...defaultProps} />);
    
    // Wait for hydration
    await waitFor(() => {
      expect(screen.queryByText('---.--')).not.toBeInTheDocument();
    });
    
    // Get the values
    const values1 = screen.getAllByText(/^\$\d+\.\d{2}$/).map(el => el.textContent);
    
    unmount();
    
    // Render again
    render(<PerformanceCharts {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.queryByText('---.--')).not.toBeInTheDocument();
    });
    
    // Values should be consistent due to seeded random function
    const values2 = screen.getAllByText(/^\$\d+\.\d{2}$/).map(el => el.textContent);
    expect(values1).toEqual(values2);
  });

  it('should handle edge cases gracefully', async () => {
    render(<PerformanceCharts {...defaultProps} />);
    
    // Should not crash with any edge cases
    await waitFor(() => {
      expect(screen.getByText('Performance Charts')).toBeInTheDocument();
    });
    
    // Test rapid timeframe changes
    fireEvent.click(screen.getByText('1D'));
    fireEvent.click(screen.getByText('30D'));
    fireEvent.click(screen.getByText('1Y'));
    fireEvent.click(screen.getByText('7D'));
    
    // Should still work properly
    await waitFor(() => {
      const dollarValues = screen.getAllByText(/^\$\d+\.\d{2}$/);
      expect(dollarValues.length).toBeGreaterThan(0);
    });
  });
});
