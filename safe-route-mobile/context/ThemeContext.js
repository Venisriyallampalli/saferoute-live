import React, { createContext, useState, useContext, useEffect } from 'react';
import { Appearance } from 'react-native';

const ThemeContext = createContext();

export const ThemePresets = {
  Ocean: { primary: '#0ea5e9', secondary: '#0284c7', accent: '#7dd3fc' },
  Sunset: { primary: '#f97316', secondary: '#ea580c', accent: '#fdba74' },
  Forest: { primary: '#10b981', secondary: '#059669', accent: '#6ee7b7' },
  Midnight: { primary: '#6366f1', secondary: '#4f46e5', accent: '#a5b4fc' },
  Coral: { primary: '#f43f5e', secondary: '#e11d48', accent: '#fda4af' },
};

export const ThemeProvider = ({ children }) => {
  const [themeName, setThemeName] = useState('Ocean'); // Default theme
  const [isDarkMode, setIsDarkMode] = useState(Appearance.getColorScheme() === 'dark');

  const theme = ThemePresets[themeName];

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      themeName, 
      setThemeName, 
      isDarkMode, 
      setIsDarkMode,
      colors: {
        background: isDarkMode ? '#0f172a' : '#ffffff',
        surface: isDarkMode ? '#1e293b' : '#f8fafc',
        text: isDarkMode ? '#f8fafc' : '#0f172a',
        textMuted: isDarkMode ? '#94a3b8' : '#64748b',
        border: isDarkMode ? '#334155' : '#e2e8f0',
      }
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
