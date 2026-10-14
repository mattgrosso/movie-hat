// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';

// The "ready to watch" card goes once it has been dealt with, and does not
// come back when the app reopens on the same address (report of 2026-10-14).

vi.mock('../utils/tmdb.js', () => ({
  searchMovies: vi.fn(async () => [{ id: 603, title: 'The Matrix', year: '1999' }])
}));
vi.mock('../store/db.js', () => ({
  dbGet: vi.fn(async () => ({
    105: { tmdbId: 105, title: 'Back to the Future', requestedBy: 'me@example.com', status: 'added', importedAt: 2, createdAt: 1 }
  }))
}));
vi.mock('../utils/push.js', () => ({ deviceSubscribed: vi.fn(async () => true) }));

const { default: RequestAMovie } = await import('../components/RequestAMovie.vue');
const { REQUESTS_HOME_EVENT } = await import('../utils/requestMovie.js');

let route;
const mountScreen = () => {
  const $router = { replace: vi.fn(({ query }) => { route.query = query; }) };
  const wrapper = mount(RequestAMovie, {
    global: {
      mocks: {
        $store: { state: { email: 'me@example.com' }, getters: { mayApproveAccess: false } },
        $route: route,
        $router
      },
      stubs: { RequestMovieButton: true }
    }
  });
  return { wrapper, $router };
};
const card = (wrapper) => wrapper.find('.request-a-movie__ready');

describe('RequestAMovie: the ready card clears itself', () => {
  beforeEach(() => {
    localStorage.clear();
    route = reactive({ query: { ready: '105' } });
  });

  it('✕ closes it, drops the link, and reopening does not bring it back', async () => {
    const { wrapper, $router } = mountScreen();
    await flushPromises();
    expect(card(wrapper).text()).toContain('Back to the Future is ready to watch');
    await wrapper.find('.request-a-movie__ready-close').trigger('click');
    expect(card(wrapper).exists()).toBe(false);
    expect($router.replace).toHaveBeenCalledWith({ query: {} });
    wrapper.unmount();

    route.query = { ready: '105' };
    const again = mountScreen().wrapper;
    await flushPromises();
    expect(card(again).exists()).toBe(false);
    again.unmount();
  });

  it('goes after Watch in Plex is tapped', async () => {
    vi.useFakeTimers();
    const { wrapper } = mountScreen();
    await flushPromises();
    await wrapper.find('.request-a-movie__plex').trigger('click');
    vi.runAllTimers();
    vi.useRealTimers();
    await flushPromises();
    expect(card(wrapper).exists()).toBe(false);
    wrapper.unmount();
  });

  it('goes on a search, and on the menu', async () => {
    const first = mountScreen().wrapper;
    await flushPromises();
    await first.find('input').setValue('matrix');
    await first.find('form').trigger('submit');
    await flushPromises();
    expect(card(first).exists()).toBe(false);
    first.unmount();

    localStorage.clear();
    route.query = { ready: '105' };
    const second = mountScreen().wrapper;
    await flushPromises();
    expect(card(second).exists()).toBe(true);
    window.dispatchEvent(new Event(REQUESTS_HOME_EVENT));
    await flushPromises();
    expect(card(second).exists()).toBe(false);
    second.unmount();
  });

  it('is gone when the app is reopened an hour later, untouched', async () => {
    const { wrapper } = mountScreen();
    await flushPromises();
    expect(card(wrapper).exists()).toBe(true);
    wrapper.unmount();

    const later = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61 * 60 * 1000);
    const reopened = mountScreen().wrapper;
    await flushPromises();
    expect(card(reopened).exists()).toBe(false);
    later.mockRestore();
    reopened.unmount();
  });
});
