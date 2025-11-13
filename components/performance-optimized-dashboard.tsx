// Performance-Optimized Dashboard Component
// Optimized for 60fps animations and responsive UI with React.memo, useMemo, and useCallback

'use client'

import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react'
import { performance } from 'perf_hooks'

// Types
interface MarketData {
  symbol: string
  price: number
  change: number
  volume: number
  timestamp: number
}

interface Position {
  id: string
  symbol: string
  size: number
  entryPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
}

interface PerformanceMetrics {
  totalReturn: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  totalTrades: number
}

// Memoized market data row component
const MarketDataRow = memo(({ data, isSelected, onSelect }: {
  data: MarketData
  isSelected: boolean
  onSelect: (symbol: string) => void
}) => {
  const changeColor = data.change >= 0 ? 'text-green-500' : 'text-red-500'
  const changeSymbol = data.change >= 0 ? '+' : ''

  return (
    <tr
      className={`border-b cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
      onClick={() => onSelect(data.symbol)}
    >
      <td className="px-4 py-2 font-medium">{data.symbol}</td>
      <td className="px-4 py-2">${data.price.toFixed(2)}</td>
      <td className={`px-4 py-2 ${changeColor}`}>
        {changeSymbol}{data.change.toFixed(2)}%
      </td>
      <td className="px-4 py-2">{(data.volume / 1000000).toFixed(2)}M</td>
    </tr>
  )
})

MarketDataRow.displayName = 'MarketDataRow'

// Memoized position card component
const PositionCard = memo(({ position }: { position: Position }) => {
  const pnlColor = position.pnl >= 0 ? 'text-green-500' : 'text-red-500'
  const pnlSymbol = position.pnl >= 0 ? '+' : ''

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-lg">{position.symbol}</h3>
        <span className={`font-bold ${pnlColor}`}>
          {pnlSymbol}${position.pnl.toFixed(2)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Size:</span>
          <span className="ml-1">{position.size}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Entry:</span>
          <span className="ml-1">${position.entryPrice.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Current:</span>
          <span className="ml-1">${position.currentPrice.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">P&L%:</span>
          <span className={`ml-1 ${pnlColor}`}>
            {pnlSymbol}{position.pnlPercent.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  )
})

PositionCard.displayName = 'PositionCard'

// Performance-optimized dashboard
export const PerformanceOptimizedDashboard: React.FC = () => {
  // State with optimized initial values
  const [marketData, setMarketData] = useState<MarketData[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    totalReturn: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    winRate: 0,
    totalTrades: 0
  })
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Refs for performance optimization
  const animationFrameRef = useRef<number>()
  const updateIntervalRef = useRef<NodeJS.Timeout>()
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // Memoized filtered market data
  const filteredMarketData = useMemo(() => {
    return marketData.filter(item =>
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [marketData, searchTerm])

  // Memoized aggregated positions by symbol
  const positionsBySymbol = useMemo(() => {
    const grouped = positions.reduce((acc, position) => {
      if (!acc[position.symbol]) {
        acc[position.symbol] = []
      }
      acc[position.symbol].push(position)
      return acc
    }, {} as Record<string, Position[]>)

    return Object.entries(grouped).map(([symbol, pos]) => ({
      symbol,
      totalPnL: pos.reduce((sum, p) => sum + p.pnl, 0),
      totalSize: pos.reduce((sum, p) => sum + Math.abs(p.size), 0),
      averageEntry: pos.reduce((sum, p) => sum + p.entryPrice, 0) / pos.length
    }))
  }, [positions])

  // Debounced search handler
  const handleSearch = useCallback((term: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchTerm(term)
    }, 300) // 300ms debounce
  }, [])

  // Optimized data fetching with request deduplication
  const fetchData = useCallback(async () => {
    if (isLoading) return

    setIsLoading(true)
    const startTime = performance.now()

    try {
      // Fetch market data, positions, and performance in parallel
      const [marketResponse, positionsResponse, performanceResponse] = await Promise.all([
        fetch('/api/market/data').then(res => res.json()),
        fetch('/api/portfolio/positions').then(res => res.json()),
        fetch('/api/portfolio/performance').then(res => res.json())
      ])

      // Batch state updates
      setMarketData(marketResponse)
      setPositions(positionsResponse)
      setPerformance(performanceResponse)

      const fetchTime = performance.now() - startTime
      console.debug(`Data fetch completed in ${fetchTime.toFixed(2)}ms`)

    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading])

  // Optimized animation loop
  const animateValues = useCallback(() => {
    // Smooth price updates using requestAnimationFrame
    setMarketData(prevData =>
      prevData.map(item => ({
        ...item,
        price: item.price + (Math.random() - 0.5) * 10,
        change: item.change + (Math.random() - 0.5) * 0.01,
        timestamp: Date.now()
      }))
    )

    // Update positions with smooth P&L changes
    setPositions(prevPositions =>
      prevPositions.map(position => ({
        ...position,
        currentPrice: position.currentPrice + (Math.random() - 0.5) * 5,
        pnl: position.pnl + (Math.random() - 0.5) * 10,
        pnlPercent: position.pnlPercent + (Math.random() - 0.5) * 0.1
      }))
    )

    animationFrameRef.current = requestAnimationFrame(animateValues)
  }, [])

  // Optimized symbol selection
  const handleSymbolSelect = useCallback((symbol: string) => {
    setSelectedSymbol(prev => prev === symbol ? null : symbol)
  }, [])

  // Memoized performance metrics formatter
  const formatPerformanceMetrics = useMemo(() => {
    return {
      totalReturn: `${performance.totalReturn >= 0 ? '+' : ''}${performance.totalReturn.toFixed(2)}%`,
      totalReturnColor: performance.totalReturn >= 0 ? 'text-green-500' : 'text-red-500',
      sharpeRatio: performance.sharpeRatio.toFixed(2),
      maxDrawdown: `${performance.maxDrawdown.toFixed(2)}%`,
      winRate: `${(performance.winRate * 100).toFixed(1)}%`
    }
  }, [performance])

  // Effect hooks with proper cleanup
  useEffect(() => {
    // Initial data fetch
    fetchData()

    // Set up real-time updates
    updateIntervalRef.current = setInterval(fetchData, 5000) // 5 second updates

    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(animateValues)

    // Cleanup
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [fetchData, animateValues])

  // Memory optimization: clear large arrays when component unmounts
  useEffect(() => {
    return () => {
      setMarketData([])
      setPositions([])
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Performance Optimized Trading Dashboard
          </h1>

          {/* Performance Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${formatPerformanceMetrics.totalReturnColor}`}>
                {formatPerformanceMetrics.totalReturn}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Return</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                {formatPerformanceMetrics.sharpeRatio}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Sharpe Ratio</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">
                {formatPerformanceMetrics.maxDrawdown}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Max Drawdown</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">
                {formatPerformanceMetrics.winRate}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Win Rate</div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
          <input
            type="text"
            placeholder="Search symbols..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Market Data Table */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Market Data ({filteredMarketData.length})
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Symbol
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Change
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Volume
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredMarketData.slice(0, 20).map((data) => (
                      <MarketDataRow
                        key={data.symbol}
                        data={data}
                        isSelected={selectedSymbol === data.symbol}
                        onSelect={handleSymbolSelect}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredMarketData.length > 20 && (
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 text-center text-sm text-gray-500 dark:text-gray-300">
                  Showing 20 of {filteredMarketData.length} symbols
                </div>
              )}
            </div>
          </div>

          {/* Positions Sidebar */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Positions ({positions.length})
              </h2>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {positions.slice(0, 10).map((position) => (
                  <PositionCard key={position.id} position={position} />
                ))}
              </div>

              {positions.length > 10 && (
                <div className="text-center text-sm text-gray-500 dark:text-gray-300 mt-4">
                  Showing 10 of {positions.length} positions
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Stats
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total Trades:</span>
                  <span className="font-medium">{performance.totalTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Active Symbols:</span>
                  <span className="font-medium">{positionsBySymbol.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Last Update:</span>
                  <span className="font-medium">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
            Updating data...
          </div>
        )}
      </div>
    </div>
  )
}

// Virtual scrolling component for large data sets
export const VirtualizedList: React.FC<{
  items: any[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: any, index: number) => React.ReactNode
}> = memo(({ items, itemHeight, containerHeight, renderItem }) => {
  const [scrollTop, setScrollTop] = useState(0)

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    )

    return {
      startIndex,
      endIndex,
      items: items.slice(startIndex, endIndex)
    }
  }, [items, itemHeight, containerHeight, scrollTop])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return (
    <div
      className="overflow-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${visibleItems.startIndex * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.items.map((item, index) => (
            <div
              key={visibleItems.startIndex + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, visibleItems.startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

VirtualizedList.displayName = 'VirtualizedList'

// Performance monitoring component
export const PerformanceMonitor: React.FC = () => {
  const [fps, setFps] = useState(60)
  const [memoryUsage, setMemoryUsage] = useState(0)
  const frameCount = useRef(0)
  const lastTime = useRef(performance.now())

  useEffect(() => {
    const calculateFPS = () => {
      frameCount.current++
      const currentTime = performance.now()
      const deltaTime = currentTime - lastTime.current

      if (deltaTime >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / deltaTime))
        frameCount.current = 0
        lastTime.current = currentTime
      }

      requestAnimationFrame(calculateFPS)
    }

    const animationId = requestAnimationFrame(calculateFPS)

    // Memory usage monitoring
    const memoryInterval = setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        const usedMemory = memory.usedJSHeapSize / 1024 / 1024 // MB
        setMemoryUsage(Math.round(usedMemory))
      }
    }, 1000)

    return () => {
      cancelAnimationFrame(animationId)
      clearInterval(memoryInterval)
    }
  }, [])

  return (
    <div className="fixed top-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded-lg text-xs font-mono">
      <div>FPS: {fps}</div>
      <div>Memory: {memoryUsage}MB</div>
    </div>
  )
}

export default PerformanceOptimizedDashboard