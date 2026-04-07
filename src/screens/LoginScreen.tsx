import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar,
} from 'react-native';
import { login } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const { theme } = useThemeStore();

  const handleSubmit = async () => {
    setError('');
    if (!username.trim() || !password) {
      setError('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      const { data } = await login(username.trim(), password);
      await setAuth(data.accessToken, data.user);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      const networkMsg = err.message === 'Network Error'
        ? ' Cannot reach server. Check your connection.'
        : '';
      setError(msg || err.message || 'Login failed.' + networkMsg);
    } finally {
      setLoading(false);
    }
  };

  const t = theme;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: t.bg }]}
    >
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />

      {/* Glow blob */}
      <View style={[styles.glowBlob, { backgroundColor: t.primary }]} />

      {/* Header branding */}
      <View style={styles.header}>
        <Text style={styles.logo}>🎓</Text>
        <Text style={[styles.appName, { color: t.text }]}>AI College Platform</Text>
        <Text style={[styles.tagline, { color: t.primary }]}>Your smart campus companion</Text>
      </View>

      {/* Card */}
      <View style={[styles.card, { backgroundColor: t.surface, ...t.shadowStrong }]}>
        <Text style={[styles.cardTitle, { color: t.text }]}>Sign In</Text>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: t.dangerBg }]}>
            <Text style={[styles.errorText, { color: t.danger }]}>⚠ {error}</Text>
          </View>
        ) : null}

        {/* Username */}
        <View style={[styles.inputWrap, { backgroundColor: t.surface2, borderColor: t.border }]}>
          <Text style={[styles.inputIcon, { color: t.textMuted }]}>👤</Text>
          <TextInput
            style={[styles.input, { color: t.text }]}
            placeholder="Username"
            placeholderTextColor={t.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        {/* Password */}
        <View style={[styles.inputWrap, { backgroundColor: t.surface2, borderColor: t.border }]}>
          <Text style={[styles.inputIcon, { color: t.textMuted }]}>🔒</Text>
          <TextInput
            style={[styles.input, { color: t.text }]}
            placeholder="Password"
            placeholderTextColor={t.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            editable={!loading}
          />
          <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
            <Text style={{ color: t.textMuted, fontSize: 16 }}>{showPass ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {/* Button */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Sign In →</Text>
          }
        </TouchableOpacity>

        <Text style={[styles.secureNote, { color: t.textMuted }]}>🔐 Secure · Encrypted · Campus Access</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  glowBlob: {
    position: 'absolute', top: -100, alignSelf: 'center',
    width: 300, height: 300, borderRadius: 150, opacity: 0.1,
  },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 52, marginBottom: 12 },
  appName: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  tagline: { fontSize: 14, fontWeight: '500' },
  card: { borderRadius: 20, padding: 24 },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  errorBox: { borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, lineHeight: 18 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, marginBottom: 12, height: 52,
  },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, fontSize: 16 },
  eyeBtn: { padding: 4 },
  button: {
    backgroundColor: '#6C63FF', borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  secureNote: { fontSize: 12, textAlign: 'center', marginTop: 16 },
});
