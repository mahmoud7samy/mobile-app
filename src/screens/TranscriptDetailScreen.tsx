import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, StatusBar, TouchableOpacity, Alert, Platform
} from 'react-native';
import { getTranscriptDetail, API_BASE_URL } from '../lib/api';
import { getAuthToken } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function TranscriptDetailScreen({ route }: any) {
  const { transcriptId } = route.params ?? {};
  const { theme: t } = useThemeStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: res } = await getTranscriptDetail(transcriptId);
        setData(res);
      } catch (err) {
        console.error('Failed to load transcript detail', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [transcriptId]);

  const handleDownload = async () => {
    if (!data?.recordingAvailableForDownload) return;
    const token = getAuthToken();
    if (!token) return;

    setDownloading(true);
    try {
      const url = `${API_BASE_URL.replace(/\/$/, '')}/transcripts/${transcriptId}/download-recording`;
      const filename = data.recordingFileName || `recording-${transcriptId}.mp3`;
      
      const docDir = (FileSystem as any).documentDirectory as string;
      const path = `${docDir}${filename}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        path,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const result = await downloadResumable.downloadAsync();
      if (!result || result.status !== 200) throw new Error('Download failed');

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri);
      } else {
        Alert.alert('Downloaded', 'File saved to app storage.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to download recording.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.danger }}>Failed to load transcript.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scroll}>
        
        <View style={styles.header}>
          <Text style={[styles.date, { color: t.textMuted }]}>
            {new Date(data.uploadedAt).toLocaleDateString(undefined, { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}
          </Text>
          <Text style={[styles.title, { color: t.text }]}>Lecture Transcript</Text>
        </View>

        {data.summaryText && (
          <View style={[styles.section, { backgroundColor: t.primary + '08', borderColor: t.primary + '30' }]}>
            <View style={styles.sectionHeader}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>✨</Text>
              <Text style={[styles.sectionTitle, { color: t.primary }]}>AI Summary</Text>
            </View>
            <Text style={[styles.summaryText, { color: t.text }]}>{data.summaryText}</Text>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>📝</Text>
            <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>Full Transcript</Text>
          </View>
          <Text style={[styles.fullText, { color: t.text }]}>{data.transcriptText}</Text>
        </View>

        {data.recordingAvailableForDownload && (
          <TouchableOpacity 
            style={[styles.downloadBtn, { backgroundColor: t.surface, borderColor: t.primary }]}
            onPress={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={t.primary} />
            ) : (
              <>
                <Text style={{ fontSize: 18, marginRight: 8 }}>🎧</Text>
                <Text style={[styles.downloadBtnText, { color: t.primary }]}>Download Recording</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16 },
  header: { marginBottom: 24 },
  date: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800' },
  section: {
    padding: 16, borderRadius: 16, marginBottom: 20,
    borderWidth: 1, borderColor: 'transparent',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  summaryText: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  fullText: { fontSize: 14, lineHeight: 22 },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed',
    marginTop: 8,
  },
  downloadBtnText: { fontSize: 15, fontWeight: '700' },
});
