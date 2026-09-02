import { calculateChecksum } from './constants';

export interface AdbPacketHeader {
  command: number;
  arg0: number;
  arg1: number;
  payloadLength: number;
  checksum: number;
  magic: number;
}

export const ADB_HEADER_LENGTH = 24;

/**
 * Encodes an ADB packet (header + payload) into a single Uint8Array ready for USB transmission.
 */
export function encodePacket(
  command: number,
  arg0: number,
  arg1: number,
  payload: string | Uint8Array | null = null
): Uint8Array {
  
  let payloadBytes: any = new Uint8Array(0);
  if (typeof payload === 'string') {
    payloadBytes = new TextEncoder().encode(payload);
  } else if (payload instanceof Uint8Array) {
    payloadBytes = payload;
  }

  const header = new ArrayBuffer(ADB_HEADER_LENGTH);
  const view = new DataView(header);

  view.setUint32(0, command, true); // Little-endian
  view.setUint32(4, arg0, true);
  view.setUint32(8, arg1, true);
  view.setUint32(12, payloadBytes.length, true);
  view.setUint32(16, calculateChecksum(payloadBytes), true);
  view.setUint32(20, command ^ 0xFFFFFFFF, true); // Magic is command ^ 0xFFFFFFFF

  const fullPacket = new Uint8Array(ADB_HEADER_LENGTH + payloadBytes.length);
  fullPacket.set(new Uint8Array(header), 0);
  fullPacket.set(payloadBytes, ADB_HEADER_LENGTH);

  return fullPacket;
}

/**
 * Decodes the 24-byte ADB header.
 */
export function decodeHeader(buffer: DataView): AdbPacketHeader {
  if (buffer.byteLength < ADB_HEADER_LENGTH) {
    throw new Error(`Buffer too small for ADB header: ${buffer.byteLength}`);
  }

  return {
    command: buffer.getUint32(0, true),
    arg0: buffer.getUint32(4, true),
    arg1: buffer.getUint32(8, true),
    payloadLength: buffer.getUint32(12, true),
    checksum: buffer.getUint32(16, true),
    magic: buffer.getUint32(20, true),
  };
}

/**
 * Helper to convert command number back to 4-char string (e.g. for logging)
 */
export function cmdToString(cmd: number): string {
  return String.fromCharCode(
    cmd & 0xFF,
    (cmd >> 8) & 0xFF,
    (cmd >> 16) & 0xFF,
    (cmd >> 24) & 0xFF
  );
}
