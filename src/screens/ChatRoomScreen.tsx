import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  getChatMessages,
  sendChatText,
  markChatAsRead,
  type ChatMessage,
} from '../lib/api';
import { useAuthStore } from '../lib/store';

export default function ChatRoomScreen({ route }: any) {
  const { courseInstanceId, subjectName, levelName } = route.params ?? {};
  const userId = useAuthStore((s) => s.user?.userId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = async () => {
    if (!courseInstanceId) return;
    try {
      const { data } = await getChatMessages(courseInstanceId, 100);
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!courseInstanceId) return;
    loadMessages();
    markChatAsRead(courseInstanceId).catch(() => {});
    pollRef.current = setInterval(loadMessages, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [courseInstanceId]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !courseInstanceId) return;
    setSending(true);
    setInput('');
    try {
      const { data } = await sendChatText(courseInstanceId, text);
      setMessages((prev) => [...prev, data]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const isMe = (msg: ChatMessage) => msg.senderUserId === userId;

  if (!courseInstanceId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing course. Go back and open a chat from the list.</Text>
      </View>
    );
  }

  if (loading && messages.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.messageId}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No messages yet. Send one below — it will appear on the web too.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, isMe(item) ? styles.bubbleMe : styles.bubbleThem]}>
            {item.messageType === 'text' && (
              <Text style={[styles.bubbleText, isMe(item) && styles.bubbleTextMe]}>{item.content}</Text>
            )}
            {item.messageType === 'attachment' && (
              <Text style={styles.bubbleText}>📎 {item.attachments?.map((a) => a.fileName).join(', ') || 'Attachment'}</Text>
            )}
            {item.messageType === 'poll' && (
              <Text style={styles.bubbleText}>📊 Poll: {item.pollData?.question || item.content || 'Poll'}</Text>
            )}
            <Text style={[styles.bubbleMeta, isMe(item) && styles.bubbleMetaMe]}>
              {item.senderName} • {formatTime(item.createdAt)}
            </Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor="#9ca3af"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={4000}
          editable={!sending}
          onSubmitEditing={send}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendBtnText}>{sending ? '…' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  list: { padding: 16, paddingBottom: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6', padding: 24 },
  error: { color: '#dc2626', textAlign: 'center' },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#6b7280', textAlign: 'center', fontSize: 14 },
  bubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#4f46e5',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, color: '#111' },
  bubbleTextMe: { color: '#fff' },
  bubbleMeta: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  bubbleMetaMe: { color: 'rgba(255,255,255,0.85)' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
