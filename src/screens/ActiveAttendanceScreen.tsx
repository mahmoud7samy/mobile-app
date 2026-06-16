import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useThemeStore } from '../lib/themeStore';
import { getActiveAttendanceSession, startAttendanceSession, confirmAttendanceRecord, confirmAllAttendance } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function ActiveAttendanceScreen({ route, navigation }: any) {
  const { courseInstanceId, subjectName } = route.params;
  const { theme: t } = useThemeStore();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initSession();
    return () => stopPolling();
  }, []);

  const initSession = async () => {
    try {
      setLoading(true);
      // 1. Check if already active
      let res = await getActiveAttendanceSession(courseInstanceId);
      if (!res.data?.session) {
        // 2. Start a new session (default 60 mins)
        await startAttendanceSession(courseInstanceId, 60);
        res = await getActiveAttendanceSession(courseInstanceId);
      }
      setSession(res.data.session);
      startPolling();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to start attendance session');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(pollSession, 3000);
  };

  const stopPolling = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const pollSession = async () => {
    try {
      const res = await getActiveAttendanceSession(courseInstanceId);
      if (res.data?.session) {
        setSession(res.data.session);
      }
    } catch (err) {
      console.error('Poll failed', err);
    }
  };

  const handleConfirmRecord = async (studentId: string, status: 'present' | 'absent') => {
    if (!session) return;
    try {
      setActionLoading(true);
      await confirmAttendanceRecord(session.sessionId, studentId, status);
      await pollSession();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to confirm record');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmAll = async () => {
    if (!session) return;
    Alert.alert(
      'Close Session',
      'This will mark all checked-in students as present, and everyone else as absent. Close session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Close', 
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              stopPolling();
              await confirmAllAttendance(session.sessionId);
              Alert.alert('Success', 'Session closed successfully');
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to close session');
              startPolling();
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.textMuted }}>No active session found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.text }]}>{subjectName} - Live Attendance</Text>
        <View style={[styles.codeBox, { backgroundColor: t.primaryLight }]}>
          <Text style={[styles.codeLabel, { color: t.primary }]}>SESSION CODE</Text>
          <Text style={[styles.codeText, { color: t.primary }]}>{session.sessionCode}</Text>
        </View>
      </View>

      <FlatList
        data={session.records || []}
        keyExtractor={(item) => item.studentId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={{ color: t.textMuted, textAlign: 'center', marginTop: 40 }}>No students enrolled.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.studentCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.studentName, { color: t.text }]}>{item.student.studentName}</Text>
              <Text style={{ color: t.textSecondary, fontSize: 12 }}>{item.student.studentCode}</Text>
              
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, { 
                  backgroundColor: item.status === 'present' ? 'rgba(16, 185, 129, 0.1)' : item.status === 'absent' ? 'rgba(239, 68, 68, 0.1)' : t.surface2 
                }]}>
                  <Text style={{ 
                    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
                    color: item.status === 'present' ? '#10B981' : item.status === 'absent' ? '#EF4444' : t.textMuted 
                  }}>
                    {item.status}
                  </Text>
                </View>
                {item.checkedInAt && (
                  <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '600', marginLeft: 8 }}>
                    Checked In
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}
                onPress={() => handleConfirmRecord(item.studentId, 'present')}
                disabled={actionLoading}
              >
                <Ionicons name="checkmark" size={18} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)', marginLeft: 8 }]}
                onPress={() => handleConfirmRecord(item.studentId, 'absent')}
                disabled={actionLoading}
              >
                <Ionicons name="close" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: t.danger }]}
          onPress={handleConfirmAll}
          disabled={actionLoading}
        >
          <Text style={styles.closeBtnText}>Confirm All & Close Session</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  codeBox: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  codeLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  codeText: { fontSize: 36, fontWeight: '800', letterSpacing: 4 },
  list: { padding: 16, paddingBottom: 40 },
  studentCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: 'center',
  },
  studentName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  actions: { flexDirection: 'row' },
  actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16, borderTopWidth: 1 },
  closeBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
