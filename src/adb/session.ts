import { UsbTransport } from '../usb/transport';
import { AdbAuth } from './auth';
import { decodeHeader, encodePacket, ADB_HEADER_LENGTH, cmdToString } from './packet';
import {
  A_CNXN,
  A_AUTH,
  AUTH_TOKEN,
  AUTH_SIGNATURE,
  AUTH_RSAPUBLICKEY,
  ADB_VERSION,
  MAX_PAYLOAD,
  A_OPEN,
  A_OKAY,
  A_WRTE,
  A_CLSE,
} from './constants';
import { AdbStream } from './stream';

export class AdbSession {
  transport = new UsbTransport();
  auth = new AdbAuth();
  deviceInfo = '';
  rawDeviceInfo = '';
  isConnected = false;

  private nextLocalId = 1;
  private activeStreams = new Map<number, AdbStream>();
  private disconnectListeners: (() => void)[] = [];
  private isReading = false;

  async connect(onAuthorizing: () => void): Promise<void> {
    await this.auth.init();

    // 1. Request USB device and connect
    const device = await this.transport.requestDevice();
    await this.transport.connect(device);

    // 2. Send CNXN handshake
    const connectStr = 'host::\0';
    const packet = encodePacket(A_CNXN, ADB_VERSION, MAX_PAYLOAD, connectStr);
    await this.sendPacket(packet);

    // 3. Handshake loop
    let signatureAttempted = false;

    while (true) {
      const { header, payload } = await this.readPacket();

      if (header.command === A_AUTH) {
        if (header.arg0 === AUTH_TOKEN) {
          if (!signatureAttempted) {
            const signature = await this.auth.sign(payload);
            const sigPacket = encodePacket(A_AUTH, AUTH_SIGNATURE, 0, signature);
            await this.sendPacket(sigPacket);
            signatureAttempted = true;
          } else {
            onAuthorizing();
            const pubKey = this.auth.getPublicKeyPayload();
            const pubPacket = encodePacket(A_AUTH, AUTH_RSAPUBLICKEY, 0, pubKey);
            await this.sendPacket(pubPacket);
          }
        }
      } else if (header.command === A_CNXN) {
        this.rawDeviceInfo = new TextDecoder().decode(payload);

        let model = 'Quest Device';
        const modelMatch = this.rawDeviceInfo.match(/ro\.product\.model=([^;]+)/);
        if (modelMatch) {
          model = modelMatch[1];
        }

        const serial = this.transport.device?.serialNumber || 'Unknown Serial';
        this.deviceInfo = `${model} (${serial})`;
        this.isConnected = true;
        console.log('Connected! Device Info:', this.deviceInfo);
        break;
      } else {
        console.warn('Unexpected packet during handshake:', cmdToString(header.command));
      }
    }

    // 4. Start background multiplexer read loop
    this.startReadLoop();
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => {
      this.disconnectListeners = this.disconnectListeners.filter((l) => l !== cb);
    };
  }

  async sendPacket(packet: Uint8Array): Promise<void> {
    await this.transport.write(packet as BufferSource);
  }

  async openStream(service: string): Promise<AdbStream> {
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }

    const localId = this.nextLocalId++;
    const stream = new AdbStream(localId, this);
    this.activeStreams.set(localId, stream);

    const serviceWithNull = service.endsWith('\0') ? service : service + '\0';
    const packet = encodePacket(A_OPEN, localId, 0, serviceWithNull);
    await this.sendPacket(packet);

    await stream.waitForOpen();
    return stream;
  }

  private async startReadLoop(): Promise<void> {
    if (this.isReading) return;
    this.isReading = true;

    try {
      while (this.isConnected) {
        const { header, payload } = await this.readPacket();

        const localId = header.arg1;
        const stream = this.activeStreams.get(localId);

        if (header.command === A_OKAY) {
          if (stream) {
            stream.handleOkay(header.arg0);
          }
        } else if (header.command === A_WRTE) {
          if (stream) {
            stream.handleData(payload);
            // Send back OKAY acknowledgement so device knows we got the chunk
            const ackPacket = encodePacket(A_OKAY, stream.localId, stream.remoteId);
            await this.sendPacket(ackPacket);
          }
        } else if (header.command === A_CLSE) {
          if (stream) {
            stream.handleClose();
            this.activeStreams.delete(localId);
          }
        } else {
          console.log(`[ADB Multiplexer] Unhandled packet: ${cmdToString(header.command)}`);
        }
      }
    } catch (err) {
      console.warn('[ADB Multiplexer] Read loop terminated:', err);
      this.handleConnectionLoss();
    } finally {
      this.isReading = false;
    }
  }

  private handleConnectionLoss(): void {
    if (!this.isConnected) return;
    this.isConnected = false;

    // Close all active streams
    for (const stream of this.activeStreams.values()) {
      stream.handleClose();
    }
    this.activeStreams.clear();

    for (const listener of this.disconnectListeners) {
      try {
        listener();
      } catch (e) {
        console.error('Error in disconnect listener:', e);
      }
    }
  }

  async readPacket(): Promise<{ header: any; payload: Uint8Array }> {
    const headerData = await this.readExact(ADB_HEADER_LENGTH);
    const header = decodeHeader(headerData);

    let payload: any = new Uint8Array(0);
    if (header.payloadLength > 0) {
      const payloadData = await this.readExact(header.payloadLength);
      payload = new Uint8Array(payloadData.buffer, payloadData.byteOffset, payloadData.byteLength);
    }

    return { header, payload };
  }

  private async readExact(length: number): Promise<DataView> {
    const buffer = new Uint8Array(length);
    let offset = 0;
    while (offset < length) {
      const chunk = await this.transport.read(length - offset);
      buffer.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength), offset);
      offset += chunk.byteLength;
    }
    return new DataView(buffer.buffer);
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.handleConnectionLoss();
    await this.transport.close();
  }
}
