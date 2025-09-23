/**
 * Simple encryption service for message content
 * In production, you'd want to use more robust encryption like AES-256
 * and properly manage encryption keys
 */

const ENCRYPTION_KEY = "pitchey-message-encryption-key-2024"; // In production, use env variable

export class EncryptionService {
  /**
   * Simple XOR encryption (for demo purposes)
   * In production, use proper encryption like Web Crypto API AES-GCM
   */
  static encrypt(text: string, key?: string): string {
    const encryptionKey = key || ENCRYPTION_KEY;
    let result = '';
    
    for (let i = 0; i < text.length; i++) {
      const textChar = text.charCodeAt(i);
      const keyChar = encryptionKey.charCodeAt(i % encryptionKey.length);
      result += String.fromCharCode(textChar ^ keyChar);
    }
    
    // Base64 encode the result
    return btoa(result);
  }

  /**
   * Simple XOR decryption
   */
  static decrypt(encryptedText: string, key?: string): string {
    try {
      const encryptionKey = key || ENCRYPTION_KEY;
      // Base64 decode first
      const decodedText = atob(encryptedText);
      let result = '';
      
      for (let i = 0; i < decodedText.length; i++) {
        const textChar = decodedText.charCodeAt(i);
        const keyChar = encryptionKey.charCodeAt(i % encryptionKey.length);
        result += String.fromCharCode(textChar ^ keyChar);
      }
      
      return result;
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Encrypted message - decryption failed]';
    }
  }

  /**
   * Generate a random encryption key for a conversation
   */
  static generateConversationKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Advanced encryption using Web Crypto API (for production)
   */
  static async encryptAdvanced(text: string, key?: CryptoKey): Promise<{
    encrypted: string;
    iv: string;
    key?: string;
  }> {
    try {
      // Generate or use provided key
      const cryptoKey = key || await crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: 256,
        },
        true,
        ["encrypt", "decrypt"]
      );

      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the text
      const encodedText = new TextEncoder().encode(text);
      const encrypted = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        cryptoKey,
        encodedText
      );

      // Export key if it was generated
      let exportedKey: string | undefined;
      if (!key) {
        const exported = await crypto.subtle.exportKey("jwk", cryptoKey);
        exportedKey = JSON.stringify(exported);
      }

      return {
        encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: btoa(String.fromCharCode(...iv)),
        key: exportedKey,
      };
    } catch (error) {
      console.error('Advanced encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Advanced decryption using Web Crypto API
   */
  static async decryptAdvanced(
    encryptedData: string,
    iv: string,
    keyData: string
  ): Promise<string> {
    try {
      // Import the key
      const keyObject = JSON.parse(keyData);
      const cryptoKey = await crypto.subtle.importKey(
        "jwk",
        keyObject,
        {
          name: "AES-GCM",
          length: 256,
        },
        false,
        ["decrypt"]
      );

      // Decode the encrypted data and IV
      const encrypted = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: ivBytes,
        },
        cryptoKey,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Advanced decryption failed:', error);
      return '[Encrypted message - decryption failed]';
    }
  }

  /**
   * Check if a message appears to be encrypted
   */
  static isEncrypted(content: string): boolean {
    // Simple heuristic: encrypted content is base64 and doesn't contain common words
    try {
      const decoded = atob(content);
      // If it successfully decodes and doesn't look like normal text, it's probably encrypted
      return !content.includes(' ') && content.length > 20 && 
             !/[a-zA-Z]{3,}/.test(decoded);
    } catch {
      return false;
    }
  }

  /**
   * Sanitize message content for display
   */
  static sanitizeMessage(content: string): string {
    // Basic HTML sanitization
    return content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Encrypt file content for secure file sharing
   */
  static async encryptFile(fileData: ArrayBuffer, key?: string): Promise<{
    encrypted: ArrayBuffer;
    key: string;
    iv: string;
  }> {
    try {
      // Generate or use provided key
      const encryptionKey = key || this.generateConversationKey();
      
      // For demo, we'll use simple XOR encryption
      // In production, use proper file encryption
      const data = new Uint8Array(fileData);
      const encrypted = new Uint8Array(data.length);
      
      for (let i = 0; i < data.length; i++) {
        encrypted[i] = data[i] ^ encryptionKey.charCodeAt(i % encryptionKey.length);
      }

      return {
        encrypted: encrypted.buffer,
        key: encryptionKey,
        iv: 'demo-iv', // In production, generate proper IV
      };
    } catch (error) {
      console.error('File encryption failed:', error);
      throw new Error('File encryption failed');
    }
  }

  /**
   * Decrypt file content
   */
  static async decryptFile(
    encryptedData: ArrayBuffer,
    key: string,
    iv: string
  ): Promise<ArrayBuffer> {
    try {
      // For demo, reverse the XOR encryption
      const data = new Uint8Array(encryptedData);
      const decrypted = new Uint8Array(data.length);
      
      for (let i = 0; i < data.length; i++) {
        decrypted[i] = data[i] ^ key.charCodeAt(i % key.length);
      }

      return decrypted.buffer;
    } catch (error) {
      console.error('File decryption failed:', error);
      throw new Error('File decryption failed');
    }
  }
}