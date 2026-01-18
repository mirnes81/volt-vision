import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, CheckCircle, XCircle, Loader2, AlertTriangle, Wifi, WifiOff, Clock, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { ReminderSettings } from '@/components/settings/ReminderSettings';
import { EmployeePermissions } from '@/components/settings/EmployeePermissions';
import { PWAUpdateButton } from '@/components/pwa/PWAPrompts';
import { isInstalledPWA } from '@/lib/pwaUtils';
import { 
  getDolibarrConfig, 
  saveDolibarrConfig, 
  testDolibarrConnection,
  DolibarrConfig 
} from '@/lib/dolibarrConfig';
import { 
  getHoursSettings, 
  saveHoursSettings, 
  formatMinutesToHM,
  HoursSettings 
} from '@/lib/hoursSettings';
import { getCurrentWorker } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [config, setConfig] = React.useState<DolibarrConfig>(getDolibarrConfig());
  const [url, setUrl] = React.useState(config.baseUrl);
  const [apiKey, setApiKey] = React.useState(config.apiKey || '');
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string; version?: string } | null>(null);
  
  // Hours settings
  const [hoursSettings, setHoursSettings] = React.useState<HoursSettings>(getHoursSettings());
  const [maxHoursInput, setMaxHoursInput] = React.useState('');
  const [alertMinutesInput, setAlertMinutesInput] = React.useState('');
  const worker = getCurrentWorker() as any;
  const isAdmin = worker?.isAdmin || worker?.admin;
  const canAccessHoursSettings = worker ? hasPermission(worker.id, 'settings.hours', isAdmin) : false;
  
  React.useEffect(() => {
    const storedConfig = getDolibarrConfig();
    setConfig(storedConfig);
    setUrl(storedConfig.baseUrl);
    setApiKey(storedConfig.apiKey || '');
    
    const storedHours = getHoursSettings();
    setHoursSettings(storedHours);
    const hours = Math.floor(storedHours.maxDailyHours / 60);
    const mins = storedHours.maxDailyHours % 60;
    setMaxHoursInput(`${hours}h${mins.toString().padStart(2, '0')}`);
    setAlertMinutesInput(storedHours.alertThresholdMinutes.toString());
  }, []);

  const handleTest = async () => {
    if (!url.trim()) {
      toast({
        title: 'URL requise',
        description: 'Veuillez entrer l\'URL de votre Dolibarr',
        variant: 'destructive',
      });
      return;
    }
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await testDolibarrConnection(url);
      setTestResult(result);
      
      if (result.success) {
        toast({
          title: 'Connexion réussie',
          description: result.version ? `Dolibarr ${result.version} détecté` : result.message,
        });
      } else {
        toast({
          title: 'Échec de connexion',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Erreur lors du test',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const updated = saveDolibarrConfig({
      baseUrl: url.trim(),
      apiKey: apiKey.trim(),
      lastTest: new Date().toISOString(),
      testStatus: testResult?.success ? 'success' : undefined,
    });
    setConfig(updated);
    
    toast({
      title: 'Configuration sauvegardée',
      description: url ? 'Connexion Dolibarr configurée' : 'Configuration réinitialisée',
    });
  };

  const handleReset = () => {
    setUrl('');
    setApiKey('');
    saveDolibarrConfig({ baseUrl: '', apiKey: '', testStatus: undefined, lastTest: undefined });
    setConfig(getDolibarrConfig());
    setTestResult(null);
    
    toast({
      title: 'Configuration réinitialisée',
      description: 'Veuillez reconfigurer la connexion Dolibarr',
    });
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border lg:hidden">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Configuration</h1>
        </div>
      </header>
      <div className="hidden lg:block p-4 border-b border-border">
        <h1 className="text-2xl font-bold">Configuration</h1>
      </div>

      <div className="p-4 space-y-4 pb-24">
        {/* PWA Status & Update */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Application
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="font-medium">Mode d'exécution</p>
                <p className="text-muted-foreground">
                  {isInstalledPWA() ? 'Application installée' : 'Navigateur web'}
                </p>
              </div>
              <Badge variant={isInstalledPWA() ? 'default' : 'secondary'}>
                {isInstalledPWA() ? 'PWA' : 'Web'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="font-medium">Mise à jour</p>
                <p className="text-muted-foreground">
                  Forcer le rechargement des fichiers
                </p>
              </div>
              <PWAUpdateButton />
            </div>
          </CardContent>
        </Card>

        {/* Employee Permissions (Admin only) */}
        {isAdmin && <EmployeePermissions />}

        {/* Hours Settings (Admin or users with permission) */}
        {canAccessHoursSettings && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Paramètres des heures
              </CardTitle>
              <CardDescription>
                Configurez les limites d'heures journalières pour les ouvriers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max-hours">Heures maximum par jour</Label>
                <Input
                  id="max-hours"
                  type="text"
                  placeholder="Ex: 8h30"
                  value={maxHoursInput}
                  onChange={(e) => setMaxHoursInput(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Format: 8h30 ou 8:30 (actuellement: {formatMinutesToHM(hoursSettings.maxDailyHours)})
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="alert-minutes">Alerte avant dépassement (minutes)</Label>
                <Input
                  id="alert-minutes"
                  type="number"
                  min="0"
                  max="120"
                  value={alertMinutesInput}
                  onChange={(e) => setAlertMinutesInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  L'utilisateur sera averti X minutes avant d'atteindre la limite
                </p>
              </div>
              
              <Button 
                onClick={() => {
                  // Parse max hours
                  let maxMinutes = hoursSettings.maxDailyHours;
                  const match = maxHoursInput.match(/^(\d+)[h:](\d+)$/i);
                  if (match) {
                    maxMinutes = parseInt(match[1]) * 60 + parseInt(match[2]);
                  } else {
                    const decimal = parseFloat(maxHoursInput);
                    if (!isNaN(decimal)) {
                      maxMinutes = Math.round(decimal * 60);
                    }
                  }
                  
                  const alertMins = parseInt(alertMinutesInput) || 30;
                  
                  const updated = saveHoursSettings({
                    maxDailyHours: maxMinutes,
                    alertThresholdMinutes: alertMins,
                  });
                  setHoursSettings(updated);
                  
                  toast({
                    title: 'Paramètres sauvegardés',
                    description: `Limite: ${formatMinutesToHM(maxMinutes)}/jour, Alerte: ${alertMins} min avant`,
                  });
                }}
                className="w-full"
              >
                Sauvegarder les paramètres d'heures
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Notifications */}
        <NotificationSettings />

        {/* Rappels d'interventions */}
        <ReminderSettings />

        {/* Connection Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-5 w-5" />
                État de la connexion
              </CardTitle>
              <Badge variant="default" className="bg-green-500">
                <Wifi className="h-3 w-3 mr-1" />
                Connecté (serveur)
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Configuration serveur active</p>
                  <p>Les clés API Dolibarr sont configurées côté serveur (Edge Function).</p>
                  <p className="mt-1 font-mono text-xs">https://crm.enes-electricite.ch</p>
                </div>
              </div>
              {config.baseUrl && (
                <p className="mt-2">
                  Configuration locale: <span className="font-mono text-foreground">{config.baseUrl}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dolibarr Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connexion Dolibarr</CardTitle>
            <CardDescription>
              Entrez l'URL de votre instance Dolibarr pour connecter l'application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dolibarr-url">URL Dolibarr</Label>
              <Input
                id="dolibarr-url"
                type="url"
                placeholder="https://votre-dolibarr.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Exemple: https://erp.monentreprise.ch ou http://192.168.1.100/dolibarr
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">Clé API (DOLAPIKEY)</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Votre clé API Dolibarr"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Trouvable dans Dolibarr → Utilisateurs → votre profil → Onglet API
              </p>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`flex items-start gap-2 p-3 rounded-lg ${
                testResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-destructive/10 border border-destructive/30'
              }`}>
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                )}
                <div className="text-sm">
                  <p className="font-medium">{testResult.success ? 'Connexion réussie' : 'Échec de connexion'}</p>
                  <p className="text-muted-foreground">{testResult.message}</p>
                  {testResult.version && (
                    <p className="text-muted-foreground">Version: {testResult.version}</p>
                  )}
                </div>
              </div>
            )}

            <Separator />

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleTest} 
                disabled={isTesting || !url.trim()}
                className="flex-1"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Test en cours...
                  </>
                ) : (
                  'Tester la connexion'
                )}
              </Button>
              <Button onClick={handleSave} className="flex-1">
                Sauvegarder
              </Button>
            </div>

            {config.isConfigured && (
              <Button 
                variant="ghost" 
                onClick={handleReset}
                className="w-full text-muted-foreground"
              >
                Réinitialiser la configuration
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Help */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration requise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="space-y-2">
              <p className="font-medium text-foreground">Sur votre Dolibarr:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Activer l'API REST dans Configuration → Modules → API</li>
                <li>Générer une clé API dans votre profil utilisateur</li>
                <li>Configurer CORS si nécessaire</li>
              </ol>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="font-medium text-foreground">CORS (Cross-Origin):</p>
              <p>
                Si vous avez des erreurs CORS, ajoutez dans votre <span className="font-mono">.htaccess</span> Dolibarr:
              </p>
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Headers "DOLAPIKEY, Content-Type"
Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE"`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
