import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface Props {
  onComplete: (preferences: {
    industries: string[];
    geographies: string[];
  }) => void;
}

const INDUSTRIES = [
  { id: 'technology', label: 'Technology', emoji: '' },
  { id: 'financials', label: 'Financials', emoji: '' },
  { id: 'healthcare', label: 'Healthcare', emoji: '' },
  { id: 'consumer', label: 'Consumer', emoji: '' },
  { id: 'industrials', label: 'Industrials', emoji: '' },
  { id: 'energy', label: 'Energy', emoji: '' },
  { id: 'materials', label: 'Materials', emoji: '' },
  { id: 'real_estate', label: 'Real Estate', emoji: '' },
  { id: 'utilities', label: 'Utilities', emoji: '' },
  { id: 'telecom', label: 'Telecom', emoji: '' },
];

const GEOGRAPHIES = [
  { id: 'us', label: 'United States', emoji: '' },
  { id: 'europe', label: 'Europe', emoji: '' },
  { id: 'asia', label: 'Asia Pacific', emoji: '' },
  { id: 'latam', label: 'Latin America', emoji: '' },
  { id: 'emerging', label: 'Emerging Markets', emoji: '' },
];

const COLORS = {
  background: '#f9fafb',
  cardBg: '#ffffff',
  textPrimary: '#111827',
  textSecondary: '#4b5563',
  textMuted: '#9ca3af',
  textLight: '#9ca3af',
  accent: '#3b82f6',
  accentSubtle: 'rgba(59, 130, 246, 0.08)',
  divider: '#e5e7eb',
  selected: '#3b82f6',
  selectedBg: 'rgba(59, 130, 246, 0.12)',
};

export function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState<'industries' | 'geographies'>('industries');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedGeographies, setSelectedGeographies] = useState<string[]>([]);

  const toggleIndustry = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIndustries(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleGeography = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGeographies(prev =>
      prev.includes(id)
        ? prev.filter(g => g !== id)
        : [...prev, id]
    );
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (step === 'industries') {
      setStep('geographies');
    } else {
      onComplete({
        industries: selectedIndustries,
        geographies: selectedGeographies,
      });
    }
  };

  const canContinue = step === 'industries'
    ? selectedIndustries.length > 0
    : selectedGeographies.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepIndicator}>
          {step === 'industries' ? '1 of 2' : '2 of 2'}
        </Text>
        <Text style={styles.title}>
          {step === 'industries'
            ? 'What sectors do you cover?'
            : 'Which regions?'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'industries'
            ? 'Select the industries you follow. We\'ll personalize your feed.'
            : 'Select your geographic focus areas.'}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.optionsContainer}
        showsVerticalScrollIndicator={false}
      >
        {step === 'industries' ? (
          INDUSTRIES.map(industry => (
            <TouchableOpacity
              key={industry.id}
              style={[
                styles.optionCard,
                selectedIndustries.includes(industry.id) && styles.optionCardSelected,
              ]}
              onPress={() => toggleIndustry(industry.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.optionLabel}>{industry.label}</Text>
              {selectedIndustries.includes(industry.id) && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        ) : (
          GEOGRAPHIES.map(geo => (
            <TouchableOpacity
              key={geo.id}
              style={[
                styles.optionCard,
                selectedGeographies.includes(geo.id) && styles.optionCardSelected,
              ]}
              onPress={() => toggleGeography(geo.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.optionLabel}>{geo.label}</Text>
              {selectedGeographies.includes(geo.id) && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step === 'geographies' && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('industries')}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.continueButton,
            !canContinue && styles.continueButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!canContinue}
        >
          <Text style={styles.continueButtonText}>
            {step === 'industries' ? 'Continue' : 'Start Learning'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  stepIndicator: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  optionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.selectedBg,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.cardBg,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  continueButton: {
    flex: 1,
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
