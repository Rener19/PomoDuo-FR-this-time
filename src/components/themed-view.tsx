import { ViewProps, StyleSheet } from 'react-native';
import React, { useState } from 'react';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useIsFocused } from 'expo-router';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor | 'transparent';
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();
  const isFocused = useIsFocused();
  
  const flatStyle = StyleSheet.flatten(style) || {};
  const hasExplicitBackground = flatStyle.backgroundColor !== undefined;
  
  const targetBg = type === 'transparent' ? 'transparent' : theme[type ?? 'background'];

  // Store the initial background to prevent Reanimated from reading unparseable native defaults
  const [initialBg] = useState(targetBg);

  const animatedStyle = useAnimatedStyle(() => {
    if (hasExplicitBackground || targetBg === 'transparent') {
      return {};
    }
    return {
      backgroundColor: withTiming(targetBg, { duration: isFocused ? 500 : 0 }),
    };
  }, [hasExplicitBackground, targetBg, isFocused]);

  return <Animated.View style={[{ backgroundColor: initialBg }, style, animatedStyle]} {...otherProps} />;
}
