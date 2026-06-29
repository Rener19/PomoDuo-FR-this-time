import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { useTimerStore } from '@/store/timerStore';
import { useDuoStore } from '@/store/duoStore';
import { useTheme } from '@/hooks/use-theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function TimerRing({ size = 280, strokeWidth = 18 }) {
  const soloState = useTimerStore();
  const duoState = useDuoStore();
  
  // If we're in a duo session, read from duoStore; otherwise use soloStore
  const isDuo = !!duoState.sessionId;
  const timeLeft = isDuo ? duoState.timeLeft : soloState.timeLeft;
  const totalFocusTime = isDuo ? duoState.focusTime : soloState.totalFocusTime;
  const breakTime = isDuo ? duoState.breakTime : soloState.breakTime;
  const mode = isDuo ? duoState.mode : soloState.mode;

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const { timerCircle: timerCircleColor, timerProgress: timerProgressColor } = useTheme();
  
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

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: strokeDashoffset.value,
  }));

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {/* Background Circle */}
        <Circle
          stroke={timerCircleColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* Progress Circle */}
        <AnimatedCircle
          stroke={timerProgressColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.textContainer}>
        <Text style={[styles.timeText, { color: timerProgressColor }]}>
          {formatTime(timeLeft)}
        </Text>
        <Text style={[styles.modeText, { color: timerProgressColor }]}>
          {mode === 'focus' ? 'Focus' : 'Break'}
        </Text>
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
    fontSize: 64,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  modeText: {
    fontSize: 22,
    textTransform: 'uppercase',
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 2,
  },
});
