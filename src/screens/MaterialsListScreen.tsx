import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Platform
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getMaterials, type MaterialItem, type MaterialsByCourseResponse, API_BASE_URL } from '../lib/api';
import { getAuthToken } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';
import { useFileHandler } from '../lib/useFileHandler';

type SectionItem = { type: 'header'; label: string } | { type: 'material'; material: MaterialItem; section: 'teacher' | 'ta' };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
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

function getFileIcon(fileName: string): { icon: string; color: string } {
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
  if (ext === '.pdf') return { icon: 'PDF', color: '#EF4444' };
  if (['.ppt', '.pptx'].includes(ext)) return { icon: 'PPT', color: '#F97316' };
  if (['.doc', '.docx'].includes(ext)) return { icon: 'DOC', color: '#3B82F6' };
  if (['.xls', '.xlsx'].includes(ext)) return { icon: 'XLS', color: '#10B981' };
  if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) return { icon: 'IMG', color: '#8B5CF6' };
  return { icon: 'FILE', color: '#6B7280' };
}

export default function MaterialsListScreen({ route }: any) {
  const { courseInstanceId } = route.params ?? {};
  const { theme: t } = useThemeStore();
  const [data, setData] = useState<MaterialsByCourseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { downloadingIds, downloadAndOpen, saveToDevice } = useFileHandler();

  const load = async () => {
    if (!courseInstanceId) return;
    try {
      const { data: res } = await getMaterials(courseInstanceId);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [courseInstanceId]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleDownload = async (material: MaterialItem) => {
    const url = `${API_BASE_URL.replace(/\/$/, '')}/api/materials/${material.materialId}/download`;
    await downloadAndOpen(url, material.materialId, material.fileName);
  };

  const handleLongPress = async (material: MaterialItem) => {
    const url = `${API_BASE_URL.replace(/\/$/, '')}/api/materials/${material.materialId}/download`;
    await saveToDevice(url, material.materialId, material.fileName);
  };

  if (!courseInstanceId) return (
    <View style={[styles.centered, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.danger, textAlign: 'center' }}>Missing course. Go back.</Text>
    </View>
  );

  if (loading && !data) return (
    <View style={[styles.centered, { backgroundColor: t.bg }]}><ActivityIndicator size="large" color={t.primary} /></View>
  );

  const teacherMaterials = data?.teacherMaterials ?? [];
  const taMaterials = data?.taMaterials ?? [];
  const sections: SectionItem[] = [];
  if (teacherMaterials.length > 0) {
    sections.push({ type: 'header', label: 'Teacher Materials' });
    teacherMaterials.forEach((m) => sections.push({ type: 'material', material: m, section: 'teacher' }));
  }
  if (taMaterials.length > 0) {
    sections.push({ type: 'header', label: 'TA Materials' });
    taMaterials.forEach((m) => sections.push({ type: 'material', material: m, section: 'ta' }));
  }

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      data={sections}
      keyExtractor={(item) => (item.type === 'header' ? item.label : item.material.materialId)}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.primary]} tintColor={t.primary} />}
      ListEmptyComponent={
        <View style={styles.empty}><Text style={[styles.emptyText, { color: t.textMuted }]}>No materials yet.</Text></View>
      }
      renderItem={({ item }) => {
        if (item.type === 'header') {
          return <Text style={[styles.sectionHeader, { color: t.textMuted }]}>{item.label.toUpperCase()}</Text>;
        }
        const { material } = item;
        const { icon, color } = getFileIcon(material.fileName);
        const isDownloading = downloadingIds.has(material.materialId);
        return (
          <TouchableOpacity
            style={[styles.fileCard, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}
            onPress={() => handleDownload(material)}
            onLongPress={() => handleLongPress(material)}
            disabled={isDownloading}
            activeOpacity={0.7}
          >
            <View style={[styles.typeIcon, { backgroundColor: color + '22' }]}>
              <Text style={[styles.typeText, { color }]}>{icon}</Text>
            </View>
            <View style={styles.fileInfo}>
              <Text style={[styles.fileName, { color: t.text }]} numberOfLines={2}>{material.fileName}</Text>
              <Text style={[styles.fileMeta, { color: t.textMuted }]}>
                {formatSize(material.fileSize)} · {formatDate(material.uploadedAt)}
              </Text>
            </View>
            {isDownloading
              ? <ActivityIndicator size="small" color={t.primary} />
              : <Text style={[styles.openBtn, { color: t.primary }]}>↓</Text>
            }
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  sectionHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  fileCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    padding: 14, marginBottom: 8, borderWidth: 1, gap: 12,
  },
  typeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  fileMeta: { fontSize: 12 },
  openBtn: { fontSize: 22, fontWeight: '700', paddingHorizontal: 4 },
});
