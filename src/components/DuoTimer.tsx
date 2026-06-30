import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Pressable, ScrollView, AppState, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimerRing } from '@/components/TimerRing';
import { ChatBox } from '@/components/ChatBox';
import { useDuoStore } from '@/store/duoStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { ScrollPicker } from './ScrollPicker';
import { Spacing, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import BackgroundTimer from 'react-native-background-timer';
import { safeSetInterval, safeClearInterval } from '@/lib/timerUtils';

interface DuoTimerProps {
  onLeave: () => void;
}

export function DuoTimer({ onLeave }: DuoTimerProps) {
  const {
    sessionId, hostId, isHost, participants, isRunning, mode, timeLeft,
    startTimer, pauseTimer, resetTimer, switchMode, leaveSession,
    tick, syncFromBackground, isChatEnabled, chatOnlyOnBreak,
    focusTime, breakTime, setFocusTime, setBreakTime, inviteMoreFriends,
    sessionStartTime, completedFocusMinutes, completedBreakMinutes,
    waitingForFriends, sentInvites, cancelSentInvite,
    kickedToastMessage, clearKickedToast, kickParticipant,
    hasReceivedInitialSync
  } = useDuoStore();
  const { user } = useAuthStore();
  const theme = useTheme();
  const { background, text: textColor, primary, secondary, backgroundElement, success, destructive } = theme;

  const [showMenu, setShowMenu] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);

  // Toast logic moved to global ToastManager

  useEffect(() => {
    if (showInviteModal && user) loadFriends();
  }, [showInviteModal]);

  async function loadFriends() {
    const { data } = await supabase
      .from('friends')
      .select('*, u1:profiles!friends_user_id_fkey(id, username), u2:profiles!friends_friend_id_fkey(id, username)')
      .or(`user_id.eq.${user?.id},friend_id.eq.${user?.id}`)
      .eq('status', 'accepted');
    if (data) {
      // Filter out friends who are already in the session
      const filtered = data.filter(item => {
        const friend = item.user_id === user?.id ? item.u2 : item.u1;
        if (!friend) return false;
        return !participants.some(p => p.id === friend.id);
      });
      setFriends(filtered);
    }
  }

  async function handleIndividualInvite(friendId: string) {
    if (!user) return;
    await inviteMoreFriends(user.id, [friendId]);
  }

  async function handleCancelInvite(friendId: string) {
    await cancelSentInvite(friendId);
  }

  useEffect(() => {
    syncFromBackground();
    let interval: any;
    if (isRunning) {
      interval = safeSetInterval(() => tick(), 1000);
    }
    return () => safeClearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        syncFromBackground();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [syncFromBackground]);

  function handleLeave() {
    if (user) leaveSession(user.id);
    onLeave();
  }

  const currentElapsedFocus = mode === 'focus' ? Math.floor((focusTime * 60 - timeLeft) / 60) : 0;
  const currentElapsedBreak = mode === 'break' ? Math.floor((breakTime * 60 - timeLeft) / 60) : 0;
  const totalFocus = completedFocusMinutes + currentElapsedFocus;
  const totalBreak = completedBreakMinutes + currentElapsedBreak;

  if (!hasReceivedInitialSync) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: background, justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText style={{ color: textColor, fontFamily: Fonts.sansBold, fontSize: 18, marginBottom: Spacing.four }}>
          Connecting to session...
        </ThemedText>
        <Pressable 
          style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: destructive, borderRadius: 20 }} 
          onPress={handleLeave}
        >
          <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold }}>Cancel</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.responsiveWrapper}>
          <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title" style={[styles.title, { color: primary }]}>
              PomoDuo
            </ThemedText>
            <Pressable 
              onPress={() => setShowMenu(true)}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              style={{ padding: 10, zIndex: 10 }}
            >
              <ThemedText style={{ color: textColor, fontSize: 28 }}>☰</ThemedText>
            </Pressable>
          </View>

          {/* Waiting Banner */}
          {waitingForFriends && (
            <View style={{ width: '100%', padding: Spacing.three, backgroundColor: secondary, borderRadius: Spacing.two, marginTop: Spacing.two }}>
              <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold, textAlign: 'center' }}>
                ⏳ Waiting for friends to join...
              </ThemedText>
            </View>
          )}

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
                <ThemedText style={{ color: background, fontFamily: Fonts.sansBold, fontSize: 18, letterSpacing: 1 }}>
                  {isRunning ? 'PAUSE' : 'START'}
                </ThemedText>
              </Pressable>

              <View style={{ flexDirection: 'row', gap: Spacing.two, width: '100%' }}>
                <Pressable
                  style={[styles.buttonSecondary, { borderColor: secondary, flex: 1 }]}
                  onPress={resetTimer}
                >
                  <ThemedText style={{ color: textColor, fontFamily: Fonts.sansBold, fontSize: 14 }}>RESET</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.buttonSecondary, { borderColor: secondary, flex: 1 }]}
                  onPress={switchMode}
                >
                  <ThemedText style={{ color: textColor, fontFamily: Fonts.sansBold, fontSize: 14 }}>
                    {mode === 'focus' ? 'BREAK' : 'FOCUS'}
                  </ThemedText>
                </Pressable>
              </View>

              {/* Time Settings */}
              {!isRunning && (
                <View style={styles.timeSettingsRow}>
                  <View style={styles.timeSetting}>
                    <ThemedText style={{ color: secondary, fontSize: 10, fontFamily: Fonts.sansBold }}>FOCUS</ThemedText>
                    <View style={{ width: 120, height: 60, marginTop: 4 }}>
                      <ScrollPicker
                        items={Array.from({ length: 60 }, (_, i) => i + 1)}
                        selectedValue={focusTime}
                        onValueChange={(val) => setFocusTime(val)}
                        textColor={textColor}
                        itemWidth={40}
                      />
                    </View>
                  </View>
                  <View style={styles.timeSetting}>
                    <ThemedText style={{ color: secondary, fontSize: 10, fontFamily: Fonts.sansBold }}>BREAK</ThemedText>
                    <View style={{ width: 120, height: 60, marginTop: 4 }}>
                      <ScrollPicker
                        items={Array.from({ length: 60 }, (_, i) => i + 1)}
                        selectedValue={breakTime}
                        onValueChange={(val) => setBreakTime(val)}
                        textColor={textColor}
                        itemWidth={40}
                      />
                    </View>
                  </View>
                </View>
              )}
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
        </View>

        {/* Hamburger Menu Modal */}
        <Modal visible={showMenu} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: background }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText type="title" style={{ color: textColor, fontSize: 22, fontFamily: Fonts.serifBold }}>Menu</ThemedText>
                <Pressable onPress={() => setShowMenu(false)}>
                  <ThemedText style={{ color: destructive, fontFamily: Fonts.sansBold, fontSize: 16 }}>Close</ThemedText>
                </Pressable>
              </View>

              {sessionStartTime && (
                <View style={{ marginTop: Spacing.two, gap: Spacing.one }}>
                  <ThemedText style={{ color: secondary, fontStyle: 'italic' }}>
                    Session running for {Math.floor((Date.now() - sessionStartTime) / 60000)}m
                  </ThemedText>
                  <ThemedText style={{ color: secondary, fontStyle: 'italic' }}>
                    Total Focus Time: {totalFocus}m
                  </ThemedText>
                  <ThemedText style={{ color: secondary, fontStyle: 'italic' }}>
                    Total Break Time: {totalBreak}m
                  </ThemedText>
                </View>
              )}

              <ThemedText style={{ color: textColor, fontFamily: Fonts.sansBold, marginTop: Spacing.four, marginBottom: Spacing.two, fontSize: 16 }}>
                Participants ({participants.length})
              </ThemedText>
              <View style={{ gap: Spacing.one }}>
                {participants.map(p => (
                  <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, paddingVertical: Spacing.one }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: success }} />
                      <ThemedText style={{ color: textColor }}>
                        {p.username} {p.id === hostId ? '👑' : ''}
                      </ThemedText>
                    </View>
                    {isHost && p.id !== user?.id && (
                      <Pressable 
                        style={{ paddingHorizontal: 12, paddingVertical: 4, backgroundColor: destructive, borderRadius: 12 }} 
                        onPress={() => { setShowMenu(false); kickParticipant(p.id, p.username); }}
                      >
                        <ThemedText style={{ color: '#fff', fontSize: 12, fontFamily: Fonts.sansBold }}>Kick</ThemedText>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>

              {isHost && (
                <Pressable
                  style={[styles.button, { backgroundColor: primary, marginTop: Spacing.four }]}
                  onPress={() => { setShowMenu(false); setShowInviteModal(true); }}
                >
                  <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold }}>+ Invite Friends</ThemedText>
                </Pressable>
              )}

              <Pressable
                style={[styles.buttonSecondary, { borderColor: destructive, marginTop: Spacing.four }]}
                onPress={() => { setShowMenu(false); handleLeave(); }}
              >
                <ThemedText style={{ color: destructive, fontFamily: Fonts.sansBold }}>Leave Session</ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Invite Friends Modal */}
        <Modal visible={showInviteModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: background }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three }}>
                <ThemedText type="title" style={{ color: textColor, fontSize: 22, fontFamily: Fonts.serifBold }}>Invite Friends</ThemedText>
                <Pressable onPress={() => setShowInviteModal(false)}>
                  <ThemedText style={{ color: destructive, fontFamily: Fonts.sansBold, fontSize: 16 }}>Close</ThemedText>
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 400 }}>
                {friends.length === 0 ? (
                  <ThemedText style={{ color: secondary, textAlign: 'center', marginTop: Spacing.four }}>
                    No friends yet. Add friends first!
                  </ThemedText>
                ) : (
                  friends.map((item) => {
                    const friend = item.user_id === user?.id ? item.u2 : item.u1;
                    if (!friend) return null;
                    const isInvited = (sentInvites || []).includes(friend.id);
                    return (
                      <ThemedView key={friend.id} type="backgroundElement" style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.two, borderRadius: Spacing.two, marginBottom: Spacing.two }]}>
                        <ThemedText themeColor="text" style={{ fontFamily: Fonts.sansBold, flex: 1 }}>
                          {friend.username}
                        </ThemedText>
                        
                        {isInvited ? (
                          <Pressable style={{ paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.two, backgroundColor: destructive }} onPress={() => handleCancelInvite(friend.id)}>
                            <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold, fontSize: 12 }}>Cancel</ThemedText>
                          </Pressable>
                        ) : (
                          <Pressable style={{ paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.two, backgroundColor: success }} onPress={() => handleIndividualInvite(friend.id)}>
                            <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold, fontSize: 12 }}>Invite</ThemedText>
                          </Pressable>
                        )}
                      </ThemedView>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  responsiveWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
  },
  scrollContent: {
    flexGrow: 1,
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
  title: {
    fontFamily: Fonts.serifBold,
    fontSize: 48,
    letterSpacing: -0.5,
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
    flex: 1,
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: Spacing.two,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  timeSettingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.two,
  },
  timeSetting: {
    alignItems: 'center',
  },
  timeAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  inviteBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  friendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
  },
});
