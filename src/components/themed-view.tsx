import { ViewProps } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useIsFocused } from 'expo-router';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();
  const backgroundColor = theme[type ?? 'background'];
  const isFocused = useIsFocused();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withTiming(backgroundColor, { duration: isFocused ? 500 : 0 }),
    };
  }, [backgroundColor, isFocused]);

  return <Animated.View style={[style, animatedStyle]} {...otherProps} />;
}
