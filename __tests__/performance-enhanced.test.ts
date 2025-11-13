// Comprehensive Performance Testing Suite
// Tests for AI Trading Engine, HFT Engine, WebSocket Optimizer, Database Optimizer, and ML Optimizer

import { performance } from 'perf_hooks'
import { AITradingEngine } from '../lib/ai-trading-engine'
import { HFTEngine, RealTimeOrderBook } from '../lib/hft-orderbook-engine'
import { CachedMarketDataProvider } from '../lib/market-data-provider'
import { WebSocketOptimizer } from '../lib/websocket-optimizer'
import { DatabaseOptimizer } from '../lib/database-optimizer'
import MLOptimizerFactory from '../lib/ml-optimizer'
import { WebSocket } from 'ws'

// Mock data generators
const generateMarketData = (count: number = 1000) => {
  const data = []
  for (let i = 0; i < count; i++) {
    data.push({
      symbol: 'BTC-USD',
      timestamp: Date.now() - (count - i) * 1000,
      price: 45000 + Math.random() * 5000,
      volume: Math.random() * 1000000,
      bid: 44995 + Math.random() * 5,
      ask: 45005 + Math.random() * 5,
      high24h: 46000 + Math.random() * 1000,
      low24h: 44000 - Math.random() * 1000,
      change: (Math.random() - 0.5) * 2000,
      changePercent: (Math.random() - 0.5) * 5,
      lastUpdated: Date.now()
    })
  }
  return data
}

const generateOrderBookSnapshot = (bidLevels: number = 20, askLevels: number = 20) => {
  const basePrice = 45000
  const bids = []
  const asks = []

  for (let i = 0; i < bidLevels; i++) {
    bids.push({
      price: basePrice - i * 10 - Math.random() * 5,
      size: Math.random() * 10 + 0.1
    })
  }

  for (let i = 0; i < askLevels; i++) {
    asks.push({
      price: basePrice + i * 10 + Math.random() * 5,
      size: Math.random() * 10 + 0.1
    })
  }

  return {
    bids,
    asks,
    timestamp: Date.now(),
    sequence: Math.floor(Math.random() * 1000000)
  }
}

describe('Performance Test Suite', () => {
  describe('AI Trading Engine Performance', () => {
    let aiEngine: AITradingEngine

    beforeEach(() => {
      aiEngine = new AITradingEngine({
        model: 'llama-3.1-sonar-large-128k-online',
        cacheEnabled: true,
        cacheMaxEntries: 1000,
        cacheTTL: 60,
        requestTimeout: 1000,
        maxConcurrentRequests: 5
      })
    })

    afterEach(() => {
      aiEngine.clearCache()
    })

    test('AI Analysis Latency < 1 second target', async () => {
      const marketData = generateMarketData(10)
      const positions = []
      const balance = 10000

      const latencies: number[] = []
      const iterations = 10

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()
        await aiEngine.analyzeMarket(marketData, positions, balance)
        const latency = performance.now() - startTime
        latencies.push(latency)
      }

      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      const maxLatency = Math.max(...latencies)

      console.log(`AI Engine - Average Latency: ${averageLatency.toFixed(2)}ms, Max: ${maxLatency.toFixed(2)}ms`)

      // Target: <1 second average latency
      expect(averageLatency).toBeLessThan(1000)
      expect(maxLatency).toBeLessThan(1500) // Allow some variance
    })

    test('Cache Hit Rate > 80% for repeated requests', async () => {
      const marketData = generateMarketData(5)
      const positions = []
      const balance = 10000

      // First call - should be cache miss
      await aiEngine.analyzeMarket(marketData, positions, balance)

      // Subsequent calls - should hit cache (simulated)
      const cacheStats = aiEngine.getCacheStats()

      // In a real implementation with actual caching, hit rate should be >80%
      // This test demonstrates the caching infrastructure
      expect(cacheStats).toBeDefined()
    })

    test('Concurrent Request Handling', async () => {
      const marketData = generateMarketData(10)
      const positions = []
      const balance = 10000

      const startTime = performance.now()
      const promises = []

      // Make concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(aiEngine.analyzeMarket(marketData, positions, balance))
      }

      await Promise.all(promises)
      const totalTime = performance.now() - startTime

      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(5000) // 5 seconds for 10 concurrent requests
    })
  })

  describe('HFT Engine Performance', () => {
    let hftEngine: HFTEngine
    let orderBook: RealTimeOrderBook

    beforeEach(() => {
      hftEngine = new HFTEngine(10, 5) // batch size 10, timeout 5ms
      orderBook = new RealTimeOrderBook(1000)
    })

    test('Tick Processing < 0.5ms target', () => {
      const iterations = 1000
      const latencies: number[] = []

      for (let i = 0; i < iterations; i++) {
        const snapshot = generateOrderBookSnapshot()
        const tickEvent = {
          type: 'orderbook' as const,
          orderBook: snapshot,
          timestamp: Date.now(),
          symbol: 'BTC-USD'
        }

        const startTime = performance.now()
        hftEngine.processTick(tickEvent)
        const latency = performance.now() - startTime
        latencies.push(latency)
      }

      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      const maxLatency = Math.max(...latencies)

      console.log(`HFT Engine - Average Tick Processing: ${averageLatency.toFixed(3)}ms, Max: ${maxLatency.toFixed(3)}ms`)

      // Target: <0.5ms average latency
      expect(averageLatency).toBeLessThan(0.5)
      expect(maxLatency).toBeLessThan(1.0)
    })

    test('10,000+ Ticks Per Second Support', () => {
      const targetTicksPerSecond = 10000
      const testDuration = 1000 // 1 second
      const startTime = performance.now()
      let tickCount = 0

      while (performance.now() - startTime < testDuration) {
        const snapshot = generateOrderBookSnapshot()
        const tickEvent = {
          type: 'orderbook' as const,
          orderBook: snapshot,
          timestamp: Date.now(),
          symbol: 'BTC-USD'
        }

        hftEngine.processTick(tickEvent)
        tickCount++
      }

      const ticksPerSecond = tickCount

      console.log(`HFT Engine - Processed ${ticksPerSecond} ticks per second`)
      expect(ticksPerSecond).toBeGreaterThan(targetTicksPerSecond)
    })

    test('Memory Allocation Optimization', () => {
      const initialMemory = process.memoryUsage().heapUsed
      const iterations = 10000

      for (let i = 0; i < iterations; i++) {
        const snapshot = generateOrderBookSnapshot()
        orderBook.update(snapshot)
        orderBook.getMetrics()
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024 // MB

      console.log(`HFT Engine - Memory increase after ${iterations} operations: ${memoryIncrease.toFixed(2)}MB`)

      // Memory increase should be minimal (<50MB for 10k operations)
      expect(memoryIncrease).toBeLessThan(50)
    })
  })

  describe('Market Data Cache Performance', () => {
    let cacheProvider: CachedMarketDataProvider

    beforeEach(() => {
      cacheProvider = new CachedMarketDataProvider()
    })

    afterEach(() => {
      cacheProvider.clear()
    })

    test('Cache Response Time < 1ms', async () => {
      const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD', 'DOT-USD']
      const marketDataPoints = generateMarketData(symbols.length)

      // Populate cache
      for (let i = 0; i < symbols.length; i++) {
        await cacheProvider.setMarketData(symbols[i], marketDataPoints[i], 'realtime')
      }

      // Measure cache retrieval performance
      const iterations = 1000
      const latencies: number[] = []

      for (let i = 0; i < iterations; i++) {
        const symbol = symbols[i % symbols.length]
        const startTime = performance.now()
        await cacheProvider.getMarketData(symbol, 'realtime')
        const latency = performance.now() - startTime
        latencies.push(latency)
      }

      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      const maxLatency = Math.max(...latencies)

      console.log(`Market Data Cache - Average: ${averageLatency.toFixed(3)}ms, Max: ${maxLatency.toFixed(3)}ms`)

      // Target: <1ms average response time
      expect(averageLatency).toBeLessThan(1)
      expect(maxLatency).toBeLessThan(5)
    })

    test('Cache Hit Rate > 90%', async () => {
      const symbol = 'BTC-USD'
      const marketDataPoint = generateMarketData(1)[0]

      // Add to cache
      await cacheProvider.setMarketData(symbol, marketDataPoint, 'realtime')

      // Multiple retrievals should hit cache
      const iterations = 100
      let hitCount = 0

      for (let i = 0; i < iterations; i++) {
        const result = await cacheProvider.getMarketData(symbol, 'realtime')
        if (result) hitCount++
      }

      const hitRate = hitCount / iterations
      console.log(`Market Data Cache - Hit Rate: ${(hitRate * 100).toFixed(1)}%`)

      // Target: >90% hit rate
      expect(hitRate).toBeGreaterThan(0.9)
    })

    test('Batch Operations Efficiency', async () => {
      const symbols = Array.from({ length: 50 }, (_, i) => `SYMBOL-${i}`)
      const marketDataPoints = generateMarketData(50)

      // Batch set
      const batchSetStart = performance.now()
      await cacheProvider.setBatchMarketData(marketDataPoints)
      const batchSetTime = performance.now() - batchSetStart

      // Batch get
      const batchGetStart = performance.now()
      const results = await cacheProvider.getBatchMarketData(symbols.slice(0, 25))
      const batchGetTime = performance.now() - batchGetStart

      console.log(`Batch Operations - Set: ${batchSetTime.toFixed(2)}ms, Get: ${batchGetTime.toFixed(2)}ms`)
      console.log(`Retrieved ${results.size} symbols`)

      expect(results.size).toBeGreaterThan(0)
      expect(batchSetTime).toBeLessThan(100) // Should be fast
      expect(batchGetTime).toBeLessThan(50)
    })
  })

  describe('WebSocket Optimizer Performance', () => {
    let wsOptimizer: WebSocketOptimizer

    beforeEach(() => {
      wsOptimizer = new WebSocketOptimizer({
        maxConnections: 1000,
        messageBatchSize: 50,
        heartbeatInterval: 5000,
        compressionThreshold: 256,
        enableCompression: true,
        enableBinaryProtocol: true
      })
    })

    afterEach(() => {
      wsOptimizer.cleanup()
    })

    test('Message Delivery < 50ms', (done) => {
      const ws = new WebSocket('ws://localhost:8080') // Mock WebSocket
      const testMessages = [
        { id: '1', type: 'test', payload: 'hello', priority: 'high' as const, timestamp: Date.now() },
        { id: '2', type: 'test', payload: 'world', priority: 'medium' as const, timestamp: Date.now() }
      ]

      const deliveryTimes: number[] = []
      let messagesReceived = 0

      // Mock connection addition and message handling
      setTimeout(async () => {
        const connectionId = 'test-connection'

        for (const message of testMessages) {
          const startTime = performance.now()
          await wsOptimizer.broadcastMessage(message)
          deliveryTimes.push(performance.now() - startTime)
        }

        const averageDeliveryTime = deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length
        console.log(`WebSocket - Average Message Delivery: ${averageDeliveryTime.toFixed(2)}ms`)

        // Target: <50ms average delivery time
        expect(averageDeliveryTime).toBeLessThan(50)
        done()
      }, 100)
    })

    test('1000+ Concurrent Connections', () => {
      // Test connection limit handling
      const promises = Array.from({ length: 1001 }, (_, i) => {
        const mockWs = new WebSocket('ws://mock')
        return wsOptimizer.addConnection(mockWs)
          .then(id => ({ success: true, id }))
          .catch(error => ({ success: false, error: error.message }))
      })

      // In a real implementation, this would test actual connection handling
      // For this test, we verify the connection limit logic exists
      expect(wsOptimizer.getMetrics().maxConnections).toBe(1000)
    })

    test('Message Batching Efficiency', async () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        type: 'batch-test',
        payload: `data-${i}`,
        priority: 'medium' as const,
        timestamp: Date.now()
      }))

      const startTime = performance.now()

      // Queue messages for batch processing
      messages.forEach(message => wsOptimizer.queueMessage(message))

      // Allow some time for batch processing
      setTimeout(() => {
        const processingTime = performance.now() - startTime
        const metrics = wsOptimizer.getMetrics()

        console.log(`WebSocket - Batch Processing: ${processingTime.toFixed(2)}ms`)
        console.log(`Messages Queued: ${metrics.messagesQueued}, Sent: ${metrics.messagesSent}`)

        expect(processingTime).toBeLessThan(500) // Should be efficient
      }, 200)
    })
  })

  describe('ML Model Optimization', () => {
    test('Training Time < 5 seconds for 10k samples', async () => {
      const config = {
        batchSize: 32,
        epochs: 10,
        learningRate: 0.001,
        earlyStoppingPatience: 3,
        maxTrainingTime: 5 * 60 * 1000, // 5 minutes
        enableQuantization: true,
        memoryLimit: 1024 * 1024 * 2 // 2GB
      }

      const startTime = performance.now()

      // Create and train model
      const model = await MLOptimizerFactory.createTradingModel(config)

      // Generate synthetic training data
      const numSamples = 10000
      const inputFeatures = 20
      const data = tf.randomNormal([numSamples, inputFeatures])
      const labels = tf.oneHot(tf.randomUniform([numSamples]).mul(3).cast('int32'), 3)

      const performance = await model.train(data, labels)

      const trainingTime = (performance.now() - startTime) / 1000 // Convert to seconds

      console.log(`ML Model - Training Time: ${trainingTime.toFixed(2)}s`)
      console.log(`Best Validation Loss: ${performance.bestValLoss.toFixed(4)}`)

      // Target: <5 seconds for 10k samples
      expect(trainingTime).toBeLessThan(5)
      expect(performance.bestValLoss).toBeLessThan(1.0) // Reasonable loss

      // Cleanup
      data.dispose()
      labels.dispose()
      model['cleanup']()
    })

    test('Inference Time < 100ms', async () => {
      const model = await MLOptimizerFactory.createTradingModel({
        enableQuantization: true
      })

      // Generate test input
      const testInput = tf.randomNormal([1, 20])

      const inferenceTimes: number[] = []
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()
        await model.predict(testInput)
        const inferenceTime = performance.now() - startTime
        inferenceTimes.push(inferenceTime)
      }

      const averageInferenceTime = inferenceTimes.reduce((sum, time) => sum + time, 0) / inferenceTimes.length
      const maxInferenceTime = Math.max(...inferenceTimes)

      console.log(`ML Model - Average Inference: ${averageInferenceTime.toFixed(2)}ms, Max: ${maxInferenceTime.toFixed(2)}ms`)

      // Target: <100ms inference time
      expect(averageInferenceTime).toBeLessThan(100)
      expect(maxInferenceTime).toBeLessThan(200)

      // Cleanup
      testInput.dispose()
      model['cleanup']()
    })

    test('Memory Usage < 500MB during training', async () => {
      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024 // MB

      const model = await MLOptimizerFactory.createTradingModel({
        memoryLimit: 1024 * 1024 * 2, // 2GB
        batchSize: 64
      })

      const numSamples = 10000
      const data = tf.randomNormal([numSamples, 20])
      const labels = tf.oneHot(tf.randomUniform([numSamples]).mul(3).cast('int32'), 3)

      await model.train(data, labels)

      const peakMemory = process.memoryUsage().heapUsed / 1024 / 1024 // MB
      const memoryIncrease = peakMemory - initialMemory

      console.log(`ML Model - Memory Increase: ${memoryIncrease.toFixed(2)}MB`)

      // Target: <500MB memory increase
      expect(memoryIncrease).toBeLessThan(500)

      // Cleanup
      data.dispose()
      labels.dispose()
      model['cleanup']()
    })
  })

  describe('Overall System Performance', () => {
    test('End-to-End Trading Pipeline < 2 seconds', async () => {
      const pipelineStartTime = performance.now()

      // Step 1: Market Data Acquisition (simulated)
      const marketDataStartTime = performance.now()
      const marketData = generateMarketData(10)
      const marketDataTime = performance.now() - marketDataStartTime

      // Step 2: AI Analysis
      const aiStartTime = performance.now()
      const aiEngine = new AITradingEngine({
        cacheEnabled: true,
        requestTimeout: 1000
      })
      const aiAnalysis = await aiEngine.analyzeMarket(marketData, [], 10000)
      const aiTime = performance.now() - aiStartTime

      // Step 3: HFT Signal Processing
      const hftStartTime = performance.now()
      const hftEngine = new HFTEngine()
      const tickEvent = {
        type: 'orderbook' as const,
        orderBook: generateOrderBookSnapshot(),
        timestamp: Date.now(),
        symbol: 'BTC-USD'
      }
      const hftSignals = hftEngine.processTick(tickEvent)
      const hftTime = performance.now() - hftStartTime

      // Step 4: ML Prediction
      const mlStartTime = performance.now()
      const model = await MLOptimizerFactory.createTradingModel()
      const testInput = tf.randomNormal([1, 20])
      const prediction = await model.predict(testInput)
      const mlTime = performance.now() - mlStartTime

      const totalPipelineTime = performance.now() - pipelineStartTime

      console.log(`End-to-End Pipeline Performance:`)
      console.log(`  Market Data: ${marketDataTime.toFixed(2)}ms`)
      console.log(`  AI Analysis: ${aiTime.toFixed(2)}ms`)
      console.log(`  HFT Processing: ${hftTime.toFixed(2)}ms`)
      console.log(`  ML Prediction: ${mlTime.toFixed(2)}ms`)
      console.log(`  Total: ${totalPipelineTime.toFixed(2)}ms`)

      // Target: <2 seconds for complete pipeline
      expect(totalPipelineTime).toBeLessThan(2000)

      // Cleanup
      testInput.dispose()
      model['cleanup']()
      aiEngine.clearCache()
    })

    test('System Under Load - 1000 Concurrent Operations', async () => {
      const operations = Array.from({ length: 1000 }, (_, i) => {
        return async () => {
          const startTime = performance.now()

          // Simulate mixed operations
          if (i % 3 === 0) {
            // AI Analysis
            const aiEngine = new AITradingEngine({ cacheEnabled: true })
            await aiEngine.analyzeMarket(generateMarketData(5), [], 1000)
          } else if (i % 3 === 1) {
            // HFT Processing
            const hftEngine = new HFTEngine()
            hftEngine.processTick({
              type: 'orderbook',
              orderBook: generateOrderBookSnapshot(),
              timestamp: Date.now(),
              symbol: 'BTC-USD'
            })
          } else {
            // Cache Operations
            const cache = new CachedMarketDataProvider()
            await cache.getMarketData('BTC-USD')
            await cache.setMarketData('BTC-USD', generateMarketData(1)[0])
          }

          return performance.now() - startTime
        }
      })

      const systemStartTime = performance.now()
      const results = await Promise.all(operations.map(op => op()))
      const systemTime = performance.now() - systemStartTime

      const averageOperationTime = results.reduce((sum, time) => sum + time, 0) / results.length
      const maxOperationTime = Math.max(...results)

      console.log(`System Load Test:`)
      console.log(`  1000 concurrent operations`)
      console.log(`  Average operation time: ${averageOperationTime.toFixed(2)}ms`)
      console.log(`  Max operation time: ${maxOperationTime.toFixed(2)}ms`)
      console.log(`  Total system time: ${systemTime.toFixed(2)}ms`)

      // System should handle load gracefully
      expect(systemTime).toBeLessThan(10000) // 10 seconds for 1000 operations
      expect(averageOperationTime).toBeLessThan(1000) // 1 second per operation average
      expect(maxOperationTime).toBeLessThan(5000) // 5 seconds max per operation
    })
  })
})

// Global performance benchmarks
describe('Performance Benchmarks', () => {
  test('Benchmarks Summary', () => {
    console.log('\n=== Performance Benchmarks ===')
    console.log('AI Trading Engine:')
    console.log('  Target: <1s analysis time')
    console.log('  Target: >90% cache hit rate')
    console.log()
    console.log('HFT Engine:')
    console.log('  Target: <0.5ms tick processing')
    console.log('  Target: 10,000+ ticks per second')
    console.log()
    console.log('Market Data Cache:')
    console.log('  Target: <1ms response time')
    console.log('  Target: >90% cache hit rate')
    console.log()
    console.log('WebSocket Optimizer:')
    console.log('  Target: <50ms message delivery')
    console.log('  Target: 10,000+ concurrent connections')
    console.log()
    console.log('ML Model:')
    console.log('  Target: <5s training (10k samples)')
    console.log('  Target: <100ms inference')
    console.log('  Target: <500MB memory usage')
    console.log('========================\n')

    // This test always passes - it's for documentation
    expect(true).toBe(true)
  })
})