/**
 * Test environment for the web app.
 *
 * jest-dom's matchers make an assertion say what it means - toBeVisible rather
 * than a truthiness check on a node - which matters most in the tests that are
 * about whether a student can actually see something.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Each test gets a clean document; a leaked component from the last one is a
// confusing failure two files later.
afterEach(cleanup);
