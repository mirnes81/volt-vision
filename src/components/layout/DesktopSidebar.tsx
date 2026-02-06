import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, ClipboardList, CalendarDays, User, Settings, ChevronLeft, ChevronRight,
  Zap, LogOut, Moon, Sun, Plus, Clock, Package, ScanLine
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTodayInterventionsCount } from '@/hooks/useTodayInterventionsCount';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}

export function DesktopSidebar() {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { worker, logout } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { todayCount } = useTodayInterventionsCount();

  const mainNavItems: NavItem[] = [
    { to: '/dashboard', icon: Home, label: t('nav.home') },
    { to: '/interventions', icon: ClipboardList, label: t('nav.interventions') },
    { to: '/calendar', icon: CalendarDays, label: 'Planning', badge: todayCount },
    { to: '/time-tracking', icon: Clock, label: 'Suivi heures' },
    { to: '/profile', icon: User, label: t('nav.profile') },
  ];

  const bottomNavItems: NavItem[] = [
    { to: '/voucher-scan', icon: ScanLine, label: 'Scan bons de régie' },
    { to: '/catalogs', icon: Package, label: 'Catalogues' },
    { to: '/settings', icon: Settings, label: 'Configuration' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const active = isActive(item.to);
    
    const content = (
      <Link
        to={item.to}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
          active 
            ? "bg-primary text-primary-foreground shadow-md" 
            : "hover:bg-secondary text-muted-foreground hover:text-foreground"
        )}
      >
        <div className="relative">
          <item.icon className={cn(
            "w-5 h-5 shrink-0 transition-transform",
            active && "scale-110"
          )} />
          {/* Badge on collapsed icon */}
          {item.badge && item.badge > 0 && isCollapsed && (
            <span className="absolute -top-2 -right-2 min-w-[16px] h-[16px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full px-0.5">
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
        </div>
        {!isCollapsed && (
          <span className={cn(
            "font-medium truncate",
            active && "font-semibold"
          )}>
            {item.label}
          </span>
        )}
        {item.badge && item.badge > 0 && !isCollapsed && (
          <span className="ml-auto bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full animate-pulse">
            {item.badge}
          </span>
        )}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside className={cn(
      "hidden lg:flex flex-col h-screen bg-card border-r border-border sticky top-0 transition-all duration-300",
      isCollapsed ? "w-[72px]" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-lg truncate">ENES</h1>
              <p className="text-xs text-muted-foreground truncate">Électricité</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Action */}
      {!isCollapsed && (
        <div className="p-4">
          <Link to="/intervention/new">
            <Button className="w-full gap-2 shadow-lg">
              <Plus className="w-4 h-4" />
              Nouvelle intervention
            </Button>
          </Link>
        </div>
      )}
      {isCollapsed && (
        <div className="p-3">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link to="/intervention/new">
                <Button size="icon" className="w-full shadow-lg">
                  <Plus className="w-5 h-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Nouvelle intervention</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => (
          <NavItemComponent key={item.to} item={item} />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-border" />

      {/* Bottom Navigation */}
      <nav className="p-3 space-y-1">
        {bottomNavItems.map((item) => (
          <NavItemComponent key={item.to} item={item} />
        ))}
      </nav>

      {/* Theme Toggle */}
      <div className="p-3 border-t border-border">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 rounded-xl transition-colors",
            "hover:bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 shrink-0" />
          ) : (
            <Moon className="w-5 h-5 shrink-0" />
          )}
          {!isCollapsed && (
            <span className="font-medium">
              {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            </span>
          )}
        </button>
      </div>

      {/* User Section */}
      <div className="p-3 border-t border-border">
        <div className={cn(
          "flex items-center gap-3 p-2 rounded-xl bg-secondary/50",
          isCollapsed && "justify-center"
        )}>
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">
              {worker?.firstName?.[0]}{worker?.name?.[0]}
            </span>
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">
                {worker?.firstName} {worker?.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {worker?.isAdmin ? 'Administrateur' : 'Technicien'}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-secondary transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}
