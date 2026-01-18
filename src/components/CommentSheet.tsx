import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  Keyboard,
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator,
  PanResponder,
  InputAccessoryView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { offlineStorage, CommentItem } from '../services/offline';
import { api } from '../services/api';
import { Card } from '../types';
import { useStore } from '../stores/useStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT_PARTIAL = SCREEN_HEIGHT * 0.6;
const TAB_HEADER_HEIGHT = 100;
const INPUT_ACCESSORY_ID = 'comment-input-accessory';

interface Props {
  visible: boolean;
  onClose: () => void;
  cardId: string;
  cardKey?: string;
  card?: Card;
  surface?: 'for_you' | 'learn' | 'ideas' | 'unknown';
}

const COLORS = {
  background: '#f9fafb',
  cardBg: '#ffffff',
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  accent: '#3b82f6',
  divider: '#e5e7eb',
  heart: '#ef4444',
};

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '😂', '😮', '😢'];

const countAllComments = (comments: CommentItem[]): number => {
  let count = 0;
  for (const comment of comments) {
    count += 1;
    if (comment.replies && comment.replies.length > 0) {
      count += countAllComments(comment.replies);
    }
  }
  return count;
};

export function CommentSheet({ visible, onClose, cardId, cardKey, card, surface }: Props) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string } | null>(null);
  const isExpandedRef = useRef(false);
  const insets = useSafeAreaInsets();
  const recordEngagement = useStore((state) => state.recordEngagement);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const scrollOffsetY = useRef(0);

  const sheetHeightFull = SCREEN_HEIGHT - TAB_HEADER_HEIGHT - insets.top;
  const sheetHeight = isExpanded ? sheetHeightFull : SHEET_HEIGHT_PARTIAL;

  const expandSheet = () => {
    setIsExpanded(true);
    isExpandedRef.current = true;
  };

  const collapseSheet = () => {
    setIsExpanded(false);
    isExpandedRef.current = false;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isVerticalSwipe = Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
        if (!isVerticalSwipe) return false;
        if (gestureState.dy > 0) {
          return scrollOffsetY.current <= 0;
        }
        return !isExpandedRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;
        if (dy < -50 || vy < -0.5) {
          if (!isExpandedRef.current) {
            expandSheet();
          }
        } else if (dy > 50 || vy > 0.5) {
          if (isExpandedRef.current) {
            collapseSheet();
          } else {
            Keyboard.dismiss();
            onClose();
          }
        }
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }).start();
      },
    })
  ).current;

  const mergeComments = (local: CommentItem[], remote: CommentItem[]) => {
    const combined = [...remote, ...local];
    const seen = new Set<string>();
    const filtered = combined.filter((comment) => {
      const key = comment.id || `${comment.text}-${comment.created_at}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return filtered.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return aTime - bTime;
    });
  };

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      const loadComments = async () => {
        const liked = await offlineStorage.getLikedCommentIds();
        setLikedCommentIds(liked);

        const local = await offlineStorage.getComments(cardId);
        const fallback = cardKey && cardKey !== cardId
          ? await offlineStorage.getComments(cardKey)
          : [];
        const localMerged = mergeComments(local, fallback);
        setComments(localMerged);
        // Stop loading once local data is shown - API fetch happens in background
        setIsLoading(false);

        try {
          const { comments: remote } = await api.getComments(cardId);
          if (remote && Array.isArray(remote)) {
            const merged = mergeComments(localMerged, remote);
            setComments(merged);
          }
        } catch (e) {
          // Silently fall back to offline cache
        }
      };
      loadComments();
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
      setIsExpanded(false);
      isExpandedRef.current = false;
      setReplyingTo(null);
    }
  }, [visible, cardId]);

  const handleSave = async () => {
    if (!inputText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    const trimmed = inputText.trim();
    setInputText('');
    const parentId = replyingTo?.id;
    setReplyingTo(null);

    const next = await offlineStorage.addComment(cardId, trimmed, parentId);
    if (cardKey && cardKey !== cardId) {
      await offlineStorage.addComment(cardKey, trimmed, parentId);
    }
    setComments(next);
    if (card) {
      await recordEngagement(card, 'comment', {
        surface: surface || 'unknown',
        commentLength: trimmed.length,
      });
    }
    try {
      const { comment } = await api.addComment(cardId, trimmed);
      if (comment?.id) {
        const updatedComments = await offlineStorage.getComments(cardId);
        setComments(updatedComments);
      }
    } catch (e) {
      // Offline mode
    }
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleLike = async (commentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { comments: updated, isLiked } = await offlineStorage.toggleCommentLike(cardId, commentId);
    setComments(updated);
    setLikedCommentIds((prev) => {
      const next = new Set(prev);
      if (isLiked) {
        next.add(commentId);
      } else {
        next.delete(commentId);
      }
      return next;
    });
  };

  const handleReply = (comment: CommentItem) => {
    setReplyingTo({ id: comment.id, text: comment.text });
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleEmojiPress = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  if (!visible) return null;

  const handleBackdropPress = () => {
    Keyboard.dismiss();
    onClose();
  };

  const totalComments = countAllComments(comments);

  const renderComment = (comment: CommentItem, depth = 0) => {
    const isLiked = likedCommentIds.has(comment.id);
    const maxDepth = 2;

    return (
      <View key={comment.id} style={[styles.commentItem, depth > 0 && styles.replyItem]}>
        <View style={styles.commentAvatar}>
          <Text style={styles.commentAvatarText}>👤</Text>
        </View>
        <View style={styles.commentContent}>
          <Text style={styles.commentAuthor}>Anonymous</Text>
          <Text style={styles.commentText}>{comment.text}</Text>

          <View style={styles.commentActions}>
            <Text style={styles.commentMeta}>
              {new Date(comment.created_at).toLocaleDateString()}
            </Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleLike(comment.id)}
            >
              <Text style={styles.actionIcon}>
                {isLiked ? '❤️' : '🤍'}
              </Text>
              {comment.likes > 0 && (
                <Text style={[styles.actionCount, isLiked && styles.actionCountLiked]}>
                  {comment.likes}
                </Text>
              )}
            </TouchableOpacity>

            {depth < maxDepth && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleReply(comment)}
              >
                <Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>
            )}
          </View>

          {comment.replies && comment.replies.length > 0 && (
            <View style={styles.repliesContainer}>
              {comment.replies.map((reply) => renderComment(reply, depth + 1))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            bottom: 0,
            transform: [{ translateY: Animated.add(slideAnim, dragY) }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              {totalComments} {totalComments === 1 ? 'comment' : 'comments'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Comments list */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.commentsList}
          contentContainerStyle={styles.commentsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            scrollOffsetY.current = e.nativeEvent.contentOffset.y;
          }}
        >
          {isLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.loadingText}>Loading comments...</Text>
            </View>
          )}

          {!isLoading && comments.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyText}>No comments yet</Text>
              <Text style={styles.emptySubtext}>Be the first to comment!</Text>
            </View>
          )}

          {comments.map((comment) => renderComment(comment))}
        </ScrollView>

        {/* Input trigger for iOS - tapping this focuses the TextInput in InputAccessoryView */}
        {Platform.OS === 'ios' ? (
          <TouchableOpacity
            style={[styles.inputTrigger, { paddingBottom: insets.bottom || 8 }]}
            onPress={() => inputRef.current?.focus()}
            activeOpacity={0.7}
          >
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
            <View style={styles.triggerTextContainer}>
              <Text style={styles.triggerText}>
                {replyingTo ? 'Write a reply...' : 'Add a comment...'}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          /* Android: Regular input bar in sheet */
          <View style={[styles.inputBar, { paddingBottom: insets.bottom || 8 }]}>
            {replyingTo && (
              <View style={styles.replyIndicator}>
                <Text style={styles.replyIndicatorText} numberOfLines={1}>
                  Replying to: {replyingTo.text}
                </Text>
                <TouchableOpacity onPress={cancelReply} style={styles.cancelReply}>
                  <Text style={styles.cancelReplyText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.emojiRow}>
              {QUICK_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => handleEmojiPress(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputRow}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>👤</Text>
              </View>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
                placeholderTextColor={COLORS.textLight}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                onPress={handleSave}
                disabled={!inputText.trim()}
              >
                <Text style={styles.sendButtonText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>

      {/* iOS: Hidden TextInput that triggers the InputAccessoryView */}
      {Platform.OS === 'ios' && (
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={inputText}
          onChangeText={setInputText}
          inputAccessoryViewID={INPUT_ACCESSORY_ID}
          autoCorrect={false}
        />
      )}

      {/* iOS InputAccessoryView - renders above keyboard when TextInput is focused */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
          <View style={styles.accessoryContainer}>
            {replyingTo && (
              <View style={styles.replyIndicator}>
                <Text style={styles.replyIndicatorText} numberOfLines={1}>
                  Replying to: {replyingTo.text}
                </Text>
                <TouchableOpacity onPress={cancelReply} style={styles.cancelReply}>
                  <Text style={styles.cancelReplyText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.emojiRow}>
              {QUICK_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => handleEmojiPress(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.accessoryInputRow}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>👤</Text>
              </View>
              <View style={styles.accessoryInputContainer}>
                <Text style={styles.accessoryInputText} numberOfLines={3}>
                  {inputText || (replyingTo ? 'Write a reply...' : 'Add a comment...')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                onPress={handleSave}
                disabled={!inputText.trim()}
              >
                <Text style={styles.sendButtonText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    flexShrink: 0,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.divider,
    borderRadius: 2,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: COLORS.textMuted,
  },
  commentsList: {
    flex: 1,
  },
  commentsContent: {
    padding: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  replyItem: {
    marginLeft: 0,
    marginTop: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  commentAvatarText: {
    fontSize: 18,
  },
  commentContent: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textPrimary,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  commentMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    fontSize: 14,
  },
  actionCount: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  actionCountLiked: {
    color: COLORS.heart,
  },
  actionText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  repliesContainer: {
    marginTop: 8,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.divider,
    paddingLeft: 12,
  },
  inputBar: {
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    flexShrink: 0,
  },
  inputTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    flexShrink: 0,
  },
  triggerTextContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.divider,
    minHeight: 36,
    justifyContent: 'center',
  },
  triggerText: {
    fontSize: 15,
    color: COLORS.textLight,
  },
  accessoryContainer: {
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  hiddenInput: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
  accessoryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  accessoryInputContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.divider,
    minHeight: 36,
    justifyContent: 'center',
  },
  accessoryInputText: {
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  replyIndicatorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  cancelReply: {
    padding: 4,
  },
  cancelReplyText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  emojiButton: {
    padding: 8,
  },
  emojiText: {
    fontSize: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    color: COLORS.textPrimary,
    maxHeight: 100,
    minHeight: 36,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  sendButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
