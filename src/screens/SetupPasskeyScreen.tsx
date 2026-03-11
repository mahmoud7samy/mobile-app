import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export default function SetupPasskeyScreen({ route, navigation }: any) {
  const { subjectName, levelName } = route.params ?? {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Set up passkey</Text>
      <Text style={styles.subtitle}>
        {subjectName}{levelName ? ` (${levelName})` : ''}
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Where to set it up</Text>
        <Text style={styles.text}>
          Passkeys use WebAuthn, which is currently supported in the web dashboard. To set up or manage
          your passkey for this course:
        </Text>
        <Text style={styles.bullet}>1. Open the platform on a computer in your browser.</Text>
        <Text style={styles.bullet}>2. Go to the Dashboard and open this course.</Text>
        <Text style={styles.bullet}>3. Click “Set up passkey” and follow the on‑screen steps.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Using passkey with QR attendance</Text>
        <Text style={styles.text}>
          After your passkey is set up on the web, you can use it when scanning QR attendance from a
          compatible browser/device. The current mobile app lets you:
        </Text>
        <Text style={styles.bullet}>• Enter attendance codes directly.</Text>
        <Text style={styles.bullet}>• Scan QR codes and be guided to finish passkey verification on the web if needed.</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, paddingTop: 24, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 8 },
  text: { fontSize: 14, color: '#374151', marginBottom: 8, lineHeight: 20 },
  bullet: { fontSize: 14, color: '#374151', marginBottom: 4 },
  button: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});

