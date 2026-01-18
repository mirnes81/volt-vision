/**
 * Theme Context v11 - Minimal implementation
 * Uses simple state without complex initialization
 */
import * as React from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  actualTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextType>({
  theme: 'light',
  actualTheme: 'light',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>('light');
  const [actualTheme, setActualTheme] = React.useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = React.useState(false);

  // Initialize theme after mount to avoid hydration issues
  React.useEffect(() => {
    const saved = localStorage.getItem('mv3_theme') as Theme | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      setTheme(saved);
    }
    setMounted(true);
  }, []);

  // Update actual theme when theme changes
  React.useEffect(() => {
    if (!mounted) return;
    
    const root = document.documentElement;
    let resolved: 'light' | 'dark' = 'light';
    
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      resolved = theme;
    }
    
    setActualTheme(resolved);
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    localStorage.setItem('mv3_theme', theme);
  }, [theme, mounted]);

  // Listen for system theme changes
  React.useEffect(() => {
    if (!mounted || theme !== 'system') return;
    
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? 'dark' : 'light';
      setActualTheme(resolved);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(resolved);
    };
    
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, mounted]);

  const value = React.useMemo(() => ({
    theme,
    actualTheme,
    setTheme,
  }), [theme, actualTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return React.useContext(ThemeContext);
}
