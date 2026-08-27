import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../services/api';

/**
 * The write half of every list screen.
 *
 * Creating, updating and deleting all followed the same twelve lines - flip a
 * saving flag, await the call, toast, close the dialog and refetch, toast the
 * error, unflip the flag in a finally. That block was copied into every page
 * and each copy was a chance to forget the finally and leave a button spinning
 * forever.
 *
 *   const { saving, run } = useMutation();
 *
 *   const submit = (values) =>
 *     run(() => expenseService.create(values), {
 *       success: 'Expense added',
 *       onDone: () => { setFormOpen(false); reload(); },
 *     });
 *
 * `onDone` only runs when the call succeeded, so a failed save leaves the
 * dialog open with the student's input still in it.
 */
export default function useMutation() {
  const [saving, setSaving] = useState(false);

  const run = useCallback(async (action, { success, onDone, onError } = {}) => {
    setSaving(true);
    try {
      const result = await action();
      if (success) toast.success(success);
      if (onDone) onDone(result);
      return { ok: true, data: result };
    } catch (error) {
      // A caller can opt out of the default toast to map field errors instead.
      if (onError) onError(error);
      else toast.error(getErrorMessage(error));
      return { ok: false, error };
    } finally {
      setSaving(false);
    }
  }, []);

  return { saving, run };
}
