import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Platform, StatusBar
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useThemeStore } from '../lib/themeStore';
import {
  getSessionsForAbsenceReasons,
  submitAbsenceReason,
} from '../lib/api';

export default function AbsencesScreen({ route, navigation }: any) {
  const { courseInstanceId, subjectName, levelName } = route.params ?? {};
  const { theme: t } = useThemeStore();
  
  // Data
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State per session
  const [submittingSessionId, setSubmittingSessionId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, DocumentPicker.DocumentPickerAsset | null>>({});

  useEffect(() => {
    if (courseInstanceId) {
      fetchSessions();
    }
  }, [courseInstanceId]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data } = await getSessionsForAbsenceReasons(courseInstanceId);
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load sessions', err);
      Alert.alert('Error', 'Failed to load sessions.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickFile = async (sessionId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFiles(prev => ({ ...prev, [sessionId]: result.assets[0] }));
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick a file.');
    }
  };

  const handleSubmit = async (sessionId: string) => {
    const note = notes[sessionId] || '';
    const file = files[sessionId];

    if (!file && !note.trim()) {
      Alert.alert('Error', 'Please add a note or document.');
      return;
    }
    
    setSubmittingSessionId(sessionId);
    try {
      const formData = new FormData();
      if (note.trim()) formData.append('message', note.trim());
      
      if (file) {
        formData.append('file', {
          uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        } as any);
      }

      await submitAbsenceReason(sessionId, formData);
      Alert.alert('Success', 'Absence reason submitted.');
      
      // Refresh sessions to show updated status
      await fetchSessions();
      
      // Clear form state for this session
      setNotes(prev => ({ ...prev, [sessionId]: '' }));
      setFiles(prev => ({ ...prev, [sessionId]: null }));
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Failed to submit absence reason.';
      Alert.alert('Error', msg);
    } finally {
      setSubmittingSessionId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />
      
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: t.text }]}>{subjectName} - Absences</Text>
        <Text style={[styles.instruction, { color: t.textSecondary }]}>
          Review your attendance sessions and submit a reason or document for missed classes.
        </Text>

        {loading ? (
          <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} size="large" />
        ) : sessions.length === 0 ? (
          <Text style={[styles.emptyText, { color: t.textMuted }]}>
            No closed sessions yet.
          </Text>
        ) : (
          <View style={styles.sessionsList}>
            {sessions.map((s) => (
              <View key={s.sessionId} style={[styles.sessionCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={styles.sessionHeader}>
                  <Text style={[styles.sessionDate, { color: t.text }]}>
                    {formatDate(s.sessionDate)}
                  </Text>
                  <Text style={[styles.sessionStatus, { color: s.status === 'present' ? t.success : t.danger }]}>
                    {s.status === 'present' ? 'Present' : 'Absent'}
                  </Text>
                </View>

                {s.hasSubmission && (
                  <View style={styles.submissionStatus}>
                    <Text style={[styles.submissionText, { color: t.textSecondary }]}>
                      Status: <Text style={{ fontWeight: 'bold' }}>{s.submissionStatus === 'pending' ? 'Pending Review' : s.submissionStatus === 'approved' ? 'Approved' : 'Rejected'}</Text>
                    </Text>
                  </View>
                )}

                {s.canSubmit && (
                  <View style={styles.formContainer}>
                    <TextInput
                      style={[styles.input, { backgroundColor: t.bg, borderColor: t.border, color: t.text }]}
                      placeholder="Optional note..."
                      placeholderTextColor={t.textMuted}
                      value={notes[s.sessionId] || ''}
                      onChangeText={(val) => setNotes(prev => ({ ...prev, [s.sessionId]: val }))}
                    />
                    
                    <View style={styles.fileRow}>
                      <TouchableOpacity 
                        style={[styles.fileBtn, { borderColor: t.border }]} 
                        onPress={() => handlePickFile(s.sessionId)}
                      >
                        <Text style={[styles.fileBtnText, { color: t.primary }]}>Choose File</Text>
                      </TouchableOpacity>
                      <Text style={[styles.fileName, { color: t.textMuted }]} numberOfLines={1}>
                        {files[s.sessionId] ? files[s.sessionId]!.name : 'No file chosen'}
                      </Text>
                    </View>

                    <TouchableOpacity 
                      style={[
                        styles.submitBtn, 
                        { backgroundColor: t.danger, opacity: submittingSessionId === s.sessionId ? 0.6 : 1 }
                      ]}
                      onPress={() => handleSubmit(s.sessionId)}
                      disabled={submittingSessionId === s.sessionId}
                    >
                      {submittingSessionId === s.sessionId ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.submitBtnText}>Submit Reason</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  content: { padding: 16, paddingBottom: 40 },
  instruction: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15 },
  sessionsList: { gap: 16 },
  sessionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sessionStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  submissionStatus: {
    marginTop: 4,
  },
  submissionText: {
    fontSize: 14,
  },
  formContainer: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    paddingTop: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  fileBtn: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 12,
  },
  fileBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileName: {
    flex: 1,
    fontSize: 12,
  },
  submitBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
