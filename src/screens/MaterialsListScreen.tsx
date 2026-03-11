import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getMaterials, type MaterialItem, type MaterialsByCourseResponse, API_BASE_URL } from '../lib/api';
import { getAuthToken } from '../lib/store';

type SectionItem = { type: 'header'; label: string } | { type: 'material'; material: MaterialItem; section: 'teacher' | 'ta' };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function MaterialsListScreen({ route }: any) {
  const { courseInstanceId, subjectName, levelName } = route.params ?? {};
  const [data, setData] = useState<MaterialsByCourseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, [courseInstanceId]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const downloadAndOpen = async (material: MaterialItem) => {
    const token = getAuthToken();
    if (!token) return;
    const url = `${API_BASE_URL.replace(/\/$/, '')}/api/materials/${material.materialId}/download`;
    setDownloadingId(material.materialId);
    try {
      const filename = material.fileName || `material-${material.materialId}`;
      const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
      const path = `${FileSystem.cacheDirectory}${material.materialId}${ext}`;
      await FileSystem.downloadAsync(url, path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, {
          mimeType: getMimeType(filename),
          dialogTitle: material.fileName,
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

  if (!courseInstanceId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing course. Go back and open Materials from a course.</Text>
      </View>
    );
  }

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const teacherMaterials = data?.teacherMaterials ?? [];
  const taMaterials = data?.taMaterials ?? [];
  const sections: SectionItem[] = [];
  if (teacherMaterials.length > 0) {
    sections.push({ type: 'header', label: 'Teacher materials' });
    teacherMaterials.forEach((m) => sections.push({ type: 'material', material: m, section: 'teacher' }));
  }
  if (taMaterials.length > 0) {
    sections.push({ type: 'header', label: 'TA materials' });
    taMaterials.forEach((m) => sections.push({ type: 'material', material: m, section: 'ta' }));
  }

  return (
    <FlatList
      data={sections}
      keyExtractor={(item) => (item.type === 'header' ? item.label : item.material.materialId)}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No materials for this course yet.</Text>
        </View>
      }
      renderItem={({ item }) => {
        if (item.type === 'header') {
          return <Text style={styles.sectionHeader}>{item.label}</Text>;
        }
        const { material, section } = item;
        const isDownloading = downloadingId === material.materialId;
        return (
          <TouchableOpacity
            style={styles.row}
            onPress={() => downloadAndOpen(material)}
            disabled={isDownloading}
            activeOpacity={0.7}
          >
            <View style={styles.rowContent}>
              <Text style={styles.fileName} numberOfLines={2}>{material.fileName}</Text>
              <Text style={styles.meta}>
                {formatSize(material.fileSize)} • {formatDate(material.uploadedAt)}
                {material.materialType ? ` • ${material.materialType}` : ''}
              </Text>
            </View>
            {isDownloading ? (
              <ActivityIndicator size="small" color="#4f46e5" />
            ) : (
              <Text style={styles.openLabel}>Open</Text>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

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

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6', padding: 24 },
  error: { color: '#dc2626', textAlign: 'center' },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 14 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowContent: { flex: 1, marginRight: 12 },
  fileName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 4 },
  meta: { fontSize: 12, color: '#6b7280' },
  openLabel: { fontSize: 14, fontWeight: '600', color: '#4f46e5' },
});
