import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, StatusBar } from 'react-native';
import { useThemeStore } from '../lib/themeStore';
import { getStudentMyGrades } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function StudentGradesScreen({ route }: any) {
  const { courseInstanceId, subjectName, levelName } = route.params ?? {};
  const { theme: t } = useThemeStore();
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (courseInstanceId) {
      loadGrades();
    } else {
      setLoading(false);
    }
  }, [courseInstanceId]);

  const loadGrades = async () => {
    try {
      const { data } = await getStudentMyGrades(courseInstanceId);
      setGrades(data || []);
    } catch (err) {
      console.error('Failed to load grades', err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    let statusColor = t.textMuted;
    let statusText = 'Pending';
    let iconName = 'time-outline';

    if (item.gradeStatus === 'graded') {
      statusColor = t.success;
      statusText = 'Graded';
      iconName = 'checkmark-circle-outline';
    } else if (item.gradeStatus === 'missed') {
      statusColor = t.danger;
      statusText = 'Missed';
      iconName = 'close-circle-outline';
    } else if (item.gradeStatus === 'grading_pending') {
      statusColor = '#F59E0B'; // Amber
      statusText = 'Grading...';
      iconName = 'hourglass-outline';
    }

    return (
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.quizName, { color: t.text }]} numberOfLines={2}>
            {item.quizTitle || item.quizName || 'Unnamed Quiz'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Ionicons name={iconName as any} size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>

        <View style={styles.scoreRow}>
          <View>
            <Text style={[styles.label, { color: t.textMuted }]}>Score</Text>
            <Text style={[styles.score, { color: item.score != null ? t.primary : t.text }]}>
              {item.score != null ? item.score : '-'}/{item.totalPoints}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.label, { color: t.textMuted }]}>Submitted</Text>
            <Text style={[styles.date, { color: t.text }]}>
              {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
        </View>

        {item.feedback ? (
          <View style={[styles.feedbackWrap, { backgroundColor: t.surface2 }]}>
            <Text style={[styles.label, { color: t.textMuted, marginBottom: 4 }]}>Feedback:</Text>
            <Text style={[styles.feedbackText, { color: t.textSecondary }]}>{item.feedback}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.text }]}>My Grades</Text>
        <Text style={[styles.subtitle, { color: t.textMuted }]}>
          {subjectName} {levelName ? `(${levelName})` : ''}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={t.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={grades}
          keyExtractor={(item, index) => item.quizId || String(index)}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: t.textMuted }]}>
              No grades available for this course yet.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  list: {
    padding: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  quizName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    marginBottom: 2,
  },
  score: {
    fontSize: 20,
    fontWeight: '800',
  },
  date: {
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackWrap: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 40,
  },
});
