import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { SwipeCard } from '../components/SwipeCard';
import { bundledIdeas } from '../data';
import { useStore } from '../stores/useStore';
import { useCardEngagement } from '../hooks/useCardEngagement';

export function IdeasScreen() {
  const [index, setIndex] = useState(0);
  const { savedIds, likedIds, saveCard, unsaveCard, likeCard, dislikeCard } = useStore();

  useEffect(() => {
    if (bundledIdeas.length === 0) {
      setIndex(0);
      return;
    }
    if (index >= bundledIdeas.length) {
      setIndex(0);
    }
  }, [index, bundledIdeas.length]);

  const currentCard = bundledIdeas[index];
  const upcomingCard = bundledIdeas[index + 1];

  useCardEngagement(currentCard, 'ideas');

  const handleSave = useCallback(() => {
    if (!currentCard) return;
    if (savedIds.has(currentCard.id)) {
      unsaveCard(currentCard.id, currentCard, { surface: 'ideas' });
    } else {
      saveCard(currentCard.id, currentCard, { surface: 'ideas' });
    }
  }, [currentCard, savedIds, saveCard, unsaveCard]);

  const handleLike = useCallback(() => {
    if (!currentCard) return;
    likeCard(currentCard.id, currentCard, { surface: 'ideas' });
  }, [currentCard, likeCard]);

  const handleDislike = useCallback(() => {
    if (!currentCard) return;
    dislikeCard(currentCard.id, currentCard, { surface: 'ideas' });
  }, [currentCard, dislikeCard]);

  const handleNext = useCallback(() => {
    if (bundledIdeas.length === 0) return;
    setIndex((prev) => (prev + 1) % bundledIdeas.length);
  }, [bundledIdeas.length]);

  const handlePrev = useCallback(() => {
    if (bundledIdeas.length === 0) return;
    setIndex((prev) => (prev - 1 + bundledIdeas.length) % bundledIdeas.length);
  }, [bundledIdeas.length]);

  if (bundledIdeas.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No ideas available</Text>
          <Text style={styles.emptySubtext}>Add ideas to get started</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cardStack}>
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
            totalCards={bundledIdeas.length}
            isPreview
            containerStyle={[styles.cardLayer, styles.cardLayerPreview]}
            surface="ideas"
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
            totalCards={bundledIdeas.length}
            containerStyle={[styles.cardLayer, styles.cardLayerActive]}
            surface="ideas"
          />
        )}
      </View>
    </View>
  );
}

const COLORS = {
  background: '#f9fafb',
  textPrimary: '#111827',
  textMuted: '#6b7280',
  accent: '#3b82f6',
  divider: '#e5e7eb',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
