import * as React from 'react';
import { Download, RefreshCw, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isInstalledPWA, canInstall, promptInstall, forceUpdateApp } from '@/lib/pwaUtils';
import { cn } from '@/lib/utils';

export function PWAInstallPrompt() {
  const [showInstallBanner, setShowInstallBanner] = React.useState(false);
  const [isInstalled, setIsInstalled] = React.useState(false);

  React.useEffect(() => {
    // Check if already installed
    setIsInstalled(isInstalledPWA());

    // Check if can show install prompt
    const checkInstall = () => {
      if (!isInstalledPWA() && canInstall()) {
        setShowInstallBanner(true);
      }
    };

    // Check after a delay to allow the beforeinstallprompt event to fire
    const timeout = setTimeout(checkInstall, 3000);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowInstallBanner(false);
    });

    return () => clearTimeout(timeout);
  }, []);

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setShowInstallBanner(false);
    }
  };

  if (isInstalled || !showInstallBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:bottom-4 md:w-80">
      <div className="bg-card border-2 border-primary/20 rounded-xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Installer l'application</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Ajoutez ENES à votre écran d'accueil pour un accès rapide
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleInstall} className="gap-2">
                <Download className="w-4 h-4" />
                Installer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowInstallBanner(false)}>
                Plus tard
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 -mt-1 -mr-1"
            onClick={() => setShowInstallBanner(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PWAUpdateButton() {
  const [isUpdating, setIsUpdating] = React.useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    await forceUpdateApp();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleUpdate}
      disabled={isUpdating}
      className="gap-2"
    >
      <RefreshCw className={cn('w-4 h-4', isUpdating && 'animate-spin')} />
      {isUpdating ? 'Mise à jour...' : 'Forcer mise à jour'}
    </Button>
  );
}
