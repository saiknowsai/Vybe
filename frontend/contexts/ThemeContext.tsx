import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, KIDS_THEME_COLORS, KIDS_THEME_RADIUS, Theme, ThemeName, ThemeColors, ThemeRadius } from '../constants/themes';

interface ThemeContextType {
  themeName: ThemeName;
  theme: Theme;
  kidsMode: boolean;
  activeColors: ThemeColors;
  activeRadius: ThemeRadius;
  setTheme: (name: ThemeName) => void;
  toggleKidsMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeName, setThemeName] = useState<ThemeName>('bright_and_fun');
  const [kidsMode, setKidsMode] = useState(false);

  useEffect(() => {
    (async () => {
      const savedTheme = await AsyncStorage.getItem('theme');
      const savedKids = await AsyncStorage.getItem('kidsMode');
      if (savedTheme) setThemeName(savedTheme as ThemeName);
      if (savedKids) setKidsMode(savedKids === 'true');
    })();
  }, []);

  const setTheme = async (name: ThemeName) => {
    setThemeName(name);
    await AsyncStorage.setItem('theme', name);
  };

  const toggleKidsMode = async () => {
    const next = !kidsMode;
    setKidsMode(next);
    await AsyncStorage.setItem('kidsMode', String(next));
  };

  const theme = THEMES[themeName];
  const activeColors = kidsMode ? KIDS_THEME_COLORS : theme.colors;
  const activeRadius = kidsMode ? KIDS_THEME_RADIUS : theme.radius;

  return (
    <ThemeContext.Provider value={{ themeName, theme, kidsMode, activeColors, activeRadius, setTheme, toggleKidsMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
