import * as React from 'react';
import { CheckCircle, XCircle, Loader2, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface DiagnosticStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  data?: any;
}

export default function DiagnosticPage() {
  const [steps, setSteps] = React.useState<DiagnosticStep[]>([
    { id: 'supabase', label: '1. Connexion Supabase', status: 'pending' },
    { id: 'edge-function', label: '2. Edge Function disponible', status: 'pending' },
    { id: 'dolibarr-status', label: '3. API Dolibarr /status', status: 'pending' },
    { id: 'dolibarr-users', label: '4. API Dolibarr /users', status: 'pending' },
    { id: 'find-admin', label: '5. Trouver utilisateur admin', status: 'pending' },
  ]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [logs, setLogs] = React.useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const updateStep = (id: string, update: Partial<DiagnosticStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, ...update } : step
    ));
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setLogs([]);
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', message: undefined, data: undefined })));

    try {
      // Step 1: Check Supabase connection
      addLog('Vérification connexion Supabase...');
      updateStep('supabase', { status: 'running' });
      
      const supabaseUrl = (supabase as any).supabaseUrl;
      if (supabaseUrl) {
        updateStep('supabase', { status: 'success', message: `URL: ${supabaseUrl}` });
        addLog(`✓ Supabase configuré: ${supabaseUrl}`);
      } else {
        updateStep('supabase', { status: 'error', message: 'URL Supabase non configurée' });
        addLog('✗ URL Supabase non trouvée');
        return;
      }

      // Step 2: Check Edge Function
      addLog('Test de l\'Edge Function dolibarr-api...');
      updateStep('edge-function', { status: 'running' });
      
      try {
        const { data, error } = await supabase.functions.invoke('dolibarr-api', {
          body: { action: 'status', params: {} },
        });
        
        if (error) {
          updateStep('edge-function', { status: 'error', message: error.message });
          addLog(`✗ Edge Function erreur: ${error.message}`);
          return;
        }
        
        updateStep('edge-function', { status: 'success', message: 'Fonction accessible' });
        addLog('✓ Edge Function accessible');
        
        // Step 3: Check Dolibarr status
        addLog('Vérification API Dolibarr /status...');
        updateStep('dolibarr-status', { status: 'running' });
        
        if (data?.error) {
          updateStep('dolibarr-status', { status: 'error', message: data.error });
          addLog(`✗ Dolibarr erreur: ${data.error}`);
          return;
        }
        
        const version = data?.success?.dolibarr_version || data?.dolibarr_version;
        if (version) {
          updateStep('dolibarr-status', { status: 'success', message: `Version ${version}`, data });
          addLog(`✓ Dolibarr version: ${version}`);
        } else {
          updateStep('dolibarr-status', { status: 'success', message: 'Réponse reçue', data });
          addLog('✓ Dolibarr répond (version non détectée)');
        }
        
      } catch (err: any) {
        updateStep('edge-function', { status: 'error', message: err.message });
        addLog(`✗ Erreur: ${err.message}`);
        return;
      }

      // Step 4: Get users list
      addLog('Récupération liste utilisateurs...');
      updateStep('dolibarr-users', { status: 'running' });
      
      try {
        const { data: usersData, error: usersError } = await supabase.functions.invoke('dolibarr-api', {
          body: { action: 'get-users', params: {} },
        });
        
        if (usersError) {
          updateStep('dolibarr-users', { status: 'error', message: usersError.message });
          addLog(`✗ Erreur utilisateurs: ${usersError.message}`);
          return;
        }
        
        if (Array.isArray(usersData)) {
          updateStep('dolibarr-users', { status: 'success', message: `${usersData.length} utilisateur(s)`, data: usersData });
          addLog(`✓ ${usersData.length} utilisateur(s) trouvé(s)`);
          
          // Log each user
          usersData.forEach((user: any) => {
            addLog(`   → ${user.login} (${user.firstname} ${user.lastname}) - ${user.email}`);
          });
        } else {
          updateStep('dolibarr-users', { status: 'error', message: 'Format inattendu', data: usersData });
          addLog('✗ Format utilisateurs inattendu');
        }
        
      } catch (err: any) {
        updateStep('dolibarr-users', { status: 'error', message: err.message });
        addLog(`✗ Erreur: ${err.message}`);
        return;
      }

      // Step 5: Find admin user
      addLog('Recherche utilisateur admin...');
      updateStep('find-admin', { status: 'running' });
      
      try {
        const { data: loginData, error: loginError } = await supabase.functions.invoke('dolibarr-api', {
          body: { action: 'login', params: { login: 'admin', password: 'test' } },
        });
        
        if (loginError) {
          updateStep('find-admin', { status: 'error', message: loginError.message });
          addLog(`✗ Erreur login: ${loginError.message}`);
          return;
        }
        
        if (Array.isArray(loginData) && loginData.length > 0) {
          const user = loginData[0];
          updateStep('find-admin', { 
            status: 'success', 
            message: `${user.firstname} ${user.lastname} (${user.email})`,
            data: user 
          });
          addLog(`✓ Admin trouvé: ${user.firstname} ${user.lastname}`);
          addLog(`   Login: ${user.login}`);
          addLog(`   Email: ${user.email}`);
          addLog(`   ID: ${user.id}`);
        } else {
          updateStep('find-admin', { status: 'error', message: 'Utilisateur non trouvé', data: loginData });
          addLog('✗ Utilisateur admin non trouvé');
        }
        
      } catch (err: any) {
        updateStep('find-admin', { status: 'error', message: err.message });
        addLog(`✗ Erreur: ${err.message}`);
      }

      addLog('');
      addLog('=== DIAGNOSTIC TERMINÉ ===');
      addLog('Si tous les tests sont verts, la connexion devrait fonctionner.');
      addLog('Retournez à la page de login et essayez avec: admin + votre mot de passe');

    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: DiagnosticStep['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-3">
            <Zap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Diagnostic Dolibarr</h1>
          <p className="text-muted-foreground">Test complet de la connexion</p>
        </div>

        {/* Run Button */}
        <Button 
          onClick={runDiagnostics} 
          disabled={isRunning}
          className="w-full h-12"
          size="lg"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Diagnostic en cours...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5 mr-2" />
              Lancer le diagnostic
            </>
          )}
        </Button>

        {/* Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Étapes de vérification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map(step => (
              <div key={step.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                {getStatusIcon(step.status)}
                <div className="flex-1">
                  <p className="font-medium">{step.label}</p>
                  {step.message && (
                    <p className={`text-sm ${step.status === 'error' ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {step.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Journal détaillé</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-80 overflow-auto">
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Back to Login */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => window.location.href = '/'}
        >
          Retour à la page de connexion
        </Button>
      </div>
    </div>
  );
}
