import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getTask, getTasksByCourse, submitTask, type TaskDetail, API_BASE_URL } from '../lib/api';
import { getAuthToken } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';

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

export default function TaskDetailScreen({ route }: any) {
  const { taskId } = route.params ?? {};
  const { theme: t } = useThemeStore();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [submission, setSubmission] = useState<{ submitted: boolean; submittedAt?: string; grade?: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = async () => {
    if (!taskId) return;
    try {
      const { data: taskData } = await getTask(taskId);
      setTask(taskData);
      const courseId = taskData?.courseInstanceId;
      if (courseId) {
        const { data: list } = await getTasksByCourse(courseId);
        const item = Array.isArray(list) ? list.find((t) => t.taskId === taskId) : null;
        setSubmission(item ? { submitted: item.submitted, submittedAt: item.submittedAt, grade: item.grade } : null);
      } else {
        setSubmission(null);
      }
    } catch {
      setTask(null);
      setSubmission(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [taskId]);

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    const token = getAuthToken();
    if (!token) return;
    setDownloadingId(attachmentId);
    try {
      const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docDir = (FileSystem as any).documentDirectory as string;
      const dirInfo = await FileSystem.getInfoAsync(docDir + 'downloads/');
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(docDir + 'downloads/', { intermediates: true });
      }

      const path = `${docDir}downloads/${attachmentId}${ext}`;
      const url = `${API_BASE_URL.replace(/\/$/, '')}/api/tasks/attachments/${attachmentId}/download`;
      
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        path,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const result = await downloadResumable.downloadAsync();
      
      if (!result || result.status !== 200) {
         throw new Error(`Server returned ${result?.status}`);
      }

      const mimeType = getMimeType(fileName);

      if (Platform.OS === 'android') {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const base64 = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
            const newUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, mimeType);
            await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });
            Alert.alert('Success', `File saved to ${fileName}`);
          } else {
            await Sharing.shareAsync(result.uri, { mimeType, dialogTitle: fileName });
          }
        } catch (e: any) {
          Alert.alert('Device Save Failed', e.message || 'Error saving file. Sharing instead.');
          await Sharing.shareAsync(result.uri, { mimeType, dialogTitle: fileName });
        }
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(result.uri, { mimeType, dialogTitle: fileName });
        } else {
          Alert.alert('Downloaded', `Saved to App Data: ${result.uri}`);
        }
      }
    } catch (err: any) {
      console.error('Download error details:', err);
      Alert.alert('Download failed', err.message ?? 'Try again');
    } finally {
      setDownloadingId(null);
    }
  };

  const pickAndSubmit = async () => {
    if (!taskId || submitting) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      const formData = new FormData();
      formData.append('file', { uri: file.uri, name: file.name ?? 'upload', type: file.mimeType ?? 'application/octet-stream' } as any);
      setSubmitting(true);
      await submitTask(taskId, formData);
      await load();
      Alert.alert('Done', 'Your submission was uploaded successfully.');
    } catch (err: any) {
      Alert.alert('Submit failed', err.response?.data?.message ?? err.message ?? 'Try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (!taskId) return (
    <View style={[styles.centered, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.danger, textAlign: 'center' }}>Missing task. Go back and open a task.</Text>
    </View>
  );

  if (loading && !task) return (
    <View style={[styles.centered, { backgroundColor: t.bg }]}><ActivityIndicator size="large" color={t.primary} /></View>
  );

  if (!task) return (
    <View style={[styles.centered, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.danger, textAlign: 'center' }}>Task not found.</Text>
    </View>
  );

  const deadline = new Date(task.deadline);
  const isOverdue = deadline < new Date();
  const hasSubmission = submission?.submitted === true;

  return (
    <ScrollView style={[styles.container, { backgroundColor: t.bg }]} contentContainerStyle={styles.content}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{task.taskName}</Text>
        <View style={styles.heroBadges}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>🕐 {deadline.toLocaleDateString(undefined, { dateStyle: 'medium' })}</Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>⭐ {task.totalPoints} pts</Text>
          </View>
          {isOverdue && !hasSubmission && (
            <View style={[styles.heroBadge, { backgroundColor: 'rgba(239,68,68,0.3)' }]}>
              <Text style={[styles.heroBadgeText, { color: '#FCA5A5' }]}>⚠ Overdue</Text>
            </View>
          )}
        </View>
      </View>

      {task.description ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}>
          <Text style={[styles.label, { color: t.primary }]}>DESCRIPTION</Text>
          <Text style={[styles.description, { color: t.text }]}>{task.description}</Text>
        </View>
      ) : null}

      {task.attachments?.length ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}>
          <Text style={[styles.label, { color: t.primary }]}>ATTACHMENTS</Text>
          {task.attachments.map((a) => {
            const isDownloading = downloadingId === a.attachmentId;
            return (
              <TouchableOpacity
                key={a.attachmentId}
                style={[styles.fileRow, { borderColor: t.border }]}
                onPress={() => downloadAttachment(a.attachmentId, a.fileName)}
                disabled={isDownloading}
                activeOpacity={0.7}
              >
                <View style={[styles.fileIcon, { backgroundColor: t.primaryLight }]}>
                  <Text>📎</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fileName, { color: t.text }]} numberOfLines={1}>{a.fileName}</Text>
                  <Text style={[styles.fileSize, { color: t.textMuted }]}>{(a.fileSize / 1024).toFixed(1)} KB</Text>
                </View>
                {isDownloading
                  ? <ActivityIndicator size="small" color={t.primary} />
                  : <Text style={[styles.openBtn, { color: t.primary }]}>Open</Text>
                }
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {hasSubmission ? (
        <View style={[styles.card, { backgroundColor: t.successBg, borderColor: t.success + '44', ...t.shadow }]}>
          <Text style={[styles.submittedTitle, { color: t.success }]}>✓ Submitted</Text>
          {submission?.submittedAt && (
            <Text style={[styles.submittedMeta, { color: t.success }]}>{new Date(submission.submittedAt).toLocaleString()}</Text>
          )}
          {submission?.grade != null && (
            <Text style={[styles.grade, { color: t.success }]}>Grade: {submission.grade} / {task.totalPoints}</Text>
          )}
        </View>
      ) : isOverdue ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}>
          <Text style={[styles.submitHint, { color: t.danger, fontWeight: '700', textAlign: 'center' }]}>
            This task is closed for submissions because the deadline has passed.
          </Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}>
          <Text style={[styles.submitHint, { color: t.textMuted }]}>Submit one file (PDF, Word, image). You can only submit once.</Text>
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: t.primary, opacity: submitting ? 0.7 : 1 }]}
            onPress={pickAndSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.submitBtnText}>{submitting ? 'Uploading…' : '📤  Choose File & Submit'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hero: {
    backgroundColor: '#6C63FF', borderRadius: 20, padding: 20, marginBottom: 14,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12, lineHeight: 28 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5 },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  card: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  description: { fontSize: 15, lineHeight: 22 },
  fileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  fileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 14, fontWeight: '600' },
  fileSize: { fontSize: 12, marginTop: 1 },
  openBtn: { fontSize: 13, fontWeight: '700' },
  submittedTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  submittedMeta: { fontSize: 14, marginBottom: 4 },
  grade: { fontSize: 15, fontWeight: '700' },
  submitHint: { fontSize: 13, marginBottom: 14, lineHeight: 18 },
  submitBtn: { borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
