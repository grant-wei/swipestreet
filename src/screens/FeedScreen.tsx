import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SwipeCard } from '../components/SwipeCard';
import { bundledIdeas } from '../data';
import { useCardEngagement } from '../hooks/useCardEngagement';
import { useStore } from '../stores/useStore';
import { Card } from '../types';

const INDUSTRY_MATCH_TERMS: Record<string, string[]> = {
  technology: [
    'technology',
    'information technology',
    'software',
    'semiconductors',
    'ai',
    'cloud',
    'tech',
    'hardware',
    'it services',
  ],
  financials: ['financials', 'banking', 'insurance', 'asset management', 'fintech', 'capital markets'],
  healthcare: ['healthcare', 'biotech', 'pharma', 'medical devices', 'health'],
  consumer: [
    'consumer',
    'consumer discretionary',
    'consumer staples',
    'retail',
    'e-commerce',
    'cpg',
    'luxury',
    'food',
  ],
  industrials: [
    'industrials',
    'industrial',
    'manufacturing',
    'aerospace',
    'defense',
    'machinery',
    'capital goods',
    'transportation',
    'commercial services',
  ],
  energy: ['energy', 'oil', 'gas', 'renewables', 'solar', 'clean energy'],
  materials: ['materials', 'chemicals', 'mining', 'metals'],
  real_estate: ['real estate', 'reit', 'property'],
  utilities: ['utilities', 'power', 'water'],
  telecom: ['telecom', 'communications', 'communication services', 'media', '5g'],
};

const GEO_MATCH_TERMS: Record<string, string[]> = {
  us: ['us', 'usa', 'united states', 'north america', 'american'],
  europe: ['europe', 'eu', 'uk', 'european', 'germany', 'france', 'emea'],
  asia: ['asia', 'apac', 'china', 'japan', 'korea', 'india', 'asian', 'taiwan'],
  latam: ['latin america', 'latam', 'brazil', 'mexico', 'south america'],
  emerging: ['emerging markets', 'em', 'frontier', 'developing'],
};

function cardTextForMatch(card: Card) {
  const parts = [
    card.content,
    card.gics_sector,
    card.gics_industry_group,
    card.gics_industry,
    card.gics_sub_industry,
    ...(card.categories || []),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function matchesIndustry(card: Card, industries: string[]) {
  if (industries.length === 0) return true;
  const haystack = cardTextForMatch(card);
  return industries.some((industry) => {
    const terms = INDUSTRY_MATCH_TERMS[industry] || [];
    return terms.some((term) => haystack.includes(term));
  });
}

function matchesGeo(card: Card, geos: string[]) {
  if (geos.length === 0) return true;
  const haystack = cardTextForMatch(card);
  return geos.some((geo) => {
    const terms = GEO_MATCH_TERMS[geo] || [];
    return terms.some((term) => haystack.includes(term));
  });
}

function filterByCoverage(cards: Card[], industries: string[], geos: string[]) {
  if (industries.length === 0 && geos.length === 0) return cards;
  const filtered = cards.filter(
    (card) => matchesIndustry(card, industries) && matchesGeo(card, geos)
  );
  return filtered.length > 0 ? filtered : cards;
}

function buildForYouFeed(lessons: Card[], ideas: Card[], lessonsPerIdea: number) {
  if (lessons.length === 0 && ideas.length === 0) return [];
  const feed: Card[] = [];
  let lessonIndex = 0;
  let ideaIndex = 0;

  while (lessonIndex < lessons.length || ideaIndex < ideas.length) {
    for (let i = 0; i < lessonsPerIdea && lessonIndex < lessons.length; i += 1) {
      feed.push(lessons[lessonIndex]);
      lessonIndex += 1;
    }
    if (ideaIndex < ideas.length) {
      feed.push(ideas[ideaIndex]);
      ideaIndex += 1;
    }
  }

  return feed;
}

export function FeedScreen() {
  const {
    cards,
    isLoading,
    savedIds,
    likedIds,
    seenIds,
    saveCard,
    unsaveCard,
    likeCard,
    dislikeCard,
    markSeen,
    analystProfile,
    rankCards,
  } = useStore();

  const [index, setIndex] = useState(0);
  const [showingAllCards, setShowingAllCards] = useState(false);

  const lessonCards = useMemo(
    () => cards.filter((card) => card.type === 'lesson'),
    [cards]
  );
  const ideaCards = useMemo(() => {
    const fromStore = cards.filter((card) => card.type === 'idea');
    const byId = new Map<string, Card>();
    [...fromStore, ...bundledIdeas].forEach((card) => {
      if (!byId.has(card.id)) byId.set(card.id, card);
    });
    return Array.from(byId.values());
  }, [cards]);

  const coverageIndustries = analystProfile?.industries || [];
  const coverageGeos = analystProfile?.geographies || [];
  const filteredIdeas = useMemo(
    () => filterByCoverage(ideaCards, coverageIndustries, coverageGeos),
    [ideaCards, coverageIndustries, coverageGeos]
  );
  const filteredLessons = useMemo(
    () => filterByCoverage(lessonCards, coverageIndustries, coverageGeos),
    [lessonCards, coverageIndustries, coverageGeos]
  );

  const lessonsPerIdea = coverageIndustries.length > 0 || coverageGeos.length > 0 ? 1 : 3;

  const allFeedCards = useMemo(
    () => buildForYouFeed(filteredLessons, filteredIdeas, lessonsPerIdea),
    [filteredLessons, filteredIdeas, lessonsPerIdea]
  );

  // Filter to unseen cards first, then show all if user wants
  const feedCards = useMemo(() => {
    if (showingAllCards) {
      return allFeedCards;
    }
    const unseen = allFeedCards.filter((card) => !seenIds.has(card.id));
    return unseen.length > 0 ? unseen : allFeedCards;
  }, [allFeedCards, seenIds, showingAllCards]);

  const hasUnseenCards = useMemo(
    () => allFeedCards.some((card) => !seenIds.has(card.id)),
    [allFeedCards, seenIds]
  );

  // Re-rank cards when preferences change
  useEffect(() => {
    rankCards();
  }, []);

  useEffect(() => {
    if (feedCards.length === 0) {
      setIndex(0);
      return;
    }
    if (index >= feedCards.length) {
      setIndex(0);
    }
  }, [feedCards, index]);

  const previousCard = index > 0 ? feedCards[index - 1] : null;
  const currentCard = feedCards[index];
  const upcomingCard = feedCards.length > 1 ? feedCards[(index + 1) % feedCards.length] : null;
  const isAtEnd = index === feedCards.length - 1;

  useCardEngagement(currentCard, 'for_you');

  const handleSave = useCallback(() => {
    if (!currentCard) return;
    if (savedIds.has(currentCard.id)) {
      unsaveCard(currentCard.id, currentCard, { surface: 'for_you' });
    } else {
      saveCard(currentCard.id, currentCard, { surface: 'for_you' });
    }
  }, [currentCard, savedIds, saveCard, unsaveCard]);

  const handleLike = useCallback(() => {
    if (!currentCard) return;
    likeCard(currentCard.id, currentCard, { surface: 'for_you' });
  }, [currentCard, likeCard]);

  const handleDislike = useCallback(() => {
    if (!currentCard) return;
    dislikeCard(currentCard.id, currentCard, { surface: 'for_you' });
  }, [currentCard, dislikeCard]);

  const handleNext = useCallback(() => {
    if (currentCard) {
      markSeen(currentCard.id);
    }
    if (feedCards.length === 0) return;

    // If at the end and not showing all cards, trigger re-rank and refresh
    if (index === feedCards.length - 1 && !showingAllCards) {
      rankCards();
      setIndex(0);
      return;
    }

    setIndex((prev) => (prev + 1) % feedCards.length);
  }, [currentCard, feedCards.length, markSeen, index, showingAllCards, rankCards]);

  const handlePrev = useCallback(() => {
    if (feedCards.length === 0) return;
    setIndex((prev) => (prev - 1 + feedCards.length) % feedCards.length);
  }, [feedCards.length]);

  if (isLoading && feedCards.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading insights...</Text>
        </View>
      </View>
    );
  }

  if (feedCards.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No cards available</Text>
          <Text style={styles.emptySubtext}>Pull to refresh</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Card stack */}
      <View style={styles.cardStack}>
        {previousCard && (
          <SwipeCard
            key="previous"
            card={previousCard}
            isSaved={savedIds.has(previousCard.id)}
            isLiked={likedIds.has(previousCard.id)}
            onSave={handleSave}
            onLike={handleLike}
            onDislike={handleDislike}
            onNext={handleNext}
            onPrev={handlePrev}
            currentIndex={index - 1}
            totalCards={feedCards.length}
            isPreview
            containerStyle={[styles.cardLayer, styles.cardLayerPreview]}
            showLearnMeta={previousCard.type === 'lesson'}
            surface="for_you"
          />
        )}
        {upcomingCard && (
          <SwipeCard
            key="preview"
            card={upcomingCard}
            isSaved={savedIds.has(upcomingCard.id)}
            isLiked={likedIds.has(upcomingCard.id)}
            onSave={handleSave}
            onLike={handleLike}
            onDislike={handleDislike}
            onNext={handleNext}
            onPrev={handlePrev}
            currentIndex={(index + 1) % feedCards.length}
            totalCards={feedCards.length}
            isPreview
            containerStyle={[styles.cardLayer, styles.cardLayerPreview]}
            showLearnMeta={upcomingCard.type === 'lesson'}
            surface="for_you"
          />
        )}
        {currentCard && (
          <SwipeCard
            key="current"
            card={currentCard}
            isSaved={savedIds.has(currentCard.id)}
            isLiked={likedIds.has(currentCard.id)}
            onSave={handleSave}
            onLike={handleLike}
            onDislike={handleDislike}
            onNext={handleNext}
            onPrev={handlePrev}
            currentIndex={index}
            totalCards={feedCards.length}
            containerStyle={[styles.cardLayer, styles.cardLayerActive]}
            showLearnMeta={currentCard.type === 'lesson'}
            surface="for_you"
          />
        )}
        {/* Caught up overlay */}
        {isAtEnd && !hasUnseenCards && !showingAllCards && (
          <View style={styles.caughtUpOverlay}>
            <View style={styles.caughtUpCard}>
              <Text style={styles.caughtUpTitle}>You're all caught up</Text>
              <Text style={styles.caughtUpSubtext}>
                You've seen all {allFeedCards.length} cards. Keep swiping to see recommendations based on what you liked.
              </Text>
              <TouchableOpacity
                style={styles.caughtUpButton}
                onPress={() => {
                  setShowingAllCards(true);
                  rankCards();
                  setIndex(0);
                }}
              >
                <Text style={styles.caughtUpButtonText}>Show Recommended</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// Refined color palette
const COLORS = {
  background: '#f9fafb',
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  textFaint: '#d1d5db',
  accent: '#3b82f6',
  divider: '#e5e7eb',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: 16,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '500',
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 8,
  },
  cardStack: {
    flex: 1,
    position: 'relative',
    marginBottom: 8,
  },
  cardLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  cardLayerPreview: {
    transform: [{ scale: 1 }, { translateY: 0 }],
    opacity: 1,
  },
  cardLayerActive: {
    transform: [{ scale: 1 }],
  },
  caughtUpOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  caughtUpCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    alignItems: 'center',
  },
  caughtUpTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  caughtUpSubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  caughtUpButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  caughtUpButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
