import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SwipeCard } from '../components/SwipeCard';
import { useStore } from '../stores/useStore';

export function FeedScreen() {
  const {
    cards,
    currentIndex,
    isLoading,
    savedIds,
    nextCard,
    prevCard,
    saveCard,
    unsaveCard,
    likeCard,
    dislikeCard,
    markSeen,
  } = useStore();

  const currentCard = cards[currentIndex];

  const handleSave = useCallback(() => {
    if (!currentCard) return;
    if (savedIds.has(currentCard.id)) {
      unsaveCard(currentCard.id);
    } else {
      saveCard(currentCard.id);
    }
  }, [currentCard, savedIds]);

  const handleLike = useCallback(() => {
    if (!currentCard) return;
    likeCard(currentCard.id);
  }, [currentCard]);

  const handleDislike = useCallback(() => {
    if (!currentCard) return;
    dislikeCard(currentCard.id);
  }, [currentCard]);

  const handleNext = useCallback(() => {
    if (currentCard) {
      markSeen(currentCard.id);
    }
    nextCard();
  }, [currentCard]);

  if (isLoading && cards.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (cards.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No cards available</Text>
          <Text style={styles.emptySubtext}>Pull to refresh</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.categoryBar}>
        <View style={styles.categoryTitleWrap}>
          <Text style={styles.categoryTitle}>For You</Text>
          <View style={styles.categoryTitleUnderline} />
        </View>
      </View>

      {/* Card */}
      {currentCard && (
        <SwipeCard
          card={currentCard}
          isSaved={savedIds.has(currentCard.id)}
          onSave={handleSave}
          onLike={handleLike}
          onDislike={handleDislike}
          onNext={handleNext}
          onPrev={prevCard}
          currentIndex={currentIndex}
          totalCards={cards.length}
        />
      )}
    </SafeAreaView>
  );
}

// Refined color palette
const COLORS = {
  background: '#EDEAE5',
  textPrimary: '#1C1C1C',
  textSecondary: '#4D4D4D',
  textMuted: '#7A7A7A',
  textLight: '#A8A8A8',
  textFaint: '#C8C8C8',
  accent: '#A84820',
  divider: '#DDD9D3',
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
  // Category nav - minimal
  categoryBar: {
    minHeight: 34,
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  categoryTitleWrap: {
    alignItems: 'center',
  },
  categoryTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  categoryTitleUnderline: {
    marginTop: 6,
    width: 26,
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 1,
  },
});
