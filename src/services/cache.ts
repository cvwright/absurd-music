/**
 * Cache Service
 *
 * IndexedDB-based caching layer for decrypted audio files.
 * Provides LRU eviction when cache size limit is reached.
 */

import type { CachedTrack, CachePreferences } from '@/types/index.js';

const DB_NAME = 'music-player-cache';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

const DEFAULT_PREFERENCES: CachePreferences = {
  max_size_bytes: 2 * 1024 * 1024 * 1024, // 2GB
  max_age_days: 30,
  auto_prefetch: true,
  prefetch_count: 3,
};

/**
 * Service for caching decrypted audio files in IndexedDB.
 *
 * Features:
 * - Persistent storage across browser sessions
 * - LRU eviction when size limit reached
 * - Age-based pruning
 */
export class CacheService {
  private db: IDBDatabase | null = null;
  private preferences: CachePreferences;
  private currentSize = 0;

  constructor(preferences?: Partial<CachePreferences>) {
    this.preferences = { ...DEFAULT_PREFERENCES, ...preferences };
  }

  /**
   * Initialize the IndexedDB database.
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open cache database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.calculateCurrentSize().then(resolve).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create tracks store with indices
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'trackId' });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }
      };
    });
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('Cache not initialized. Call init() first.');
    }
    return this.db;
  }

  /**
   * Calculate current cache size.
   */
  private async calculateCurrentSize(): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const request = store.openCursor();

      let totalSize = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          totalSize += (cursor.value as CachedTrack).size;
          cursor.continue();
        } else {
          this.currentSize = totalSize;
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a cached track by ID.
   */
  async getTrack(trackId: string): Promise<CachedTrack | null> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const request = store.get(trackId);

      request.onsuccess = () => {
        const track = request.result as CachedTrack | undefined;
        if (track) {
          // Update last accessed time
          track.lastAccessed = Date.now();
          store.put(track);
          resolve(track);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cache a track.
   */
  async cacheTrack(
    trackId: string,
    audioData: ArrayBuffer,
    metadata: CachedTrack['metadata']
  ): Promise<void> {
    const db = this.ensureDb();
    const size = audioData.byteLength;

    // Check if we need to evict
    if (this.currentSize + size > this.preferences.max_size_bytes) {
      await this.evictLRU(size);
    }

    const track: CachedTrack = {
      trackId,
      audioData,
      metadata,
      cachedAt: Date.now(),
      lastAccessed: Date.now(),
      size,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const request = store.put(track);

      request.onsuccess = () => {
        this.currentSize += size;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove a track from cache.
   */
  async removeTrack(trackId: string): Promise<void> {
    const db = this.ensureDb();

    // Get size first
    const track = await this.getTrack(trackId);
    if (!track) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const request = store.delete(trackId);

      request.onsuccess = () => {
        this.currentSize -= track.size;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if a track is cached.
   */
  async hasTrack(trackId: string): Promise<boolean> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const request = store.count(IDBKeyRange.only(trackId));

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Evict least recently used tracks to free up space.
   */
  private async evictLRU(neededSpace: number): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const index = store.index('lastAccessed');
      const request = index.openCursor();

      let freedSpace = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor && freedSpace < neededSpace) {
          const track = cursor.value as CachedTrack;
          freedSpace += track.size;
          this.currentSize -= track.size;
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Prune old entries based on max age.
   */
  async pruneOld(): Promise<number> {
    const db = this.ensureDb();
    const maxAge = this.preferences.max_age_days * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const index = store.index('cachedAt');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);

      let prunedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          const track = cursor.value as CachedTrack;
          this.currentSize -= track.size;
          cursor.delete();
          prunedCount++;
          cursor.continue();
        } else {
          resolve(prunedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cached tracks.
   */
  async clear(): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const request = store.clear();

      request.onsuccess = () => {
        this.currentSize = 0;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get current cache size in bytes.
   */
  getCurrentSize(): number {
    return this.currentSize;
  }

  /**
   * Get cache preferences.
   */
  getPreferences(): CachePreferences {
    return { ...this.preferences };
  }

  /**
   * Update cache preferences.
   */
  setPreferences(preferences: Partial<CachePreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
  }
}
