import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar
} from 'react-native';
import { getCourseTranscripts } from '../lib/api';
import { useThemeStore } from '../lib/themeStore';

export default function TranscriptListScreen({ route, navigation }: any) {
  const { courseInstanceId } = route.params ?? {};
  const { theme: t } = useThemeStore();
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!courseInstanceId) return;
    try {
      const { data } = await getCourseTranscripts(courseInstanceId);
      setTranscripts(data);
    } catch (err) {
      console.error('Failed to load transcripts', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [courseInstanceId]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading && !transcripts.length) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />
      <FlatList
        data={transcripts}
        keyExtractor={(item) => item.transcriptId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.primary]} tintColor={t.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>No transcripts available for this course yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}
            onPress={() => navigation.navigate('TranscriptDetail', { transcriptId: item.transcriptId })}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: t.primary + '15' }]}>
              <Text style={{ fontSize: 20 }}>📜</Text>
            </View>
            <View style={styles.info}>
              <Text style={[styles.label, { color: t.text }]}>{item.label}</Text>
              <View style={styles.badges}>
                {item.hasSummary && (
                  <View style={[styles.badge, { backgroundColor: t.success + '20' }]}>
                    <Text style={[styles.badgeText, { color: t.success }]}>AI Summary</Text>
                  </View>
                )}
                {item.recordingAvailableForDownload && (
                  <View style={[styles.badge, { backgroundColor: t.primary + '20' }]}>
                    <Text style={[styles.badgeText, { color: t.primary }]}>Audio Avail.</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={{ color: t.textMuted, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    padding: 16, marginBottom: 12, borderWidth: 1, gap: 12,
  },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  label: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800' },
});
