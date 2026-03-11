import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { getDashboard, getChatActivity, type ChatActivityItem, type DashboardCourse } from '../lib/api';

type RoomItem = {
  courseInstanceId: string;
  subjectName: string;
  levelName: string;
  teacherName: string;
  taName: string | null;
  preview: string;
  timestamp: string;
};

function mergeCoursesWithActivity(courses: DashboardCourse[], activity: ChatActivityItem[]): RoomItem[] {
  const latestByCourse = new Map<string, ChatActivityItem>();
  for (const a of activity) {
    const existing = latestByCourse.get(a.courseInstanceId);
    if (!existing || new Date(a.timestamp) > new Date(existing.timestamp)) {
      latestByCourse.set(a.courseInstanceId, a);
    }
  }
  return courses.map((c) => {
    const act = latestByCourse.get(c.courseInstanceId);
    const subj = c.subjectName ?? (c as any).subject?.subjectName ?? 'Course';
    const lvl = c.levelName ?? (c as any).level?.levelName ?? '';
    const teacher = c.teacher?.teacherName ?? (c as any).teacher?.teacherName ?? '';
    const ta = c.ta?.taName ?? (c as any).ta?.taName ?? null;
    return {
      courseInstanceId: c.courseInstanceId,
      subjectName: subj,
      levelName: lvl,
      teacherName: teacher,
      taName: ta,
      preview: act?.preview ?? 'No messages yet',
      timestamp: act?.timestamp ?? new Date(0).toISOString(),
    };
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ChatListScreen({ navigation }: any) {
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [dashboardRes, activityRes] = await Promise.all([
        getDashboard(),
        getChatActivity(100),
      ]);
      const courses = dashboardRes.data?.courses ?? [];
      const activity = activityRes.data ?? [];
      const list = mergeCoursesWithActivity(courses, activity);
      setRooms(list);
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openRoom = (item: RoomItem) => {
    navigation.navigate('ChatRoom', {
      courseInstanceId: item.courseInstanceId,
      subjectName: item.subjectName,
      levelName: item.levelName,
    });
  };

  if (loading && rooms.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <FlatList
      data={rooms}
      keyExtractor={(r) => r.courseInstanceId}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No group chats yet. Open a course from the dashboard and start a conversation.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => openRoom(item)} activeOpacity={0.7}>
          <View style={styles.rowContent}>
            <Text style={styles.subject}>{item.subjectName}</Text>
            <Text style={styles.meta}>{item.levelName} • {item.teacherName}{item.taName ? ` / ${item.taName}` : ''}</Text>
            <Text style={styles.preview} numberOfLines={2}>{item.preview}</Text>
          </View>
          <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#6b7280', textAlign: 'center', fontSize: 14 },
  row: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'flex-start',
  },
  rowContent: { flex: 1, marginRight: 12 },
  subject: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 },
  meta: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  preview: { fontSize: 14, color: '#374151' },
  time: { fontSize: 12, color: '#9ca3af' },
});
