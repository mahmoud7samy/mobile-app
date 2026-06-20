import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';

export default function HeaderProfileButton() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { theme: t } = useThemeStore();

  if (!user) return null;

  return (
    <TouchableOpacity 
      style={[styles.avatarBox, { backgroundColor: t.primaryLight }]}
      onPress={() => navigation.navigate('Profile')}
    >
      <Text style={[styles.avatarText, { color: t.primary }]}>
        {user.username?.charAt(0).toUpperCase() || '?'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  avatarBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
