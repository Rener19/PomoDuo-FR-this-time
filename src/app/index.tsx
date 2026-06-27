import React, { useEffect, useState } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimerRing } from '@/components/TimerRing';
import { DuoTimer } from '@/components/DuoTimer';
import { useTimerStore } from '@/store/timerStore';
import { useDuoStore } from '@/store/duoStore';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const soloTimer = useTimerStore();
  const duoSession = useDuoStore();
  const { background, text: textColor, primary, secondary } = useTheme();

  // If we're in a duo session, show the DuoTimer
  if (duoSession.sessionId) {
    return <DuoTimer onLeave={() => {}} />;
  }

  // Solo mode
  const { isRunning, start, pause, reset, tick, syncFromBackground, mode, switchMode } = soloTimer;

  useEffect(() => {
    syncFromBackground();
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => tick(), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, syncFromBackground, tick]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={[styles.title, { color: textColor }]}>
          PomoDuo
        </ThemedText>
        
        <ThemedView style={[styles.timerContainer, { backgroundColor: 'transparent' }]}>
          <TimerRing />
        </ThemedView>

        <ThemedView style={[styles.controls, { backgroundColor: 'transparent' }]}>
          <Pressable 
            style={[styles.button, { backgroundColor: primary }]} 
            onPress={isRunning ? pause : start}
          >
            <ThemedText style={{ color: background, fontWeight: 'bold', fontSize: 18, letterSpacing: 1 }}>
              {isRunning ? 'PAUSE' : 'START'}
            </ThemedText>
          </Pressable>

          <Pressable 
            style={[styles.buttonSecondary, { borderColor: secondary }]} 
            onPress={reset}
          >
            <ThemedText style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>
              RESET
            </ThemedText>
          </Pressable>
          
          <Pressable 
            style={[styles.buttonSecondary, { borderColor: secondary }]} 
            onPress={switchMode}
          >
            <ThemedText style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>
              SWITCH TO {mode === 'focus' ? 'BREAK' : 'FOCUS'}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: Spacing.four,
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.six,
    flex: 1,
  },
  controls: {
    gap: Spacing.three,
    alignItems: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    borderRadius: 30,
    width: '80%',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 30,
    borderWidth: 2,
    width: '80%',
    alignItems: 'center',
  },
});
