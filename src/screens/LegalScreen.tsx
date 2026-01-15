import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  background: '#EDEAE5',
  cardBg: '#F9F8F6',
  textPrimary: '#1C1C1C',
  textSecondary: '#4D4D4D',
  textMuted: '#7A7A7A',
  accent: '#A84820',
  divider: '#DDD9D3',
};

interface Props {
  type: 'terms' | 'privacy';
  onClose: () => void;
}

export function LegalScreen({ type, onClose }: Props) {
  const isTerms = type === 'terms';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isTerms ? 'Terms of Service' : 'Privacy Policy'}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isTerms ? <TermsContent /> : <PrivacyContent />}
      </ScrollView>
    </SafeAreaView>
  );
}

function TermsContent() {
  return (
    <View style={styles.section}>
      <Text style={styles.lastUpdated}>Last updated: January 2025</Text>

      <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
      <Text style={styles.paragraph}>
        By accessing or using SwipeStreet ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.
      </Text>

      <Text style={styles.sectionTitle}>2. Description of Service</Text>
      <Text style={styles.paragraph}>
        SwipeStreet provides educational content about investing and financial markets through a mobile application. The content is presented in a card-based format designed for learning purposes.
      </Text>

      <Text style={styles.sectionTitle}>3. Not Financial Advice</Text>
      <Text style={styles.paragraph}>
        THE CONTENT PROVIDED IN THIS APP IS FOR EDUCATIONAL AND INFORMATIONAL PURPOSES ONLY AND SHOULD NOT BE CONSTRUED AS FINANCIAL, INVESTMENT, TAX, OR LEGAL ADVICE.
      </Text>
      <Text style={styles.paragraph}>
        We do not provide personalized investment recommendations. Any investment decisions you make are solely your responsibility. Past performance is not indicative of future results. You should consult with qualified professionals before making any financial decisions.
      </Text>

      <Text style={styles.sectionTitle}>4. User Accounts</Text>
      <Text style={styles.paragraph}>
        You may need to create an account to access certain features. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
      </Text>

      <Text style={styles.sectionTitle}>5. Subscription and Payments</Text>
      <Text style={styles.paragraph}>
        Some features require a paid subscription. Subscriptions automatically renew unless cancelled at least 24 hours before the renewal date. You can manage your subscription through your device's app store settings.
      </Text>

      <Text style={styles.sectionTitle}>6. Intellectual Property</Text>
      <Text style={styles.paragraph}>
        All content in the App, including text, graphics, and software, is owned by SwipeStreet or its licensors and is protected by intellectual property laws. You may not reproduce, distribute, or create derivative works without permission.
      </Text>

      <Text style={styles.sectionTitle}>7. User Conduct</Text>
      <Text style={styles.paragraph}>
        You agree not to: (a) use the App for any unlawful purpose; (b) attempt to gain unauthorized access to the App; (c) interfere with the App's operation; (d) share your account with others.
      </Text>

      <Text style={styles.sectionTitle}>8. Limitation of Liability</Text>
      <Text style={styles.paragraph}>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, SWIPESTREET SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES.
      </Text>

      <Text style={styles.sectionTitle}>9. Disclaimer of Warranties</Text>
      <Text style={styles.paragraph}>
        THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT ANY CONTENT IS ACCURATE OR COMPLETE.
      </Text>

      <Text style={styles.sectionTitle}>10. Changes to Terms</Text>
      <Text style={styles.paragraph}>
        We may modify these terms at any time. Continued use of the App after changes constitutes acceptance of the new terms.
      </Text>

      <Text style={styles.sectionTitle}>11. Termination</Text>
      <Text style={styles.paragraph}>
        We may terminate or suspend your access to the App at any time, without notice, for any reason, including violation of these terms.
      </Text>

      <Text style={styles.sectionTitle}>12. Contact</Text>
      <Text style={styles.paragraph}>
        For questions about these terms, contact us at legal@swipestreet.app
      </Text>
    </View>
  );
}

function PrivacyContent() {
  return (
    <View style={styles.section}>
      <Text style={styles.lastUpdated}>Last updated: January 2025</Text>

      <Text style={styles.sectionTitle}>1. Information We Collect</Text>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>Account Information:</Text> When you create an account, we collect your email address and device identifier.
      </Text>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>Usage Data:</Text> We collect information about how you use the App, including cards viewed, saved items, and preferences.
      </Text>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>Device Information:</Text> We collect device type, operating system, and app version for analytics and troubleshooting.
      </Text>

      <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
      <Text style={styles.paragraph}>
        We use your information to: (a) provide and personalize the service; (b) improve our content recommendations; (c) process payments; (d) communicate with you about your account; (e) analyze usage patterns to improve the App.
      </Text>

      <Text style={styles.sectionTitle}>3. Data Sharing</Text>
      <Text style={styles.paragraph}>
        We do not sell your personal information. We may share data with: (a) service providers who help operate the App; (b) payment processors for subscription management; (c) analytics providers to improve our service.
      </Text>

      <Text style={styles.sectionTitle}>4. Data Security</Text>
      <Text style={styles.paragraph}>
        We implement industry-standard security measures to protect your data. However, no method of electronic transmission is 100% secure.
      </Text>

      <Text style={styles.sectionTitle}>5. Your Rights</Text>
      <Text style={styles.paragraph}>
        You have the right to: (a) access your personal data; (b) correct inaccurate data; (c) delete your account and data; (d) export your data; (e) opt out of marketing communications.
      </Text>
      <Text style={styles.paragraph}>
        To exercise these rights, go to Settings → Data → Export or Delete, or contact privacy@swipestreet.app
      </Text>

      <Text style={styles.sectionTitle}>6. Data Retention</Text>
      <Text style={styles.paragraph}>
        We retain your data as long as your account is active. Upon account deletion, we remove your personal data within 30 days, except where retention is required by law.
      </Text>

      <Text style={styles.sectionTitle}>7. Children's Privacy</Text>
      <Text style={styles.paragraph}>
        The App is not intended for users under 18. We do not knowingly collect information from children.
      </Text>

      <Text style={styles.sectionTitle}>8. International Users</Text>
      <Text style={styles.paragraph}>
        If you are accessing the App from outside the United States, your data may be transferred to and processed in the US. By using the App, you consent to this transfer.
      </Text>

      <Text style={styles.sectionTitle}>9. California Privacy Rights (CCPA)</Text>
      <Text style={styles.paragraph}>
        California residents have the right to: know what personal information is collected; request deletion of personal information; opt out of sale of personal information (we do not sell personal data); non-discrimination for exercising privacy rights.
      </Text>

      <Text style={styles.sectionTitle}>10. European Privacy Rights (GDPR)</Text>
      <Text style={styles.paragraph}>
        EU residents have additional rights including: data portability; right to object to processing; right to withdraw consent. Contact privacy@swipestreet.app to exercise these rights.
      </Text>

      <Text style={styles.sectionTitle}>11. Changes to This Policy</Text>
      <Text style={styles.paragraph}>
        We may update this policy periodically. We will notify you of significant changes through the App or by email.
      </Text>

      <Text style={styles.sectionTitle}>12. Contact Us</Text>
      <Text style={styles.paragraph}>
        For privacy-related inquiries: privacy@swipestreet.app
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.cardBg,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.accent,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});
