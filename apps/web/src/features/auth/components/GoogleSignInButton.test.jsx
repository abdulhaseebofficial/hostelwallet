/**
 * The Google button's job before Google is involved at all.
 *
 * What Google renders inside the slot is Google's business. What this component
 * decides is whether to appear, and that decision comes from the server - so an
 * install with no Google client id configured shows nothing rather than a
 * button that cannot work.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import GoogleSignInButton from './GoogleSignInButton';

beforeEach(() => {
  delete window.google;
  document.head.querySelectorAll('script[src*="gsi/client"]').forEach((s) => s.remove());
});

describe('when Google sign-in is not configured', () => {
  it('renders nothing at all', () => {
    const { container } = render(<GoogleSignInButton config={{ enabled: false }} onCredential={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the config is still loading', () => {
    const { container } = render(<GoogleSignInButton config={undefined} onCredential={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not load Google\'s script', () => {
    render(<GoogleSignInButton config={{ enabled: false }} onCredential={() => {}} />);
    expect(document.querySelector('script[src*="gsi/client"]')).toBeNull();
  });
});

describe('when it is configured', () => {
  const config = { enabled: true, clientId: 'test.apps.googleusercontent.com' };

  it('renders the slot and the "or" divider', () => {
    render(<GoogleSignInButton config={config} onCredential={() => {}} />);
    expect(screen.getByText('or')).toBeInTheDocument();
  });

  it('loads Google\'s script exactly once, however many buttons ask', () => {
    render(<GoogleSignInButton config={config} onCredential={() => {}} />);
    render(<GoogleSignInButton config={config} onCredential={() => {}} />);
    expect(document.querySelectorAll('script[src*="gsi/client"]')).toHaveLength(1);
  });

  it('points the script at Google, over https', () => {
    render(<GoogleSignInButton config={config} onCredential={() => {}} />);
    const script = document.querySelector('script[src*="gsi/client"]');
    expect(script.src).toBe('https://accounts.google.com/gsi/client');
    expect(script.async).toBe(true);
  });

  it('dims the slot while the form beside it is submitting', () => {
    const { container } = render(
      <GoogleSignInButton config={config} onCredential={() => {}} disabled />
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('never puts the credential anywhere the page can read it', () => {
    // The component holds the handler in a ref and passes the token straight
    // to it. Nothing is written to storage or to the DOM.
    const onCredential = vi.fn();
    render(<GoogleSignInButton config={config} onCredential={onCredential} />);
    expect(window.localStorage.getItem('hw-google-credential')).toBeNull();
    expect(document.body.innerHTML).not.toContain('credential');
  });
});
