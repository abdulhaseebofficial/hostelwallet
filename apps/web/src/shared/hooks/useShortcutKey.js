import { useEffect } from 'react';

/**
 * Runs `handler` when a single letter key is pressed, and only when pressing it
 * could not have meant something else.
 *
 * A one-letter shortcut is the easiest kind to get wrong, because every guard
 * below is a real way it can steal a keystroke:
 *
 *   typing        the letter belongs in the field the student is filling in,
 *                 not to a dialog. Inputs, textareas, selects and anything
 *                 contentEditable all count.
 *   modifiers     Ctrl/Alt/Meta+N belong to the browser or the OS, and Shift+N
 *                 is a capital N somebody is typing.
 *   a dialog      if one is already open the key is aimed at that.
 *   held down     auto-repeat should open one thing, not forty.
 *   defaultPrevented  something nearer the event already handled it.
 *   enabled       the action is not available, so nothing should happen.
 *
 * The listener is added once per change of key, handler or enabled flag, and
 * removed on cleanup - so a re-render cannot leave a second one behind.
 */
export default function useShortcutKey(key, handler, { enabled = true } = {}) {
  useEffect(() => {
    if (!enabled || typeof handler !== 'function') return undefined;

    const onKeyDown = (event) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.repeat || event.defaultPrevented) return;

      const el = document.activeElement;
      const tag = el ? el.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // isContentEditable alone is not enough: it is the property browsers
      // provide and jsdom does not, and it only describes the focused node.
      // closest() also catches a caret sitting inside a nested element of an
      // editable region, which is where it usually is.
      if (el && (el.isContentEditable || el.closest('[contenteditable="true"], [contenteditable=""]'))) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;

      event.preventDefault();
      handler(event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key, handler, enabled]);
}
