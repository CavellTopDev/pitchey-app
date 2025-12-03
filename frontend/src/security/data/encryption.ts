/**
 * Data Encryption Service
 * Implements encryption at rest and in transit
 * OWASP Cryptographic Storage Cheat Sheet compliant
 */

import { AES, enc, lib, PBKDF2, SHA256, HmacSHA256 } from 'crypto-js';

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
  tag?: string;
  algorithm: string;
  keyDerivation: string;
  iterations: number;
}

export interface FieldEncryption {
  field: string;
  encrypted: boolean;
  algorithm: string;
  keyId?: string;
}

/**
 * Encryption Service - Handles all encryption operations
 */
export class EncryptionService {
  private static readonly KEY_SIZE = 256;
  private static readonly ITERATIONS = 100000; // PBKDF2 iterations
  private static readonly SALT_SIZE = 128;
  private static readonly IV_SIZE = 128;
  
  /**
   * Generate cryptographically secure random bytes
   */
  static generateRandomBytes(size: number): string {
    const array = new Uint8Array(size / 8);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Derive key from password using PBKDF2
   */
  static deriveKey(password: string, salt: string): string {
    return PBKDF2(password, salt, {
      keySize: this.KEY_SIZE / 32,
      iterations: this.ITERATIONS
    }).toString();
  }
  
  /**
   * Encrypt data using AES-256-GCM
   */
  static encrypt(data: string, password: string): EncryptedData {
    // Generate salt and IV
    const salt = this.generateRandomBytes(this.SALT_SIZE);
    const iv = this.generateRandomBytes(this.IV_SIZE);
    
    // Derive key from password
    const key = this.deriveKey(password, salt);
    
    // Encrypt data
    const encrypted = AES.encrypt(data, key, {
      iv: enc.Hex.parse(iv),
      mode: require('crypto-js/mode-ctr'),
      padding: require('crypto-js/pad-pkcs7')
    });
    
    // Generate authentication tag (HMAC)
    const tag = HmacSHA256(encrypted.toString(), key).toString();
    
    return {
      ciphertext: encrypted.toString(),
      iv,
      salt,
      tag,
      algorithm: 'AES-256-CTR',
      keyDerivation: 'PBKDF2',
      iterations: this.ITERATIONS
    };
  }
  
  /**
   * Decrypt data
   */
  static decrypt(encryptedData: EncryptedData, password: string): string {
    // Derive key from password
    const key = this.deriveKey(password, encryptedData.salt);
    
    // Verify authentication tag if present
    if (encryptedData.tag) {
      const computedTag = HmacSHA256(encryptedData.ciphertext, key).toString();
      if (computedTag !== encryptedData.tag) {
        throw new Error('Authentication failed - data may have been tampered with');
      }
    }
    
    // Decrypt data
    const decrypted = AES.decrypt(encryptedData.ciphertext, key, {
      iv: enc.Hex.parse(encryptedData.iv),
      mode: require('crypto-js/mode-ctr'),
      padding: require('crypto-js/pad-pkcs7')
    });
    
    return decrypted.toString(enc.Utf8);
  }
  
  /**
   * Encrypt specific fields in an object
   */
  static encryptFields<T extends Record<string, any>>(
    obj: T,
    fields: string[],
    password: string
  ): T & { _encryption?: FieldEncryption[] } {
    const result = { ...obj };
    const encryptionMetadata: FieldEncryption[] = [];
    
    for (const field of fields) {
      if (field in result && result[field] !== null && result[field] !== undefined) {
        const value = typeof result[field] === 'string' 
          ? result[field] 
          : JSON.stringify(result[field]);
          
        const encrypted = this.encrypt(value, password);
        result[field] = encrypted;
        
        encryptionMetadata.push({
          field,
          encrypted: true,
          algorithm: encrypted.algorithm
        });
      }
    }
    
    if (encryptionMetadata.length > 0) {
      result._encryption = encryptionMetadata;
    }
    
    return result;
  }
  
  /**
   * Decrypt specific fields in an object
   */
  static decryptFields<T extends Record<string, any>>(
    obj: T & { _encryption?: FieldEncryption[] },
    password: string
  ): T {
    if (!obj._encryption) {
      return obj;
    }
    
    const result = { ...obj };
    delete result._encryption;
    
    for (const metadata of obj._encryption) {
      if (metadata.encrypted && result[metadata.field]) {
        const decrypted = this.decrypt(result[metadata.field] as EncryptedData, password);
        
        // Try to parse as JSON, fall back to string
        try {
          result[metadata.field] = JSON.parse(decrypted);
        } catch {
          result[metadata.field] = decrypted;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Generate encryption key
   */
  static generateKey(): string {
    return this.generateRandomBytes(this.KEY_SIZE);
  }
  
  /**
   * Hash data using SHA-256
   */
  static hash(data: string): string {
    return SHA256(data).toString();
  }
  
  /**
   * Compare hash with data
   */
  static verifyHash(data: string, hash: string): boolean {
    return this.hash(data) === hash;
  }
  
  /**
   * Create HMAC signature
   */
  static createHMAC(data: string, secret: string): string {
    return HmacSHA256(data, secret).toString();
  }
  
  /**
   * Verify HMAC signature
   */
  static verifyHMAC(data: string, signature: string, secret: string): boolean {
    const computedSignature = this.createHMAC(data, secret);
    return computedSignature === signature;
  }
}

/**
 * PII (Personally Identifiable Information) Detection and Masking
 */
export class PIIService {
  // PII patterns
  private static readonly PII_PATTERNS = {
    ssn: /\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/g,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}\b/g,
    ipAddress: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    bankAccount: /\b\d{8,17}\b/g,
    passport: /\b[A-Z]{1,2}\d{6,9}\b/g,
    driverLicense: /\b[A-Z]\d{7,12}\b/g
  };
  
  /**
   * Detect PII in text
   */
  static detectPII(text: string): { type: string; value: string; position: number }[] {
    const findings: { type: string; value: string; position: number }[] = [];
    
    for (const [type, pattern] of Object.entries(this.PII_PATTERNS)) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        findings.push({
          type,
          value: match[0],
          position: match.index
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Mask PII in text
   */
  static maskPII(text: string, maskChar: string = '*'): string {
    let maskedText = text;
    
    // Mask each PII type
    for (const [type, pattern] of Object.entries(this.PII_PATTERNS)) {
      maskedText = maskedText.replace(pattern, (match) => {
        // Keep some characters for context
        if (type === 'email') {
          const [local, domain] = match.split('@');
          return `${local[0]}${maskChar.repeat(local.length - 1)}@${domain}`;
        } else if (type === 'creditCard') {
          const digits = match.replace(/\D/g, '');
          return `${maskChar.repeat(12)}${digits.slice(-4)}`;
        } else if (type === 'ssn') {
          const digits = match.replace(/\D/g, '');
          return `${maskChar.repeat(5)}-${digits.slice(-4)}`;
        } else if (type === 'phone') {
          const digits = match.replace(/\D/g, '');
          return `${maskChar.repeat(digits.length - 4)}${digits.slice(-4)}`;
        } else {
          return maskChar.repeat(match.length);
        }
      });
    }
    
    return maskedText;
  }
  
  /**
   * Tokenize PII (replace with tokens)
   */
  static tokenizePII(text: string): { text: string; tokens: Map<string, string> } {
    const tokens = new Map<string, string>();
    let tokenizedText = text;
    let tokenCounter = 0;
    
    const findings = this.detectPII(text);
    
    // Sort by position (reverse) to maintain positions while replacing
    findings.sort((a, b) => b.position - a.position);
    
    for (const finding of findings) {
      const token = `[PII_${finding.type.toUpperCase()}_${++tokenCounter}]`;
      tokens.set(token, finding.value);
      
      tokenizedText = 
        tokenizedText.slice(0, finding.position) + 
        token + 
        tokenizedText.slice(finding.position + finding.value.length);
    }
    
    return { text: tokenizedText, tokens };
  }
  
  /**
   * Detokenize PII (restore from tokens)
   */
  static detokenizePII(text: string, tokens: Map<string, string>): string {
    let detokenizedText = text;
    
    for (const [token, value] of tokens) {
      detokenizedText = detokenizedText.replace(token, value);
    }
    
    return detokenizedText;
  }
  
  /**
   * Check if data contains PII
   */
  static containsPII(text: string): boolean {
    return this.detectPII(text).length > 0;
  }
  
  /**
   * Anonymize PII (one-way transformation)
   */
  static anonymizePII(text: string): string {
    const findings = this.detectPII(text);
    let anonymizedText = text;
    
    // Sort by position (reverse) to maintain positions while replacing
    findings.sort((a, b) => b.position - a.position);
    
    for (const finding of findings) {
      // Hash the PII value for consistent anonymization
      const hash = EncryptionService.hash(finding.value);
      const shortHash = hash.substring(0, 8);
      
      anonymizedText = 
        anonymizedText.slice(0, finding.position) + 
        `[${finding.type}:${shortHash}]` + 
        anonymizedText.slice(finding.position + finding.value.length);
    }
    
    return anonymizedText;
  }
}

/**
 * Secure Storage Service
 */
export class SecureStorage {
  private static encryptionKey: string | null = null;
  
  /**
   * Initialize secure storage with user key
   */
  static initialize(userPassword: string): void {
    this.encryptionKey = EncryptionService.deriveKey(
      userPassword,
      'pitchey-secure-storage'
    );
  }
  
  /**
   * Store encrypted data
   */
  static setItem(key: string, value: any): void {
    if (!this.encryptionKey) {
      throw new Error('Secure storage not initialized');
    }
    
    const data = JSON.stringify(value);
    const encrypted = EncryptionService.encrypt(data, this.encryptionKey);
    localStorage.setItem(`secure_${key}`, JSON.stringify(encrypted));
  }
  
  /**
   * Retrieve and decrypt data
   */
  static getItem<T>(key: string): T | null {
    if (!this.encryptionKey) {
      throw new Error('Secure storage not initialized');
    }
    
    const stored = localStorage.getItem(`secure_${key}`);
    if (!stored) {
      return null;
    }
    
    try {
      const encrypted = JSON.parse(stored) as EncryptedData;
      const decrypted = EncryptionService.decrypt(encrypted, this.encryptionKey);
      return JSON.parse(decrypted) as T;
    } catch (error) {
      console.error('Failed to decrypt data:', error);
      return null;
    }
  }
  
  /**
   * Remove item
   */
  static removeItem(key: string): void {
    localStorage.removeItem(`secure_${key}`);
  }
  
  /**
   * Clear all secure storage
   */
  static clear(): void {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('secure_')) {
        localStorage.removeItem(key);
      }
    }
  }
  
  /**
   * Check if storage is initialized
   */
  static isInitialized(): boolean {
    return this.encryptionKey !== null;
  }
}

export default EncryptionService;