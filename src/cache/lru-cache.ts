/**
 * High-performance LRU Cache Implementation
 * Uses doubly-linked list and hashmap for O(1) operations
 */

class Node<T> {
  key: string;
  value: T;
  prev: Node<T> | null = null;
  next: Node<T> | null = null;
  
  constructor(key: string, value: T) {
    this.key = key;
    this.value = value;
  }
}

export class LRUCache<T> {
  private capacity: number;
  private size: number = 0;
  private cache: Map<string, Node<T>> = new Map();
  private head: Node<T> | null = null;
  private tail: Node<T> | null = null;
  
  constructor(capacity: number) {
    this.capacity = capacity;
  }
  
  get(key: string): T | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;
    
    // Move to head (most recently used)
    this.moveToHead(node);
    return node.value;
  }
  
  set(key: string, value: T): void {
    const existingNode = this.cache.get(key);
    
    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      this.moveToHead(existingNode);
    } else {
      // Create new node
      const newNode = new Node(key, value);
      this.cache.set(key, newNode);
      this.addToHead(newNode);
      this.size++;
      
      // Evict if over capacity
      if (this.size > this.capacity) {
        this.removeLeastRecentlyUsed();
      }
    }
  }
  
  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;
    
    this.removeNode(node);
    this.cache.delete(key);
    this.size--;
    return true;
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.size = 0;
  }
  
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
  
  values(): T[] {
    return Array.from(this.cache.values()).map(node => node.value);
  }
  
  entries(): Array<[string, T]> {
    const entries: Array<[string, T]> = [];
    let current = this.head;
    while (current) {
      entries.push([current.key, current.value]);
      current = current.next;
    }
    return entries;
  }
  
  getSize(): number {
    return this.size;
  }
  
  getCapacity(): number {
    return this.capacity;
  }
  
  setCapacity(newCapacity: number): void {
    this.capacity = newCapacity;
    while (this.size > this.capacity) {
      this.removeLeastRecentlyUsed();
    }
  }
  
  // Get items in MRU order
  getMostRecentlyUsed(count?: number): Array<[string, T]> {
    const items: Array<[string, T]> = [];
    let current = this.head;
    let remaining = count || this.size;
    
    while (current && remaining > 0) {
      items.push([current.key, current.value]);
      current = current.next;
      remaining--;
    }
    
    return items;
  }
  
  // Get items in LRU order
  getLeastRecentlyUsed(count?: number): Array<[string, T]> {
    const items: Array<[string, T]> = [];
    let current = this.tail;
    let remaining = count || this.size;
    
    while (current && remaining > 0) {
      items.push([current.key, current.value]);
      current = current.prev;
      remaining--;
    }
    
    return items;
  }
  
  // Private helper methods
  private addToHead(node: Node<T>): void {
    node.prev = null;
    node.next = this.head;
    
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    
    if (!this.tail) {
      this.tail = node;
    }
  }
  
  private removeNode(node: Node<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }
  
  private moveToHead(node: Node<T>): void {
    if (node === this.head) return;
    
    this.removeNode(node);
    this.addToHead(node);
  }
  
  private removeLeastRecentlyUsed(): void {
    if (!this.tail) return;
    
    const lru = this.tail;
    this.removeNode(lru);
    this.cache.delete(lru.key);
    this.size--;
  }
  
  // Statistics
  getStatistics(): {
    size: number;
    capacity: number;
    utilizationRate: number;
    evictionCount?: number;
  } {
    return {
      size: this.size,
      capacity: this.capacity,
      utilizationRate: this.size / this.capacity,
    };
  }
}

// LFU Cache Implementation
export class LFUCache<T> {
  private capacity: number;
  private size: number = 0;
  private minFreq: number = 0;
  private cache: Map<string, { value: T; freq: number }> = new Map();
  private freqMap: Map<number, Set<string>> = new Map();
  
  constructor(capacity: number) {
    this.capacity = capacity;
  }
  
  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    
    this.updateFrequency(key, item);
    return item.value;
  }
  
  set(key: string, value: T): void {
    if (this.capacity === 0) return;
    
    const existing = this.cache.get(key);
    
    if (existing) {
      existing.value = value;
      this.updateFrequency(key, existing);
    } else {
      if (this.size >= this.capacity) {
        this.evictLeastFrequent();
      }
      
      this.cache.set(key, { value, freq: 1 });
      this.addToFreqMap(key, 1);
      this.minFreq = 1;
      this.size++;
    }
  }
  
  private updateFrequency(key: string, item: { value: T; freq: number }): void {
    const oldFreq = item.freq;
    const newFreq = oldFreq + 1;
    
    // Remove from old frequency list
    const oldFreqSet = this.freqMap.get(oldFreq);
    if (oldFreqSet) {
      oldFreqSet.delete(key);
      if (oldFreqSet.size === 0) {
        this.freqMap.delete(oldFreq);
        if (this.minFreq === oldFreq) {
          this.minFreq++;
        }
      }
    }
    
    // Add to new frequency list
    item.freq = newFreq;
    this.addToFreqMap(key, newFreq);
  }
  
  private addToFreqMap(key: string, freq: number): void {
    if (!this.freqMap.has(freq)) {
      this.freqMap.set(freq, new Set());
    }
    this.freqMap.get(freq)!.add(key);
  }
  
  private evictLeastFrequent(): void {
    const minFreqSet = this.freqMap.get(this.minFreq);
    if (!minFreqSet || minFreqSet.size === 0) return;
    
    // Get the first key (oldest) from the set
    const keyToEvict = minFreqSet.values().next().value;
    minFreqSet.delete(keyToEvict);
    
    if (minFreqSet.size === 0) {
      this.freqMap.delete(this.minFreq);
    }
    
    this.cache.delete(keyToEvict);
    this.size--;
  }
  
  delete(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    const freqSet = this.freqMap.get(item.freq);
    if (freqSet) {
      freqSet.delete(key);
      if (freqSet.size === 0) {
        this.freqMap.delete(item.freq);
      }
    }
    
    this.cache.delete(key);
    this.size--;
    return true;
  }
  
  clear(): void {
    this.cache.clear();
    this.freqMap.clear();
    this.size = 0;
    this.minFreq = 0;
  }
  
  getSize(): number {
    return this.size;
  }
}