import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useThemeStore } from '../lib/themeStore';
import { useAuthStore } from '../lib/store';
import { getCourseRequirementsMeta } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useFileHandler } from '../lib/useFileHandler';

export default function TeacherRequirementsScreen({ route }: any) {
  const { courseInstanceId, subjectName } = route.params;
  const { theme: t } = useThemeStore();
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { downloadingIds, downloadAndOpen, saveToDevice } = useFileHandler();

  useEffect(() => {
    loadMeta();
  }, []);

  const loadMeta = async () => {
    try {
      const { data } = await getCourseRequirementsMeta(courseInstanceId);
      setMeta(data); // returns null if no doc exists
    } catch (err) {
      console.error('Failed to load requirements meta', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    if (!meta) return;
    const baseUrl = useAuthStore.getState()._hydrated ? 'https://ai-powered-college-platform-production.up.railway.app' : '';
    const url = `${baseUrl}/api/course-requirements/staff/${courseInstanceId}/download`;
    await downloadAndOpen(url, 'requirements_doc', meta.fileName || 'requirements.pdf');
  };

  const handleLongPress = async () => {
    if (!meta) return;
    const baseUrl = useAuthStore.getState()._hydrated ? 'https://ai-powered-college-platform-production.up.railway.app' : '';
    const url = `${baseUrl}/api/course-requirements/staff/${courseInstanceId}/download`;
    await saveToDevice(url, 'requirements_doc', meta.fileName || 'requirements.pdf');
  };

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Text style={[styles.title, { color: t.text }]}>{subjectName} - Requirements</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color={t.primary} style={{ marginTop: 40 }} />
      ) : !meta ? (
        <Text style={[styles.empty, { color: t.textMuted }]}>No requirements document uploaded for this course.</Text>
      ) : (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.iconBox}>
            <Ionicons name="document-text" size={40} color={t.primary} />
          </View>
          <Text style={[styles.fileName, { color: t.text }]}>{meta.fileName}</Text>
          <Text style={[styles.metaData, { color: t.textSecondary }]}>
            Size: {(meta.fileSize / 1024).toFixed(1)} KB
          </Text>
          <Text style={[styles.metaData, { color: t.textSecondary }]}>
            Uploaded: {new Date(meta.uploadedAt).toLocaleDateString()}
          </Text>
          <Text style={[styles.metaData, { color: t.textSecondary, marginBottom: 16, fontStyle: 'italic' }]}>
            Tap to open, Long press to save
          </Text>
          
          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: t.primary }]}
            onPress={handleOpen}
            onLongPress={handleLongPress}
            disabled={downloadingIds.has('requirements_doc')}
          >
            {downloadingIds.has('requirements_doc') ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="open-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.downloadText}>Open Document</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 24 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 16 },
  card: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  fileName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  metaData: {
    fontSize: 14,
    marginBottom: 4,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
  },
  downloadText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

