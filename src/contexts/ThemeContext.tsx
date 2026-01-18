/**
 * Theme Context v6 - Fixed React hook binding
 * @description Provides theme management with light/dark/system modes
 * Last update: Force rebuild for cache invalidation
 */
import * as React from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  actualTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider(props: { children: React.ReactNode }) {
  const { children } = props;
  
  const [theme, setTheme] = React.useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mv3_theme');
      return (saved as Theme) || 'light';
    }
    return 'light';
  });

  const [actualTheme, setActualTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    const root = document.documentElement;
    
    const updateTheme = () => {
      let resolvedTheme: 'light' | 'dark';
      
      if (theme === 'system') {
        resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        resolvedTheme = theme;
      }
      
      setActualTheme(resolvedTheme);
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
    };

    updateTheme();
    localStorage.setItem('mv3_theme', theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);
    
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [theme]);

  const value = React.useMemo(() => ({ theme, actualTheme, setTheme }), [theme, actualTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}