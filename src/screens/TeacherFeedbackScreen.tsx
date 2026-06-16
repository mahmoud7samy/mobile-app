import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useThemeStore } from '../lib/themeStore';
import { getCourseFeedback } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function TeacherFeedbackScreen({ route }: any) {
  const { courseInstanceId, subjectName } = route.params;
  const { theme: t } = useThemeStore();
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      const { data } = await getCourseFeedback(courseInstanceId);
      setFeedback(data);
    } catch (err) {
      console.error('Failed to load feedback', err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.header}>
        <Ionicons name="chatbubble-outline" size={20} color={t.textSecondary} style={{ marginRight: 8 }} />
        <Text style={[styles.date, { color: t.textSecondary }]}>
          {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <Text style={[styles.message, { color: t.text }]}>{item.message}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Text style={[styles.title, { color: t.text }]}>{subjectName} - Feedback</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color={t.primary} style={{ marginTop: 40 }} />
      ) : feedback.length === 0 ? (
        <Text style={[styles.empty, { color: t.textMuted }]}>No feedback received yet.</Text>
      ) : (
        <FlatList
          data={feedback}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 30 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 16 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    fontSize: 13,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
});
