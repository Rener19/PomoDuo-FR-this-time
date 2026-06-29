import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Pressable, ScrollView, AppState, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimerRing } from '@/components/TimerRing';
import { ChatBox } from '@/components/ChatBox';
import { useDuoStore } from '@/store/duoStore';
import { useAuthStore } from '@/store/authStore';
import { Spacing } from '@/constants/theme';
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
    waitingForFriends
  } = useDuoStore();
  const { user } = useAuthStore();
  const { background, text: textColor, primary, secondary, backgroundElement } = useTheme();

  const [showMenu, setShowMenu] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  // Toast state
  const prevParticipantsRef = useRef(participants);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Check if new participants joined
    if (participants.length > prevParticipantsRef.current.length) {
      const newParticipant = participants[participants.length - 1];
      // Exclude self from toast (when creating session)
      if (newParticipant && newParticipant.id !== user?.id) {
        showToast(`${newParticipant.username} joined the session! 👋`);
      }
    }
    // Check if someone left
    if (participants.length < prevParticipantsRef.current.length) {
      const left = prevParticipantsRef.current.find(p => !participants.some(np => np.id === p.id));
      if (left && left.id !== user?.id) {
        showToast(`${left.username} left the session.`);
      }
    }
    prevParticipantsRef.current = participants;
  }, [participants]);

  function showToast(message: string) {
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => {
      setToastMessage(null);
    });
  }

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

  function toggleFriend(friendId: string) {
    setSelectedFriends((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  }

  async function handleSendInvites() {
    if (!user || selectedFriends.length === 0) return;
    await inviteMoreFriends(user.id, selectedFriends);
    setShowInviteModal(false);
    setSelectedFriends([]);
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

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title" style={{ color: textColor, fontSize: 28 }}>
              Duo Session
            </ThemedText>
            <Pressable onPress={() => setShowMenu(true)}>
              <ThemedText style={{ color: textColor, fontSize: 24 }}>☰</ThemedText>
            </Pressable>
          </View>

          {/* Waiting Banner */}
          {waitingForFriends && (
            <View style={{ width: '100%', padding: Spacing.three, backgroundColor: secondary, borderRadius: Spacing.two, marginTop: Spacing.two }}>
              <ThemedText style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>
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

              {/* Time Settings */}
              {!isRunning && (
                <View style={styles.timeSettingsRow}>
                  <View style={styles.timeSetting}>
                    <ThemedText style={{ color: secondary, fontSize: 10, fontWeight: 'bold' }}>FOCUS</ThemedText>
                    <View style={styles.timeAdjuster}>
                      <Pressable onPress={() => setFocusTime(Math.max(1, focusTime - 1))}>
                        <ThemedText style={{ color: textColor, fontSize: 20, paddingHorizontal: 8 }}>-</ThemedText>
                      </Pressable>
                      <ThemedText style={{ color: textColor, fontSize: 16, fontWeight: 'bold', width: 32, textAlign: 'center' }}>
                        {focusTime}
                      </ThemedText>
                      <Pressable onPress={() => setFocusTime(Math.min(120, focusTime + 1))}>
                        <ThemedText style={{ color: textColor, fontSize: 20, paddingHorizontal: 8 }}>+</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.timeSetting}>
                    <ThemedText style={{ color: secondary, fontSize: 10, fontWeight: 'bold' }}>BREAK</ThemedText>
                    <View style={styles.timeAdjuster}>
                      <Pressable onPress={() => setBreakTime(Math.max(1, breakTime - 1))}>
                        <ThemedText style={{ color: textColor, fontSize: 20, paddingHorizontal: 8 }}>-</ThemedText>
                      </Pressable>
                      <ThemedText style={{ color: textColor, fontSize: 16, fontWeight: 'bold', width: 32, textAlign: 'center' }}>
                        {breakTime}
                      </ThemedText>
                      <Pressable onPress={() => setBreakTime(Math.min(60, breakTime + 1))}>
                        <ThemedText style={{ color: textColor, fontSize: 20, paddingHorizontal: 8 }}>+</ThemedText>
                      </Pressable>
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

        {/* Hamburger Menu Modal */}
        <Modal visible={showMenu} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: background }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText type="title" style={{ color: textColor, fontSize: 22 }}>Menu</ThemedText>
                <Pressable onPress={() => setShowMenu(false)}>
                  <ThemedText style={{ color: '#E74C3C', fontWeight: 'bold', fontSize: 16 }}>Close</ThemedText>
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

              <ThemedText style={{ color: textColor, fontWeight: 'bold', marginTop: Spacing.four, marginBottom: Spacing.two, fontSize: 16 }}>
                Participants ({participants.length})
              </ThemedText>
              <View style={{ gap: Spacing.one }}>
                {participants.map(p => (
                  <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#27AE60' }} />
                    <ThemedText style={{ color: textColor }}>
                      {p.username} {p.id === hostId ? '👑' : ''}
                    </ThemedText>
                  </View>
                ))}
              </View>

              {isHost && (
                <Pressable
                  style={[styles.button, { backgroundColor: primary, marginTop: Spacing.four }]}
                  onPress={() => { setShowMenu(false); setShowInviteModal(true); }}
                >
                  <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>+ Invite Friends</ThemedText>
                </Pressable>
              )}

              <Pressable
                style={[styles.buttonSecondary, { borderColor: '#E74C3C', marginTop: Spacing.four }]}
                onPress={() => { setShowMenu(false); handleLeave(); }}
              >
                <ThemedText style={{ color: '#E74C3C', fontWeight: 'bold' }}>Leave Session</ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Invite Friends Modal */}
        <Modal visible={showInviteModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: background }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three }}>
                <ThemedText type="title" style={{ color: textColor, fontSize: 22 }}>Invite Friends</ThemedText>
                <Pressable onPress={() => { setShowInviteModal(false); setSelectedFriends([]); }}>
                  <ThemedText style={{ color: '#E74C3C', fontWeight: 'bold', fontSize: 16 }}>Close</ThemedText>
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
                    const isSelected = selectedFriends.includes(friend.id);
                    return (
                      <Pressable
                        key={friend.id}
                        style={[styles.friendRow, { backgroundColor: isSelected ? primary : backgroundElement }]}
                        onPress={() => toggleFriend(friend.id)}
                      >
                        <ThemedText style={{ color: isSelected ? '#fff' : textColor, fontWeight: 'bold' }}>
                          {friend.username}
                        </ThemedText>
                        <ThemedText style={{ color: isSelected ? '#fff' : secondary, fontSize: 20 }}>
                          {isSelected ? '✓' : '○'}
                        </ThemedText>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>

              {selectedFriends.length > 0 && (
                <Pressable
                  style={[styles.button, { backgroundColor: primary, marginTop: Spacing.three }]}
                  onPress={handleSendInvites}
                >
                  <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                    Send Invites ({selectedFriends.length})
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        </Modal>
        
        {/* Toast Notification */}
        {toastMessage && (
          <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
            <View style={[styles.toastContent, { backgroundColor: '#27AE60' }]}>
              <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>{toastMessage}</ThemedText>
            </View>
          </Animated.View>
        )}
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
  toastContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 200,
  },
  toastContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
