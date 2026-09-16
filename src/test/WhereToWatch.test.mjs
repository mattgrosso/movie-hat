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
