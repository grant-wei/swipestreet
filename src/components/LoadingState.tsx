import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

const COLORS = {
  background: '#f9fafb',
  textMuted: '#9ca3af',
  accent: '#3b82f6',
};

interface Props {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.accent} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  message: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 16,
  },
});
