import { describe, it, expect } from 'vitest';
import { calculateChecksum, A_SYNC, A_CNXN } from './constants';

describe('ADB Constants', () => {
  it('should verify basic command values', () => {
    // Little-endian check
    // 'SYNC' = S(83) Y(89) N(78) C(67) -> 0x434E5953 = 1129208147
    expect(A_SYNC).toBe(1129208147);
    expect(A_CNXN).toBe(1314410051);
  });

  it('should calculate checksum correctly', () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    expect(calculateChecksum(payload)).toBe(15);
  });
});
