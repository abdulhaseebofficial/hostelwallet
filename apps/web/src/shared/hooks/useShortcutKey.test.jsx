/**
 * The N shortcut's guards.
 *
 * Each of these is a way a one-letter shortcut can take a keystroke that was
 * meant for something else. They are worth testing individually because the
 * failure is invisible in review - the shortcut works, and separately somebody
 * loses a letter out of a note they were typing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import useShortcutKey from './useShortcutKey';

const handler = vi.fn();

function Harness({ enabled = true, withField = false, withDialog = false }) {
  useShortcutKey('n', handler, { enabled });
  return (
    <div>
      <button type="button">somewhere to focus</button>
      {withField && (
        <>
          <input aria-label="text field" />
          <textarea aria-label="notes" />
          <select aria-label="pick one">
            <option>a</option>
          </select>
          <div contentEditable aria-label="rich text" suppressContentEditableWarning />
        </>
      )}
      {withDialog && <div role="dialog">a dialog is already open</div>}
    </div>
  );
}

beforeEach(() => handler.mockReset());
afterEach(() => {
  document.body.style.overflow = '';
});

describe('when it should fire', () => {
  it('fires on a bare n', async () => {
    render(<Harness />);
    await userEvent.keyboard('n');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires on N typed with caps lock, which carries no shift', async () => {
    render(<Harness />);
    await userEvent.keyboard('{CapsLock}n{CapsLock}');
    expect(handler).toHaveBeenCalled();
  });

  it('ignores every other key', async () => {
    render(<Harness />);
    await userEvent.keyboard('abcdefghijklmopqrstuvwxyz');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('when it must not fire', () => {
  it('does not fire while typing in an input', async () => {
    render(<Harness withField />);
    await userEvent.click(screen.getByLabelText('text field'));
    await userEvent.keyboard('n');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire while typing in a textarea', async () => {
    render(<Harness withField />);
    await userEvent.click(screen.getByLabelText('notes'));
    await userEvent.keyboard('n');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire while a select is focused', async () => {
    render(<Harness withField />);
    screen.getByLabelText('pick one').focus();
    await userEvent.keyboard('n');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire inside a contenteditable', async () => {
    render(<Harness withField />);
    screen.getByLabelText('rich text').focus();
    await userEvent.keyboard('n');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire while a dialog is open', async () => {
    render(<Harness withDialog />);
    await userEvent.keyboard('n');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire with Shift, which is somebody typing a capital N', async () => {
    render(<Harness />);
    await userEvent.keyboard('{Shift>}n{/Shift}');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire with Ctrl, Alt or Meta', async () => {
    render(<Harness />);
    await userEvent.keyboard('{Control>}n{/Control}');
    await userEvent.keyboard('{Alt>}n{/Alt}');
    await userEvent.keyboard('{Meta>}n{/Meta}');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire when the action is unavailable', async () => {
    render(<Harness enabled={false} />);
    await userEvent.keyboard('n');
    expect(handler).not.toHaveBeenCalled();
  });

  it('opens one thing when the key is held down', () => {
    render(<Harness />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    for (let i = 0; i < 5; i += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', repeat: true, bubbles: true }));
    }
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('the listener itself', () => {
  it('is removed when the component goes away', async () => {
    const { unmount } = render(<Harness />);
    unmount();
    await userEvent.keyboard('n');
    expect(handler).not.toHaveBeenCalled();
  });

  it('is registered once, not once per render', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');

    const { rerender } = render(<Harness />);
    rerender(<Harness />);
    rerender(<Harness />);

    const added = add.mock.calls.filter(([type]) => type === 'keydown').length;
    const removed = remove.mock.calls.filter(([type]) => type === 'keydown').length;

    // The handler identity is stable across renders, so the effect does not
    // re-run: one listener, and it is still attached.
    expect(added - removed).toBe(1);

    add.mockRestore();
    remove.mockRestore();
  });

  it('fires only once no matter how many times the shell re-renders', async () => {
    const { rerender } = render(<Harness />);
    rerender(<Harness />);
    rerender(<Harness />);

    await userEvent.keyboard('n');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
