import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useStore } from '../stores/useStore';
import { offlineStorage, AnalystProfile } from '../services/offline';

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

// Warm color palette
const COLORS = {
  background: '#FAF9F7',
  card: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted: '#9B9B9B',
  accent: '#E85D04',
  accentGreen: '#2D5A27',
  border: '#E8E6E3',
  danger: '#DC2626',
};

export function SettingsScreen() {
  const { isSubscribed, syncCards, analystProfile, setAnalystProfile } = useStore();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editIndustries, setEditIndustries] = useState<string[]>([]);
  const [editGeographies, setEditGeographies] = useState<string[]>([]);

  useEffect(() => {
    offlineStorage.getLastSync().then(setLastSync);
  }, []);

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

  const handleSync = async () => {
    try {
      await syncCards();
      const sync = await offlineStorage.getLastSync();
      setLastSync(sync);
      Alert.alert('Success', 'Refresh complete');
    } catch (e) {
      Alert.alert('Error', 'Refresh failed');
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will remove all saved cards and progress. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await offlineStorage.clearAll();
            Alert.alert('Done', 'All data cleared');
          },
        },
      ]
    );
  };

  const handleSubscribe = () => {
    // TODO: Implement RevenueCat subscription flow
    Alert.alert(
      'SwipeStreet Pro',
      'Unlock unlimited access to all insights\n\n$9.99/month or $79.99/year',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Subscribe', onPress: () => {} },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          {isSubscribed ? (
            <View style={styles.subscriptionBadge}>
              <Text style={styles.subscriptionText}>PRO</Text>
              <Text style={styles.subscriptionSubtext}>
                Unlimited access active
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.subscribeButton}
              onPress={handleSubscribe}
            >
              <Text style={styles.subscribeButtonText}>
                Upgrade to Pro
              </Text>
              <Text style={styles.subscribePrice}>$9.99/mo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Coverage Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Coverage</Text>

          <TouchableOpacity style={styles.profileButton} onPress={openProfileEditor}>
            <View style={styles.profileInfo}>
              <Text style={styles.settingLabel}>Industries & Regions</Text>
              <Text style={styles.settingDescription}>
                {analystProfile?.industries.length || 0} sectors, {analystProfile?.geographies.length || 0} regions
              </Text>
            </View>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>

          {analystProfile && (
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

        {/* Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>

          <TouchableOpacity style={styles.button} onPress={handleSync}>
            <Text style={styles.buttonText}>Refresh</Text>
            {lastSync && (
              <Text style={styles.buttonSubtext}>
                Last: {new Date(lastSync).toLocaleDateString()}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={handleClearData}
          >
            <Text style={[styles.buttonText, styles.dangerText]}>
              Clear All Data
            </Text>
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  content: {
    flex: 1,
  },
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
  subscriptionBadge: {
    backgroundColor: COLORS.accentGreen,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  subscriptionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  subscriptionSubtext: {
    color: '#D1FAE5',
    fontSize: 14,
    marginTop: 4,
  },
  subscribeButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
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
  subscribePrice: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  settingLabel: {
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  settingDescription: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  button: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  buttonSubtext: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  dangerButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  dangerText: {
    color: COLORS.danger,
  },
  // Profile section
  profileButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  profileInfo: {
    flex: 1,
  },
  editText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(232, 93, 4, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagGeo: {
    backgroundColor: 'rgba(45, 90, 39, 0.1)',
  },
  tagText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
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
