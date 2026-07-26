# Bond — run and ship it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/
```

That's the whole web app. `src/App.jsx` is the component as delivered, unchanged.
`src/storage.js` is what makes it work outside the environment it was written in —
it must be imported before App, which `main.jsx` already does.

## Going native (later, ~week 8)

```bash
npm install @capacitor/core @capacitor/cli
npx cap init Bond co.bond.app --web-dir dist
npm install @capacitor/ios @capacitor/android
npm install @capacitor/preferences @capacitor/local-notifications
npm run build && npx cap add ios && npx cap add android
npm run ios          # opens Xcode  (needs a Mac)
npm run android      # opens Android Studio  (any OS)
```

`capacitor.config.json` is already written. `src/storage.js` upgrades itself to
native storage automatically once `@capacitor/preferences` is installed — no code
change needed.

To turn notifications on, add this to `BondApp()` in `App.jsx`:

```js
import { requestPermission, scheduleAll } from "./notifications.js";

useEffect(() => {
  if (!pets.length) return;
  requestPermission().then((ok) => {
    if (ok) scheduleAll(pets, generateMilestones);
  });
}, [pets]);
```

`generateMilestones` is already defined in `App.jsx` — the same engine drives the
UI and the notifications, so they can never disagree.

## Files

| File | What it is |
|---|---|
| `src/App.jsx` | The app. Aging engine + UI. |
| `src/storage.js` | Persistence. localStorage on web, Capacitor Preferences on native. |
| `src/notifications.js` | Local notification scheduling. No-ops on web. |
| `public/icon.svg` | App icon. Export to PNG at 1024/512/192/180. |
| `PRIVACY.md` | Publish at `/privacy`. Both stores require a reachable URL. |
| `STORE_LISTING.md` | Listing copy, keywords, screenshot plan, privacy answers. |
| `capacitor.config.json` | Native config. Ready to go. |
