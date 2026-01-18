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
  Share,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { Card } from '../types';
import { ChatInterface } from './ChatInterface';
import { CommentSheet } from './CommentSheet';
import { useStore } from '../stores/useStore';

const { height, width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  card: Card;
  isSaved: boolean;
  isLiked: boolean;
  onSave: () => void;
  onLike: () => void;
  onDislike: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentIndex: number;
  totalCards: number;
  isPreview?: boolean;
  containerStyle?: ViewStyle;
  showLearnMeta?: boolean;
  onLearnMore?: () => void;
  surface?: 'for_you' | 'learn' | 'ideas' | 'unknown';
}

type PriceRangeKey = 'YTD' | '1Y' | '3Y' | '5Y' | 'MAX';

// Color system
const COLORS = {
  background: '#f9fafb',
  cardBg: '#ffffff',
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  textFaint: '#d1d5db',
  accent: '#3b82f6',
  iconMuted: 'rgba(17, 24, 39, 0.4)',
  accentSubtle: 'rgba(59, 130, 246, 0.08)',
  accentMedium: 'rgba(59, 130, 246, 0.15)',
  divider: '#e5e7eb',
  cardBorder: '#d1d5db',
  ticker: '#2563eb',
  dotActive: '#3b82f6',
  dotInactive: '#d1d5db',
};

const RADIUS = {
  card: 18,
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
  idea: 'IDEA',
};

// Split content into layers
function getContentLayers(card: Card): string[] {
  if (card.type === 'idea') {
    return [card.content];
  }

  const sentences = card.content.match(/[^.!?]+[.!?]+/g) || [card.content];

  // Layer 1: First sentence (the hook)
  const layer1 = sentences[0]?.trim() || card.content;

  // Layer 2: Rest of the main content
  const layer2 = sentences.length > 1
    ? sentences.slice(1).join(' ').trim()
    : '';

  const layers = [layer1];
  if (layer2) layers.push(layer2);

  // Layer 3+: Deep dive / expanded content - split if too long
  const expanded = card.expanded || '';
  if (expanded) {
    const MAX_CHARS_PER_LAYER = 500;

    // First try to split by paragraphs
    const paragraphs = expanded.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

    let currentChunk = '';
    for (const para of paragraphs) {
      if (currentChunk.length + para.length > MAX_CHARS_PER_LAYER && currentChunk) {
        layers.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
      }
    }
    if (currentChunk.trim()) {
      layers.push(currentChunk.trim());
    }
  }

  return layers;
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function splitSentences(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const matches = trimmed.match(/[^.!?]+[.!?]+/g);
  if (!matches) return [trimmed];
  return matches.map((sentence) => sentence.trim()).filter(Boolean);
}

function buildLearnSummary(layers: string[], expanded?: string) {
  const remainder = layers.slice(1).join(' ').trim();
  const expandedFirst = (expanded || '').split(/\n\s*\n/)[0]?.trim() || '';
  const sentences = [
    ...splitSentences(remainder),
    ...splitSentences(expandedFirst),
  ];
  const seen = new Set<string>();
  const unique = sentences.filter((sentence) => {
    const key = sentence.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const maxSentences = 2;
  const maxLength = 240;
  let summary = '';
  let count = 0;

  for (const sentence of unique) {
    if (!sentence) continue;
    if (count >= maxSentences) break;
    const next = summary ? `${summary} ${sentence}` : sentence;
    if (next.length > maxLength && summary) break;
    summary = next;
    count += 1;
    if (summary.length >= maxLength) break;
  }

  if (!summary && expandedFirst) {
    summary = expandedFirst;
  }

  if (summary && !/[.!?]$/.test(summary)) {
    summary = `${summary}.`;
  }

  return summary;
}

function getCommentKey(card: Card) {
  const base = [
    card.type,
    card.content,
    card.source_title || '',
    card.company_name || '',
    Array.isArray(card.tickers) ? card.tickers.join(',') : '',
  ].join('|');
  return `cardhash_${hashString(base)}`;
}

function summarizeIdeaText(text: string, maxLength = 140) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const sentences = trimmed.match(/[^.!?]+[.!?]+/g);
  const firstSentence = sentences?.[0]?.trim();
  if (firstSentence && firstSentence.length <= maxLength) {
    return firstSentence;
  }

  const cutoff = trimmed.slice(0, maxLength);
  const lastBreak = Math.max(
    cutoff.lastIndexOf('.'),
    cutoff.lastIndexOf(','),
    cutoff.lastIndexOf(';'),
    cutoff.lastIndexOf(':'),
    cutoff.lastIndexOf(' ')
  );

  const hasBreak = lastBreak > Math.floor(maxLength * 0.6);
  let summary = (hasBreak ? cutoff.slice(0, lastBreak) : cutoff).trim();
  summary = summary.replace(/[,:;]$/, '').trim();

  if (!summary.endsWith('.') && !summary.endsWith('!') && !summary.endsWith('?')) {
    summary = `${summary}.`;
  }

  return summary;
}

function parseIdeaContent(content: string) {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  const fields: Record<string, string> = {};

  lines.forEach((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const label = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    fields[label] = value;
  });

  const toNumber = (value: string) => {
    const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
  };

  return {
    currentPrice: fields['current price'] || '',
    pe: fields['p/e'] || '',
    peLow: fields['5y p/e low'] || '',
    peHigh: fields['5y p/e high'] || '',
    evEbitda: fields['ev/ebitda'] || '',
    evEbitdaLow: fields['5y ev/ebitda low'] || '',
    evEbitdaHigh: fields['5y ev/ebitda high'] || '',
    business: fields.business || '',
    mispricing: fields.mispricing || '',
    currentPriceValue: toNumber(fields['current price'] || ''),
    peValue: toNumber(fields['p/e'] || ''),
    peLowValue: toNumber(fields['5y p/e low'] || ''),
    peHighValue: toNumber(fields['5y p/e high'] || ''),
    evEbitdaValue: toNumber(fields['ev/ebitda'] || ''),
    evEbitdaLowValue: toNumber(fields['5y ev/ebitda low'] || ''),
    evEbitdaHighValue: toNumber(fields['5y ev/ebitda high'] || ''),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createSeededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function generatePriceHistory(base: number, seedKey: string, points = 36): number[] {
  if (!Number.isFinite(base) || base <= 0) return [];
  let seed = 7;
  for (let i = 0; i < seedKey.length; i += 1) {
    seed = (seed * 31 + seedKey.charCodeAt(i)) % 2147483647;
  }
  const rand = createSeededRandom(seed);
  let price = Math.max(1, base * (0.75 + rand() * 0.25));
  const history: number[] = [];
  for (let i = 0; i < points; i += 1) {
    const drift = 0.002;
    const shock = (rand() - 0.5) * 0.06;
    price = Math.max(1, price * (1 + drift + shock));
    history.push(Number(price.toFixed(2)));
  }
  return history;
}

function sampleSeries(series: number[], maxPoints: number) {
  if (series.length <= maxPoints) return series;
  const step = series.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, idx) => series[Math.floor(idx * step)]);
}

function smoothLinePoints(points: { x: number; y: number }[], segments = 6) {
  if (points.length < 3) return points;
  const smooth: { x: number; y: number }[] = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    for (let j = 0; j < segments; j += 1) {
      const t = j / segments;
      const t2 = t * t;
      const t3 = t2 * t;

      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );
      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );

      smooth.push({ x, y });
    }
  }

  smooth.push(points[points.length - 1]);
  return smooth;
}

function buildLinePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return '';
  return points
    .map((point, idx) => `${idx === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

const PRICE_RANGE_POINTS: Record<PriceRangeKey, number> = {
  YTD: 8,
  '1Y': 12,
  '3Y': 36,
  '5Y': 60,
  MAX: 120,
};

const PRICE_RANGE_ORDER: PriceRangeKey[] = ['YTD', '1Y', '3Y', 'MAX'];

export function SwipeCard({
  card,
  isSaved,
  isLiked,
  onSave,
  onLike,
  onDislike,
  onNext,
  onPrev,
  currentIndex,
  totalCards,
  isPreview = false,
  containerStyle,
  showLearnMeta = false,
  onLearnMore,
  surface,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [priceChartWidth, setPriceChartWidth] = useState(0);
  const [trendRange, setTrendRange] = useState<PriceRangeKey>('3Y');
  const insets = useSafeAreaInsets();
  const commentsEnabled = useStore((state) => state.commentsEnabled);

  const pan = useRef(new Animated.ValueXY()).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const layerFade = useRef(new Animated.Value(1)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;

  // Refs to avoid stale closures in panResponder
  const callbacksRef = useRef({ onSave, onLike, onDislike, onNext, onPrev, isSaved });
  callbacksRef.current = { onSave, onLike, onDislike, onNext, onPrev, isSaved };

  const ideaAnimatingRef = useRef(false);
  const layerStateRef = useRef({
    currentLayer: 0,
    totalLayers: 0,
    isIdea: false,
    showLearnMeta: false,
  });
  layerStateRef.current = {
    currentLayer,
    totalLayers,
    isIdea,
    showLearnMeta,
  };

  const isIdea = card.type === 'idea';
  const layers = getContentLayers(card);
  const ideaLayers = isIdea ? ['summary', 'detail'] : layers;
  const totalLayers = ideaLayers.length;
  const typeLabel = TYPE_LABELS[card.type] || 'LESSON';
  const showLayerUi = totalLayers > 1;
  const ideaDetail = isIdea && currentLayer > 0;
  const showTypeRule = showLearnMeta && !isIdea;
  const primaryTicker = card.tickers && card.tickers.length > 0 ? card.tickers[0] : '';
  const companyName = (card.company_name || '').trim();
  const showIdeaTopRow = isIdea && (companyName || primaryTicker);
  const showLearnTags = showLearnMeta && currentLayer === 0 && Array.isArray(card.tickers) && card.tickers.length > 0;
  const railIconColor = COLORS.iconMuted;
  const railLikeColor = isLiked ? COLORS.accent : COLORS.iconMuted;
  const railBookmarkColor = isSaved ? COLORS.accent : COLORS.iconMuted;
  const actionRailOpacity = 1;
  const ideaFields = card.type === 'idea' ? parseIdeaContent(card.content) : null;
  const commentKey = getCommentKey(card);
  const businessSummary = ideaFields?.business ? summarizeIdeaText(ideaFields.business, 150) : '';
  const mispricingSummary = ideaFields?.mispricing ? summarizeIdeaText(ideaFields.mispricing, 150) : '';
  const learnSummary = showLearnMeta && currentLayer === 0
    ? buildLearnSummary(layers, card.expanded)
    : '';
  const canLearnMore = showLearnMeta && typeof onLearnMore === 'function' && !!card.expanded?.trim() && !isPreview;
  const canGoNext = currentIndex < totalCards - 1;
  const canGoPrev = currentIndex > 0;
  const peRange = ideaFields && ideaFields.peLowValue !== null && ideaFields.peHighValue !== null
    ? ideaFields.peHighValue - ideaFields.peLowValue
    : null;
  const peMarkerPercent = ideaFields && peRange && ideaFields.peValue !== null
    ? clamp((ideaFields.peValue - (ideaFields.peLowValue || 0)) / peRange, 0, 1)
    : 0.5;
  const evRange = ideaFields && ideaFields.evEbitdaLowValue !== null && ideaFields.evEbitdaHighValue !== null
    ? ideaFields.evEbitdaHighValue - ideaFields.evEbitdaLowValue
    : null;
  const evMarkerPercent = ideaFields && evRange && ideaFields.evEbitdaValue !== null
    ? clamp((ideaFields.evEbitdaValue - (ideaFields.evEbitdaLowValue || 0)) / evRange, 0, 1)
    : 0.5;
  const basePriceHistory = card.type === 'idea'
    ? generatePriceHistory(ideaFields?.currentPriceValue || 0, card.id, PRICE_RANGE_POINTS.MAX)
    : [];
  const getRangeSeries = (range: PriceRangeKey) => {
    if (range === '3Y' && Array.isArray(card.price_history_3y) && card.price_history_3y.length > 1) {
      return card.price_history_3y;
    }
    const points = PRICE_RANGE_POINTS[range];
    if (basePriceHistory.length === 0) return [];
    if (basePriceHistory.length <= points) return basePriceHistory;
    return basePriceHistory.slice(-points);
  };
  const priceSeries = sampleSeries(getRangeSeries(trendRange), 30);
  const priceMin = priceSeries.length > 0 ? Math.min(...priceSeries) : 0;
  const priceMax = priceSeries.length > 0 ? Math.max(...priceSeries) : 0;
  const priceCurrent = priceSeries.length > 0 ? priceSeries[priceSeries.length - 1] : null;
  const priceChartHeight = 84;
  const priceChartPadding = 6;
  const priceChartInnerHeight = priceChartHeight - priceChartPadding * 2;
  const priceChartInnerWidth = Math.max(priceChartWidth - priceChartPadding * 2, 1);
  const priceRange = priceMax - priceMin || 1;
  const pricePoints = priceSeries.map((value, idx) => {
    const normalized = (value - priceMin) / priceRange;
    const x = priceSeries.length > 1
      ? priceChartPadding + (idx / (priceSeries.length - 1)) * priceChartInnerWidth
      : priceChartPadding;
    const y = priceChartPadding + (1 - normalized) * priceChartInnerHeight;
    return { x, y };
  });
  const smoothPoints = smoothLinePoints(pricePoints, 7);
  const pricePath = buildLinePath(smoothPoints);
  const hasPriceSeries = priceSeries.length > 0;
  const pricePeakLabel = hasPriceSeries ? `$${priceMax.toFixed(0)}` : '-';
  const priceCurrentLabel = hasPriceSeries && priceCurrent !== null
    ? `$${priceCurrent.toFixed(0)}`
    : '-';
  const priceTroughLabel = hasPriceSeries ? `$${priceMin.toFixed(0)}` : '-';
  const showPriceExtremes = isIdea && hasPriceSeries;
  const showTrendToggles = isIdea;

  // Calculate TSR (Total Shareholder Return) for each range
  const getTSR = (range: PriceRangeKey): number | null => {
    const series = getRangeSeries(range);
    if (series.length < 2) return null;
    const startPrice = series[0];
    const endPrice = series[series.length - 1];
    if (startPrice <= 0) return null;
    return ((endPrice - startPrice) / startPrice) * 100;
  };

  const formatTSR = (tsr: number | null): string => {
    if (tsr === null) return '';
    const sign = tsr >= 0 ? '+' : '';
    return `${sign}${tsr.toFixed(0)}%`;
  };

  // Reset layer on card change
  useEffect(() => {
    setCurrentLayer(0);
    setShowActions(false);
    setShowChat(false);
    setShowComment(false);
    setTrendRange('3Y');
    actionsOpacity.setValue(0);
    pan.setValue({ x: 0, y: 0 });
  }, [card.id]);

  // Animate layer transition
  const goToLayer = (newLayer: number) => {
    const { currentLayer: activeLayer, totalLayers: layerCount } = layerStateRef.current;
    if (newLayer < 0 || newLayer >= layerCount) return;
    if (activeLayer === newLayer) return;

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

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isPreview) return false;
        return Math.abs(gestureState.dy) > 15 || Math.abs(gestureState.dx) > 15;
      },
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gestureState) => {
        const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        const nextX = isVertical ? 0 : gestureState.dx;
        pan.setValue({ x: nextX, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const { onLike: like, onDislike: dislike, onNext: next, onPrev: prev } = callbacksRef.current;
        const {
          currentLayer: activeLayer,
          totalLayers: layerCount,
          isIdea: isIdeaCard,
          showLearnMeta: isLearnCard,
        } = layerStateRef.current;

        if (isHorizontal && (isIdeaCard || isLearnCard)) {
          if (gestureState.dx < -60 && activeLayer < layerCount - 1) {
            goToLayer(activeLayer + 1);
          } else if (gestureState.dx > 60 && activeLayer > 0) {
            goToLayer(activeLayer - 1);
          }
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 8,
          }).start();
          return;
        }

        if (isHorizontal && gestureState.dx > 80) {
          // Swipe right = like (positive signal)
          if (canGoNext) {
            Animated.timing(pan, {
              toValue: { x: width, y: 0 },
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              like();
              next();
            });
          } else {
            like();
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
              friction: 8,
            }).start();
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (isHorizontal && gestureState.dx < -80) {
          // Swipe left = dislike (show less like this)
          if (canGoNext) {
            Animated.timing(pan, {
              toValue: { x: -width, y: 0 },
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              dislike();
              next();
            });
          } else {
            dislike();
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
              friction: 8,
            }).start();
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else if (gestureState.dy < -70) {
          // Swipe up = next
          if (canGoNext) {
            Animated.timing(pan, {
              toValue: { x: 0, y: -height },
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              next();
            });
          } else {
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
              friction: 8,
            }).start();
          }
        } else if (gestureState.dy > 70) {
          // Swipe down = previous
          if (canGoPrev) {
            Animated.timing(pan, {
              toValue: { x: 0, y: height },
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              prev();
            });
          } else {
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
              friction: 8,
            }).start();
          }
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          friction: 8,
        }).start();
      },
    })
  ).current;

  const chartPanResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > 10
          && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isIdea && isHorizontal;
      },
      onPanResponderGrant: () => {},
      onPanResponderRelease: (_, gestureState) => {
        const threshold = 40;
        if (gestureState.dx < -threshold) {
          setTrendRange((prev) => {
            const idx = PRICE_RANGE_ORDER.indexOf(prev);
            const nextIdx = Math.min(idx + 1, PRICE_RANGE_ORDER.length - 1);
            return PRICE_RANGE_ORDER[nextIdx];
          });
        } else if (gestureState.dx > threshold) {
          setTrendRange((prev) => {
            const idx = PRICE_RANGE_ORDER.indexOf(prev);
            const nextIdx = Math.max(idx - 1, 0);
            return PRICE_RANGE_ORDER[nextIdx];
          });
        }
      },
      onPanResponderTerminate: () => {},
    })
  ).current;

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave();
  };

  const handleLikeButton = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLike();
  };

  const handleChatOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowChat(true);
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

  const handleShare = async () => {
    try {
      await Share.share({ message: card.content });
    } catch (e) {
      console.error('Share failed:', e);
    }
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
          onPressIn={undefined}
          onPressOut={undefined}
          onLongPress={!isPreview && !isIdea ? handleLongPress : undefined}
          delayLongPress={400}
        >
          <View style={[styles.cardWrapper, showLearnMeta && styles.cardWrapperLearn]}>
            {showLearnMeta && <View style={styles.learnEdge} />}
            {showIdeaTopRow && (
              <View style={styles.ideaTopRow}>
                <View style={styles.ideaTopLeft}>
                  {companyName ? (
                    <Text style={styles.ideaCompanyText}>{companyName}</Text>
                  ) : null}
                  {primaryTicker ? (
                    <Text style={styles.ideaTickerText}>{primaryTicker}</Text>
                  ) : null}
                </View>
                <View style={styles.ideaTopRight}>
                  <TouchableOpacity
                    style={styles.questionButton}
                    onPress={handleChatOpen}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chatIcon}>?</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Header */}
            {!isIdea && (
              <View style={[styles.cardHeader, showLearnMeta && styles.cardHeaderLearn]}>
                <View style={styles.typeRow}>
                  <View style={[styles.typeAccent, { backgroundColor: getLayerAccentColor() }]} />
                  <Text style={[styles.typeText, showLearnMeta && styles.typeTextLearn]}>
                    {getLayerTitle()}
                  </Text>
                  {showTypeRule && <View style={styles.typeRule} />}
                </View>

                <View style={styles.headerRight}>
                  {/* Layer dots */}
                  {showLayerUi && (
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
                  )}
                  <TouchableOpacity
                    style={styles.questionButton}
                    onPress={handleChatOpen}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chatIcon}>?</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Tap zones (invisible) */}
            {!isIdea && (
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
            )}

            {/* Content */}
            <Animated.View
              style={[
                styles.contentContainer,
                showLearnMeta && styles.contentContainerLearn,
                isIdea && styles.contentContainerIdea,
                !isIdea && { opacity: layerFade },
              ]}
            >
              {card.type === 'idea' && ideaFields ? (
                <View style={styles.ideaContent}>

                  <View style={styles.chartSection}>
                    <View style={styles.chartHeaderRow}>
                      <Text style={styles.chartTitle}>Price trend</Text>
                      {showTrendToggles && (
                        <View style={styles.rangeToggleRow}>
                          {PRICE_RANGE_ORDER.map((range) => {
                            const isActive = trendRange === range;
                            const tsr = getTSR(range);
                            const tsrLabel = formatTSR(tsr);
                            const isPositive = tsr !== null && tsr >= 0;
                            return (
                              <Pressable
                                key={range}
                                onPress={() => setTrendRange(range)}
                                hitSlop={6}
                                style={[styles.rangeToggle, isActive && styles.rangeToggleActive]}
                              >
                                <Text style={[styles.rangeToggleText, isActive && styles.rangeToggleTextActive]}>
                                  {range}
                                  {tsrLabel ? (
                                    <Text style={[
                                      styles.tsrText,
                                      isPositive ? styles.tsrPositive : styles.tsrNegative,
                                    ]}>
                                      {' '}{tsrLabel}
                                    </Text>
                                  ) : null}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                    <View style={styles.priceChartRow}>
                      <View
                        style={[
                          styles.priceAxis,
                          showPriceExtremes ? styles.priceAxisSpaced : styles.priceAxisCentered,
                        ]}
                      >
                        {showPriceExtremes && (
                          <Text style={[styles.priceAxisLabel, styles.priceAxisTop]}>
                            Peak {pricePeakLabel}
                          </Text>
                        )}
                        <Text style={[styles.priceAxisLabel, styles.priceAxisCurrent]}>
                          Current {priceCurrentLabel}
                        </Text>
                        {showPriceExtremes && (
                          <Text style={[styles.priceAxisLabel, styles.priceAxisBottom]}>
                            Trough {priceTroughLabel}
                          </Text>
                        )}
                      </View>
                      <View
                        style={[styles.priceChart, { height: priceChartHeight }]}
                        onLayout={(event) => setPriceChartWidth(event.nativeEvent.layout.width)}
                        {...chartPanResponder.panHandlers}
                      >
                        {smoothPoints.length > 1 && priceChartWidth > 0 ? (
                          <Svg
                            width={priceChartWidth}
                            height={priceChartHeight}
                            style={styles.priceSvg}
                          >
                            <Path
                              d={pricePath}
                              stroke="rgba(28, 28, 28, 0.72)"
                              strokeWidth={2.4}
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <Circle
                              cx={smoothPoints[smoothPoints.length - 1].x}
                              cy={smoothPoints[smoothPoints.length - 1].y}
                              r={3.2}
                              fill={COLORS.accent}
                            />
                          </Svg>
                        ) : (
                          <View style={styles.priceChartEmpty}>
                            <Text style={styles.priceChartEmptyText}>No price data</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.chartSection}>
                    <Text style={styles.chartTitle}>P/E range (5Y)</Text>
                    <View style={styles.peRow}>
                      <Text style={styles.peEdgeLabel}>{ideaFields.peLow || '-'}</Text>
                      <View style={styles.peTrack}>
                        <View style={[styles.peMarker, { left: `${peMarkerPercent * 100}%` }]} />
                      </View>
                      <Text style={styles.peEdgeLabel}>{ideaFields.peHigh || '-'}</Text>
                    </View>
                    <Text style={styles.peCurrentLabel}>Current: {ideaFields.pe || '-'}</Text>
                  </View>

                  <View style={styles.chartSection}>
                    <Text style={styles.chartTitle}>EV/EBITDA range (5Y)</Text>
                    <View style={styles.peRow}>
                      <Text style={styles.peEdgeLabel}>{ideaFields.evEbitdaLow || '-'}</Text>
                      <View style={styles.peTrack}>
                        <View style={[styles.peMarker, { left: `${evMarkerPercent * 100}%` }]} />
                      </View>
                      <Text style={styles.peEdgeLabel}>{ideaFields.evEbitdaHigh || '-'}</Text>
                    </View>
                    <Text style={styles.peCurrentLabel}>Current: {ideaFields.evEbitda || '-'}</Text>
                  </View>

                  {ideaDetail ? (
                    <>
                      <View style={styles.ideaSection}>
                        <Text style={styles.ideaSectionLabel}>Business</Text>
                        <Text style={styles.ideaSectionText}>{ideaFields.business}</Text>
                      </View>

                      <View style={[styles.ideaSection, styles.ideaSectionDivider]}>
                        <Text style={styles.ideaSectionLabel}>Mispricing</Text>
                        <Text style={styles.ideaSectionText}>{ideaFields.mispricing}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.ideaSummarySection}>
                      {businessSummary ? (
                        <Text style={styles.ideaSummaryText}>
                          Business: {businessSummary}
                        </Text>
                      ) : null}
                      {mispricingSummary ? (
                        <Text style={styles.ideaSummaryText}>
                          Mispricing: {mispricingSummary}
                        </Text>
                      ) : null}
                    </View>
                  )}

                </View>
              ) : (
                <View>
              {showLearnMeta && currentLayer === 0 && learnSummary ? (
                <>
                  {showLearnTags && (
                    <View style={styles.learnTagRow}>
                      {card.tickers.slice(0, 2).map((ticker) => (
                        <View key={ticker} style={styles.tickerChipLearn}>
                          <Text style={styles.tickerTextLearn}>{ticker}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <Text style={styles.learnTitleText}>
                    {layers[currentLayer]}
                  </Text>
                  <View style={styles.learnDivider} />
                  <Text style={styles.learnSubtext}>
                    {learnSummary}
                  </Text>
                </>
                  ) : (
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
                  )}
                </View>
              )}
            </Animated.View>

            {/* Footer */}
            <View style={[styles.footerContainer, showLearnMeta && styles.footerContainerLearn]}>
              {!showLearnMeta && !isIdea && card.tickers && card.tickers.length > 0 ? (
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
              </View>
            </View>
          </View>

          {/* TikTok-style vertical action rail */}
          {!isPreview && (
            <View style={styles.actionRail}>
              <TouchableOpacity
                style={styles.railButton}
                onPress={handleLikeButton}
                activeOpacity={0.7}
              >
                <FontAwesome
                  name={isLiked ? 'heart' : 'heart-o'}
                  size={26}
                  color={isLiked ? '#ef4444' : '#6b7280'}
                />
              </TouchableOpacity>
              {commentsEnabled && (
                <TouchableOpacity
                  style={styles.railButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowComment(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name="message-circle" size={26} color="#6b7280" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.railButton}
                onPress={handleSave}
                activeOpacity={0.7}
              >
                <FontAwesome
                  name={isSaved ? 'bookmark' : 'bookmark-o'}
                  size={26}
                  color={isSaved ? COLORS.accent : '#6b7280'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.railButton}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Feather name="share-2" size={26} color="#6b7280" />
              </TouchableOpacity>
            </View>
          )}

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

      {!isPreview && commentsEnabled && (
        <CommentSheet
          visible={showComment}
          onClose={() => setShowComment(false)}
          cardId={card.id}
          cardKey={commentKey}
          card={card}
          surface={surface}
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

  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  touchable: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },

  cardWrapper: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  cardWrapperLearn: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  learnEdge: {
    position: 'absolute',
    left: 0,
    top: SPACING.md,
    bottom: SPACING.md,
    width: 3,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
    opacity: 0.45,
  },
  ideaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  ideaTopLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  ideaCompanyText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  ideaTickerText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: COLORS.textMuted,
  },

  // Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardHeaderLearn: {
    marginBottom: SPACING.sm,
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
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  typeTextLearn: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  typeRule: {
    height: 1,
    width: 24,
    backgroundColor: COLORS.textPrimary,
    opacity: 0.35,
    marginLeft: SPACING.xs,
  },

  // Layer dots
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    paddingLeft: SPACING.xs,
    paddingRight: SPACING.xs + 68,
    overflow: 'hidden',
  },
  contentContainerLearn: {
    justifyContent: 'flex-start',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    flex: 1,
  },
  contentContainerIdea: {
    justifyContent: 'flex-start',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    paddingRight: SPACING.sm + 28,
    flex: 0,
  },
  contentText: {
    // Uses system default sans-serif font
  },
  contentTextPrimary: {
    color: COLORS.textPrimary,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '600',
  },
  contentTextSecondary: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  contentTextDeepDive: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  learnTitleText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: COLORS.textPrimary,
    maxWidth: '92%',
  },
  learnDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  learnSubtext: {
    marginTop: 0,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  learnTagRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  tickerChipLearn: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tickerTextLearn: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  ideaContent: {
    flexGrow: 0,
    gap: SPACING.lg,
  },
  chartSection: {
    gap: 8,
  },
  chartHeaderRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  rangeToggleRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
    justifyContent: 'flex-start',
  },
  rangeToggle: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeToggleActive: {
    backgroundColor: COLORS.accentSubtle,
    borderColor: COLORS.accent,
  },
  rangeToggleText: {
    fontSize: 9,
    letterSpacing: 0.5,
    color: COLORS.textMuted,
  },
  rangeToggleTextActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  tsrText: {
    fontSize: 9,
    fontWeight: '500',
  },
  tsrPositive: {
    color: '#16a34a',
  },
  tsrNegative: {
    color: '#dc2626',
  },
  chartTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.textPrimary,
  },
  peRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  peEdgeLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    opacity: 0.6,
    minWidth: 44,
  },
  peTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(17, 24, 39, 0.15)',
    position: 'relative',
  },
  peMarker: {
    position: 'absolute',
    top: -3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.accent,
    transform: [{ translateX: -5 }],
  },
  peCurrentLabel: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '600',
  },
  priceChart: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
  },
  priceChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  priceAxis: {
    width: 54,
    height: 84,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  priceAxisSpaced: {
    justifyContent: 'space-between',
  },
  priceAxisCentered: {
    justifyContent: 'center',
  },
  priceAxisLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    lineHeight: 14,
  },
  priceAxisTop: {
    opacity: 0.6,
  },
  priceAxisCurrent: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  priceAxisBottom: {
    opacity: 0.6,
  },
  priceSvg: {
    width: '100%',
    height: '100%',
  },
  priceChartEmpty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceChartEmptyText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  ideaSection: {
    gap: 4,
    maxWidth: '88%',
  },
  ideaSectionDivider: {
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  ideaSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: COLORS.textPrimary,
  },
  ideaSectionText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  ideaSummarySection: {
    gap: 8,
    maxWidth: '92%',
  },
  ideaSummaryText: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },

  // Actions
  actionRail: {
    position: 'absolute',
    right: 18,
    bottom: 80,
    alignItems: 'center',
    gap: 16,
    zIndex: 20,
  },
  railButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Footer
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: SPACING.md,
  },
  footerContainerLearn: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  expandRow: {
    marginTop: SPACING.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandRowText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
  },
  tickerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accentMedium,
    backgroundColor: COLORS.accentSubtle,
  },
  learnMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
  },
  tickerChip: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
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
    color: COLORS.textMuted,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
  },
  questionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(249, 250, 251, 0.96)',
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

