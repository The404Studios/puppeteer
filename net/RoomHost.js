// === puppeteer/net/RoomHost.js ===
import WebSocket, { WebSocketServer } from 'ws';
import { decodeTransform } from './SyncPacket.js';
import * as Interpolator from '../interp/Interpolator.js';
import { log } from '../utils/Logger.js';

const clients = new Map();

export function startServer(port = 8080) {
  const wss = new WebSocketServer({ port });
  log(`RoomHost listening on ws://localhost:${port}`);

  wss.on('connection', (ws) => {
    const id = Date.now().toString();
    clients.set(id, ws);
    log(`Client connected: ${id}`);

    ws.on('message', (msg) => {
      const data = decodeTransform(msg);
      Interpolator.addSnapshot(data.id, {
        transform: data.transform,
        timestamp: data.timestamp
      });
    });

    ws.on('close', () => {
      clients.delete(id);
      log(`Client disconnected: ${id}`);
    });
  });
} 

export function broadcast(message) {
  for (const ws of clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}
