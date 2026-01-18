import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../stores/useStore';
import { offlineStorage } from '../services/offline';

const INDUSTRIES = [
  { id: 'technology', label: 'Technology' },
  { id: 'financials', label: 'Financials' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'consumer', label: 'Consumer' },
  { id: 'industrials', label: 'Industrials' },
  { id: 'energy', label: 'Energy' },
  { id: 'materials', label: 'Materials' },
  { id: 'real_estate', label: 'Real Estate' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'telecom', label: 'Telecom' },
];

const GEOGRAPHIES = [
  { id: 'us', label: 'United States' },
  { id: 'europe', label: 'Europe' },
  { id: 'asia', label: 'Asia Pacific' },
  { id: 'latam', label: 'Latin America' },
  { id: 'emerging', label: 'Emerging Markets' },
];

const COLORS = {
  background: '#f9fafb',
  card: '#ffffff',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  accent: '#3b82f6',
  accentGreen: '#22c55e',
  border: '#e5e7eb',
};

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const {
    savedIds,
    isSubscribed,
    analystProfile,
    setAnalystProfile,
  } = useStore();

  // Coverage editor state
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editIndustries, setEditIndustries] = useState<string[]>([]);
  const [editGeographies, setEditGeographies] = useState<string[]>([]);

  // Learning topics state
  const [learningTopics, setLearningTopics] = useState('');

  useEffect(() => {
    offlineStorage.get<string>('learning_topics').then(topics => {
      if (topics) {
        setLearningTopics(topics);
      }
    });
  }, []);

  const handleSubscribe = () => {
    Alert.alert(
      'SwipeStreet Pro',
      'Unlock unlimited access to all insights\n\n$9.99/month or $79.99/year',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Subscribe', onPress: () => {} },
      ]
    );
  };

  // Coverage editor handlers
  const openProfileEditor = () => {
    setEditIndustries(analystProfile?.industries || []);
    setEditGeographies(analystProfile?.geographies || []);
    setShowProfileEditor(true);
  };

  const saveProfile = async () => {
    await setAnalystProfile({
      industries: editIndustries,
      geographies: editGeographies,
    });
    setShowProfileEditor(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleIndustry = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditIndustries(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleGeography = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditGeographies(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleSaveLearningTopics = async () => {
    const topics = learningTopics.trim();
    await offlineStorage.set('learning_topics', topics);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {/* User Header */}
        <View style={styles.userHeader}>
          <View style={styles.avatarContainer}>
            <Feather name="user" size={32} color={COLORS.textMuted} />
          </View>
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>Your Profile</Text>
              {isSubscribed && (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={styles.userStats}>
              {savedIds.size} saved · {analystProfile?.industries.length || 0} sectors
            </Text>
          </View>
        </View>

        {/* Subscription CTA */}
        {!isSubscribed && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.subscribeButton}
              onPress={handleSubscribe}
            >
              <View>
                <Text style={styles.subscribeButtonText}>Upgrade to Pro</Text>
                <Text style={styles.subscribeSubtext}>Unlimited access to all insights</Text>
              </View>
              <Text style={styles.subscribePrice}>$9.99/mo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Your Coverage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Coverage</Text>

          <TouchableOpacity style={styles.menuItem} onPress={openProfileEditor}>
            <View style={styles.menuItemLeft}>
              <Feather name="briefcase" size={20} color={COLORS.textSecondary} />
              <View style={styles.menuItemInfo}>
                <Text style={styles.menuItemLabel}>Industries & Regions</Text>
                <Text style={styles.menuItemDescription}>
                  {analystProfile?.industries.length || 0} sectors, {analystProfile?.geographies.length || 0} regions
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>

          {analystProfile && (analystProfile.industries.length > 0 || analystProfile.geographies.length > 0) && (
            <View style={styles.tagsContainer}>
              {analystProfile.industries.map(id => {
                const industry = INDUSTRIES.find(i => i.id === id);
                return industry ? (
                  <View key={id} style={styles.tag}>
                    <Text style={styles.tagText}>{industry.label}</Text>
                  </View>
                ) : null;
              })}
              {analystProfile.geographies.map(id => {
                const geo = GEOGRAPHIES.find(g => g.id === id);
                return geo ? (
                  <View key={id} style={[styles.tag, styles.tagGeo]}>
                    <Text style={styles.tagText}>{geo.label}</Text>
                  </View>
                ) : null;
              })}
            </View>
          )}
        </View>

        {/* Learning Topics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What do you want to learn?</Text>

          <TextInput
            style={[styles.input, styles.topicsInput]}
            placeholder="e.g., valuation methods, how to analyze semiconductors, what makes a good moat"
            placeholderTextColor={COLORS.textMuted}
            value={learningTopics}
            onChangeText={setLearningTopics}
            autoCapitalize="sentences"
            autoCorrect
            multiline
            numberOfLines={3}
            onBlur={handleSaveLearningTopics}
          />
        </View>

        {/* Navigation Menu */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('SavedCards')}
          >
            <View style={styles.menuItemLeft}>
              <Feather name="bookmark" size={20} color={COLORS.textSecondary} />
              <Text style={styles.menuItemLabel}>Saved</Text>
            </View>
            <View style={styles.menuItemRight}>
              {savedIds.size > 0 && (
                <Text style={styles.menuItemCount}>{savedIds.size}</Text>
              )}
              <Feather name="chevron-right" size={20} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Settings')}
          >
            <View style={styles.menuItemLeft}>
              <Feather name="settings" size={20} color={COLORS.textSecondary} />
              <Text style={styles.menuItemLabel}>Settings</Text>
            </View>
            <Feather name="chevron-right" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Profile Editor Modal */}
      <Modal
        visible={showProfileEditor}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProfileEditor(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Coverage</Text>
            <TouchableOpacity onPress={saveProfile}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalSectionTitle}>Industries</Text>
            <View style={styles.optionsGrid}>
              {INDUSTRIES.map(industry => (
                <TouchableOpacity
                  key={industry.id}
                  style={[
                    styles.optionChip,
                    editIndustries.includes(industry.id) && styles.optionChipSelected,
                  ]}
                  onPress={() => toggleIndustry(industry.id)}
                >
                  <Text style={[
                    styles.optionChipText,
                    editIndustries.includes(industry.id) && styles.optionChipTextSelected,
                  ]}>
                    {industry.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalSectionTitle}>Regions</Text>
            <View style={styles.optionsGrid}>
              {GEOGRAPHIES.map(geo => (
                <TouchableOpacity
                  key={geo.id}
                  style={[
                    styles.optionChip,
                    editGeographies.includes(geo.id) && styles.optionChipSelected,
                  ]}
                  onPress={() => toggleGeography(geo.id)}
                >
                  <Text style={[
                    styles.optionChipText,
                    editGeographies.includes(geo.id) && styles.optionChipTextSelected,
                  ]}>
                    {geo.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  // User Header
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  proBadge: {
    backgroundColor: COLORS.accentGreen,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  userStats: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  // Sections
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  // Subscription
  subscribeButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  subscribeSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  subscribePrice: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Menu Items
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemLabel: {
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  menuItemDescription: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  menuItemCount: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagGeo: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  tagText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  // Learning Topics
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  topicsInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCancel: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accent,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionChipSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  optionChipText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  optionChipTextSelected: {
    color: '#FFFFFF',
  },
});
