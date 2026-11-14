import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Text } from '@/components';
import { de } from '@/i18n/de';
import { colors, spacing } from '@/theme';

const clips = [
  {
    title: de.guide.videos.oneMoreLap,
    assetId: require('../../../assets/guide-videos/eine-runde-noch.mp4') as number,
  },
  {
    title: de.guide.videos.stepGoal,
    assetId: require('../../../assets/guide-videos/dein-schrittziel.mp4') as number,
  },
] as const;

export function GuideVideos() {
  const [selected, setSelected] = useState<(typeof clips)[number] | null>(null);

  return (
    <Card style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {de.guide.videos.title}
      </Text>
      {clips.map((clip) => (
        <Button
          key={clip.title}
          label={clip.title}
          variant={selected === clip ? 'primary' : 'secondary'}
          onPress={() => setSelected(clip)}
        />
      ))}
      {selected ? (
        <>
          <GuideVideo key={selected.title} clip={selected} />
          <Button
            label={de.guide.videos.close}
            variant="secondary"
            onPress={() => setSelected(null)}
          />
        </>
      ) : null}
    </Card>
  );
}

function GuideVideo({ clip }: { clip: (typeof clips)[number] }) {
  const player = useVideoPlayer(clip.assetId);
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  if (status === 'error') {
    return <Text color="textSecondary">{de.guide.videos.error}</Text>;
  }

  return (
    <VideoView
      player={player}
      style={styles.video}
      accessibilityLabel={clip.title}
      nativeControls
      fullscreenOptions={{ enable: true }}
    />
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  video: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 280,
    aspectRatio: 9 / 16,
    backgroundColor: colors.bg,
  },
});
