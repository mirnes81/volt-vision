import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Share, MoreVertical, Plus, Smartphone, Monitor, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isInstalledPWA, canInstall, promptInstall } from '@/lib/pwaUtils';

export default function InstallPage() {
  const navigate = useNavigate();
  const [isInstalled, setIsInstalled] = useState(false);
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    setIsInstalled(isInstalledPWA());
    setCanPromptInstall(canInstall());
    
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));
  }, []);

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      setIsInstalled(true);
    }
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>

          <Card className="text-center">
            <CardContent className="pt-8 pb-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Application installée !</h1>
              <p className="text-muted-foreground mb-6">
                ENES Électricité est déjà installée sur votre appareil.
                Vous pouvez la trouver sur votre écran d'accueil.
              </p>
              <Button onClick={() => navigate('/dashboard')}>
                Aller au tableau de bord
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <img 
              src="/logo-enes.png" 
              alt="ENES" 
              className="w-14 h-14 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold mb-2">Installer l'application</h1>
          <p className="text-muted-foreground">
            Installez ENES Électricité sur votre appareil pour un accès rapide et une utilisation hors-ligne.
          </p>
        </div>

        {/* Quick Install Button */}
        {canPromptInstall && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <Button 
                onClick={handleInstall} 
                className="w-full h-12 text-lg"
                size="lg"
              >
                <Download className="w-5 h-5 mr-2" />
                Installer maintenant
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Cliquez pour installer directement
              </p>
            </CardContent>
          </Card>
        )}

        {/* Instructions Tabs */}
        <Tabs defaultValue={isIOS ? 'ios' : 'android'} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="android" className="text-xs sm:text-sm">
              <Smartphone className="w-4 h-4 mr-1" />
              Android
            </TabsTrigger>
            <TabsTrigger value="ios" className="text-xs sm:text-sm">
              <Smartphone className="w-4 h-4 mr-1" />
              iPhone
            </TabsTrigger>
            <TabsTrigger value="desktop" className="text-xs sm:text-sm">
              <Monitor className="w-4 h-4 mr-1" />
              PC
            </TabsTrigger>
          </TabsList>

          {/* Android Instructions */}
          <TabsContent value="android" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-primary" />
                  Installation sur Android
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Ouvrir dans Chrome</p>
                    <p className="text-sm text-muted-foreground">
                      Assurez-vous d'utiliser Google Chrome pour cette page.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Menu Chrome</p>
                    <p className="text-sm text-muted-foreground">
                      Appuyez sur les <strong>trois points</strong> <MoreVertical className="w-4 h-4 inline" /> en haut à droite.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">"Installer l'application"</p>
                    <p className="text-sm text-muted-foreground">
                      Sélectionnez <strong>"Installer l'application"</strong> ou <strong>"Ajouter à l'écran d'accueil"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    4
                  </div>
                  <div>
                    <p className="font-medium">Confirmer</p>
                    <p className="text-sm text-muted-foreground">
                      Appuyez sur <strong>"Installer"</strong> dans la popup de confirmation.
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 mt-4">
                  <p className="text-sm">
                    ✅ L'application apparaîtra sur votre écran d'accueil comme une application normale.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* iOS Instructions */}
          <TabsContent value="ios" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-primary" />
                  Installation sur iPhone/iPad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    ⚠️ <strong>Important:</strong> Utilisez Safari pour installer l'application sur iOS.
                  </p>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Ouvrir dans Safari</p>
                    <p className="text-sm text-muted-foreground">
                      Cette page doit être ouverte dans <strong>Safari</strong> (pas Chrome ou Firefox).
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Bouton Partager</p>
                    <p className="text-sm text-muted-foreground">
                      Appuyez sur le bouton <strong>Partager</strong> <Share className="w-4 h-4 inline" /> en bas de l'écran (carré avec flèche).
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">"Sur l'écran d'accueil"</p>
                    <p className="text-sm text-muted-foreground">
                      Faites défiler et appuyez sur <strong>"Sur l'écran d'accueil"</strong> <Plus className="w-4 h-4 inline" />.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    4
                  </div>
                  <div>
                    <p className="font-medium">Ajouter</p>
                    <p className="text-sm text-muted-foreground">
                      Appuyez sur <strong>"Ajouter"</strong> en haut à droite.
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 mt-4">
                  <p className="text-sm">
                    ✅ L'icône ENES apparaîtra sur votre écran d'accueil.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Desktop Instructions */}
          <TabsContent value="desktop" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-primary" />
                  Installation sur ordinateur
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Ouvrir dans Chrome ou Edge</p>
                    <p className="text-sm text-muted-foreground">
                      Utilisez Google Chrome ou Microsoft Edge.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Icône d'installation</p>
                    <p className="text-sm text-muted-foreground">
                      Cliquez sur l'icône <Download className="w-4 h-4 inline" /> dans la barre d'adresse (à droite).
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Confirmer l'installation</p>
                    <p className="text-sm text-muted-foreground">
                      Cliquez sur <strong>"Installer"</strong> dans la popup.
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 mt-4">
                  <p className="text-sm">
                    ✅ L'application s'ouvrira dans sa propre fenêtre et sera accessible depuis le menu Démarrer ou le Dock.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Benefits */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Avantages de l'installation</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">Accès rapide depuis l'écran d'accueil</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">Fonctionne hors-ligne</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">Notifications push</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">Mises à jour automatiques</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">Plein écran sans barre de navigateur</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
