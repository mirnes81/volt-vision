import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAvailableCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Initial fetch
    async function fetchCount() {
      const { count: availableCount, error } = await supabase
        .from('released_interventions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'available');
      
      if (!error && availableCount !== null) {
        setCount(availableCount);
      }
    }
    
    fetchCount();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('available-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'released_interventions',
        },
        () => {
          // Refetch count on any change
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
