/**
 * What the sign-up form tells a student before they press the button.
 *
 * The rules themselves are proved in tests/unit/validation.test.js, against the
 * shared module the API also uses. What is asserted here is the part only a
 * browser has: that the form applies those rules, shows the live checklist,
 * refuses to submit while anything is wrong, and sends the tidied values.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const signUp = vi.fn();
const navigate = vi.fn();

vi.mock('../AuthContext', () => ({ useAuth: () => ({ register: signUp }) }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

import RegisterPage from './RegisterPage';

const STRONG = 'Hostel1!';

const setup = () => {
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );
  return {
    name: screen.getByLabelText(/full name/i),
    email: screen.getByLabelText(/^email$/i),
    password: screen.getByLabelText(/^password$/i),
    confirm: screen.getByLabelText(/confirm password/i),
    terms: screen.getByRole('checkbox'),
    submit: screen.getByRole('button', { name: /create account/i }),
  };
};

/** Fills everything correctly, so a test can then break exactly one thing. */
const fillValid = async (fields, overrides = {}) => {
  await userEvent.type(fields.name, overrides.name ?? 'Abdul Haseeb');
  await userEvent.type(fields.email, overrides.email ?? 'abdul@university.edu');
  await userEvent.type(fields.password, overrides.password ?? STRONG);
  await userEvent.type(fields.confirm, overrides.confirm ?? STRONG);
  if (overrides.terms !== false) await userEvent.click(fields.terms);
};

beforeEach(() => {
  signUp.mockReset();
  signUp.mockResolvedValue({});
  navigate.mockReset();
});

describe('the password checklist', () => {
  it('lists every requirement before anything is typed', () => {
    setup();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/one lowercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/one number/i)).toBeInTheDocument();
    expect(screen.getByText(/one special character/i)).toBeInTheDocument();
  });

  it('starts with nothing met', () => {
    setup();
    expect(screen.getAllByText('(not met yet)')).toHaveLength(6);
    expect(screen.queryAllByText('(met)')).toHaveLength(0);
  });

  it('ticks requirements off as they are satisfied', async () => {
    const fields = setup();

    await userEvent.type(fields.password, 'a');
    expect(screen.getAllByText('(met)').length).toBeGreaterThan(0);

    await userEvent.clear(fields.password);
    await userEvent.type(fields.password, STRONG);
    await waitFor(() => expect(screen.getAllByText('(met)')).toHaveLength(6));
  });

  it('says how many are met, for a screen reader', async () => {
    const fields = setup();
    await userEvent.type(fields.password, STRONG);
    await waitFor(() => expect(screen.getByText(/6 of 6 requirements met/i)).toBeInTheDocument());
  });

  it('marks state in words as well as colour', () => {
    setup();
    // Colour alone would leave a colour-blind student with no signal at all.
    expect(screen.getAllByText('(not met yet)').length).toBe(6);
  });
});

describe('what the form refuses', () => {
  it('keeps submit disabled until everything is valid', async () => {
    const fields = setup();
    expect(fields.submit).toBeDisabled();

    await fillValid(fields);
    await waitFor(() => expect(fields.submit).toBeEnabled());
  });

  it('rejects a name with digits, and says why', async () => {
    const fields = setup();
    await fillValid(fields, { name: 'Ali123' });

    await waitFor(() =>
      expect(
        screen.getByText('Name can only contain letters, spaces, hyphens, and apostrophes.')
      ).toBeInTheDocument()
    );
    expect(fields.submit).toBeDisabled();
  });

  it('accepts a name in another script', async () => {
    const fields = setup();
    await fillValid(fields, { name: 'محمد علی' });
    await waitFor(() => expect(fields.submit).toBeEnabled());
  });

  it('accepts hyphens and apostrophes', async () => {
    const fields = setup();
    await fillValid(fields, { name: "Anne-Marie O'Brien" });
    await waitFor(() => expect(fields.submit).toBeEnabled());
  });

  it('rejects a malformed email', async () => {
    const fields = setup();
    await fillValid(fields, { email: 'a@@b.com' });
    await waitFor(() => expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument());
    expect(fields.submit).toBeDisabled();
  });

  it('rejects a weak password with the requirement that failed', async () => {
    const fields = setup();
    await fillValid(fields, { password: 'hostel12', confirm: 'hostel12' });
    await waitFor(() => expect(fields.submit).toBeDisabled());
  });

  it('reports a confirmation that does not match', async () => {
    const fields = setup();
    await fillValid(fields, { confirm: 'Hostel2!' });
    await waitFor(() => expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument());
    expect(fields.submit).toBeDisabled();
  });

  it('will not sign anyone up who has not accepted the terms', async () => {
    const fields = setup();
    await fillValid(fields, { terms: false });

    expect(fields.submit).toBeDisabled();
    await userEvent.click(fields.submit);
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe('what the form sends', () => {
  it('submits the tidied name and email', async () => {
    const fields = setup();
    await fillValid(fields, { name: '  Abdul   Haseeb  ', email: '  Abdul@Uni.edu  ' });

    await waitFor(() => expect(fields.submit).toBeEnabled());
    await userEvent.click(fields.submit);

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    const payload = signUp.mock.calls[0][0];
    expect(payload.name).toBe('Abdul Haseeb');
    expect(payload.email).toBe('Abdul@Uni.edu');
    expect(payload.acceptTerms).toBe(true);
  });

  it('sends the password exactly as typed, never trimmed', async () => {
    const fields = setup();
    await fillValid(fields, { password: 'Hostel my 1!', confirm: 'Hostel my 1!' });

    await waitFor(() => expect(fields.submit).toBeEnabled());
    await userEvent.click(fields.submit);

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(signUp.mock.calls[0][0].password).toBe('Hostel my 1!');
  });
});

describe('the password fields themselves', () => {
  it('hide what is typed until asked', () => {
    const fields = setup();
    expect(fields.password).toHaveAttribute('type', 'password');
  });

  it('can be revealed, one field at a time', async () => {
    const fields = setup();
    const toggles = screen.getAllByRole('button', { name: /show password/i });

    await userEvent.click(toggles[0]);
    expect(fields.password).toHaveAttribute('type', 'text');
    // Revealing the password must not reveal the confirmation as well.
    expect(fields.confirm).toHaveAttribute('type', 'password');
  });

  it('tell the browser these are new passwords, not the saved one', () => {
    const fields = setup();
    expect(fields.password).toHaveAttribute('autocomplete', 'new-password');
    expect(fields.confirm).toHaveAttribute('autocomplete', 'new-password');
    expect(fields.email).toHaveAttribute('autocomplete', 'email');
    expect(fields.name).toHaveAttribute('autocomplete', 'name');
  });
});
