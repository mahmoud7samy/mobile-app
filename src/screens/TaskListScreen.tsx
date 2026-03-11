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
import { getTasksByCourse, type TaskListItem } from '../lib/api';

function formatDeadline(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d < now) return { text: d.toLocaleDateString(), overdue: true };
  return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), overdue: false };
}

export default function TaskListScreen({ route, navigation }: any) {
  const { courseInstanceId, subjectName, levelName } = route.params ?? {};
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

  useEffect(() => {
    load();
  }, [courseInstanceId]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openTask = (task: TaskListItem) => {
    navigation.navigate('TaskDetail', {
      taskId: task.taskId,
      subjectName: subjectName ?? '',
      levelName: levelName ?? '',
    });
  };

  if (!courseInstanceId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing course. Go back and open Tasks from a course.</Text>
      </View>
    );
  }

  if (loading && tasks.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <FlatList
      data={tasks}
      keyExtractor={(t) => t.taskId}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No tasks for this course yet.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const { text: deadlineText, overdue } = formatDeadline(item.deadline);
        return (
          <TouchableOpacity
            style={styles.row}
            onPress={() => openTask(item)}
            activeOpacity={0.7}
          >
            <View style={styles.rowContent}>
              <Text style={styles.taskName}>{item.taskName}</Text>
              <Text style={styles.meta}>
                Due {deadlineText} • {item.totalPoints} pts
                {item.attachments?.length ? ` • ${item.attachments.length} attachment(s)` : ''}
              </Text>
              {item.submitted && (
                <View style={styles.submittedBadge}>
                  <Text style={styles.submittedText}>
                    Submitted{item.submittedAt ? ` ${new Date(item.submittedAt).toLocaleDateString()}` : ''}
                    {item.grade != null ? ` • Grade: ${item.grade}/${item.totalPoints}` : ''}
                  </Text>
                </View>
              )}
            </View>
            {overdue && !item.submitted && (
              <View style={styles.overdueBadge}>
                <Text style={styles.overdueText}>Overdue</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6', padding: 24 },
  error: { color: '#dc2626', textAlign: 'center' },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowContent: { flex: 1 },
  taskName: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 },
  meta: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  submittedBadge: { marginTop: 6 },
  submittedText: { fontSize: 12, color: '#059669', fontWeight: '500' },
  overdueBadge: { backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  overdueText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
});
