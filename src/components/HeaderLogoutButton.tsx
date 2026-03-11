import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../lib/store';

export function HeaderLogoutButton() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  return (
    <TouchableOpacity onPress={() => clearAuth()} style={styles.button}>
      <Text style={styles.text}>Sign out</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    color: '#4f46e5',
    fontSize: 16,
    fontWeight: '600',
  },
});
