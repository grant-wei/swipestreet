import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../stores/useStore';
import { Card } from '../types';

// Proxera light blue-grey palette
const COLORS = {
  background: '#f9fafb',
  card: '#ffffff',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  accent: '#3b82f6',
  accentGreen: '#22c55e',
  border: '#e5e7eb',
};

function SavedCard({ card, onRemove }: { card: Card; onRemove: () => void }) {
  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <View style={styles.typeAccent} />
        <Text style={styles.cardType}>{card.type.toUpperCase()}</Text>
        <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.cardContent}>{card.content}</Text>
      {card.tickers.length > 0 && (
        <View style={styles.tickerRow}>
          {card.tickers.map((t) => (
            <Text key={t} style={styles.ticker}>
              ${t}
            </Text>
          ))}
        </View>
      )}
      <Text style={styles.cardSource} numberOfLines={1}>
        {card.source_title}
      </Text>
    </View>
  );
}

export function SavedScreen() {
  const { cards, savedIds, unsaveCard } = useStore();
  const [savedCards, setSavedCards] = useState<Card[]>([]);

  useEffect(() => {
    const saved = cards.filter((c) => savedIds.has(c.id));
    setSavedCards(saved);
  }, [cards, savedIds]);

  if (savedCards.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Saved</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>Bookmark icon</Text>
          <Text style={styles.emptyText}>No saved cards yet</Text>
          <Text style={styles.emptySubtext}>
            Tap on cards in the feed to save them for later
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved</Text>
        <Text style={styles.count}>{savedCards.length} cards</Text>
      </View>
      <FlatList
        data={savedCards}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SavedCard card={item} onRemove={() => unsaveCard(item.id)} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  count: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  list: {
    padding: 16,
  },
  cardContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeAccent: {
    width: 3,
    height: 14,
    backgroundColor: COLORS.accent,
    marginRight: 8,
    borderRadius: 1,
  },
  cardType: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  removeText: {
    color: COLORS.accent,
    fontSize: 12,
  },
  cardContent: {
    color: COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  tickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  ticker: {
    color: COLORS.accentGreen,
    fontSize: 14,
    fontWeight: '500',
  },
  cardSource: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    color: COLORS.textMuted,
  },
  emptyText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
