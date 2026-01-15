import { create } from 'zustand';
import { Card, Category } from '../types';
import { api } from '../services/api';
import { offlineStorage, UserPreferences, AnalystProfile } from '../services/offline';
import { bundledCards } from '../data';

// Industry to category mapping
const INDUSTRY_CATEGORY_MAP: Record<string, string[]> = {
  technology: ['Technology', 'Software', 'Semiconductors', 'AI', 'Cloud', 'Tech'],
  financials: ['Financials', 'Banking', 'Insurance', 'Asset Management', 'Fintech'],
  healthcare: ['Healthcare', 'Biotech', 'Pharma', 'Medical Devices', 'Health'],
  consumer: ['Consumer', 'Retail', 'E-commerce', 'CPG', 'Luxury', 'Food & Beverage'],
  industrials: ['Industrials', 'Manufacturing', 'Aerospace', 'Defense', 'Machinery'],
  energy: ['Energy', 'Oil & Gas', 'Renewables', 'Solar', 'Clean Energy'],
  materials: ['Materials', 'Chemicals', 'Mining', 'Metals'],
  real_estate: ['Real Estate', 'REITs', 'Property'],
  utilities: ['Utilities', 'Power', 'Water'],
  telecom: ['Telecom', 'Communications', 'Media', '5G'],
};

// Geography to region mapping
const GEOGRAPHY_REGION_MAP: Record<string, string[]> = {
  us: ['US', 'USA', 'United States', 'North America', 'American'],
  europe: ['Europe', 'EU', 'UK', 'European', 'Germany', 'France', 'EMEA'],
  asia: ['Asia', 'APAC', 'China', 'Japan', 'Korea', 'India', 'Asian'],
  latam: ['Latin America', 'LATAM', 'Brazil', 'Mexico', 'South America'],
  emerging: ['Emerging Markets', 'EM', 'Frontier', 'Developing'],
};

// Scoring weights
const WEIGHTS = {
  analystIndustry: 2.0, // Strong boost for analyst's industries
  analystGeo: 1.5, // Boost for analyst's geographies
  category: 1.0,
  type: 0.8,
  ticker: 0.6,
  exploration: 0.15, // 15% randomness for discovery
};

// Score decay - older preferences matter less
const SCORE_DECAY = 0.95;
const LIKE_BOOST = 0.3;
const DISLIKE_PENALTY = -0.5;

interface AppState {
  // Cards
  cards: Card[];
  allCards: Card[]; // Unfiltered cards for re-ranking
  currentIndex: number;
  isLoading: boolean;

  // Saved & Disliked
  savedIds: Set<string>;
  dislikedIds: Set<string>;

  // Preferences
  preferences: UserPreferences;
  analystProfile: AnalystProfile | null;

  // Categories
  categories: Category[];
  selectedCategory: string | null;

  // Subscription
  isSubscribed: boolean;

  // Stats
  cardsSeenToday: number;

  // Onboarding
  hasCompletedOnboarding: boolean;

  // Actions
  loadCards: () => Promise<void>;
  syncCards: () => Promise<void>;
  nextCard: () => void;
  prevCard: () => void;
  saveCard: (id: string) => Promise<void>;
  unsaveCard: (id: string) => Promise<void>;
  likeCard: (id: string) => Promise<void>;
  dislikeCard: (id: string) => Promise<void>;
  setCategory: (category: string | null) => void;
  markSeen: (id: string) => Promise<void>;
  init: () => Promise<void>;
  rankCards: () => void;
  setAnalystProfile: (profile: AnalystProfile) => Promise<void>;
  checkOnboarding: () => Promise<boolean>;
}

// Check if card matches analyst's industries
function matchesAnalystIndustry(card: Card, profile: AnalystProfile | null): number {
  if (!profile || profile.industries.length === 0) return 0;

  let matchScore = 0;
  for (const industry of profile.industries) {
    const relatedCategories = INDUSTRY_CATEGORY_MAP[industry] || [];
    for (const cat of card.categories) {
      if (relatedCategories.some(rc => cat.toLowerCase().includes(rc.toLowerCase()))) {
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
  analystProfile: AnalystProfile | null
): number {
  // If disliked, heavily penalize
  if (dislikedIds.has(card.id)) {
    return -1000;
  }

  let score = 0;

  // Analyst industry match (highest priority)
  const industryMatch = matchesAnalystIndustry(card, analystProfile);
  score += industryMatch * WEIGHTS.analystIndustry;

  // Analyst geography match
  const geoMatch = matchesAnalystGeo(card, analystProfile);
  score += geoMatch * WEIGHTS.analystGeo;

  // Category score from learned preferences
  for (const cat of card.categories) {
    const catScore = prefs.categoryScores[cat] || 0;
    score += catScore * WEIGHTS.category;
  }

  // Type score
  const typeScore = prefs.typeScores[card.type] || 0;
  score += typeScore * WEIGHTS.type;

  // Ticker score
  for (const ticker of card.tickers) {
    const tickerScore = prefs.tickerScores[ticker] || 0;
    score += tickerScore * WEIGHTS.ticker;
  }

  // Add exploration randomness
  score += (Math.random() - 0.5) * WEIGHTS.exploration;

  return score;
}

// Update preferences based on user action
function updatePreferences(
  prefs: UserPreferences,
  card: Card,
  action: 'like' | 'dislike'
): UserPreferences {
  const boost = action === 'like' ? LIKE_BOOST : DISLIKE_PENALTY;
  const newPrefs = { ...prefs };

  // Decay existing scores
  for (const key in newPrefs.categoryScores) {
    newPrefs.categoryScores[key] *= SCORE_DECAY;
  }
  for (const key in newPrefs.typeScores) {
    newPrefs.typeScores[key] *= SCORE_DECAY;
  }
  for (const key in newPrefs.tickerScores) {
    newPrefs.tickerScores[key] *= SCORE_DECAY;
  }

  // Update category scores
  for (const cat of card.categories) {
    newPrefs.categoryScores[cat] = (newPrefs.categoryScores[cat] || 0) + boost;
    // Clamp between -1 and 1
    newPrefs.categoryScores[cat] = Math.max(-1, Math.min(1, newPrefs.categoryScores[cat]));
  }

  // Update type score
  newPrefs.typeScores[card.type] = (newPrefs.typeScores[card.type] || 0) + boost;
  newPrefs.typeScores[card.type] = Math.max(-1, Math.min(1, newPrefs.typeScores[card.type]));

  // Update ticker scores
  for (const ticker of card.tickers) {
    newPrefs.tickerScores[ticker] = (newPrefs.tickerScores[ticker] || 0) + boost;
    newPrefs.tickerScores[ticker] = Math.max(-1, Math.min(1, newPrefs.tickerScores[ticker]));
  }

  newPrefs.lastUpdated = new Date().toISOString();
  return newPrefs;
}

export const useStore = create<AppState>((set, get) => ({
  cards: [],
  allCards: [],
  currentIndex: 0,
  isLoading: false,
  savedIds: new Set(),
  dislikedIds: new Set(),
  preferences: {
    categoryScores: {},
    typeScores: {},
    tickerScores: {},
    lastUpdated: new Date().toISOString(),
  },
  analystProfile: null,
  categories: [],
  selectedCategory: null,
  isSubscribed: false,
  cardsSeenToday: 0,
  hasCompletedOnboarding: false,

  init: async () => {
    set({ isLoading: true });

    try {
      // Load from offline storage first
      const offlineCards = await offlineStorage.getCards();
      const savedIds = await offlineStorage.getSavedIds();
      const dislikedIds = await offlineStorage.getDislikedIds();
      const preferences = await offlineStorage.getPreferences();
      const analystProfile = await offlineStorage.getAnalystProfile();
      const hasCompletedOnboarding = await offlineStorage.isOnboardingComplete();

      if (offlineCards.length > 0) {
        set({ allCards: offlineCards, savedIds, dislikedIds, preferences, analystProfile, hasCompletedOnboarding });
      } else {
        // Use bundled cards as fallback
        set({ allCards: bundledCards, savedIds, dislikedIds, preferences, analystProfile, hasCompletedOnboarding });
        // Save to offline storage for future
        await offlineStorage.saveCards(bundledCards);
      }

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
      set({
        allCards: bundledCards,
        cards: bundledCards,
        savedIds: new Set(),
        dislikedIds: new Set(),
        preferences: {
          categoryScores: {},
          typeScores: {},
          tickerScores: {},
          lastUpdated: new Date().toISOString(),
        },
        analystProfile: null,
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

      await offlineStorage.saveCards(cards);

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

  saveCard: async (id: string) => {
    const { savedIds } = get();
    const newSaved = new Set(savedIds);
    newSaved.add(id);
    set({ savedIds: newSaved });

    await offlineStorage.addSavedId(id);

    try {
      await api.saveCard(id);
    } catch (e) {
      // Saved locally, will sync later
    }
  },

  unsaveCard: async (id: string) => {
    const { savedIds } = get();
    const newSaved = new Set(savedIds);
    newSaved.delete(id);
    set({ savedIds: newSaved });

    await offlineStorage.removeSavedId(id);

    try {
      await api.unsaveCard(id);
    } catch (e) {
      // Saved locally, will sync later
    }
  },

  likeCard: async (id: string) => {
    const { preferences, allCards } = get();

    // Find the card and update preferences (positive signal)
    const card = allCards.find(c => c.id === id);
    if (card) {
      const newPrefs = updatePreferences(preferences, card, 'like');
      await offlineStorage.savePreferences(newPrefs);
      set({ preferences: newPrefs });
    }
  },

  dislikeCard: async (id: string) => {
    const { dislikedIds, preferences, allCards } = get();
    const newDisliked = new Set(dislikedIds);
    newDisliked.add(id);

    // Find the card and update preferences (negative signal)
    const card = allCards.find(c => c.id === id);
    let newPrefs = preferences;
    if (card) {
      newPrefs = updatePreferences(preferences, card, 'dislike');
      await offlineStorage.savePreferences(newPrefs);
    }

    set({ dislikedIds: newDisliked, preferences: newPrefs });

    await offlineStorage.addDislikedId(id);

    // Re-rank cards to push similar content down
    get().rankCards();
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

  rankCards: () => {
    const { allCards, preferences, dislikedIds, selectedCategory, analystProfile } = get();

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
        score: scoreCard(card, preferences, dislikedIds, analystProfile),
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
}));
