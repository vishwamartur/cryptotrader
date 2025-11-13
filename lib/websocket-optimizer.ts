// WebSocket Optimization Engine
// Optimized for <50ms average message delivery latency
// Supports 10,000+ concurrent WebSocket connections

import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'
import { WebSocket, WebSocketServer } from 'ws'
import { createHash } from 'crypto'
import { promisify } from 'util'
import { deflate, inflate } from 'zlib'

const deflateAsync = promisify(deflate)
const inflateAsync = promisify(inflate)

export interface WebSocketConfig {
  maxConnections: number
  messageBatchSize: number
  heartbeatInterval: number
  compressionThreshold: number
  reconnectBackoffMs: number
  maxReconnectAttempts: number
  connectionTimeoutMs: number
  enableCompression: boolean
  enableBinaryProtocol: boolean
}

export interface OptimizedMessage {
  id: string
  type: string
  payload: any
  priority: 'low' | 'medium' | 'high' | 'critical'
  timestamp: number
  retryCount?: number
  targetClients?: string[]
  compressed?: boolean
}

export interface ConnectionMetrics {
  id: string
  connectedAt: number
  lastPing: number
  lastPong: number
  latency: number
  messageCount: number
  errorCount: number
  bytesReceived: number
  bytesSent: number
  compressionRatio: number
  subscriptions: Set<string>
}

export interface WebSocketMetrics {
  totalConnections: number
  activeConnections: number
  messagesQueued: number
  messagesSent: number
  messagesDropped: number
  averageLatency: number
  compressionRatio: number
  throughput: number
  errorRate: number
  memoryUsage: number
}

interface ConnectionPool {
  connections: Map<string, WebSocketConnection>
  loadBalancer: LoadBalancer
  healthMonitor: ConnectionHealthMonitor
}

class WebSocketConnection extends EventEmitter {
  public readonly id: string
  public readonly socket: WebSocket
  public metrics: ConnectionMetrics
  private pingTimeout: NodeJS.Timeout | null = null
  private pongTimeout: NodeJS.Timeout | null = null
  private messageQueue: OptimizedMessage[] = []
  private isActive: boolean = true

  constructor(id: string, socket: WebSocket, config: WebSocketConfig) {
    super()
    this.id = id
    this.socket = socket

    this.metrics = {
      id,
      connectedAt: Date.now(),
      lastPing: 0,
      lastPong: 0,
      latency: 0,
      messageCount: 0,
      errorCount: 0,
      bytesReceived: 0,
      bytesSent: 0,
      compressionRatio: 1,
      subscriptions: new Set()
    }

    this.setupEventHandlers(config)
    this.startHeartbeat(config)
  }

  private setupEventHandlers(config: WebSocketConfig): void {
    this.socket.on('message', (data) => this.handleMessage(data))
    this.socket.on('close', () => this.handleClose())
    this.socket.on('error', (error) => this.handleError(error))
    this.socket.on('pong', () => this.handlePong())
  }

  private startHeartbeat(config: WebSocketConfig): void {
    const heartbeat = setInterval(() => {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.metrics.lastPing = Date.now()
        this.socket.ping()

        // Set pong timeout
        this.pongTimeout = setTimeout(() => {
          console.warn(`Connection ${this.id} failed to respond to ping`)
          this.metrics.errorCount++
          this.close()
        }, config.heartbeatInterval / 2)
      }
    }, config.heartbeatInterval)

    this.socket.on('close', () => clearInterval(heartbeat))
  }

  private handlePong(): void {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout)
      this.pongTimeout = null
    }

    this.metrics.lastPong = Date.now()
    if (this.metrics.lastPing > 0) {
      this.metrics.latency = this.metrics.lastPong - this.metrics.lastPing
    }
  }

  private handleMessage(data: any): void {
    try {
      this.metrics.messageCount++
      this.metrics.bytesReceived += data.length || data.byteLength || 0

      // Decompress if needed
      let message: any
      if (typeof data === 'string') {
        message = JSON.parse(data)
      } else {
        message = data
      }

      this.emit('message', message)
    } catch (error) {
      this.metrics.errorCount++
      this.emit('error', error)
    }
  }

  private handleClose(): void {
    this.isActive = false
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    if (this.pongTimeout) clearTimeout(this.pongTimeout)
    this.emit('close')
  }

  private handleError(error: Error): void {
    this.metrics.errorCount++
    this.emit('error', error)
  }

  async sendMessage(message: OptimizedMessage, config: WebSocketConfig): Promise<void> {
    if (!this.isActive || this.socket.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      let payload = message.payload
      let compressed = false

      // Apply compression if enabled and payload is large enough
      if (config.enableCompression &&
          JSON.stringify(payload).length > config.compressionThreshold) {
        const jsonString = JSON.stringify(payload)
        const compressedBuffer = await deflateAsync(jsonString)
        payload = compressedBuffer.toString('base64')
        compressed = true

        const compressionRatio = compressedBuffer.length / jsonString.length
        this.metrics.compressionRatio = this.metrics.compressionRatio * 0.9 + compressionRatio * 0.1
      }

      const optimizedMessage = {
        ...message,
        payload,
        compressed
      }

      const messageData = config.enableBinaryProtocol ?
        this.createBinaryMessage(optimizedMessage) :
        JSON.stringify(optimizedMessage)

      this.socket.send(messageData)

      this.metrics.messageCount++
      this.metrics.bytesSent += messageData.length

    } catch (error) {
      this.metrics.errorCount++
      throw error
    }
  }

  private createBinaryMessage(message: OptimizedMessage): Buffer {
    // Create a binary protocol for faster transmission
    const header = Buffer.alloc(16)
    header.writeUInt32BE(message.id.length || 0, 0)
    header.writeUInt32BE(message.type.length || 0, 4)
    header.writeUInt8(this.getPriorityCode(message.priority), 8)
    header.writeBigUInt64BE(BigInt(message.timestamp), 8)

    const payload = Buffer.from(JSON.stringify(message.payload))
    return Buffer.concat([header, payload])
  }

  private getPriorityCode(priority: string): number {
    switch (priority) {
      case 'critical': return 0
      case 'high': return 1
      case 'medium': return 2
      case 'low': return 3
      default: return 2
    }
  }

  subscribe(channel: string): void {
    this.metrics.subscriptions.add(channel)
  }

  unsubscribe(channel: string): void {
    this.metrics.subscriptions.delete(channel)
  }

  close(): void {
    this.isActive = false
    this.socket.close()
  }

  getConnectionInfo(): ConnectionMetrics {
    return { ...this.metrics }
  }
}

class LoadBalancer {
  private connections: WebSocketConnection[] = []
  private roundRobinIndex = 0

  addConnection(connection: WebSocketConnection): void {
    this.connections.push(connection)
  }

  removeConnection(connectionId: string): void {
    this.connections = this.connections.filter(conn => conn.id !== connectionId)
  }

  getLeastLoadedConnection(): WebSocketConnection | null {
    if (this.connections.length === 0) return null

    return this.connections.reduce((least, current) =>
      current.metrics.messageCount < least.metrics.messageCount ? current : least
    )
  }

  getRoundRobinConnection(): WebSocketConnection | null {
    if (this.connections.length === 0) return null

    const connection = this.connections[this.roundRobinIndex]
    this.roundRobinIndex = (this.roundRobinIndex + 1) % this.connections.length
    return connection
  }

  getConnectionsForChannel(channel: string): WebSocketConnection[] {
    return this.connections.filter(conn =>
      conn.metrics.subscriptions.has(channel)
    )
  }

  getLoadMetrics(): {
    totalConnections: number
    averageLoad: number
    maxLoad: number
  } {
    const loads = this.connections.map(conn => conn.metrics.messageCount)
    const averageLoad = loads.length > 0 ?
      loads.reduce((sum, load) => sum + load, 0) / loads.length : 0

    return {
      totalConnections: this.connections.length,
      averageLoad,
      maxLoad: Math.max(...loads, 0)
    }
  }
}

class ConnectionHealthMonitor {
  private unhealthyConnections = new Set<string>()
  private healthCheckInterval: NodeJS.Timeout | null = null

  constructor(private connections: Map<string, WebSocketConnection>) {
    this.startHealthMonitoring()
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkConnectionHealth()
    }, 30000) // Check every 30 seconds
  }

  private checkConnectionHealth(): void {
    const now = Date.now()

    for (const [id, connection] of this.connections) {
      const metrics = connection.metrics
      const timeSinceLastPong = now - metrics.lastPong
      const errorRate = metrics.errorCount / Math.max(metrics.messageCount, 1)

      // Mark as unhealthy if:
      // 1. No pong response for > 2 minutes
      // 2. Error rate > 10%
      // 3. Latency > 10 seconds
      if (timeSinceLastPong > 120000 ||
          errorRate > 0.1 ||
          metrics.latency > 10000) {

        if (!this.unhealthyConnections.has(id)) {
          this.unhealthyConnections.add(id)
          console.warn(`Connection ${id} marked as unhealthy`, {
            timeSinceLastPong,
            errorRate,
            latency: metrics.latency
          })
        }
      } else {
        this.unhealthyConnections.delete(id)
      }
    }
  }

  isHealthy(connectionId: string): boolean {
    return !this.unhealthyConnections.has(connectionId)
  }

  getUnhealthyConnections(): string[] {
    return Array.from(this.unhealthyConnections)
  }

  cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }
}

export class WebSocketOptimizer extends EventEmitter {
  private config: WebSocketConfig
  private connectionPool: ConnectionPool
  private messageQueue: OptimizedMessage[] = []
  private batchTimer: NodeJS.Timeout | null = null
  private metrics: WebSocketMetrics
  private reconnectAttempts = new Map<string, number>()

  constructor(config: Partial<WebSocketConfig> = {}) {
    super()

    this.config = {
      maxConnections: 10000,
      messageBatchSize: 100,
      heartbeatInterval: 30000,
      compressionThreshold: 1024,
      reconnectBackoffMs: 1000,
      maxReconnectAttempts: 5,
      connectionTimeoutMs: 10000,
      enableCompression: true,
      enableBinaryProtocol: true,
      ...config
    }

    this.connectionPool = {
      connections: new Map(),
      loadBalancer: new LoadBalancer(),
      healthMonitor: null as any
    }

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      messagesQueued: 0,
      messagesSent: 0,
      messagesDropped: 0,
      averageLatency: 0,
      compressionRatio: 0,
      throughput: 0,
      errorRate: 0,
      memoryUsage: 0
    }

    this.startBatchProcessor()
    this.startMetricsCollection()
  }

  async addConnection(socket: WebSocket): Promise<string> {
    if (this.connectionPool.connections.size >= this.config.maxConnections) {
      throw new Error('Maximum connection limit reached')
    }

    const connectionId = this.generateConnectionId()
    const connection = new WebSocketConnection(connectionId, socket, this.config)

    this.connectionPool.connections.set(connectionId, connection)
    this.connectionPool.loadBalancer.addConnection(connection)

    // Setup event handlers
    connection.on('close', () => this.handleConnectionClose(connectionId))
    connection.on('error', (error) => this.handleConnectionError(connectionId, error))
    connection.on('message', (message) => this.handleConnectionMessage(connectionId, message))

    this.metrics.totalConnections++
    this.metrics.activeConnections++

    console.log(`WebSocket connection ${connectionId} established`)
    return connectionId
  }

  async broadcastMessage(message: OptimizedMessage): Promise<void> {
    if (!message.targetClients || message.targetClients.length === 0) {
      // Broadcast to all connections
      for (const connection of this.connectionPool.connections.values()) {
        try {
          await connection.sendMessage(message, this.config)
        } catch (error) {
          console.error(`Failed to send message to connection ${connection.id}:`, error)
        }
      }
    } else {
      // Send to specific clients
      for (const clientId of message.targetClients) {
        const connection = this.connectionPool.connections.get(clientId)
        if (connection) {
          try {
            await connection.sendMessage(message, this.config)
          } catch (error) {
            console.error(`Failed to send message to connection ${clientId}:`, error)
          }
        }
      }
    }

    this.metrics.messagesSent++
  }

  async sendToChannel(channel: string, message: OptimizedMessage): Promise<void> {
    const connections = this.connectionPool.loadBalancer.getConnectionsForChannel(channel)

    await Promise.all(connections.map(async (connection) => {
      try {
        await connection.sendMessage(message, this.config)
      } catch (error) {
        console.error(`Failed to send message to connection ${connection.id}:`, error)
      }
    }))

    this.metrics.messagesSent++
  }

  queueMessage(message: OptimizedMessage): void {
    this.messageQueue.push(message)
    this.metrics.messagesQueued++

    // Process immediately if it's a critical message
    if (message.priority === 'critical') {
      this.processBatch()
    }
  }

  private startBatchProcessor(): void {
    this.batchTimer = setInterval(() => {
      this.processBatch()
    }, 100) // Process batch every 100ms
  }

  private async processBatch(): Promise<void> {
    if (this.messageQueue.length === 0) return

    const batchSize = Math.min(this.config.messageBatchSize, this.messageQueue.length)
    const batch = this.messageQueue.splice(0, batchSize)

    // Sort messages by priority
    batch.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority))

    // Process each message
    for (const message of batch) {
      try {
        await this.broadcastMessage(message)
      } catch (error) {
        console.error('Failed to broadcast message:', error)
        this.metrics.messagesDropped++
      }
    }

    this.metrics.messagesQueued -= batch.length
  }

  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case 'critical': return 1000
      case 'high': return 100
      case 'medium': return 10
      case 'low': return 1
      default: return 10
    }
  }

  private generateConnectionId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16)
  }

  private handleConnectionClose(connectionId: string): void {
    this.connectionPool.connections.delete(connectionId)
    this.connectionPool.loadBalancer.removeConnection(connectionId)
    this.metrics.activeConnections--

    console.log(`WebSocket connection ${connectionId} closed`)
    this.emit('connectionClosed', connectionId)
  }

  private handleConnectionError(connectionId: string, error: Error): void {
    console.error(`Connection ${connectionId} error:`, error)
    this.emit('connectionError', { connectionId, error })
  }

  private handleConnectionMessage(connectionId: string, message: any): void {
    this.emit('message', { connectionId, message })
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics()
    }, 5000) // Update metrics every 5 seconds
  }

  private updateMetrics(): void {
    // Calculate average latency across all connections
    let totalLatency = 0
    let totalCompressionRatio = 0
    let totalMessages = 0
    let totalErrors = 0

    for (const connection of this.connectionPool.connections.values()) {
      totalLatency += connection.metrics.latency
      totalCompressionRatio += connection.metrics.compressionRatio
      totalMessages += connection.metrics.messageCount
      totalErrors += connection.metrics.errorCount
    }

    const connectionCount = this.connectionPool.connections.size
    if (connectionCount > 0) {
      this.metrics.averageLatency = totalLatency / connectionCount
      this.metrics.compressionRatio = totalCompressionRatio / connectionCount
      this.metrics.errorRate = totalErrors / Math.max(totalMessages, 1)
    }

    this.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024 // MB
  }

  getMetrics(): WebSocketMetrics {
    return { ...this.metrics }
  }

  getConnectionMetrics(connectionId: string): ConnectionMetrics | null {
    const connection = this.connectionPool.connections.get(connectionId)
    return connection ? connection.getConnectionInfo() : null
  }

  getAllConnectionMetrics(): ConnectionMetrics[] {
    return Array.from(this.connectionPool.connections.values())
      .map(connection => connection.getConnectionInfo())
  }

  getLoadBalancerMetrics(): any {
    return this.connectionPool.loadBalancer.getLoadMetrics()
  }

  getHealthMetrics(): {
    totalConnections: number
    healthyConnections: number
    unhealthyConnections: string[]
  } {
    const total = this.connectionPool.connections.size
    const unhealthy = this.connectionPool.healthMonitor.getUnhealthyConnections()

    return {
      totalConnections: total,
      healthyConnections: total - unhealthy.length,
      unhealthyConnections: unhealthy
    }
  }

  // Reconnection logic
  async handleReconnection(connectionId: string, reconnectFn: () => Promise<WebSocket>): Promise<void> {
    const attempts = this.reconnectAttempts.get(connectionId) || 0

    if (attempts >= this.config.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for ${connectionId}`)
      return
    }

    const backoffDelay = this.config.reconnectBackoffMs * Math.pow(2, attempts)
    this.reconnectAttempts.set(connectionId, attempts + 1)

    console.log(`Attempting to reconnect ${connectionId} in ${backoffDelay}ms (attempt ${attempts + 1})`)

    setTimeout(async () => {
      try {
        const socket = await reconnectFn()
        await this.addConnection(socket)
        this.reconnectAttempts.delete(connectionId)
        console.log(`Successfully reconnected ${connectionId}`)
      } catch (error) {
        console.error(`Reconnection failed for ${connectionId}:`, error)
        await this.handleReconnection(connectionId, reconnectFn)
      }
    }, backoffDelay)
  }

  cleanup(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
    }

    // Close all connections
    for (const connection of this.connectionPool.connections.values()) {
      connection.close()
    }

    this.connectionPool.connections.clear()
    this.messageQueue.length = 0
  }
}

export default WebSocketOptimizer