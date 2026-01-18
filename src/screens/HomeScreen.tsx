import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedScreen } from './FeedScreen';
import { LearnScreen } from './LearnScreen';
import { IdeasScreen } from './IdeasScreen';
import { trackScreen } from '../services/analytics';

type TabKey = 'forYou' | 'learn' | 'ideas';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'forYou', label: 'For You' },
  { key: 'learn', label: 'Learn' },
  { key: 'ideas', label: 'Ideas' },
];

const COLORS = {
  background: '#f9fafb',
  textPrimary: '#111827',
  textMuted: '#6b7280',
  accent: '#3b82f6',
  accentSubtle: 'rgba(59, 130, 246, 0.12)',
  divider: '#e5e7eb',
};

export function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('forYou');

  useEffect(() => {
    const screenName = activeTab === 'forYou'
      ? 'For You'
      : activeTab === 'learn'
        ? 'Learn'
        : 'Ideas';
    trackScreen(screenName);
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={({ pressed }) => [
                styles.tabButton,
                isActive && styles.tabButtonActive,
                pressed && styles.tabButtonPressed,
              ]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.content}>
        <View
          style={[styles.screen, activeTab === 'forYou' ? styles.screenActive : styles.screenHidden]}
          pointerEvents={activeTab === 'forYou' ? 'auto' : 'none'}
        >
          <FeedScreen />
        </View>
        <View
          style={[styles.screen, activeTab === 'learn' ? styles.screenActive : styles.screenHidden]}
          pointerEvents={activeTab === 'learn' ? 'auto' : 'none'}
        >
          <LearnScreen />
        </View>
        <View
          style={[styles.screen, activeTab === 'ideas' ? styles.screenActive : styles.screenHidden]}
          pointerEvents={activeTab === 'ideas' ? 'auto' : 'none'}
        >
          <IdeasScreen />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingTop: 8,
    paddingBottom: 10,
  },
  tabButton: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
  },
  tabButtonActive: {
    backgroundColor: COLORS.accentSubtle,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  tabButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.85,
  },
  tabText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tabTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  screen: {
    ...StyleSheet.absoluteFillObject,
  },
  screenActive: {
    opacity: 1,
  },
  screenHidden: {
    opacity: 0,
  },
});
