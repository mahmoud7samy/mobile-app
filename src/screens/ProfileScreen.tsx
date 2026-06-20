import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen({ navigation }: any) {
  const { user, clearAuth } = useAuthStore();
  const { theme: t, isDark, toggle: toggleTheme } = useThemeStore();

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive',
          onPress: async () => {
            await clearAuth();
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* Profile Header */}
      <View style={[styles.headerCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={[styles.avatarBox, { backgroundColor: t.primaryLight }]}>
          <Text style={[styles.avatarText, { color: t.primary }]}>
            {user?.username?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={[styles.username, { color: t.text }]}>
          {user?.username || 'Unknown User'}
        </Text>
        <View style={[styles.roleBadge, { backgroundColor: t.surface2 }]}>
          <Text style={[styles.roleText, { color: t.textSecondary }]}>
            {user?.role?.toUpperCase() || 'STUDENT'}
          </Text>
        </View>
      </View>

      {/* Settings List */}
      <View style={[styles.settingsGroup, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[styles.groupTitle, { color: t.textMuted }]}>PREFERENCES</Text>
        
        <View style={[styles.settingRow, { borderBottomColor: t.border, borderBottomWidth: 1 }]}>
          <View style={styles.settingRowLeft}>
            <Ionicons name="moon" size={20} color={t.textSecondary} style={{ marginRight: 12 }} />
            <Text style={[styles.settingLabel, { color: t.text }]}>Dark Mode</Text>
          </View>
          <Switch 
            value={isDark} 
            onValueChange={toggleTheme} 
            trackColor={{ false: '#767577', true: t.primary }}
            thumbColor={'#ffffff'}
          />
        </View>
      </View>

      <View style={[styles.settingsGroup, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[styles.groupTitle, { color: t.textMuted }]}>ACCOUNT</Text>
        
        <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
          <View style={styles.settingRowLeft}>
            <Ionicons name="log-out-outline" size={20} color={t.danger} style={{ marginRight: 12 }} />
            <Text style={[styles.settingLabel, { color: t.danger, fontWeight: '700' }]}>Log Out</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  avatarBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  settingsGroup: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    paddingVertical: 8,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});
