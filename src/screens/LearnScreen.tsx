import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SwipeCard } from '../components/SwipeCard';
import { useStore } from '../stores/useStore';
import { bundledCards } from '../data';
import { useCardEngagement } from '../hooks/useCardEngagement';

const COLORS = {
  background: '#f9fafb',
  textPrimary: '#111827',
  textMuted: '#6b7280',
  accent: '#3b82f6',
};

export function LearnScreen() {
  const {
    isLoading,
    savedIds,
    likedIds,
    saveCard,
    unsaveCard,
    likeCard,
    dislikeCard,
    markSeen,
  } = useStore();

  const [index, setIndex] = useState(0);

  // Filter for lesson-type cards from the main card bundle
  const learnCards = bundledCards.filter(card => card.type === 'lesson');

  const previousCard = index > 0 ? learnCards[index - 1] : null;
  const currentCard = learnCards[index];
  const upcomingCard = learnCards[index + 1];

  useCardEngagement(currentCard, 'learn');

  const handleSave = useCallback(() => {
    if (!currentCard) return;
    if (savedIds.has(currentCard.id)) {
      unsaveCard(currentCard.id, currentCard, { surface: 'learn' });
    } else {
      saveCard(currentCard.id, currentCard, { surface: 'learn' });
    }
  }, [currentCard, savedIds, saveCard, unsaveCard]);

  const handleLike = useCallback(() => {
    if (!currentCard) return;
    likeCard(currentCard.id, currentCard, { surface: 'learn' });
  }, [currentCard, likeCard]);

  const handleDislike = useCallback(() => {
    if (!currentCard) return;
    dislikeCard(currentCard.id, currentCard, { surface: 'learn' });
  }, [currentCard, dislikeCard]);

  const handleNext = useCallback(() => {
    if (learnCards.length === 0) return;
    if (currentCard) {
      markSeen(currentCard.id);
    }
    setIndex((prev) => (prev + 1) % learnCards.length);
  }, [currentCard, learnCards.length, markSeen]);

  const handlePrev = useCallback(() => {
    if (learnCards.length === 0) return;
    setIndex((prev) => (prev - 1 + learnCards.length) % learnCards.length);
  }, [learnCards.length]);

  if (isLoading && learnCards.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading lessons...</Text>
        </View>
      </View>
    );
  }

  if (learnCards.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No lessons available</Text>
          <Text style={styles.emptySubtext}>Check back later for new content</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            totalCards={learnCards.length}
            isPreview
            containerStyle={[styles.cardLayer, styles.cardLayerPreview]}
            showLearnMeta
            surface="learn"
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
            currentIndex={index + 1}
            totalCards={learnCards.length}
            isPreview
            containerStyle={[styles.cardLayer, styles.cardLayerPreview]}
            showLearnMeta
            surface="learn"
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
            totalCards={learnCards.length}
            containerStyle={[styles.cardLayer, styles.cardLayerActive]}
            showLearnMeta
            surface="learn"
          />
        )}
      </View>
    </View>
  );
}

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
});
