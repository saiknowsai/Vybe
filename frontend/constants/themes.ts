export type ThemeName = 'bright_and_fun' | 'clean_and_minimal' | 'bold_and_modern' | 'dark_and_premium';

export interface ThemeColors {
  background: string;
  primary: string;
  secondary: string;
  surface: string;
  surfaceHighlight: string;
  textMain: string;
  textMuted: string;
  border: string;
  error: string;
  success: string;
}

export interface ThemeRadius {
  sm: number;
  md: number;
  lg: number;
  full: number;
}

export interface ThemeShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface Theme {
  name: ThemeName;
  label: string;
  emoji: string;
  colors: ThemeColors;
  radius: ThemeRadius;
  shadow: ThemeShadow;
}

export const THEMES: Record<ThemeName, Theme> = {
  bright_and_fun: {
    name: 'bright_and_fun',
    label: 'Bright & Fun',
    emoji: '🌈',
    colors: {
      background: '#FFFDF7',
      primary: '#FF7A00',
      secondary: '#FFC700',
      surface: '#FFFFFF',
      surfaceHighlight: '#FFF4E6',
      textMain: '#1F1A17',
      textMuted: '#7A6C65',
      border: '#F0EAE1',
      error: '#FF4444',
      success: '#34C759',
    },
    radius: { sm: 8, md: 16, lg: 24, full: 9999 },
    shadow: {
      shadowColor: '#FF7A00',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
  },
  clean_and_minimal: {
    name: 'clean_and_minimal',
    label: 'Clean & Minimal',
    emoji: '⚪',
    colors: {
      background: '#FFFFFF',
      primary: '#000000',
      secondary: '#F5F5F5',
      surface: '#F9F9F9',
      surfaceHighlight: '#EFEFEF',
      textMain: '#000000',
      textMuted: '#666666',
      border: '#E5E5E5',
      error: '#FF4444',
      success: '#34C759',
    },
    radius: { sm: 4, md: 8, lg: 12, full: 9999 },
    shadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },
  bold_and_modern: {
    name: 'bold_and_modern',
    label: 'Bold & Modern',
    emoji: '🔵',
    colors: {
      background: '#F4F4F5',
      primary: '#4338CA',
      secondary: '#10B981',
      surface: '#FFFFFF',
      surfaceHighlight: '#EEF2FF',
      textMain: '#18181B',
      textMuted: '#71717A',
      border: '#D4D4D8',
      error: '#EF4444',
      success: '#10B981',
    },
    radius: { sm: 2, md: 4, lg: 8, full: 9999 },
    shadow: {
      shadowColor: '#000',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 0,
    },
  },
  dark_and_premium: {
    name: 'dark_and_premium',
    label: 'Dark & Premium',
    emoji: '🌑',
    colors: {
      background: '#09090B',
      primary: '#D4AF37',
      secondary: '#27272A',
      surface: '#18181B',
      surfaceHighlight: '#27272A',
      textMain: '#FAFAFA',
      textMuted: '#A1A1AA',
      border: '#3F3F46',
      error: '#EF4444',
      success: '#22C55E',
    },
    radius: { sm: 4, md: 12, lg: 16, full: 9999 },
    shadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 5,
    },
  },
};

export const KIDS_THEME_COLORS: ThemeColors = {
  background: '#E8F9FF',
  primary: '#FF5A5F',
  secondary: '#00D084',
  surface: '#FFFFFF',
  surfaceHighlight: '#FFF0F1',
  textMain: '#2B2B2B',
  textMuted: '#5C5C5C',
  border: '#2B2B2B',
  error: '#FF4444',
  success: '#00D084',
};

export const KIDS_THEME_RADIUS: ThemeRadius = { sm: 16, md: 24, lg: 32, full: 9999 };
