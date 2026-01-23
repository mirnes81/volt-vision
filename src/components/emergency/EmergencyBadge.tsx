import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useEmergencyInterventions } from '@/hooks/useEmergencyInterventions';
import { cn } from '@/lib/utils';

interface EmergencyBadgeProps {
  className?: string;
}

export function EmergencyBadge({ className }: EmergencyBadgeProps) {
  const { openCount } = useEmergencyInterventions();

  if (openCount === 0) return null;

  return (
    <Badge 
      variant="destructive" 
      className={cn(
        "animate-pulse gap-1 bg-red-500 hover:bg-red-600",
        className
      )}
    >
      <Zap className="h-3 w-3" />
      {openCount}
    </Badge>
  );
}
