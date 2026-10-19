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
