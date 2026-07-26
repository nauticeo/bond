# Bond — run and ship it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/
```

`src/App.jsx` is the app as delivered. `src/storage.js` makes it save data — it must be
imported before App, which `main.jsx` already does.

## Going native (later, ~week 8)

The Capacitor packages are already in `package.json`, so `npm install` has them. You only
need the CLI and the platform folders:

```bash
npm install @capacitor/cli @capacitor/ios @capacitor/android
npm run build
npx cap add ios
npx cap add android
npx cap open ios          # opens Xcode  (needs a Mac)
npx cap open android      # opens Android Studio  (any OS)
```

`capacitor.config.json` is already written. `src/storage.js` switches from browser storage to
native device storage automatically — no code change.

To turn notifications on, add to `BondApp()` in `App.jsx`:

```js
import { requestPermission, scheduleAll } from "./notifications.js";

useEffect(() => {
  if (!pets.length) return;
  requestPermission().then((ok) => ok && scheduleAll(pets, generateMilestones));
}, [pets]);
```

`generateMilestones` already exists in `App.jsx`, so the notifications and the on-screen
dial use the same engine and can never disagree.

## Files

| File | What it is |
|---|---|
| `src/App.jsx` | The app. Aging engine + all screens. |
| `src/storage.js` | Saves your pets. Browser storage on web, device storage in the app. |
| `src/notifications.js` | Milestone notifications. Does nothing in a browser — that's intended. |
| `public/icon.svg` | App icon. Export to PNG at 1024 for the stores. |
| `PRIVACY.md` | Fill in the brackets, publish at `/privacy`. Both stores require it. |
| `STORE_LISTING.md` | Listing text, keywords, screenshot plan, privacy answers. |
| `capacitor.config.json` | Native config. Ready as-is. |
