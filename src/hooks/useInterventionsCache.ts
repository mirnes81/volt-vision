import { useState, useEffect, useCallback, useRef } from 'react';
import { Intervention } from '@/types/intervention';
import { getAllInterventions, getMyInterventions } from '@/lib/api';

const CACHE_KEY_ALL = 'interventions_cache_all';
const CACHE_KEY_MINE = 'interventions_cache_mine';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (increased from 3)
const STALE_TTL = 15 * 60 * 1000; // 15 minutes - stale but usable

interface CacheData {
  interventions: Intervention[];
  timestamp: number;
}

// Use both sessionStorage (fast) and IndexedDB (persistent)
function getCacheKey(showOnlyMine: boolean): string {
  return showOnlyMine ? CACHE_KEY_MINE : CACHE_KEY_ALL;
}

function getCache(showOnlyMine: boolean): { data: CacheData | null; isStale: boolean } {
  try {
    const key = getCacheKey(showOnlyMine);
    const cached = sessionStorage.getItem(key);
    if (!cached) return { data: null, isStale: false };
    
    const data: CacheData = JSON.parse(cached);
    const now = Date.now();
    const age = now - data.timestamp;
    
    // Fresh cache
    if (age < CACHE_TTL) {
      return { data, isStale: false };
    }
    
    // Stale but usable (show immediately, refresh in background)
    if (age < STALE_TTL) {
      return { data, isStale: true };
    }
    
    // Too old, discard
    return { data: null, isStale: false };
  } catch {
    return { data: null, isStale: false };
  }
}

function setCache(interventions: Intervention[], showOnlyMine: boolean): void {
  try {
    const key = getCacheKey(showOnlyMine);
    const data: CacheData = {
      interventions,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

// Lightweight in-memory cache for instant access
let memoryCache: { 
  all: { data: Intervention[]; timestamp: number } | null;
  mine: { data: Intervention[]; timestamp: number } | null;
} = { all: null, mine: null };

export function useInterventionsCache(showOnlyMine: boolean = false) {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isBackgroundRefreshRef = useRef(false);

  const sortInterventions = useCallback((data: Intervention[]): Intervention[] => {
    return [...data].sort((a, b) => 
      new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime()
    );
  }, []);

  const loadInterventions = useCallback(async (forceRefresh = false) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const cacheKey = showOnlyMine ? 'mine' : 'all';

    // 1. Try memory cache first (instant)
    if (!forceRefresh && memoryCache[cacheKey]) {
      const age = Date.now() - memoryCache[cacheKey]!.timestamp;
      if (age < CACHE_TTL) {
        setInterventions(memoryCache[cacheKey]!.data);
        setIsLoading(false);
        return;
      }
    }

    // 2. Try sessionStorage cache
    if (!forceRefresh) {
      const { data: cached, isStale } = getCache(showOnlyMine);
      if (cached) {
        const sorted = sortInterventions(cached.interventions);
        setInterventions(sorted);
        setIsLoading(false);
        
        // Update memory cache
        memoryCache[cacheKey] = { data: sorted, timestamp: cached.timestamp };
        
        // If stale, trigger background refresh
        if (isStale && !isBackgroundRefreshRef.current) {
          isBackgroundRefreshRef.current = true;
          fetchFreshData(showOnlyMine).finally(() => {
            isBackgroundRefreshRef.current = false;
          });
        }
        return;
      }
    }

    // 3. No cache, fetch fresh
    setIsLoading(true);
    await fetchFreshData(showOnlyMine);
  }, [showOnlyMine, sortInterventions]);

  const fetchFreshData = async (onlyMine: boolean) => {
    const cacheKey = onlyMine ? 'mine' : 'all';
    
    try {
      const startTime = performance.now();
      const data = onlyMine ? await getMyInterventions() : await getAllInterventions();
      const elapsed = performance.now() - startTime;
      
      console.log(`[Cache] Fetched ${data.length} interventions in ${elapsed.toFixed(0)}ms`);
      
      const sorted = sortInterventions(data);
      
      setInterventions(sorted);
      setCache(sorted, onlyMine);
      
      // Update memory cache
      memoryCache[cacheKey] = { data: sorted, timestamp: Date.now() };
    } catch (error) {
      console.error('Error loading interventions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadInterventions(true);
  }, [loadInterventions]);

  const invalidateCache = useCallback(() => {
    sessionStorage.removeItem(CACHE_KEY_ALL);
    sessionStorage.removeItem(CACHE_KEY_MINE);
    memoryCache = { all: null, mine: null };
  }, []);

  // Prefetch the other list in background
  const prefetchOther = useCallback(() => {
    const otherKey = showOnlyMine ? 'all' : 'mine';
    const { data: cached } = getCache(!showOnlyMine);
    
    // Only prefetch if not already cached
    if (!cached && !memoryCache[otherKey]) {
      const otherFetch = showOnlyMine ? getAllInterventions : getMyInterventions;
      otherFetch().then(data => {
        const sorted = sortInterventions(data);
        setCache(sorted, !showOnlyMine);
        memoryCache[otherKey] = { data: sorted, timestamp: Date.now() };
        console.log(`[Cache] Prefetched ${otherKey} list: ${data.length} items`);
      }).catch(() => {
        // Ignore prefetch errors
      });
    }
  }, [showOnlyMine, sortInterventions]);

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
    refresh,
    invalidateCache,
  };
}

// Export cache utilities for use in other components
export function prefetchIntervention(id: number): void {
  // This could be enhanced to prefetch individual intervention details
  console.log(`[Cache] Prefetch requested for intervention ${id}`);
}

export function getCachedInterventionCount(): { all: number; mine: number } {
  return {
    all: memoryCache.all?.data.length || 0,
    mine: memoryCache.mine?.data.length || 0,
  };
}