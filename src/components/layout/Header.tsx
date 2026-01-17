import { ChevronLeft, Bell, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { SyncStatusIndicator } from '@/components/sync/SyncStatusIndicator';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showNotifications?: boolean;
  rightAction?: React.ReactNode;
}

export function Header({ title = 'ENES Électricité', showBack = false, showNotifications = false, rightAction }: HeaderProps) {
  const navigate = useNavigate();
  const { actualTheme, setTheme } = useTheme();
  
  const toggleTheme = () => {
    setTheme(actualTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50 safe-top">
      <div className="flex items-center justify-between h-16 px-4 max-w-lg mx-auto">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showBack ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="shrink-0 -ml-2 rounded-xl"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg leading-tight truncate">{title}</h1>
            {!showBack && <p className="text-xs text-muted-foreground">Suite Électricien</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <SyncStatusIndicator />
          
          {showNotifications && (
            <Button variant="ghost" size="icon" className="relative rounded-xl">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            className="rounded-xl"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-border" />
          </Button>
          
          {rightAction}
        </div>
      </div>
    </header>
  );
}
