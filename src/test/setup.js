// Node 22+ defines a `localStorage` global of its own (undefined unless the
// process starts with --localstorage-file), and vitest's jsdom environment
// won't overwrite a global that already exists — so every test touching
// localStorage saw `undefined` (siteUserLoad.test.mjs, twelve red, found
// 2026-09-26). The same in-memory stand-in Cinema Roll uses.
class MemoryStorage {
  #map = new Map()
  get length () { return this.#map.size }
  key (i) { return [...this.#map.keys()][i] ?? null }
  getItem (k) { return this.#map.has(String(k)) ? this.#map.get(String(k)) : null }
  setItem (k, v) { this.#map.set(String(k), String(v)) }
  removeItem (k) { this.#map.delete(String(k)) }
  clear () { this.#map.clear() }
}

for (const name of ['localStorage', 'sessionStorage']) {
  if (typeof globalThis[name] === 'undefined') {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true, writable: true })
  }
}
