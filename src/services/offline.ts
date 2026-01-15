import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card } from '../types';

const CARDS_KEY = 'offline_cards';
const SAVED_KEY = 'saved_card_ids';
const SEEN_KEY = 'seen_card_ids';
const DISLIKED_KEY = 'disliked_card_ids';
const PREFERENCES_KEY = 'user_preferences';
const ANALYST_PROFILE_KEY = 'analyst_profile';
const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';
const LAST_SYNC_KEY = 'last_sync';

// Analyst profile from onboarding
export interface AnalystProfile {
  industries: string[];
  geographies: string[];
}

// Preference scores for categories, types, and tickers
export interface UserPreferences {
  categoryScores: Record<string, number>;
  typeScores: Record<string, number>;
  tickerScores: Record<string, number>;
  lastUpdated: string;
}

class OfflineStorage {
  // Cards
  async saveCards(cards: Card[]): Promise<void> {
    await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(cards));
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  }

  async getCards(): Promise<Card[]> {
    const data = await AsyncStorage.getItem(CARDS_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((card) => ({
      ...card,
      categories: Array.isArray(card.categories) ? card.categories : [],
      tickers: Array.isArray(card.tickers) ? card.tickers : [],
    }));
  }

  async getLastSync(): Promise<string | null> {
    return AsyncStorage.getItem(LAST_SYNC_KEY);
  }

  // Saved cards
  async getSavedIds(): Promise<Set<string>> {
    const data = await AsyncStorage.getItem(SAVED_KEY);
    return new Set(data ? JSON.parse(data) : []);
  }

  async addSavedId(cardId: string): Promise<void> {
    const saved = await this.getSavedIds();
    saved.add(cardId);
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
  }

  async removeSavedId(cardId: string): Promise<void> {
    const saved = await this.getSavedIds();
    saved.delete(cardId);
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
  }

  // Seen cards
  async getSeenIds(): Promise<Set<string>> {
    const data = await AsyncStorage.getItem(SEEN_KEY);
    return new Set(data ? JSON.parse(data) : []);
  }

  async addSeenId(cardId: string): Promise<void> {
    const seen = await this.getSeenIds();
    seen.add(cardId);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  }

  // Get saved cards
  async getSavedCards(): Promise<Card[]> {
    const cards = await this.getCards();
    const savedIds = await this.getSavedIds();
    return cards.filter(c => savedIds.has(c.id));
  }

  // Get unseen cards
  async getUnseenCards(): Promise<Card[]> {
    const cards = await this.getCards();
    const seenIds = await this.getSeenIds();
    return cards.filter(c => !seenIds.has(c.id));
  }

  // Disliked cards
  async getDislikedIds(): Promise<Set<string>> {
    const data = await AsyncStorage.getItem(DISLIKED_KEY);
    return new Set(data ? JSON.parse(data) : []);
  }

  async addDislikedId(cardId: string): Promise<void> {
    const disliked = await this.getDislikedIds();
    disliked.add(cardId);
    await AsyncStorage.setItem(DISLIKED_KEY, JSON.stringify([...disliked]));
  }

  // User preferences
  async getPreferences(): Promise<UserPreferences> {
    const data = await AsyncStorage.getItem(PREFERENCES_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      const normalizeScores = (scores: Record<string, unknown>) => {
        const normalized: Record<string, number> = {};
        Object.entries(scores || {}).forEach(([key, value]) => {
          const num = Number(value);
          normalized[key] = Number.isFinite(num) ? num : 0;
        });
        return normalized;
      };

      return {
        categoryScores: normalizeScores(parsed.categoryScores || {}),
        typeScores: normalizeScores(parsed.typeScores || {}),
        tickerScores: normalizeScores(parsed.tickerScores || {}),
        lastUpdated: typeof parsed.lastUpdated === 'string'
          ? parsed.lastUpdated
          : new Date().toISOString(),
      };
    }
    return {
      categoryScores: {},
      typeScores: {},
      tickerScores: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  async savePreferences(prefs: UserPreferences): Promise<void> {
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify({
      ...prefs,
      lastUpdated: new Date().toISOString(),
    }));
  }

  // Analyst profile
  async getAnalystProfile(): Promise<AnalystProfile | null> {
    const data = await AsyncStorage.getItem(ANALYST_PROFILE_KEY);
    return data ? JSON.parse(data) : null;
  }

  async saveAnalystProfile(profile: AnalystProfile): Promise<void> {
    await AsyncStorage.setItem(ANALYST_PROFILE_KEY, JSON.stringify(profile));
  }

  // Onboarding state
  async isOnboardingComplete(): Promise<boolean> {
    const data = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return data === 'true';
  }

  async setOnboardingComplete(): Promise<void> {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  }

  // Clear all data
  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      CARDS_KEY, SAVED_KEY, SEEN_KEY, DISLIKED_KEY,
      PREFERENCES_KEY, ANALYST_PROFILE_KEY, ONBOARDING_COMPLETE_KEY, LAST_SYNC_KEY
    ]);
  }
}

export const offlineStorage = new OfflineStorage();
