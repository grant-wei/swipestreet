import * as Sentry from '@sentry/react-native';
import { api } from './api';

// Initialize Sentry for crash reporting
export function initAnalytics() {
  if (!__DEV__) {
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      tracesSampleRate: 0.2,
    });
  }
}

// Track custom events
export async function trackEvent(
  eventName: string,
  properties?: Record<string, any>
) {
  // Don't track in development
  if (__DEV__) {
    console.log('[Analytics]', eventName, properties);
    return;
  }

  try {
    // Send to backend for aggregation
    await api.trackEvent(eventName, properties);
  } catch (error) {
    // Silent fail - analytics shouldn't break the app
    console.warn('Analytics error:', error);
  }
}

// Track screen views
export function trackScreen(screenName: string) {
  trackEvent('screen_view', { screen: screenName });
}

// Track card interactions
export function trackCardAction(
  cardId: string,
  action: 'swipe_left' | 'swipe_right' | 'save' | 'unsave' | 'chat_opened'
) {
  trackEvent('card_action', { card_id: cardId, action });
}

// Track onboarding completion
export function trackOnboardingComplete(profile: {
  industries: string[];
  geographies: string[];
}) {
  trackEvent('onboarding_complete', {
    industry_count: profile.industries.length,
    geography_count: profile.geographies.length,
  });
}

// Track subscription events
export function trackSubscription(
  action: 'started' | 'completed' | 'cancelled',
  plan?: string
) {
  trackEvent('subscription', { action, plan });
}

// Set user context for crash reports
export function setUserContext(userId: string, email?: string) {
  if (!__DEV__) {
    Sentry.setUser({ id: userId, email });
  }
}

// Clear user context on logout
export function clearUserContext() {
  if (!__DEV__) {
    Sentry.setUser(null);
  }
}

// Capture exceptions manually
export function captureException(error: Error, context?: Record<string, any>) {
  if (__DEV__) {
    console.error('[Error]', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
}
