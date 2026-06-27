import React, { useEffect } from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimerRing } from '@/components/TimerRing';
import { ChatBox } from '@/components/ChatBox';
import { useDuoStore } from '@/store/duoStore';
import { useAuthStore } from '@/store/authStore';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface DuoTimerProps {
  onLeave: () => void;
}

export function DuoTimer({ onLeave }: DuoTimerProps) {
  const {
    sessionId, isHost, participants, isRunning, mode, timeLeft,
    startTimer, pauseTimer, resetTimer, switchMode, leaveSession,
    tick, syncFromBackground, isChatEnabled, chatOnlyOnBreak,
    toggleChat, toggleChatOnBreak,
  } = useDuoStore();
  const { user } = useAuthStore();
  const { background, text: textColor, primary, secondary, backgroundElement } = useTheme();

  useEffect(() => {
    syncFromBackground();
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => tick(), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  function handleLeave() {
    if (user) leaveSession(user.id);
    onLeave();
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title" style={{ color: textColor, fontSize: 28 }}>
              Duo Session
            </ThemedText>
            <Pressable onPress={handleLeave}>
              <ThemedText style={{ color: '#E74C3C', fontWeight: 'bold' }}>Leave</ThemedText>
            </Pressable>
          </View>

          {/* Participants */}
          <View style={[styles.participantsBar, { backgroundColor: backgroundElement }]}>
            <ThemedText style={{ color: secondary, fontSize: 12, marginBottom: 4 }}>PARTICIPANTS</ThemedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
              {participants.map(p => (
                <View key={p.id} style={[styles.participantChip, { backgroundColor: primary }]}>
                  <ThemedText style={{ color: background, fontSize: 12, fontWeight: 'bold' }}>
                    {p.username}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>

          {/* Timer */}
          <View style={styles.timerSection}>
            <TimerRing />
          </View>

          {/* Controls — only host can control the timer */}
          {isHost ? (
            <View style={styles.controls}>
              <Pressable
                style={[styles.button, { backgroundColor: primary }]}
                onPress={isRunning ? pauseTimer : startTimer}
              >
                <ThemedText style={{ color: background, fontWeight: 'bold', fontSize: 18, letterSpacing: 1 }}>
                  {isRunning ? 'PAUSE' : 'START'}
                </ThemedText>
              </Pressable>

              <View style={{ flexDirection: 'row', gap: Spacing.two, width: '100%' }}>
                <Pressable
                  style={[styles.buttonSecondary, { borderColor: secondary, flex: 1 }]}
                  onPress={resetTimer}
                >
                  <ThemedText style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }}>RESET</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.buttonSecondary, { borderColor: secondary, flex: 1 }]}
                  onPress={switchMode}
                >
                  <ThemedText style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }}>
                    {mode === 'focus' ? 'BREAK' : 'FOCUS'}
                  </ThemedText>
                </Pressable>
              </View>

              {/* Host chat settings */}
              <View style={[styles.settingsRow, { backgroundColor: backgroundElement }]}>
                <ThemedText style={{ color: textColor, fontSize: 13, fontWeight: 'bold' }}>Chat Settings</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two }}>
                  <Pressable
                    style={[styles.settingChip, isChatEnabled ? { backgroundColor: primary } : { backgroundColor: secondary }]}
                    onPress={() => toggleChat(!isChatEnabled)}
                  >
                    <ThemedText style={{ color: '#fff', fontSize: 11 }}>
                      {isChatEnabled ? '✅ Chat On' : '❌ Chat Off'}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.settingChip, chatOnlyOnBreak ? { backgroundColor: primary } : { backgroundColor: secondary }]}
                    onPress={() => toggleChatOnBreak(!chatOnlyOnBreak)}
                  >
                    <ThemedText style={{ color: '#fff', fontSize: 11 }}>
                      {chatOnlyOnBreak ? '☕ Break Only' : '💬 Anytime'}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.controls}>
              <ThemedText style={{ color: secondary, textAlign: 'center' }}>
                The host controls the timer. Focus and enjoy! 🎯
              </ThemedText>
            </View>
          )}

          {/* Chat */}
          <ChatBox />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    alignItems: 'center',
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: Spacing.three,
  },
  participantsBar: {
    width: '100%',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  participantChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 20,
  },
  timerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
  },
  controls: {
    gap: Spacing.three,
    alignItems: 'center',
    width: '100%',
  },
  button: {
    paddingVertical: Spacing.three,
    borderRadius: 30,
    width: '100%',
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
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
  },
  settingsRow: {
    width: '100%',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  settingChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 20,
  },
});
