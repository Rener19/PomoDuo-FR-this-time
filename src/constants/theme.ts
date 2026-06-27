/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    primary: '#054A91', // Primary Dark Blue
    secondary: '#3E7CB1', // Secondary Blue
    tertiary: '#81A4CD', // Soft Light Blue
    background: '#DBE4EE', // Light Background
    backgroundElement: '#ffffff',
    backgroundSelected: '#81A4CD',
    text: '#054A91',
    textSecondary: '#3E7CB1',
    white: '#ffffff',
    timerCircle: '#81A4CD',
    timerProgress: '#054A91',
  },
  dark: {
    primary: '#81A4CD',
    secondary: '#3E7CB1',
    tertiary: '#054A91',
    background: '#121212', // Dark background for dark mode
    backgroundElement: '#1E1E1E',
    backgroundSelected: '#3E7CB1',
    text: '#DBE4EE',
    textSecondary: '#81A4CD',
    white: '#ffffff',
    timerCircle: '#3E7CB1',
    timerProgress: '#81A4CD',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
