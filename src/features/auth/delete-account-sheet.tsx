import { Button, Sheet, Text } from '@/components';
import { useDeleteAccount } from '@/features/auth/api';
import { healthSourceName } from '@/features/health/platform';
import { de } from '@/i18n/de';
import { toUserMessage } from '@/lib/errors';

export function DeleteAccountSheet({
  userId,
  visible,
  onClose,
}: {
  userId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const deleteAccount = useDeleteAccount(userId);
  const close = () => {
    if (!deleteAccount.isPending) {
      deleteAccount.reset();
      onClose();
    }
  };

  return (
    <Sheet
      visible={visible}
      title={de.deleteAccount.title}
      onClose={close}
      closeLabel={de.deleteAccount.cancel}
    >
      <Text color="danger">{de.deleteAccount.intro}</Text>
      {de.deleteAccount.points.map((point) => (
        <Text key={point} variant="caption" color="textSecondary">
          {`• ${point}`}
        </Text>
      ))}
      <Text variant="caption" color="textSecondary">
        {de.deleteAccount.healthHint(healthSourceName)}
      </Text>
      <Text variant="caption" color="textMuted">
        {de.common.virtualCreditsNotice}
      </Text>
      {deleteAccount.isError ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {toUserMessage(deleteAccount.error) === de.common.networkError
            ? de.deleteAccount.networkError
            : toUserMessage(deleteAccount.error)}
        </Text>
      ) : null}
      <Button
        label={de.deleteAccount.confirm}
        variant="danger"
        loading={deleteAccount.isPending}
        onPress={() => deleteAccount.mutate()}
      />
      <Button
        label={de.deleteAccount.cancel}
        variant="secondary"
        disabled={deleteAccount.isPending}
        onPress={close}
      />
    </Sheet>
  );
}
