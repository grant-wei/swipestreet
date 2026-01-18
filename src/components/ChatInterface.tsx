import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getClaudeResponse } from '../services/chat';
import { useKeyboardOffset } from '../hooks/useKeyboardOffset';

const { height: windowHeight } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  card: Card;
}

const COLORS = {
  background: '#f9fafb',
  cardBg: '#ffffff',
  textPrimary: '#111827',
  textSecondary: '#4b5563',
  textMuted: '#9ca3af',
  textLight: '#9ca3af',
  textFaint: '#d1d5db',
  accent: '#3b82f6',
  accentSubtle: 'rgba(59, 130, 246, 0.08)',
  divider: '#e5e7eb',
  userBubble: '#3b82f6',
  assistantBubble: '#FFFFFF',
};


export function ChatInterface({ visible, onClose, card }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(windowHeight)).current;
  const keyboardOffsetWeb = useKeyboardOffset();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const isWeb = Platform.OS === 'web';
  const dragY = useRef(new Animated.Value(0)).current;

  // Swipe down to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          Keyboard.dismiss();
          onClose();
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

  useEffect(() => {
    if (visible) {
      // Reset messages when opening with new card
      setMessages([{
        id: '0',
        role: 'assistant',
        content: `Ask me anything about this insight. I can help explain concepts, provide examples, or discuss how to apply this to your investing.`,
      }]);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: windowHeight,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, card.id]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!keyboardVisible) return;
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [keyboardVisible, messages.length]);

  const handleInputFocus = () => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  };

  const handleSend = async (overrideText?: string) => {
    const nextText = (overrideText ?? inputText).trim();
    if (!nextText || isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: nextText,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Build messages for Claude (exclude the initial system message)
      const chatMessages = [...messages.slice(1), userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await getClaudeResponse(chatMessages, card);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      };

      setMessages(prev => [...prev, assistantMessage]);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Chat error:', error);
      // Show error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I had trouble responding. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    'Explain this further',
    'Give me an example',
    'How do I apply this?',
  ];

  const handleSuggestion = (question: string) => {
    setInputText(question);
  };

  const handleChangeText = (text: string) => {
    if (text.includes('\n')) {
      const cleaned = text.replace(/\n/g, '').trim();
      if (cleaned.length > 0) {
        handleSend(cleaned);
      }
      setInputText('');
      return;
    }

    setInputText(text);
  };

  if (!visible) return null;

  // Safe area padding when keyboard is closed
  const composerPaddingBottom = keyboardVisible ? 0 : insets.bottom;
  const webComposerPaddingBottom = isWeb
    ? ('calc(env(safe-area-inset-bottom) + 8px)' as any)
    : composerPaddingBottom;

  const handleBackdropPress = () => {
    Keyboard.dismiss();
    onClose();
  };

  const chatContent = (
    <>
      {/* Header with swipe-to-dismiss */}
      <View style={styles.header} {...panResponder.panHandlers}>
        <View style={styles.headerHandle} />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Ask a question</Text>
          <View style={styles.headerRight}>
            {keyboardVisible && (
              <TouchableOpacity
                onPress={() => Keyboard.dismiss()}
                style={styles.keyboardDismissButton}
              >
                <Text style={styles.keyboardDismissText}>Hide</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.role === 'user' && styles.userMessageText,
              ]}
            >
              {message.content}
            </Text>
          </View>
        ))}

        {isLoading && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <ActivityIndicator size="small" color={COLORS.accent} />
          </View>
        )}
      </ScrollView>

      {/* Composer - in normal flex flow, KeyboardAvoidingView handles keyboard */}
      <View style={styles.composerArea}>
        {/* Suggestions */}
        {messages.length <= 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionsContainer}
            contentContainerStyle={styles.suggestionsContent}
          >
            {suggestedQuestions.map((question, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => handleSuggestion(question)}
              >
                <Text style={styles.suggestionText}>{question}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        <View
          style={[
            styles.inputContainer,
            {
              paddingBottom: composerPaddingBottom,
              paddingTop: keyboardVisible ? 8 : 12,
            },
            isWeb ? ({ paddingBottom: webComposerPaddingBottom } as any) : null,
          ]}
        >
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={inputText}
            onChangeText={handleChangeText}
            placeholder="Type your question..."
            placeholderTextColor={COLORS.textLight}
            multiline
            maxLength={500}
            onFocus={handleInputFocus}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            contextMenuHidden={Platform.OS === 'ios'}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const backdrop = (
    <TouchableWithoutFeedback onPress={handleBackdropPress}>
      <View style={styles.backdrop} />
    </TouchableWithoutFeedback>
  );

  // Reduce sheet height when keyboard is visible to prevent clipping
  const sheetHeight = keyboardVisible ? windowHeight * 0.5 : windowHeight * 0.65;

  const sheetContent = (
    <Animated.View
      style={[
        styles.container,
        isWeb && styles.containerWeb,
        {
          height: sheetHeight,
          transform: [
            { translateY: Animated.add(slideAnim, dragY) },
          ],
        },
      ]}
    >
      {chatContent}
    </Animated.View>
  );

  return Platform.OS === 'web' ? (
    <View style={styles.overlay}>
      {backdrop}
      <View
        style={[
          styles.sheetWrapper,
          { paddingBottom: keyboardOffsetWeb },
        ]}
      >
        {sheetContent}
      </View>
    </View>
  ) : (
    <View style={styles.overlay}>
      {backdrop}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetWrapper}
        keyboardVerticalOffset={0}
      >
        {sheetContent}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    overflow: 'hidden',
  },
  containerWeb: {
    position: 'fixed' as any,
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    flexShrink: 0,
  },
  headerHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.divider,
    borderRadius: 2,
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  keyboardDismissButton: {
    padding: 4,
  },
  keyboardDismissText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.accent,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  composerArea: {
    backgroundColor: COLORS.background,
    flexShrink: 0,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.userBubble,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.assistantBubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.textPrimary,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  suggestionsContainer: {
    maxHeight: 44,
    flexGrow: 0,
    flexShrink: 0,
  },
  suggestionsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: COLORS.accentSubtle,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  suggestionText: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.cardBg,
    gap: 10,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.divider,
    minHeight: 44,
  },
  sendButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    height: 44,
    minWidth: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textFaint,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
