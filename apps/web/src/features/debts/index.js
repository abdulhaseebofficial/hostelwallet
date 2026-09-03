/**
 * What udhaar offers the rest of the app.
 *
 * Only the dashboard widget. Everything else - the list, the form, the ledger -
 * is internal to this feature: other features import from this file, never from
 * a path inside it.
 */

export { default as DebtWidget } from './components/DebtWidget';
