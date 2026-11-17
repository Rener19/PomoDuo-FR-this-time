import { Platform, StyleSheet, TextProps } from 'react-native';
import React, { useState } from 'react';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { useIsFocused } from 'expo-router';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  
  const flatStyle = StyleSheet.flatten(style) || {};
  const typeMap: Record<string, ThemeColor> = {
    default: 'text',
    title: 'text',
    small: 'text',
    smallBold: 'text',
    subtitle: 'textSecondary',
    link: 'primary',
    linkPrimary: 'primary',
    code: 'textSecondary',
  };

  const hasExplicitColor = flatStyle.color !== undefined;
  const colorKey = typeMap[type ?? 'default'] ?? 'text';
  const textColor = theme?.[themeColor ?? colorKey] ?? theme?.text ?? '#ffffff';

  // Store the initial color to prevent Reanimated from reading unparseable Android native defaults
  const [initialColor] = useState(textColor);
  const colorSV = useSharedValue(textColor);

  React.useEffect(() => {
    colorSV.value = withTiming(textColor, { duration: 400 });
  }, [textColor]);

  const animatedStyle = useAnimatedStyle(() => {
    if (hasExplicitColor) {
      return {};
    }
    return {
      color: colorSV.value,
    };
  }, [hasExplicitColor]);

  return (
    <Animated.Text
      style={[
        { color: initialColor },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
        !hasExplicitColor && animatedStyle,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    lineHeight: 20,
  },
  default: {
    fontFamily: Fonts.sansMedium,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: Fonts.serifBold,
    fontSize: 48,
    lineHeight: 52,
  },
  subtitle: {
    fontFamily: Fonts.serifBold,
    fontSize: 32,
    lineHeight: 44,
  },
  link: {
    fontFamily: Fonts.sans,
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
