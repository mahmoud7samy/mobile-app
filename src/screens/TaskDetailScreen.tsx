import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getTask, getTasksByCourse, submitTask, type TaskDetail, API_BASE_URL } from '../lib/api';
import { getAuthToken } from '../lib/store';

export default function TaskDetailScreen({ route }: any) {
  const { taskId } = route.params ?? {};
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

  useEffect(() => {
    load();
  }, [taskId]);

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    const token = getAuthToken();
    if (!token) return;
    setDownloadingId(attachmentId);
    try {
      const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
      const path = `${FileSystem.cacheDirectory}${attachmentId}${ext}`;
      const url = `${API_BASE_URL.replace(/\/$/, '')}/api/tasks/attachments/${attachmentId}/download`;
      await FileSystem.downloadAsync(url, path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, {
          mimeType: getMimeType(fileName),
          dialogTitle: fileName,
        });
      } else {
        Alert.alert('Downloaded', `File saved. Path: ${path}`);
      }
    } catch (err: any) {
      const msg = err.message ?? err.response?.data?.message ?? 'Download failed';
      Alert.alert('Download failed', msg);
    } finally {
      setDownloadingId(null);
    }
  };

  const pickAndSubmit = async () => {
    if (!taskId || submitting) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name ?? 'upload',
        type: file.mimeType ?? 'application/octet-stream',
      } as any);
      setSubmitting(true);
      await submitTask(taskId, formData);
      await load();
      Alert.alert('Done', 'Your submission was uploaded successfully.');
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.message ?? 'Submit failed';
      Alert.alert('Submit failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!taskId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing task. Go back and open a task from the list.</Text>
      </View>
    );
  }

  if (loading && !task) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Task not found or you don't have access.</Text>
      </View>
    );
  }

  const deadline = new Date(task.deadline);
  const isOverdue = deadline < new Date();
  const hasSubmission = submission?.submitted === true;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.taskName}>{task.taskName}</Text>
        <Text style={styles.meta}>
          Due {deadline.toLocaleDateString(undefined, { dateStyle: 'medium' })} • {task.totalPoints} points
          {isOverdue && !hasSubmission && (
            <Text style={styles.overdue}> • Overdue</Text>
          )}
        </Text>
      </View>

      {task.description ? (
        <View style={styles.card}>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.description}>{task.description}</Text>
        </View>
      ) : null}

      {task.attachments?.length ? (
        <View style={styles.card}>
          <Text style={styles.label}>Attachments</Text>
          {task.attachments.map((a) => {
            const isDownloading = downloadingId === a.attachmentId;
            return (
              <TouchableOpacity
                key={a.attachmentId}
                style={styles.attachmentRow}
                activeOpacity={0.7}
                onPress={() => downloadAttachment(a.attachmentId, a.fileName)}
                disabled={isDownloading}
              >
                <Text style={styles.attachmentText}>
                  📎 {a.fileName} ({(a.fileSize / 1024).toFixed(1)} KB)
                </Text>
                {isDownloading && <ActivityIndicator size="small" color="#4f46e5" style={{ marginLeft: 8 }} />}
              </TouchableOpacity>
            );
          })}
          <Text style={styles.attachmentNote}>Tap a file to download and open it.</Text>
        </View>
      ) : null}

      {submission?.submitted ? (
        <View style={[styles.card, styles.submittedCard]}>
          <Text style={styles.submittedTitle}>Submitted</Text>
          {submission.submittedAt && (
            <Text style={styles.submittedAt}>
              {new Date(submission.submittedAt).toLocaleString()}
            </Text>
          )}
          {submission.grade != null && (
            <Text style={styles.grade}>
              Grade: {submission.grade} / {task.totalPoints}
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.submitHint}>Submit one file (PDF, Word, image, etc.). You can only submit once.</Text>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={pickAndSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? 'Uploading…' : 'Choose file & submit'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, paddingTop: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6', padding: 24 },
  error: { color: '#dc2626', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  taskName: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 8 },
  meta: { fontSize: 14, color: '#6b7280' },
  overdue: { color: '#dc2626', fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 },
  description: { fontSize: 15, color: '#374151', lineHeight: 22 },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  attachmentText: { fontSize: 14, color: '#374151', flexShrink: 1 },
  attachmentNote: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
  submittedCard: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  submittedTitle: { fontSize: 16, fontWeight: '600', color: '#166534', marginBottom: 4 },
  submittedAt: { fontSize: 14, color: '#15803d', marginBottom: 4 },
  grade: { fontSize: 14, fontWeight: '600', color: '#166534' },
  submitHint: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  submitBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});

function getMimeType(fileName: string): string {
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}
