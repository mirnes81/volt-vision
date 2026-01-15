import { useState, useEffect, useCallback, useRef } from 'react';
import { Intervention } from '@/types/intervention';
import { getAllInterventions, getMyInterventions } from '@/lib/api';
import { 
  saveInterventionsOffline, 
  getInterventionsOffline, 
  initDB 
} from '@/lib/offlineStorage';

const CACHE_KEY_ALL = 'interventions_cache_all';
const CACHE_KEY_MINE = 'interventions_cache_mine';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STALE_TTL = 15 * 60 * 1000; // 15 minutes - stale but usable

interface CacheData {
  interventions: Intervention[];
  timestamp: number;
}

interface CacheMetadata {
  timestamp: number;
  count: number;
}

// Lightweight in-memory cache for instant access
let memoryCache: { 
  all: { data: Intervention[]; timestamp: number } | null;
  mine: { data: Intervention[]; timestamp: number } | null;
} = { all: null, mine: null };

// Track if IndexedDB is initialized
let dbInitialized = false;

function getCacheKey(showOnlyMine: boolean): string {
  return showOnlyMine ? CACHE_KEY_MINE : CACHE_KEY_ALL;
}

function getMetadataKey(showOnlyMine: boolean): string {
  return `${getCacheKey(showOnlyMine)}_meta`;
}

// Session storage for quick access (metadata only)
function getCacheMetadata(showOnlyMine: boolean): CacheMetadata | null {
  try {
    const key = getMetadataKey(showOnlyMine);
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function setCacheMetadata(showOnlyMine: boolean, count: number): void {
  try {
    const key = getMetadataKey(showOnlyMine);
    const metadata: CacheMetadata = {
      timestamp: Date.now(),
      count,
    };
    sessionStorage.setItem(key, JSON.stringify(metadata));
  } catch {
    // Ignore storage errors
  }
}

// Get cache status
function getCacheStatus(showOnlyMine: boolean): { isFresh: boolean; isStale: boolean; hasData: boolean } {
  const metadata = getCacheMetadata(showOnlyMine);
  if (!metadata) {
    return { isFresh: false, isStale: false, hasData: false };
  }
  
  const age = Date.now() - metadata.timestamp;
  return {
    isFresh: age < CACHE_TTL,
    isStale: age >= CACHE_TTL && age < STALE_TTL,
    hasData: metadata.count > 0,
  };
}

// Legacy session storage (still useful for very fast reads)
function getSessionCache(showOnlyMine: boolean): { data: CacheData | null; isStale: boolean } {
  try {
    const key = getCacheKey(showOnlyMine);
    const cached = sessionStorage.getItem(key);
    if (!cached) return { data: null, isStale: false };
    
    const data: CacheData = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    
    if (age < CACHE_TTL) {
      return { data, isStale: false };
    }
    if (age < STALE_TTL) {
      return { data, isStale: true };
    }
    return { data: null, isStale: false };
  } catch {
    return { data: null, isStale: false };
  }
}

function setSessionCache(interventions: Intervention[], showOnlyMine: boolean): void {
  try {
    const key = getCacheKey(showOnlyMine);
    // Only store if not too large (< 5MB)
    const data: CacheData = {
      interventions,
      timestamp: Date.now(),
    };
    const json = JSON.stringify(data);
    if (json.length < 5 * 1024 * 1024) {
      sessionStorage.setItem(key, json);
    }
    setCacheMetadata(showOnlyMine, interventions.length);
  } catch {
    // Quota exceeded, just update metadata
    setCacheMetadata(showOnlyMine, interventions.length);
  }
}

export function useInterventionsCache(showOnlyMine: boolean = false) {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [cacheSource, setCacheSource] = useState<'memory' | 'session' | 'indexeddb' | 'network' | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isBackgroundRefreshRef = useRef(false);

  const sortInterventions = useCallback((data: Intervention[]): Intervention[] => {
    return [...data].sort((a, b) => 
      new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime()
    );
  }, []);

  // Filter interventions for "mine" view
  const filterForUser = useCallback((data: Intervention[], onlyMine: boolean): Intervention[] => {
    if (!onlyMine) return data;
    
    const worker = JSON.parse(localStorage.getItem('mv3_worker') || '{}');
    if (!worker.id) return data;
    
    return data.filter(int => int.assignedTo?.id === worker.id);
  }, []);

  // Load from IndexedDB (persistent offline storage)
  const loadFromIndexedDB = useCallback(async (): Promise<Intervention[] | null> => {
    try {
      if (!dbInitialized) {
        await initDB();
        dbInitialized = true;
      }
      const data = await getInterventionsOffline();
      if (data.length > 0) {
        console.log(`[Cache] Loaded ${data.length} interventions from IndexedDB`);
        return data;
      }
    } catch (error) {
      console.error('[Cache] IndexedDB read error:', error);
    }
    return null;
  }, []);

  // Save to IndexedDB (background, non-blocking)
  const saveToIndexedDB = useCallback(async (data: Intervention[]): Promise<void> => {
    try {
      if (!dbInitialized) {
        await initDB();
        dbInitialized = true;
      }
      await saveInterventionsOffline(data);
      console.log(`[Cache] Saved ${data.length} interventions to IndexedDB`);
    } catch (error) {
      console.error('[Cache] IndexedDB write error:', error);
    }
  }, []);

  const loadInterventions = useCallback(async (forceRefresh = false) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const cacheKey = showOnlyMine ? 'mine' : 'all';
    
    // 1. Try memory cache first (instant, ~0ms)
    if (!forceRefresh && memoryCache[cacheKey]) {
      const age = Date.now() - memoryCache[cacheKey]!.timestamp;
      if (age < CACHE_TTL) {
        const filtered = filterForUser(memoryCache[cacheKey]!.data, showOnlyMine);
        setInterventions(filtered);
        setIsLoading(false);
        setCacheSource('memory');
        console.log(`[Cache] Memory hit: ${filtered.length} items`);
        return;
      }
    }

    // 2. Try session storage cache (~1-5ms)
    if (!forceRefresh) {
      const { data: sessionData, isStale } = getSessionCache(showOnlyMine);
      if (sessionData) {
        const sorted = sortInterventions(sessionData.interventions);
        const filtered = filterForUser(sorted, showOnlyMine);
        setInterventions(filtered);
        setIsLoading(false);
        setCacheSource('session');
        
        // Update memory cache
        memoryCache[cacheKey] = { data: sorted, timestamp: sessionData.timestamp };
        
        console.log(`[Cache] Session hit: ${filtered.length} items (stale: ${isStale})`);
        
        // If stale, trigger background refresh
        if (isStale && !isBackgroundRefreshRef.current && navigator.onLine) {
          isBackgroundRefreshRef.current = true;
          fetchFreshData(showOnlyMine).finally(() => {
            isBackgroundRefreshRef.current = false;
          });
        }
        return;
      }
    }

    // 3. Try IndexedDB (persistent, ~10-50ms) - especially important when offline
    if (!forceRefresh || !navigator.onLine) {
      const indexedData = await loadFromIndexedDB();
      if (indexedData && indexedData.length > 0) {
        const sorted = sortInterventions(indexedData);
        const filtered = filterForUser(sorted, showOnlyMine);
        setInterventions(filtered);
        setIsLoading(false);
        setCacheSource('indexeddb');
        
        // Update memory cache
        memoryCache[cacheKey] = { data: sorted, timestamp: Date.now() - CACHE_TTL }; // Mark as stale
        
        console.log(`[Cache] IndexedDB hit: ${filtered.length} items`);
        
        // If online and not forcing, do background refresh
        if (!forceRefresh && navigator.onLine && !isBackgroundRefreshRef.current) {
          isBackgroundRefreshRef.current = true;
          fetchFreshData(showOnlyMine).finally(() => {
            isBackgroundRefreshRef.current = false;
          });
        }
        
        // If offline, we're done
        if (!navigator.onLine) {
          return;
        }
      }
    }

    // 4. If offline and no cache, show empty state
    if (!navigator.onLine) {
      setIsLoading(false);
      console.log('[Cache] Offline with no cached data');
      return;
    }

    // 5. Fetch from network
    setIsLoading(true);
    await fetchFreshData(showOnlyMine);
  }, [showOnlyMine, sortInterventions, filterForUser, loadFromIndexedDB]);

  const fetchFreshData = async (onlyMine: boolean) => {
    const cacheKey = onlyMine ? 'mine' : 'all';
    
    try {
      const startTime = performance.now();
      
      // Always fetch all for IndexedDB, filter after
      const data = await getAllInterventions();
      const elapsed = performance.now() - startTime;
      
      console.log(`[Cache] Network fetch: ${data.length} interventions in ${elapsed.toFixed(0)}ms`);
      
      const sorted = sortInterventions(data);
      const filtered = filterForUser(sorted, onlyMine);
      
      setInterventions(filtered);
      setCacheSource('network');
      
      // Update all caches
      setSessionCache(sorted, false); // Always cache "all"
      memoryCache.all = { data: sorted, timestamp: Date.now() };
      
      if (onlyMine) {
        setSessionCache(filtered, true);
        memoryCache.mine = { data: filtered, timestamp: Date.now() };
      }
      
      // Save to IndexedDB in background (non-blocking)
      saveToIndexedDB(sorted);
      
    } catch (error) {
      console.error('[Cache] Network error:', error);
      
      // On network error, try IndexedDB fallback
      const fallbackData = await loadFromIndexedDB();
      if (fallbackData && fallbackData.length > 0) {
        const sorted = sortInterventions(fallbackData);
        const filtered = filterForUser(sorted, onlyMine);
        setInterventions(filtered);
        setCacheSource('indexeddb');
        console.log(`[Cache] Fallback to IndexedDB: ${filtered.length} items`);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const refresh = useCallback(async () => {
    if (!navigator.onLine) {
      console.log('[Cache] Cannot refresh while offline');
      return;
    }
    setIsRefreshing(true);
    await loadInterventions(true);
  }, [loadInterventions]);

  const invalidateCache = useCallback(() => {
    sessionStorage.removeItem(CACHE_KEY_ALL);
    sessionStorage.removeItem(CACHE_KEY_MINE);
    sessionStorage.removeItem(getMetadataKey(false));
    sessionStorage.removeItem(getMetadataKey(true));
    memoryCache = { all: null, mine: null };
  }, []);

  // Prefetch the other list in background
  const prefetchOther = useCallback(() => {
    if (!navigator.onLine) return;
    
    const otherKey = showOnlyMine ? 'all' : 'mine';
    const { data: cached } = getSessionCache(!showOnlyMine);
    
    // Only prefetch if not already cached
    if (!cached && !memoryCache[otherKey]) {
      getAllInterventions().then(data => {
        const sorted = sortInterventions(data);
        setSessionCache(sorted, false);
        memoryCache.all = { data: sorted, timestamp: Date.now() };
        
        if (!showOnlyMine) {
          const filtered = filterForUser(sorted, true);
          setSessionCache(filtered, true);
          memoryCache.mine = { data: filtered, timestamp: Date.now() };
        }
        
        console.log(`[Cache] Prefetched: ${data.length} items`);
      }).catch(() => {
        // Ignore prefetch errors
      });
    }
  }, [showOnlyMine, sortInterventions, filterForUser]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      console.log('[Cache] Back online, refreshing...');
      // Auto-refresh when back online
      if (!isBackgroundRefreshRef.current) {
        isBackgroundRefreshRef.current = true;
        fetchFreshData(showOnlyMine).finally(() => {
          isBackgroundRefreshRef.current = false;
        });
      }
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      console.log('[Cache] Now offline');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showOnlyMine]);

  useEffect(() => {
    loadInterventions();
    
    // Prefetch other list after a short delay
    const prefetchTimer = setTimeout(prefetchOther, 2000);
    
    return () => {
      clearTimeout(prefetchTimer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadInterventions, prefetchOther]);

  return {
    interventions,
    isLoading,
    isRefreshing,
    isOffline,
    cacheSource,
    refresh,
    invalidateCache,
  };
}

// Export cache utilities for use in other components
export function prefetchIntervention(id: number): void {
  console.log(`[Cache] Prefetch requested for intervention ${id}`);
}

export function getCachedInterventionCount(): { all: number; mine: number } {
  return {
    all: memoryCache.all?.data.length || 0,
    mine: memoryCache.mine?.data.length || 0,
  };
}

// Preload IndexedDB on app start
export async function preloadOfflineCache(): Promise<void> {
  try {
    await initDB();
    dbInitialized = true;
    const data = await getInterventionsOffline();
    if (data.length > 0) {
      const sorted = [...data].sort((a, b) => 
        new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime()
      );
      memoryCache.all = { data: sorted, timestamp: Date.now() - CACHE_TTL };
      console.log(`[Cache] Preloaded ${data.length} interventions from IndexedDB`);
    }
  } catch (error) {
    console.error('[Cache] Preload error:', error);
  }
}