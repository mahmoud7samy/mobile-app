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
import LiveQuizScreen from './src/screens/LiveQuizScreen';
import SetupPasskeyScreen from './src/screens/SetupPasskeyScreen';
import { useAuthStore } from './src/lib/store';
import { HeaderLogoutButton } from './src/components/HeaderLogoutButton';

const Stack = createNativeStackNavigator();

export default function App() {
  const { token, _hydrated, rehydrate } = useAuthStore();

  useEffect(() => {
    rehydrate();
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
          headerStyle: { backgroundColor: '#f9fafb' },
          headerTitleStyle: { fontWeight: '600', fontSize: 18 },
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
              name="LiveQuiz"
              component={LiveQuizScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SetupPasskey"
              component={SetupPasskeyScreen}
              options={({ route }: any) => ({
                title: route.params?.subjectName
                  ? `Passkey – ${route.params.subjectName}${route.params?.levelName ? ` (${route.params.levelName})` : ''}`
                  : 'Set up passkey',
              })}
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
