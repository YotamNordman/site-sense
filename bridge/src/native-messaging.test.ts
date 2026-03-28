import { describe, it, expect } from 'vitest';
import {
  encodeNativeMessage,
  createNativeMessageReader,
} from './native-messaging.js';

describe('encodeNativeMessage', () => {
  it('encodes a message with 4-byte LE length prefix', () => {
    const msg = { type: 'capture' };
    const encoded = encodeNativeMessage(msg);
    const json = JSON.stringify(msg);

    // First 4 bytes: little-endian length
    expect(encoded.readUInt32LE(0)).toBe(json.length);
    // Remaining bytes: JSON
    expect(encoded.subarray(4).toString('utf-8')).toBe(json);
  });

  it('rejects messages over 1MB', () => {
    const huge = { data: 'x'.repeat(1024 * 1024 + 1) };
    expect(() => encodeNativeMessage(huge)).toThrow('1MB limit');
  });
});

describe('createNativeMessageReader', () => {
  it('reads a complete message', () => {
    const reader = createNativeMessageReader();
    const msg = { type: 'status', connected: true };
    reader.push(encodeNativeMessage(msg));

    expect(reader.read()).toEqual(msg);
    expect(reader.read()).toBeNull(); // no more messages
  });

  it('handles partial reads (stream reassembly)', () => {
    const reader = createNativeMessageReader();
    const msg = { type: 'capture_response', url: 'https://example.com' };
    const encoded = encodeNativeMessage(msg);

    // Split into 3 chunks
    reader.push(encoded.subarray(0, 2)); // partial header
    expect(reader.read()).toBeNull();

    reader.push(encoded.subarray(2, 10)); // rest of header + partial body
    expect(reader.read()).toBeNull();

    reader.push(encoded.subarray(10)); // rest of body
    expect(reader.read()).toEqual(msg);
  });

  it('reads multiple messages from a single buffer', () => {
    const reader = createNativeMessageReader();
    const msg1 = { type: 'a' };
    const msg2 = { type: 'b' };

    reader.push(
      Buffer.concat([encodeNativeMessage(msg1), encodeNativeMessage(msg2)])
    );

    expect(reader.read()).toEqual(msg1);
    expect(reader.read()).toEqual(msg2);
    expect(reader.read()).toBeNull();
  });

  it('rejects messages with length exceeding 1MB', () => {
    const reader = createNativeMessageReader();
    const header = Buffer.alloc(4);
    header.writeUInt32LE(1024 * 1024 + 1, 0);
    reader.push(header);

    expect(() => reader.read()).toThrow('1MB limit');
  });
});
