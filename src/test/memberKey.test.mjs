// The email→key transform is the foundation the database rules stand on:
// the rules apply the SAME transform (generated from the same character
// list) to auth.token.email, so any drift here is a lockout or a hole.
import { describe, it, expect } from 'vitest';
import { emailToMemberKey, membersOf, memberIndexFor, UNSAFE_KEY_CHARACTERS } from '@/store/memberKey.mjs';

describe('emailToMemberKey', () => {
  it('replaces every character Firebase forbids in a key', () => {
    expect(emailToMemberKey('a.b$c#d[e]f/g@example.com')).toBe('a-b-c-d-e-f-g@example-com');
  });

  it('replaces repeated occurrences, not just the first', () => {
    expect(emailToMemberKey('first.middle.last@example.co.uk')).toBe('first-middle-last@example-co-uk');
  });

  it('keeps @ so keys stay readable in the console', () => {
    expect(UNSAFE_KEY_CHARACTERS).not.toContain('@');
    expect(emailToMemberKey('someone@example.com')).toContain('@');
  });

  it('lowercases and trims, so an invite as Matt@ matches a token as matt@', () => {
    expect(emailToMemberKey('  Someone@Example.COM ')).toBe('someone@example-com');
  });

  it('returns null for anything that is not a non-empty string', () => {
    expect(emailToMemberKey(null)).toBeNull();
    expect(emailToMemberKey(undefined)).toBeNull();
    expect(emailToMemberKey('')).toBeNull();
    expect(emailToMemberKey(42)).toBeNull();
  });
});

describe('membersOf', () => {
  it('reads the members list whether it is an array or a push-key map', () => {
    expect(membersOf({ members: ['a@x.com', 'b@x.com'] })).toEqual(['a@x.com', 'b@x.com']);
    expect(membersOf({ members: { k1: 'a@x.com', k2: 'b@x.com' } })).toEqual(['a@x.com', 'b@x.com']);
  });

  it('falls back to the memberEmails index when the list is empty', () => {
    expect(membersOf({ memberEmails: { 'a@x-com': true } })).toEqual(['a@x-com']);
  });

  it('ignores non-string junk in the members map', () => {
    expect(membersOf({ members: { k1: 'a@x.com', k2: 17 } })).toEqual(['a@x.com']);
  });

  it('returns [] for a hat with nobody at all', () => {
    expect(membersOf({})).toEqual([]);
    expect(membersOf(null)).toEqual([]);
  });
});

describe('memberIndexFor', () => {
  it('builds the index the rules read, keyed by transformed email', () => {
    const hat = { members: ['A.B@x.com', 'c@y.org'] };
    expect(memberIndexFor(hat)).toEqual({ 'a-b@x-com': true, 'c@y-org': true });
  });

  it('produces an empty index for an empty hat rather than throwing', () => {
    expect(memberIndexFor({})).toEqual({});
  });
});
