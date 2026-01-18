import * as React from 'react';
import { Check, Circle } from 'lucide-react';
import { Intervention, Task } from '@/types/intervention';
import { updateTaskStatus } from '@/lib/api';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

interface TasksSectionProps {
  intervention: Intervention;
  onUpdate: () => void;
}

export function TasksSection({ intervention, onUpdate }: TasksSectionProps) {
  const [loadingTask, setLoadingTask] = React.useState<number | null>(null);

  const handleToggle = async (task: Task) => {
    setLoadingTask(task.id);
    try {
      const newStatus = task.status === 'fait' ? 'a_faire' : 'fait';
      await updateTaskStatus(intervention.id, task.id, newStatus);
      toast.success(newStatus === 'fait' ? 'Tâche terminée' : 'Tâche réouverte');
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoadingTask(null);
    }
  };

  const completedCount = intervention.tasks.filter(t => t.status === 'fait').length;
  const totalCount = intervention.tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Progression</span>
          <span className="text-sm font-bold text-primary">
            {completedCount}/{totalCount} tâches
          </span>
        </div>
        <div className="h-3 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        {intervention.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune tâche définie
          </p>
        ) : (
          intervention.tasks
            .sort((a, b) => a.order - b.order)
            .map((task) => (
              <button
                key={task.id}
                onClick={() => handleToggle(task)}
                disabled={loadingTask === task.id}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 text-left btn-press",
                  task.status === 'fait' 
                    ? "bg-success/10 border border-success/30" 
                    : "bg-card border border-border/50 hover:border-primary/30"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200",
                  task.status === 'fait' 
                    ? "bg-success text-success-foreground" 
                    : "bg-secondary text-muted-foreground"
                )}>
                  {task.status === 'fait' ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium transition-all duration-200",
                    task.status === 'fait' && "line-through text-muted-foreground"
                  )}>
                    {task.label}
                  </p>
                  {task.dateDone && (
                    <p className="text-xs text-muted-foreground">
                      Fait le {new Date(task.dateDone).toLocaleDateString('fr-CH')}
                    </p>
                  )}
                </div>

                <span className={cn(
                  "text-sm font-semibold px-2.5 py-1 rounded-full shrink-0",
                  task.status === 'fait' 
                    ? "bg-success/20 text-success" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {task.order}
                </span>
              </button>
            ))
        )}
      </div>
    </div>
  );
}
