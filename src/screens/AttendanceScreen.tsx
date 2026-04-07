import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { checkInAttendance, submitQrScan, completeQrAttendance } from '../lib/api';
import { useThemeStore } from '../lib/themeStore';
import { Passkey } from 'react-native-passkey';

type Mode = 'choice' | 'code' | 'qr';

export default function AttendanceScreen({ route }: any) {
  const { courseInstanceId, subjectName, levelName } = route.params ?? {};
  const { theme: t } = useThemeStore();
  const [mode, setMode] = useState<Mode>('choice');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (mode === 'qr' && !permission?.granted) requestPermission();
  }, [mode]);

  const handleCodeSubmit = async () => {
    const trimmed = code.replace(/\D/g, '');
    if (trimmed.length !== 5) { setError('Please enter a 5-digit code'); return; }
    setLoading(true); setError(''); setMessage('');
    try {
      const { data } = await checkInAttendance(trimmed, courseInstanceId);
      setMessage(data.message ?? 'Checked in successfully');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQrScanned = async (qrToken: string) => {
    if (!courseInstanceId || loading) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const { data } = await submitQrScan(qrToken, new Date().toISOString(), courseInstanceId);
      if (data?.needWebAuthn) {
        // Prompt for Passkey natively
        try {
          const assertionResponse = await Passkey.get(data.options as any);
          const { data: finalRes } = await completeQrAttendance(data.attemptId!, courseInstanceId, assertionResponse);
          setMessage(finalRes.message || 'Attendance recorded.');
        } catch (passErr: any) {
          setError(passErr.message || 'Passkey verification cancelled or failed.');
        }
      } else {
        setMessage('Attendance recorded.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  if (!courseInstanceId) return (
    <View style={[styles.centered, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.danger, textAlign: 'center' }}>Missing course. Go back and open Attend from a course.</Text>
    </View>
  );

  if (mode === 'choice') return (
    <ScrollView style={[styles.container, { backgroundColor: t.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: t.text }]}>Mark Attendance</Text>
      <Text style={[styles.subtitle, { color: t.textMuted }]}>
        {subjectName}{levelName ? ` · ${levelName}` : ''}
      </Text>

      <TouchableOpacity
        style={[styles.choiceCard, { backgroundColor: t.surface, borderColor: t.primary, ...t.shadow }]}
        onPress={() => setMode('code')} activeOpacity={0.8}
      >
        <View style={[styles.choiceIcon, { backgroundColor: t.primaryLight }]}>
          <Text style={styles.choiceEmoji}>🔢</Text>
        </View>
        <Text style={[styles.choiceTitle, { color: t.text }]}>Enter Code</Text>
        <Text style={[styles.choiceDesc, { color: t.textMuted }]}>Teacher shows a 5-digit code on screen</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.choiceCard, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}
        onPress={() => setMode('qr')} activeOpacity={0.8}
      >
        <View style={[styles.choiceIcon, { backgroundColor: t.primaryLight }]}>
          <Text style={styles.choiceEmoji}>📷</Text>
        </View>
        <Text style={[styles.choiceTitle, { color: t.text }]}>Scan QR</Text>
        <Text style={[styles.choiceDesc, { color: t.textMuted }]}>Point camera at the QR code displayed by teacher</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (mode === 'code') return (
    <ScrollView style={[styles.container, { backgroundColor: t.bg }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => { setMode('choice'); setCode(''); setError(''); setMessage(''); }}>
        <Text style={[styles.backBtn, { color: t.primary }]}>← Back</Text>
      </TouchableOpacity>
      <Text style={[styles.title, { color: t.text }]}>Enter Code</Text>
      <Text style={[styles.subtitle, { color: t.textMuted }]}>Enter the 5-digit code shown by your teacher</Text>

      <TextInput
        style={[styles.codeInput, { backgroundColor: t.surface, borderColor: code.length === 5 ? t.primary : t.border, color: t.text }]}
        placeholder="_ _ _ _ _"
        placeholderTextColor={t.textMuted}
        value={code}
        onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 5)); setError(''); }}
        keyboardType="number-pad"
        maxLength={5}
        editable={!loading}
      />

      {error ? <Text style={[styles.errText, { color: t.danger }]}>{error}</Text> : null}
      {message ? <Text style={[styles.msgText, { color: t.success }]}>✓ {message}</Text> : null}

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: t.primary, opacity: loading ? 0.7 : 1 }]}
        onPress={handleCodeSubmit} disabled={loading} activeOpacity={0.85}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Check In</Text>}
      </TouchableOpacity>
    </ScrollView>
  );

  // QR mode
  if (Platform.OS === 'web') return (
    <View style={[styles.centered, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.textMuted, textAlign: 'center', marginBottom: 16 }}>QR scanning is not supported in the browser.</Text>
      <TouchableOpacity onPress={() => setMode('choice')}>
        <Text style={{ color: t.primary, fontWeight: '600' }}>← Back</Text>
      </TouchableOpacity>
    </View>
  );

  if (!permission) return (
    <View style={[styles.centered, { backgroundColor: t.bg }]}>
      <ActivityIndicator size="large" color={t.primary} />
    </View>
  );

  if (!permission.granted) return (
    <View style={[styles.centered, { backgroundColor: t.bg }]}>
      <Text style={[styles.title, { color: t.text, textAlign: 'center' }]}>Camera Access Needed</Text>
      <Text style={{ color: t.textMuted, textAlign: 'center', marginBottom: 20 }}>Allow camera to scan QR codes</Text>
      <TouchableOpacity style={[styles.submitBtn, { backgroundColor: t.primary }]} onPress={requestPermission}>
        <Text style={styles.submitBtnText}>Grant Permission</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ marginTop: 12 }} onPress={() => setMode('choice')}>
        <Text style={{ color: t.primary, fontWeight: '600', fontSize: 15 }}>← Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <TouchableOpacity
        style={[styles.backOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        onPress={() => { setMode('choice'); setError(''); setMessage(''); }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.scannerWrap}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={loading ? undefined : ({ data }) => handleQrScanned(data)}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        {/* Corner frame overlay */}
        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
      </View>

      <View style={[styles.scannerFooter, { backgroundColor: t.surface }]}>
        <Text style={[styles.scanHint, { color: t.textSecondary }]}>Point camera at the QR code</Text>
        {error ? <Text style={[styles.errText, { color: t.danger }]}>{error}</Text> : null}
        {message ? <Text style={[styles.msgText, { color: t.success }]}>✓ {message}</Text> : null}
        {loading && <ActivityIndicator color={t.primary} style={{ marginTop: 8 }} />}
      </View>
    </View>
  );
}

const CORNER = { position: 'absolute' as const, width: 24, height: 24, borderColor: '#6C63FF', borderWidth: 3 };
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 28 },
  backBtn: { fontSize: 16, fontWeight: '600', marginBottom: 20 },
  choiceCard: {
    borderRadius: 18, borderWidth: 1.5, padding: 20,
    marginBottom: 14, alignItems: 'center',
  },
  choiceIcon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  choiceEmoji: { fontSize: 30 },
  choiceTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  choiceDesc: { fontSize: 13, textAlign: 'center' },
  codeInput: {
    fontSize: 32, fontWeight: '800', textAlign: 'center', letterSpacing: 16,
    borderRadius: 16, borderWidth: 2, padding: 20, marginBottom: 16,
  },
  errText: { fontSize: 14, marginBottom: 8, textAlign: 'center' },
  msgText: { fontSize: 14, marginBottom: 8, textAlign: 'center', fontWeight: '600' },
  submitBtn: { borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backOverlay: { position: 'absolute', top: 16, left: 16, zIndex: 10, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  scannerWrap: { flex: 1, margin: 16, borderRadius: 16, overflow: 'hidden' },
  scannerFooter: { padding: 20, alignItems: 'center' },
  scanHint: { fontSize: 15, fontWeight: '500' },
  cornerTL: { ...CORNER, top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { ...CORNER, top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { ...CORNER, bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { ...CORNER, bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
});
