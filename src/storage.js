/* storage.js — installs window.storage so App.jsx works unchanged.
 *
 * Uses @capacitor/preferences, which is the same API in both places:
 *   - in a browser  -> its web implementation, backed by localStorage
 *   - in the app    -> native device storage
 *
 * One code path, no platform detection, nothing to break. Import this at the
 * top of main.jsx BEFORE App. Nothing in App.jsx changes.
 */

import { Preferences } from "@capacitor/preferences";

const storage = {
  get: async (key) => {
    const { value } = await Preferences.get({ key });
    if (value === null || value === undefined) throw new Error(`no such key: ${key}`);
    return { key, value, shared: false };
  },
  set: async (key, value) => {
    await Preferences.set({ key, value: String(value) });
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

if (typeof window !== "undefined" && !window.storage) window.storage = storage;

export default storage;
