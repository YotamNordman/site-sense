/**
 * Chrome Native Messaging protocol: 4-byte little-endian length prefix + UTF-8 JSON.
 * Used for communication between Chrome extensions and native host binaries.
 */

const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB Chrome limit

export function encodeNativeMessage(message: unknown): Buffer {
  const json = JSON.stringify(message);
  const body = Buffer.from(json, 'utf-8');

  if (body.length > MAX_MESSAGE_SIZE) {
    throw new Error(
      `Message exceeds Chrome's 1MB limit: ${body.length} bytes`
    );
  }

  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

export interface NativeMessageReader {
  push(chunk: Buffer): void;
  read(): unknown | null;
}

/**
 * Streaming reader that reassembles length-prefixed messages from partial chunks.
 */
export function createNativeMessageReader(): NativeMessageReader {
  let buffer = Buffer.alloc(0);

  return {
    push(chunk: Buffer) {
      buffer = Buffer.concat([buffer, chunk]);
    },

    read(): unknown | null {
      if (buffer.length < 4) return null;

      const length = buffer.readUInt32LE(0);

      if (length > MAX_MESSAGE_SIZE) {
        throw new Error(
          `Message length ${length} exceeds Chrome's 1MB limit`
        );
      }

      if (buffer.length < 4 + length) return null;

      const json = buffer.subarray(4, 4 + length).toString('utf-8');
      buffer = buffer.subarray(4 + length);

      return JSON.parse(json);
    },
  };
}
