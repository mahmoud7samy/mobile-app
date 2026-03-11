import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getDashboard, type DashboardResponse, type DashboardCourse } from '../lib/api';
import { useAuthStore } from '../lib/store';

export default function DashboardScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const { data: res } = await getDashboard();
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
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const isStudent = user?.role === 'student';
  const stats = data?.stats ?? {};
  const courses = data?.courses ?? [];
  const scoreBySubject = data?.scoreBySubject ?? [];
  const recentScores = data?.recentScores ?? [];
  const leaderboard = data?.leaderboard ?? [];
  const student = data?.student;
  const levelName = student?.levelName ?? '';
  const studentName = student?.studentName ?? user?.profileName ?? user?.username ?? '';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />
      }
    >
      {/* Welcome */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>
          Welcome back, {studentName}
        </Text>
        <Text style={styles.welcomeSub}>
          {levelName}{levelName ? ' • ' : ''}{courses.length} enrolled course{courses.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity
          style={styles.groupChatBtn}
          onPress={() => navigation.navigate('ChatList')}
        >
          <Text style={styles.groupChatBtnText}>Group Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Stat cards */}
      <View style={styles.statsGrid}>
        <StatCard title="Quizzes completed" value={String(stats.completedQuizzes ?? 0)} sub="submitted" />
        <StatCard title="Average score" value={`${(stats.averageScore ?? 0).toFixed(1)}%`} sub="quiz average" />
        <StatCard title="Courses" value={String(courses.length)} sub="this term" />
        <StatCard title="Attendance" value={`${(stats.overallAttendance ?? 0).toFixed(0)}%`} sub="overall" />
        <StatCard
          title="Level rank"
          value={stats.rank != null ? `#${stats.rank}` : '—'}
          sub={stats.totalInLevel ? `of ${stats.totalInLevel}` : 'No quizzes yet'}
        />
      </View>

      {isStudent && (
        <>
          {/* Score by subject */}
          {scoreBySubject.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Score by subject</Text>
              <View style={styles.card}>
                {scoreBySubject.map((s) => (
                  <View key={s.subjectName} style={styles.row}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{s.subjectName}</Text>
                    <Text style={styles.rowValue}>{s.averageScore.toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Recent quiz scores */}
          {recentScores.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent quiz scores</Text>
              <View style={styles.card}>
                {recentScores.slice(0, 5).map((r, i) => (
                  <View key={i} style={styles.row}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{r.quizTitle}</Text>
                    <Text style={styles.rowValue}>{r.score.toFixed(0)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Level leaderboard</Text>
              <View style={styles.card}>
                {leaderboard.map((entry) => (
                  <View
                    key={entry.studentCode}
                    style={[styles.leaderRow, entry.isCurrentUser && styles.leaderRowYou]}
                  >
                    <Text style={[styles.rank, entry.rank <= 3 && styles.rankTop]}>#{entry.rank}</Text>
                    <Text style={[styles.leaderName, entry.isCurrentUser && styles.leaderNameYou]}>
                      {entry.isCurrentUser ? 'You' : (entry.studentName || entry.studentCode)}
                    </Text>
                    <Text style={styles.leaderScore}>{entry.averageScore} (total)</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {/* My Courses */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My courses</Text>
        {courses.length === 0 ? (
          <Text style={styles.empty}>No courses enrolled yet.</Text>
        ) : (
          courses.map((course) => (
            <CourseCard
              key={course.courseInstanceId}
              course={course}
              onGroupChat={() =>
                navigation.navigate('ChatRoom', {
                  courseInstanceId: course.courseInstanceId,
                  subjectName: course.subjectName,
                  levelName: course.levelName,
                })
              }
              onTasks={() =>
                navigation.navigate('TaskList', {
                  courseInstanceId: course.courseInstanceId,
                  subjectName: course.subjectName,
                  levelName: course.levelName,
                })
              }
              onMaterials={() =>
                navigation.navigate('MaterialsList', {
                  courseInstanceId: course.courseInstanceId,
                  subjectName: course.subjectName,
                  levelName: course.levelName,
                })
              }
              onAttend={() =>
                navigation.navigate('Attendance', {
                  courseInstanceId: course.courseInstanceId,
                  subjectName: course.subjectName,
                  levelName: course.levelName,
                })
              }
              onLiveQuiz={() =>
                navigation.navigate('LiveQuiz', {
                  courseInstanceId: course.courseInstanceId,
                  subjectName: course.subjectName,
                  levelName: course.levelName,
                })
              }
              onSetupPasskey={() =>
                navigation.navigate('SetupPasskey', {
                  courseInstanceId: course.courseInstanceId,
                  subjectName: course.subjectName,
                  levelName: course.levelName,
                })
              }
            />
          ))
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function StatCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function CourseCard({
  course,
  onGroupChat,
  onTasks,
  onMaterials,
  onAttend,
  onLiveQuiz,
  onSetupPasskey,
}: {
  course: DashboardCourse;
  onGroupChat: () => void;
  onTasks: () => void;
  onMaterials: () => void;
  onAttend: () => void;
  onLiveQuiz: () => void;
  onSetupPasskey: () => void;
}) {
  const isPractical = course.courseType === 'practical';
  const att = course.attendance;
  return (
    <View style={[styles.courseCard, isPractical && styles.courseCardPractical]}>
      <View style={styles.courseHeader}>
        <Text style={styles.courseSubject}>{course.subjectName}</Text>
        <View style={[styles.badge, isPractical ? styles.badgePractical : styles.badgeTheory]}>
          <Text style={styles.badgeText}>{isPractical ? 'Practical' : 'Theory'}</Text>
        </View>
      </View>
      <Text style={styles.courseLevel}>{course.levelName}</Text>
      <Text style={styles.courseMeta}>
        {isPractical && course.ta ? `TA: ${course.ta.taName}` : `Teacher: ${course.teacher?.teacherName ?? '—'}`}
      </Text>
      {att != null && (
        <Text style={[styles.attendance, att.percentage >= 75 ? styles.attendanceOk : styles.attendanceLow]}>
          Attendance: {att.percentage.toFixed(0)}%
        </Text>
      )}
      <View style={styles.courseActions}>
        <ActionChip label="Group Chat" onPress={onGroupChat} />
        <ActionChip label="Tasks" onPress={onTasks} />
        <ActionChip label="Materials" onPress={onMaterials} />
        <ActionChip label="Attend" onPress={onAttend} />
        <ActionChip label="Live Quiz" onPress={onLiveQuiz} />
        <ActionChip label="Setup Passkey" onPress={onSetupPasskey} />
      </View>
    </View>
  );
}

function ActionChip({
  label,
  subLabel,
  onPress,
}: { label: string; subLabel?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.chip} onPress={onPress}>
      <Text style={styles.chipText}>{label}{subLabel ? ` ${subLabel}` : ''}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, paddingTop: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' },
  welcomeCard: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  welcomeTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  welcomeSub: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 12 },
  groupChatBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  groupChatBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 20,
  },
  statCard: {
    width: '50%',
    padding: 4,
    minWidth: 140,
  },
  statTitle: { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111', marginTop: 2 },
  statSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6' },
  rowLabel: { flex: 1, fontSize: 14, color: '#374151', marginRight: 8 },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#111' },
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6' },
  leaderRowYou: { backgroundColor: '#eef2ff', marginHorizontal: -16, paddingHorizontal: 16, marginVertical: 2, borderRadius: 8 },
  rank: { width: 32, fontSize: 14, fontWeight: '700', color: '#6b7280' },
  rankTop: { color: '#d97706' },
  leaderName: { flex: 1, fontSize: 14, color: '#374151' },
  leaderNameYou: { fontWeight: '600', color: '#4f46e5' },
  leaderScore: { fontSize: 14, color: '#6b7280' },
  empty: { color: '#6b7280', fontSize: 14 },
  courseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  courseCardPractical: { backgroundColor: '#fffbeb', borderColor: '#fcd34d' },
  courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  courseSubject: { fontSize: 18, fontWeight: '600', color: '#111', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeTheory: { backgroundColor: '#3b82f6' },
  badgePractical: { backgroundColor: '#f59e0b' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  courseLevel: { fontSize: 14, color: '#6b7280', marginBottom: 2 },
  courseMeta: { fontSize: 14, color: '#374151', marginBottom: 4 },
  attendance: { fontSize: 14, marginBottom: 8 },
  attendanceOk: { color: '#059669' },
  attendanceLow: { color: '#dc2626' },
  courseActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chipText: { fontSize: 12, color: '#4338ca', fontWeight: '500' },
});
