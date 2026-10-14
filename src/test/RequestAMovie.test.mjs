// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

// After a search the results replace the list of requests, and nothing used
// to bring the list back short of reloading (report of 2026-10-14).

vi.mock('../utils/tmdb.js', () => ({
  searchMovies: vi.fn(async () => [{ id: 603, title: 'The Matrix', year: '1999' }])
}));
vi.mock('../store/db.js', () => ({
  dbGet: vi.fn(async () => ({
    105: { tmdbId: 105, title: 'Back to the Future', requestedBy: 'me@example.com', status: 'queued', createdAt: 1 }
  }))
}));
vi.mock('../utils/push.js', () => ({ deviceSubscribed: vi.fn(async () => true) }));

const { default: RequestAMovie } = await import('../components/RequestAMovie.vue');
const { REQUESTS_HOME_EVENT } = await import('../utils/requestMovie.js');
const { dbGet } = await import('../store/db.js');

const mountScreen = () => mount(RequestAMovie, {
  global: {
    mocks: {
      $store: { state: { email: 'me@example.com' }, getters: { mayApproveAccess: false } },
      $route: { query: {} }
    },
    stubs: { RequestMovieButton: true }
  }
});

const search = async (wrapper) => {
  await wrapper.find('input').setValue('matrix');
  await wrapper.find('form').trigger('submit');
  await flushPromises();
  expect(wrapper.find('.movie-results').exists()).toBe(true);
  expect(wrapper.find('.request-a-movie__mine').exists()).toBe(false);
};

const showsList = (wrapper) => {
  expect(wrapper.find('.movie-results').exists()).toBe(false);
  expect(wrapper.find('.request-a-movie__back').exists()).toBe(false);
  expect(wrapper.find('.request-a-movie__mine').text()).toContain('Back to the Future');
};

describe('RequestAMovie: getting back to the list', () => {
  beforeEach(() => dbGet.mockClear());

  it('has no back button before a search', async () => {
    const wrapper = mountScreen();
    await flushPromises();
    showsList(wrapper);
    wrapper.unmount();
  });

  it('"Back to requests" clears the search and re-reads the list', async () => {
    const wrapper = mountScreen();
    await flushPromises();
    await search(wrapper);
    const reads = dbGet.mock.calls.length;
    await wrapper.find('.request-a-movie__back').trigger('click');
    await flushPromises();
    showsList(wrapper);
    expect(wrapper.find('input').element.value).toBe('');
    expect(dbGet.mock.calls.length).toBeGreaterThan(reads);
    wrapper.unmount();
  });

  it('emptying the search box brings the list back', async () => {
    const wrapper = mountScreen();
    await flushPromises();
    await search(wrapper);
    await wrapper.find('input').setValue('');
    await flushPromises();
    showsList(wrapper);
    wrapper.unmount();
  });

  it('picking "Movie requests" from the menu while here brings the list back', async () => {
    const wrapper = mountScreen();
    await flushPromises();
    await search(wrapper);
    window.dispatchEvent(new Event(REQUESTS_HOME_EVENT));
    await flushPromises();
    showsList(wrapper);
    wrapper.unmount();
  });
});
