import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TextInput, FlatList, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useDuoStore, ChatMessage } from '@/store/duoStore';
import { useAuthStore } from '@/store/authStore';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ChatBox() {
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { chatMessages, sendMessage, isChatEnabled, chatOnlyOnBreak, mode } = useDuoStore();
  const { user } = useAuthStore();
  const { background, backgroundElement, text: textColor, primary, secondary } = useTheme();

  // Determine if chat is currently active
  const isChatActive = isChatEnabled && (!chatOnlyOnBreak || mode === 'break');

  function handleSend() {
    if (!text.trim() || !user) return;
    const username = user.email?.split('@')[0] || 'User';
    sendMessage(user.id, username, text.trim());
    setText('');
  }

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (chatMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chatMessages.length]);

  if (!isChatActive) {
    return (
      <View style={[styles.container, { backgroundColor: backgroundElement }]}>
        <View style={styles.disabledContainer}>
          <ThemedText style={{ color: secondary, textAlign: 'center' }}>
            {!isChatEnabled ? '💬 Chat is disabled by the host' : '💬 Chat is only available during break time'}
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: backgroundElement }]}
    >
      <ThemedText style={{ color: textColor, fontWeight: 'bold', marginBottom: Spacing.two }}>
        💬 Chat
      </ThemedText>

      <FlatList
        ref={flatListRef}
        data={chatMessages}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        renderItem={({ item }: { item: ChatMessage }) => {
          const isMe = item.userId === user?.id;
          return (
            <View style={[styles.messageBubble, isMe ? { backgroundColor: primary, alignSelf: 'flex-end' } : { backgroundColor: secondary, alignSelf: 'flex-start' }]}>
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
        }}
        ListEmptyComponent={
          <ThemedText style={{ color: secondary, textAlign: 'center', marginTop: Spacing.four }}>
            No messages yet. Say hello! 👋
          </ThemedText>
        }
      />

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
    </KeyboardAvoidingView>
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
  messageList: {
    flex: 1,
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
