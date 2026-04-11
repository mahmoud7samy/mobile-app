import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, ActivityIndicator, StatusBar,
  Animated, Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getDashboard, getChatUnread, getStudentNotifications,
  getStudentAnnouncements, getStaffAnnouncements,
  getWebAuthnRegisterOptions, verifyWebAuthnRegister, getWebAuthnRegisterStatus,
  getAiStatus,
  type DashboardResponse, type DashboardCourse
} from '../lib/api';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';
import { Passkey } from 'react-native-passkey';
import { Alert } from 'react-native';
import Constants from 'expo-constants';

export default function DashboardScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const { theme, toggle, isDark } = useThemeStore();
  const lastViewedNotifications = useAuthStore((s) => s.lastViewedNotifications);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [unreadChats, setUnreadChats] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState<string | null>(null);

  const handlePasskeySetup = async (courseId: string) => {
    try {
      setPasskeyLoading(courseId);

      // Passkeys won't work in Expo Go; require a dev build / production build.
      const ownership = (Constants as any)?.appOwnership;
      if (ownership === 'expo') {
        Alert.alert(
          'Passkeys Not Supported Here',
          'Passkeys require a Development Build or a Production build (Expo Go does not support native passkey modules). Build the app with EAS and try again.'
        );
        return;
      }
      if (typeof (Passkey as any)?.isSupported === 'function') {
        const supported = await (Passkey as any).isSupported();
        if (!supported) {
          Alert.alert(
            'Not Supported',
            'This device does not support passkeys. You need a device with secure screen lock/biometrics enabled.'
          );
          return;
        }
      }
      
      // 1. Check status
      const { data: status } = await getWebAuthnRegisterStatus(courseId);
      if (!status.canRegister) {
        const msg = status.cooldownEnd 
          ? `You can register again after ${new Date(status.cooldownEnd).toLocaleDateString()}.`
          : "You cannot register a passkey for this course right now.";
        Alert.alert("Registration Locked", msg);
        return;
      }

      // 2. Get options
      let options;
      try {
        const res = await getWebAuthnRegisterOptions(courseId);
        options = res.data;
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Failed to get registration options';
        Alert.alert("Server Error", `Could not get passkey options from server.\n\n${msg}`);
        return;
      }
      
      // 3. Create Passkey
      let response;
      try {
        response = await (Passkey as any).create(options);
      } catch (err: any) {
        // Common passkey creation errors
        const errMsg = err.message || '';
        if (errMsg.includes('NotAllowed') || errMsg.includes('cancelled')) {
          Alert.alert("Cancelled", "Passkey setup was cancelled. Try again when ready.");
        } else if (errMsg.includes('SecurityError') || errMsg.includes('not supported')) {
          Alert.alert("Not Supported", "Your device does not support passkeys. You need a phone with biometric authentication (fingerprint or face).");
        } else {
          Alert.alert("Passkey Error", `Could not create passkey on your device.\n\n${errMsg}`);
        }
        return;
      }
      
      // 4. Verify with server
      const { data: result } = await verifyWebAuthnRegister(courseId, response, options.challenge);
      
      if (result.verified) {
        Alert.alert("Success", "Passkey registered successfully! You can now use biometrics for QR attendance.");
      }
    } catch (err: any) {
      console.error('[Passkey]', err);
      const msg = err.response?.data?.message || err.message || "Failed to set up passkey.";
      if (msg.toLowerCase().includes('network')) {
        Alert.alert(
          "Network Error",
          "Cannot reach the server. Check your internet connection and make sure Railway env vars are set (WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN) and that `/.well-known/assetlinks.json` is reachable."
        );
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setPasskeyLoading(null);
    }
  };

  const load = async () => {
    try {
      const { data: res } = await getDashboard();
      setData(res);

      try {
        const { data: chats } = await getChatUnread();
        const totalUnreadChats = chats.reduce((sum, c) => sum + c.unreadCount, 0);
        setUnreadChats(totalUnreadChats > 0);

        let newNotifs = false;
        if (user?.role === 'student') {
          const [notifsRes, annRes] = await Promise.all([
            getStudentNotifications(),
            getStudentAnnouncements()
          ]);
          const allItems = [...notifsRes.data, ...annRes.data];
          if (allItems.length > 0) {
            const newest = allItems.sort((a, b) => new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime())[0];
            const newestDate = new Date(newest.timestamp || newest.createdAt).getTime();
            const lastViewedDate = lastViewedNotifications ? new Date(lastViewedNotifications).getTime() : 0;
            if (newestDate > lastViewedDate) newNotifs = true;
          }
        } else {
          const { data: annRes } = await getStaffAnnouncements();
          if (annRes.length > 0) {
            const newest = annRes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            const newestDate = new Date(newest.createdAt).getTime();
            const lastViewedDate = lastViewedNotifications ? new Date(lastViewedNotifications).getTime() : 0;
            if (newestDate > lastViewedDate) newNotifs = true;
          }
        }
        setUnreadNotifications(newNotifs);
      } catch (err) {
        console.error('Failed to load badges', err);
      }

    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [lastViewedNotifications])
  );

  const onRefresh = () => { setRefreshing(true); load(); };

  const checkAiReadiness = async () => {
    try {
      const { data: status } = await getAiStatus();
      const msg = `OpenAI: ${status.openai ? '✅ OK' : '❌ Key Missing'}\nQdrant: ${status.qdrant ? '✅ OK' : '❌ Off'}${status.qdrantError ? '\n' + status.qdrantError : ''}`;
      Alert.alert("AI Readiness Check", msg);
    } catch (err: any) {
      Alert.alert("Check Failed", "Could not reach diagnostic endpoint. Make sure backend is deployed.");
    }
  };

  const t = theme;

  if (loading && !data) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';
  const isTa = user?.role === 'ta';
  const stats = (data?.stats ?? {}) as NonNullable<DashboardResponse['stats']>;
  const courses = data?.courses ?? [];
  const scoreBySubject = data?.scoreBySubject ?? [];
  const scoreByCourse = (data as any)?.scoreByCourse ?? [];
  const attendanceByCourse = (data as any)?.attendanceByCourse ?? [];
  const topPerformersByLevel = (data as any)?.topPerformersByLevel ?? [];
  const recentScores = data?.recentScores ?? [];
  const leaderboard = data?.leaderboard ?? [];
  const student = data?.student;
  // Match web behavior: if setting is missing, default to enabled.
  const prerequisiteTestEnabled = (data as any)?.prerequisiteTestEnabled ?? true;
  const levelName = student?.levelName ?? '';
  const studentName = student?.studentName ?? user?.profileName ?? user?.username ?? '';
  const initials = studentName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.primary]} tintColor={t.primary} />}
    >
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />

      {/* In-app notification banner - REMOVED */}

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={[styles.dateText, { color: t.textMuted }]}>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
        <View style={styles.topActions}>
          <TouchableOpacity
            style={[styles.bellBtn, { backgroundColor: t.surface2 }]}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={{ fontSize: 18 }}>🔔</Text>
            {unreadNotifications && <View style={styles.redDot} />}
          </TouchableOpacity>
          {(user?.role === 'teacher' || user?.role === 'admin' || true) && (
            <TouchableOpacity 
              onPress={checkAiReadiness} 
              style={[styles.themeBtn, { backgroundColor: t.surface2, marginRight: 8 }]}
            >
              <Text style={{ fontSize: 16 }}>🛠️</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={toggle} style={[styles.themeBtn, { backgroundColor: t.surface2 }]}>
            <Text style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero card */}
      <View style={[styles.hero, { ...t.shadowStrong }]}>
        <View style={styles.heroLeft}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials || '👤'}</Text>
          </View>
          <View>
            <Text style={styles.heroGreeting}>Good day,</Text>
            <Text style={styles.heroName}>{studentName}</Text>
            <Text style={styles.heroSub}>
              {levelName}{levelName && courses.length ? ' · ' : ''}{courses.length} course{courses.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.chatBadge}
          onPress={() => navigation.navigate('ChatList')}
        >
          <Text style={styles.chatBadgeText}>💬 Chats</Text>
          {unreadChats && <View style={styles.chatRedDot} />}
        </TouchableOpacity>
      </View>

      {/* Stats pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow} contentContainerStyle={styles.statsContent}>
        {isStudent ? (
          <>
            <StatPill icon="🏆" label={stats.rank != null ? `#${stats.rank} Rank` : '— Rank'} color="#F59E0B" bg={t.surface} border={t.border} text={t.text} />
            <StatPill icon="⭐" label={`${(stats.averageScore ?? 0).toFixed(1)}% Avg`} color="#3B82F6" bg={t.surface} border={t.border} text={t.text} />
            <StatPill icon="✍️" label={`${stats.completedQuizzes ?? 0} Quizzes Taken`} color="#8B5CF6" bg={t.surface} border={t.border} text={t.text} />
            <StatPill icon="📚" label={`${courses.length} Courses`} color="#10B981" bg={t.surface} border={t.border} text={t.text} />
            <StatPill icon="📍" label={`${(stats.overallAttendance ?? 0).toFixed(0)}% Attend`} color="#EC4899" bg={t.surface} border={t.border} text={t.text} />
          </>
        ) : (
          <>
            <StatPill icon="📚" label={`${stats.totalCourses ?? courses.length} Courses`} color="#10B981" bg={t.surface} border={t.border} text={t.text} />
            <StatPill icon="👥" label={`${stats.totalStudents ?? 0} Students`} color="#3B82F6" bg={t.surface} border={t.border} text={t.text} />
            <StatPill icon="🧪" label={`${stats.totalQuizzes ?? 0} Quizzes`} color="#8B5CF6" bg={t.surface} border={t.border} text={t.text} />
            <StatPill icon="📄" label={`${stats.totalMaterials ?? 0} Materials`} color="#F59E0B" bg={t.surface} border={t.border} text={t.text} />
            <StatPill icon="⭐" label={`${(stats.averageClassScore ?? 0).toFixed(1)}% Avg`} color="#EC4899" bg={t.surface} border={t.border} text={t.text} />
            <StatPill icon="📍" label={`${(stats.overallAttendance ?? 0).toFixed(1)}% Attend`} color="#22C55E" bg={t.surface} border={t.border} text={t.text} />
          </>
        )}
      </ScrollView>

      {isStudent && (
        <>
          {scoreBySubject.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Score by Subject</Text>
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}>
                {scoreBySubject.map((s) => (
                  <View key={s.subjectName} style={[styles.row, { borderBottomColor: t.border }]}>
                    <Text style={[styles.rowLabel, { color: t.textSecondary }]} numberOfLines={1}>{s.subjectName}</Text>
                    <Text style={[styles.rowValue, { color: t.primary }]}>{s.averageScore.toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {leaderboard.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Level Leaderboard</Text>
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}>
                {leaderboard.map((entry) => (
                  <View
                    key={entry.studentCode}
                    style={[
                      styles.leaderRow,
                      { borderBottomColor: t.border },
                      entry.isCurrentUser && { backgroundColor: t.primaryLight, borderRadius: 8 },
                    ]}
                  >
                    <Text style={[styles.rank, { color: entry.rank <= 3 ? '#F59E0B' : t.textMuted }]}>#{entry.rank}</Text>
                    <Text style={[styles.leaderName, { color: entry.isCurrentUser ? t.primary : t.text }]}>
                      {entry.isCurrentUser ? 'You' : (entry.studentName || entry.studentCode)}
                    </Text>
                    <Text style={[styles.leaderScore, { color: t.textMuted }]}>{entry.averageScore}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {(isTeacher || isTa) && (
        <>
          {Array.isArray(scoreByCourse) && scoreByCourse.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Average Score by Course</Text>
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}>
                {scoreByCourse.map((s: any, idx: number) => (
                  <View key={`${s.courseLabel ?? idx}`} style={[styles.row, { borderBottomColor: t.border }]}>
                    <Text style={[styles.rowLabel, { color: t.textSecondary }]} numberOfLines={1}>
                      {s.courseLabel ?? s.subjectName ?? 'Course'}
                    </Text>
                    <Text style={[styles.rowValue, { color: t.primary }]}>{(s.averageScore ?? 0).toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {Array.isArray(attendanceByCourse) && attendanceByCourse.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Attendance by Course</Text>
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}>
                {attendanceByCourse.map((a: any, idx: number) => (
                  <View key={`${a.courseLabel ?? idx}`} style={[styles.row, { borderBottomColor: t.border }]}>
                    <Text style={[styles.rowLabel, { color: t.textSecondary }]} numberOfLines={1}>
                      {a.courseLabel ?? a.subjectName ?? 'Course'}
                    </Text>
                    <Text style={[styles.rowValue, { color: t.primary }]}>{(a.attendancePercentage ?? 0).toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {Array.isArray(topPerformersByLevel) && topPerformersByLevel.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Top Performers</Text>
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}>
                {topPerformersByLevel.map((lvl: any, idx: number) => (
                  <View key={`${lvl.levelId ?? idx}`} style={{ padding: 14, borderBottomWidth: idx === topPerformersByLevel.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: t.border }}>
                    <Text style={{ color: t.text, fontWeight: '800', marginBottom: 8 }}>
                      {lvl.levelName ?? 'Level'}
                    </Text>
                    {(lvl.students ?? []).slice(0, 5).map((st: any, j: number) => (
                      <View key={`${st.studentCode ?? j}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ color: t.textSecondary, flex: 1 }} numberOfLines={1}>
                          #{st.rank ?? (j + 1)} {st.studentName || st.studentCode}
                        </Text>
                        <Text style={{ color: t.primary, fontWeight: '700' }}>{(st.averageScore ?? 0).toFixed(1)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {/* My Courses */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.text }]}>My Courses</Text>
        {courses.length === 0
          ? <Text style={[styles.empty, { color: t.textMuted }]}>{isStudent ? 'No courses enrolled yet.' : 'No active courses yet.'}</Text>
          : courses.map((course) => (
            <CourseCard
              key={course.courseInstanceId}
              course={course}
              theme={t}
              onGroupChat={() => navigation.navigate('ChatRoom', { courseInstanceId: course.courseInstanceId, subjectName: course.subjectName, levelName: course.levelName })}
              onTasks={() => navigation.navigate('TaskList', { courseInstanceId: course.courseInstanceId, subjectName: course.subjectName, levelName: course.levelName })}
              onMaterials={() => navigation.navigate('MaterialsList', { courseInstanceId: course.courseInstanceId, subjectName: course.subjectName, levelName: course.levelName })}
              onAttend={isStudent ? () => navigation.navigate('Attendance', { courseInstanceId: course.courseInstanceId, subjectName: course.subjectName, levelName: course.levelName }) : undefined}
              onTranscripts={() => navigation.navigate('TranscriptList', { courseInstanceId: course.courseInstanceId, subjectName: course.subjectName, levelName: course.levelName })}
              onAbsences={isStudent ? () => navigation.navigate('Absences', { courseInstanceId: course.courseInstanceId, subjectName: course.subjectName, levelName: course.levelName, isPractical: course.courseType === 'practical' }) : undefined}
              onPasskey={isStudent ? () => handlePasskeySetup(course.courseInstanceId) : undefined}
              passkeyLoading={isStudent ? (passkeyLoading === course.courseInstanceId) : false}
              showPreTest={isStudent && prerequisiteTestEnabled}
              onPreTest={() => navigation.navigate('PrerequisiteTest', { materials: (course as any).materials ?? [], subjectName: course.subjectName })}
            />
          ))
        }
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function StatPill({ icon, label, color, bg, border, text }: { icon: string; label: string; color: string; bg: string; border: string; text: string }) {
  return (
    <View style={[pillStyles.pill, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[pillStyles.icon, { color }]}>{icon}</Text>
      <Text style={[pillStyles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 50, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8,
    marginRight: 10,
  },
  icon: { fontSize: 14, marginRight: 6 },
  label: { fontSize: 13, fontWeight: '600' },
});

function CourseCard({ course, theme: t, onGroupChat, onTasks, onMaterials, onAttend, onTranscripts, onAbsences, onPasskey, passkeyLoading, showPreTest, onPreTest }: {
  course: DashboardCourse; theme: any;
  onGroupChat: () => void; onTasks: () => void; onMaterials: () => void;
  onAttend?: () => void; onTranscripts: () => void; onAbsences?: () => void; onPasskey?: () => void; passkeyLoading?: boolean;
  showPreTest?: boolean; onPreTest?: () => void;
}) {
  const isPractical = course.courseType === 'practical';
  const att = course.attendance;
  const accentColor = isPractical ? '#F59E0B' : t.primary;

  return (
    <View style={[
      courseStyles.card,
      { backgroundColor: t.surface, borderColor: t.border, borderLeftColor: accentColor, ...t.shadow },
    ]}>
      <View style={courseStyles.header}>
        <View style={[courseStyles.iconCircle, { backgroundColor: accentColor + '22' }]}>
          <Text style={[courseStyles.iconLetter, { color: accentColor }]}>
            {course.subjectName?.[0] ?? '?'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[courseStyles.subject, { color: t.text }]} numberOfLines={1}>{course.subjectName}</Text>
          <Text style={[courseStyles.level, { color: t.textMuted }]}>{course.levelName}</Text>
        </View>
        <View style={[courseStyles.badge, { backgroundColor: isPractical ? '#FEF3C7' : '#EEF0FF' }]}>
          <Text style={[courseStyles.badgeText, { color: accentColor }]}>{isPractical ? 'Practical' : 'Theory'}</Text>
        </View>
      </View>

      <Text style={[courseStyles.meta, { color: t.textSecondary }]}>
        {isPractical && course.ta ? `TA: ${course.ta.taName}` : `Teacher: ${course.teacher?.teacherName ?? '—'}`}
      </Text>

      {att != null && (
        <View style={courseStyles.attRow}>
          <View style={[courseStyles.attBar, { backgroundColor: t.border }]}>
            <View style={[courseStyles.attFill, {
              backgroundColor: att.percentage >= 75 ? t.success : t.danger,
              width: `${Math.min(att.percentage, 100)}%` as any,
            }]} />
          </View>
          <Text style={[courseStyles.attLabel, { color: att.percentage >= 75 ? t.success : t.danger }]}>
            {att.percentage.toFixed(0)}%
          </Text>
        </View>
      )}

      <View style={courseStyles.actions}>
        <ActionBtn label="Chat" onPress={onGroupChat} bg={t.surface2} text={t.textSecondary} />
        <ActionBtn label="Tasks" onPress={onTasks} bg={t.surface2} text={t.textSecondary} />
        <ActionBtn label="Materials" onPress={onMaterials} bg={t.surface2} text={t.textSecondary} />
        <ActionBtn label="Transcripts" onPress={onTranscripts} bg={t.surface2} text={t.textSecondary} />
        {onAttend && <ActionBtn label="Attendance" onPress={onAttend} bg={t.surface2} text={t.textSecondary} />}
        {onAbsences && <ActionBtn label="Absences" onPress={onAbsences} bg={t.surface2} text={t.textSecondary} />}
        {showPreTest && onPreTest && (
          <ActionBtn label="Pre-Test" onPress={onPreTest} bg={t.primaryLight} text={t.primary} />
        )}
        {onPasskey && (
          <ActionBtn 
            label={passkeyLoading ? "Setting up..." : "Passkey"} 
            onPress={onPasskey} 
            bg={t.surface2} 
            text={t.textSecondary} 
          />
        )}
      </View>
    </View>
  );
}

function ActionBtn({ label, onPress, bg, text }: { label: string; onPress: () => void; bg: string; text: string }) {
  return (
    <TouchableOpacity style={[actionStyles.btn, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[actionStyles.label, { color: text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const actionStyles = StyleSheet.create({
  btn: { alignItems: 'center', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.1 },
});

const courseStyles = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1, borderLeftWidth: 4,
    padding: 16, marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  iconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconLetter: { fontSize: 18, fontWeight: '800' },
  subject: { fontSize: 16, fontWeight: '700' },
  level: { fontSize: 13, marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 13, marginBottom: 10 },
  attRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  attBar: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  attFill: { height: '100%', borderRadius: 3 },
  attLabel: { fontSize: 12, fontWeight: '700', width: 36 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dateText: { fontSize: 13, fontWeight: '500' },
  themeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  redDot: { position: 'absolute', top: 4, right: 6, width: 8, height: 8, backgroundColor: '#EF4444', borderRadius: 4 },
  chatRedDot: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, backgroundColor: '#EF4444', borderRadius: 5, borderWidth: 1, borderColor: '#fff' },
  hero: {
    borderRadius: 20, padding: 20, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#6C63FF',
  },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroGreeting: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  heroName: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  chatBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 50,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  chatBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  statsRow: { marginBottom: 20 },
  statsContent: { paddingRight: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, letterSpacing: -0.3 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flex: 1, fontSize: 14, marginRight: 8 },
  rowValue: { fontSize: 14, fontWeight: '700' },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 36, fontSize: 14, fontWeight: '800' },
  leaderName: { flex: 1, fontSize: 14, fontWeight: '500' },
  leaderScore: { fontSize: 13 },
  empty: { fontSize: 14 },
});

const bannerStyles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: '#1E1B4B',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 44, // safe area top padding
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  content: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  body: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  close: { paddingLeft: 12, paddingVertical: 4 },
  closeText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '700' },
});
