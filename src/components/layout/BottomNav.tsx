import { Home, ClipboardList, User, Settings } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Accueil' },
  { to: '/interventions', icon: ClipboardList, label: 'Travaux' },
  { to: '/profile', icon: User, label: 'Profil' },
];

export function BottomNav() {
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
                  "p-1.5 rounded-xl transition-all duration-200",
                  isActive && "bg-primary/10"
                )}>
                  <item.icon className={cn(
                    "w-6 h-6 transition-all duration-200",
                    isActive && "scale-110"
                  )} />
                </div>
                <span className={cn(
                  "text-xs mt-0.5 font-medium transition-all duration-200",
                  isActive && "font-semibold"
                )}>
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
