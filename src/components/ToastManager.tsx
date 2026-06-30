import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Animated, Modal, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useDuoStore } from '@/store/duoStore';
import { useAuthStore } from '@/store/authStore';
import { Spacing, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ToastManager() {
  const { participants, kickedUserIds, kickedModalVisible, setKickedModalVisible } = useDuoStore();
  const { user } = useAuthStore();
  const theme = useTheme();
  
  const prevParticipantsRef = useRef(participants);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'destructive'>('success');
  const toastOpacity = useRef(new Animated.Value(0)).current;

  function showToast(message: string, type: 'success' | 'destructive' = 'success') {
    setToastMessage(message);
    setToastType(type);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => {
      setToastMessage(null);
    });
  }

  useEffect(() => {
    if (participants.length === 0) {
      // If we left the session, don't show any left messages to ourselves
      prevParticipantsRef.current = [];
      return;
    }

    // Check if new participants joined
    if (participants.length > prevParticipantsRef.current.length) {
      const newParticipant = participants[participants.length - 1];
      // Exclude self from toast (when creating session)
      if (newParticipant && newParticipant.id !== user?.id) {
        showToast(`${newParticipant.username} joined the session! 👋`, 'success');
      }
    }
    // Check if someone left
    if (participants.length < prevParticipantsRef.current.length) {
      const left = prevParticipantsRef.current.find(p => !participants.some(np => np.id === p.id));
      if (left && left.id !== user?.id) {
        if (kickedUserIds.includes(left.id)) {
          showToast(`${left.username} has been kicked.`, 'destructive');
        } else {
          showToast(`${left.username} left the session.`, 'destructive');
        }
      }
    }
    prevParticipantsRef.current = participants;
  }, [participants, kickedUserIds]);

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]} pointerEvents="none">
          <View style={[styles.toastContent, { backgroundColor: toastType === 'destructive' ? theme.destructive : theme.success }]}>
            <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold }}>{toastMessage}</ThemedText>
          </View>
        </Animated.View>
      )}

      {/* Kicked Modal */}
      <Modal visible={kickedModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background, alignItems: 'center' }]}>
            <ThemedText type="title" style={{ color: theme.text, fontSize: 24, fontFamily: Fonts.serifBold, marginBottom: Spacing.three }}>
              Session Ended
            </ThemedText>
            <ThemedText style={{ color: theme.text, textAlign: 'center', marginBottom: Spacing.four }}>
              You have been kicked from the session by the host. You are now back in solo mode.
            </ThemedText>
            <Pressable 
              style={[styles.button, { backgroundColor: theme.primary, width: '100%' }]} 
              onPress={() => setKickedModalVisible(false)}
            >
              <ThemedText style={{ color: '#fff', fontFamily: Fonts.sansBold }}>Okay</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 100, // Above the tab bar
    left: Spacing.four,
    right: Spacing.four,
    alignItems: 'center',
    zIndex: 999,
  },
  toastContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
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
  button: {
    paddingVertical: Spacing.three,
    borderRadius: 30,
    width: '80%',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
});
