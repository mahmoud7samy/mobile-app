import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';
import { Ionicons } from '@expo/vector-icons';
import {
  getStudentNotifications, getStudentAnnouncements, getStaffAnnouncements,
  downloadAnnouncementAttachment, API_BASE_URL
} from '../lib/api';
import { useFileHandler } from '../lib/useFileHandler';
import { Alert } from 'react-native';

export default function NotificationsScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const updateLastViewedNotifications = useAuthStore((s) => s.updateLastViewedNotifications);
  const { theme: t, isDark } = useThemeStore();

  const isStudent = user?.role === 'student';

  const [activeTab, setActiveTab] = useState<'notifications' | 'announcements'>(isStudent ? 'notifications' : 'announcements');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  const loadData = async () => {
    try {
      if (isStudent) {
        const [notifsRes, annRes] = await Promise.all([
          getStudentNotifications(),
          getStudentAnnouncements()
        ]);
        setNotifications(notifsRes.data);
        setAnnouncements(annRes.data);
      } else {
        const { data: annRes } = await getStaffAnnouncements();
        setAnnouncements(annRes);
      }
    } catch (err) {
      console.error('Failed to load notifications screen data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      // Update the last viewed timestamp to clear the dashboard red dot
      updateLastViewedNotifications(new Date().toISOString());
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const { downloadingIds, downloadAndOpen, saveToDevice } = useFileHandler();

  const handleDownloadAttachment = async (attachmentId: string, fileName: string) => {
    const url = `${API_BASE_URL.replace(/\/$/, '')}/api/announcements/attachments/${attachmentId}/download`;
    await downloadAndOpen(url, attachmentId, fileName);
  };

  const handleLongPressAttachment = async (attachmentId: string, fileName: string) => {
    const url = `${API_BASE_URL.replace(/\/$/, '')}/api/announcements/attachments/${attachmentId}/download`;
    await saveToDevice(url, attachmentId, fileName);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'material': return <Ionicons name="document-text" size={24} color={t.primary} />;
      case 'task': return <Ionicons name="clipboard" size={24} color={t.primary} />;
      case 'seb': return <Ionicons name="lock-closed" size={24} color={t.primary} />;
      case 'transcript': return <Ionicons name="mic" size={24} color={t.primary} />;
      case 'chat': return <Ionicons name="chatbubble" size={24} color={t.primary} />;
      case 'announcement': return <Ionicons name="megaphone" size={24} color={t.primary} />;
      default: return <Ionicons name="notifications" size={24} color={t.primary} />;
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isAnn = !!item.announcementId;
    const title = item.title;
    const content = item.body || item.content;
    const subtitle = isAnn ? `${item.subjectName || item.levelName || 'Announcement'} • ${item.authorName || item.actorName || ''}` : `${item.actorName || ''} · ${item.subjectName || ''}`;
    const ts = item.createdAt || item.timestamp;
    const dateStr = ts ? new Date(ts).toLocaleString() : '';
    const icon = getIcon(item.type || (isAnn ? 'announcement' : ''));

    return (
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={[styles.iconBox, { backgroundColor: t.surface2 }]}>
          {icon}
        </View>
        <View style={styles.content}>
          {isAnn ? (
            <Text style={[styles.title, { color: t.text }]} numberOfLines={4}>{content}</Text>
          ) : (
            <>
              <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>{title}</Text>
              <Text style={[styles.subtitle, { color: t.textSecondary }]} numberOfLines={2}>{subtitle}</Text>
            </>
          )}
          {isAnn && (
            <Text style={[styles.subtitle, { color: t.textSecondary, marginTop: 4 }]} numberOfLines={1}>{subtitle}</Text>
          )}
          <Text style={[styles.time, { color: t.textMuted }]}>{dateStr}</Text>

          {isAnn && item.attachments && item.attachments.length > 0 && (
            <View style={styles.attachmentsWrap}>
              {item.attachments.map((att: any) => {
                const isDownloading = downloadingIds.has(att.attachmentId);
                return (
                  <TouchableOpacity
                    key={att.attachmentId}
                    style={[styles.attachmentBtn, { backgroundColor: t.primaryLight }]}
                    onPress={() => handleDownloadAttachment(att.attachmentId, att.fileName)}
                    onLongPress={() => handleLongPressAttachment(att.attachmentId, att.fileName)}
                    disabled={isDownloading}
                  >
                    {isDownloading ? <ActivityIndicator size="small" color={t.primary} /> : <Ionicons name="attach" size={14} color={t.primary} />}
                    <Text style={[styles.attachmentText, { color: t.primary }]} numberOfLines={1}>{isDownloading ? 'Opening...' : att.fileName}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  };

  const dataToRender = activeTab === 'notifications' ? notifications : announcements;

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {isStudent && (
        <View style={[styles.tabBar, { borderBottomColor: t.border }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'notifications' && { borderBottomColor: t.primary }]}
            onPress={() => setActiveTab('notifications')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'notifications' ? t.primary : t.textMuted }]}>
              Notifications
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'announcements' && { borderBottomColor: t.primary }]}
            onPress={() => setActiveTab('announcements')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'announcements' ? t.primary : t.textMuted }]}>
              Announcements
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : (
        <FlatList
          data={dataToRender}
          keyExtractor={(it) => it.id || it.announcementId || Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.primary]} tintColor={t.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: t.textMuted }]}>
                {activeTab === 'notifications' ? 'No new notifications.' : 'No announcements available.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '700' },
  listContent: { padding: 16 },
  card: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 20 },
  content: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 8 },
  time: { fontSize: 12 },
  attachmentsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  attachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attachmentText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    maxWidth: 150,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 14 },
});
