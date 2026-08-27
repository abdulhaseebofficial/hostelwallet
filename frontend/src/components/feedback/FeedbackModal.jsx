import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Linkedin, Mail, Send, Star } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import useMutation from '../../hooks/useMutation';
import feedbackService from '../../services/feedbackService';
import { DEVELOPER, FEEDBACK_TYPES } from '../../utils/constants';
import { cn } from '../../utils/format';

const RATING_LABELS = ['Not good', 'Could be better', 'Fine', 'Good', 'Love it'];

/**
 * Send-feedback dialog.
 *
 * The rating is optional on purpose: someone reporting a bug should not have
 * to award stars first, and a forced rating is the fastest way to collect
 * meaningless threes.
 */
export default function FeedbackModal({ open, onClose }) {
  const location = useLocation();
  const { saving, run } = useMutation();

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [type, setType] = useState('General');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = message.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 5;

  const reset = () => {
    setRating(0);
    setHovered(0);
    setType('General');
    setMessage('');
    setTouched(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = (event) => {
    event.preventDefault();
    setTouched(true);
    if (trimmed.length < 5) return undefined;

    return run(
      () =>
        feedbackService.submit({
          type,
          rating: rating || undefined,
          message: trimmed,
          // Which screen they were on, so a bug report arrives with context.
          page: location.pathname,
        }),
      { success: 'Thank you - feedback sent', onDone: close }
    );
  };

  // Stars are radio buttons underneath, so they are reachable by keyboard and
  // announced properly rather than being five mystery buttons.
  const shown = hovered || rating;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Send feedback"
      subtitle="Bugs, ideas, or anything that annoyed you - it all helps."
      size="md"
    >
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="hw-label">How is it going? (optional)</legend>
          <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <label
                key={value}
                onMouseEnter={() => setHovered(value)}
                title={RATING_LABELS[value - 1]}
                className="cursor-pointer rounded-lg p-1 focus-within:ring-2 focus-within:ring-brand-500/60"
              >
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                  className="sr-only"
                />
                <Star
                  className={cn(
                    'h-6 w-6 transition',
                    value <= shown
                      ? 'fill-caution text-caution'
                      : 'text-slate-300 dark:text-slate-600'
                  )}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  {value} star{value === 1 ? '' : 's'} - {RATING_LABELS[value - 1]}
                </span>
              </label>
            ))}

            {rating > 0 && (
              <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {RATING_LABELS[rating - 1]}
              </span>
            )}
          </div>
        </fieldset>

        <Select
          label="What is this about?"
          options={FEEDBACK_TYPES}
          value={type}
          onChange={(event) => setType(event.target.value)}
        />

        <Textarea
          label="Your message"
          rows={5}
          autoFocus
          placeholder="e.g. The budget page should let me set limits for next month too."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onBlur={() => setTouched(true)}
          error={touched && trimmed.length < 5 ? 'Please write at least 5 characters' : undefined}
          hint={tooShort ? undefined : `${trimmed.length}/2000`}
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" icon={Send} loading={saving} disabled={trimmed.length < 5}>
            Send feedback
          </Button>
        </div>

        {/* For anything too long or too personal for a form field. */}
        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Or reach {DEVELOPER.name} directly:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={DEVELOPER.linkedin}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-200 dark:hover:text-brand-300"
            >
              <Linkedin className="h-3.5 w-3.5" aria-hidden="true" />
              LinkedIn
            </a>
            <a
              href={`mailto:${DEVELOPER.email}?subject=HostelWallet%20feedback`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-200 dark:hover:text-brand-300"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              {DEVELOPER.email}
            </a>
          </div>
        </div>
      </form>
    </Modal>
  );
}
