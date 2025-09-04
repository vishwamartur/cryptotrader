/**
 * Delta Exchange Server-Sent Events (SSE) Proxy
 * Connects directly to official Delta Exchange WebSocket endpoints
 * Production: wss://socket.india.delta.exchange
 * Testnet: wss://socket-ind.testnet.deltaex.org
 */

import { NextRequest } from 'next/server';
import WebSocket from 'ws';
import crypto from 'crypto';
import { webSocketSecurity } from '@/lib/websocket-security';

// Global connection management
let deltaWS: WebSocket | null = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const clients = new Set<ReadableStreamDefaultController>();

// Delta Exchange configuration - Official WebSocket endpoints
const DELTA_WS_URL = process.env.NODE_ENV === 'production'
  ? 'wss://socket.india.delta.exchange'
  : 'wss://socket-ind.testnet.deltaex.org';

const API_KEY = process.env.DELTA_API_KEY;
const API_SECRET = process.env.DELTA_API_SECRET;

interface StreamMessage {
  type: string;
  data: any;
  timestamp: number;
}

// Create authenticated connection to Delta Exchange
async function ensureDeltaConnection(): Promise<WebSocket> {
  if (deltaWS && deltaWS.readyState === WebSocket.OPEN) {
    return deltaWS;
  }

  if (isConnecting) {
    // Wait for existing connection attempt
    return new Promise((resolve, reject) => {
      const checkConnection = () => {
        if (deltaWS && deltaWS.readyState === WebSocket.OPEN) {
          resolve(deltaWS);
        } else if (!isConnecting) {
          reject(new Error('Connection failed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });
  }

  return new Promise((resolve, reject) => {
    isConnecting = true;
    console.log('[Delta Stream] Creating authenticated connection...');

    const ws = new WebSocket(DELTA_WS_URL);
    let authTimeout: NodeJS.Timeout;

    ws.onopen = async () => {
      console.log('[Delta Stream] Connected to Delta Exchange');

      try {
        if (API_KEY && API_SECRET) {
          // Authenticate with Delta Exchange
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const method = 'GET';
          const path = '/live';
          const body = '';

          const signature = crypto
            .createHmac('sha256', API_SECRET)
            .update(method + timestamp + path + body)
            .digest('hex');

          const authMessage = {
            type: 'auth',
            payload: {
              api_key: API_KEY,
              signature: signature,
              timestamp: timestamp
            }
          };

          ws.send(JSON.stringify(authMessage));
          console.log('[Delta Stream] Authentication sent');

          // Wait for auth response
          authTimeout = setTimeout(() => {
            console.log('[Delta Stream] Authentication timeout - proceeding anyway');
            isConnecting = false;
            reconnectAttempts = 0;
            deltaWS = ws;
            resolve(ws);
          }, 5000);

        } else {
          console.warn('[Delta Stream] No credentials - connecting without auth');
          isConnecting = false;
          reconnectAttempts = 0;
          deltaWS = ws;
          resolve(ws);
        }
      } catch (error) {
        console.error('[Delta Stream] Authentication error:', error);
        ws.close();
        isConnecting = false;
        reject(error);
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data.toString());
        
        // Handle auth response
        if (message.type === 'auth_success') {
          console.log('[Delta Stream] Authentication successful');
          clearTimeout(authTimeout);
          isConnecting = false;
          reconnectAttempts = 0;
          deltaWS = ws;
          resolve(ws);
          return;
        }

        if (message.type === 'auth_error') {
          console.error('[Delta Stream] Authentication failed:', message);
          clearTimeout(authTimeout);
          ws.close();
          isConnecting = false;
          reject(new Error('Authentication failed'));
          return;
        }

        // Broadcast to all SSE clients
        const streamMessage: StreamMessage = {
          type: message.type || 'data',
          data: message,
          timestamp: Date.now()
        };

        broadcastToClients(streamMessage);

      } catch (error) {
        console.error('[Delta Stream] Message parsing error:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('[Delta Stream] Connection closed:', event.code, event.reason);
      clearTimeout(authTimeout);
      isConnecting = false;
      deltaWS = null;

      // Notify clients
      broadcastToClients({
        type: 'connection_closed',
        data: { code: event.code, reason: event.reason },
        timestamp: Date.now()
      });

      // Schedule reconnection
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = Math.min(5000 * reconnectAttempts, 30000);
        console.log(`[Delta Stream] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
        
        setTimeout(() => {
          ensureDeltaConnection().catch(error => {
            console.error('[Delta Stream] Reconnection failed:', error);
          });
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('[Delta Stream] WebSocket error:', error);
      clearTimeout(authTimeout);
      isConnecting = false;
      reject(error);
    };
  });
}

// Broadcast message to all connected SSE clients
function broadcastToClients(message: StreamMessage) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  
  clients.forEach(controller => {
    try {
      controller.enqueue(new TextEncoder().encode(data));
    } catch (error) {
      console.error('[Delta Stream] Error sending to client:', error);
      clients.delete(controller);
    }
  });
}

// Handle SSE connections
export async function GET(request: NextRequest) {
  console.log('[Delta Stream] New SSE client connecting...');

  // Validate credentials first
  const credentialsCheck = webSocketSecurity.validateCredentials();
  if (!credentialsCheck.valid) {
    console.error('[Delta Stream] Invalid credentials:', credentialsCheck.error);
    return Response.json({
      error: 'Server configuration error',
      details: credentialsCheck.error
    }, { status: 500 });
  }

  // Validate request security
  const securityCheck = webSocketSecurity.validateWebSocketRequest(request);
  if (!securityCheck.valid) {
    console.warn('[Delta Stream] Security check failed:', securityCheck.error);
    return Response.json({
      error: 'Request not allowed',
      details: securityCheck.error
    }, { status: 403 });
  }

  const clientId = securityCheck.clientId!;

  // Create readable stream for SSE
  let streamController: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      streamController = controller; // Store controller reference for cancel method
      clients.add(controller);
      webSocketSecurity.registerConnection(clientId, request);
      console.log(`[Delta Stream] Client ${clientId} connected. Total clients: ${clients.size}`);

      // Send initial connection message
      const welcomeMessage: StreamMessage = {
        type: 'connected',
        data: { message: 'Connected to Delta Exchange stream' },
        timestamp: Date.now()
      };

      const data = `data: ${JSON.stringify(welcomeMessage)}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));

      // Ensure Delta connection
      ensureDeltaConnection().catch(error => {
        console.error('[Delta Stream] Failed to connect to Delta:', error);
        const errorMessage: StreamMessage = {
          type: 'connection_error',
          data: { message: 'Failed to connect to Delta Exchange' },
          timestamp: Date.now()
        };
        const errorData = `data: ${JSON.stringify(errorMessage)}\n\n`;
        controller.enqueue(new TextEncoder().encode(errorData));
      });
    },

    cancel() {
      if (streamController) {
        clients.delete(streamController);
      }
      webSocketSecurity.unregisterConnection(clientId);
      console.log(`[Delta Stream] Client ${clientId} disconnected. Total clients: ${clients.size}`);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

// Handle subscription requests
export async function POST(request: NextRequest) {
  try {
    // Validate request security
    const securityCheck = webSocketSecurity.validateWebSocketRequest(request);
    if (!securityCheck.valid) {
      console.warn('[Delta Stream] Subscription security check failed:', securityCheck.error);
      return Response.json({
        error: 'Request not allowed',
        details: securityCheck.error
      }, { status: 403 });
    }

    const body = await request.json();
    const { action, channels } = body;

    console.log('[Delta Stream] Subscription request:', { action, channels });

    // Ensure Delta connection
    const ws = await ensureDeltaConnection();

    if (action === 'subscribe' && channels) {
      const subscribeMessage = {
        type: 'subscribe',
        payload: {
          channels: channels
        }
      };

      ws.send(JSON.stringify(subscribeMessage));
      console.log('[Delta Stream] Subscription sent to Delta');

      return Response.json({ 
        success: true, 
        message: 'Subscription request sent',
        channels: channels
      });
    }

    if (action === 'unsubscribe' && channels) {
      const unsubscribeMessage = {
        type: 'unsubscribe',
        payload: {
          channels: channels
        }
      };

      ws.send(JSON.stringify(unsubscribeMessage));
      console.log('[Delta Stream] Unsubscription sent to Delta');

      return Response.json({ 
        success: true, 
        message: 'Unsubscription request sent',
        channels: channels
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[Delta Stream] Subscription error:', error);
    return Response.json({ 
      error: 'Subscription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Health check endpoint with security statistics
export async function HEAD() {
  const isHealthy = deltaWS && deltaWS.readyState === WebSocket.OPEN;
  const stats = webSocketSecurity.getStats();

  return new Response(null, {
    status: isHealthy ? 200 : 503,
    headers: {
      'X-Delta-Connection': isHealthy ? 'connected' : 'disconnected',
      'X-Client-Count': clients.size.toString(),
      'X-Active-Connections': stats.activeConnections.toString(),
      'X-Max-Connections': stats.maxConnections.toString(),
      'X-Rate-Limit-Max': stats.maxRequests.toString(),
      'X-Rate-Limit-Window': stats.windowMs.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}

export const dynamic = 'force-dynamic';
