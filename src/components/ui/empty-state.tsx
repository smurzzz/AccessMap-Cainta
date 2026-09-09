import { StyleSheet, Text, View } from 'react-native';

import { DesignColors as C } from '@/constants/design-tokens';

interface EmptyStateProps {
  title?: string;
  message: string;
}

export default function EmptyState({ title = 'No results found', message }: EmptyStateProps) {
  return (
    <View style={styles.container} accessibilityLabel={message}>
      <Text style={styles.icon}>◌</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  icon: {
    color: C.softGray,
    fontSize: 38,
    fontWeight: '700',
    marginBottom: 4,
  },
  title: {
    color: C.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: C.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});