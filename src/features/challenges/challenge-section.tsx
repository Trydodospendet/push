import { StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, LoadingState, Text, type EmptyStateProps } from '@/components';
import { spacing } from '@/theme';

import { ChallengeCard } from './challenge-card';
import type { Challenge } from './types';

export type ChallengeSectionItem = { challenge: Challenge; joined: boolean; created: boolean };

export type ChallengeSectionProps = {
  label: string;
  /** Illustration and hint shown instead of an empty list. */
  empty: Omit<EmptyStateProps, 'compact'>;
  errorText: string;
  /** undefined while loading or after an error. */
  items: ChallengeSectionItem[] | undefined;
  loading: boolean;
  error: boolean;
  retrying: boolean;
  onRetry: () => void;
};

/** A titled list of challenge cards with loading, error and empty state. */
export function ChallengeSection({
  label,
  empty,
  errorText,
  items,
  loading,
  error,
  retrying,
  onRetry,
}: ChallengeSectionProps) {
  return (
    <View style={styles.section}>
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {label}
      </Text>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={errorText} onRetry={onRetry} retrying={retrying} />
      ) : items && items.length > 0 ? (
        items.map(({ challenge, joined, created }) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            joined={joined}
            created={created}
          />
        ))
      ) : (
        <EmptyState compact {...empty} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
});
