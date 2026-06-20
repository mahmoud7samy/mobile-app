import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = 'expo-push-token';

// Detect if we are running inside Expo Go.
// Expo Go SDK 53+ removed Android remote push notifications entirely.
// Attempting to use expo-notifications in Expo Go crashes the app.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

/**
 * Unregister the stored Expo push token from the backend.
 * Call this BEFORE clearing the auth token (on logout).
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!token) return;

    const { getAuthToken } = await import('./store');
    const api = (await import('./api')).default;
    const authToken = getAuthToken();
    if (!authToken) return;

    await api.post(
      '/notifications/expo/unregister',
      { token },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    console.log('[PushNotifications] Token unregistered from backend.');
  } catch (err) {
    console.warn('[PushNotifications] Failed to unregister token:', err);
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  }
}

/**
 * Sets up the foreground notification handler, registers the device's Expo
 * push token with the backend, and handles notification tap navigation.
 *
 * ⚠️  This is a NO-OP when running inside Expo Go (SDK 53+). To test push
 *     notifications on Android, run:  npx expo run:android
 */
export function usePushNotifications(enabled: boolean, navigationRef?: any) {
  const responseListenerRef = useRef<any>(null);

  useEffect(() => {
    // Skip everything when running in Expo Go – avoids the SDK 53 crash.
    if (!enabled || IS_EXPO_GO) {
      if (IS_EXPO_GO) {
        console.log('[usePushNotifications] Skipped – push notifications are not supported in Expo Go SDK 53+. Use a development build.');
      }
      return;
    }

    // Dynamically import expo-notifications ONLY in a real native build.
    // This prevents the module from even loading in Expo Go.
    const setup = async () => {
      try {
        console.log('[PushNotifications] Starting setup...');
        const Notifications = await import('expo-notifications');
        const api = (await import('./api')).default;
        const { getAuthToken } = await import('./store');

        // Show alerts + sound + badge for foreground notifications
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          }),
        });

        // Handle notification tap — navigate to Notifications screen
        if (responseListenerRef.current) {
          Notifications.removeNotificationSubscription(responseListenerRef.current);
        }
        responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            console.log('[PushNotifications] Notification tapped:', response.notification.request.content);
            try {
              if (navigationRef?.current?.isReady()) {
                navigationRef.current.navigate('Notifications');
              }
            } catch (navErr) {
              console.warn('[PushNotifications] Navigation on tap failed:', navErr);
            }
          },
        );

        // Request permission
        const { status: existing } = await Notifications.getPermissionsAsync();
        console.log('[PushNotifications] Existing permission status:', existing);
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
          console.log('[PushNotifications] Requested permission, result:', status);
        }
        if (finalStatus !== 'granted') {
          console.warn('[PushNotifications] Permission not granted. Aborting.');
          return;
        }

        // Android notification channel (required for background delivery)
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
          });
          console.log('[PushNotifications] Android channel created.');
        }

        // Get the Expo push token
        let token: string | undefined;
        try {
          const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ??
            Constants.easConfig?.projectId;
          console.log('[PushNotifications] Using projectId:', projectId);
          const result = projectId
            ? await Notifications.getExpoPushTokenAsync({ projectId })
            : await Notifications.getExpoPushTokenAsync();
          token = result.data;
          console.log('[PushNotifications] Got Expo push token:', token);
        } catch (tokenErr) {
          console.warn('[PushNotifications] getExpoPushTokenAsync failed:', tokenErr);
          try {
            const deviceToken = await Notifications.getDevicePushTokenAsync();
            token = deviceToken.data as string;
            console.log('[PushNotifications] Got device push token:', token);
          } catch (deviceErr) {
            console.warn('[PushNotifications] getDevicePushTokenAsync also failed:', deviceErr);
          }
        }

        if (!token) {
          console.warn('[PushNotifications] No token — cannot register with backend.');
          return;
        }

        // Check if we already registered this exact token — skip redundant calls
        const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
        if (storedToken === token) {
          console.log('[PushNotifications] Token already registered, skipping.');
          return;
        }

        // Register token with backend
        console.log('[PushNotifications] Registering token with backend...');
        await api.post(
          '/notifications/expo/register',
          { token },
          { headers: { Authorization: `Bearer ${getAuthToken()}` } },
        );

        // Persist token locally so we can unregister on logout
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
        console.log('[PushNotifications] Token registered successfully!');
      } catch (err) {
        // Never crash the app – push is best-effort
        console.warn('[PushNotifications] Error during setup:', err);
      }
    };

    setup();

    return () => {
      // Clean up notification response listener on unmount
      if (responseListenerRef.current) {
        import('expo-notifications').then((Notifications) => {
          Notifications.removeNotificationSubscription(responseListenerRef.current);
          responseListenerRef.current = null;
        }).catch(() => {});
      }
    };
  }, [enabled]);
}
