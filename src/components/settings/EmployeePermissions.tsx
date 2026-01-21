import * as React from 'react';
import { Users, Shield, Check, Loader2, Search, RefreshCw, Database, X, Crown, Eye, Clock, FileText, AlertTriangle, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  Permission, 
  PERMISSION_LABELS, 
  DEFAULT_EMPLOYEE_PERMISSIONS,
  ADMIN_PERMISSIONS,
  getEmployeePermissionsAsync, 
  setEmployeePermissionsAsync,
  getAllEmployeePermissionsAsync,
  clearPermissionsCache,
  hasLegacyPermissions,
  migratePermissionsToDatabase,
  getLegacyPermissions,
} from '@/lib/permissions';
import { fetchAllWorkers } from '@/lib/api';

interface Worker {
  id: number;
  login: string;
  name: string;
  firstName: string;
  isAdmin?: boolean;
}

interface WorkerWithPermissions extends Worker {
  permissions: Permission[];
  permissionsLoaded: boolean;
}

// Permission categories for better organization
const PERMISSION_CATEGORIES = {
  view: {
    label: 'Consultation',
    icon: Eye,
    permissions: ['hours.view_own', 'hours.view_all'] as Permission[],
    color: 'bg-blue-500',
  },
  manage: {
    label: 'Gestion',
    icon: Clock,
    permissions: ['hours.add_own', 'hours.modify_own_limit', 'hours.validate'] as Permission[],
    color: 'bg-green-500',
  },
  export: {
    label: 'Export',
    icon: FileText,
    permissions: ['hours.export'] as Permission[],
    color: 'bg-purple-500',
  },
  admin: {
    label: 'Admin',
    icon: Settings,
    permissions: ['hours.alerts', 'settings.hours'] as Permission[],
    color: 'bg-orange-500',
  },
};

// Short labels for grid display
const SHORT_LABELS: Record<Permission, string> = {
  'hours.view_own': 'Voir ses heures',
  'hours.add_own': 'Ajouter',
  'hours.modify_own_limit': 'Limite perso',
  'hours.validate': 'Valider',
  'hours.view_all': 'Voir tout',
  'hours.export': 'Export',
  'hours.alerts': 'Alertes',
  'settings.hours': 'Paramètres',
};

export function EmployeePermissions() {
  const { toast } = useToast();
  const [workers, setWorkers] = React.useState<WorkerWithPermissions[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [savingWorkerId, setSavingWorkerId] = React.useState<number | null>(null);
  
  // Migration state
  const [showMigrationBanner, setShowMigrationBanner] = React.useState(false);
  const [isMigrating, setIsMigrating] = React.useState(false);
  const [legacyCount, setLegacyCount] = React.useState(0);

  // Check for legacy permissions on mount
  React.useEffect(() => {
    if (hasLegacyPermissions()) {
      const legacy = getLegacyPermissions();
      setLegacyCount(legacy.length);
      setShowMigrationBanner(true);
    }
  }, []);

  const handleMigration = async () => {
    setIsMigrating(true);
    try {
      const result = await migratePermissionsToDatabase();
      
      if (result.success) {
        toast({
          title: 'Migration réussie',
          description: `${result.migrated} employé(s) migrés vers la base de données`,
        });
        setShowMigrationBanner(false);
        loadWorkers();
      } else {
        toast({
          title: 'Migration partielle',
          description: `${result.migrated} migrés, ${result.errors.length} erreur(s)`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: 'Erreur de migration',
        description: 'Impossible de migrer les permissions',
        variant: 'destructive',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const loadWorkers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllWorkers();
      
      const allPerms = await getAllEmployeePermissionsAsync();
      const permsMap = new Map(allPerms.map(p => [p.userId, p.permissions]));
      
      const workersWithPerms: WorkerWithPermissions[] = (data || []).map(worker => ({
        ...worker,
        permissions: worker.isAdmin 
          ? ADMIN_PERMISSIONS 
          : (permsMap.get(String(worker.id)) || DEFAULT_EMPLOYEE_PERMISSIONS),
        permissionsLoaded: true,
      }));
      
      setWorkers(workersWithPerms);
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

  // Separate admins and regular employees
  const adminWorkers = filteredWorkers.filter(w => w.isAdmin);
  const regularWorkers = filteredWorkers.filter(w => !w.isAdmin);

  const togglePermission = async (worker: WorkerWithPermissions, permission: Permission) => {
    if (worker.isAdmin) return; // Admins can't be modified
    
    setSavingWorkerId(worker.id);
    
    const newPermissions = worker.permissions.includes(permission)
      ? worker.permissions.filter(p => p !== permission)
      : [...worker.permissions, permission];
    
    try {
      const workerName = `${worker.firstName} ${worker.name}`.trim();
      await setEmployeePermissionsAsync(worker.id, workerName, newPermissions);
      
      // Update local state
      setWorkers(prev => prev.map(w => 
        w.id === worker.id 
          ? { ...w, permissions: newPermissions }
          : w
      ));
      
      // Quick feedback without full toast
    } catch (error) {
      console.error('Error saving permission:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier le droit',
        variant: 'destructive',
      });
    } finally {
      setSavingWorkerId(null);
    }
  };

  const setAllPermissions = async (worker: WorkerWithPermissions, permissions: Permission[]) => {
    if (worker.isAdmin) return;
    
    setSavingWorkerId(worker.id);
    
    try {
      const workerName = `${worker.firstName} ${worker.name}`.trim();
      await setEmployeePermissionsAsync(worker.id, workerName, permissions);
      
      setWorkers(prev => prev.map(w => 
        w.id === worker.id 
          ? { ...w, permissions }
          : w
      ));
      
      toast({
        title: 'Droits mis à jour',
        description: `${workerName}: ${permissions.length} droits`,
      });
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier les droits',
        variant: 'destructive',
      });
    } finally {
      setSavingWorkerId(null);
    }
  };

  const handleRefresh = () => {
    clearPermissionsCache();
    loadWorkers();
  };

  const allPermissions: Permission[] = Object.keys(PERMISSION_LABELS) as Permission[];

  const getPermissionCount = (worker: WorkerWithPermissions) => {
    if (worker.isAdmin) return allPermissions.length;
    return worker.permissions.length;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Droits des employés
        </CardTitle>
        <CardDescription>
          Cliquez sur une case pour activer/désactiver un droit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Migration Banner */}
        {showMigrationBanner && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <Database className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-500">Migration disponible</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{legacyCount} employé(s) ont des permissions locales.</p>
              <Button 
                onClick={handleMigration} 
                disabled={isMigrating}
                size="sm"
                className="gap-2"
              >
                {isMigrating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                Migrer
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Search and refresh */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'Aucun employé trouvé' : 'Aucun employé disponible'}
          </div>
        ) : (
          <TooltipProvider delayDuration={300}>
            <ScrollArea className="h-[400px]">
              {/* Permission Grid */}
              <div className="min-w-[600px]">
                {/* Header row */}
                <div className="flex items-center gap-1 p-2 bg-muted/50 rounded-t-lg sticky top-0 z-10 border-b">
                  <div className="w-[180px] flex-shrink-0 font-medium text-sm">
                    Employé
                  </div>
                  {allPermissions.map(permission => (
                    <Tooltip key={permission}>
                      <TooltipTrigger asChild>
                        <div className="w-[70px] flex-shrink-0 text-center">
                          <span className="text-[10px] text-muted-foreground leading-tight block truncate px-1">
                            {SHORT_LABELS[permission]}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px]">
                        <p className="font-medium">{PERMISSION_LABELS[permission].label}</p>
                        <p className="text-xs text-muted-foreground">
                          {PERMISSION_LABELS[permission].description}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  <div className="w-[80px] flex-shrink-0 text-center text-[10px] text-muted-foreground">
                    Actions
                  </div>
                </div>

                {/* Admin workers section */}
                {adminWorkers.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground bg-primary/5 flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      Administrateurs ({adminWorkers.length})
                    </div>
                    {adminWorkers.map(worker => (
                      <div 
                        key={worker.id}
                        className="flex items-center gap-1 p-2 border-b border-border/50 bg-primary/5"
                      >
                        <div className="w-[180px] flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                              <Crown className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {worker.firstName} {worker.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {worker.login}
                              </p>
                            </div>
                          </div>
                        </div>
                        {allPermissions.map(permission => (
                          <div key={permission} className="w-[70px] flex-shrink-0 flex justify-center">
                            <div className="h-7 w-7 rounded bg-primary/20 flex items-center justify-center">
                              <Check className="h-4 w-4 text-primary" />
                            </div>
                          </div>
                        ))}
                        <div className="w-[80px] flex-shrink-0 flex justify-center">
                          <Badge variant="secondary" className="text-[10px]">
                            Tous
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Regular workers section */}
                {regularWorkers.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground bg-muted/30 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Techniciens ({regularWorkers.length})
                    </div>
                    {regularWorkers.map(worker => (
                      <div 
                        key={worker.id}
                        className={cn(
                          "flex items-center gap-1 p-2 border-b border-border/50 transition-colors",
                          savingWorkerId === worker.id && "bg-primary/5"
                        )}
                      >
                        <div className="w-[180px] flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center relative">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              {savingWorkerId === worker.id && (
                                <div className="absolute inset-0 bg-background/50 rounded-full flex items-center justify-center">
                                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {worker.firstName} {worker.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {worker.login}
                              </p>
                            </div>
                          </div>
                        </div>
                        {allPermissions.map(permission => {
                          const hasPermission = worker.permissions.includes(permission);
                          return (
                            <Tooltip key={permission}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => togglePermission(worker, permission)}
                                  disabled={savingWorkerId === worker.id}
                                  className={cn(
                                    "w-[70px] flex-shrink-0 flex justify-center",
                                  )}
                                >
                                  <div 
                                    className={cn(
                                      "h-7 w-7 rounded flex items-center justify-center transition-all cursor-pointer",
                                      hasPermission 
                                        ? "bg-green-500/20 hover:bg-green-500/30 text-green-600 dark:text-green-400" 
                                        : "bg-muted/50 hover:bg-muted text-muted-foreground/30 hover:text-muted-foreground/50"
                                    )}
                                  >
                                    {hasPermission ? (
                                      <Check className="h-4 w-4" />
                                    ) : (
                                      <X className="h-3 w-3" />
                                    )}
                                  </div>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>{hasPermission ? 'Retirer' : 'Accorder'}: {PERMISSION_LABELS[permission].label}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        <div className="w-[80px] flex-shrink-0 flex justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setAllPermissions(worker, [...DEFAULT_EMPLOYEE_PERMISSIONS])}
                                disabled={savingWorkerId === worker.id}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Réinitialiser</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setAllPermissions(worker, [...ADMIN_PERMISSIONS])}
                                disabled={savingWorkerId === worker.id}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Tous les droits</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Legend */}
            <div className="flex items-center gap-4 pt-3 mt-3 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded bg-green-500/20 flex items-center justify-center">
                  <Check className="h-3 w-3 text-green-600" />
                </div>
                <span>Accordé</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded bg-muted/50 flex items-center justify-center">
                  <X className="h-2.5 w-2.5 text-muted-foreground/30" />
                </div>
                <span>Non accordé</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded bg-primary/20 flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <span>Admin (tous droits)</span>
              </div>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
