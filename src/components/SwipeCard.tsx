import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ViewStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Card } from '../types';
import { ChatInterface } from './ChatInterface';

const { height, width } = Dimensions.get('window');

interface Props {
  card: Card;
  isSaved: boolean;
  onSave: () => void;
  onLike: () => void;
  onDislike: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentIndex: number;
  totalCards: number;
  isPreview?: boolean;
  containerStyle?: ViewStyle;
}

// Color system
const COLORS = {
  background: '#EDEAE5',
  cardBg: '#F9F8F6',
  textPrimary: '#1C1C1C',
  textSecondary: '#4D4D4D',
  textMuted: '#7A7A7A',
  textLight: '#A8A8A8',
  textFaint: '#C8C8C8',
  accent: '#A84820',
  accentSubtle: 'rgba(168, 72, 32, 0.08)',
  accentMedium: 'rgba(168, 72, 32, 0.15)',
  divider: '#DDD9D3',
  cardBorder: '#E5E2DC',
  ticker: '#456B3F',
  dotActive: '#A84820',
  dotInactive: '#D5D2CD',
};

const RADIUS = {
  card: 14,
  pill: 14,
  button: 8,
};

const SPACING = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
};

const TYPE_LABELS: Record<string, string> = {
  insight: 'INSIGHT',
  prediction: 'PREDICTION',
  contrarian: 'CONTRARIAN',
  number: 'KEY DATA',
  thesis: 'THESIS',
  stat: 'DATA',
  mechanic: 'MECHANIC',
  lesson: 'LESSON',
  pattern: 'PATTERN',
  framework: 'FRAMEWORK',
};

// Split content into layers
function getContentLayers(card: Card): string[] {
  const sentences = card.content.match(/[^.!?]+[.!?]+/g) || [card.content];

  // Layer 1: First sentence (the hook)
  const layer1 = sentences[0]?.trim() || card.content;

  // Layer 2: Rest of the main content
  const layer2 = sentences.length > 1
    ? sentences.slice(1).join(' ').trim()
    : '';

  // Layer 3: Deep dive / expanded content
  const layer3 = card.expanded || '';

  const layers = [layer1];
  if (layer2) layers.push(layer2);
  if (layer3) layers.push(layer3);

  return layers;
}

export function SwipeCard({
  card,
  isSaved,
  onSave,
  onLike,
  onDislike,
  onNext,
  onPrev,
  currentIndex,
  totalCards,
  isPreview = false,
  containerStyle,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const layerFade = useRef(new Animated.Value(1)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;

  // Refs to avoid stale closures in panResponder
  const callbacksRef = useRef({ onSave, onLike, onDislike, onNext, onPrev, isSaved });
  callbacksRef.current = { onSave, onLike, onDislike, onNext, onPrev, isSaved };

  const layers = getContentLayers(card);
  const totalLayers = layers.length;
  const typeLabel = TYPE_LABELS[card.type] || 'LESSON';

  // Reset layer on card change
  useEffect(() => {
    setCurrentLayer(0);
    setShowActions(false);
    setShowChat(false);
    fadeAnim.setValue(1);
    layerFade.setValue(1);
    actionsOpacity.setValue(0);
  }, [currentIndex]);

  // Animate layer transition
  const goToLayer = (newLayer: number) => {
    if (newLayer < 0 || newLayer >= totalLayers) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.sequence([
      Animated.timing(layerFade, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(layerFade, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => setCurrentLayer(newLayer), 100);
  };

  const handleTapLeft = () => {
    if (currentLayer > 0) {
      goToLayer(currentLayer - 1);
    }
  };

  const handleTapRight = () => {
    if (currentLayer < totalLayers - 1) {
      goToLayer(currentLayer + 1);
    }
  };

  const progress = totalCards > 0 ? ((currentIndex + 1) / totalCards) * 100 : 0;

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isPreview) return false;
        return Math.abs(gestureState.dy) > 15 || Math.abs(gestureState.dx) > 15;
      },
      onPanResponderGrant: () => {
        // Gesture started
      },
      onPanResponderMove: (_, gestureState) => {
        const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        const nextX = isVertical ? 0 : gestureState.dx;
        pan.setValue({ x: nextX, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const { onLike: like, onDislike: dislike, onNext: next, onPrev: prev } = callbacksRef.current;

        if (isHorizontal && gestureState.dx > 80) {
          // Swipe right = like (positive signal)
          Animated.timing(pan, {
            toValue: { x: width, y: 0 },
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 });
            like();
            next();
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (isHorizontal && gestureState.dx < -80) {
          // Swipe left = dislike (show less like this)
          Animated.timing(pan, {
            toValue: { x: -width, y: 0 },
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 });
            dislike();
            next();
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else if (gestureState.dy < -70) {
          // Swipe up = next
          Animated.timing(pan, {
            toValue: { x: 0, y: -height },
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 });
            next();
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (gestureState.dy > 70) {
          // Swipe down = previous
          Animated.timing(pan, {
            toValue: { x: 0, y: height },
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 });
            prev();
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave();
  };

  const handleDislikeButton = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDislike();
    onNext();
  };

  const handleLikeButton = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLike();
    onNext();
  };

  const handleCopy = async () => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(card.content);
      } else {
        await Clipboard.setStringAsync(card.content);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowActions(true);
    Animated.timing(actionsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const hideActions = () => {
    Animated.timing(actionsOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setShowActions(false));
  };

  // Get layer-specific content
  const getLayerTitle = () => {
    if (currentLayer === 0) return typeLabel;
    if (currentLayer === 1) return 'CONTEXT';
    return 'DEEP DIVE';
  };

  const getLayerAccentColor = () => {
    if (currentLayer === 0) return COLORS.accent;
    if (currentLayer === 1) return COLORS.textMuted;
    return COLORS.ticker;
  };

  return (
    <View style={[styles.outerContainer, containerStyle]} pointerEvents={isPreview ? 'none' : 'auto'}>
      {/* Progress bar */}
      {!isPreview && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
      )}

      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
            opacity: fadeAnim,
          },
        ]}
        {...(!isPreview ? panResponder.panHandlers : {})}
      >
        <Pressable
          style={styles.touchable}
          onLongPress={!isPreview ? handleLongPress : undefined}
          delayLongPress={400}
        >
          <View style={styles.cardWrapper}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={styles.typeRow}>
                <View style={[styles.typeAccent, { backgroundColor: getLayerAccentColor() }]} />
                <Text style={styles.typeText}>{getLayerTitle()}</Text>
              </View>

              {/* Layer dots */}
              <View style={styles.dotsContainer}>
                {layers.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      idx === currentLayer && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Tap zones (invisible) */}
            <View style={styles.tapZonesContainer}>
              <TouchableOpacity
                style={styles.tapZoneLeft}
                onPress={handleTapLeft}
                activeOpacity={1}
              />
              <TouchableOpacity
                style={styles.tapZoneRight}
                onPress={handleTapRight}
                activeOpacity={1}
              />
            </View>

            {/* Content */}
            <Animated.View style={[styles.contentContainer, { opacity: layerFade }]}>
              <Text
                style={[
                  styles.contentText,
                  currentLayer === 0 && styles.contentTextPrimary,
                  currentLayer === 1 && styles.contentTextSecondary,
                  currentLayer >= 2 && styles.contentTextDeepDive,
                ]}
              >
                {layers[currentLayer]}
              </Text>
            </Animated.View>

            {/* Quick actions */}
            {!isPreview && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.quickActionButtonDislike]}
                  onPress={handleDislikeButton}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickActionButtonText, styles.quickActionButtonTextDislike]}>
                    Dislike
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.quickActionButtonLike]}
                  onPress={handleLikeButton}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickActionButtonText, styles.quickActionButtonTextLike]}>
                    Like
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Footer */}
            <View style={styles.footerContainer}>
              {card.tickers && card.tickers.length > 0 ? (
                <View style={styles.tickerRow}>
                  {card.tickers.slice(0, 2).map((ticker) => (
                    <View key={ticker} style={styles.tickerChip}>
                      <Text style={styles.tickerText}>{ticker}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View />
              )}

              <View style={styles.footerRight}>
                {/* Navigation hint */}
                <Text style={styles.hintText}>
                  {currentLayer < totalLayers - 1 ? 'tap for more →' : '← less · more →'}
                </Text>

                {/* Chat button */}
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowChat(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chatIcon}>?</Text>
                </TouchableOpacity>

                {/* Star button */}
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={handleSave}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.starIcon, isSaved && styles.starIconActive]}>
                    {isSaved ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Actions overlay */}
          {showActions && (
            <Animated.View style={[styles.actionsOverlay, { opacity: actionsOpacity }]}>
              <Pressable style={styles.actionsBackdrop} onPress={hideActions}>
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => { handleSave(); hideActions(); }}
                  >
                    <Text style={[styles.actionText, isSaved && styles.actionTextActive]}>
                      {isSaved ? 'Unsave' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => { handleCopy(); hideActions(); }}
                  >
                    <Text style={styles.actionText}>
                      {copied ? 'Copied!' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Animated.View>
          )}
        </Pressable>
      </Animated.View>

      {/* Chat Interface */}
      {!isPreview && (
        <ChatInterface
          visible={showChat}
          onClose={() => setShowChat(false)}
          card={card}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  progressContainer: {
    height: 2,
    backgroundColor: COLORS.divider,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  progressBar: {
    height: 2,
    backgroundColor: COLORS.accent,
  },

  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  touchable: {
    flex: 1,
    padding: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  cardWrapper: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
    overflow: 'hidden',
  },

  // Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeAccent: {
    width: 3,
    height: 12,
    backgroundColor: COLORS.accent,
    marginRight: SPACING.xs,
    borderRadius: 2,
  },
  typeText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },

  // Layer dots
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.dotInactive,
  },
  dotActive: {
    backgroundColor: COLORS.dotActive,
    width: 18,
  },

  // Tap zones
  tapZonesContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    bottom: 50,
    flexDirection: 'row',
    zIndex: 10,
  },
  tapZoneLeft: {
    flex: 1,
  },
  tapZoneRight: {
    flex: 2,
  },

  // Content
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
    overflow: 'hidden',
  },
  contentText: {
    // Uses system default sans-serif font
  },
  contentTextPrimary: {
    color: COLORS.textPrimary,
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '600',
  },
  contentTextSecondary: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400',
  },
  contentTextDeepDive: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    marginTop: SPACING.sm,
  },
  quickActionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
  },
  quickActionButtonDislike: {
    backgroundColor: 'rgba(77, 77, 77, 0.06)',
  },
  quickActionButtonLike: {
    backgroundColor: COLORS.accentSubtle,
    borderColor: COLORS.accentMedium,
  },
  quickActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  quickActionButtonTextDislike: {
    color: COLORS.textSecondary,
  },
  quickActionButtonTextLike: {
    color: COLORS.accent,
  },

  // Footer
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: SPACING.md,
  },
  tickerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tickerChip: {
    backgroundColor: 'rgba(69, 107, 63, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tickerText: {
    color: COLORS.ticker,
    fontSize: 9,
    fontWeight: '600',
  },
  hintText: {
    color: COLORS.textFaint,
    fontSize: 10,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accentSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accent,
  },
  starIcon: {
    fontSize: 18,
    color: COLORS.textFaint,
  },
  starIconActive: {
    color: COLORS.accent,
  },

  // Actions overlay
  actionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  actionsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(237, 234, 229, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  actionText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  actionTextActive: {
    color: COLORS.accent,
  },

});
