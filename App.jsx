import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, Share2, Check, Trash2, ChevronLeft } from "lucide-react";
import { Analytics } from "@vercel/analytics/react";

/* ============================================================================
   BOND — MVP
   App + collar. One product.

   The engine below is a faithful port of pettime_core.py (the reference engine). Same three tiers,
   same adaptive milestone cadence. If they ever disagree, the Python is right.
   ========================================================================== */

const HUMAN_MATURITY = 22.0;
const HUMAN_LIFESPAN = 78.0;
const JUVENILE_EXPONENT = 1.85;
const MS_YEAR = 365.2425 * 24 * 3600 * 1000;

const SPECIES = {
  dog:          { name: "Dog",          tier: 1, mat: 1.0,  life: 12, max: 29.5,
                  stages: [[0,"Puppy"],[0.10,"Adolescent"],[0.20,"Adult"],[0.55,"Mature"],[0.75,"Senior"],[0.92,"Geriatric"]] },
  cat:          { name: "Cat",          tier: 2, mat: 1.0,  life: 15, max: 38,
                  stages: [[0,"Kitten"],[0.07,"Young adult"],[0.45,"Mature"],[0.68,"Senior"],[0.90,"Geriatric"]] },
  rabbit:       { name: "Rabbit",       tier: 3, mat: 0.5,  life: 10, max: 14 },
  ferret:       { name: "Ferret",       tier: 3, mat: 0.5,  life: 7,  max: 11.1 },
  guinea_pig:   { name: "Guinea pig",   tier: 3, mat: 0.25, life: 6,  max: 12 },
  rat:          { name: "Rat",          tier: 3, mat: 0.15, life: 2.5, max: 4.7 },
  chinchilla:   { name: "Chinchilla",   tier: 3, mat: 0.7,  life: 14, max: 20 },
  hedgehog:     { name: "Hedgehog",     tier: 3, mat: 0.5,  life: 5,  max: 10 },
  sugar_glider: { name: "Sugar glider", tier: 3, mat: 1.0,  life: 12, max: 17.8 },
  opossum:      { name: "Opossum",      tier: 3, mat: 0.6,  life: 3.5, max: 6.6, exotic: true },
  raccoon:      { name: "Raccoon",      tier: 3, mat: 1.0,  life: 13, max: 21, exotic: true },
  skunk:        { name: "Skunk",        tier: 3, mat: 0.8,  life: 8,  max: 10, exotic: true },
};

const GENERIC_STAGES = [[0,"Infant"],[0.06,"Juvenile"],[0.18,"Adolescent"],[0.30,"Adult"],[0.60,"Mature"],[0.78,"Senior"],[0.92,"Geriatric"]];

const DOG_BREEDS = {
  "Mixed — small (under 20 lb)": 14, "Mixed — medium (20–55 lb)": 12.5,
  "Mixed — large (55–100 lb)": 10.5, "Mixed — giant (over 100 lb)": 8.5,
  "Beagle": 13, "Bernese mountain dog": 8, "Border collie": 13, "Boxer": 10,
  "Chihuahua": 16, "Dachshund": 14, "French bulldog": 11, "German shepherd": 10.5,
  "Golden retriever": 12, "Great Dane": 8, "Irish wolfhound": 7,
  "Labrador retriever": 12, "Poodle (standard)": 12, "Poodle (toy)": 15,
  "Pug": 12, "Rottweiler": 9, "Shih tzu": 13, "Yorkshire terrier": 14,
};

const CAT_LIFESTYLES = { indoor: 15, indoor_outdoor: 12, outdoor: 8 };

function juvenile(age, tMat, hMat) {
  if (age <= 0) return 0;
  return hMat * Math.pow(age / tMat, JUVENILE_EXPONENT);
}

/** Chronological pet age (years) -> human-equivalent age (years). Monotonic. */
function humanAge(pet, ageYears) {
  const sp = SPECIES[pet.species];
  const a = Math.max(0, ageYears);

  if (sp.tier === 1) {                              // Dog — Wang et al. 2020
    const life = DOG_BREEDS[pet.breed] || 12;
    const aeq = a * (12 / life);
    if (aeq < 1) return juvenile(aeq, 1, 31);
    return 16 * Math.log(aeq) + 31;
  }
  if (sp.tier === 2) {                              // Cat — AAHA/AAFP 2021
    const life = CAT_LIFESTYLES[pet.lifestyle] || 15;
    const aeq = a * (15 / life);
    if (aeq <= 1) return 15 * aeq;
    if (aeq <= 2) return 15 + 9 * (aeq - 1);
    return 24 + 4 * (aeq - 2);
  }
  const A = (HUMAN_LIFESPAN - HUMAN_MATURITY) / Math.log(sp.life / sp.mat);
  const B = HUMAN_MATURITY - A * Math.log(sp.mat);
  if (a < sp.mat) return juvenile(a, sp.mat, HUMAN_MATURITY);
  return A * Math.log(a) + B;
}

function agingRate(pet, ageYears) {
  const h = 1e-4, lo = Math.max(1e-6, ageYears - h), hi = ageYears + h;
  return (humanAge(pet, hi) - humanAge(pet, lo)) / (hi - lo);
}

function petLifespan(pet) {
  const sp = SPECIES[pet.species];
  if (sp.tier === 1) return DOG_BREEDS[pet.breed] || 12;
  if (sp.tier === 2) return CAT_LIFESTYLES[pet.lifestyle] || 15;
  return sp.life;
}

function lifeStage(pet, ageYears) {
  const sp = SPECIES[pet.species];
  const table = sp.stages || GENERIC_STAGES;
  const frac = ageYears / petLifespan(pet);
  let label = table[0][1];
  for (const [t, n] of table) if (frac >= t) label = n;
  return label;
}

/** Invert humanAge by bisection. Safe because humanAge is monotonic. */
function ageAtHumanAge(pet, targetH) {
  const sp = SPECIES[pet.species];
  let lo = 0, hi = sp.max * 3;
  if (humanAge(pet, hi) < targetH) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (humanAge(pet, mid) < targetH) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/* Adaptive milestone step.
   A puppy accrues ~57 human-years/year; a senior dog ~1.3. A fixed "every
   human year" rule spams year one and goes silent exactly when the owner most
   wants to hear from us. The step adapts to hold ~8 events/year. */
const STEP_LADDER = [1, 2, 5, 10, 20, 25];
const TARGET_EVENTS_PER_YEAR = 8;

function milestoneStep(pet, ageYears) {
  const rate = agingRate(pet, Math.max(ageYears, 0.02));
  for (const s of STEP_LADDER) if (rate / s <= TARGET_EVENTS_PER_YEAR * 1.5) return s;
  return STEP_LADDER[STEP_LADDER.length - 1];
}

const KIND = {
  milestone:  { label: "Milestone",   color: "#F2A93B", glow: "Amber",  pattern: "Slow breathing pulse" },
  decade:     { label: "Decade",      color: "#E4633A", glow: "Ember",  pattern: "Bright rise, long hold" },
  birthday:   { label: "Birthday",    color: "#C77DBE", glow: "Orchid", pattern: "Colour cycle, 3 minutes" },
  stage:      { label: "New chapter", color: "#4FB39A", glow: "Jade",   pattern: "Two soft sweeps" },
};

/* Night-safety mode. The everyday reason the collar stays on the dog.
   Green and amber read best against headlights; white eats the most battery. */
const NIGHT_COLORS = [
  { key: "green",  name: "Green",  hex: "#4FD98A" },
  { key: "amber",  name: "Amber",  hex: "#F2A93B" },
  { key: "cyan",   name: "Cyan",   hex: "#54C7E8" },
  { key: "red",    name: "Red",    hex: "#EF5B5B" },
  { key: "white",  name: "White",  hex: "#F4F1E8" },
];

const NIGHT_PATTERNS = [
  { key: "steady", name: "Steady", hours: 9 },
  { key: "slow",   name: "Slow blink", hours: 22 },
  { key: "fast",   name: "Fast blink", hours: 16 },
];

const DEFAULT_COLLAR = { nightOn: false, nightColor: "green", nightPattern: "slow", milestoneOn: true };

/** Every celebration between two dates. Pure — the collar and app agree. */
function generateMilestones(pet, fromDate, toDate) {
  const birth = new Date(pet.birthday).getTime();
  const ageAt = (t) => (t - birth) / MS_YEAR;
  const out = [];
  const a0 = ageAt(fromDate.getTime());
  const a1 = ageAt(toDate.getTime());
  if (a1 <= 0) return out;

  // 1. Adaptive human-year milestones
  const h0 = humanAge(pet, Math.max(a0, 0));
  const h1 = humanAge(pet, a1);
  let step = milestoneStep(pet, Math.max(a0, 0.02));
  let m = Math.floor(h0 / step) * step + step;
  let guard = 0;
  while (m <= h1 && guard++ < 400) {
    const pa = ageAtHumanAge(pet, m);
    if (pa != null) {
      const when = new Date(birth + pa * MS_YEAR);
      if (when >= fromDate && when < toDate) {
        out.push({ when, kind: m % 10 === 0 ? "decade" : "milestone", value: m,
                   title: `${pet.name} turns ${m}` });
      }
    }
    const pa2 = ageAtHumanAge(pet, m + step);
    if (pa2 != null) { step = milestoneStep(pet, pa2); m = Math.floor(m / step) * step + step; }
    else m += step;
  }

  // 2. Chronological birthdays — the anchor event
  const b = new Date(pet.birthday);
  for (let y = fromDate.getFullYear(); y <= toDate.getFullYear(); y++) {
    const bd = new Date(y, b.getMonth(), b.getDate());
    if (bd >= fromDate && bd < toDate && bd.getTime() > birth) {
      const n = y - b.getFullYear();
      out.push({ when: bd, kind: "birthday", value: n,
                 title: `${pet.name}'s ${ordinal(n)} birthday` });
    }
  }

  // 3. Life-stage transitions
  let prev = lifeStage(pet, Math.max(a0, 0));
  const days = Math.max(1, Math.round((a1 - a0) * 365));
  for (let i = 1; i <= days; i++) {
    const a = a0 + ((a1 - a0) * i) / days;
    const cur = lifeStage(pet, a);
    if (cur !== prev) {
      out.push({ when: new Date(birth + a * MS_YEAR), kind: "stage", value: cur,
                 title: `${pet.name} becomes ${article(cur)} ${cur.toLowerCase()}` });
      prev = cur;
    }
  }

  out.sort((x, y) => x.when - y.when);
  return out;
}

const ordinal = (n) => {
  if (n % 100 >= 10 && n % 100 <= 20) return n + "th";
  return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
};
const article = (w) => ("aeiou".includes(w[0].toLowerCase()) ? "an" : "a");

function fmtAge(years) {
  const y = Math.floor(years);
  const m = Math.floor((years - y) * 12);
  if (y === 0) return `${m} month${m === 1 ? "" : "s"} old`;
  return `${y}y ${m}m old`;
}

function fmtCountdown(ms) {
  if (ms < 0) return "now";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const mi = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(mi)}:${pad(s)}`;
  return `${pad(h)}:${pad(mi)}:${pad(s)}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

/* ========================================================================== */

const STORE_KEY = "bond:pets:v1";

export default function BondApp() {
  const [pets, setPets] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState("loading");
  const [now, setNow] = useState(Date.now());
  const [shareFor, setShareFor] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let loaded = [];
      try {
        const res = await window.storage.get(STORE_KEY);
        if (res && res.value) loaded = JSON.parse(res.value);
      } catch { /* first run — no saved pets yet */ }
      if (!alive) return;
      setPets(loaded);
      setActiveId(loaded[0]?.id ?? null);
      setView(loaded.length ? "home" : "empty");
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const persist = async (next) => {
    setPets(next);
    try { await window.storage.set(STORE_KEY, JSON.stringify(next)); }
    catch { /* keep the session working even if storage is unavailable */ }
  };

  const addPet = async (pet) => {
    const next = [...pets, pet];
    await persist(next);
    setActiveId(pet.id);
    setView("home");
  };

  const updatePet = async (id, patch) => {
    await persist(pets.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removePet = async (id) => {
    const next = pets.filter((p) => p.id !== id);
    await persist(next);
    setActiveId(next[0]?.id ?? null);
    setView(next.length ? "home" : "empty");
  };

  const active = pets.find((p) => p.id === activeId) || null;

  return (
    <div className="pt-root">
      <Styles />
      <div className="pt-frame">
        <Header
          pets={pets} activeId={activeId} onPick={setActiveId}
          onAdd={() => setView("add")} showChips={view === "home"}
        />
        {view === "loading" && <div className="pt-loading">Loading…</div>}
        {view === "empty" && <EmptyState onAdd={() => setView("add")} />}
        {view === "add" && (
          <AddPet onCancel={() => setView(pets.length ? "home" : "empty")} onSave={addPet} />
        )}
        {view === "home" && active && (
          <Dashboard pet={active} now={now} onShare={setShareFor}
            onRemove={removePet} onUpdate={updatePet} />
        )}
      </div>
      {shareFor && <ShareCard {...shareFor} onClose={() => setShareFor(null)} />}
      <Analytics />
    </div>
  );
}

/* ========================================================================== */

function Header({ pets, activeId, onPick, onAdd, showChips }) {
  return (
    <header className="pt-header">
      <div className="pt-brand">
        <span className="pt-mark" aria-hidden="true" />
        <span className="pt-wordmark">Bond</span>
      </div>
      {showChips && (
        <div className="pt-chips">
          {pets.map((p) => (
            <button key={p.id} onClick={() => onPick(p.id)}
              className={"pt-chip" + (p.id === activeId ? " is-on" : "")}>
              {p.name}
            </button>
          ))}
          <button className="pt-chip pt-chip-add" onClick={onAdd} aria-label="Add a pet">
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </header>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="pt-empty">
      <p className="pt-empty-kicker">Time moves differently for them</p>
      <h1 className="pt-empty-title">
        A golden retriever turns fifty<br />somewhere in her fifth year.
      </h1>
      <p className="pt-empty-body">
        Add your pet and we'll work out where they are on their own clock —
        and light the collar every time they reach somewhere worth marking.
      </p>
      <button className="pt-btn pt-btn-primary" onClick={onAdd}>Add your first pet</button>
    </div>
  );
}

/* ========================================================================== */

function AddPet({ onCancel, onSave }) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("dog");
  const [breed, setBreed] = useState("Mixed — medium (20–55 lb)");
  const [lifestyle, setLifestyle] = useState("indoor");
  const [birthday, setBirthday] = useState("");
  const [estimate, setEstimate] = useState(false);

  const sp = SPECIES[species];
  const valid = name.trim() && birthday && new Date(birthday) <= new Date();

  const submit = () => {
    if (!valid) return;
    onSave({
      id: String(Date.now()), name: name.trim(), species, birthday, estimate,
      breed: species === "dog" ? breed : null,
      lifestyle: species === "cat" ? lifestyle : null,
      collar: { ...DEFAULT_COLLAR },
    });
  };

  return (
    <div className="pt-panel">
      <button className="pt-back" onClick={onCancel}><ChevronLeft size={16} /> Back</button>
      <h2 className="pt-panel-title">Who are we keeping time for?</h2>

      <label className="pt-field">
        <span className="pt-label">Name</span>
        <input className="pt-input" value={name} maxLength={24}
          onChange={(e) => setName(e.target.value)} placeholder="Cooper" />
      </label>

      <div className="pt-field">
        <span className="pt-label">Species</span>
        <div className="pt-grid">
          {Object.entries(SPECIES).map(([k, s]) => (
            <button key={k} onClick={() => setSpecies(k)}
              className={"pt-opt" + (species === k ? " is-on" : "")}>
              {s.name}
              {s.tier === 3 && <em className="pt-est">est.</em>}
            </button>
          ))}
        </div>
      </div>

      {species === "dog" && (
        <label className="pt-field">
          <span className="pt-label">Breed <em>— changes the maths a lot</em></span>
          <select className="pt-input" value={breed} onChange={(e) => setBreed(e.target.value)}>
            {Object.keys(DOG_BREEDS).map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
      )}

      {species === "cat" && (
        <div className="pt-field">
          <span className="pt-label">Lifestyle <em>— the biggest single factor</em></span>
          <div className="pt-grid pt-grid-3">
            {[["indoor","Indoor"],["indoor_outdoor","Both"],["outdoor","Outdoor"]].map(([k, l]) => (
              <button key={k} onClick={() => setLifestyle(k)}
                className={"pt-opt" + (lifestyle === k ? " is-on" : "")}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <label className="pt-field">
        <span className="pt-label">Date of birth</span>
        <input className="pt-input" type="date" value={birthday}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirthday(e.target.value)} />
      </label>

      <button className={"pt-check" + (estimate ? " is-on" : "")} onClick={() => setEstimate(!estimate)}>
        <span className="pt-check-box">{estimate && <Check size={12} strokeWidth={3} />}</span>
        This is an estimate — they were adopted
      </button>

      {sp.exotic && (
        <p className="pt-notice">
          Keeping {sp.name.toLowerCase()}s is restricted or prohibited in many places.
          Check your state and local rules.
        </p>
      )}
      {sp.tier === 3 && (
        <p className="pt-notice pt-notice-quiet">
          No epigenetic clock has been published for {sp.name.toLowerCase()}s. We model their
          ageing from maturity and lifespan data, and label the result an estimate.
        </p>
      )}

      <button className="pt-btn pt-btn-primary" disabled={!valid} onClick={submit}>
        Start the clock
      </button>
    </div>
  );
}

/* ========================================================================== */

function Dashboard({ pet, now, onShare, onRemove, onUpdate }) {
  const birth = new Date(pet.birthday).getTime();
  const ageYears = (now - birth) / MS_YEAR;
  const h = humanAge(pet, ageYears);
  const stage = lifeStage(pet, ageYears);
  const sp = SPECIES[pet.species];
  const rate = agingRate(pet, ageYears);

  const year = useMemo(() => {
    const from = new Date(now);
    const to = new Date(now + MS_YEAR);
    return generateMilestones(pet, from, to);
  }, [pet.id, pet.birthday, pet.species, pet.breed, pet.lifestyle, Math.floor(now / 3600000)]);

  const next = year[0] || null;
  const detail = pet.species === "dog" ? pet.breed
    : pet.species === "cat" ? `${pet.lifestyle.replace("_", "/")} cat` : sp.name.toLowerCase();

  return (
    <div className="pt-dash">
      <YearDial pet={pet} human={h} milestones={year} now={now} stage={stage} />

      <div className="pt-ident">
        <h1 className="pt-name">{pet.name}</h1>
        <p className="pt-meta">
          {detail} · {fmtAge(ageYears)}
          {pet.estimate && <span className="pt-tag">estimated</span>}
          {sp.tier === 3 && <span className="pt-tag">modelled</span>}
        </p>
        <p className="pt-rate">
          Ageing about <strong>{rate < 1 ? rate.toFixed(1) : Math.round(rate)}</strong> human
          years for every year that passes
        </p>
      </div>

      {next && <NextUp pet={pet} m={next} now={now} onShare={onShare} />}

      <section className="pt-section">
        <h2 className="pt-section-title">
          The year ahead
          <span className="pt-count">{year.length} to celebrate</span>
        </h2>
        <ol className="pt-timeline">
          {year.map((m, i) => (
            <li key={i} className="pt-event">
              <span className="pt-dot" style={{ background: KIND[m.kind].color }} />
              <span className="pt-event-date">{fmtDate(m.when)}</span>
              <span className="pt-event-title">{m.title}</span>
              <button className="pt-event-share" onClick={() => onShare({ pet, m })}
                aria-label={`Share ${m.title}`}>
                <Share2 size={13} />
              </button>
            </li>
          ))}
        </ol>
      </section>

      <CollarPanel pet={pet} onUpdate={onUpdate} />

      <button className="pt-remove" onClick={() => {
        if (window.confirm(`Remove ${pet.name}? This clears their timeline from this device.`)) onRemove(pet.id);
      }}>
        <Trash2 size={13} /> Remove {pet.name}
      </button>
    </div>
  );
}

/* --- Collar ---------------------------------------------------------------
   Two jobs. Night mode is the everyday one -- it is why the collar stays on
   the dog on the 360 days that are not milestones. Milestone glow is the one
   people buy it for. Both live on the same LEDs. */

function CollarPanel({ pet, onUpdate }) {
  const c = { ...DEFAULT_COLLAR, ...(pet.collar || {}) };
  const [testing, setTesting] = useState(null);
  const set = (patch) => onUpdate(pet.id, { collar: { ...c, ...patch } });

  const nightHex = NIGHT_COLORS.find((n) => n.key === c.nightColor)?.hex || "#4FD98A";
  const pattern = NIGHT_PATTERNS.find((n) => n.key === c.nightPattern) || NIGHT_PATTERNS[1];

  const runTest = (hex, cls) => {
    setTesting({ hex, cls });
    setTimeout(() => setTesting(null), 3200);
  };

  // Rough battery life: night mode dominates, milestone glow barely registers.
  const nightHours = c.nightOn ? pattern.hours : 0;
  const days = c.nightOn ? Math.round(nightHours / 1.5) : 60;

  return (
    <section className="pt-section">
      <h2 className="pt-section-title">
        {pet.name}'s collar
        <span className="pt-count">{c.nightOn ? `~${days} days per charge` : "~60 days per charge"}</span>
      </h2>

      <div className={"pt-strip" + (testing ? " is-testing " + testing.cls : "")}
        style={{ "--k": testing ? testing.hex : nightHex }} aria-hidden="true">
        <span className="pt-strip-light" />
      </div>

      {/* night mode */}
      <div className="pt-ctl">
        <div className="pt-ctl-head">
          <div>
            <p className="pt-ctl-name">Night light</p>
            <p className="pt-ctl-sub">Manual. Stays on until you switch it off.</p>
          </div>
          <button className={"pt-toggle" + (c.nightOn ? " is-on" : "")}
            onClick={() => set({ nightOn: !c.nightOn })}
            role="switch" aria-checked={c.nightOn} aria-label="Night light">
            <span className="pt-toggle-knob" />
          </button>
        </div>

        {c.nightOn && (
          <div className="pt-ctl-body">
            <div className="pt-swatches">
              {NIGHT_COLORS.map((n) => (
                <button key={n.key} onClick={() => { set({ nightColor: n.key }); runTest(n.hex, "steady"); }}
                  className={"pt-swatch-btn" + (c.nightColor === n.key ? " is-on" : "")}
                  style={{ "--s": n.hex }} aria-label={n.name} title={n.name} />
              ))}
            </div>
            <div className="pt-seg">
              {NIGHT_PATTERNS.map((n) => (
                <button key={n.key} onClick={() => { set({ nightPattern: n.key }); runTest(nightHex, n.key); }}
                  className={"pt-seg-btn" + (c.nightPattern === n.key ? " is-on" : "")}>
                  {n.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* milestone mode */}
      <div className="pt-ctl">
        <div className="pt-ctl-head">
          <div>
            <p className="pt-ctl-name">Milestone glow</p>
            <p className="pt-ctl-sub">Automatic. Three hours from dusk, on the day.</p>
          </div>
          <button className={"pt-toggle" + (c.milestoneOn ? " is-on" : "")}
            onClick={() => set({ milestoneOn: !c.milestoneOn })}
            role="switch" aria-checked={c.milestoneOn} aria-label="Milestone glow">
            <span className="pt-toggle-knob" />
          </button>
        </div>

        {c.milestoneOn && (
          <div className="pt-ctl-body">
            {Object.entries(KIND).map(([k, v]) => (
              <button key={k} className="pt-legend-row" onClick={() => runTest(v.color, "breathe")}>
                <span className="pt-swatch" style={{ background: v.color, boxShadow: `0 0 14px ${v.color}88` }} />
                <span className="pt-legend-name">{v.label}</span>
                <span className="pt-legend-desc">{v.glow} · {v.pattern}</span>
                <span className="pt-legend-try">try</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="pt-fineprint">
        Your phone works out the next twelve months of milestones and sends the collar a short
        list of dates and colours once a day. The collar keeps celebrating for months with your
        phone switched off, in a drawer, or in another country.
      </p>
    </section>
  );
}

/* --- Signature element: the year dial ------------------------------------ */

function YearDial({ pet, human, milestones, now, stage }) {
  const R = 118, C = 140, STROKE = 2;
  const next = milestones[0];
  const nextAngle = next ? ((next.when.getTime() - now) / MS_YEAR) * 360 : 0;
  const toXY = (angleDeg, radius) => {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
  };
  const arc = (from, to, radius) => {
    const [x1, y1] = toXY(from, radius);
    const [x2, y2] = toXY(to, radius);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };
  const glow = next ? KIND[next.kind].color : "#F2A93B";

  return (
    <div className="pt-dial-wrap">
      <svg viewBox="0 0 280 280" className="pt-dial" role="img"
        aria-label={`${milestones.length} celebrations in the year ahead`}>
        <defs>
          <filter id="ptGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* the year ahead */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="#26333C" strokeWidth={STROKE} />

        {/* month ticks */}
        {Array.from({ length: 12 }, (_, i) => {
          const [x1, y1] = toXY(i * 30, R - 6);
          const [x2, y2] = toXY(i * 30, R);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2F3F49" strokeWidth="1" />;
        })}

        {/* time until the next celebration */}
        {next && nextAngle > 0.5 && (
          <path d={arc(0, Math.min(nextAngle, 359.9), R)} fill="none"
            stroke={glow} strokeWidth={STROKE + 1} strokeLinecap="round" opacity="0.85" />
        )}

        {/* every celebration in the window */}
        {milestones.map((m, i) => {
          const ang = ((m.when.getTime() - now) / MS_YEAR) * 360;
          const [x, y] = toXY(ang, R);
          const isNext = i === 0;
          return (
            <circle key={i} cx={x} cy={y} r={isNext ? 6 : 3.5}
              fill={KIND[m.kind].color} filter={isNext ? "url(#ptGlow)" : undefined}
              opacity={isNext ? 1 : 0.75} />
          );
        })}

        {/* now */}
        <circle cx={C} cy={C - R} r="3" fill="#EDE7DC" />

        <text x={C} y={C - 14} textAnchor="middle" className="pt-dial-num">
          {Math.floor(human)}
        </text>
        <text x={C} y={C + 14} textAnchor="middle" className="pt-dial-cap">
          in {SPECIES[pet.species].name.toLowerCase()} years
        </text>
        <text x={C} y={C + 42} textAnchor="middle" className="pt-dial-stage">
          {stage.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

function NextUp({ pet, m, now, onShare }) {
  const k = KIND[m.kind];
  const ms = m.when.getTime() - now;
  const imminent = ms < 86400000;
  return (
    <section className="pt-next" style={{ "--k": k.color }}>
      <div className="pt-next-head">
        <span className="pt-next-kind">{k.label}</span>
        <span className="pt-next-date">{fmtDate(m.when)}</span>
      </div>
      <h2 className="pt-next-title">{m.title}</h2>
      <p className="pt-next-clock">{fmtCountdown(ms)}</p>
      <div className={"pt-collar" + (imminent ? " is-live" : "")} aria-hidden="true">
        <span className="pt-collar-light" />
      </div>
      <p className="pt-next-note">
        {imminent ? "The collar lights tonight." : `The collar will glow ${k.glow.toLowerCase()} that evening.`}
      </p>
      <button className="pt-btn pt-btn-ghost" onClick={() => onShare({ pet, m })}>
        <Share2 size={14} /> Make a card
      </button>
    </section>
  );
}

/* --- Share ---------------------------------------------------------------- */

function ShareCard({ pet, m, onClose }) {
  const k = KIND[m.kind];
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  const line = m.kind === "birthday"
    ? `${pet.name} is ${m.value} today. ${humanAge(pet, (Date.now() - new Date(pet.birthday)) / MS_YEAR).toFixed(0)} in ${SPECIES[pet.species].name.toLowerCase()} years.`
    : m.kind === "stage" ? `${m.title}.`
    : `${pet.name} is ${m.value} today — in ${SPECIES[pet.species].name.toLowerCase()} years.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${line}\n\nKeeping time with Bond.`);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  };

  return (
    <div className="pt-modal" onClick={onClose}>
      <div className="pt-modal-inner" onClick={(e) => e.stopPropagation()}>
        <button className="pt-modal-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <div className="pt-card" ref={ref} style={{ "--k": k.color }}>
          <span className="pt-card-glow" />
          <p className="pt-card-kicker">{fmtDate(m.when)}</p>
          <p className="pt-card-big">{m.kind === "stage" ? m.value : m.value}</p>
          <p className="pt-card-line">{line}</p>
          <p className="pt-card-mark">Bond</p>
        </div>
        <p className="pt-modal-hint">Screenshot the card, or copy the words.</p>
        <button className="pt-btn pt-btn-primary" onClick={copy}>
          {copied ? <><Check size={14} /> Copied</> : "Copy the words"}
        </button>
      </div>
    </div>
  );
}

/* ========================================================================== */

function Styles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Archivo:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

.pt-root{
  --ink:#10171C; --slate:#182229; --raise:#1F2C34; --line:#26333C;
  --mist:#7E8F99; --bone:#EDE7DC; --glow:#F2A93B; --ember:#E4633A; --jade:#4FB39A;
  background:var(--ink); color:var(--bone); min-height:100vh; width:100%;
  font-family:'Archivo',system-ui,sans-serif; -webkit-font-smoothing:antialiased;
  padding:0 0 64px;
}
.pt-frame{ max-width:460px; margin:0 auto; padding:0 22px; }
*,*::before,*::after{ box-sizing:border-box; }
.pt-root button{ font-family:inherit; cursor:pointer; border:none; background:none; color:inherit; }
.pt-root button:focus-visible,.pt-root input:focus-visible,.pt-root select:focus-visible{
  outline:2px solid var(--glow); outline-offset:2px; }

/* header */
.pt-header{ padding:24px 0 20px; }
.pt-brand{ display:flex; align-items:center; gap:9px; }
.pt-mark{ width:9px; height:9px; border-radius:50%; background:var(--glow);
  box-shadow:0 0 12px var(--glow); }
.pt-wordmark{ font-family:'Fraunces',serif; font-size:17px; font-weight:600;
  letter-spacing:-0.01em; }
.pt-chips{ display:flex; gap:7px; margin-top:16px; flex-wrap:wrap; }
.pt-chip{ padding:6px 13px; border-radius:99px; background:var(--slate);
  border:1px solid var(--line); font-size:12.5px; color:var(--mist);
  transition:all .18s ease; }
.pt-chip.is-on{ background:var(--bone); color:var(--ink); border-color:var(--bone); font-weight:500; }
.pt-chip-add{ display:flex; align-items:center; padding:6px 9px; }

.pt-loading{ padding:80px 0; text-align:center; color:var(--mist); font-size:14px; }

/* empty */
.pt-empty{ padding:44px 0; }
.pt-empty-kicker{ font-family:'DM Mono',monospace; font-size:11px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--glow); margin:0 0 18px; }
.pt-empty-title{ font-family:'Fraunces',serif; font-size:31px; line-height:1.2;
  font-weight:400; margin:0 0 18px; letter-spacing:-0.015em; }
.pt-empty-body{ font-size:14.5px; line-height:1.65; color:var(--mist); margin:0 0 30px; }

/* buttons */
.pt-btn{ display:flex; align-items:center; justify-content:center; gap:7px;
  width:100%; padding:14px; border-radius:11px; font-size:14px; font-weight:500;
  transition:all .18s ease; }
.pt-btn-primary{ background:var(--bone); color:var(--ink); }
.pt-btn-primary:hover{ background:#fff; }
.pt-btn-primary:disabled{ opacity:.28; cursor:not-allowed; }
.pt-btn-ghost{ background:transparent; border:1px solid var(--line); color:var(--bone); }
.pt-btn-ghost:hover{ border-color:var(--mist); }

/* form */
.pt-panel{ padding:8px 0 40px; }
.pt-back{ display:flex; align-items:center; gap:3px; font-size:13px; color:var(--mist);
  margin-bottom:22px; }
.pt-panel-title{ font-family:'Fraunces',serif; font-size:25px; font-weight:400;
  margin:0 0 28px; letter-spacing:-0.01em; }
.pt-field{ display:block; margin-bottom:22px; }
.pt-label{ display:block; font-family:'DM Mono',monospace; font-size:10.5px;
  letter-spacing:.12em; text-transform:uppercase; color:var(--mist); margin-bottom:9px; }
.pt-label em{ font-style:normal; text-transform:none; letter-spacing:0; opacity:.75; }
.pt-input{ width:100%; padding:12px 13px; border-radius:10px; background:var(--slate);
  border:1px solid var(--line); color:var(--bone); font-size:14.5px;
  font-family:inherit; }
.pt-input::placeholder{ color:#4A5A64; }
.pt-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }
.pt-grid-3{ grid-template-columns:repeat(3,1fr); }
.pt-opt{ position:relative; padding:11px 6px; border-radius:9px; background:var(--slate);
  border:1px solid var(--line); font-size:12.5px; color:var(--mist);
  transition:all .18s ease; }
.pt-opt:hover{ border-color:var(--mist); }
.pt-opt.is-on{ background:var(--raise); border-color:var(--bone); color:var(--bone); }
.pt-est{ position:absolute; top:3px; right:5px; font-style:normal; font-size:8px;
  letter-spacing:.06em; color:var(--glow); opacity:.65; }
.pt-check{ display:flex; align-items:center; gap:10px; font-size:13.5px;
  color:var(--mist); margin-bottom:20px; }
.pt-check-box{ width:17px; height:17px; border-radius:5px; border:1px solid var(--line);
  display:flex; align-items:center; justify-content:center; flex:none; }
.pt-check.is-on .pt-check-box{ background:var(--glow); border-color:var(--glow); color:var(--ink); }
.pt-notice{ font-size:12.5px; line-height:1.6; color:var(--glow); background:rgba(242,169,59,.07);
  border-left:2px solid var(--glow); padding:11px 13px; border-radius:0 8px 8px 0;
  margin:0 0 18px; }
.pt-notice-quiet{ color:var(--mist); border-left-color:var(--line); background:rgba(255,255,255,.02); }

/* dial */
.pt-dial-wrap{ display:flex; justify-content:center; padding:10px 0 4px; }
.pt-dial{ width:100%; max-width:280px; }
.pt-dial-num{ font-family:'Fraunces',serif; font-size:66px; font-weight:400;
  fill:var(--bone); letter-spacing:-0.03em; }
.pt-dial-cap{ font-size:11.5px; fill:var(--mist); font-family:'Archivo',sans-serif; }
.pt-dial-stage{ font-family:'DM Mono',monospace; font-size:9.5px; letter-spacing:.2em;
  fill:var(--glow); }

/* identity */
.pt-ident{ text-align:center; padding:6px 0 26px; }
.pt-name{ font-family:'Fraunces',serif; font-size:27px; font-weight:400; margin:0 0 6px;
  letter-spacing:-0.015em; }
.pt-meta{ font-size:13px; color:var(--mist); margin:0 0 10px; }
.pt-tag{ display:inline-block; margin-left:7px; font-family:'DM Mono',monospace;
  font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:var(--glow);
  border:1px solid rgba(242,169,59,.3); border-radius:4px; padding:1px 5px; }
.pt-rate{ font-size:12.5px; color:#5E6E78; margin:0; line-height:1.55; }
.pt-rate strong{ color:var(--bone); font-weight:500; }

/* next up */
.pt-next{ background:var(--slate); border:1px solid var(--line); border-radius:15px;
  padding:20px; margin-bottom:26px; position:relative; overflow:hidden; }
.pt-next::before{ content:''; position:absolute; inset:0 0 auto 0; height:2px;
  background:var(--k); opacity:.8; }
.pt-next-head{ display:flex; justify-content:space-between; align-items:baseline;
  margin-bottom:9px; }
.pt-next-kind{ font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--k); }
.pt-next-date{ font-size:12px; color:var(--mist); }
.pt-next-title{ font-family:'Fraunces',serif; font-size:21px; font-weight:400;
  margin:0 0 14px; letter-spacing:-0.01em; }
.pt-next-clock{ font-family:'DM Mono',monospace; font-size:26px; font-weight:500;
  margin:0 0 18px; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; }
.pt-collar{ height:8px; border-radius:99px; background:#111A1F; position:relative;
  overflow:hidden; margin-bottom:11px; }
.pt-collar-light{ position:absolute; inset:0; border-radius:99px; background:var(--k);
  opacity:.18; transition:opacity .4s ease; }
.pt-collar.is-live .pt-collar-light{ animation:ptBreathe 2.6s ease-in-out infinite;
  box-shadow:0 0 18px var(--k); }
@keyframes ptBreathe{ 0%,100%{opacity:.15} 50%{opacity:.95} }
.pt-next-note{ font-size:12.5px; color:var(--mist); margin:0 0 15px; }

/* sections */
.pt-section{ margin-bottom:30px; }
.pt-section-title{ display:flex; justify-content:space-between; align-items:baseline;
  font-family:'DM Mono',monospace; font-size:10.5px; letter-spacing:.16em;
  text-transform:uppercase; color:var(--mist); font-weight:400;
  padding-bottom:11px; border-bottom:1px solid var(--line); margin:0 0 4px; }
.pt-count{ letter-spacing:.04em; color:var(--glow); }

/* timeline */
.pt-timeline{ list-style:none; margin:0; padding:0; }
.pt-event{ display:flex; align-items:center; gap:11px; padding:13px 0;
  border-bottom:1px solid rgba(38,51,60,.55); }
.pt-dot{ width:6px; height:6px; border-radius:50%; flex:none; }
.pt-event-date{ font-family:'DM Mono',monospace; font-size:11.5px; color:var(--mist);
  width:52px; flex:none; }
.pt-event-title{ font-size:13.5px; flex:1; }
.pt-event-share{ color:#485862; padding:4px; transition:color .18s ease; }
.pt-event-share:hover{ color:var(--bone); }

/* legend */
.pt-legend{ padding-top:6px; }
.pt-legend-row{ display:flex; align-items:center; gap:11px; padding:9px 0; width:100%; text-align:left; }
.pt-swatch{ width:9px; height:9px; border-radius:50%; flex:none; }
.pt-legend-name{ font-size:13px; width:96px; flex:none; }
.pt-legend-desc{ font-size:11.5px; color:var(--mist); }
.pt-fineprint{ font-size:12px; line-height:1.65; color:#5E6E78; margin:14px 0 0;
  padding-top:14px; border-top:1px solid rgba(38,51,60,.55); }

.pt-remove{ display:flex; align-items:center; gap:6px; font-size:12.5px;
  color:#4A5A64; margin:8px auto 0; }
.pt-remove:hover{ color:var(--ember); }

/* collar */
.pt-strip{ height:12px; border-radius:99px; background:#0C1418; border:1px solid var(--line);
  position:relative; overflow:hidden; margin:14px 0 18px; }
.pt-strip-light{ position:absolute; inset:1px; border-radius:99px; background:var(--k);
  opacity:.1; transition:opacity .35s ease; }
.pt-strip.is-testing .pt-strip-light{ box-shadow:0 0 22px var(--k); }
.pt-strip.is-testing.steady .pt-strip-light{ opacity:.95; }
.pt-strip.is-testing.breathe .pt-strip-light{ animation:ptBreathe 2.6s ease-in-out infinite; }
.pt-strip.is-testing.slow .pt-strip-light{ animation:ptBlink 1.4s steps(1) infinite; }
.pt-strip.is-testing.fast .pt-strip-light{ animation:ptBlink .45s steps(1) infinite; }
@keyframes ptBlink{ 0%,49%{opacity:.95} 50%,100%{opacity:.08} }

.pt-ctl{ border-bottom:1px solid rgba(38,51,60,.55); padding:16px 0; }
.pt-ctl-head{ display:flex; align-items:center; justify-content:space-between; gap:16px; }
.pt-ctl-name{ font-size:14px; margin:0 0 3px; }
.pt-ctl-sub{ font-size:11.5px; color:var(--mist); margin:0; }
.pt-ctl-body{ padding-top:15px; }
.pt-toggle{ width:42px; height:24px; border-radius:99px; background:var(--line);
  position:relative; flex:none; transition:background .2s ease; }
.pt-toggle.is-on{ background:var(--glow); }
.pt-toggle-knob{ position:absolute; top:3px; left:3px; width:18px; height:18px;
  border-radius:50%; background:var(--bone); transition:transform .2s ease; }
.pt-toggle.is-on .pt-toggle-knob{ transform:translateX(18px); background:var(--ink); }

.pt-swatches{ display:flex; gap:9px; margin-bottom:13px; }
.pt-swatch-btn{ width:30px; height:30px; border-radius:50%; background:var(--s);
  opacity:.42; transition:all .18s ease; border:2px solid transparent; }
.pt-swatch-btn:hover{ opacity:.75; }
.pt-swatch-btn.is-on{ opacity:1; border-color:var(--bone); box-shadow:0 0 16px var(--s); }
.pt-seg{ display:flex; gap:6px; }
.pt-seg-btn{ flex:1; padding:9px 4px; border-radius:8px; background:var(--slate);
  border:1px solid var(--line); font-size:12px; color:var(--mist); transition:all .18s ease; }
.pt-seg-btn.is-on{ background:var(--raise); border-color:var(--bone); color:var(--bone); }
.pt-legend-try{ margin-left:auto; font-family:'DM Mono',monospace; font-size:9.5px;
  letter-spacing:.12em; text-transform:uppercase; color:#485862; }
.pt-legend-row:hover .pt-legend-try{ color:var(--glow); }

/* share */
.pt-modal{ position:fixed; inset:0; background:rgba(8,12,15,.82); backdrop-filter:blur(6px);
  display:flex; align-items:center; justify-content:center; padding:22px; z-index:50; }
.pt-modal-inner{ width:100%; max-width:330px; position:relative; }
.pt-modal-x{ position:absolute; top:-34px; right:0; color:var(--mist); }
.pt-card{ background:linear-gradient(165deg,#1B262E,#101A1F); border:1px solid var(--line);
  border-radius:19px; padding:34px 26px 26px; text-align:center; position:relative;
  overflow:hidden; }
.pt-card-glow{ position:absolute; top:-56px; left:50%; transform:translateX(-50%);
  width:190px; height:112px; background:var(--k); filter:blur(48px); opacity:.42; }
.pt-card-kicker{ position:relative; font-family:'DM Mono',monospace; font-size:10px;
  letter-spacing:.16em; text-transform:uppercase; color:var(--k); margin:0 0 14px; }
.pt-card-big{ position:relative; font-family:'Fraunces',serif; font-size:80px;
  line-height:.92; margin:0 0 16px; font-weight:400; letter-spacing:-0.04em; }
.pt-card-line{ position:relative; font-size:14px; line-height:1.55; color:var(--bone);
  margin:0 0 26px; }
.pt-card-mark{ position:relative; font-family:'Fraunces',serif; font-size:11.5px;
  color:var(--mist); margin:0; }
.pt-modal-hint{ text-align:center; font-size:12px; color:var(--mist); margin:15px 0 12px; }

@media (prefers-reduced-motion:reduce){
  .pt-root *{ animation:none !important; transition:none !important; }
}
    `}</style>
  );
}
