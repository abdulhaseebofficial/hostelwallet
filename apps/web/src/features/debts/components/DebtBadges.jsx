import { KIND_LABEL, KIND_STYLE, STATUS_LABEL, STATUS_STYLE, displayStatus } from '../utils/debtDisplay';
import { cn } from '../../../shared/utils/format';

/** Whether the student owes this person or the other way round. */
export function KindBadge({ kind }) {
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', KIND_STYLE[kind])}>
      {KIND_LABEL[kind]}
    </span>
  );
}

/** Pending, part paid, settled or overdue - always with the word, not just a colour. */
export function StatusBadge({ debt }) {
  const status = displayStatus(debt);
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}
