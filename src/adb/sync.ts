import type { AdbSession } from './session';
import type { AdbStream } from './stream';

class SyncStreamReader {
  private buffer: Uint8Array[] = [];
  private totalBuffered = 0;
  private waiters: { n: number; resolve: (buf: Uint8Array) => void; reject: (err: Error) => void }[] = [];
  private isClosed = false;
  private closeError?: Error;

  constructor(stream: AdbStream) {
    stream.onData((chunk) => {
      this.buffer.push(chunk);
      this.totalBuffered += chunk.length;
      this.flush();
    });

    stream.onClose(() => {
      this.isClosed = true;
      this.closeError = new Error('Sync stream closed prematurely');
      while (this.waiters.length > 0) {
        const waiter = this.waiters.shift()!;
        waiter.reject(this.closeError);
      }
    });
  }

  async readExact(n: number): Promise<Uint8Array> {
    if (this.totalBuffered >= n) {
      return this.consume(n);
    }
    if (this.isClosed) {
      throw this.closeError || new Error('Sync stream closed');
    }
    return new Promise((resolve, reject) => {
      this.waiters.push({ n, resolve, reject });
    });
  }

  private flush() {
    while (this.waiters.length > 0 && this.totalBuffered >= this.waiters[0].n) {
      const waiter = this.waiters.shift()!;
      waiter.resolve(this.consume(waiter.n));
    }
  }

  private consume(n: number): Uint8Array {
    const out = new Uint8Array(n);
    let offset = 0;
    while (offset < n && this.buffer.length > 0) {
      const head = this.buffer[0];
      const need = n - offset;
      if (head.length <= need) {
        out.set(head, offset);
        offset += head.length;
        this.buffer.shift();
      } else {
        out.set(head.subarray(0, need), offset);
        this.buffer[0] = head.subarray(need);
        offset += need;
      }
    }
    this.totalBuffered -= n;
    return out;
  }
}

function makeHeader(id: string, arg: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  for (let i = 0; i < 4; i++) {
    view.setUint8(i, id.charCodeAt(i));
  }
  view.setUint32(4, arg, true); // Little-endian
  return new Uint8Array(buf);
}

function parseHeader(headerBytes: Uint8Array): { id: string; arg: number } {
  const view = new DataView(headerBytes.buffer, headerBytes.byteOffset, 8);
  const id = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  const arg = view.getUint32(4, true);
  return { id, arg };
}

export class AdbSync {
  constructor(private session: AdbSession) {}

  /**
   * Pushes a file or byte buffer to remote path with progress reporting
   */
  async push(
    data: Blob | Uint8Array,
    remotePath: string,
    onProgress?: (sent: number, total: number) => void
  ): Promise<void> {
    const stream = await this.session.openStream('sync:');
    const reader = new SyncStreamReader(stream);

    try {
      // 1. SEND request: path + ",33188" (0o100644 mode)
      const pathAndMode = `${remotePath},33188`;
      const pathBytes = new TextEncoder().encode(pathAndMode);
      const sendHeader = makeHeader('SEND', pathBytes.length);

      const initPacket = new Uint8Array(sendHeader.length + pathBytes.length);
      initPacket.set(sendHeader, 0);
      initPacket.set(pathBytes, sendHeader.length);
      await stream.write(initPacket);

      // 2. DATA chunks (up to 64 KB)
      const CHUNK_SIZE = 64 * 1024;
      let totalBytes: number;
      let bytesSent = 0;

      if (data instanceof Blob) {
        totalBytes = data.size;
        let offset = 0;
        while (offset < totalBytes) {
          const slice = data.slice(offset, offset + CHUNK_SIZE);
          const arrayBuffer = await slice.arrayBuffer();
          const chunk = new Uint8Array(arrayBuffer);

          const dataHeader = makeHeader('DATA', chunk.length);
          const chunkPacket = new Uint8Array(dataHeader.length + chunk.length);
          chunkPacket.set(dataHeader, 0);
          chunkPacket.set(chunk, dataHeader.length);

          await stream.write(chunkPacket);
          offset += chunk.length;
          bytesSent += chunk.length;
          onProgress?.(bytesSent, totalBytes);
        }
      } else {
        totalBytes = data.length;
        let offset = 0;
        while (offset < totalBytes) {
          const chunk = data.subarray(offset, Math.min(offset + CHUNK_SIZE, totalBytes));
          const dataHeader = makeHeader('DATA', chunk.length);
          const chunkPacket = new Uint8Array(dataHeader.length + chunk.length);
          chunkPacket.set(dataHeader, 0);
          chunkPacket.set(chunk, dataHeader.length);

          await stream.write(chunkPacket);
          offset += chunk.length;
          bytesSent += chunk.length;
          onProgress?.(bytesSent, totalBytes);
        }
      }

      // 3. DONE packet with mtime
      const mtime = Math.floor(Date.now() / 1000);
      await stream.write(makeHeader('DONE', mtime));

      // 4. Response check
      const resHeaderBytes = await reader.readExact(8);
      const { id, arg } = parseHeader(resHeaderBytes);

      if (id === 'FAIL') {
        const errBytes = await reader.readExact(arg);
        const errMsg = new TextDecoder().decode(errBytes);
        throw new Error(`Sync push failed: ${errMsg}`);
      }

      if (id !== 'OKAY') {
        throw new Error(`Sync push unexpected response: ${id}`);
      }
    } finally {
      // 5. QUIT
      try {
        await stream.write(makeHeader('QUIT', 0));
        await stream.close();
      } catch (e) {
        console.warn('Error closing sync stream:', e);
      }
    }
  }

  /**
   * Pulls a file from remote path into memory
   */
  async pull(
    remotePath: string,
    onProgress?: (received: number) => void
  ): Promise<Uint8Array> {
    const stream = await this.session.openStream('sync:');
    const reader = new SyncStreamReader(stream);

    try {
      // 1. RECV request
      const pathBytes = new TextEncoder().encode(remotePath);
      const recvHeader = makeHeader('RECV', pathBytes.length);

      const packet = new Uint8Array(recvHeader.length + pathBytes.length);
      packet.set(recvHeader, 0);
      packet.set(pathBytes, recvHeader.length);
      await stream.write(packet);

      // 2. Read DATA chunks until DONE
      const chunks: Uint8Array[] = [];
      let totalReceived = 0;

      while (true) {
        const headerBytes = await reader.readExact(8);
        const { id, arg } = parseHeader(headerBytes);

        if (id === 'DATA') {
          const chunk = await reader.readExact(arg);
          chunks.push(chunk);
          totalReceived += chunk.length;
          onProgress?.(totalReceived);
        } else if (id === 'DONE') {
          break;
        } else if (id === 'FAIL') {
          const errBytes = await reader.readExact(arg);
          const errMsg = new TextDecoder().decode(errBytes);
          throw new Error(`Sync pull failed: ${errMsg}`);
        } else {
          throw new Error(`Sync pull unexpected response: ${id}`);
        }
      }

      // Assemble chunks
      const result = new Uint8Array(totalReceived);
      let offset = 0;
      for (const c of chunks) {
        result.set(c, offset);
        offset += c.length;
      }

      return result;
    } finally {
      try {
        await stream.write(makeHeader('QUIT', 0));
        await stream.close();
      } catch (e) {
        console.warn('Error closing sync stream:', e);
      }
    }
  }
}
