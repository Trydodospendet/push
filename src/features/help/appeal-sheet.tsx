import { useState } from 'react';
import { Button, Sheet, Text, TextField } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { hapticSuccess } from '@/features/preferences/haptics';
import { de } from '@/i18n/de';
import { toUserMessage } from '@/lib/errors';

import { useSubmitAppeal, type AppealTarget } from './api';

export const APPEAL_MIN_LENGTH = 10;
export const APPEAL_MAX_LENGTH = 500;

/** Sheet to object to a run that does not count: the user says why, a person reviews it. */
export function AppealSheet({
  target,
  visible,
  onClose,
}: {
  target: AppealTarget;
  visible: boolean;
  onClose: () => void;
}) {
  const userId = useSession().user.id;
  const submit = useSubmitAppeal(userId);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const close = () => {
    submit.reset();
    setError(null);
    setSent(false);
    setMessage('');
    onClose();
  };

  const send = () => {
    if (message.trim().length < APPEAL_MIN_LENGTH) {
      setError(de.appeals.tooShort(APPEAL_MIN_LENGTH));
      return;
    }
    setError(null);
    submit.mutate(
      { target, message: message.trim() },
      {
        onSuccess: () => {
          setSent(true);
          hapticSuccess();
        },
        onError: (mutationError) => setError(toUserMessage(mutationError)),
      },
    );
  };

  return (
    <Sheet visible={visible} title={de.appeals.title} onClose={close} closeLabel={de.appeals.close}>
      {sent ? (
        <Text accessibilityLiveRegion="polite">{de.appeals.sent}</Text>
      ) : (
        <>
          <Text color="textSecondary">{de.appeals.intro}</Text>
          <TextField
            label={de.appeals.messageLabel}
            hint={de.appeals.messageHint(APPEAL_MIN_LENGTH, APPEAL_MAX_LENGTH)}
            value={message}
            onChangeText={setMessage}
            error={error}
            multiline
            numberOfLines={4}
            maxLength={APPEAL_MAX_LENGTH}
          />
          <Button label={de.appeals.send} loading={submit.isPending} onPress={send} />
        </>
      )}
      <Button
        label={sent ? de.appeals.done : de.appeals.close}
        variant="secondary"
        onPress={close}
      />
    </Sheet>
  );
}
