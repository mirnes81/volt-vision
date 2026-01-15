import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HandHeart, Loader2, CheckCircle } from 'lucide-react';
import { Intervention } from '@/types/intervention';
import { releaseIntervention } from '@/lib/releasedInterventions';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ReleaseButtonProps {
  intervention: Intervention;
  onReleased?: () => void;
}

export function ReleaseButton({ intervention, onReleased }: ReleaseButtonProps) {
  const { worker } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isReleased, setIsReleased] = useState(false);

  const handleRelease = async () => {
    if (!worker) {
      toast.error('Vous devez être connecté');
      return;
    }

    setIsLoading(true);
    
    const result = await releaseIntervention(
      intervention,
      worker.id,
      `${worker.firstName} ${worker.name}`
    );

    if (result.success) {
      setIsReleased(true);
      toast.success('Intervention libérée', {
        description: 'Les collègues proches peuvent maintenant la reprendre'
      });
      onReleased?.();
    } else {
      toast.error('Erreur', { description: result.error });
    }

    setIsLoading(false);
  };

  if (isReleased) {
    return (
      <Button variant="outline" disabled className="gap-2 text-green-600 border-green-600">
        <CheckCircle className="w-4 h-4" />
        Libérée
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <HandHeart className="w-4 h-4" />
          )}
          Libérer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Libérer cette intervention ?</AlertDialogTitle>
          <AlertDialogDescription>
            L'intervention sera proposée aux collègues les plus proches. 
            Ils pourront la reprendre en temps réel.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleRelease}>
            Confirmer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}