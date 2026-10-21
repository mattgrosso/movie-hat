import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { fetchWithRetry } = require('../../aws-lambda/dbRetry.js');

// Answers in order; an Error in the list is a dropped connection.
const scripted = (...answers) => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return { status: next, ok: next < 400 };
  };
  return { fetchFn, calls };
};

describe('fetchWithRetry', () => {
  it('returns a good answer without a second call', async () => {
    const { fetchFn, calls } = scripted(200);
    const res = await fetchWithRetry('u', {}, { fetchFn, delays: [0, 0, 0] });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it('tries again after a 500', async () => {
    const { fetchFn, calls } = scripted(500, 200);
    const res = await fetchWithRetry('u', {}, { fetchFn, delays: [0, 0, 0] });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it('tries again after a dropped connection', async () => {
    const { fetchFn, calls } = scripted(new Error('ECONNRESET'), 200);
    const res = await fetchWithRetry('u', {}, { fetchFn, delays: [0, 0, 0] });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it('keeps trying through two 500s in a row (MOVIE-HAT-S)', async () => {
    const { fetchFn, calls } = scripted(500, 500, 200);
    const res = await fetchWithRetry('u', {}, { fetchFn, delays: [0, 0, 0] });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(3);
  });

  it('hands back the fourth 5xx so a real outage still fails', async () => {
    const { fetchFn, calls } = scripted(500, 500, 500, 503, 200);
    const res = await fetchWithRetry('u', {}, { fetchFn, delays: [0, 0, 0] });
    expect(res.status).toBe(503);
    expect(calls).toHaveLength(4);
  });

  it('throws if the connection drops every time', async () => {
    const { fetchFn } = scripted(new Error('ECONNRESET'), new Error('ECONNRESET'), new Error('ECONNRESET'), new Error('ETIMEDOUT'));
    await expect(fetchWithRetry('u', {}, { fetchFn, delays: [0, 0, 0] })).rejects.toThrow('ETIMEDOUT');
  });

  it('does not retry a 4xx', async () => {
    const { fetchFn, calls } = scripted(401, 200);
    const res = await fetchWithRetry('u', {}, { fetchFn, delays: [0, 0, 0] });
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(1);
  });
});
