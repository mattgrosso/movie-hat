import { describe, it, expect, vi } from 'vitest';
import { swRegistrationErrorHooks } from '@/utils/swRegistrationError.js';

describe('swRegistrationErrorHooks', () => {
  const logger = () => ({ warn: vi.fn(), error: vi.fn() });

  it('only notes the error when the registration came back empty (a blocked worker)', () => {
    const log = logger();
    const hooks = swRegistrationErrorHooks(log);
    hooks.registered(undefined);
    hooks.error(new TypeError("Cannot read properties of undefined (reading 'waiting')"));
    expect(log.error).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('reports a real registration failure as an error', () => {
    const log = logger();
    const hooks = swRegistrationErrorHooks(log);
    hooks.error(new Error('Failed to register a ServiceWorker'));
    expect(log.error).toHaveBeenCalledOnce();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('reports a failure after a real registration as an error', () => {
    const log = logger();
    const hooks = swRegistrationErrorHooks(log);
    hooks.registered({ waiting: null });
    hooks.error(new Error('boom'));
    expect(log.error).toHaveBeenCalledOnce();
  });
});

describe('a worker script that never arrived', () => {
  const logger = () => ({ warn: vi.fn(), error: vi.fn() });

  it.each([
    'Script https://movie-hat.com/service-worker.js load failed',
    "Failed to register a ServiceWorker for scope ('https://movie-hat.com/') with script ('https://movie-hat.com/service-worker.js'): An unknown error occurred when fetching the script.",
  ])('is only a note: %s', (message) => {
    const log = logger();
    const hooks = swRegistrationErrorHooks(log);
    hooks.error(new TypeError(message));
    expect(log.error).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('still reports a worker the server answered 404 for', () => {
    const log = logger();
    const hooks = swRegistrationErrorHooks(log);
    hooks.error(new TypeError("Failed to register a ServiceWorker for scope ('https://movie-hat.com/') with script ('https://movie-hat.com/service-worker.js'): A bad HTTP response code (404) was received when fetching the script."));
    hooks.error(new TypeError('Failed to register/update a ServiceWorker for scope https://movie-hat.com/: Load failed with status 404 for script https://movie-hat.com/service-worker.js.'));
    expect(log.error).toHaveBeenCalledTimes(2);
    expect(log.warn).not.toHaveBeenCalled();
  });
});
