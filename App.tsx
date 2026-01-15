import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

import { FeedScreen } from './src/screens/FeedScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { api } from './src/services/api';
import { useStore } from './src/stores/useStore';

const Tab = createBottomTabNavigator();

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
  background: '#EDEAE5',
  card: '#F9F8F6',
  textPrimary: '#1C1C1C',
  textSecondary: '#4D4D4D',
  textMuted: '#7A7A7A',
  textLight: '#A8A8A8',
  textFaint: '#D0D0D0',
  accent: '#A84820',
  divider: '#DDD9D3',
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

// Simple tab icons using text
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Feed: '|||',
    Settings: '@',
  };

  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabIconText, focused && styles.tabIconFocused]}>
        {icons[name] || '?'}
      </Text>
    </View>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const { hasCompletedOnboarding, checkOnboarding, setAnalystProfile, init, syncCards } = useStore();

  useEffect(() => {
    // Initialize API and check onboarding
    const initApp = async () => {
      await api.init();
      await checkOnboarding();
      await init();

      setIsLoading(false);

      // Generate a simple device ID and sync after auth
      const deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
            <Tab.Screen name="Feed" component={FeedScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
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
    shadowOpacity: 0,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconText: {
    fontSize: 15,
    color: COLORS.textFaint,
  },
  tabIconFocused: {
    color: COLORS.accent,
  },
});
