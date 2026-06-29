import React, { useState, useRef } from 'react';
import { StyleSheet, View, TextInput, ScrollView, Pressable, Modal } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useDuoStore, ChatMessage } from '@/store/duoStore';
import { useAuthStore } from '@/store/authStore';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ChatBox() {
  const [text, setText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const { chatMessages, sendMessage, isChatEnabled, chatOnlyOnBreak, mode, isHost, toggleChat, toggleChatOnBreak } = useDuoStore();
  const { user } = useAuthStore();
  const { background, backgroundElement, text: textColor, primary, secondary } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  // Determine if chat is currently active
  const isChatActive = isChatEnabled && (!chatOnlyOnBreak || mode === 'break');

  function handleSend() {
    if (!text.trim() || !user) return;
    const username = user.email?.split('@')[0] || 'User';
    sendMessage(user.id, username, text.trim());
    setText('');
  }

  // Auto-scroll is handled by ScrollView's onContentSizeChange

  return (
    <View style={[styles.container, { backgroundColor: backgroundElement }]}>
      <View style={styles.header}>
        <ThemedText style={{ color: textColor, fontWeight: 'bold' }}>
          💬 Chat
        </ThemedText>
        {isHost && (
          <Pressable onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
            <ThemedText style={{ color: textColor, fontSize: 16 }}>⚙️</ThemedText>
          </Pressable>
        )}
      </View>

      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: background }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three }}>
              <ThemedText type="title" style={{ color: textColor, fontSize: 20 }}>Chat Settings</ThemedText>
              <Pressable onPress={() => setShowSettings(false)}>
                <ThemedText style={{ color: '#E74C3C', fontWeight: 'bold' }}>Close</ThemedText>
              </Pressable>
            </View>
            <View style={{ gap: Spacing.three }}>
              <Pressable
                style={[styles.settingChip, isChatEnabled ? { backgroundColor: primary } : { backgroundColor: secondary }]}
                onPress={() => toggleChat(!isChatEnabled)}
              >
                <ThemedText style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>
                  {isChatEnabled ? '✅ Chat On' : '❌ Chat Off'}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.settingChip, chatOnlyOnBreak ? { backgroundColor: primary } : { backgroundColor: secondary }]}
                onPress={() => toggleChatOnBreak(!chatOnlyOnBreak)}
              >
                <ThemedText style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>
                  {chatOnlyOnBreak ? '☕ Break Only' : '💬 Anytime'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {!isChatActive ? (
        <View style={styles.disabledContainer}>
          <ThemedText style={{ color: secondary, textAlign: 'center' }}>
            {!isChatEnabled ? '💬 Chat is disabled by the host' : '💬 Chat is only available during break time'}
          </ThemedText>
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messageList}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {chatMessages.length === 0 ? (
              <ThemedText style={{ color: secondary, textAlign: 'center', marginTop: Spacing.four }}>
                No messages yet. Say hello! 👋
              </ThemedText>
            ) : (
              chatMessages.map((item: ChatMessage) => {
                const isMe = item.userId === user?.id;
                return (
                  <View key={item.id} style={[styles.messageBubble, isMe ? { backgroundColor: primary, alignSelf: 'flex-end' } : { backgroundColor: secondary, alignSelf: 'flex-start' }]}>
                    {!isMe && (
                      <ThemedText style={{ color: background, fontSize: 10, fontWeight: 'bold', marginBottom: 2 }}>
                        {item.username}
                      </ThemedText>
                    )}
                    <ThemedText style={{ color: isMe ? background : '#fff', fontSize: 14 }}>
                      {item.text}
                    </ThemedText>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { borderColor: secondary, color: textColor }]}
              value={text}
              onChangeText={setText}
              placeholder="Type a message..."
              placeholderTextColor={secondary}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <Pressable style={[styles.sendBtn, { backgroundColor: primary }]} onPress={handleSend}>
              <ThemedText style={{ color: background, fontWeight: 'bold' }}>Send</ThemedText>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    maxHeight: 300,
    width: '100%',
  },
  disabledContainer: {
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  settingsBtn: {
    padding: Spacing.one,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    padding: Spacing.four,
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
    paddingBottom: Spacing.six,
  },
  settingChip: {
    paddingVertical: Spacing.two,
    borderRadius: 20,
  },
  messageList: {
    height: 200,
    marginBottom: Spacing.two,
  },
  messageBubble: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 16,
    marginBottom: Spacing.one,
    maxWidth: '80%',
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  sendBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
  },
});
