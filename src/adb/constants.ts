/**
 * ADB Protocol Constants
 * Reference: https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/master/protocol.txt
 */

export const ADB_MAGIC = 0x01000000;
export const ADB_VERSION = 0x01000001;
export const MAX_PAYLOAD = 1024 * 1024; // 1MB payload (typical max is 256K, but we allow up to 1MB)

// Command IDs (Little-Endian integer equivalents of string commands)
// Using bitwise shift for easy constant representation
function cmd(str: string): number {
  return str.charCodeAt(0) |
    (str.charCodeAt(1) << 8) |
    (str.charCodeAt(2) << 16) |
    (str.charCodeAt(3) << 24);
}

export const A_SYNC = cmd('SYNC');
export const A_CNXN = cmd('CNXN');
export const A_OPEN = cmd('OPEN');
export const A_OKAY = cmd('OKAY');
export const A_CLSE = cmd('CLSE');
export const A_WRTE = cmd('WRTE');
export const A_AUTH = cmd('AUTH');

// Auth types
export const AUTH_TOKEN = 1;
export const AUTH_SIGNATURE = 2;
export const AUTH_RSAPUBLICKEY = 3;

/**
 * Calculates the checksum of a payload buffer.
 * ADB checksum is just the sum of all bytes in the payload.
 */
export function calculateChecksum(payload: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    sum += payload[i];
  }
  return sum & 0xFFFFFFFF; // Ensure 32-bit unsigned
}
