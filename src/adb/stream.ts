import { encodePacket } from './packet';
import { A_WRTE, A_CLSE } from './constants';
import type { AdbSession } from './session';

export class AdbStream {
  public localId: number;
  public remoteId: number = 0;
  public isClosed: boolean = false;

  private session: AdbSession;
  private openResolver?: () => void;
  private openRejecter?: (err: Error) => void;
  private writeResolver?: () => void;
  private dataListeners: ((chunk: Uint8Array) => void)[] = [];
  private closeListeners: (() => void)[] = [];

  constructor(localId: number, session: AdbSession) {
    this.localId = localId;
    this.session = session;
  }

  waitForOpen(timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Stream ${this.localId} open timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.openResolver = () => {
        clearTimeout(timer);
        resolve();
      };
      this.openRejecter = (err) => {
        clearTimeout(timer);
        reject(err);
      };
    });
  }

  handleOkay(remoteId: number): void {
    if (!this.remoteId) {
      this.remoteId = remoteId;
      if (this.openResolver) {
        this.openResolver();
        this.openResolver = undefined;
      }
    } else {
      // Acknowledgement of written data
      if (this.writeResolver) {
        const resolve = this.writeResolver;
        this.writeResolver = undefined;
        resolve();
      }
    }
  }

  handleData(payload: Uint8Array): void {
    for (const listener of this.dataListeners) {
      try {
        listener(payload);
      } catch (e) {
        console.error('Error in stream data listener:', e);
      }
    }
  }

  handleClose(): void {
    if (this.isClosed) return;
    this.isClosed = true;

    if (this.openRejecter) {
      this.openRejecter(new Error('Stream closed before opening'));
      this.openRejecter = undefined;
    }

    if (this.writeResolver) {
      this.writeResolver();
      this.writeResolver = undefined;
    }

    for (const listener of this.closeListeners) {
      try {
        listener();
      } catch (e) {
        console.error('Error in stream close listener:', e);
      }
    }
  }

  onData(cb: (chunk: Uint8Array) => void): () => void {
    this.dataListeners.push(cb);
    return () => {
      this.dataListeners = this.dataListeners.filter((l) => l !== cb);
    };
  }

  onClose(cb: () => void): () => void {
    this.closeListeners.push(cb);
    return () => {
      this.closeListeners = this.closeListeners.filter((l) => l !== cb);
    };
  }

  async write(data: Uint8Array | string): Promise<void> {
    if (this.isClosed) {
      throw new Error('Cannot write to closed stream');
    }

    const payload = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const packet = encodePacket(A_WRTE, this.localId, this.remoteId, payload);

    // Wait for the OKAY ack from device
    const writeAckPromise = new Promise<void>((resolve) => {
      this.writeResolver = resolve;
    });

    await this.session.sendPacket(packet);
    await writeAckPromise;
  }

  async close(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;
    try {
      const packet = encodePacket(A_CLSE, this.localId, this.remoteId);
      await this.session.sendPacket(packet);
    } catch (e) {
      console.warn('Error sending CLSE packet:', e);
    }
  }

  readAll(): Promise<Uint8Array> {
    return new Promise((resolve) => {
      const chunks: Uint8Array[] = [];
      let totalLength = 0;

      this.onData((chunk) => {
        chunks.push(chunk);
        totalLength += chunk.length;
      });

      this.onClose(() => {
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const c of chunks) {
          result.set(c, offset);
          offset += c.length;
        }
        resolve(result);
      });
    });
  }
}
