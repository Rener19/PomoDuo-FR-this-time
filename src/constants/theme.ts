/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    focus: {
      primary: '#D9381E', // Vermilion Red
      secondary: '#F2A65A', // Warm Amber
      tertiary: '#F5D0C5',
      background: '#FFF9F8',
      backgroundElement: 'rgba(0, 0, 0, 0.06)',
      backgroundSelected: '#FADBD8',
      text: '#2C1E16',
      textSecondary: '#6B4A3E',
      white: '#ffffff',
      timerCircle: '#FADBD8',
      timerProgress: '#D9381E',
      success: '#5C6E61',
      destructive: '#D9381E',
    },
    break: {
      primary: '#1B4965', // Deep Ocean Blue
      secondary: '#62B6CB', // Soft Cyan
      tertiary: '#CAE9FF',
      background: '#F4FAFF',
      backgroundElement: 'rgba(0, 0, 0, 0.06)',
      backgroundSelected: '#CAE9FF',
      text: '#13293D',
      textSecondary: '#415A77',
      white: '#ffffff',
      timerCircle: '#CAE9FF',
      timerProgress: '#1B4965',
      success: '#5C6E61',
      destructive: '#D9381E',
    }
  },
  dark: {
    focus: {
      primary: '#FF6B57', // Bright Vermilion
      secondary: '#FFC28A', // Soft Amber
      tertiary: '#3D2622',
      background: '#1A1110', // Very dark warm tint
      backgroundElement: 'rgba(255, 255, 255, 0.1)',
      backgroundSelected: '#3D2622',
      text: '#FFF1EE',
      textSecondary: '#D9C5C1',
      white: '#ffffff',
      timerCircle: '#3D2622',
      timerProgress: '#FF6B57',
      success: '#8A9E8F',
      destructive: '#FF6B57',
    },
    break: {
      primary: '#5FA8D3', // Bright Ocean Blue
      secondary: '#89C2D9', // Soft Cyan
      tertiary: '#1E3544',
      background: '#0D161B', // Very dark cool tint
      backgroundElement: 'rgba(255, 255, 255, 0.1)',
      backgroundSelected: '#1E3544',
      text: '#E5F2FC',
      textSecondary: '#A7C4D9',
      white: '#ffffff',
      timerCircle: '#1E3544',
      timerProgress: '#5FA8D3',
      success: '#8A9E8F',
      destructive: '#FF6B57',
    }
  },
} as const;

export type ThemeColor = keyof typeof Colors.light.focus;

export const Fonts = Platform.select({
  ios: {
    sans: 'PlusJakartaSans_400Regular',
    sansMedium: 'PlusJakartaSans_500Medium',
    sansBold: 'PlusJakartaSans_700Bold',
    serif: 'Literata_400Regular',
    serifBold: 'Literata_700Bold',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'PlusJakartaSans_400Regular',
    sansMedium: 'PlusJakartaSans_500Medium',
    sansBold: 'PlusJakartaSans_700Bold',
    serif: 'Literata_400Regular',
    serifBold: 'Literata_700Bold',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'PlusJakartaSans_400Regular',
    sansMedium: 'PlusJakartaSans_500Medium',
    sansBold: 'PlusJakartaSans_700Bold',
    serif: 'Literata_400Regular',
    serifBold: 'Literata_700Bold',
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
