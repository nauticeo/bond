/* storage.js — installs window.storage so App.jsx works unchanged.
 *
 * App.jsx was written against a window.storage API that doesn't exist on the
 * open web. This provides it, backed by localStorage in a browser and by
 * Capacitor Preferences once you're running natively.
 *
 * Import at the top of main.jsx, BEFORE App. Nothing in App.jsx changes.
 *
 * Deliberately avoids top-level await — it would force a newer build target
 * and silently break older Safari, which is a large slice of your users.
 */

const web = {
  get: async (key) => {
    const value = localStorage.getItem(key);
    if (value === null) throw new Error(`no such key: ${key}`);
    return { key, value, shared: false };
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
    return { key, value, shared: false };
  },
  delete: async (key) => {
    localStorage.removeItem(key);
    return { key, deleted: true, shared: false };
  },
  list: async (prefix = "") => ({
    keys: Object.keys(localStorage).filter((k) => k.startsWith(prefix)),
    prefix, shared: false,
  }),
};

let impl = web;

// Stable facade — delegates to whatever `impl` currently is.
const facade = {
  get:    (k)         => impl.get(k),
  set:    (k, v)      => impl.set(k, v),
  delete: (k)         => impl.delete(k),
  list:   (p)         => impl.list(p),
};

if (typeof window !== "undefined" && !window.storage) window.storage = facade;

// Upgrade to native storage if we're inside the Capacitor app. Runs after the
// first paint; the web implementation serves any calls that land before it.
(async () => {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor?.isNativePlatform?.()) return;
    const { Preferences } = await import("@capacitor/preferences");
    impl = {
      get: async (key) => {
        const { value } = await Preferences.get({ key });
        if (value === null) throw new Error(`no such key: ${key}`);
        return { key, value, shared: false };
      },
      set: async (key, value) => {
        await Preferences.set({ key, value });
        return { key, value, shared: false };
      },
      delete: async (key) => {
        await Preferences.remove({ key });
        return { key, deleted: true, shared: false };
      },
      list: async (prefix = "") => {
        const { keys } = await Preferences.keys();
        return { keys: keys.filter((k) => k.startsWith(prefix)), prefix, shared: false };
      },
    };
  } catch {
    /* not a native build — localStorage is correct here */
  }
})();

export default facade;
