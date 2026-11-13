import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Button, Text } from '@/components';
import { hapticSuccess } from '@/features/preferences/haptics';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

import { SHARE_HEIGHT, SHARE_WIDTH, ShareCard, type ShareCardData } from './share-card';

/**
 * "Teilen": renders the card off screen, captures it as a PNG (1080 × 1920) and opens the
 * system share menu (Instagram, TikTok, WhatsApp, …). Nothing is uploaded by PUSH.
 */
export function ShareButton({
  data,
  variant = 'secondary',
}: {
  data: ShareCardData;
  variant?: 'primary' | 'secondary';
}) {
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const share = async () => {
    setBusy(true);
    setFailed(false);
    try {
      if (!(await Sharing.isAvailableAsync()) || !cardRef.current) {
        throw new Error('sharing_unavailable');
      }
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        width: SHARE_WIDTH,
        height: SHARE_HEIGHT,
        result: 'tmpfile',
      });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: de.share.dialogTitle });
      hapticSuccess();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View
        style={styles.offscreen}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <ShareCard ref={cardRef} data={data} />
      </View>
      {failed ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {de.share.error}
        </Text>
      ) : null}
      <Button
        label={de.share.button}
        variant={variant}
        loading={busy}
        onPress={() => void share()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  // Out of sight but still laid out, so the capture has real pixels.
  offscreen: {
    position: 'absolute',
    left: -2000,
    top: 0,
  },
});
