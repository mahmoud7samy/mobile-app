import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, Alert
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { getChatMessages, sendChatText, sendChatAttachments, sendChatPoll, voteChatPoll, markChatAsRead, type ChatMessage } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

function VoiceMessagePlayer({ uri, isMe, t, token }: { uri: string, isMe: boolean, t: any, token: string | null }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  async function playSound() {
    if (isPlaying && sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
      return;
    }
    if (sound) {
      await sound.playAsync();
      setIsPlaying(true);
      return;
    }
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      { shouldPlay: true }
    );
    newSound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.isLoaded && status.didJustFinish) {
        setIsPlaying(false);
        newSound.setPositionAsync(0);
      }
    });
    setSound(newSound);
    setIsPlaying(true);
  }

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  return (
    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : t.surface2, padding: 10, borderRadius: 16, minWidth: 150, marginTop: 4 }} onPress={playSound}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isMe ? '#fff' : t.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={isPlaying ? "pause" : "play"} size={16} color={isMe ? t.primary : '#fff'} />
      </View>
      <Text style={{ color: isMe ? '#fff' : t.text, marginLeft: 10, flex: 1, fontSize: 13, fontWeight: '700' }}>{isPlaying ? "Playing..." : "Voice Message"}</Text>
    </TouchableOpacity>
  );
}

function getMimeType(fileName: string): string {
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
  const map: Record<string, string> = {
    '.pdf': 'application/pdf', '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

export default function ChatRoomScreen({ route }: any) {
  const { courseInstanceId, subjectName, levelName } = route.params ?? {};
  const userId = useAuthStore((s) => s.user?.userId);
  const { theme: t } = useThemeStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const perms = await Audio.requestPermissionsAsync();
      if (perms.status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone recording permission is required to send voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async (cancel = false) => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      setIsRecording(false);
      const uri = recording.getURI();
      setRecording(null);

      if (cancel || !uri) return;

      const token = useAuthStore.getState().token;
      const formData = new FormData();
      formData.append('files', {
        uri: uri,
        name: 'voice_message.m4a',
        type: 'audio/m4a',
      } as any);

      setSending(true);
      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, '')}/api/chat/rooms/${courseInstanceId}/messages/attachments`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Server error ${response.status}`);
      }
      const data = await response.json();
      setMessages((prev: ChatMessage[]) => [...prev, data]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    } catch (err: any) {
      console.error('Recording stop failed', err);
      Alert.alert('Error', err.message || 'Could not send voice message');
    } finally {
      setSending(false);
    }
  };

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
    markChatAsRead(courseInstanceId).catch(() => { });
    pollRef.current = setInterval(loadMessages, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [courseInstanceId]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !courseInstanceId) return;
    setSending(true);
    setInput('');
    try {
      const { data } = await sendChatText(courseInstanceId, text);
      setMessages((prev: ChatMessage[]) => [...prev, data]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const pickFile = async () => {
    setShowAttachmentMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !courseInstanceId) return;

      const file = result.assets[0];
      const token = useAuthStore.getState().token;

      const formData = new FormData();
      formData.append('files', {
        uri: file.uri,
        name: file.name ?? 'upload',
        type: file.mimeType ?? 'application/octet-stream',
      } as any);

      setSending(true);

      // Use native fetch instead of axios — axios fails with content:// URIs on Android
      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, '')}/api/chat/rooms/${courseInstanceId}/messages/attachments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            // Do NOT set Content-Type — let fetch set it with the boundary automatically
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`Server error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      setMessages((prev: ChatMessage[]) => [...prev, data]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not send file');
    } finally {
      setSending(false);
    }
  };


  const createPoll = async () => {
    const q = pollQuestion.trim();
    const opts = pollOptions.map((o: string) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) {
      Alert.alert('Invalid Poll', 'Please enter a question and at least 2 options.');
      return;
    }
    setShowPollModal(false);
    setSending(true);
    try {
      const { data } = await sendChatPoll(courseInstanceId, q, opts);
      setMessages((prev: ChatMessage[]) => [...prev, data]);
      setPollQuestion('');
      setPollOptions(['', '']);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      Alert.alert('Poll failed', err.message || 'Could not create poll');
    } finally {
      setSending(false);
    }
  };

  const handleVote = async (messageId: string, optionIndex: number) => {
    try {
      // Optimistically update UI
      setMessages((prev: ChatMessage[]) => prev.map((m: ChatMessage) => {
        if (m.messageId !== messageId || !m.pollData) return m;
        const newVotes = { ...(m.pollData.votes || {}) };
        newVotes[userId!] = optionIndex;
        return { ...m, pollData: { ...m.pollData, votes: newVotes } };
      }));
      await voteChatPoll(messageId, optionIndex);
    } catch (err) {
      // Revert on fail
      loadMessages();
    }
  };

  const downloadAttachment = async (attachment: { attachmentId: string; fileName: string }) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    setDownloadingId(attachment.attachmentId);
    try {
      const ext = attachment.fileName.includes('.') ? attachment.fileName.slice(attachment.fileName.lastIndexOf('.')) : '';

      const docDir = (FileSystem as any).documentDirectory as string;
      const dirInfo = await FileSystem.getInfoAsync(docDir + 'downloads/');
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(docDir + 'downloads/', { intermediates: true });
      }

      const path = `${docDir}downloads/${attachment.attachmentId}${ext}`;
      const url = `${API_BASE_URL.replace(/\/$/, '')}/api/chat/attachments/${attachment.attachmentId}/download`;

      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        path,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const result = await downloadResumable.downloadAsync();

      if (!result || result.status !== 200) {
        throw new Error(`Server returned ${result?.status}`);
      }

      const mimeType = getMimeType(attachment.fileName);

      if (Platform.OS === 'android') {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const base64 = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
            const newUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, attachment.fileName, mimeType);
            await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });
            Alert.alert('Success', `File saved to ${attachment.fileName}`);
          } else {
            await Sharing.shareAsync(result.uri, { mimeType, dialogTitle: attachment.fileName });
          }
        } catch (e: any) {
          Alert.alert('Device Save Failed', e.message || 'Error saving file. Sharing instead.');
          await Sharing.shareAsync(result.uri, { mimeType, dialogTitle: attachment.fileName });
        }
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(result.uri, { mimeType, dialogTitle: attachment.fileName });
        } else {
          Alert.alert('Downloaded', `Saved to App Data: ${result.uri}`);
        }
      }
    } catch (err: any) {
      Alert.alert('Download failed', err.message ?? 'Try again');
    } finally {
      setDownloadingId(null);
    }
  };

  const isMe = (msg: ChatMessage) => msg.senderUserId === userId;

  if (!courseInstanceId) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.danger, textAlign: 'center' }}>Missing course. Go back and open a chat.</Text>
      </View>
    );
  }

  if (loading && messages.length === 0) {
    return <View style={[styles.centered, { backgroundColor: t.bg }]}><ActivityIndicator size="large" color={t.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.bg }]}
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
            <Text style={[styles.emptyText, { color: t.textMuted }]}>No messages yet. Be the first!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = isMe(item);
          return (
            <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
              {!mine && <Text style={[styles.senderName, { color: t.primary }]}>{item.senderName}</Text>}
              <View style={[
                styles.bubble,
                mine
                  ? { backgroundColor: t.primary }
                  : { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1 },
              ]}>
                {item.messageType === 'text' && (
                  <Text style={[styles.bubbleText, { color: mine ? '#fff' : t.text }]}>{item.content}</Text>
                )}

                {item.messageType === 'attachment' && item.attachments?.map((a: { attachmentId: string, fileName: string, fileSize: number }) => {
                  const ext = a.fileName.includes('.') ? a.fileName.slice(a.fileName.lastIndexOf('.')).toLowerCase() : '';
                  if (ext === '.m4a' || a.fileName === 'voice_message.m4a') {
                    const token = useAuthStore.getState().token;
                    const url = `${API_BASE_URL.replace(/\/$/, '')}/api/chat/attachments/${a.attachmentId}/download`;
                    return <VoiceMessagePlayer key={a.attachmentId} uri={url} isMe={mine} t={t} token={token} />;
                  }

                  const isDownloading = downloadingId === a.attachmentId;
                  const fileIcon: Record<string, string> = {
                    '.pdf': '📄', '.doc': '📝', '.docx': '📝',
                    '.ppt': '📊', '.pptx': '📊', '.xls': '📊', '.xlsx': '📊',
                    '.txt': '📃', '.zip': '🗜️', '.rar': '🗜️',
                    '.mp4': '🎬', '.mp3': '🎵', '.jpg': '🖼️', '.jpeg': '🖼️', '.png': '🖼️',
                  };
                  const icon = fileIcon[ext] ?? '📎';
                  const sizeLabel = a.fileSize >= 1024 * 1024
                    ? `${(a.fileSize / (1024 * 1024)).toFixed(1)} MB`
                    : `${(a.fileSize / 1024).toFixed(1)} KB`;
                  return (
                    <TouchableOpacity
                      key={a.attachmentId}
                      style={[
                        styles.attachmentBubble,
                        mine ? { backgroundColor: 'rgba(255,255,255,0.15)' } : { backgroundColor: t.surface2, borderColor: t.border, borderWidth: 1 },
                      ]}
                      onPress={() => downloadAttachment(a)}
                      disabled={isDownloading}
                    >
                      <Text style={styles.attachmentIcon}>{icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.attachmentName, { color: mine ? '#fff' : t.text }]} numberOfLines={2}>{a.fileName}</Text>
                        <Text style={[styles.attachmentMeta, { color: mine ? 'rgba(255,255,255,0.7)' : t.textMuted }]}>
                          {sizeLabel} · {isDownloading ? 'Downloading…' : 'Tap to open'}
                        </Text>
                      </View>
                      {isDownloading && <ActivityIndicator size="small" color={mine ? '#fff' : t.primary} style={{ marginLeft: 8 }} />}
                    </TouchableOpacity>
                  );
                })}

                {item.messageType === 'poll' && item.pollData && (
                  <View style={{ width: 220 }}>
                    <Text style={[styles.bubbleText, { color: mine ? '#fff' : t.text, fontWeight: 'bold', marginBottom: 8 }]}>
                      📊 {item.pollData.question}
                    </Text>
                    {item.pollData.options.map((opt: string, idx: number) => {
                      const votes = item.pollData!.votes || {};
                      const totalVotes = Object.keys(votes).length;
                      const optVotes = Object.values(votes).filter((v: any) => v === idx).length;
                      const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                      const hasVoted = !!votes[userId!];
                      const myVote = votes[userId!] === idx;

                      return (
                        <TouchableOpacity
                          key={idx}
                          disabled={hasVoted}
                          onPress={() => handleVote(item.messageId, idx)}
                          style={[
                            styles.pollOptionBtn,
                            mine ? { borderColor: 'rgba(255,255,255,0.4)' } : { borderColor: t.border },
                            myVote && (mine ? { backgroundColor: 'rgba(255,255,255,0.2)' } : { backgroundColor: t.primaryLight })
                          ]}
                        >
                          {hasVoted && (
                            <View style={[styles.pollResultBar, { width: `${pct}%`, backgroundColor: mine ? 'rgba(255,255,255,0.2)' : t.surface2 }]} />
                          )}
                          <View style={styles.pollResultRow}>
                            <Text style={[{ color: mine ? '#fff' : t.text, flex: 1, zIndex: 1, fontSize: 14 }, myVote && { fontWeight: 'bold' }]}>
                              {opt}
                            </Text>
                            {hasVoted && (
                              <Text style={{ color: mine ? 'rgba(255,255,255,0.9)' : t.textMuted, fontSize: 12, zIndex: 1, marginLeft: 8 }}>
                                {pct}%
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <Text style={[styles.bubbleMeta, { color: mine ? 'rgba(255,255,255,0.7)' : t.textMuted }]}>
                  {new Date(item.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.inputRow, { backgroundColor: t.surface, borderTopColor: t.border }]}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={() => setShowAttachmentMenu(true)}
          disabled={sending}
        >
          <Text style={[styles.attachIcon, { color: t.primary }]}>+</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { backgroundColor: t.surface2, color: t.text, borderColor: t.border }]}
          placeholder={isRecording ? "Recording... (Hold cancel button)" : "Message..."}
          placeholderTextColor={isRecording ? t.danger : t.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={4000}
          editable={!sending && !isRecording}
          onSubmitEditing={send}
        />
        {input.trim() ? (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: t.primary, opacity: sending ? 0.5 : 1 }]}
            onPress={send}
            disabled={sending}
          >
            <Ionicons name="send" size={16} color="#fff" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: isRecording ? t.danger : t.primary, opacity: sending ? 0.5 : 1 }]}
            onPress={isRecording ? () => stopRecording(false) : startRecording}
            onLongPress={isRecording ? () => stopRecording(true) : undefined}
            disabled={sending}
          >
            <Ionicons name={isRecording ? "stop" : "mic"} size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={showAttachmentMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachmentMenu(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAttachmentMenu(false)}>
          <View style={[styles.menuContainer, { backgroundColor: t.surface, borderColor: t.border }]}>
            <TouchableOpacity style={styles.menuItem} onPress={pickFile}>
              <Text style={styles.menuIcon}>📎</Text>
              <Text style={[styles.menuText, { color: t.text }]}>Send File</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: t.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setShowAttachmentMenu(false);
              setShowPollModal(true);
            }}>
              <Text style={styles.menuIcon}>📊</Text>
              <Text style={[styles.menuText, { color: t.text }]}>Create Poll</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Poll Creation Modal */}
      <Modal
        visible={showPollModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPollModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.pollModalContent, { backgroundColor: t.bg }]}>
            <View style={[styles.pollHeader, { borderBottomColor: t.border }]}>
              <Text style={[styles.pollTitle, { color: t.text }]}>Create Poll</Text>
              <TouchableOpacity onPress={() => setShowPollModal(false)}>
                <Text style={{ color: t.textMuted, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ key: 'q' } as any, ...pollOptions.map((_: any, i: number) => ({ key: `opt${i}`, index: i }))]}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                if (item.key === 'q') return (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ color: t.text, fontWeight: '600', marginBottom: 8 }}>Question</Text>
                    <TextInput
                      style={[styles.pollInput, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
                      placeholder="Ask a question..."
                      placeholderTextColor={t.textMuted}
                      value={pollQuestion}
                      onChangeText={setPollQuestion}
                    />
                  </View>
                );
                const i = item.index!;
                return (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: t.textMuted, fontSize: 13, marginBottom: 4 }}>Option {i + 1}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        style={[styles.pollInput, { flex: 1, backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
                        placeholder={`Option ${i + 1}`}
                        placeholderTextColor={t.textMuted}
                        value={pollOptions[i]}
                        onChangeText={(t) => {
                          const newer = [...pollOptions];
                          newer[i] = t;
                          setPollOptions(newer);
                        }}
                      />
                      {pollOptions.length > 2 && (
                        <TouchableOpacity style={{ padding: 10 }} onPress={() => setPollOptions(pollOptions.filter((_: any, idx: number) => idx !== i))}>
                          <Text style={{ color: t.danger, fontSize: 20 }}>×</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
              ListFooterComponent={
                <View style={{ marginTop: 8 }}>
                  {pollOptions.length < 5 && (
                    <TouchableOpacity
                      style={[styles.addOptionBtn, { borderColor: t.border }]}
                      onPress={() => setPollOptions([...pollOptions, ''])}
                    >
                      <Text style={{ color: t.primary }}>+ Add Option</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.submitPollBtn, { backgroundColor: t.primary, opacity: pollQuestion.trim() && pollOptions.filter((o: string) => o.trim()).length >= 2 ? 1 : 0.5 }]}
                    onPress={createPoll}
                    disabled={!pollQuestion.trim() || pollOptions.filter((o: string) => o.trim()).length < 2}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Send Poll</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  bubbleWrap: { marginBottom: 10, maxWidth: '80%' },
  bubbleWrapMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: { fontSize: 11, fontWeight: '700', marginBottom: 3, paddingLeft: 4 },
  bubble: { padding: 12, borderRadius: 18, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleMeta: { fontSize: 10, marginTop: 4 },
  attachmentBubble: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, marginTop: 4, minWidth: 180 },
  attachmentIcon: { fontSize: 28, marginRight: 10 },
  attachmentName: { fontSize: 14, fontWeight: '600', lineHeight: 18, marginBottom: 3 },
  attachmentMeta: { fontSize: 11 },
  pollWrap: { marginTop: 4, padding: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12 },
  pollOptionBtn: { padding: 8, borderRadius: 8, borderWidth: 1, marginBottom: 6, position: 'relative', overflow: 'hidden' },
  pollResultRow: { flexDirection: 'row', alignItems: 'center' },
  pollResultBar: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 21,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
    marginRight: 8, borderWidth: 1,
  },
  attachBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  attachIcon: { fontSize: 28, fontWeight: '400', lineHeight: 32 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuContainer: { margin: 16, marginBottom: Platform.OS === 'ios' ? 40 : 24, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuIcon: { fontSize: 24, marginRight: 16 },
  menuText: { fontSize: 16, fontWeight: '600' },
  menuDivider: { height: 1, width: '100%' },
  pollModalContent: { height: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  pollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  pollTitle: { fontSize: 18, fontWeight: 'bold' },
  pollInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  addOptionBtn: { padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', marginBottom: 24 },
  submitPollBtn: { padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 32 },
});
