import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { checkInAttendance, submitQrScan } from '../lib/api';

type Mode = 'choice' | 'code' | 'qr';

export default function AttendanceScreen({ route }: any) {
  const { courseInstanceId, subjectName, levelName } = route.params ?? {};
  const [mode, setMode] = useState<Mode>('choice');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (mode === 'qr') {
      BarCodeScanner.requestPermissionsAsync().then(({ status }) =>
        setCameraPermission(status === 'granted')
      );
    }
  }, [mode]);

  const handleCodeSubmit = async () => {
    const trimmed = code.replace(/\D/g, '');
    if (trimmed.length !== 5) {
      setError('Please enter a 5-digit code');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
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
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { data } = await submitQrScan(qrToken, new Date().toISOString(), courseInstanceId);
      if (data?.needWebAuthn) {
        setMessage('');
        setError('QR attendance requires a passkey. Please complete this on the web app using a computer.');
      } else {
        setMessage('Attendance recorded.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  if (!courseInstanceId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing course. Go back and open Attend from a course.</Text>
      </View>
    );
  }

  if (mode === 'choice') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Mark attendance</Text>
        <Text style={styles.subtitle}>{subjectName}{levelName ? ` (${levelName})` : ''}</Text>
        <Text style={styles.hint}>Choose how to check in:</Text>
        <TouchableOpacity style={styles.optionBtn} onPress={() => setMode('code')}>
          <Text style={styles.optionEmoji}>🔢</Text>
          <Text style={styles.optionTitle}>Enter code</Text>
          <Text style={styles.optionDesc}>Teacher shows a 5-digit code on screen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.optionBtn} onPress={() => setMode('qr')}>
          <Text style={styles.optionEmoji}>📷</Text>
          <Text style={styles.optionTitle}>Scan QR</Text>
          <Text style={styles.optionDesc}>Scan the QR code displayed by the teacher</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (mode === 'code') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { setMode('choice'); setCode(''); setError(''); setMessage(''); }}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Enter attendance code</Text>
        <Text style={styles.hint}>Enter the 5-digit code shown by your teacher</Text>
        <TextInput
          style={styles.input}
          placeholder="12345"
          placeholderTextColor="#9ca3af"
          value={code}
          onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 5)); setError(''); }}
          keyboardType="number-pad"
          maxLength={5}
          editable={!loading}
        />
        {error ? <Text style={styles.errText}>{error}</Text> : null}
        {message ? <Text style={styles.msgText}>{message}</Text> : null}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleCodeSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Check in</Text>}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // mode === 'qr'
  if (Platform.OS === 'web') {
    return (
      <View style={styles.centered}>
        <Text style={styles.hint}>QR scanning is not supported in the browser. Use the mobile app on a device, or use "Enter code" to check in.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => setMode('choice')}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (cameraPermission === false) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errText}>Camera permission is required to scan QR codes.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => setMode('choice')}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (cameraPermission === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.hint}>Requesting camera access...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.backBtn, styles.backBtnOverlay]} onPress={() => { setMode('choice'); setError(''); setMessage(''); }}>
        <Text style={styles.backBtnTextLight}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.scannerWrap}>
        <BarCodeScanner
          style={StyleSheet.absoluteFillObject}
          onBarCodeScanned={loading ? undefined : ({ data }) => handleQrScanned(data)}
          barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
        />
      </View>
      <View style={styles.scannerFooter}>
        <Text style={styles.scannerHint}>Point your camera at the QR code</Text>
        {error ? <Text style={styles.errText}>{error}</Text> : null}
        {message ? <Text style={styles.msgText}>{message}</Text> : null}
        {loading && <ActivityIndicator color="#4f46e5" style={{ marginTop: 8 }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, paddingTop: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  backBtn: { alignSelf: 'flex-start', padding: 8, marginBottom: 16 },
  backBtnOverlay: { position: 'absolute', top: 8, left: 8, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  backBtnText: { fontSize: 16, color: '#4f46e5', fontWeight: '600' },
  backBtnTextLight: { fontSize: 16, color: '#fff', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  hint: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  optionBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionEmoji: { fontSize: 28, marginBottom: 8 },
  optionTitle: { fontSize: 18, fontWeight: '600', color: '#111', marginBottom: 4 },
  optionDesc: { fontSize: 14, color: '#6b7280' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    color: '#111',
    marginBottom: 12,
  },
  errText: { color: '#dc2626', fontSize: 14, marginBottom: 8 },
  msgText: { color: '#059669', fontSize: 14, marginBottom: 8 },
  submitBtn: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  scannerWrap: { flex: 1, minHeight: 300, overflow: 'hidden', borderRadius: 12, margin: 16 },
  scannerFooter: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  scannerHint: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  error: { color: '#dc2626', textAlign: 'center' },
});
