/* notifications.js — the actual product mechanic.
 *
 * Real scheduled notifications only work in the installed app, so every
 * function here quietly does nothing in a browser. Safe to call either way.
 *
 * iOS caps pending local notifications at 64 per app, so we schedule the next
 * 40 and re-schedule each time the app opens. At roughly 8 milestones a year
 * per pet, that's several years of runway.
 */

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const native = () => Capacitor.isNativePlatform();

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

export async function requestPermission() {
  if (!native()) return false;
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === "granted";
  } catch {
    return false;
  }
}

/** Wipe pending notifications and re-schedule from the current pet set.
 *  Pass generateMilestones in from App.jsx so there is only ever one engine. */
export async function scheduleAll(pets, generateMilestones) {
  if (!native()) return 0;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel(pending);

    const from = new Date();
    const to = new Date(Date.now() + 5 * 365.2425 * 24 * 3600 * 1000);
    const items = [];

    for (const pet of pets) {
      for (const m of generateMilestones(pet, from, to)) {
        const [title, body] = (COPY[m.kind] || COPY.milestone)(pet, m);
        // Fire at 9am local, not at the exact mathematical instant. Nobody
        // wants to learn their dog turned 50 at 3:47am.
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
    if (batch.length) await LocalNotifications.schedule({ notifications: batch });
    return batch.length;
  } catch {
    return 0;
  }
}
