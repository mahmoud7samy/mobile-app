import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { getTasksByCourse, type TaskListItem } from '../lib/api';
import { useThemeStore } from '../lib/themeStore';
import { useAuthStore } from '../lib/store';

function formatDeadline(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d < now) return { text: d.toLocaleDateString(), overdue: true };
  return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), overdue: false };
}

export default function TaskListScreen({ route, navigation }: any) {
  const { courseInstanceId, subjectName, levelName } = route.params ?? {};
  const { theme: t } = useThemeStore();
  const { user } = useAuthStore();
  const isStudent = user?.role === 'student';
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!courseInstanceId) return;
    try {
      const { data } = await getTasksByCourse(courseInstanceId);
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [courseInstanceId]);
  const onRefresh = () => { setRefreshing(true); load(); };
  const openTask = (task: TaskListItem) =>
    navigation.navigate('TaskDetail', { taskId: task.taskId, subjectName: subjectName ?? '', levelName: levelName ?? '' });

  if (!courseInstanceId) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.danger, textAlign: 'center' }}>Missing course. Go back and open Tasks from a course.</Text>
      </View>
    );
  }

  if (loading && tasks.length === 0) {
    return <View style={[styles.centered, { backgroundColor: t.bg }]}><ActivityIndicator size="large" color={t.primary} /></View>;
  }

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      data={tasks}
      keyExtractor={(t) => t.taskId}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.primary]} tintColor={t.primary} />}
      ListEmptyComponent={
        <View style={styles.empty}><Text style={[styles.emptyText, { color: t.textMuted }]}>No tasks for this course yet.</Text></View>
      }
      renderItem={({ item }) => {
        const { text: deadlineText, overdue } = formatDeadline(item.deadline);
        return (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}
            onPress={() => openTask(item)}
            activeOpacity={0.7}
          >
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.taskName, { color: t.text }]}>{item.taskName}</Text>
                <Text style={[styles.meta, { color: t.textMuted }]}>
                  Due {deadlineText}
                </Text>
              </View>
              <View style={[styles.pointsBadge, { backgroundColor: t.primaryLight }]}>
                <Text style={[styles.pointsText, { color: t.primary }]}>{item.totalPoints}pts</Text>
              </View>
            </View>

            <View style={styles.badgeRow}>
              {isStudent && item.submitted && (
                <View style={[styles.badge, { backgroundColor: t.successBg }]}>
                  <Text style={[styles.badgeText, { color: t.success }]}>
                    ✓ Submitted{item.grade != null ? ` · ${item.grade}/${item.totalPoints}` : ''}
                  </Text>
                </View>
              )}
              {isStudent && overdue && !item.submitted && (
                <View style={[styles.badge, { backgroundColor: t.dangerBg }]}>
                  <Text style={[styles.badgeText, { color: t.danger }]}>⚠ Overdue</Text>
                </View>
              )}
              {!isStudent && overdue && (
                <View style={[styles.badge, { backgroundColor: t.surface2 }]}>
                  <Text style={[styles.badgeText, { color: t.textSecondary }]}>Closed</Text>
                </View>
              )}
              {item.attachments?.length ? (
                <View style={[styles.badge, { backgroundColor: t.surface2 }]}>
                  <Text style={[styles.badgeText, { color: t.textMuted }]}>📎 {item.attachments.length}</Text>
                </View>
              ) : null}
            </View>
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
  card: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  taskName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  meta: { fontSize: 13 },
  pointsBadge: { borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  pointsText: { fontSize: 12, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
