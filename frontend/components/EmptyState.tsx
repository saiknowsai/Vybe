import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  emoji?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export default function EmptyState({ emoji = '🔍', title, subtitle, actionLabel, onAction, testID }: Props) {
  const { activeColors, activeRadius } = useTheme();

  return (
    <View testID={testID} style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, { color: activeColors.textMain }]}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: activeColors.textMuted }]}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity
          testID={`${testID}-action`}
          onPress={onAction}
          style={[styles.btn, { backgroundColor: activeColors.primary, borderRadius: activeRadius.full }]}
        >
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emoji: { fontSize: 56 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  btn: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 28 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
