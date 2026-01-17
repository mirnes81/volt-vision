import { Home, ClipboardList, Calendar, User, Clock } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const { t } = useLanguage();
  
  const navItems = [
    { to: '/dashboard', icon: Home, label: t('nav.home') },
    { to: '/interventions', icon: ClipboardList, label: 'Mes Int.' },
    { to: '/time-tracking', icon: Clock, label: 'Heures' },
    { to: '/calendar', icon: Calendar, label: t('nav.calendar') },
    { to: '/profile', icon: User, label: t('nav.profile') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border safe-bottom">
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
                  isActive && "bg-primary/10"
                )}>
                  <item.icon className={cn("w-5 h-5 transition-all duration-200", isActive && "scale-110")} />
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
