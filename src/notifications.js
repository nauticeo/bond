/* notifications.js — the actual product mechanic.
 *
 * Native only:  npm install @capacitor/local-notifications
 * No-ops in the browser so you can keep developing on the web build.
 *
 * iOS caps pending local notifications at 64 per app. We schedule the next 40
 * and re-schedule on every app open. For a product that fires ~8 times a year
 * that's several years of runway per pet.
 */

const COPY = {
  milestone: (p, m) => [`${p.name} is ${m.value} today`,
                        `A milestone on their clock. Worth marking.`],
  decade:    (p, m) => [`${p.name} turns ${m.value}`,
                        `A round number. The collar glows ember tonight.`],
  birthday:  (p)    => [`Happy birthday, ${p.name}`,
                        `Another year together.`],
  stage:     (p, m) => [`${p.name} is now ${String(m.value).toLowerCase()}`,
                        `A new chapter. Worth mentioning at the next vet visit.`],
};

async function getPlugin() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor?.isNativePlatform?.()) return null;
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    return LocalNotifications;
  } catch {
    return null;
  }
}

export async function requestPermission() {
  const LN = await getPlugin();
  if (!LN) return false;
  const { display } = await LN.requestPermissions();
  return display === "granted";
}

/** Wipe pending notifications and re-schedule from the current pet set.
 *  Pass in generateMilestones from App.jsx so there is exactly one engine. */
export async function scheduleAll(pets, generateMilestones) {
  const LN = await getPlugin();
  if (!LN) return 0;

  const pending = await LN.getPending();
  if (pending.notifications.length) await LN.cancel(pending);

  const from = new Date();
  const to = new Date(Date.now() + 5 * 365.2425 * 24 * 3600 * 1000);
  const items = [];

  for (const pet of pets) {
    for (const m of generateMilestones(pet, from, to)) {
      const build = COPY[m.kind] || COPY.milestone;
      const [title, body] = build(pet, m);
      // Fire at 9am local, not at the exact mathematical instant. Nobody wants
      // to learn their dog turned 50 at 3:47am.
      const at = new Date(m.when);
      at.setHours(9, 0, 0, 0);
      if (at.getTime() <= Date.now()) continue;
      items.push({
        title, body,
        schedule: { at, allowWhileIdle: true },
        extra: { petId: pet.id, kind: m.kind, value: m.value },
      });
    }
  }

  items.sort((a, b) => a.schedule.at - b.schedule.at);
  const batch = items.slice(0, 40).map((n, i) => ({ ...n, id: i + 1 }));
  if (batch.length) await LN.schedule({ notifications: batch });
  return batch.length;
}
