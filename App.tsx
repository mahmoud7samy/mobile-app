import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
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
import CreateAnnouncementScreen from './src/screens/CreateAnnouncementScreen';
import TeacherAttendanceScreen from './src/screens/TeacherAttendanceScreen';
import ReviewAbsencesScreen from './src/screens/ReviewAbsencesScreen';
import TeacherGradesScreen from './src/screens/TeacherGradesScreen';
import CheatingReportsScreen from './src/screens/CheatingReportsScreen';

import NotificationsScreen from './src/screens/NotificationsScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import SubmitFeedbackScreen from './src/screens/SubmitFeedbackScreen';
import TeacherFeedbackScreen from './src/screens/TeacherFeedbackScreen';
import StudentGradesScreen from './src/screens/StudentGradesScreen';
import TeacherRequirementsScreen from './src/screens/TeacherRequirementsScreen';
import ActiveAttendanceScreen from './src/screens/ActiveAttendanceScreen';
import ActiveQrAttendanceScreen from './src/screens/ActiveQrAttendanceScreen';
import ExamScreen from './src/screens/ExamScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { useAuthStore } from './src/lib/store';
import HeaderProfileButton from './src/components/HeaderProfileButton';
import { useThemeStore } from './src/lib/themeStore';
import { usePushNotifications } from './src/lib/usePushNotifications';

const Stack = createNativeStackNavigator();

export default function App() {
  const { token, _hydrated, rehydrate } = useAuthStore();
  const { theme: t, init: initTheme } = useThemeStore();
  const [showWelcome, setShowWelcome] = React.useState(true);
  const navigationRef = useNavigationContainerRef();

  // Register device for push notifications when the user is logged in.
  // We pass navigationRef so the push listener can navigate the user to 'Notifications' when tapped.
  usePushNotifications(!!token, navigationRef);

  useEffect(() => {
    rehydrate();
    initTheme();
  }, [rehydrate]);

  if (!_hydrated) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: true,
          headerRight: () => <HeaderProfileButton />,
          headerStyle: { backgroundColor: t.surface },
          headerTintColor: t.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 17, color: t.text },
          headerShadowVisible: false,
        }}
      >
        {token ? (
          <>
            <Stack.Screen
              name="Welcome"
              component={WelcomeScreen}
              options={{ headerShown: false }}
            />
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
              name="CreateAnnouncement"
              component={CreateAnnouncementScreen}
              options={{ title: 'New Announcement' }}
            />
            <Stack.Screen
              name="TeacherAttendance"
              component={TeacherAttendanceScreen}
              options={{ title: 'Attendance Report' }}
            />
            <Stack.Screen
              name="ReviewAbsences"
              component={ReviewAbsencesScreen}
              options={{ title: 'Review Absences' }}
            />
            <Stack.Screen
              name="TeacherGrades"
              component={TeacherGradesScreen}
              options={{ title: 'Course Grades' }}
            />
            <Stack.Screen
              name="CheatingReports"
              component={CheatingReportsScreen}
              options={{ title: 'Cheating Flags' }}
            />
            <Stack.Screen
              name="SubmitFeedback"
              component={SubmitFeedbackScreen}
              options={{ title: 'Submit Feedback' }}
            />
            <Stack.Screen
              name="StudentGrades"
              component={StudentGradesScreen}
              options={{ title: 'My Grades' }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: 'Notifications' }}
            />
            <Stack.Screen
              name="Exam"
              component={ExamScreen}
              options={({ route }: any) => ({
                title: route.params?.subjectName
                  ? `Exam – ${route.params.subjectName}`
                  : 'Exam',
                headerBackVisible: false,
              })}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'Profile & Settings' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Welcome"
              component={WelcomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
        <Stack.Screen
          name="TeacherRequirements"
          component={TeacherRequirementsScreen}
          options={{ title: 'Course Requirements' }}
        />
        <Stack.Screen
          name="ActiveAttendance"
          component={ActiveAttendanceScreen}
          options={{ title: 'Live Attendance' }}
        />
        <Stack.Screen
          name="ActiveQrAttendance"
          component={ActiveQrAttendanceScreen}
          options={{ title: 'QR Attendance' }}
        />
        <Stack.Screen
          name="TeacherFeedback"
          component={TeacherFeedbackScreen}
          options={{ title: 'Course Feedback' }}
        />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
