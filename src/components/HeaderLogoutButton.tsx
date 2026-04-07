import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';

export default function HeaderLogoutButton() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { theme: t } = useThemeStore();

  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: t.surface2 }]}
      onPress={() => clearAuth().catch(() => { })}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, { color: t.danger }]}>Sign Out</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  text: { fontSize: 13, fontWeight: '700' },
});
