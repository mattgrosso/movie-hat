// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import WhereToWatch from '../components/WhereToWatch.vue';

// The streaming strip now also lives behind the "i" on every drawn poster
// (report -P1bqlYaBjWkeD9sK25i, 2026-09-15). There it must be able to say
// "nowhere" — an absent row on a panel looks like the lookup never ran.

const answer = (results) => vi.fn(async () => ({ json: async () => ({ results }) }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WhereToWatch', () => {
  it('shows the US providers as logos, linking to the JustWatch page', async () => {
    vi.stubGlobal('fetch', answer({ US: { link: 'https://www.themoviedb.org/movie/949/watch', flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg' }], rent: [] } }));
    const wrapper = mount(WhereToWatch, { props: { movie: { id: 949, title: 'Heat' } } });
    await flushPromises();

    expect(wrapper.find('a.where-to-watch-link').attributes('href')).toBe('https://www.themoviedb.org/movie/949/watch');
    expect(wrapper.find('img.provider-logo').attributes('alt')).toBe('Netflix');
    expect(wrapper.find('.where-to-watch-empty').exists()).toBe(false);
  });

  it('renders nothing at all when there are no providers, unless asked to say so', async () => {
    vi.stubGlobal('fetch', answer({}));
    const quiet = mount(WhereToWatch, { props: { movie: { id: 1 } } });
    await flushPromises();
    expect(quiet.find('.where-to-watch').exists()).toBe(false);

    const loud = mount(WhereToWatch, { props: { movie: { id: 1 }, showEmpty: true } });
    await flushPromises();
    expect(loud.find('.where-to-watch-empty').text()).toBe('Not streaming or renting anywhere right now');
  });

  it('does not claim "nowhere" while the lookup is still out, or when it failed', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const pending = mount(WhereToWatch, { props: { movie: { id: 1 }, showEmpty: true } });
    await flushPromises();
    expect(pending.find('.where-to-watch').exists()).toBe(false);

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failed = mount(WhereToWatch, { props: { movie: { id: 1 }, showEmpty: true } });
    await flushPromises();
    expect(failed.find('.where-to-watch').exists()).toBe(false);
    warn.mockRestore();
  });
});

// "Already on Plex" (report of 2026-10-14): Plex goes first when the movie is
// on the server, for the people who may request — and for nobody else.
describe('WhereToWatch, on Plex', () => {
  const storeFor = (mayRequestMovies) => ({ install (app) { app.config.globalProperties.$store = { getters: { mayRequestMovies } }; } });
  const tmdbAnswer = { US: { link: 'https://x', flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg' }] } };

  // TMDB and the database both go through fetch; tell them apart by URL.
  function stubFetch (database) {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('themoviedb')) return { json: async () => ({ results: tmdbAnswer }) };
      const path = Object.keys(database).find((key) => String(url).includes(`/${key}.json`));
      const body = path ? JSON.stringify(database[path]) : 'null';
      return { ok: true, status: 200, text: async () => body };
    }));
  }

  it('puts Plex first when the library list has the movie', async () => {
    stubFetch({ 'plexLibrary/movies/949': true });
    const wrapper = mount(WhereToWatch, { props: { movie: { id: 949 } }, global: { plugins: [storeFor(true)] } });
    await flushPromises();
    const links = wrapper.findAll('a');
    expect(links[0].classes()).toContain('on-plex');
    expect(links[1].classes()).toContain('where-to-watch-link');
  });

  it('counts a finished request while the list knows nothing of it', async () => {
    stubFetch({ 'requests/949': { status: 'added', importedAt: 1 } });
    const wrapper = mount(WhereToWatch, { props: { movie: { id: 949 } }, global: { plugins: [storeFor(true)] } });
    await flushPromises();
    expect(wrapper.find('a.on-plex').exists()).toBe(true);
  });

  it('uses the row it was handed rather than reading one', async () => {
    stubFetch({ 'requests/949': { status: 'exists' } });
    const wrapper = mount(WhereToWatch, { props: { movie: { id: 949 }, requestRow: null }, global: { plugins: [storeFor(true)] } });
    await flushPromises();
    expect(wrapper.find('a.on-plex').exists()).toBe(false);
  });

  it('says nothing about "nowhere" when Plex has it', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).includes('themoviedb')
      ? { json: async () => ({ results: {} }) }
      : { ok: true, status: 200, text: async () => (String(url).includes('plexLibrary') ? 'true' : 'null') }));
    const wrapper = mount(WhereToWatch, { props: { movie: { id: 949 }, showEmpty: true }, global: { plugins: [storeFor(true)] } });
    await flushPromises();
    expect(wrapper.find('a.on-plex').exists()).toBe(true);
    expect(wrapper.find('.where-to-watch-empty').exists()).toBe(false);
  });

  it('does not look, or show it, for someone who may not request', async () => {
    stubFetch({ 'plexLibrary/movies/949': true });
    const wrapper = mount(WhereToWatch, { props: { movie: { id: 949 } }, global: { plugins: [storeFor(false)] } });
    await flushPromises();
    expect(wrapper.find('a.on-plex').exists()).toBe(false);
    expect(fetch.mock.calls.some(([url]) => String(url).includes('plexLibrary'))).toBe(false);
  });
});
