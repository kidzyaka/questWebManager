// Helper for converting Uint8Array to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class AdbAuth {
  private privateKey: CryptoKey | null = null;
  private publicKey: CryptoKey | null = null;
  private publicKeyBase64: string = '';

  /**
   * Loads the RSA key from IndexedDB, or generates a new one if it doesn't exist.
   */
  async init(): Promise<void> {
    // In a real robust implementation we would use IndexedDB (e.g. via idb package) to persist.
    // For M1, we'll generate it in memory (meaning we have to accept the prompt on every hard reload).
    // Let's implement in-memory first, and we can add IndexedDB later if needed.
    await this.generateKeys();
  }

  private async generateKeys(): Promise<void> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
        hash: 'SHA-1', // ADB uses SHA-1 for signatures by default
      },
      true, // extractable
      ['sign', 'verify']
    );

    this.privateKey = keyPair.privateKey;
    this.publicKey = keyPair.publicKey;

    // Export public key to SPKI format
    const spki = await crypto.subtle.exportKey('spki', this.publicKey);
    this.publicKeyBase64 = arrayBufferToBase64(spki);
  }

  /**
   * Signs the 20-byte token sent by adbd.
   */
  async sign(token: Uint8Array): Promise<Uint8Array> {
    if (!this.privateKey) throw new Error('Auth not initialized');
    
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      this.privateKey,
      token as any
    );
    
    return new Uint8Array(signature);
  }

  /**
   * Returns the public key payload required by adbd (base64 + user@host + \0).
   */
  getPublicKeyPayload(): Uint8Array {
    if (!this.publicKeyBase64) throw new Error('Auth not initialized');
    const payloadStr = this.publicKeyBase64 + ' quest-web-manager@browser\0';
    return new TextEncoder().encode(payloadStr);
  }
}
