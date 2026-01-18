import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useStore } from '../stores/useStore';
import { Card } from '../types';
import { SwipeCard } from '../components/SwipeCard';

const COLORS = {
  background: '#f9fafb',
  card: '#ffffff',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  accent: '#3b82f6',
  border: '#e5e7eb',
};

export function SavedCardsScreen() {
  const { savedIds, allCards, unsaveCard, likeCard, dislikeCard } = useStore();
  const [savedCards, setSavedCards] = useState<Card[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const loadSavedCards = useCallback(async () => {
    const saved = allCards.filter(card => savedIds.has(card.id));
    setSavedCards(saved);
  }, [allCards, savedIds]);

  useEffect(() => {
    loadSavedCards();
  }, [loadSavedCards]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSavedCards();
    setRefreshing(false);
  };

  const handleUnsave = async (cardId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await unsaveCard(cardId);
  };

  const handleCardPress = (cardId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCardId(expandedCardId === cardId ? null : cardId);
  };

  const renderSavedCard = (item: Card) => {
    const isExpanded = expandedCardId === item.id;

    if (isExpanded) {
      return (
        <View key={item.id} style={styles.expandedCardContainer}>
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={() => setExpandedCardId(null)}
          >
            <Feather name="x" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          <SwipeCard
            card={item}
            isSaved={true}
            isLiked={false}
            onSave={() => handleUnsave(item.id)}
            onLike={() => likeCard(item.id, item)}
            onDislike={() => dislikeCard(item.id, item)}
            onNext={() => setExpandedCardId(null)}
            onPrev={() => {}}
            currentIndex={0}
            totalCards={1}
            isPreview={false}
            surface="for_you"
          />
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.cardItem}
        onPress={() => handleCardPress(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardType}>{item.type}</Text>
            {item.tickers && item.tickers.length > 0 && (
              <Text style={styles.cardTicker}>{item.tickers[0]}</Text>
            )}
          </View>
          <Text style={styles.cardText} numberOfLines={3}>
            {item.content}
          </Text>
          <View style={styles.cardFooter}>
            {item.categories && item.categories.length > 0 && (
              <Text style={styles.cardCategory}>{item.categories[0]}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.unsaveButton}
          onPress={() => handleUnsave(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="bookmark" size={20} color={COLORS.accent} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="bookmark" size={48} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>No saved cards</Text>
      <Text style={styles.emptySubtext}>
        Cards you save will appear here for easy access
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          savedCards.length === 0 && styles.scrollContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
      >
        {savedCards.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.cardsList}>
            {savedCards.map(item => renderSavedCard(item))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentEmpty: {
    flex: 1,
  },
  cardsList: {
    gap: 12,
  },
  cardItem: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardType: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTicker: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    backgroundColor: COLORS.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textPrimary,
  },
  cardFooter: {
    flexDirection: 'row',
    marginTop: 8,
  },
  cardCategory: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  unsaveButton: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  expandedCardContainer: {
    height: 500,
    marginBottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  collapseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
