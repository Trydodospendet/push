import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet } from 'react-native';

import { Button, Card, Screen, SwitchRow, Text } from '@/components';
import { useExportData } from '@/features/account/api';
import { useSession } from '@/features/auth/auth-provider';
import { DeleteAccountSheet } from '@/features/auth/delete-account-sheet';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/** Download of the own data, legal pages and account deletion. */
export default function DataSettingsScreen() {
  const session = useSession();
  const exportData = useExportData();
  const [includeRoutes, setIncludeRoutes] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const download = () =>
    exportData.mutate(includeRoutes, {
      onSuccess: (json) => {
        void Share.share({ title: 'PUSH – meine Daten', message: json });
      },
    });

  return (
    <Screen scroll edges={SCREEN_EDGES} contentStyle={styles.content}>
      <Card style={styles.card}>
        <Text variant="label" color="textSecondary">
          {de.dataSettings.exportLabel}
        </Text>
        <Text color="textSecondary">{de.dataSettings.exportText}</Text>
        <SwitchRow
          label={de.dataSettings.includeRoutes}
          hint={de.dataSettings.includeRoutesHint}
          value={includeRoutes}
          onChange={setIncludeRoutes}
        />
        {exportData.isError ? (
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {de.dataSettings.exportError}
          </Text>
        ) : null}
        <Button
          label={de.dataSettings.exportButton}
          variant="secondary"
          loading={exportData.isPending}
          onPress={download}
        />
      </Card>
      <Card style={styles.card}>
        <Text variant="label" color="textSecondary">
          {de.dataSettings.legalLabel}
        </Text>
        <Button
          label={de.profile.privacy}
          variant="secondary"
          onPress={() => router.push('/legal/privacy')}
        />
        <Button
          label={de.profile.imprint}
          variant="secondary"
          onPress={() => router.push('/legal/imprint')}
        />
      </Card>
      <Card style={styles.card}>
        <Text variant="label" color="danger">
          {de.dataSettings.dangerLabel}
        </Text>
        <Button
          label={de.profile.deleteAccount}
          variant="danger"
          onPress={() => setDeleteOpen(true)}
        />
      </Card>
      <DeleteAccountSheet
        userId={session.user.id}
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  card: { gap: spacing.md },
});
