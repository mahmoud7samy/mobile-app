import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Dimensions } from 'react-native';
import { useThemeStore } from '../lib/themeStore';
import { startQrAttendanceSession, getQrToken, getActiveQrSession, confirmAllQrAttendance } from '../lib/api';
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');
const QR_SIZE = width * 0.6;

export default function ActiveQrAttendanceScreen({ route, navigation }: any) {
  const { courseInstanceId, subjectName } = route.params;
  const { theme: t } = useThemeStore();
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<{ token: string; validTo: string } | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const tokenTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initSession();
    return () => stopPolling();
  }, []);

  const initSession = async () => {
    try {
      setLoading(true);
      const res = await startQrAttendanceSession(courseInstanceId);
      setQrSessionId(res.data.qrSessionId);
      
      // Fetch initial token and session
      await fetchToken(res.data.qrSessionId);
      await fetchSession(res.data.qrSessionId);
      
      startPolling(res.data.qrSessionId);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to start QR attendance');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (sessionId: string) => {
    if (tokenTimerRef.current) clearInterval(tokenTimerRef.current);
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    
    // Poll token every 8 seconds
    tokenTimerRef.current = setInterval(() => fetchToken(sessionId), 8000);
    
    // Poll session every 3 seconds for live check-ins
    sessionTimerRef.current = setInterval(() => fetchSession(sessionId), 3000);
  };

  const stopPolling = () => {
    if (tokenTimerRef.current) clearInterval(tokenTimerRef.current);
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
  };

  const fetchToken = async (sessionId: string) => {
    try {
      const res = await getQrToken(sessionId);
      if (res.data) setTokenData(res.data);
    } catch (err) {
      // ignore
    }
  };

  const fetchSession = async (sessionId: string) => {
    try {
      const res = await getActiveQrSession(sessionId);
      if (res.data?.session) {
        setSession(res.data.session);
      }
    } catch (err) {
      // ignore
    }
  };

  const handleConfirmAll = async () => {
    if (!qrSessionId) return;
    Alert.alert(
      'End Session',
      'This will close the QR session and confirm all checked-in students as present.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: 'default',
          onPress: async () => {
            try {
              setActionLoading(true);
              stopPolling();
              await confirmAllQrAttendance(qrSessionId);
              Alert.alert('Success', 'QR attendance session ended');
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to end session');
              startPolling(qrSessionId);
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

  const attempts = session?.attempts || [];
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.text }]}>{subjectName} - QR Attendance</Text>
      </View>

      <View style={styles.qrContainer}>
        {tokenData ? (
          <View style={[styles.qrWrapper, { backgroundColor: '#fff' }]}>
            <QRCode value={tokenData.token} size={QR_SIZE} color="#000" backgroundColor="#fff" />
          </View>
        ) : (
          <View style={[styles.qrWrapper, { backgroundColor: t.surface2, width: QR_SIZE, height: QR_SIZE, justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={t.primary} />
          </View>
        )}
        <Text style={[styles.qrHint, { color: t.textSecondary }]}>
          Ask students to scan this QR code. It refreshes automatically.
        </Text>
      </View>

      <View style={[styles.listHeader, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
        <Text style={[styles.listTitle, { color: t.text }]}>
          Checked In ({attempts.length})
        </Text>
      </View>

      <FlatList
        data={attempts}
        keyExtractor={(item: any) => item.studentId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={{ color: t.textMuted, textAlign: 'center', marginTop: 20 }}>No students have checked in yet.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.studentCard, { borderBottomColor: t.border }]}>
            <View>
              <Text style={[styles.studentName, { color: t.text }]}>{item.student.studentName}</Text>
              <Text style={{ color: t.textSecondary, fontSize: 12 }}>{item.student.studentCode}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Text style={{ color: '#10B981', fontSize: 12, fontWeight: 'bold' }}>VERIFIED</Text>
            </View>
          </View>
        )}
      />

      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: t.primary }]}
          onPress={handleConfirmAll}
          disabled={actionLoading}
        >
          {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.closeBtnText}>Confirm All & End Session</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold' },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrWrapper: {
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrHint: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  listHeader: {
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  list: { paddingBottom: 20 },
  studentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  studentName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  footer: { padding: 16, borderTopWidth: 1 },
  closeBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
