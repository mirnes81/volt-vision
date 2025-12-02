import { ChevronLeft, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  showNotifications?: boolean;
  rightAction?: React.ReactNode;
}

export function Header({ title, showBack = false, showNotifications = false, rightAction }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 glass border-b border-border safe-top">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="shrink-0 -ml-2"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          <h1 className="text-lg font-bold truncate">{title}</h1>
        </div>
        
        <div className="flex items-center gap-1">
          {showNotifications && (
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            </Button>
          )}
          {rightAction}
        </div>
      </div>
    </header>
  );
}
