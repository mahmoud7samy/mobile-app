import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, StatusBar, TouchableOpacity, Alert, Platform, Slider
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { getTranscriptDetail, API_BASE_URL } from '../lib/api';
import { getAuthToken } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';
import { useFileHandler } from '../lib/useFileHandler';
import { getMimeType } from '../lib/useFileHandler';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';

export default function TranscriptDetailScreen({ route }: any) {
  const { transcriptId } = route.params ?? {};
  const { theme: t } = useThemeStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [audioError, setAudioError] = useState('');
  const { downloadingIds, downloadAndOpen, saveToDevice } = useFileHandler();

  // Audio player state
  const soundRef = useRef<Audio.Sound | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);   // ms
  const [duration, setDuration] = useState(0);   // ms

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
    return () => {
      // Cleanup audio on unmount
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, [transcriptId]);

  const getRecordingUrl = () =>
    `${API_BASE_URL.replace(/\/$/, '')}/api/transcripts/${transcriptId}/download-recording`;

  const getLocalAudioPath = useCallback(() => {
    const fileName = data?.recordingFileName || `recording-${transcriptId}.mp3`;
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '.mp3';
    const cacheDir = `${(FileSystem as any).cacheDirectory}app_files/`;
    return `${cacheDir}${transcriptId}${ext}`;
  }, [data, transcriptId]);

  const ensureAudioDownloaded = useCallback(async (): Promise<string | null> => {
    const localPath = getLocalAudioPath();
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) return localPath;

    const token = getAuthToken();
    if (!token) {
      Alert.alert('Not authenticated');
      return null;
    }

    const cacheDir = `${(FileSystem as any).cacheDirectory}app_files/`;
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });

    const dl = FileSystem.createDownloadResumable(
      getRecordingUrl(),
      localPath,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const result = await dl.downloadAsync();
    if (!result || result.status !== 200) {
      throw new Error(`Server returned ${result?.status}`);
    }
    return result.uri;
  }, [getLocalAudioPath, transcriptId]);

  const onPlaybackUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    setPosition(status.positionMillis ?? 0);
    setDuration(status.durationMillis ?? 0);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
    }
  };

  const handlePlayPause = async () => {
    setAudioError('');
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.pauseAsync();
          } else {
            await soundRef.current.playAsync();
          }
          return;
        }
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      setAudioLoading(true);
      const uri = await ensureAudioDownloaded();
      if (!uri) { setAudioLoading(false); return; }
      setAudioUri(uri);

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        onPlaybackUpdate
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (err: any) {
      setAudioError(err.message || 'Failed to play audio');
      console.error('[AudioPlayer]', err);
    } finally {
      setAudioLoading(false);
    }
  };

  const handleOpenWith = async () => {
    setAudioError('');
    try {
      let fileName = data?.recordingFileName || `recording-${transcriptId}.mp3`;
      if (!fileName.includes('.')) fileName += '.mp3';
      await downloadAndOpen(getRecordingUrl(), transcriptId, fileName);
    } catch (err: any) {
      setAudioError(err.message || 'Failed to open file');
    }
  };

  const handleDownloadDevice = async () => {
    setAudioError('');
    try {
      let fileName = data?.recordingFileName || `recording-${transcriptId}.mp3`;
      if (!fileName.includes('.')) fileName += '.mp3';
      await saveToDevice(getRecordingUrl(), transcriptId, fileName);
    } catch (err: any) {
      setAudioError(err.message || 'Failed to save file');
    }
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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

  audioCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 8, marginBottom: 8,
  },
  audioCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  audioCardTitle: { fontSize: 16, fontWeight: '800' },
  playerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  playBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  seekArea: { flex: 1 },
  progressBar: {
    height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 4,
  },
  progressFill: { height: 4, borderRadius: 2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: { fontSize: 11 },
  errorText: { fontSize: 13, marginBottom: 8, textAlign: 'center' },
  actionBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 10, borderRadius: 12, borderWidth: 1.5,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
});
