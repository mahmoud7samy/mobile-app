import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatRoomScreen from './src/screens/ChatRoomScreen';
import TaskListScreen from './src/screens/TaskListScreen';
import TaskDetailScreen from './src/screens/TaskDetailScreen';
import MaterialsListScreen from './src/screens/MaterialsListScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import TranscriptListScreen from './src/screens/TranscriptListScreen';
import TranscriptDetailScreen from './src/screens/TranscriptDetailScreen';
import PrerequisiteTestScreen from './src/screens/PrerequisiteTestScreen';
import AbsencesScreen from './src/screens/AbsencesScreen';

import NotificationsScreen from './src/screens/NotificationsScreen';
import { useAuthStore } from './src/lib/store';
import HeaderLogoutButton from './src/components/HeaderLogoutButton';
import { useThemeStore } from './src/lib/themeStore';
import { usePushNotifications } from './src/lib/usePushNotifications';

const Stack = createNativeStackNavigator();

export default function App() {
  const { token, _hydrated, rehydrate } = useAuthStore();
  const { theme: t, init: initTheme } = useThemeStore();
  // Register device for push notifications when the user is logged in.
  // All failures are silently swallowed – this never breaks the app.
  usePushNotifications(!!token);

  useEffect(() => {
    rehydrate();
    initTheme();
  }, [rehydrate]);

  if (!_hydrated) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerRight: () => <HeaderLogoutButton />,
          headerStyle: { backgroundColor: t.surface },
          headerTintColor: t.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 17, color: t.text },
          headerShadowVisible: false,
        }}
      >
        {token ? (
          <>
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ title: 'Dashboard' }}
            />
            <Stack.Screen
              name="ChatList"
              component={ChatListScreen}
              options={{ title: 'Group Chat' }}
            />
            <Stack.Screen
              name="ChatRoom"
              component={ChatRoomScreen}
              options={({ route }: any) => ({
                title: route.params?.subjectName
                  ? `${route.params.subjectName}${route.params?.levelName ? ` (${route.params.levelName})` : ''}`
                  : 'Chat',
              })}
            />
            <Stack.Screen
              name="TaskList"
              component={TaskListScreen}
              options={({ route }: any) => ({
                title: route.params?.subjectName
                  ? `Tasks – ${route.params.subjectName}${route.params?.levelName ? ` (${route.params.levelName})` : ''}`
                  : 'Tasks',
              })}
            />
            <Stack.Screen
              name="TaskDetail"
              component={TaskDetailScreen}
              options={{ title: 'Task' }}
            />
            <Stack.Screen
              name="MaterialsList"
              component={MaterialsListScreen}
              options={({ route }: any) => ({
                title: route.params?.subjectName
                  ? `Materials – ${route.params.subjectName}${route.params?.levelName ? ` (${route.params.levelName})` : ''}`
                  : 'Materials',
              })}
            />
            <Stack.Screen
              name="Attendance"
              component={AttendanceScreen}
              options={({ route }: any) => ({
                title: route.params?.subjectName
                  ? `Attend – ${route.params.subjectName}${route.params?.levelName ? ` (${route.params.levelName})` : ''}`
                  : 'Attend',
              })}
            />
            <Stack.Screen
              name="TranscriptList"
              component={TranscriptListScreen}
              options={({ route }: any) => ({
                title: route.params?.subjectName
                  ? `Transcripts – ${route.params.subjectName}${route.params?.levelName ? ` (${route.params.levelName})` : ''}`
                  : 'Transcripts',
              })}
            />
            <Stack.Screen
              name="TranscriptDetail"
              component={TranscriptDetailScreen}
              options={{ title: 'Transcript' }}
            />
            <Stack.Screen
              name="PrerequisiteTest"
              component={PrerequisiteTestScreen}
              options={({ route }: any) => ({
                title: route.params?.subjectName
                  ? `Pre-Test – ${route.params.subjectName}`
                  : 'Prerequisite Test',
              })}
            />

            <Stack.Screen
              name="Absences"
              component={AbsencesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: 'Notifications' }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
