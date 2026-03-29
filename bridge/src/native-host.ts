#!/usr/bin/env node

/**
 * site-sense Native Messaging Host
 *
 * Thin relay between Chrome extension (native messaging on stdin/stdout)
 * and the MCP server (Unix domain socket).
 *
 * Chrome starts this process when the extension calls connectNative().
 * It connects to the MCP server's socket and pipes messages both ways.
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
const INFO_PATH = path.join(SOCKET_DIR, 'bridge.json');

function getSocketPaths(): string[] {
  try {
    const info = JSON.parse(fs.readFileSync(INFO_PATH, 'utf-8'));
    const entries = Array.isArray(info) ? info : [info];
    return entries.map((e: { socketPath: string }) => e.socketPath).filter(Boolean);
  } catch {
    return [];
  }
}

function connectToFirst(paths: string[]): net.Socket {
  if (paths.length === 0) {
    throw new Error('No MCP server sockets found. Is a CLI session running?');
  }

  // Try first available socket
  const socketPath = paths[0];
  const socket = net.createConnection(socketPath);

  socket.on('error', () => {
    // Try next socket if this one fails
    if (paths.length > 1) {
      const next = connectToFirst(paths.slice(1));
      relay(next);
    } else {
      const errorMsg = encodeNativeMessage({
        type: 'error',
        error: 'Failed to connect to any MCP server. Is a CLI session running?',
      });
      process.stdout.write(errorMsg);
      process.exit(1);
    }
  });

  return socket;
}

function relay(socket: net.Socket) {
  const stdinReader = createNativeMessageReader();
  process.stdin.on('data', (chunk: Buffer) => {
    stdinReader.push(chunk);
    let msg: unknown;
    while ((msg = stdinReader.read()) !== null) {
      socket.write(encodeNativeMessage(msg));
    }
  });

  const socketReader = createNativeMessageReader();
  socket.on('data', (chunk: Buffer) => {
    socketReader.push(chunk);
    let msg: unknown;
    while ((msg = socketReader.read()) !== null) {
      process.stdout.write(encodeNativeMessage(msg));
    }
  });

  socket.on('close', () => process.exit(0));
  process.stdin.on('end', () => { socket.destroy(); process.exit(0); });
}

function main() {
  const paths = getSocketPaths();
  const socket = connectToFirst(paths);
  relay(socket);
}

main();
