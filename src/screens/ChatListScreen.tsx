import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDashboard, getChatActivity, getChatUnread, type ChatActivityItem, type DashboardCourse } from '../lib/api';
import { useThemeStore } from '../lib/themeStore';

type RoomItem = {
  courseInstanceId: string;
  subjectName: string;
  levelName: string;
  teacherName: string;
  taName: string | null;
  preview: string;
  timestamp: string;
  unreadCount: number;
};

function mergeCoursesWithActivity(
  courses: DashboardCourse[],
  activity: ChatActivityItem[],
  unread: { courseInstanceId: string; unreadCount: number }[],
): RoomItem[] {
  const latestByCourse = new Map<string, ChatActivityItem>();
  for (const a of activity) {
    const existing = latestByCourse.get(a.courseInstanceId);
    if (!existing || new Date(a.timestamp) > new Date(existing.timestamp)) {
      latestByCourse.set(a.courseInstanceId, a);
    }
  }
  const unreadMap = new Map<string, number>();
  for (const u of unread) unreadMap.set(u.courseInstanceId, u.unreadCount);

  const items: RoomItem[] = courses.map((c) => {
    const act = latestByCourse.get(c.courseInstanceId);
    return {
      courseInstanceId: c.courseInstanceId,
      subjectName: c.subjectName ?? 'Course',
      levelName: c.levelName ?? '',
      teacherName: c.teacher?.teacherName ?? '',
      taName: c.ta?.taName ?? null,
      preview: act?.preview ?? 'No messages yet',
      timestamp: act?.timestamp ?? new Date(0).toISOString(),
      unreadCount: unreadMap.get(c.courseInstanceId) ?? 0,
    };
  });

  // Sort: unread rooms first, then by most recent message
  return items.sort((a, b) => {
    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const AVATAR_COLORS = ['#6C63FF', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#EF4444'];

export default function ChatListScreen({ navigation }: any) {
  const { theme: t } = useThemeStore();
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [dashboardRes, activityRes, unreadRes] = await Promise.all([
        getDashboard(),
        getChatActivity(100),
        getChatUnread(),
      ]);
      const courses = dashboardRes.data?.courses ?? [];
      const activity = activityRes.data ?? [];
      const unread = unreadRes.data ?? [];
      setRooms(mergeCoursesWithActivity(courses, activity, unread));
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Reload every time user comes back to this screen (e.g. after reading a chat)
  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(); };
  const openRoom = (item: RoomItem) =>
    navigation.navigate('ChatRoom', { courseInstanceId: item.courseInstanceId, subjectName: item.subjectName, levelName: item.levelName });

  if (loading && rooms.length === 0) {
    return <View style={[styles.centered, { backgroundColor: t.bg }]}><ActivityIndicator size="large" color={t.primary} /></View>;
  }

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      data={rooms}
      keyExtractor={(r) => r.courseInstanceId}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.primary]} tintColor={t.primary} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: t.textMuted }]}>No group chats yet.</Text>
        </View>
      }
      renderItem={({ item, index }) => {
        const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
        const initials = item.subjectName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        const hasUnread = item.unreadCount > 0;
        return (
          <TouchableOpacity
            style={[
              styles.row,
              { backgroundColor: t.surface, borderColor: hasUnread ? t.primary : t.border, ...t.shadow },
              hasUnread && { borderLeftWidth: 3, borderLeftColor: t.primary, backgroundColor: t.primary + '0D' },
            ]}
            onPress={() => openRoom(item)}
            activeOpacity={0.7}
          >
            <View style={[styles.avatar, { backgroundColor: color + '22' }]}>
              <Text style={[styles.avatarText, { color }]}>{initials}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.subject, { color: t.text, fontWeight: hasUnread ? '800' : '700' }]}>
                {item.subjectName}
              </Text>
              <Text style={[styles.meta, { color: t.textMuted }]}>
                {item.levelName}{item.teacherName ? ` · ${item.teacherName}` : ''}{item.taName ? ` / ${item.taName}` : ''}
              </Text>
              <Text
                style={[styles.preview, { color: hasUnread ? t.text : t.textSecondary, fontWeight: hasUnread ? '600' : '400' }]}
                numberOfLines={1}
              >
                {item.preview}
              </Text>
            </View>
            <View style={styles.rightCol}>
              <Text style={[styles.time, { color: hasUnread ? t.primary : t.textMuted, fontWeight: hasUnread ? '700' : '500' }]}>
                {formatTime(item.timestamp)}
              </Text>
              {hasUnread && (
                <View style={[styles.badge, { backgroundColor: t.primary }]}>
                  <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  row: {
    flexDirection: 'row', borderRadius: 16, padding: 14,
    marginBottom: 10, borderWidth: 1, alignItems: 'center',
  },
  avatar: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '800' },
  rowContent: { flex: 1, marginRight: 8 },
  subject: { fontSize: 15, marginBottom: 2 },
  meta: { fontSize: 11, marginBottom: 3 },
  preview: { fontSize: 13 },
  rightCol: { alignItems: 'flex-end', gap: 6 },
  time: { fontSize: 11 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
