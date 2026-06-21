import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Platform, Modal, KeyboardAvoidingView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getTask, getTasksByCourse, requestTaskUploadUrl, submitTaskRecord, getSubmissionsForGrading, setTaskGrade, getAttendanceReport, type TaskDetail, API_BASE_URL } from '../lib/api';
import { getAuthToken, useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';
import { useFileHandler } from '../lib/useFileHandler';

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
  const { user } = useAuthStore();
  const isStudent = user?.role === 'student';
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [submission, setSubmission] = useState<{ submitted: boolean; submittedAt?: string; grade?: number | null } | null>(null);
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [gradeInput, setGradeInput] = useState('');
  const [gradingSub, setGradingSub] = useState<any>(null);
  const { downloadingIds, downloadAndOpen, saveToDevice } = useFileHandler();

  const load = async () => {
    if (!taskId) return;
    try {
      const { data: taskData } = await getTask(taskId);
      setTask(taskData);
      const courseId = taskData?.courseInstanceId;
      if (courseId) {
        if (isStudent) {
          const { data: list } = await getTasksByCourse(courseId);
          const item = Array.isArray(list) ? list.find((t) => t.taskId === taskId) : null;
          setSubmission(item ? { submitted: item.submitted, submittedAt: item.submittedAt, grade: item.grade } : null);
        } else {
          const [{ data: subs }, { data: report }] = await Promise.all([
            getSubmissionsForGrading(courseId),
            getAttendanceReport(courseId).catch(() => ({ data: { students: [] } }))
          ]);
          setAllSubmissions((subs?.rows || []).filter((s: any) => s.taskId === taskId));
          setEnrolledStudents(report?.students || []);
        }
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

  const handleDownloadAttachment = async (attachmentId: string, fileName: string) => {
    const url = `${API_BASE_URL.replace(/\/$/, '')}/api/tasks/attachments/${attachmentId}/download`;
    await downloadAndOpen(url, attachmentId, fileName);
  };

  const handleLongPressAttachment = async (attachmentId: string, fileName: string) => {
    const url = `${API_BASE_URL.replace(/\/$/, '')}/api/tasks/attachments/${attachmentId}/download`;
    await saveToDevice(url, attachmentId, fileName);
  };

  const pickAndSubmit = async () => {
    if (!taskId || submitting) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setSubmitting(true);

      const mimeType = file.mimeType || getMimeType(file.name || '');
      const originalName = file.name || 'upload';
      const size = file.size || 0;

      // 1. Get presigned URL
      const { data: { url, fileKey } } = await requestTaskUploadUrl({
        taskId,
        originalName,
        contentType: mimeType,
        size,
      });

      // 2. Direct upload using FileSystem
      const uploadRes = await FileSystem.uploadAsync(url, file.uri, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': mimeType },
      });
      if (uploadRes.status !== 200) {
        throw new Error(`Upload failed with status ${uploadRes.status}`);
      }

      // 3. Finalize metadata
      await submitTaskRecord({
        taskId,
        fileKey,
        originalName,
        mimeType,
        size,
      });

      await load();
      Alert.alert('Done', 'Your submission was uploaded successfully.');
    } catch (err: any) {
      Alert.alert('Submit failed', err.response?.data?.message ?? err.message ?? 'Try again');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrade = (sub: any) => {
    setGradingSub(sub);
    setGradeInput(sub.grade?.toString() || '');
    setShowGradeModal(true);
  };

  const submitGrade = async () => {
    if (!gradeInput || isNaN(Number(gradeInput))) {
      Alert.alert('Invalid grade', 'Please enter a valid number.');
      return;
    }
    try {
      setShowGradeModal(false);
      setGradingId(gradingSub.submissionId);
      await setTaskGrade(gradingSub.submissionId, Number(gradeInput));
      Alert.alert('Success', 'Grade updated');
      load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update grade');
    } finally {
      setGradingId(null);
      setGradingSub(null);
    }
  };

  const handleDownloadStudentSubmission = async (sub: any) => {
    const fileName = sub.materialUploaded || `submission_${sub.studentCode || 'unknown'}.bin`;
    const url = `${API_BASE_URL.replace(/\/$/, '')}/api/tasks/submissions/${sub.submissionId}/download`;
    await downloadAndOpen(url, sub.submissionId, fileName);
  };

  const handleLongPressStudentSubmission = async (sub: any) => {
    const fileName = sub.materialUploaded || `submission_${sub.studentCode || 'unknown'}.bin`;
    const url = `${API_BASE_URL.replace(/\/$/, '')}/api/tasks/submissions/${sub.submissionId}/download`;
    await saveToDevice(url, sub.submissionId, fileName);
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
            const isDownloading = downloadingIds.has(a.attachmentId);
            return (
              <TouchableOpacity
                key={a.attachmentId}
                style={[styles.fileRow, { borderColor: t.border }]}
                onPress={() => handleDownloadAttachment(a.attachmentId, a.fileName)}
                onLongPress={() => handleLongPressAttachment(a.attachmentId, a.fileName)}
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

      {!isStudent ? (
        <View style={styles.submissionsSection}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>Submitted ({allSubmissions.length})</Text>
          {allSubmissions.length === 0 ? (
            <Text style={[styles.submitHint, { color: t.textMuted, fontStyle: 'italic' }]}>No submissions yet.</Text>
          ) : (
            allSubmissions.map((sub, idx) => {
              const isDownloading = downloadingIds.has(sub.submissionId);
              return (
                <View key={sub.submissionId || idx} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{sub.studentName || sub.student?.studentName || sub.studentCode}</Text>
                      <Text style={{ color: t.textMuted, fontSize: 12 }}>{new Date(sub.submittedAt || new Date()).toLocaleString()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: sub.grade != null ? t.success : t.danger, fontWeight: '800' }}>
                        {sub.grade != null ? `${sub.grade} / ${task.totalPoints}` : 'Needs Grading'}
                      </Text>
                    </View>
                  </View>

                  {/* Submission Attachment row styled like regular file row */}
                  <TouchableOpacity
                    style={[styles.fileRow, { borderColor: t.border, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: t.bg, borderRadius: 10 }]}
                    onPress={() => handleDownloadStudentSubmission(sub)}
                    onLongPress={() => handleLongPressStudentSubmission(sub)}
                    disabled={isDownloading}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.fileIcon, { backgroundColor: t.primaryLight }]}>
                      <Text>📎</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fileName, { color: t.text }]} numberOfLines={1}>{sub.materialUploaded || 'Attached File'}</Text>
                      <Text style={[styles.fileSize, { color: t.textMuted }]}>Tap to open, Long press to save</Text>
                    </View>
                    {isDownloading
                      ? <ActivityIndicator size="small" color={t.primary} />
                      : <Text style={[styles.openBtn, { color: t.primary }]}>Open</Text>
                    }
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.btnSolid, { backgroundColor: t.primary }]}
                      onPress={() => handleGrade(sub)}
                      disabled={gradingId === sub.submissionId}
                    >
                      {gradingId === sub.submissionId ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{sub.grade != null ? 'Update Grade' : 'Grade'}</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* Missing Submissions */}
          {(() => {
            const missing = enrolledStudents.filter(s => !allSubmissions.find(sub => sub.studentId === s.studentId));
            if (missing.length === 0) return null;
            return (
              <View style={{ marginTop: 24 }}>
                <Text style={[styles.sectionTitle, { color: t.text }]}>Not Submitted ({missing.length})</Text>
                {missing.map((s, idx) => (
                  <View key={s.studentId || idx} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View>
                      <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{s.studentName || s.studentCode}</Text>
                      <Text style={{ color: t.textMuted, fontSize: 12 }}>{s.studentCode}</Text>
                    </View>
                    <View style={[styles.heroBadge, { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8 }]}>
                      <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 12 }}>Missing</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })()}
        </View>
      ) : hasSubmission ? (
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

      {/* Grade Modal for Cross-Platform compatibility */}
      <Modal visible={showGradeModal} transparent={true} animationType="fade" onRequestClose={() => setShowGradeModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.modalTitle, { color: t.text }]}>Grade Submission</Text>
            <Text style={{ color: t.textMuted, marginBottom: 16 }}>Enter grade (out of {task?.totalPoints})</Text>
            
            <TextInput
              style={[styles.modalInput, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
              value={gradeInput}
              onChangeText={setGradeInput}
              keyboardType="numeric"
              placeholder="e.g. 10"
              placeholderTextColor={t.textMuted}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnOutline, { borderColor: t.border, marginRight: 10 }]} onPress={() => setShowGradeModal(false)}>
                <Text style={{ color: t.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSolid, { backgroundColor: t.primary }]} onPress={submitGrade}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  submissionsSection: { marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  btnOutline: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  btnSolid: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 16, padding: 24, borderWidth: 1, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 }, android: { elevation: 5 } }) },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
