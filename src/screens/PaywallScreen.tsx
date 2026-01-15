import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  onSubscribe: (plan: 'monthly' | 'yearly') => void;
  onClose: () => void;
}

export function PaywallScreen({ onSubscribe, onClose }: Props) {
  const features = [
    { title: 'Unlimited Cards', description: 'Access all 1000+ insights' },
    { title: 'Offline Mode', description: 'Learn anywhere, no internet needed' },
    { title: 'Daily Digest', description: 'Morning notification with top 5 insights' },
    { title: 'Quiz Mode', description: 'Test your knowledge and track progress' },
    { title: 'New Content Weekly', description: 'Fresh insights from latest research' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeText}>X</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>SwipeStreet</Text>
          <Text style={styles.proLabel}>PRO</Text>
        </View>

        <Text style={styles.headline}>
          Unlock Wall Street Wisdom
        </Text>
        <Text style={styles.subheadline}>
          Get unlimited access to institutional research distilled into
          tweet-sized insights
        </Text>

        {/* Features */}
        <View style={styles.features}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>OK</Text>
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing */}
        <View style={styles.pricing}>
          <TouchableOpacity
            style={[styles.planCard, styles.planCardRecommended]}
            onPress={() => onSubscribe('yearly')}
          >
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>SAVE 33%</Text>
            </View>
            <Text style={styles.planName}>Yearly</Text>
            <Text style={styles.planPrice}>$79.99</Text>
            <Text style={styles.planPeriod}>per year</Text>
            <Text style={styles.planBreakdown}>$6.67/month</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.planCard}
            onPress={() => onSubscribe('monthly')}
          >
            <Text style={styles.planName}>Monthly</Text>
            <Text style={styles.planPrice}>$9.99</Text>
            <Text style={styles.planPeriod}>per month</Text>
          </TouchableOpacity>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => onSubscribe('yearly')}
        >
          <Text style={styles.ctaText}>Start 7-Day Free Trial</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Cancel anytime. Subscription auto-renews unless cancelled at least 24
          hours before the end of the current period.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 24,
    paddingTop: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logo: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  proLabel: {
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  headline: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  subheadline: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  features: {
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  featureDescription: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 2,
  },
  pricing: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  planCardRecommended: {
    borderColor: '#3B82F6',
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  saveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  planName: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 8,
  },
  planPrice: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  planPeriod: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  planBreakdown: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  ctaButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  disclaimer: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
