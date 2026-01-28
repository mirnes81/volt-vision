import * as React from 'react';
import { useInterventionsCache } from '@/hooks/useInterventionsCache';
import { getDateOverride } from '@/components/intervention/DateEditDialog';
import { startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';

export function useTodayInterventionsCount() {
  const { interventions, isLoading } = useInterventionsCache(false);
  
  const todayCount = React.useMemo(() => {
    if (isLoading || !interventions.length) return 0;
    
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    
    return interventions.filter(int => {
      // Prioritize local date override
      const localOverride = getDateOverride(int.id);
      const dateStr = localOverride || int.dateStart;
      
      if (!dateStr) return false;
      
      try {
        const intDate = parseISO(dateStr);
        return isWithinInterval(intDate, { start: todayStart, end: todayEnd });
      } catch {
        return false;
      }
    }).length;
  }, [interventions, isLoading]);
  
  return { todayCount, isLoading };
}
