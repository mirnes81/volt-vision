/**
 * Theme Context v10 - ES6 imports with proper typing
 */
import * as React from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  actualTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

function getStoredTheme(): Theme {
  try {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('mv3_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {}
  return 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  if (theme === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const storedTheme = getStoredTheme();
  const [theme, setThemeState] = React.useState<Theme>(storedTheme);
  const [actualTheme, setActualTheme] = React.useState<'light' | 'dark'>(resolveTheme(storedTheme));

  React.useEffect(() => {
    const root = document.documentElement;
    const resolved = resolveTheme(theme);
    
    setActualTheme(resolved);
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    
    try {
      localStorage.setItem('mv3_theme', theme);
    } catch {}

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (theme === 'system') {
        const newResolved = mq.matches ? 'dark' : 'light';
        setActualTheme(newResolved);
        root.classList.remove('light', 'dark');
        root.classList.add(newResolved);
      }
    };
    
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const contextValue = React.useMemo<ThemeContextType>(
    () => ({
      theme,
      actualTheme,
      setTheme: setThemeState,
    }),
    [theme, actualTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
