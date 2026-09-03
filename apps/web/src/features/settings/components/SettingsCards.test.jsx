/**
 * The Settings cards, after they were pulled out of one 353-line page.
 *
 * These assert what a student can see and do - the labels, the wiring of a
 * click to a handler, the disabled states - rather than how the components are
 * put together. That is the point: the split must not have changed any of it,
 * and a test that only checked structure would pass either way.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AppearanceCard from './AppearanceCard';
import CategoriesCard from './CategoriesCard';
import SecurityCard from './SecurityCard';
import DeleteAccountModal from './DeleteAccountModal';

describe('AppearanceCard', () => {
  it('offers all three theme choices', () => {
    render(<AppearanceCard theme="system" onChange={() => {}} />);

    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
  });

  it('reports which theme was picked', async () => {
    const onChange = vi.fn();
    render(<AppearanceCard theme="system" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /dark/i }));

    expect(onChange).toHaveBeenCalledWith('dark');
  });
});

describe('CategoriesCard', () => {
  const props = {
    categories: ['Mess/Food', 'Travel', 'Gym'],
    custom: ['Gym'],
    newCategory: '',
    onNewCategoryChange: () => {},
    onAdd: () => {},
    onRemove: () => {},
  };

  it('shows the custom categories alongside the built-in ones', () => {
    render(<CategoriesCard {...props} />);

    expect(screen.getByText('Mess/Food')).toBeInTheDocument();
    expect(screen.getByText('Gym')).toBeInTheDocument();
  });

  it('says how many are available and what removal costs', () => {
    render(<CategoriesCard {...props} />);
    expect(screen.getByText(/3 categories available/i)).toBeInTheDocument();
    expect(screen.getByText(/can only be removed once no expense uses it/i)).toBeInTheDocument();
  });

  it('only a custom category can be removed', () => {
    render(<CategoriesCard {...props} />);

    // Gym is the student's own, so it gets a remove control.
    expect(screen.getByRole('button', { name: 'Remove Gym' })).toBeInTheDocument();
    // Travel is built in, so it must not.
    expect(screen.queryByRole('button', { name: 'Remove Travel' })).not.toBeInTheDocument();
  });

  it('removing names the category it is removing', async () => {
    const onRemove = vi.fn();
    render(<CategoriesCard {...props} onRemove={onRemove} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove Gym' }));

    expect(onRemove).toHaveBeenCalledWith('Gym');
  });

  it('will not add an empty category', () => {
    render(<CategoriesCard {...props} newCategory="   " />);
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled();
  });

  it('adds on Enter as well as on the button', async () => {
    const onAdd = vi.fn();
    render(<CategoriesCard {...props} newCategory="Laundry" onAdd={onAdd} />);

    await userEvent.type(screen.getByLabelText(/new category name/i), '{Enter}');

    expect(onAdd).toHaveBeenCalled();
  });

  it('reports what was typed', async () => {
    const onNewCategoryChange = vi.fn();
    render(<CategoriesCard {...props} onNewCategoryChange={onNewCategoryChange} />);

    await userEvent.type(screen.getByLabelText(/new category name/i), 'G');

    expect(onNewCategoryChange).toHaveBeenCalledWith('G');
  });
});

describe('SecurityCard', () => {
  it('warns that changing a password signs other devices out', () => {
    render(<SecurityCard onChangePassword={() => {}} onExport={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/signs you out everywhere else/i)).toBeInTheDocument();
  });

  it('says deleting is permanent before it is clicked', () => {
    render(<SecurityCard onChangePassword={() => {}} onExport={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/permanently removes your account/i)).toBeInTheDocument();
  });

  it('each action calls its own handler', async () => {
    const onChangePassword = vi.fn();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    render(<SecurityCard {...{ onChangePassword, onExport, onDelete }} />);

    await userEvent.click(screen.getByRole('button', { name: /change password/i }));
    await userEvent.click(screen.getByRole('button', { name: /download/i }));
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(onChangePassword).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });
});

describe('DeleteAccountModal', () => {
  const props = {
    open: true,
    onClose: () => {},
    password: '',
    onPasswordChange: () => {},
    onConfirm: () => {},
    busy: false,
  };

  it('cannot be confirmed without a password', () => {
    render(<DeleteAccountModal {...props} />);
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeDisabled();
  });

  it('can be confirmed once a password is typed', () => {
    render(<DeleteAccountModal {...props} password="hunter2" />);
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeEnabled();
  });

  it('suggests exporting first, because after this there is nothing to export', () => {
    render(<DeleteAccountModal {...props} />);
    expect(screen.getByText(/consider exporting your data first/i)).toBeInTheDocument();
  });

  it('offers a way out that is not destructive', async () => {
    const onClose = vi.fn();
    render(<DeleteAccountModal {...props} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: /keep my account/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('locks both buttons while the delete is in flight', () => {
    render(<DeleteAccountModal {...props} password="hunter2" busy />);
    expect(screen.getByRole('button', { name: /keep my account/i })).toBeDisabled();
  });

  it('shows nothing when closed', () => {
    render(<DeleteAccountModal {...props} open={false} />);
    expect(screen.queryByText(/delete your account/i)).not.toBeInTheDocument();
  });
});
