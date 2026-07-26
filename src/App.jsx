import React, { useState, useEffect, useMemo } from "react";
import { Plus, X, Share2, Check, Trash2, ChevronLeft } from "lucide-react";

/* ============================================================================
   BOND

   ── PASTE YOUR TALLY LINK HERE ────────────────────────────────────────────
   Replace the empty quotes below with the share link Tally gives you, e.g.
       const WAITLIST_URL = "https://tally.so/r/abc123";
   Until you do, the waitlist card stays hidden. Nothing else breaks.
   ------------------------------------------------------------------------- */
const WAITLIST_URL = "";
/* ------------------------------------------------------------------------- */

/*  The engine below is unchanged and tested. Anchors it must hold:
      dog @1y = 31.000    cat @10y = 56.000    opossum @3.5y = 78.000
    Don't edit it without re-checking those three.                           */

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

const juvenile = (age, tMat, hMat) =>
  age <= 0 ? 0 : hMat * Math.pow(age / tMat, JUVENILE_EXPONENT);

function humanAge(pet, ageYears) {
  const sp = SPECIES[pet.species];
  const a = Math.max(0, ageYears);
  if (sp.tier === 1) {
    const life = DOG_BREEDS[pet.breed] || 12;
    const aeq = a * (12 / life);
    return aeq < 1 ? juvenile(aeq, 1, 31) : 16 * Math.log(aeq) + 31;
  }
  if (sp.tier === 2) {
    const life = CAT_LIFESTYLES[pet.lifestyle] || 15;
    const aeq = a * (15 / life);
    if (aeq <= 1) return 15 * aeq;
    if (aeq <= 2) return 15 + 9 * (aeq - 1);
    return 24 + 4 * (aeq - 2);
  }
  const A = (HUMAN_LIFESPAN - HUMAN_MATURITY) / Math.log(sp.life / sp.mat);
  const B = HUMAN_MATURITY - A * Math.log(sp.mat);
  return a < sp.mat ? juvenile(a, sp.mat, HUMAN_MATURITY) : A * Math.log(a) + B;
}

function agingRate(pet, ageYears) {
  const h = 1e-4, lo = Math.max(1e-6, ageYears - h), hi = ageYears + h;
  return (humanAge(pet, hi) - humanAge(pet, lo)) / (hi - lo);
}

const petLifespan = (pet) => {
  const sp = SPECIES[pet.species];
  if (sp.tier === 1) return DOG_BREEDS[pet.breed] || 12;
  if (sp.tier === 2) return CAT_LIFESTYLES[pet.lifestyle] || 15;
  return sp.life;
};

function lifeStage(pet, ageYears) {
  const table = SPECIES[pet.species].stages || GENERIC_STAGES;
  const frac = ageYears / petLifespan(pet);
  let label = table[0][1];
  for (const [t, n] of table) if (frac >= t) label = n;
  return label;
}

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

/* A puppy gains ~57 human years per year; a senior dog about one. A fixed
   "every human year" rule would spam year one and go quiet exactly when the
   owner most wants to hear from us. So the step adapts to hold ~8 a year. */
const STEP_LADDER = [1, 2, 5, 10, 20, 25];
const TARGET_EVENTS_PER_YEAR = 8;

function milestoneStep(pet, ageYears) {
  const rate = agingRate(pet, Math.max(ageYears, 0.02));
  for (const s of STEP_LADDER) if (rate / s <= TARGET_EVENTS_PER_YEAR * 1.5) return s;
  return STEP_LADDER[STEP_LADDER.length - 1];
}

const KIND = {
  milestone: { label: "Milestone",   hex: "#CE9A34", glow: "Brass",  pattern: "Slow breathing pulse" },
  decade:    { label: "Decade",      hex: "#B04A2C", glow: "Rust",   pattern: "Bright rise, long hold" },
  birthday:  { label: "Birthday",    hex: "#B8749B", glow: "Orchid", pattern: "Colour cycle, 3 minutes" },
  stage:     { label: "New chapter", hex: "#7BA3B5", glow: "Slate",  pattern: "Two soft sweeps" },
};

const NIGHT_COLORS = [
  { key: "green", name: "Green", hex: "#5FCF88" },
  { key: "brass", name: "Brass", hex: "#CE9A34" },
  { key: "cyan",  name: "Cyan",  hex: "#54C0DE" },
  { key: "red",   name: "Red",   hex: "#E05555" },
  { key: "white", name: "White", hex: "#F2EEE2" },
];
const NIGHT_PATTERNS = [
  { key: "steady", name: "Steady",     hours: 9 },
  { key: "slow",   name: "Slow blink", hours: 22 },
  { key: "fast",   name: "Fast blink", hours: 16 },
];
const DEFAULT_COLLAR = { nightOn: false, nightColor: "green", nightPattern: "slow", milestoneOn: true };

function generateMilestones(pet, fromDate, toDate) {
  const birth = new Date(pet.birthday).getTime();
  const ageAt = (t) => (t - birth) / MS_YEAR;
  const out = [];
  const a0 = ageAt(fromDate.getTime()), a1 = ageAt(toDate.getTime());
  if (a1 <= 0) return out;

  const h0 = humanAge(pet, Math.max(a0, 0)), h1 = humanAge(pet, a1);
  let step = milestoneStep(pet, Math.max(a0, 0.02));
  let m = Math.floor(h0 / step) * step + step;
  let guard = 0;
  while (m <= h1 && guard++ < 400) {
    const pa = ageAtHumanAge(pet, m);
    if (pa != null) {
      const when = new Date(birth + pa * MS_YEAR);
      if (when >= fromDate && when < toDate)
        out.push({ when, kind: m % 10 === 0 ? "decade" : "milestone", value: m,
                   title: `${pet.name} turns ${m}` });
    }
    const pa2 = ageAtHumanAge(pet, m + step);
    if (pa2 != null) { step = milestoneStep(pet, pa2); m = Math.floor(m / step) * step + step; }
    else m += step;
  }

  const b = new Date(pet.birthday);
  for (let y = fromDate.getFullYear(); y <= toDate.getFullYear(); y++) {
    const bd = new Date(y, b.getMonth(), b.getDate());
    if (bd >= fromDate && bd < toDate && bd.getTime() > birth)
      out.push({ when: bd, kind: "birthday", value: y - b.getFullYear(),
                 title: `${pet.name}'s ${ordinal(y - b.getFullYear())} birthday` });
  }

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

const ordinal = (n) => (n % 100 >= 10 && n % 100 <= 20)
  ? n + "th" : n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
const article = (w) => ("aeiou".includes(w[0].toLowerCase()) ? "an" : "a");

function fmtAge(years) {
  const y = Math.floor(years), m = Math.floor((years - y) * 12);
  if (y === 0) return `${m} month${m === 1 ? "" : "s"} old`;
  return `${y} yr${y === 1 ? "" : "s"} ${m} mo`;
}

function fmtLeft(ms) {
  if (ms < 0) return "today";
  const d = Math.floor(ms / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 45) return `${d} days away`;
  const mo = Math.round(d / 30.44);
  return `${mo} month${mo === 1 ? "" : "s"} away`;
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
      } catch { /* first visit */ }
      if (!alive) return;
      setPets(loaded);
      setActiveId(loaded[0]?.id ?? null);
      setView(loaded.length ? "home" : "empty");
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const persist = async (next) => {
    setPets(next);
    try { await window.storage.set(STORE_KEY, JSON.stringify(next)); } catch {}
  };

  const addPet = async (pet) => {
    await persist([...pets, pet]);
    setActiveId(pet.id);
    setView("home");
  };
  const updatePet = (id, patch) =>
    persist(pets.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const removePet = async (id) => {
    const next = pets.filter((p) => p.id !== id);
    await persist(next);
    setActiveId(next[0]?.id ?? null);
    setView(next.length ? "home" : "empty");
  };

  const active = pets.find((p) => p.id === activeId) || null;

  return (
    <div className="bd">
      <Styles />
      <div className="bd-page">
        <Header pets={pets} activeId={activeId} onPick={setActiveId}
          onAdd={() => setView("add")} showPets={view === "home"} />

        {view === "loading" && <p className="bd-quiet">One moment.</p>}
        {view === "empty" && <Welcome onAdd={() => setView("add")} />}
        {view === "add" && <AddPet onCancel={() => setView(pets.length ? "home" : "empty")} onSave={addPet} />}
        {view === "home" && active && (
          <Home pet={active} now={now} onShare={setShareFor}
            onRemove={removePet} onUpdate={updatePet} />
        )}
      </div>
      {shareFor && <ShareSheet {...shareFor} onClose={() => setShareFor(null)} />}
    </div>
  );
}

/* ========================================================================== */

function Header({ pets, activeId, onPick, onAdd, showPets }) {
  return (
    <header className="bd-head">
      <span className="bd-logo">Bond</span>
      {showPets && (
        <nav className="bd-pets" aria-label="Your pets">
          {pets.map((p) => (
            <button key={p.id} onClick={() => onPick(p.id)}
              className={"bd-pet" + (p.id === activeId ? " on" : "")}>
              {p.name}
            </button>
          ))}
          <button className="bd-pet bd-pet-add" onClick={onAdd} aria-label="Add a pet">
            <Plus size={13} strokeWidth={2.5} />
          </button>
        </nav>
      )}
    </header>
  );
}

/* --- The landing page ----------------------------------------------------
   The app is free and always will be. The collar is the product. So this
   screen sells the collar and offers the app as proof the idea works —
   not the other way round. */

function Welcome({ onAdd }) {
  return (
    <div className="bd-welcome">
      <p className="bd-eyebrow">A collar that celebrates on their clock</p>
      <h1 className="bd-display">
        Your dog turns fifty<br />next Tuesday.
      </h1>
      <p className="bd-lede">
        Nobody tells you. A dog is already 31 at their first birthday, and after
        that they gain four of our years every twelve months. Bond is a collar
        that <b>lights up on the evening they reach one</b> — so the day doesn't
        pass without anyone noticing.
      </p>

      <Want line="Want one? Tell me where to email you." />

      <p className="bd-or">
        Or work out your own pet's age first — free, no sign-up, takes ten seconds.
      </p>
      <button className="bd-btn bd-btn-quiet" onClick={onAdd}>Try it with my pet</button>

      <ol className="bd-how">
        <li>
          <h3>It glows on the day</h3>
          <p>Three hours from dusk, on your pet's neck, in a colour that tells you
             which kind of day it is. Everyone at the park sees it.</p>
        </li>
        <li>
          <h3>The rest of the year it's a safety light</h3>
          <p>Rechargeable, five colours, steady or blinking. The reason it stays on
             the dog for the 360 days that aren't milestones.</p>
        </li>
        <li>
          <h3>Your phone does the thinking</h3>
          <p>The free app works out the year ahead and hands the collar a short list
             of dates. No subscription, ever. Nothing to pay after you buy it.</p>
        </li>
      </ol>

      <div className="bd-facts">
        <h2 className="bd-label">The collar</h2>
        <dl>
          <div><dt>Price</dt><dd>$89, shipping included</dd></div>
          <div><dt>First run</dt><dd>250 collars</dd></div>
          <div><dt>Ships</dt><dd>March 2027</dd></div>
          <div><dt>Subscription</dt><dd>None. Not now, not later.</dd></div>
          <div><dt>Sizes</dt><dd>Small, medium, large</dd></div>
        </dl>
        <p className="bd-fine">
          I'm one person making these. Nothing is charged today — the form just tells
          me you're interested and gets you the email when they're ready to order.
        </p>
      </div>

      <div className="bd-credible">
        <h2 className="bd-label">Not the seven-year thing</h2>
        <p>
          Multiplying by seven has no scientific basis — it seems to have started as a
          1950s marketing line to get people booking annual check-ups. Bond uses the
          2020 epigenetic clock from UC San Diego, built by reading DNA methylation in
          104 Labradors, and the 2021 AAHA/AAFP veterinary guidelines for cats. Ten
          other species are modelled from published longevity data and clearly labelled
          as estimates.
        </p>
      </div>

      <Want line="Still here? Then you probably want one." />
    </div>
  );
}

/* The ask, stated plainly, more than once. */
function Want({ line }) {
  if (!WAITLIST_URL) {
    return (
      <div className="bd-want bd-want-off">
        <p><b>Waitlist not connected yet.</b> Paste your Tally link into
        <code> WAITLIST_URL</code> at the top of App.jsx and this becomes the button.</p>
      </div>
    );
  }
  return (
    <div className="bd-want">
      <p className="bd-want-line">{line}</p>
      <a className="bd-btn" href={WAITLIST_URL} target="_blank" rel="noreferrer">
        Yes — email me when the collar's ready
      </a>
      <p className="bd-want-fine">$89 · ships March 2027 · nothing charged today</p>
    </div>
  );
}

/* --- SIGNATURE: the tag ---------------------------------------------------
   Not a dial — a dial belongs to a clock, and this isn't about clocks. It's
   about the thing that hangs on the animal's neck, with the number engraved
   on brass the way it will be on the real one. */

function Tag({ pet, human, stage }) {
  return (
    <div className="bd-tagwrap">
      <span className="bd-ring" aria-hidden="true" />
      <div className="bd-tag">
        <span className="bd-tag-hole" aria-hidden="true" />
        <p className="bd-tag-name">{pet.name}</p>
        <p className="bd-tag-num">{Math.floor(human)}</p>
        <p className="bd-tag-unit">{SPECIES[pet.species].name.toLowerCase()} years</p>
        <p className="bd-tag-stage">{stage}</p>
      </div>
    </div>
  );
}

function Home({ pet, now, onShare, onRemove, onUpdate }) {
  const birth = new Date(pet.birthday).getTime();
  const ageYears = (now - birth) / MS_YEAR;
  const human = humanAge(pet, ageYears);
  const stage = lifeStage(pet, ageYears);
  const rate = agingRate(pet, ageYears);
  const sp = SPECIES[pet.species];

  const year = useMemo(
    () => generateMilestones(pet, new Date(now), new Date(now + MS_YEAR)),
    [pet.id, pet.birthday, pet.species, pet.breed, pet.lifestyle, Math.floor(now / 3600000)]
  );

  const detail = pet.species === "dog" ? pet.breed
    : pet.species === "cat" ? `${pet.lifestyle.replace("_", " and ")} cat`
    : sp.name.toLowerCase();

  return (
    <main>
      <Tag pet={pet} human={human} stage={stage} />

      <p className="bd-sub">
        {detail} · {fmtAge(ageYears)}
        {pet.estimate && <em className="bd-mark">estimated</em>}
        {sp.tier === 3 && <em className="bd-mark">modelled</em>}
      </p>
      <p className="bd-rate">
        Gaining <b>{rate < 1 ? rate.toFixed(1) : Math.round(rate)}</b> years for every one of ours
      </p>

      <Strap milestones={year} now={now} onShare={(m) => onShare({ pet, m })} />

      <Collar pet={pet} onUpdate={onUpdate} />

      <div className="bd-pitch">
        <p className="bd-pitch-lead">
          {year.length > 0
            ? <>That's <b>{year.length} evening{year.length === 1 ? "" : "s"}</b> in the next
               twelve months when {pet.name} reaches something. The collar lights up on every
               one of them.</>
            : <>The collar lights up on the evening {pet.name} reaches a milestone.</>}
        </p>
        <Want line="Want one for them?" />
      </div>

      <button className="bd-remove" onClick={() => {
        if (window.confirm(`Remove ${pet.name}? Their timeline is cleared from this device.`))
          onRemove(pet.id);
      }}>
        <Trash2 size={12} /> Remove {pet.name}
      </button>
    </main>
  );
}

/* --- The strap ------------------------------------------------------------
   The timeline is shaped like the product: a webbing strap running down the
   page with one brass eyelet per celebration. Structure that means something
   rather than structure that decorates. */

function Strap({ milestones, now, onShare }) {
  if (!milestones.length) {
    return (
      <section className="bd-block">
        <h2 className="bd-label">The year ahead</h2>
        <p className="bd-quiet">
          Nothing in the next twelve months — that happens with very young pets.
          Check back in a few weeks.
        </p>
      </section>
    );
  }
  return (
    <section className="bd-block">
      <h2 className="bd-label">
        The year ahead <span className="bd-count">{milestones.length} to mark</span>
      </h2>
      <ol className="bd-strap">
        {milestones.map((m, i) => {
          const k = KIND[m.kind];
          const first = i === 0;
          return (
            <li key={i} className={"bd-node" + (first ? " next" : "")}>
              <span className="bd-eyelet" style={{ "--k": k.hex }} aria-hidden="true" />
              <div className="bd-node-body">
                <p className="bd-node-title">{m.title}</p>
                <p className="bd-node-meta">
                  <span style={{ color: k.hex }}>{k.label}</span> · {fmtDate(m.when)}
                  {first && <> · <b>{fmtLeft(m.when.getTime() - now)}</b></>}
                </p>
                {first && (
                  <div className="bd-preview" style={{ "--k": k.hex }} aria-hidden="true"><span /></div>
                )}
              </div>
              <button className="bd-share" onClick={() => onShare(m)}
                aria-label={`Share: ${m.title}`}><Share2 size={13} /></button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* --- Collar ---------------------------------------------------------------
   Two jobs. Night light is why it stays on the dog the other 360 days.
   Milestone glow is why anyone buys it. */

function Collar({ pet, onUpdate }) {
  const c = { ...DEFAULT_COLLAR, ...(pet.collar || {}) };
  const [test, setTest] = useState(null);
  const set = (patch) => onUpdate(pet.id, { collar: { ...c, ...patch } });

  const nightHex = NIGHT_COLORS.find((n) => n.key === c.nightColor)?.hex || "#5FCF88";
  const pattern = NIGHT_PATTERNS.find((n) => n.key === c.nightPattern) || NIGHT_PATTERNS[1];
  const run = (hex, cls) => { setTest({ hex, cls }); setTimeout(() => setTest(null), 3000); };
  const life = c.nightOn ? `${pattern.hours} hrs a charge` : "60 days a charge";

  return (
    <section className="bd-block">
      <h2 className="bd-label">The collar <span className="bd-count">{life}</span></h2>

      <div className={"bd-band" + (test ? " t " + test.cls : "")}
        style={{ "--k": test ? test.hex : nightHex }} aria-hidden="true"><span /></div>

      <div className="bd-row">
        <div>
          <p className="bd-row-name">Night light</p>
          <p className="bd-row-sub">You turn it on. Stays on till you turn it off.</p>
        </div>
        <Toggle on={c.nightOn} onChange={() => set({ nightOn: !c.nightOn })} label="Night light" />
      </div>

      {c.nightOn && (
        <div className="bd-open">
          <div className="bd-dots">
            {NIGHT_COLORS.map((n) => (
              <button key={n.key} style={{ "--s": n.hex }}
                className={"bd-dot" + (c.nightColor === n.key ? " on" : "")}
                onClick={() => { set({ nightColor: n.key }); run(n.hex, "steady"); }}
                aria-label={n.name} title={n.name} />
            ))}
          </div>
          <div className="bd-seg">
            {NIGHT_PATTERNS.map((n) => (
              <button key={n.key}
                className={"bd-seg-b" + (c.nightPattern === n.key ? " on" : "")}
                onClick={() => { set({ nightPattern: n.key }); run(nightHex, n.key); }}>
                {n.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bd-row">
        <div>
          <p className="bd-row-name">Milestone glow</p>
          <p className="bd-row-sub">Three hours from dusk, on the day. Nothing to set.</p>
        </div>
        <Toggle on={c.milestoneOn} onChange={() => set({ milestoneOn: !c.milestoneOn })} label="Milestone glow" />
      </div>

      {c.milestoneOn && (
        <div className="bd-open">
          {Object.entries(KIND).map(([k, v]) => (
            <button key={k} className="bd-legend" onClick={() => run(v.hex, "breathe")}>
              <span className="bd-chip" style={{ background: v.hex }} />
              <span className="bd-legend-a">{v.label}</span>
              <span className="bd-legend-b">{v.pattern}</span>
              <span className="bd-try">see it</span>
            </button>
          ))}
        </div>
      )}

      <p className="bd-fine bd-fine-top">
        Your phone works out the year ahead and passes the collar a short list of dates.
        It keeps going for months with your phone switched off.
      </p>
    </section>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <button className={"bd-toggle" + (on ? " on" : "")} onClick={onChange}
      role="switch" aria-checked={on} aria-label={label}><span /></button>
  );
}

/* --- Add a pet ------------------------------------------------------------ */

function AddPet({ onCancel, onSave }) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("dog");
  const [breed, setBreed] = useState("Mixed — medium (20–55 lb)");
  const [lifestyle, setLifestyle] = useState("indoor");
  const [birthday, setBirthday] = useState("");
  const [estimate, setEstimate] = useState(false);

  const sp = SPECIES[species];
  const ok = name.trim() && birthday && new Date(birthday) <= new Date();

  return (
    <div className="bd-form">
      <button className="bd-back" onClick={onCancel}><ChevronLeft size={15} /> Back</button>
      <h1 className="bd-display bd-display-sm">Who are we<br />keeping time for?</h1>

      <label className="bd-f">
        <span className="bd-label">Their name</span>
        <input className="bd-in" value={name} maxLength={24} autoFocus
          onChange={(e) => setName(e.target.value)} placeholder="Cooper" />
      </label>

      <div className="bd-f">
        <span className="bd-label">What are they</span>
        <div className="bd-grid">
          {Object.entries(SPECIES).map(([k, s]) => (
            <button key={k} onClick={() => setSpecies(k)}
              className={"bd-opt" + (species === k ? " on" : "")}>
              {s.name}{s.tier === 3 && <em>est</em>}
            </button>
          ))}
        </div>
      </div>

      {species === "dog" && (
        <label className="bd-f">
          <span className="bd-label">Breed</span>
          <select className="bd-in" value={breed} onChange={(e) => setBreed(e.target.value)}>
            {Object.keys(DOG_BREEDS).map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <span className="bd-hint">A Great Dane ages nearly twice as fast as a chihuahua.</span>
        </label>
      )}

      {species === "cat" && (
        <div className="bd-f">
          <span className="bd-label">Where they live</span>
          <div className="bd-grid">
            {[["indoor","Indoors"],["indoor_outdoor","Both"],["outdoor","Outdoors"]].map(([k, l]) => (
              <button key={k} onClick={() => setLifestyle(k)}
                className={"bd-opt" + (lifestyle === k ? " on" : "")}>{l}</button>
            ))}
          </div>
          <span className="bd-hint">The single biggest factor in how long a cat lives.</span>
        </div>
      )}

      <label className="bd-f">
        <span className="bd-label">Date of birth</span>
        <input className="bd-in" type="date" value={birthday}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirthday(e.target.value)} />
      </label>

      <button className={"bd-check" + (estimate ? " on" : "")} onClick={() => setEstimate(!estimate)}>
        <span>{estimate && <Check size={11} strokeWidth={3.5} />}</span>
        It's a guess — they were adopted
      </button>

      {sp.exotic && (
        <p className="bd-note">
          Keeping {sp.name.toLowerCase()}s is restricted or illegal in many states.
          Worth checking your local rules.
        </p>
      )}
      {sp.tier === 3 && (
        <p className="bd-note bd-note-soft">
          No ageing clock has been published for {sp.name.toLowerCase()}s, so we model it from
          maturity and lifespan data and call it an estimate. For dogs and cats we use the
          peer-reviewed research.
        </p>
      )}

      <button className="bd-btn" disabled={!ok}
        onClick={() => ok && onSave({
          id: String(Date.now()), name: name.trim(), species, birthday, estimate,
          breed: species === "dog" ? breed : null,
          lifestyle: species === "cat" ? lifestyle : null,
          collar: { ...DEFAULT_COLLAR },
        })}>
        Start keeping time
      </button>
    </div>
  );
}

/* --- Share --------------------------------------------------------------- */

function ShareSheet({ pet, m, onClose }) {
  const k = KIND[m.kind];
  const [copied, setCopied] = useState(false);
  const line = m.kind === "birthday" ? `${pet.name} is ${m.value} today.`
    : m.kind === "stage" ? `${m.title}.`
    : `${pet.name} is ${m.value} today — in ${SPECIES[pet.species].name.toLowerCase()} years.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  return (
    <div className="bd-modal" onClick={onClose}>
      <div className="bd-modal-in" onClick={(e) => e.stopPropagation()}>
        <button className="bd-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <div className="bd-card" style={{ "--k": k.hex }}>
          <span className="bd-card-glow" aria-hidden="true" />
          <p className="bd-card-top">{fmtDate(m.when)}</p>
          <p className="bd-card-big">{m.value}</p>
          <p className="bd-card-line">{line}</p>
          <p className="bd-card-foot">Bond</p>
        </div>
        <p className="bd-fine bd-center">Screenshot the card, or copy the words.</p>
        <button className="bd-btn" onClick={copy}>
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
@import url('https://fonts.googleapis.com/css2?family=Petrona:ital,wght@0,400;0,500;0,600;1,400&family=Karla:wght@400;500;600&family=Azeret+Mono:wght@400;500&display=swap');

/* Dusk in a park, and the brass on a collar. Deep green rather than black:
   black is a default, this is a choice about where dogs actually are at 8pm. */
.bd{
  --moss:#16241D; --pine:#1E3128; --bark:#2A3F34; --lichen:#87988C;
  --oat:#EAE4D5; --brass:#CE9A34; --rust:#B04A2C; --dim:#6E8073;
  background:var(--moss); color:var(--oat); min-height:100vh; width:100%;
  font-family:'Karla',system-ui,sans-serif; -webkit-font-smoothing:antialiased;
  padding-bottom:56px;
}
.bd *,.bd *::before,.bd *::after{ box-sizing:border-box; }
.bd-page{ max-width:452px; margin:0 auto; padding:0 21px; }
.bd button{ font-family:inherit; cursor:pointer; border:none; background:none; color:inherit; }
.bd button:focus-visible,.bd input:focus-visible,.bd select:focus-visible,.bd a:focus-visible{
  outline:2px solid var(--brass); outline-offset:3px; border-radius:3px; }

/* type */
.bd-display{ font-family:'Petrona',Georgia,serif; font-weight:400; font-size:30px;
  line-height:1.24; letter-spacing:-0.012em; margin:0 0 16px; }
.bd-display-sm{ font-size:26px; margin-bottom:26px; }
.bd-eyebrow{ font-family:'Azeret Mono',monospace; font-size:10px; letter-spacing:.15em;
  text-transform:uppercase; color:var(--brass); margin:0 0 15px; }
.bd-lede{ font-size:15px; line-height:1.62; color:var(--lichen); margin:0 0 26px; }
.bd-label{ display:flex; justify-content:space-between; align-items:baseline;
  font-family:'Azeret Mono',monospace; font-size:10px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--lichen); font-weight:400; margin:0 0 13px; }
.bd-count{ letter-spacing:.03em; text-transform:none; color:var(--brass); }
.bd-fine{ font-size:12px; line-height:1.6; color:var(--dim); margin:13px 0 0; }
.bd-fine-top{ padding-top:15px; border-top:1px solid var(--bark); }
.bd-center{ text-align:center; }
.bd-quiet{ font-size:14px; color:var(--lichen); line-height:1.6; margin:0; }
.bd-hint{ display:block; font-size:11.5px; color:var(--dim); margin-top:7px; line-height:1.5; }

/* header */
.bd-head{ padding:26px 0 22px; }
.bd-logo{ font-family:'Petrona',serif; font-size:20px; font-weight:600; letter-spacing:-0.02em; }
.bd-pets{ display:flex; gap:6px; flex-wrap:wrap; margin-top:17px; }
.bd-pet{ padding:6px 13px; border-radius:99px; border:1px solid var(--bark);
  font-size:12.5px; color:var(--lichen); transition:.16s ease; }
.bd-pet:hover{ border-color:var(--lichen); }
.bd-pet.on{ background:var(--oat); color:var(--moss); border-color:var(--oat); font-weight:600; }
.bd-pet-add{ display:flex; align-items:center; padding:6px 10px; }

.bd-welcome{ padding:30px 0; }
.bd-lede b{ color:var(--oat); font-weight:600; }
.bd-or{ text-align:center; font-size:13px; color:var(--lichen); margin:26px 0 11px; line-height:1.55; }

/* the ask */
.bd-want{ background:var(--pine); border:1px solid var(--bark); border-radius:14px;
  padding:20px; margin:4px 0; }
.bd-want-line{ font-family:'Petrona',serif; font-size:19px; font-weight:500;
  line-height:1.3; margin:0 0 15px; letter-spacing:-0.01em; }
.bd-want-fine{ text-align:center; font-family:'Azeret Mono',monospace; font-size:9.5px;
  letter-spacing:.09em; text-transform:uppercase; color:var(--dim); margin:12px 0 0; }
.bd-want-off{ border-style:dashed; border-color:var(--brass); }
.bd-want-off p{ font-size:12.5px; line-height:1.6; color:var(--brass); margin:0; }
.bd-want-off code{ font-family:'Azeret Mono',monospace; font-size:11px; }
a.bd-btn{ text-decoration:none; }
.bd-btn-quiet{ background:transparent; border:1px solid var(--bark); color:var(--oat);
  font-weight:500; }
.bd-btn-quiet:hover{ background:var(--pine); border-color:var(--lichen); }

/* how it works */
.bd-how{ list-style:none; margin:40px 0; padding:0; }
.bd-how li{ padding:0 0 22px 0; border-bottom:1px solid var(--bark); margin-bottom:22px; }
.bd-how li:last-child{ border-bottom:none; margin-bottom:0; padding-bottom:0; }
.bd-how h3{ font-family:'Petrona',serif; font-size:18px; font-weight:500; margin:0 0 7px;
  letter-spacing:-0.01em; }
.bd-how p{ font-size:13.5px; line-height:1.6; color:var(--lichen); margin:0; }

/* spec table */
.bd-facts{ margin:34px 0; }
.bd-facts dl{ margin:0 0 14px; }
.bd-facts dl>div{ display:flex; justify-content:space-between; gap:16px; padding:11px 0;
  border-bottom:1px solid var(--bark); }
.bd-facts dt{ font-size:13px; color:var(--lichen); }
.bd-facts dd{ font-size:13px; margin:0; text-align:right; }

.bd-credible{ margin:34px 0; }
.bd-credible p{ font-size:13px; line-height:1.65; color:var(--lichen); margin:0; }

/* in-app pitch */
.bd-pitch{ margin:0 0 30px; }
.bd-pitch-lead{ font-size:14px; line-height:1.6; color:var(--lichen); margin:0 0 15px; }
.bd-pitch-lead b{ color:var(--oat); font-weight:600; }

.bd-btn{ display:flex; align-items:center; justify-content:center; gap:7px; width:100%;
  padding:15px; border-radius:10px; background:var(--brass); color:#1B1405;
  font-size:14.5px; font-weight:600; transition:.16s ease; }
.bd-btn:hover{ background:#DEA83B; }
.bd-btn:disabled{ opacity:.3; cursor:not-allowed; }

/* SIGNATURE — the engraved tag */
.bd-tagwrap{ display:flex; flex-direction:column; align-items:center; padding:14px 0 4px; }
.bd-ring{ width:22px; height:22px; border-radius:50%; border:3px solid #8C7A4E;
  border-bottom-color:#6B5C39; margin-bottom:-11px; z-index:2; }
.bd-tag{ position:relative; width:206px; padding:30px 20px 22px; border-radius:22px;
  text-align:center;
  background:linear-gradient(157deg,#E5C374 0%,#C79A38 34%,#A97D26 68%,#D3B05C 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.45), inset 0 -2px 6px rgba(0,0,0,.28),
             0 14px 34px -12px rgba(0,0,0,.62); }
.bd-tag-hole{ position:absolute; top:11px; left:50%; transform:translateX(-50%);
  width:13px; height:13px; border-radius:50%; background:var(--moss);
  box-shadow:0 1px 1px rgba(255,255,255,.4); }
.bd-tag-name{ font-family:'Azeret Mono',monospace; font-size:10.5px; letter-spacing:.2em;
  text-transform:uppercase; color:#5E4715; margin:0 0 2px;
  text-shadow:0 1px 0 rgba(255,255,255,.32); }
.bd-tag-num{ font-family:'Petrona',serif; font-size:74px; line-height:.95; font-weight:500;
  color:#4A3810; margin:0; letter-spacing:-0.035em;
  text-shadow:0 1px 0 rgba(255,255,255,.36); }
.bd-tag-unit{ font-size:11.5px; color:#634C18; margin:3px 0 0; }
.bd-tag-stage{ font-family:'Azeret Mono',monospace; font-size:9px; letter-spacing:.17em;
  text-transform:uppercase; color:#5E4715; margin:12px 0 0; padding-top:10px;
  border-top:1px solid rgba(74,56,16,.24); }

.bd-sub{ text-align:center; font-size:13.5px; color:var(--lichen); margin:20px 0 5px; }
.bd-mark{ font-family:'Azeret Mono',monospace; font-style:normal; font-size:8.5px;
  letter-spacing:.11em; text-transform:uppercase; color:var(--brass);
  border:1px solid rgba(206,154,52,.34); border-radius:3px; padding:1px 5px; margin-left:7px; }
.bd-rate{ text-align:center; font-size:12.5px; color:var(--dim); margin:0 0 34px; }
.bd-rate b{ color:var(--oat); font-weight:600; }

.bd-block{ margin-bottom:34px; }

/* the strap — webbing with brass eyelets */
.bd-strap{ list-style:none; margin:0; padding:0; position:relative; }
.bd-strap::before{ content:''; position:absolute; left:11px; top:6px; bottom:16px; width:12px;
  border-radius:6px; background:
    repeating-linear-gradient(90deg,rgba(255,255,255,.045) 0 1px,transparent 1px 3px),
    linear-gradient(90deg,#25382E,#31483C 45%,#22352B); }
.bd-node{ position:relative; display:flex; gap:15px; padding:0 0 22px 41px; align-items:flex-start; }
.bd-eyelet{ position:absolute; left:8px; top:3px; width:18px; height:18px; border-radius:50%;
  background:var(--moss); border:3px solid var(--k);
  box-shadow:0 0 0 2px var(--moss), 0 0 10px -1px var(--k); }
.bd-node.next .bd-eyelet{ box-shadow:0 0 0 2px var(--moss), 0 0 18px 1px var(--k); }
.bd-node-body{ flex:1; min-width:0; }
.bd-node-title{ font-size:14.5px; margin:1px 0 3px; line-height:1.35; }
.bd-node.next .bd-node-title{ font-family:'Petrona',serif; font-size:19px; font-weight:500;
  letter-spacing:-0.01em; }
.bd-node-meta{ font-size:11.5px; color:var(--lichen); margin:0; }
.bd-node-meta b{ color:var(--oat); font-weight:600; }
.bd-preview{ height:6px; border-radius:99px; background:#101B15; overflow:hidden; margin-top:11px; }
.bd-preview>span{ display:block; height:100%; background:var(--k);
  animation:bd-breathe 3.4s ease-in-out infinite; }
.bd-share{ color:#5C6D61; padding:3px; margin-top:2px; transition:color .16s ease; }
.bd-share:hover{ color:var(--oat); }
@keyframes bd-breathe{ 0%,100%{opacity:.16} 50%{opacity:.92} }

/* collar controls */
.bd-band{ height:13px; border-radius:99px; background:#101B15; border:1px solid var(--bark);
  overflow:hidden; margin:0 0 6px; }
.bd-band>span{ display:block; height:100%; background:var(--k); opacity:.11; transition:opacity .3s; }
.bd-band.t>span{ box-shadow:0 0 20px var(--k); }
.bd-band.t.steady>span{ opacity:.95; }
.bd-band.t.breathe>span{ animation:bd-breathe 2.6s ease-in-out infinite; }
.bd-band.t.slow>span{ animation:bd-blink 1.4s steps(1) infinite; }
.bd-band.t.fast>span{ animation:bd-blink .42s steps(1) infinite; }
@keyframes bd-blink{ 0%,49%{opacity:.95} 50%,100%{opacity:.07} }

.bd-row{ display:flex; align-items:center; justify-content:space-between; gap:15px;
  padding:17px 0; border-bottom:1px solid var(--bark); }
.bd-row-name{ font-size:14.5px; margin:0 0 3px; }
.bd-row-sub{ font-size:11.5px; color:var(--lichen); margin:0; line-height:1.5; }
.bd-open{ padding:15px 0 18px; border-bottom:1px solid var(--bark); }
.bd-toggle{ width:44px; height:25px; border-radius:99px; background:var(--bark);
  position:relative; flex:none; transition:background .18s ease; }
.bd-toggle>span{ position:absolute; top:3px; left:3px; width:19px; height:19px;
  border-radius:50%; background:var(--lichen); transition:.18s ease; }
.bd-toggle.on{ background:var(--brass); }
.bd-toggle.on>span{ transform:translateX(19px); background:#1B1405; }

.bd-dots{ display:flex; gap:10px; margin-bottom:14px; }
.bd-dot{ width:31px; height:31px; border-radius:50%; background:var(--s); opacity:.36;
  border:2px solid transparent; transition:.16s ease; }
.bd-dot:hover{ opacity:.7; }
.bd-dot.on{ opacity:1; border-color:var(--oat); box-shadow:0 0 15px var(--s); }
.bd-seg{ display:flex; gap:6px; }
.bd-seg-b{ flex:1; padding:10px 4px; border-radius:8px; border:1px solid var(--bark);
  font-size:12px; color:var(--lichen); transition:.16s ease; }
.bd-seg-b.on{ background:var(--pine); border-color:var(--oat); color:var(--oat); }

.bd-legend{ display:flex; align-items:center; gap:11px; width:100%; text-align:left; padding:8px 0; }
.bd-chip{ width:9px; height:9px; border-radius:50%; flex:none; }
.bd-legend-a{ font-size:13px; width:92px; flex:none; }
.bd-legend-b{ font-size:11.5px; color:var(--lichen); }
.bd-try{ margin-left:auto; font-family:'Azeret Mono',monospace; font-size:9px;
  letter-spacing:.11em; text-transform:uppercase; color:#5C6D61; }
.bd-legend:hover .bd-try{ color:var(--brass); }

/* waitlist */
.bd-waitlist{ display:flex; align-items:center; gap:14px; justify-content:space-between;
  padding:18px; border-radius:13px; background:var(--pine); border:1px solid var(--bark);
  text-decoration:none; color:inherit; transition:.16s ease; margin-bottom:26px; }
.bd-waitlist:hover{ border-color:var(--brass); }
.bd-waitlist-txt{ font-size:12.5px; color:var(--lichen); line-height:1.5; }
.bd-waitlist strong{ display:block; font-family:'Petrona',serif; font-size:17px;
  font-weight:500; color:var(--oat); margin-bottom:3px; }
.bd-waitlist svg{ color:var(--brass); flex:none; }

.bd-remove{ display:flex; align-items:center; gap:6px; margin:0 auto; font-size:12px; color:#556655; }
.bd-remove:hover{ color:var(--rust); }

/* form */
.bd-form{ padding:4px 0 38px; }
.bd-back{ display:flex; align-items:center; gap:3px; font-size:13px; color:var(--lichen);
  margin-bottom:22px; }
.bd-f{ display:block; margin-bottom:23px; }
.bd-in{ width:100%; padding:13px; border-radius:9px; background:var(--pine);
  border:1px solid var(--bark); color:var(--oat); font-size:15px; font-family:inherit; }
.bd-in::placeholder{ color:#556655; }
.bd-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.bd-opt{ position:relative; padding:12px 5px; border-radius:8px; background:var(--pine);
  border:1px solid var(--bark); font-size:12.5px; color:var(--lichen); transition:.16s ease; }
.bd-opt:hover{ border-color:var(--lichen); }
.bd-opt.on{ background:var(--bark); border-color:var(--oat); color:var(--oat); font-weight:500; }
.bd-opt em{ position:absolute; top:3px; right:5px; font-style:normal; font-size:7.5px;
  letter-spacing:.08em; text-transform:uppercase; color:var(--brass); opacity:.7; }
.bd-check{ display:flex; align-items:center; gap:10px; font-size:13.5px; color:var(--lichen);
  margin-bottom:21px; }
.bd-check>span{ width:18px; height:18px; border-radius:5px; border:1px solid var(--bark);
  display:flex; align-items:center; justify-content:center; flex:none; }
.bd-check.on>span{ background:var(--brass); border-color:var(--brass); color:#1B1405; }
.bd-note{ font-size:12.5px; line-height:1.6; color:var(--brass); background:rgba(206,154,52,.07);
  border-left:2px solid var(--brass); padding:12px 14px; border-radius:0 8px 8px 0; margin:0 0 19px; }
.bd-note-soft{ color:var(--lichen); border-left-color:var(--bark); background:rgba(255,255,255,.022); }

/* share */
.bd-modal{ position:fixed; inset:0; background:rgba(9,16,12,.84); backdrop-filter:blur(7px);
  display:flex; align-items:center; justify-content:center; padding:22px; z-index:60; }
.bd-modal-in{ width:100%; max-width:328px; position:relative; }
.bd-x{ position:absolute; top:-34px; right:0; color:var(--lichen); }
.bd-card{ position:relative; overflow:hidden; text-align:center; border-radius:19px;
  padding:34px 24px 24px; background:linear-gradient(163deg,#22362C,#141F19);
  border:1px solid var(--bark); }
.bd-card-glow{ position:absolute; top:-58px; left:50%; transform:translateX(-50%);
  width:186px; height:112px; background:var(--k); filter:blur(46px); opacity:.4; }
.bd-card-top{ position:relative; font-family:'Azeret Mono',monospace; font-size:9.5px;
  letter-spacing:.16em; text-transform:uppercase; color:var(--k); margin:0 0 13px; }
.bd-card-big{ position:relative; font-family:'Petrona',serif; font-size:78px; line-height:.92;
  font-weight:500; margin:0 0 15px; letter-spacing:-0.04em; }
.bd-card-line{ position:relative; font-size:14px; line-height:1.55; margin:0 0 25px; }
.bd-card-foot{ position:relative; font-family:'Petrona',serif; font-size:12px; font-weight:600;
  color:var(--lichen); margin:0; }

@media (prefers-reduced-motion:reduce){ .bd *{ animation:none !important; transition:none !important; } }
    `}</style>
  );
}
