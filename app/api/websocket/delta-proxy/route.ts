/**
 * Delta Exchange WebSocket Proxy API Route
 * Handles server-side authentication and proxies WebSocket connections
 */

import { NextRequest } from 'next/server';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { generateHmacSha256 } from '@/lib/crypto-utils';

// Store active connections
const clients = new Set<WebSocket>();
let deltaWS: WebSocket | null = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Delta Exchange WebSocket configuration
const DELTA_WS_URL = process.env.NODE_ENV === 'production' 
  ? 'wss://socket.india.delta.exchange'
  : 'wss://socket.testnet.deltaex.org';

const API_KEY = process.env.DELTA_API_KEY;
const API_SECRET = process.env.DELTA_API_SECRET;

interface DeltaAuthMessage {
  type: 'auth';
  payload: {
    api_key: string;
    signature: string;
    timestamp: string;
  };
}

interface DeltaSubscribeMessage {
  type: 'subscribe';
  payload: {
    channels: Array<{
      name: string;
      symbols?: string[];
    }>;
  };
}

// Create authenticated connection to Delta Exchange
async function createDeltaConnection(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    if (isConnecting) {
      reject(new Error('Connection already in progress'));
      return;
    }

    isConnecting = true;
    console.log('[Delta Proxy] Creating authenticated connection to Delta Exchange...');

    const ws = new WebSocket(DELTA_WS_URL);

    const connectionTimeout = setTimeout(() => {
      ws.close();
      isConnecting = false;
      reject(new Error('Connection timeout'));
    }, 15000);

    ws.onopen = async () => {
      clearTimeout(connectionTimeout);
      console.log('[Delta Proxy] Connected to Delta Exchange, authenticating...');

      try {
        // Authenticate with Delta Exchange
        if (API_KEY && API_SECRET) {
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const method = 'GET';
          const path = '/live';
          const body = '';

          const signature = await generateHmacSha256(
            method + timestamp + path + body,
            API_SECRET
          );

          const authMessage: DeltaAuthMessage = {
            type: 'auth',
            payload: {
              api_key: API_KEY,
              signature: signature,
              timestamp: timestamp
            }
          };

          ws.send(JSON.stringify(authMessage));
          console.log('[Delta Proxy] Authentication message sent');
        } else {
          console.warn('[Delta Proxy] No API credentials - connecting without authentication');
        }

        isConnecting = false;
        reconnectAttempts = 0;
        resolve(ws);
      } catch (error) {
        console.error('[Delta Proxy] Authentication error:', error);
        ws.close();
        isConnecting = false;
        reject(error);
      }
    };

    ws.onerror = (error) => {
      clearTimeout(connectionTimeout);
      console.error('[Delta Proxy] WebSocket error:', error);
      isConnecting = false;
      reject(error);
    };

    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      console.log('[Delta Proxy] Connection closed:', event.code, event.reason);
      isConnecting = false;
      
      // Attempt reconnection
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`[Delta Proxy] Attempting reconnection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
        setTimeout(() => {
          createDeltaConnection().then(newWs => {
            deltaWS = newWs;
            setupDeltaMessageHandling(newWs);
          }).catch(error => {
            console.error('[Delta Proxy] Reconnection failed:', error);
          });
        }, 5000 * reconnectAttempts);
      }
    };
  });
}

// Setup message handling for Delta Exchange WebSocket
function setupDeltaMessageHandling(ws: WebSocket) {
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data.toString());
      console.log('[Delta Proxy] Received from Delta:', message.type || 'unknown');

      // Broadcast to all connected clients
      const messageStr = JSON.stringify(message);
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    } catch (error) {
      console.error('[Delta Proxy] Error parsing Delta message:', error);
    }
  };
}

// Handle client WebSocket connections
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const upgrade = request.headers.get('upgrade');

  if (upgrade !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 400 });
  }

  try {
    // Ensure Delta connection exists
    if (!deltaWS || deltaWS.readyState !== WebSocket.OPEN) {
      console.log('[Delta Proxy] Creating new Delta connection...');
      deltaWS = await createDeltaConnection();
      setupDeltaMessageHandling(deltaWS);
    }

    // This is a simplified example - in a real implementation,
    // you would need to handle the WebSocket upgrade properly
    return new Response('WebSocket proxy ready', { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('[Delta Proxy] Error setting up proxy:', error);
    return new Response('Proxy setup failed', { status: 500 });
  }
}

// Handle subscription requests from clients
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, channels } = body;

    if (!deltaWS || deltaWS.readyState !== WebSocket.OPEN) {
      return Response.json({ error: 'Delta connection not available' }, { status: 503 });
    }

    if (action === 'subscribe' && channels) {
      const subscribeMessage: DeltaSubscribeMessage = {
        type: 'subscribe',
        payload: {
          channels: channels
        }
      };

      deltaWS.send(JSON.stringify(subscribeMessage));
      console.log('[Delta Proxy] Subscription request sent:', channels);

      return Response.json({ success: true, message: 'Subscription request sent' });
    }

    return Response.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('[Delta Proxy] Error handling subscription:', error);
    return Response.json({ error: 'Subscription failed' }, { status: 500 });
  }
}

// Cleanup on process exit
process.on('SIGTERM', () => {
  console.log('[Delta Proxy] Cleaning up connections...');
  if (deltaWS) {
    deltaWS.close();
  }
  clients.forEach(client => client.close());
});

export const dynamic = 'force-dynamic';
