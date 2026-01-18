import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { HomeScreen } from './src/screens/HomeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SavedCardsScreen } from './src/screens/SavedCardsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { api } from './src/services/api';
import { offlineStorage } from './src/services/offline';
import { initAnalytics, setAnalyticsContext } from './src/services/analytics';
import { useStore } from './src/stores/useStore';

const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();

if (__DEV__) {
  const errorUtils = (global as any)?.ErrorUtils;
  if (errorUtils?.getGlobalHandler && errorUtils?.setGlobalHandler) {
    const defaultHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
      console.log('[GlobalError]', { message: error.message, isFatal, stack: error.stack });
      defaultHandler(error, isFatal);
    });
  }
}

// Refined color palette
const COLORS = {
  background: '#f9fafb',
  card: '#ffffff',
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  textFaint: '#9ca3af',
  accent: '#3b82f6',
  divider: '#e5e7eb',
};

// Light theme for the app
const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.accent,
    background: COLORS.background,
    card: COLORS.card,
    text: COLORS.textPrimary,
    border: COLORS.divider,
    notification: COLORS.accent,
  },
};

// Profile stack navigator
function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen
        name="SavedCards"
        component={SavedCardsScreen}
        options={{
          headerShown: true,
          headerTitle: 'Saved',
          headerBackTitle: 'Profile',
          headerStyle: { backgroundColor: COLORS.background },
          headerShadowVisible: false,
        }}
      />
      <ProfileStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          headerTitle: 'Settings',
          headerBackTitle: 'Profile',
          headerStyle: { backgroundColor: COLORS.background },
          headerShadowVisible: false,
        }}
      />
    </ProfileStack.Navigator>
  );
}

// Simple tab icons using text
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
    Home: 'home',
    Profile: 'user',
  };
  const iconName = iconMap[name] || 'circle';

  return (
    <View style={styles.tabIcon}>
      <Feather
        name={iconName}
        size={20}
        color={focused ? COLORS.accent : COLORS.textLight}
      />
    </View>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const { hasCompletedOnboarding, checkOnboarding, setAnalystProfile, init, syncCards } = useStore();

  useEffect(() => {
    // Initialize API and check onboarding
    const initApp = async () => {
      initAnalytics();
      await api.init();
      const experimentVariant = await offlineStorage.getOrCreateExperimentVariant();
      const deviceId = await offlineStorage.getOrCreateDeviceId();
      setAnalyticsContext({ device_id: deviceId, experiment_variant: experimentVariant });
      await checkOnboarding();
      await init();

      setIsLoading(false);

      // Generate a simple device ID and sync after auth
      try {
        await api.register(deviceId);
        await syncCards();
      } catch (e) {
        // Offline mode
        console.log('Running in offline mode');
      }
    };

    initApp();
  }, []);

  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (!hasCompletedOnboarding) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <OnboardingScreen
            onComplete={(preferences) => {
              setAnalystProfile(preferences);
            }}
          />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={LightTheme}>
          <StatusBar style="dark" />
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarStyle: styles.tabBar,
              tabBarActiveTintColor: COLORS.accent,
              tabBarInactiveTintColor: COLORS.textFaint,
              tabBarIcon: ({ focused }) => (
                <TabIcon name={route.name} focused={focused} />
              ),
            })}
          >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Profile" component={ProfileStackScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  tabBar: {
    backgroundColor: COLORS.card,
    borderTopColor: COLORS.divider,
    borderTopWidth: 1,
    height: 68,
    paddingTop: 6,
    elevation: 0,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
