/**
 * WebSocket Proxy Server for Delta Exchange
 * Handles server-side authentication and real-time data streaming
 */

import WebSocket from 'ws';
import { generateHmacSha256 } from './crypto-utils';

export interface ProxyServerConfig {
  port?: number;
  deltaWsUrl?: string;
  apiKey?: string;
  apiSecret?: string;
}

export class DeltaWebSocketProxy {
  private wss: WebSocket.Server | null = null;
  private deltaWS: WebSocket | null = null;
  private clients = new Set<WebSocket>();
  private config: ProxyServerConfig;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;

  constructor(config: ProxyServerConfig = {}) {
    this.config = {
      port: config.port || 8080,
      deltaWsUrl: config.deltaWsUrl || (
        process.env.NODE_ENV === 'production' 
          ? 'wss://socket.india.delta.exchange'
          : 'wss://socket.testnet.deltaex.org'
      ),
      apiKey: config.apiKey || process.env.DELTA_API_KEY,
      apiSecret: config.apiSecret || process.env.DELTA_API_SECRET
    };
  }

  async start(): Promise<void> {
    console.log('[WebSocket Proxy] Starting proxy server...');

    // Create WebSocket server for client connections
    this.wss = new WebSocket.Server({ 
      port: this.config.port,
      perMessageDeflate: false
    });

    // Handle client connections
    this.wss.on('connection', (ws, request) => {
      console.log('[WebSocket Proxy] Client connected from:', request.socket.remoteAddress);
      this.clients.add(ws);

      // Send connection status
      this.sendToClient(ws, {
        type: 'proxy_connected',
        data: { message: 'Connected to Delta Exchange proxy' }
      });

      // Handle client messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('[WebSocket Proxy] Error parsing client message:', error);
          this.sendToClient(ws, {
            type: 'error',
            data: { message: 'Invalid message format' }
          });
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log('[WebSocket Proxy] Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[WebSocket Proxy] Client error:', error);
        this.clients.delete(ws);
      });
    });

    // Establish connection to Delta Exchange
    await this.connectToDelta();

    console.log(`[WebSocket Proxy] Server started on port ${this.config.port}`);
  }

  private async connectToDelta(): Promise<void> {
    if (this.isConnecting) {
      console.log('[WebSocket Proxy] Connection already in progress');
      return;
    }

    this.isConnecting = true;
    console.log('[WebSocket Proxy] Connecting to Delta Exchange...');

    try {
      this.deltaWS = new WebSocket(this.config.deltaWsUrl!);

      this.deltaWS.onopen = async () => {
        console.log('[WebSocket Proxy] Connected to Delta Exchange');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Authenticate if credentials are available
        if (this.config.apiKey && this.config.apiSecret) {
          await this.authenticateWithDelta();
        } else {
          console.warn('[WebSocket Proxy] No API credentials - connecting without authentication');
          this.broadcastToClients({
            type: 'auth_warning',
            data: { message: 'Connected without authentication - using mock data' }
          });
        }
      };

      this.deltaWS.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data.toString());
          console.log('[WebSocket Proxy] Received from Delta:', message.type || 'data');
          
          // Broadcast to all clients
          this.broadcastToClients(message);
        } catch (error) {
          console.error('[WebSocket Proxy] Error parsing Delta message:', error);
        }
      };

      this.deltaWS.onclose = (event) => {
        console.log('[WebSocket Proxy] Delta connection closed:', event.code, event.reason);
        this.isConnecting = false;
        this.deltaWS = null;

        // Notify clients
        this.broadcastToClients({
          type: 'disconnected',
          data: { message: 'Delta Exchange connection lost' }
        });

        // Attempt reconnection
        this.scheduleReconnection();
      };

      this.deltaWS.onerror = (error) => {
        console.error('[WebSocket Proxy] Delta connection error:', error);
        this.isConnecting = false;
      };

    } catch (error) {
      console.error('[WebSocket Proxy] Failed to connect to Delta:', error);
      this.isConnecting = false;
      throw error;
    }
  }

  private async authenticateWithDelta(): Promise<void> {
    if (!this.deltaWS || !this.config.apiKey || !this.config.apiSecret) {
      return;
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'GET';
      const path = '/live';
      const body = '';

      const signature = await generateHmacSha256(
        method + timestamp + path + body,
        this.config.apiSecret
      );

      const authMessage = {
        type: 'auth',
        payload: {
          api_key: this.config.apiKey,
          signature: signature,
          timestamp: timestamp
        }
      };

      this.deltaWS.send(JSON.stringify(authMessage));
      console.log('[WebSocket Proxy] Authentication message sent to Delta');

      // Notify clients
      this.broadcastToClients({
        type: 'auth_sent',
        data: { message: 'Authentication in progress' }
      });

    } catch (error) {
      console.error('[WebSocket Proxy] Authentication failed:', error);
      this.broadcastToClients({
        type: 'auth_error',
        data: { message: 'Authentication failed' }
      });
    }
  }

  private async handleClientMessage(client: WebSocket, message: any): Promise<void> {
    console.log('[WebSocket Proxy] Client message:', message.type || 'unknown');

    switch (message.type) {
      case 'subscribe':
        await this.handleSubscription(client, message);
        break;
      case 'unsubscribe':
        await this.handleUnsubscription(client, message);
        break;
      case 'ping':
        this.sendToClient(client, { type: 'pong', data: { timestamp: Date.now() } });
        break;
      default:
        console.warn('[WebSocket Proxy] Unknown client message type:', message.type);
    }
  }

  private async handleSubscription(client: WebSocket, message: any): Promise<void> {
    if (!this.deltaWS || this.deltaWS.readyState !== WebSocket.OPEN) {
      this.sendToClient(client, {
        type: 'subscription_error',
        data: { message: 'Delta connection not available' }
      });
      return;
    }

    try {
      // Forward subscription to Delta Exchange
      this.deltaWS.send(JSON.stringify(message));
      console.log('[WebSocket Proxy] Forwarded subscription:', message.payload?.channels);
    } catch (error) {
      console.error('[WebSocket Proxy] Subscription error:', error);
      this.sendToClient(client, {
        type: 'subscription_error',
        data: { message: 'Failed to subscribe' }
      });
    }
  }

  private async handleUnsubscription(client: WebSocket, message: any): Promise<void> {
    if (!this.deltaWS || this.deltaWS.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.deltaWS.send(JSON.stringify(message));
      console.log('[WebSocket Proxy] Forwarded unsubscription');
    } catch (error) {
      console.error('[WebSocket Proxy] Unsubscription error:', error);
    }
  }

  private scheduleReconnection(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[WebSocket Proxy] Max reconnection attempts reached');
      this.broadcastToClients({
        type: 'connection_failed',
        data: { message: 'Unable to reconnect to Delta Exchange' }
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(5000 * this.reconnectAttempts, 30000);
    
    console.log(`[WebSocket Proxy] Scheduling reconnection ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    
    setTimeout(() => {
      this.connectToDelta().catch(error => {
        console.error('[WebSocket Proxy] Reconnection failed:', error);
      });
    }, delay);
  }

  private sendToClient(client: WebSocket, message: any): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  private broadcastToClients(message: any): void {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  async stop(): Promise<void> {
    console.log('[WebSocket Proxy] Stopping proxy server...');

    if (this.deltaWS) {
      this.deltaWS.close();
      this.deltaWS = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    console.log('[WebSocket Proxy] Proxy server stopped');
  }
}

// Export singleton instance
export const deltaProxy = new DeltaWebSocketProxy();
