import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { v4 as uuidv4 } from 'uuid';
import { Card } from '../types';

const CARDS_KEY = 'offline_cards';
const CARDS_SOURCE_KEY = 'offline_cards_source';
const CARDS_VERSION_KEY = 'offline_cards_bundle_version';
const SAVED_KEY = 'saved_card_ids';
const LIKED_KEY = 'liked_card_ids';
const SEEN_KEY = 'seen_card_ids';
const DISLIKED_KEY = 'disliked_card_ids';
const PREFERENCES_KEY = 'user_preferences';
const ANALYST_PROFILE_KEY = 'analyst_profile';
const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';
const LAST_SYNC_KEY = 'last_sync';
const COMMENTS_KEY = 'card_comments';
const LIKED_COMMENTS_KEY = 'liked_comment_ids';
const DEVICE_ID_KEY = 'device_id';
const EXPERIMENT_VARIANT_KEY = 'experiment_variant';
const COMMENTS_ENABLED_KEY = 'comments_enabled';

export type ExperimentVariant = 'A' | 'B';

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

export interface CommentItem {
  id: string;
  text: string;
  created_at: string;
  likes: number;
  replies: CommentItem[];
  parent_id?: string; // If this is a reply, the parent comment id
}

type CardsSource = 'bundle' | 'api';

class OfflineStorage {
  // Cards
  async saveCards(
    cards: Card[],
    meta?: { source?: CardsSource; bundleVersion?: string }
  ): Promise<void> {
    await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(cards));
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    if (meta?.source) {
      await AsyncStorage.setItem(CARDS_SOURCE_KEY, meta.source);
    }
    if (meta?.bundleVersion) {
      await AsyncStorage.setItem(CARDS_VERSION_KEY, meta.bundleVersion);
    }
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

  async getCardsSource(): Promise<CardsSource | null> {
    const source = await AsyncStorage.getItem(CARDS_SOURCE_KEY);
    return source === 'bundle' || source === 'api' ? source : null;
  }

  async getCardsBundleVersion(): Promise<string | null> {
    return AsyncStorage.getItem(CARDS_VERSION_KEY);
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

  // Liked cards
  async getLikedIds(): Promise<Set<string>> {
    const data = await AsyncStorage.getItem(LIKED_KEY);
    return new Set(data ? JSON.parse(data) : []);
  }

  async addLikedId(cardId: string): Promise<void> {
    const liked = await this.getLikedIds();
    liked.add(cardId);
    await AsyncStorage.setItem(LIKED_KEY, JSON.stringify([...liked]));
  }

  async removeLikedId(cardId: string): Promise<void> {
    const liked = await this.getLikedIds();
    liked.delete(cardId);
    await AsyncStorage.setItem(LIKED_KEY, JSON.stringify([...liked]));
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

  async removeDislikedId(cardId: string): Promise<void> {
    const disliked = await this.getDislikedIds();
    disliked.delete(cardId);
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

  // Comments
  async getComments(cardId: string): Promise<CommentItem[]> {
    const data = await AsyncStorage.getItem(COMMENTS_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    const list = parsed && Array.isArray(parsed[cardId]) ? parsed[cardId] : [];
    // Migrate old comments and filter valid ones
    return list
      .filter((item: any) => item && typeof item.text === 'string')
      .map((item: any) => ({
        id: item.id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text: item.text,
        created_at: item.created_at,
        likes: item.likes || 0,
        replies: Array.isArray(item.replies) ? item.replies : [],
        parent_id: item.parent_id,
      }));
  }

  async addComment(cardId: string, text: string, parentId?: string): Promise<CommentItem[]> {
    const trimmed = text.trim();
    if (!trimmed) return this.getComments(cardId);

    const data = await AsyncStorage.getItem(COMMENTS_KEY);
    const parsed = data ? JSON.parse(data) : {};
    const list = Array.isArray(parsed[cardId]) ? parsed[cardId] : [];

    const newComment: CommentItem = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      created_at: new Date().toISOString(),
      likes: 0,
      replies: [],
      parent_id: parentId,
    };

    if (parentId) {
      // Add as a reply to existing comment
      const addReplyToComment = (comments: CommentItem[]): CommentItem[] => {
        return comments.map((comment) => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newComment],
            };
          }
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: addReplyToComment(comment.replies),
            };
          }
          return comment;
        });
      };
      parsed[cardId] = addReplyToComment(list);
    } else {
      // Add as top-level comment
      parsed[cardId] = [...list, newComment];
    }

    await AsyncStorage.setItem(COMMENTS_KEY, JSON.stringify(parsed));
    return parsed[cardId];
  }

  async likeComment(cardId: string, commentId: string): Promise<CommentItem[]> {
    const data = await AsyncStorage.getItem(COMMENTS_KEY);
    const parsed = data ? JSON.parse(data) : {};
    const list = Array.isArray(parsed[cardId]) ? parsed[cardId] : [];

    const toggleLike = (comments: CommentItem[]): CommentItem[] => {
      return comments.map((comment) => {
        if (comment.id === commentId) {
          return { ...comment, likes: (comment.likes || 0) + 1 };
        }
        if (comment.replies && comment.replies.length > 0) {
          return { ...comment, replies: toggleLike(comment.replies) };
        }
        return comment;
      });
    };

    parsed[cardId] = toggleLike(list);
    await AsyncStorage.setItem(COMMENTS_KEY, JSON.stringify(parsed));
    return parsed[cardId];
  }

  async unlikeComment(cardId: string, commentId: string): Promise<CommentItem[]> {
    const data = await AsyncStorage.getItem(COMMENTS_KEY);
    const parsed = data ? JSON.parse(data) : {};
    const list = Array.isArray(parsed[cardId]) ? parsed[cardId] : [];

    const toggleUnlike = (comments: CommentItem[]): CommentItem[] => {
      return comments.map((comment) => {
        if (comment.id === commentId) {
          return { ...comment, likes: Math.max((comment.likes || 0) - 1, 0) };
        }
        if (comment.replies && comment.replies.length > 0) {
          return { ...comment, replies: toggleUnlike(comment.replies) };
        }
        return comment;
      });
    };

    parsed[cardId] = toggleUnlike(list);
    await AsyncStorage.setItem(COMMENTS_KEY, JSON.stringify(parsed));
    return parsed[cardId];
  }

  // Track which comments the user has liked
  async getLikedCommentIds(): Promise<Set<string>> {
    const data = await AsyncStorage.getItem(LIKED_COMMENTS_KEY);
    return new Set(data ? JSON.parse(data) : []);
  }

  async toggleCommentLike(cardId: string, commentId: string): Promise<{ comments: CommentItem[]; isLiked: boolean }> {
    const likedIds = await this.getLikedCommentIds();
    const wasLiked = likedIds.has(commentId);

    if (wasLiked) {
      likedIds.delete(commentId);
      const comments = await this.unlikeComment(cardId, commentId);
      await AsyncStorage.setItem(LIKED_COMMENTS_KEY, JSON.stringify([...likedIds]));
      return { comments, isLiked: false };
    } else {
      likedIds.add(commentId);
      const comments = await this.likeComment(cardId, commentId);
      await AsyncStorage.setItem(LIKED_COMMENTS_KEY, JSON.stringify([...likedIds]));
      return { comments, isLiked: true };
    }
  }

  // Device ID
  async getOrCreateDeviceId(): Promise<string> {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;

    const next = `device_${uuidv4()}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, next);
    return next;
  }

  async getOrCreateExperimentVariant(): Promise<ExperimentVariant> {
    const existing = await AsyncStorage.getItem(EXPERIMENT_VARIANT_KEY);
    if (existing === 'A' || existing === 'B') return existing;
    const variant: ExperimentVariant = Math.random() < 0.5 ? 'A' : 'B';
    await AsyncStorage.setItem(EXPERIMENT_VARIANT_KEY, variant);
    return variant;
  }

  // Comments enabled setting
  async getCommentsEnabled(): Promise<boolean> {
    const value = await AsyncStorage.getItem(COMMENTS_ENABLED_KEY);
    // Default to true if not set
    return value !== 'false';
  }

  async setCommentsEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(COMMENTS_ENABLED_KEY, enabled ? 'true' : 'false');
  }

  // Generic get/set for arbitrary keys
  async get<T>(key: string): Promise<T | null> {
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  // Clear all data
  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      CARDS_KEY, CARDS_SOURCE_KEY, CARDS_VERSION_KEY,
      SAVED_KEY, LIKED_KEY, SEEN_KEY, DISLIKED_KEY,
      PREFERENCES_KEY, ANALYST_PROFILE_KEY, ONBOARDING_COMPLETE_KEY, LAST_SYNC_KEY,
      COMMENTS_KEY,
      DEVICE_ID_KEY,
      EXPERIMENT_VARIANT_KEY,
    ]);
  }
}

export const offlineStorage = new OfflineStorage();
