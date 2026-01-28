import { Home, ClipboardList, CalendarDays, User, Clock } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { useTodayInterventionsCount } from '@/hooks/useTodayInterventionsCount';

export function BottomNav() {
  const { t } = useLanguage();
  const { todayCount } = useTodayInterventionsCount();
  
  const navItems: { to: string; icon: typeof Home; label: string; badge?: number }[] = [
    { to: '/dashboard', icon: Home, label: t('nav.home') },
    { to: '/interventions', icon: ClipboardList, label: 'Mes Int.' },
    { to: '/calendar', icon: CalendarDays, label: 'Planning', badge: todayCount },
    { to: '/time-tracking', icon: Clock, label: 'Heures' },
    { to: '/profile', icon: User, label: t('nav.profile') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border safe-bottom lg:hidden">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex flex-col items-center justify-center flex-1 h-full py-2 text-muted-foreground transition-colors duration-200"
            activeClassName="text-primary"
          >
            {({ isActive }: { isActive: boolean }) => (
              <>
                <div className={cn(
                  "relative p-1.5 rounded-xl transition-all duration-200",
                  isActive && "bg-primary/10",
                  item.badge && item.badge > 0 && "text-red-500"
                )}>
                  <item.icon className={cn("w-5 h-5 transition-all duration-200", isActive && "scale-110")} />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={cn("text-[10px] mt-0.5 font-medium", isActive && "font-semibold")}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
