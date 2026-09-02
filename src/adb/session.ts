import { UsbTransport } from '../usb/transport';
import { AdbAuth } from './auth';
import { decodeHeader, encodePacket, ADB_HEADER_LENGTH, cmdToString } from './packet';
import { A_CNXN, A_AUTH, AUTH_TOKEN, AUTH_SIGNATURE, AUTH_RSAPUBLICKEY, ADB_VERSION, MAX_PAYLOAD } from './constants';

export class AdbSession {
  transport = new UsbTransport();
  auth = new AdbAuth();
  deviceInfo = '';

  async connect(onAuthorizing: () => void): Promise<void> {
    await this.auth.init();
    
    // 1. Request USB device and connect
    const device = await this.transport.requestDevice();
    await this.transport.connect(device);

    // 2. Send CNXN handshake
    const connectStr = 'host::\0';
    const packet = encodePacket(A_CNXN, ADB_VERSION, MAX_PAYLOAD, connectStr);
    await this.transport.write(packet as BufferSource);

    // 3. Read loop for Handshake
    let signatureAttempted = false;
    
    while (true) {
      const { header, payload } = await this.readPacket();

      if (header.command === A_AUTH) {
        if (header.arg0 === AUTH_TOKEN) {
          if (!signatureAttempted) {
            // First auth attempt: Sign the token
            const signature = await this.auth.sign(payload);
            const sigPacket = encodePacket(A_AUTH, AUTH_SIGNATURE, 0, signature);
            await this.transport.write(sigPacket as BufferSource);
            signatureAttempted = true;
          } else {
            // Signature rejected (key not trusted yet), send public key
            onAuthorizing(); // Notify UI to prompt user to check headset
            const pubKey = this.auth.getPublicKeyPayload();
            const pubPacket = encodePacket(A_AUTH, AUTH_RSAPUBLICKEY, 0, pubKey);
            await this.transport.write(pubPacket as BufferSource);
          }
        }
      } else if (header.command === A_CNXN) {
        // Success! Device accepted the connection
        const rawInfo = new TextDecoder().decode(payload);
        
        // Parse the model name from ro.product.model=Quest 3;
        let model = 'Unknown Device';
        const modelMatch = rawInfo.match(/ro\.product\.model=([^;]+)/);
        if (modelMatch) {
          model = modelMatch[1];
        }
        
        // Grab the serial number from WebUSB
        const serial = this.transport.device?.serialNumber || 'Unknown Serial';
        
        this.deviceInfo = `${model} (${serial})`;
        console.log('Connected! Device Info:', this.deviceInfo, '| Raw:', rawInfo);
        break; // Handshake complete
      } else {
        console.warn('Unexpected packet during handshake:', cmdToString(header.command));
      }
    }
  }

  async readPacket(): Promise<{ header: any, payload: Uint8Array }> {
    // Read exact 24 bytes for header
    let headerData = await this.readExact(ADB_HEADER_LENGTH);
    const header = decodeHeader(headerData);

    // Read payload if any
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

  async disconnect() {
    await this.transport.close();
  }
}
