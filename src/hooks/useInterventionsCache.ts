import { useState, useEffect, useCallback, useRef } from 'react';
import { Intervention } from '@/types/intervention';
import { getAllInterventions, getMyInterventions } from '@/lib/api';

const CACHE_KEY = 'interventions_cache';
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

interface CacheData {
  interventions: Intervention[];
  timestamp: number;
  showOnlyMine: boolean;
}

function getCache(showOnlyMine: boolean): CacheData | null {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data: CacheData = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid and matches filter
    if (now - data.timestamp < CACHE_TTL && data.showOnlyMine === showOnlyMine) {
      return data;
    }
    
    return null;
  } catch {
    return null;
  }
}

function setCache(interventions: Intervention[], showOnlyMine: boolean): void {
  try {
    const data: CacheData = {
      interventions,
      timestamp: Date.now(),
      showOnlyMine,
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export function useInterventionsCache(showOnlyMine: boolean = false) {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadInterventions = useCallback(async (forceRefresh = false) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getCache(showOnlyMine);
      if (cached) {
        setInterventions(cached.interventions);
        setIsLoading(false);
        return;
      }
    }

    try {
      if (!forceRefresh) {
        setIsLoading(true);
      }
      
      const data = showOnlyMine ? await getMyInterventions() : await getAllInterventions();
      
      // Sort by date
      const sorted = data.sort((a, b) => 
        new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime()
      );
      
      setInterventions(sorted);
      setCache(sorted, showOnlyMine);
    } catch (error) {
      console.error('Error loading interventions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showOnlyMine]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadInterventions(true);
  }, [loadInterventions]);

  const invalidateCache = useCallback(() => {
    sessionStorage.removeItem(CACHE_KEY);
  }, []);

  useEffect(() => {
    loadInterventions();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadInterventions]);

  return {
    interventions,
    isLoading,
    isRefreshing,
    refresh,
    invalidateCache,
  };
}
