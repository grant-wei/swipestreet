import { create } from 'zustand';
import { Card, Category } from '../types';
import { api } from '../services/api';
import { trackEvent } from '../services/analytics';
import { offlineStorage, UserPreferences, AnalystProfile, ExperimentVariant } from '../services/offline';
import { bundledCards, bundledCardsGeneratedAt, bundledCaseStudies, bundledIdeas } from '../data';

// Industry to category mapping
const INDUSTRY_CATEGORY_MAP: Record<string, string[]> = {
  technology: [
    'Technology',
    'Information Technology',
    'Software',
    'Semiconductors',
    'AI',
    'Cloud',
    'Tech',
    'Hardware',
    'IT Services',
  ],
  financials: [
    'Financials',
    'Banking',
    'Insurance',
    'Asset Management',
    'Fintech',
    'Capital Markets',
  ],
  healthcare: [
    'Healthcare',
    'Biotech',
    'Pharma',
    'Medical Devices',
    'Health',
  ],
  consumer: [
    'Consumer',
    'Consumer Discretionary',
    'Consumer Staples',
    'Retail',
    'E-commerce',
    'CPG',
    'Luxury',
    'Food & Beverage',
  ],
  industrials: [
    'Industrials',
    'Industrial',
    'Manufacturing',
    'Aerospace',
    'Defense',
    'Machinery',
    'Capital Goods',
    'Transportation',
    'Commercial Services',
  ],
  energy: ['Energy', 'Oil & Gas', 'Renewables', 'Solar', 'Clean Energy'],
  materials: ['Materials', 'Chemicals', 'Mining', 'Metals'],
  real_estate: ['Real Estate', 'REITs', 'Property'],
  utilities: ['Utilities', 'Power', 'Water'],
  telecom: ['Telecom', 'Communications', 'Communication Services', 'Media', '5G'],
};

// Geography to region mapping
const GEOGRAPHY_REGION_MAP: Record<string, string[]> = {
  us: ['US', 'USA', 'United States', 'North America', 'American'],
  europe: ['Europe', 'EU', 'UK', 'European', 'Germany', 'France', 'EMEA'],
  asia: ['Asia', 'APAC', 'China', 'Japan', 'Korea', 'India', 'Asian'],
  latam: ['Latin America', 'LATAM', 'Brazil', 'Mexico', 'South America'],
  emerging: ['Emerging Markets', 'EM', 'Frontier', 'Developing'],
};

type EngagementSignal = 'impression' | 'dwell' | 'like' | 'dislike' | 'save' | 'comment' | 'unsave';

type EngagementMeta = {
  surface?: 'for_you' | 'learn' | 'ideas' | 'unknown';
  durationMs?: number;
  commentLength?: number;
};

type WeightProfile = {
  weights: {
    analystIndustry: number;
    analystGeo: number;
    category: number;
    type: number;
    ticker: number;
    exploration: number;
  };
  decay: number;
  boosts: {
    like: number;
    dislike: number;
    save: number;
    comment: number;
    dwell: number;
  };
  dwell: {
    minMs: number;
    maxMs: number;
  };
};

const BASE_WEIGHTS = {
  analystIndustry: 2.0, // Strong boost for analyst's industries
  analystGeo: 1.5, // Boost for analyst's geographies
  category: 1.0,
  type: 0.8,
  ticker: 0.6,
  exploration: 0.15, // 15% randomness for discovery
};

const WEIGHT_PROFILES: Record<ExperimentVariant, WeightProfile> = {
  A: {
    weights: { ...BASE_WEIGHTS },
    decay: 0.95,
    boosts: {
      like: 0.3,
      dislike: -0.5,
      save: 0.45,
      comment: 0.6,
      dwell: 0.18,
    },
    dwell: {
      minMs: 2000,
      maxMs: 12000,
    },
  },
  B: {
    weights: {
      ...BASE_WEIGHTS,
      analystIndustry: 2.1,
      analystGeo: 1.6,
      exploration: 0.08,
    },
    decay: 0.93,
    boosts: {
      like: 0.35,
      dislike: -0.6,
      save: 0.6,
      comment: 0.75,
      dwell: 0.24,
    },
    dwell: {
      minMs: 1500,
      maxMs: 10000,
    },
  },
};

function getWeightProfile(variant?: ExperimentVariant | null): WeightProfile {
  if (variant && WEIGHT_PROFILES[variant]) {
    return WEIGHT_PROFILES[variant];
  }
  return WEIGHT_PROFILES.A;
}

interface AppState {
  // Cards
  cards: Card[];
  allCards: Card[]; // Unfiltered cards for re-ranking
  currentIndex: number;
  isLoading: boolean;

  // Saved & Disliked
  savedIds: Set<string>;
  likedIds: Set<string>;
  dislikedIds: Set<string>;

  // Preferences
  preferences: UserPreferences;
  analystProfile: AnalystProfile | null;
  experimentVariant: ExperimentVariant;

  // Categories
  categories: Category[];
  selectedCategory: string | null;

  // Subscription
  isSubscribed: boolean;

  // Stats
  cardsSeenToday: number;

  // Onboarding
  hasCompletedOnboarding: boolean;

  // Preferences
  commentsEnabled: boolean;

  // Actions
  loadCards: () => Promise<void>;
  syncCards: () => Promise<void>;
  nextCard: () => void;
  prevCard: () => void;
  saveCard: (id: string, card?: Card, meta?: EngagementMeta) => Promise<void>;
  unsaveCard: (id: string, card?: Card, meta?: EngagementMeta) => Promise<void>;
  likeCard: (id: string, card?: Card, meta?: EngagementMeta) => Promise<void>;
  dislikeCard: (id: string, card?: Card, meta?: EngagementMeta) => Promise<void>;
  setCategory: (category: string | null) => void;
  markSeen: (id: string) => Promise<void>;
  init: () => Promise<void>;
  rankCards: () => void;
  setAnalystProfile: (profile: AnalystProfile) => Promise<void>;
  checkOnboarding: () => Promise<boolean>;
  recordEngagement: (card: Card, signal: EngagementSignal, meta?: EngagementMeta) => Promise<void>;
  setCommentsEnabled: (enabled: boolean) => Promise<void>;
}

// Check if card matches analyst's industries
function matchesAnalystIndustry(card: Card, profile: AnalystProfile | null): number {
  if (!profile || profile.industries.length === 0) return 0;

  let matchScore = 0;
  const gicsFields = [
    card.gics_sector,
    card.gics_industry_group,
    card.gics_industry,
    card.gics_sub_industry,
  ].filter(Boolean) as string[];
  for (const industry of profile.industries) {
    const relatedCategories = INDUSTRY_CATEGORY_MAP[industry] || [];
    for (const cat of card.categories) {
      if (relatedCategories.some(rc => cat.toLowerCase().includes(rc.toLowerCase()))) {
        matchScore += 1;
      }
    }
    for (const gics of gicsFields) {
      if (relatedCategories.some(rc => gics.toLowerCase().includes(rc.toLowerCase()))) {
        matchScore += 1;
      }
    }
  }
  return matchScore;
}

// Check if card matches analyst's geographies
function matchesAnalystGeo(card: Card, profile: AnalystProfile | null): number {
  if (!profile || profile.geographies.length === 0) return 0;

  // Check card content and categories for geographic references
  const cardText = (card.content + ' ' + card.categories.join(' ')).toLowerCase();

  let matchScore = 0;
  for (const geo of profile.geographies) {
    const relatedTerms = GEOGRAPHY_REGION_MAP[geo] || [];
    for (const term of relatedTerms) {
      if (cardText.includes(term.toLowerCase())) {
        matchScore += 0.5;
        break; // Only count once per geography
      }
    }
  }
  return matchScore;
}

// Score a single card based on user preferences
function scoreCard(
  card: Card,
  prefs: UserPreferences,
  dislikedIds: Set<string>,
  analystProfile: AnalystProfile | null,
  profile: WeightProfile
): number {
  // If disliked, heavily penalize
  if (dislikedIds.has(card.id)) {
    return -1000;
  }

  let score = 0;
  const weights = profile.weights;

  // Analyst industry match (highest priority)
  const industryMatch = matchesAnalystIndustry(card, analystProfile);
  score += industryMatch * weights.analystIndustry;

  // Analyst geography match
  const geoMatch = matchesAnalystGeo(card, analystProfile);
  score += geoMatch * weights.analystGeo;

  // Category score from learned preferences
  for (const cat of card.categories) {
    const catScore = prefs.categoryScores[cat] || 0;
    score += catScore * weights.category;
  }

  // Type score
  const typeScore = prefs.typeScores[card.type] || 0;
  score += typeScore * weights.type;

  // Ticker score
  for (const ticker of card.tickers) {
    const tickerScore = prefs.tickerScores[ticker] || 0;
    score += tickerScore * weights.ticker;
  }

  // Add exploration randomness
  score += (Math.random() - 0.5) * weights.exploration;

  return score;
}

function clampScore(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function updatePreferencesWithBoost(
  prefs: UserPreferences,
  card: Card,
  boost: number,
  decay: number
): UserPreferences {
  const newPrefs = { ...prefs };

  // Decay existing scores
  if (decay < 1) {
    for (const key in newPrefs.categoryScores) {
      newPrefs.categoryScores[key] *= decay;
    }
    for (const key in newPrefs.typeScores) {
      newPrefs.typeScores[key] *= decay;
    }
    for (const key in newPrefs.tickerScores) {
      newPrefs.tickerScores[key] *= decay;
    }
  }

  // Update category scores
  for (const cat of card.categories) {
    newPrefs.categoryScores[cat] = clampScore((newPrefs.categoryScores[cat] || 0) + boost);
  }

  // Update type score
  newPrefs.typeScores[card.type] = clampScore((newPrefs.typeScores[card.type] || 0) + boost);

  // Update ticker scores
  for (const ticker of card.tickers) {
    newPrefs.tickerScores[ticker] = clampScore((newPrefs.tickerScores[ticker] || 0) + boost);
  }

  newPrefs.lastUpdated = new Date().toISOString();
  return newPrefs;
}

function computeDwellBoost(durationMs: number, profile: WeightProfile) {
  if (!Number.isFinite(durationMs)) return 0;
  const { minMs, maxMs } = profile.dwell;
  if (durationMs < minMs) return 0;
  const range = Math.max(1, maxMs - minMs);
  const progress = Math.min(1, Math.max(0, (durationMs - minMs) / range));
  return profile.boosts.dwell * progress;
}

export const useStore = create<AppState>((set, get) => ({
  cards: [],
  allCards: [],
  currentIndex: 0,
  isLoading: false,
  savedIds: new Set(),
  likedIds: new Set(),
  dislikedIds: new Set(),
  preferences: {
    categoryScores: {},
    typeScores: {},
    tickerScores: {},
    lastUpdated: new Date().toISOString(),
  },
  analystProfile: null,
  experimentVariant: 'A',
  categories: [],
  selectedCategory: null,
  isSubscribed: false,
  cardsSeenToday: 0,
  hasCompletedOnboarding: false,
  commentsEnabled: true,

  init: async () => {
    set({ isLoading: true });

    try {
      // Load from offline storage first
      const offlineCards = await offlineStorage.getCards();
      const experimentVariant = await offlineStorage.getOrCreateExperimentVariant();
      const savedIds = await offlineStorage.getSavedIds();
      const likedIds = await offlineStorage.getLikedIds();
      const dislikedIds = await offlineStorage.getDislikedIds();
      const preferences = await offlineStorage.getPreferences();
      const analystProfile = await offlineStorage.getAnalystProfile();
      const hasCompletedOnboarding = await offlineStorage.isOnboardingComplete();
      const commentsEnabled = await offlineStorage.getCommentsEnabled();
      const lastSync = await offlineStorage.getLastSync();

      let cardsToUse = offlineCards;
      if (offlineCards.length > 0) {
        const cardsSource = await offlineStorage.getCardsSource();
        const storedBundleVersion = await offlineStorage.getCardsBundleVersion();
        const bundleDate = bundledCardsGeneratedAt ? new Date(bundledCardsGeneratedAt) : null;
        const storedDate = storedBundleVersion ? new Date(storedBundleVersion) : null;
        const lastSyncDate = lastSync ? new Date(lastSync) : null;
        const hasNewBundle = bundleDate
          && (!storedDate || bundleDate > storedDate)
          && (!lastSyncDate || bundleDate > lastSyncDate);

        const canRefreshBundle = cardsSource === 'bundle' || cardsSource === null;
        if (canRefreshBundle && hasNewBundle) {
          cardsToUse = bundledCards;
          await offlineStorage.saveCards(bundledCards, {
            source: 'bundle',
            bundleVersion: bundledCardsGeneratedAt || undefined,
          });
        }
      } else {
        // Use bundled cards as fallback
        cardsToUse = bundledCards;
        // Save to offline storage for future
        await offlineStorage.saveCards(bundledCards, {
          source: 'bundle',
          bundleVersion: bundledCardsGeneratedAt || undefined,
        });
      }

      // Combine all card sources for allCards (used for saved cards lookup)
      const allCardsCombined = [...cardsToUse, ...bundledCaseStudies, ...bundledIdeas];

      set({
        allCards: allCardsCombined,
        savedIds,
        likedIds,
        dislikedIds,
        preferences,
        analystProfile,
        experimentVariant,
        hasCompletedOnboarding,
        commentsEnabled,
      });

      console.log('[Init]', {
        offlineCards: offlineCards.length,
        bundledCards: bundledCards.length,
        allCards: get().allCards.length,
      });

      // Extract categories from cards
      const categoryMap: Record<string, number> = {};
      get().allCards.forEach(card => {
        card.categories.forEach(cat => {
          categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        });
      });
      const categories = Object.entries(categoryMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      set({ categories });

      // Rank cards based on preferences
      try {
        get().rankCards();
      } catch (error) {
        console.warn('[RankCards] error', error);
        set({ cards: get().allCards });
      }
    } catch (error) {
      console.warn('[Init] offline storage error', error);
      const allCardsFallback = [...bundledCards, ...bundledCaseStudies, ...bundledIdeas];
      set({
        allCards: allCardsFallback,
        cards: bundledCards,
        savedIds: new Set(),
        likedIds: new Set(),
        dislikedIds: new Set(),
        preferences: {
          categoryScores: {},
          typeScores: {},
          tickerScores: {},
          lastUpdated: new Date().toISOString(),
        },
        analystProfile: null,
        experimentVariant: 'A',
        hasCompletedOnboarding: false,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  loadCards: async () => {
    const { selectedCategory } = get();
    set({ isLoading: true });

    try {
      const response = await api.getFeed({
        limit: 50,
        category: selectedCategory || undefined,
      });
      set({ cards: response.cards, currentIndex: 0 });
    } catch (e) {
      // Fallback to offline
      const cards = await offlineStorage.getCards();
      set({ cards, currentIndex: 0 });
    }

    set({ isLoading: false });
  },

  syncCards: async () => {
    try {
      const { cards, synced_at } = await api.syncAllCards();
      if (cards.length === 0) {
        console.warn('[SyncCards] empty response, keeping local cache');
        return;
      }

      await offlineStorage.saveCards(cards, {
        source: 'api',
        bundleVersion: synced_at,
      });

      const categoriesRes = await api.getCategories();
      const nextCategories = categoriesRes.categories.length > 0
        ? categoriesRes.categories
        : get().categories;

      set({ allCards: cards, categories: nextCategories });
      get().rankCards();
    } catch (e) {
      console.error('Sync failed:', e);
    }
  },

  nextCard: () => {
    const { currentIndex, cards } = get();
    if (currentIndex < cards.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  prevCard: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  saveCard: async (id: string, card?: Card, meta?: EngagementMeta) => {
    const { savedIds } = get();
    const newSaved = new Set(savedIds);
    newSaved.add(id);
    set({ savedIds: newSaved });

    await offlineStorage.addSavedId(id);

    const targetCard = card || get().allCards.find((c) => c.id === id);
    if (targetCard) {
      await get().recordEngagement(targetCard, 'save', meta);
    }

    try {
      await api.saveCard(id);
    } catch (e) {
      // Saved locally, will sync later
    }
  },

  unsaveCard: async (id: string, card?: Card, meta?: EngagementMeta) => {
    const { savedIds } = get();
    const newSaved = new Set(savedIds);
    newSaved.delete(id);
    set({ savedIds: newSaved });

    await offlineStorage.removeSavedId(id);

    const targetCard = card || get().allCards.find((c) => c.id === id);
    if (targetCard) {
      await get().recordEngagement(targetCard, 'unsave', meta);
    }

    try {
      await api.unsaveCard(id);
    } catch (e) {
      // Saved locally, will sync later
    }
  },

  likeCard: async (id: string, card?: Card, meta?: EngagementMeta) => {
    const { likedIds, dislikedIds, allCards } = get();
    if (likedIds.has(id)) return;

    const targetCard = card || allCards.find((c) => c.id === id);
    if (targetCard) {
      await get().recordEngagement(targetCard, 'like', meta);
    }

    const nextLiked = new Set(likedIds);
    nextLiked.add(id);
    const nextDisliked = new Set(dislikedIds);
    if (nextDisliked.has(id)) {
      nextDisliked.delete(id);
      await offlineStorage.removeDislikedId(id);
    }

    set({ likedIds: nextLiked, dislikedIds: nextDisliked });

    await offlineStorage.addLikedId(id);

    try {
      await api.recordAction(id, 'liked');
    } catch (e) {
      // Stored locally, will sync later
    }
  },

  dislikeCard: async (id: string, card?: Card, meta?: EngagementMeta) => {
    const { likedIds, dislikedIds, allCards } = get();
    const newDisliked = new Set(dislikedIds);
    newDisliked.add(id);

    const targetCard = card || allCards.find((c) => c.id === id);
    if (targetCard) {
      await get().recordEngagement(targetCard, 'dislike', meta);
    }

    const nextLiked = new Set(likedIds);
    if (nextLiked.has(id)) {
      nextLiked.delete(id);
      await offlineStorage.removeLikedId(id);
    }

    set({ dislikedIds: newDisliked, likedIds: nextLiked });

    await offlineStorage.addDislikedId(id);

    // Re-rank cards to push similar content down
    get().rankCards();

    try {
      await api.recordAction(id, 'disliked');
    } catch (e) {
      // Stored locally, will sync later
    }
  },

  setCategory: (category: string | null) => {
    set({ selectedCategory: category, currentIndex: 0 });
    get().rankCards();
  },

  markSeen: async (id: string) => {
    const { cardsSeenToday } = get();
    set({ cardsSeenToday: cardsSeenToday + 1 });

    await offlineStorage.addSeenId(id);

    try {
      await api.markSeen(id);
    } catch (e) {
      // Tracked locally
    }
  },

  recordEngagement: async (card: Card, signal: EngagementSignal, meta?: EngagementMeta) => {
    const { preferences, experimentVariant } = get();
    const profile = getWeightProfile(experimentVariant);
    const surface = meta?.surface || 'unknown';
    const baseProps = {
      card_id: card.id,
      card_type: card.type,
      surface,
    };
    const categories = Array.isArray(card.categories) ? card.categories.slice(0, 4) : [];
    const tickers = Array.isArray(card.tickers) ? card.tickers.slice(0, 2) : [];

    if (signal === 'impression') {
      void trackEvent('card_impression', {
        ...baseProps,
        categories,
        tickers,
      });
      return;
    }

    if (signal === 'dwell') {
      const durationMs = meta?.durationMs || 0;
      void trackEvent('card_dwell', {
        ...baseProps,
        duration_ms: durationMs,
      });
      const boost = computeDwellBoost(durationMs, profile);
      if (boost === 0) return;
      const nextPrefs = updatePreferencesWithBoost(preferences, card, boost, 1);
      await offlineStorage.savePreferences(nextPrefs);
      set({ preferences: nextPrefs });
      return;
    }

    void trackEvent('card_action', {
      ...baseProps,
      action: signal,
      comment_length: meta?.commentLength,
    });

    let boost = 0;
    if (signal === 'like') boost = profile.boosts.like;
    if (signal === 'dislike') boost = profile.boosts.dislike;
    if (signal === 'save') boost = profile.boosts.save;
    if (signal === 'comment') boost = profile.boosts.comment;

    if (boost === 0) return;
    const nextPrefs = updatePreferencesWithBoost(preferences, card, boost, profile.decay);
    await offlineStorage.savePreferences(nextPrefs);
    set({ preferences: nextPrefs });
  },

  rankCards: () => {
    const { allCards, preferences, dislikedIds, selectedCategory, analystProfile, experimentVariant } = get();
    const profile = getWeightProfile(experimentVariant);

    // Filter by category if selected
    let cardsToRank = allCards;
    if (selectedCategory) {
      cardsToRank = allCards.filter(card =>
        card.categories.some(c => c.toLowerCase() === selectedCategory.toLowerCase())
      );
    }

    // Score and sort cards based on analyst profile + learned preferences
    const scoredCards = cardsToRank
      .map(card => ({
        card,
        score: scoreCard(card, preferences, dislikedIds, analystProfile, profile),
      }))
      .filter(({ score }) => score > -100) // Filter out heavily disliked
      .sort((a, b) => b.score - a.score)
      .map(({ card }) => card);

    const nextCards = scoredCards.length > 0 ? scoredCards : cardsToRank;
    console.log('[RankCards]', {
      allCards: allCards.length,
      scoredCards: scoredCards.length,
      nextCards: nextCards.length,
      selectedCategory,
    });
    set({ cards: nextCards });
  },

  setAnalystProfile: async (profile: AnalystProfile) => {
    await offlineStorage.saveAnalystProfile(profile);
    await offlineStorage.setOnboardingComplete();
    set({ analystProfile: profile, hasCompletedOnboarding: true });
    // Re-rank cards with new profile
    get().rankCards();
  },

  checkOnboarding: async () => {
    const complete = await offlineStorage.isOnboardingComplete();
    set({ hasCompletedOnboarding: complete });
    return complete;
  },

  setCommentsEnabled: async (enabled: boolean) => {
    await offlineStorage.setCommentsEnabled(enabled);
    set({ commentsEnabled: enabled });
  },
}));
