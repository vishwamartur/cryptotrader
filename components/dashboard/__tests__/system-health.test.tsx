import { render, screen, waitFor } from '@testing-library/react';
import { SystemHealth } from '../system-health';

// Mock the useRealtimeData hook
jest.mock('@/hooks/use-realtime-data', () => ({
  useRealtimeData: () => ({
    systemHealth: {
      lastUpdate: '2024-01-01T12:00:00Z',
      latency: 150,
      apiStatus: 'online',
      websocketStatus: 'connected',
      errorRate: 0.01,
      uptime: 86400
    },
    connectionStatus: 'connected',
    lastUpdate: '2024-01-01T12:00:00Z'
  })
}));

describe('SystemHealth Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Mock Date.now to ensure consistent testing
    jest.spyOn(Date, 'now').mockImplementation(() => new Date('2024-01-01T12:00:00Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should render placeholder time during server-side rendering', () => {
    render(<SystemHealth theme="light" autoRefresh={false} refreshInterval={1000} />);
    
    // Should show placeholder during initial render
    expect(screen.getByText('--:--:-- --')).toBeInTheDocument();
  });

  it('should display actual time after client-side hydration', async () => {
    render(<SystemHealth theme="light" autoRefresh={false} refreshInterval={1000} />);
    
    // Wait for client-side hydration to complete
    await waitFor(() => {
      // Should show actual formatted time after hydration
      expect(screen.queryByText('--:--:-- --')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    // Should have some time display (exact format may vary based on locale)
    const timeElement = screen.getByText(/\d{1,2}:\d{2}:\d{2}/);
    expect(timeElement).toBeInTheDocument();
  });

  it('should prevent hydration mismatch errors', () => {
    // Mock console.error to catch hydration warnings
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<SystemHealth theme="light" autoRefresh={false} refreshInterval={1000} />);
    
    // Should not have any hydration mismatch errors
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Hydration failed')
    );
    
    consoleSpy.mockRestore();
  });

  it('should update time display consistently', async () => {
    render(<SystemHealth theme="light" autoRefresh={false} refreshInterval={1000} />);
    
    // Wait for initial hydration
    await waitFor(() => {
      expect(screen.queryByText('--:--:-- --')).not.toBeInTheDocument();
    });

    // Advance time and check if display updates
    jest.advanceTimersByTime(1000);
    
    await waitFor(() => {
      const timeElement = screen.getByText(/\d{1,2}:\d{2}:\d{2}/);
      expect(timeElement).toBeInTheDocument();
    });
  });
});
