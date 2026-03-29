#!/usr/bin/env node

/**
 * site-sense Native Messaging Host — Socket Server
 *
 * Chrome starts this process when the extension calls connectNative().
 * It creates a Unix socket server and accepts connections from MCP server
 * instances (one per CLI session). Routes messages between Chrome and
 * whichever MCP client sent the request.
 *
 * Architecture (matching Claude's native host pattern):
 *   Chrome Extension ↔ this process (stdio) ↔ socket server ← MCP clients
 */

import * as net from 'node:net';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  encodeNativeMessage,
  createNativeMessageReader,
} from './native-messaging.js';

const SOCKET_DIR = path.join(os.tmpdir(), 'site-sense');
const SOCKET_PATH = path.join(SOCKET_DIR, 'bridge.sock');

// Track connected MCP clients
const clients = new Map<number, net.Socket>();
let nextClientId = 1;

// Track which client is waiting for a response (by request ID)
const pendingRequestClient = new Map<string, number>();

// ─── Chrome stdio (extension ↔ this process) ───────────────────────

const chromeReader = createNativeMessageReader();

process.stdin.on('data', (chunk: Buffer) => {
  chromeReader.push(chunk);
  let msg: unknown;
  while ((msg = chromeReader.read()) !== null) {
    // Response from Chrome — route to the MCP client that sent the request
    const message = msg as { id?: string; type?: string };
    if (message.id && pendingRequestClient.has(message.id)) {
      const clientId = pendingRequestClient.get(message.id)!;
      pendingRequestClient.delete(message.id);
      const client = clients.get(clientId);
      if (client && !client.destroyed) {
        client.write(encodeNativeMessage(msg));
      }
    } else {
      // Broadcast to all clients (e.g. unsolicited events)
      for (const client of clients.values()) {
        if (!client.destroyed) client.write(encodeNativeMessage(msg));
      }
    }
  }
});

process.stdin.on('end', () => {
  // Chrome disconnected — shut down
  for (const client of clients.values()) client.destroy();
  try { fs.unlinkSync(SOCKET_PATH); } catch { /* ok */ }
  process.exit(0);
});

// ─── Socket server (MCP clients → this process) ────────────────────

fs.mkdirSync(SOCKET_DIR, { recursive: true, mode: 0o700 });
try { fs.chmodSync(SOCKET_DIR, 0o700); } catch { /* ok */ }

// Clean up stale socket
try { fs.unlinkSync(SOCKET_PATH); } catch { /* ok */ }

const server = net.createServer((socket) => {
  const clientId = nextClientId++;
  clients.set(clientId, socket);

  const reader = createNativeMessageReader();

  socket.on('data', (chunk: Buffer) => {
    reader.push(chunk);
    let msg: unknown;
    while ((msg = reader.read()) !== null) {
      // Request from MCP client — forward to Chrome, track which client sent it
      const message = msg as { id?: string };
      if (message.id) {
        pendingRequestClient.set(message.id, clientId);
      }
      // Forward to Chrome via stdout
      process.stdout.write(encodeNativeMessage(msg));
    }
  });

  socket.on('close', () => {
    clients.delete(clientId);
    // Clean up any pending requests for this client
    for (const [id, cid] of pendingRequestClient) {
      if (cid === clientId) pendingRequestClient.delete(id);
    }
  });

  socket.on('error', () => socket.destroy());
});

server.listen(SOCKET_PATH);
try { fs.chmodSync(SOCKET_PATH, 0o600); } catch { /* ok */ }
