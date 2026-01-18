import * as React from 'react';
import { Users, Shield, Check, X, Loader2, Search, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Permission, 
  PERMISSION_LABELS, 
  DEFAULT_EMPLOYEE_PERMISSIONS,
  ADMIN_PERMISSIONS,
  getEmployeePermissions, 
  setEmployeePermissions,
  getAllEmployeePermissions,
} from '@/lib/permissions';
import { fetchAllWorkers } from '@/lib/api';

interface Worker {
  id: number;
  login: string;
  name: string;
  firstName: string;
  isAdmin?: boolean;
}

export function EmployeePermissions() {
  const { toast } = useToast();
  const [workers, setWorkers] = React.useState<Worker[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedWorker, setSelectedWorker] = React.useState<Worker | null>(null);
  const [selectedPermissions, setSelectedPermissions] = React.useState<Permission[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const loadWorkers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllWorkers();
      setWorkers(data || []);
    } catch (error) {
      console.error('Error loading workers:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger la liste des employés',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  const filteredWorkers = workers.filter(w => {
    const fullName = `${w.firstName} ${w.name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || w.login.toLowerCase().includes(query);
  });

  const openPermissionsDialog = (worker: Worker) => {
    setSelectedWorker(worker);
    const currentPermissions = worker.isAdmin 
      ? ADMIN_PERMISSIONS 
      : getEmployeePermissions(worker.id);
    setSelectedPermissions([...currentPermissions]);
    setDialogOpen(true);
  };

  const togglePermission = (permission: Permission) => {
    setSelectedPermissions(prev => 
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const handleSave = async () => {
    if (!selectedWorker) return;
    
    setIsSaving(true);
    try {
      const workerName = `${selectedWorker.firstName} ${selectedWorker.name}`.trim();
      setEmployeePermissions(selectedWorker.id, workerName, selectedPermissions);
      
      toast({
        title: 'Droits sauvegardés',
        description: `Les droits de ${workerName} ont été mis à jour`,
      });
      
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les droits',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getWorkerPermissionCount = (worker: Worker): number => {
    if (worker.isAdmin) return ADMIN_PERMISSIONS.length;
    return getEmployeePermissions(worker.id).length;
  };

  const allPermissions: Permission[] = Object.keys(PERMISSION_LABELS) as Permission[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Droits des employés
        </CardTitle>
        <CardDescription>
          Gérez les permissions d'accès aux fonctionnalités de suivi des heures
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and refresh */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un employé..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={loadWorkers} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Workers list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'Aucun employé trouvé' : 'Aucun employé disponible'}
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {filteredWorkers.map((worker) => (
                <div
                  key={worker.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {worker.firstName} {worker.name}
                      </p>
                      <p className="text-sm text-muted-foreground">{worker.login}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {worker.isAdmin ? (
                      <Badge className="bg-primary">Admin</Badge>
                    ) : (
                      <Badge variant="secondary">
                        {getWorkerPermissionCount(worker)} droits
                      </Badge>
                    )}
                    <Dialog open={dialogOpen && selectedWorker?.id === worker.id} onOpenChange={(open) => {
                      if (!open) setDialogOpen(false);
                    }}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openPermissionsDialog(worker)}
                        >
                          <Shield className="h-4 w-4 mr-1" />
                          Gérer
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Droits de {selectedWorker?.firstName} {selectedWorker?.name}
                          </DialogTitle>
                        </DialogHeader>

                        {selectedWorker?.isAdmin ? (
                          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                            <p className="text-sm font-medium text-primary">
                              Cet utilisateur est administrateur
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Les administrateurs ont automatiquement tous les droits.
                              Modifiez le statut admin dans Dolibarr si nécessaire.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedPermissions([...DEFAULT_EMPLOYEE_PERMISSIONS])}
                              >
                                Défaut
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedPermissions([...ADMIN_PERMISSIONS])}
                              >
                                Tous
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedPermissions([])}
                              >
                                Aucun
                              </Button>
                            </div>

                            <Separator />

                            <ScrollArea className="h-[300px] pr-4">
                              <div className="space-y-3">
                                {allPermissions.map((permission) => {
                                  const { label, description } = PERMISSION_LABELS[permission];
                                  const isChecked = selectedPermissions.includes(permission);
                                  
                                  return (
                                    <div
                                      key={permission}
                                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                                        isChecked ? 'bg-primary/5 border-primary/30' : 'hover:bg-accent/50'
                                      }`}
                                      onClick={() => togglePermission(permission)}
                                    >
                                      <Checkbox
                                        id={permission}
                                        checked={isChecked}
                                        onCheckedChange={() => togglePermission(permission)}
                                        className="mt-0.5"
                                      />
                                      <div className="flex-1">
                                        <Label 
                                          htmlFor={permission}
                                          className="font-medium cursor-pointer"
                                        >
                                          {label}
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {description}
                                        </p>
                                      </div>
                                      {isChecked && (
                                        <Check className="h-4 w-4 text-primary" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </ScrollArea>

                            <Separator />

                            <Button 
                              onClick={handleSave} 
                              disabled={isSaving}
                              className="w-full"
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-2" />
                                  Sauvegarder les droits
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
