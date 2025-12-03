/**
 * Bloom Filter Implementation
 * Probabilistic data structure for cache existence checks
 */

export class BloomFilter {
  private bitArray: Uint8Array;
  private size: number;
  private hashCount: number;
  private itemCount: number = 0;
  private rebuildRequired: boolean = false;
  
  constructor(expectedItems: number, falsePositiveRate: number = 0.01) {
    // Calculate optimal size and hash count
    this.size = this.calculateOptimalSize(expectedItems, falsePositiveRate);
    this.hashCount = this.calculateOptimalHashCount(this.size, expectedItems);
    this.bitArray = new Uint8Array(Math.ceil(this.size / 8));
  }
  
  // Add item to filter
  add(item: string): void {
    const hashes = this.getHashes(item);
    for (const hash of hashes) {
      this.setBit(hash % this.size);
    }
    this.itemCount++;
  }
  
  // Check if item might exist (may have false positives, never false negatives)
  mightExist(item: string): boolean {
    const hashes = this.getHashes(item);
    for (const hash of hashes) {
      if (!this.getBit(hash % this.size)) {
        return false;
      }
    }
    return true;
  }
  
  // Clear the filter
  clear(): void {
    this.bitArray.fill(0);
    this.itemCount = 0;
    this.rebuildRequired = false;
  }
  
  // Mark for rebuild (when items are deleted from cache)
  markForRebuild(): void {
    this.rebuildRequired = true;
  }
  
  needsRebuild(): boolean {
    return this.rebuildRequired;
  }
  
  // Get current false positive rate
  getFalsePositiveRate(): number {
    const bitsSet = this.countSetBits();
    const p = bitsSet / this.size;
    return Math.pow(p, this.hashCount);
  }
  
  getSize(): number {
    return this.size;
  }
  
  getItemCount(): number {
    return this.itemCount;
  }
  
  // Estimate memory usage in bytes
  getMemoryUsage(): number {
    return this.bitArray.length;
  }
  
  // Export filter state for persistence
  export(): {
    bitArray: string;
    size: number;
    hashCount: number;
    itemCount: number;
  } {
    return {
      bitArray: this.arrayToBase64(this.bitArray),
      size: this.size,
      hashCount: this.hashCount,
      itemCount: this.itemCount,
    };
  }
  
  // Import filter state
  static import(data: {
    bitArray: string;
    size: number;
    hashCount: number;
    itemCount: number;
  }): BloomFilter {
    const filter = Object.create(BloomFilter.prototype);
    filter.size = data.size;
    filter.hashCount = data.hashCount;
    filter.itemCount = data.itemCount;
    filter.bitArray = filter.base64ToArray(data.bitArray);
    filter.rebuildRequired = false;
    return filter;
  }
  
  // Private helper methods
  private setBit(position: number): void {
    const byteIndex = Math.floor(position / 8);
    const bitIndex = position % 8;
    this.bitArray[byteIndex] |= (1 << bitIndex);
  }
  
  private getBit(position: number): boolean {
    const byteIndex = Math.floor(position / 8);
    const bitIndex = position % 8;
    return (this.bitArray[byteIndex] & (1 << bitIndex)) !== 0;
  }
  
  private countSetBits(): number {
    let count = 0;
    for (let i = 0; i < this.bitArray.length; i++) {
      let byte = this.bitArray[i];
      while (byte) {
        count += byte & 1;
        byte >>= 1;
      }
    }
    return count;
  }
  
  // Generate multiple hash values using double hashing
  private getHashes(item: string): number[] {
    const hashes: number[] = [];
    const hash1 = this.murmurHash3(item, 0);
    const hash2 = this.murmurHash3(item, hash1);
    
    for (let i = 0; i < this.hashCount; i++) {
      hashes.push(Math.abs((hash1 + i * hash2) % this.size));
    }
    
    return hashes;
  }
  
  // MurmurHash3 implementation (32-bit)
  private murmurHash3(key: string, seed: number = 0): number {
    const c1 = 0xcc9e2d51;
    const c2 = 0x1b873593;
    const r1 = 15;
    const r2 = 13;
    const m = 5;
    const n = 0xe6546b64;
    
    let hash = seed;
    const length = key.length;
    const nblocks = Math.floor(length / 4);
    
    for (let i = 0; i < nblocks; i++) {
      let k = 
        (key.charCodeAt(i * 4) & 0xff) |
        ((key.charCodeAt(i * 4 + 1) & 0xff) << 8) |
        ((key.charCodeAt(i * 4 + 2) & 0xff) << 16) |
        ((key.charCodeAt(i * 4 + 3) & 0xff) << 24);
        
      k = this.imul(k, c1);
      k = (k << r1) | (k >>> (32 - r1));
      k = this.imul(k, c2);
      
      hash ^= k;
      hash = (hash << r2) | (hash >>> (32 - r2));
      hash = this.imul(hash, m) + n;
    }
    
    let tail = 0;
    const tailStart = nblocks * 4;
    const tailLength = length - tailStart;
    
    if (tailLength >= 3) tail ^= (key.charCodeAt(tailStart + 2) & 0xff) << 16;
    if (tailLength >= 2) tail ^= (key.charCodeAt(tailStart + 1) & 0xff) << 8;
    if (tailLength >= 1) tail ^= (key.charCodeAt(tailStart) & 0xff);
    
    if (tailLength > 0) {
      tail = this.imul(tail, c1);
      tail = (tail << r1) | (tail >>> (32 - r1));
      tail = this.imul(tail, c2);
      hash ^= tail;
    }
    
    hash ^= length;
    hash ^= hash >>> 16;
    hash = this.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = this.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
    
    return hash >>> 0;
  }
  
  // 32-bit integer multiplication
  private imul(a: number, b: number): number {
    const ah = (a >>> 16) & 0xffff;
    const al = a & 0xffff;
    const bh = (b >>> 16) & 0xffff;
    const bl = b & 0xffff;
    return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
  }
  
  // Calculate optimal bit array size
  private calculateOptimalSize(n: number, p: number): number {
    return Math.ceil((-n * Math.log(p)) / (Math.log(2) * Math.log(2)));
  }
  
  // Calculate optimal number of hash functions
  private calculateOptimalHashCount(m: number, n: number): number {
    return Math.max(1, Math.round((m / n) * Math.log(2)));
  }
  
  // Base64 encoding/decoding helpers
  private arrayToBase64(array: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < array.length; i++) {
      binary += String.fromCharCode(array[i]);
    }
    return btoa(binary);
  }
  
  private base64ToArray(base64: string): Uint8Array {
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return array;
  }
}

// Counting Bloom Filter for deletions
export class CountingBloomFilter {
  private counters: Uint16Array;
  private size: number;
  private hashCount: number;
  
  constructor(expectedItems: number, falsePositiveRate: number = 0.01) {
    this.size = this.calculateOptimalSize(expectedItems, falsePositiveRate);
    this.hashCount = this.calculateOptimalHashCount(this.size, expectedItems);
    this.counters = new Uint16Array(this.size);
  }
  
  add(item: string): void {
    const hashes = this.getHashes(item);
    for (const hash of hashes) {
      const index = hash % this.size;
      if (this.counters[index] < 65535) {
        this.counters[index]++;
      }
    }
  }
  
  remove(item: string): void {
    const hashes = this.getHashes(item);
    for (const hash of hashes) {
      const index = hash % this.size;
      if (this.counters[index] > 0) {
        this.counters[index]--;
      }
    }
  }
  
  mightExist(item: string): boolean {
    const hashes = this.getHashes(item);
    for (const hash of hashes) {
      if (this.counters[hash % this.size] === 0) {
        return false;
      }
    }
    return true;
  }
  
  clear(): void {
    this.counters.fill(0);
  }
  
  private getHashes(item: string): number[] {
    // Implementation similar to BloomFilter.getHashes
    const hashes: number[] = [];
    const hash1 = this.hash(item, 0);
    const hash2 = this.hash(item, hash1);
    
    for (let i = 0; i < this.hashCount; i++) {
      hashes.push(Math.abs((hash1 + i * hash2) % this.size));
    }
    
    return hashes;
  }
  
  private hash(key: string, seed: number): number {
    // Simple hash function for demonstration
    let hash = seed;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  private calculateOptimalSize(n: number, p: number): number {
    return Math.ceil((-n * Math.log(p)) / (Math.log(2) * Math.log(2)));
  }
  
  private calculateOptimalHashCount(m: number, n: number): number {
    return Math.max(1, Math.round((m / n) * Math.log(2)));
  }
}