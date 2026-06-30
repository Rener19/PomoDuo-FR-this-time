import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming, Easing, interpolateColor } from 'react-native-reanimated';
import { useTimerStore } from '@/store/timerStore';
import { useDuoStore } from '@/store/duoStore';
import { useTheme } from '@/hooks/use-theme';

import { Fonts, Colors } from '@/constants/theme';
import { useSettingsStore } from '@/store/settingsStore';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const { width } = Dimensions.get('window');
const defaultSize = Math.min(width * 0.75, 320);

export function TimerRing({ size = defaultSize, strokeWidth = 8 }) {
  const soloState = useTimerStore();
  const duoState = useDuoStore();
  
  // If we're in a duo session, read from duoStore; otherwise use soloStore
  const isDuo = !!duoState.sessionId && !duoState.waitingForFriends;
  const timeLeft = isDuo ? duoState.timeLeft : soloState.timeLeft;
  const totalFocusTime = isDuo ? duoState.focusTime : soloState.totalFocusTime;
  const breakTime = isDuo ? duoState.breakTime : soloState.breakTime;
  const mode = isDuo ? duoState.mode : soloState.mode;
  const isRunning = isDuo ? duoState.isRunning : soloState.isRunning;
  const targetEndTime = isDuo ? duoState.targetEndTime : soloState.targetEndTime;

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const isDarkMode = useSettingsStore(state => state.isDarkMode);
  const themeMode = isDarkMode ? 'dark' : 'light';
  const focusColors = Colors[themeMode].focus;
  const breakColors = Colors[themeMode].break;

  const totalTime = mode === 'focus' ? totalFocusTime * 60 : breakTime * 60;
  let progress = totalTime > 0 ? timeLeft / totalTime : 0;
  if (Number.isNaN(progress) || progress === undefined || progress === null || !Number.isFinite(progress)) {
    progress = 0;
  }

  const strokeDashoffset = useSharedValue(circumference);
  useEffect(() => {
    strokeDashoffset.value = withTiming(circumference * (1 - progress), {
      duration: 1000,
      easing: Easing.linear,
    });
  }, [progress, circumference]);

  const isFocus = mode === 'focus';

  // Animate a shared value between 0 (break) and 1 (focus)
  const modeTransition = useSharedValue(isFocus ? 1 : 0);
  
  useEffect(() => {
    modeTransition.value = withTiming(isFocus ? 1 : 0, { duration: 500 });
  }, [isFocus]);

  const animatedBgCircleProps = useAnimatedProps(() => {
    const stroke = interpolateColor(
      modeTransition.value,
      [0, 1],
      [breakColors.timerCircle, focusColors.timerCircle]
    );
    return { stroke };
  }, [breakColors, focusColors]);

  const animatedProgressProps = useAnimatedProps(() => {
    const stroke = interpolateColor(
      modeTransition.value,
      [0, 1],
      [breakColors.timerProgress, focusColors.timerProgress]
    );
    return {
      strokeDashoffset: strokeDashoffset.value,
      stroke,
    };
  }, [breakColors, focusColors]);

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      color: withTiming(isFocus ? focusColors.timerProgress : breakColors.timerProgress, { duration: 500 }),
    };
  }, [isFocus, focusColors, breakColors]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getEndTimeText = () => {
    if (!isRunning || !targetEndTime) return null;
    const date = new Date(targetEndTime);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={{ position: 'absolute' }}>
        <Svg width={size} height={size}>
          <AnimatedCircle
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            animatedProps={animatedBgCircleProps}
          />
          <AnimatedCircle
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            animatedProps={animatedProgressProps}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
      </Animated.View>

      <View style={styles.textContainer}>
        <Animated.Text style={[styles.timeText, animatedTextStyle]}>
          {formatTime(timeLeft)}
        </Animated.Text>
        <Animated.Text style={[styles.modeText, animatedTextStyle]}>
          {mode === 'focus' ? 'Focus' : 'Break'}
        </Animated.Text>
        {isRunning && targetEndTime && (
          <Text style={[
            styles.endTimeText, 
            { color: isFocus ? focusColors.timerProgress : breakColors.timerProgress, opacity: 0.8 }
          ]}>
            🔔 Ends at {getEndTimeText()}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontFamily: Fonts.serifBold,
    fontSize: 72,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  modeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 2,
  },
  endTimeText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    marginTop: 8,
  },
});
