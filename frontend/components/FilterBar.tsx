import React from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface FilterPill {
  key: string;
  label: string;
  emoji?: string;
}

interface Props {
  items: FilterPill[];
  active: string;
  onSelect: (key: string) => void;
  testIDPrefix?: string;
}

export default function FilterBar({ items, active, onSelect, testIDPrefix = 'filter' }: Props) {
  const { activeColors, activeRadius } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {items.map(item => {
        const isActive = item.key === active;
        return (
          <TouchableOpacity
            key={item.key}
            testID={`${testIDPrefix}-${item.key}`}
            onPress={() => onSelect(item.key)}
            style={[
              styles.pill,
              {
                backgroundColor: isActive ? activeColors.primary : activeColors.surfaceHighlight,
                borderRadius: activeRadius.full,
                borderColor: isActive ? activeColors.primary : activeColors.border,
              }
            ]}
            activeOpacity={0.8}
          >
            {item.emoji && <Text style={styles.emoji}>{item.emoji} </Text>}
            <Text style={[
              styles.label,
              { color: isActive ? '#fff' : activeColors.textMuted }
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: 4,
  },
  emoji: { fontSize: 14 },
  label: { fontSize: 14, fontWeight: '600' },
});
