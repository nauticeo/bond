import React, { useState, useEffect, useMemo } from "react";
import { Plus, X, Share2, Check, Trash2, ChevronLeft, ArrowRight, Minus } from "lucide-react";

/* ============================================================================
   BOND

   ── PASTE YOUR TALLY LINK HERE ────────────────────────────────────────────
       const WAITLIST_URL = "https://tally.so/r/abc123";
   Until you do, every "Get the collar" button shows a note to you instead.
   ------------------------------------------------------------------------- */
const WAITLIST_URL = "";
const CONTACT_EMAIL = "hello@bondcollar.com";
/* ------------------------------------------------------------------------- */

/*  Engine — unchanged and tested. Anchors it must hold:
      dog @1y = 31.000    cat @10y = 56.000    opossum @3.5y = 78.000        */

const HUMAN_MATURITY = 22.0, HUMAN_LIFESPAN = 78.0, JUVENILE_EXPONENT = 1.85;
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

const juvenile = (age, tMat, hMat) => age <= 0 ? 0 : hMat * Math.pow(age / tMat, JUVENILE_EXPONENT);

function humanAge(pet, ageYears) {
  const sp = SPECIES[pet.species];
  const a = Math.max(0, ageYears);
  if (sp.tier === 1) {
    const aeq = a * (12 / (DOG_BREEDS[pet.breed] || 12));
    return aeq < 1 ? juvenile(aeq, 1, 31) : 16 * Math.log(aeq) + 31;
  }
  if (sp.tier === 2) {
    const aeq = a * (15 / (CAT_LIFESTYLES[pet.lifestyle] || 15));
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

const STEP_LADDER = [1, 2, 5, 10, 20, 25], TARGET_EVENTS_PER_YEAR = 8;
function milestoneStep(pet, ageYears) {
  const rate = agingRate(pet, Math.max(ageYears, 0.02));
  for (const s of STEP_LADDER) if (rate / s <= TARGET_EVENTS_PER_YEAR * 1.5) return s;
  return STEP_LADDER[STEP_LADDER.length - 1];
}

/* The four kinds of day. Plain-English meanings — these strings appear on the
   landing page AND in the app, so a person meets the colour language before
   they ever see a coloured dot. */
const KIND = {
  milestone: { name: "Milestone",  hex: "#D9A441", light: "#B8862C",
               plain: "A new number on their clock",
               detail: "The everyday one. A dog gets about five a year.",
               pattern: "Slow breathing pulse, three hours from dusk" },
  decade:    { name: "Big number", hex: "#C4573A", light: "#A6432A",
               plain: "A round number — 50th, 60th, 70th",
               detail: "Rarer, and worth a bigger fuss.",
               pattern: "Bright rise, then holds" },
  birthday:  { name: "Birthday",   hex: "#B87BA4", light: "#9A5C86",
               plain: "The actual date they were born",
               detail: "Once a year, same as yours.",
               pattern: "Slow colour cycle for three minutes" },
  stage:     { name: "Life stage", hex: "#6F9DB2", light: "#4E7E94",
               plain: "Puppy to adult, adult to senior",
               detail: "Only a handful in a whole life. Worth telling your vet.",
               pattern: "Two slow sweeps" },
};

const NIGHT_COLORS = [
  { key: "green", name: "Green", hex: "#5FCF88" },
  { key: "brass", name: "Brass", hex: "#D9A441" },
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
  const out = [];
  const a0 = (fromDate.getTime() - birth) / MS_YEAR, a1 = (toDate.getTime() - birth) / MS_YEAR;
  if (a1 <= 0) return out;

  const h0 = humanAge(pet, Math.max(a0, 0)), h1 = humanAge(pet, a1);
  let step = milestoneStep(pet, Math.max(a0, 0.02));
  let m = Math.floor(h0 / step) * step + step, guard = 0;
  while (m <= h1 && guard++ < 400) {
    const pa = ageAtHumanAge(pet, m);
    if (pa != null) {
      const when = new Date(birth + pa * MS_YEAR);
      if (when >= fromDate && when < toDate)
        out.push({ when, kind: m % 10 === 0 ? "decade" : "milestone", value: m,
                   title: `${pet.name} turns ${m}`,
                   sub: `${m} on ${article(SPECIES[pet.species].name)} ${SPECIES[pet.species].name.toLowerCase()}'s clock` });
    }
    const pa2 = ageAtHumanAge(pet, m + step);
    if (pa2 != null) { step = milestoneStep(pet, pa2); m = Math.floor(m / step) * step + step; }
    else m += step;
  }

  const b = new Date(pet.birthday);
  for (let y = fromDate.getFullYear(); y <= toDate.getFullYear(); y++) {
    const bd = new Date(y, b.getMonth(), b.getDate());
    if (bd >= fromDate && bd < toDate && bd.getTime() > birth) {
      const n = y - b.getFullYear();
      out.push({ when: bd, kind: "birthday", value: n,
                 title: `${pet.name}'s ${ordinal(n)} birthday`,
                 sub: `${n} year${n === 1 ? "" : "s"} since the day they were born` });
    }
  }

  let prev = lifeStage(pet, Math.max(a0, 0));
  const days = Math.max(1, Math.round((a1 - a0) * 365));
  for (let i = 1; i <= days; i++) {
    const a = a0 + ((a1 - a0) * i) / days;
    const cur = lifeStage(pet, a);
    if (cur !== prev) {
      out.push({ when: new Date(birth + a * MS_YEAR), kind: "stage", value: cur,
                 title: `${pet.name} becomes ${article(cur)} ${cur.toLowerCase()}`,
                 sub: `Leaving the ${prev.toLowerCase()} stage behind` });
      prev = cur;
    }
  }
  out.sort((x, y) => x.when - y.when);
  return out;
}

const ordinal = (n) => (n % 100 >= 10 && n % 100 <= 20) ? n + "th"
  : n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
const article = (w) => ("aeiou".includes(w[0].toLowerCase()) ? "an" : "a");

function fmtAge(y) {
  const yr = Math.floor(y), mo = Math.floor((y - yr) * 12);
  if (yr === 0) return `${mo} month${mo === 1 ? "" : "s"} old`;
  return `${yr} year${yr === 1 ? "" : "s"}${mo ? `, ${mo} month${mo === 1 ? "" : "s"}` : ""} old`;
}
function fmtLeft(ms) {
  const d = Math.floor(ms / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 45) return `in ${d} days`;
  const mo = Math.round(d / 30.44);
  return `in ${mo} month${mo === 1 ? "" : "s"}`;
}
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmtDate = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
const fmtShort = (d) => `${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`;

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
        const r = await window.storage.get(STORE_KEY);
        if (r && r.value) loaded = JSON.parse(r.value);
      } catch {}
      if (!alive) return;
      setPets(loaded);
      setActiveId(loaded[0]?.id ?? null);
      setView(loaded.length ? "app" : "home");
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const persist = async (next) => {
    setPets(next);
    try { await window.storage.set(STORE_KEY, JSON.stringify(next)); } catch {}
  };
  const addPet = async (p) => { await persist([...pets, p]); setActiveId(p.id); setView("app"); };
  const updatePet = (id, patch) => persist(pets.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const removePet = async (id) => {
    const next = pets.filter((p) => p.id !== id);
    await persist(next);
    setActiveId(next[0]?.id ?? null);
    setView(next.length ? "app" : "home");
  };

  const active = pets.find((p) => p.id === activeId) || null;
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="bd">
      <Styles />
      <Nav onHome={() => { setView(pets.length ? "app" : "home"); scrollTop(); }}
        showApp={pets.length > 0 && view === "home"}
        onApp={() => { setView("app"); scrollTop(); }} />

      {view === "loading" && <div className="bd-wrap"><p className="bd-muted">One moment.</p></div>}
      {view === "home" && <Landing onTry={() => { setView("add"); scrollTop(); }} />}
      {view === "add" && (
        <div className="bd-wrap bd-pad">
          <AddPet onCancel={() => { setView(pets.length ? "app" : "home"); scrollTop(); }} onSave={addPet} />
        </div>
      )}
      {view === "app" && active && (
        <div className="bd-wrap bd-pad">
          <PetSwitch pets={pets} activeId={activeId} onPick={setActiveId}
            onAdd={() => { setView("add"); scrollTop(); }} />
          <PetView pet={active} now={now} onShare={setShareFor}
            onRemove={removePet} onUpdate={updatePet} />
        </div>
      )}

      <Footer onHome={() => { setView("home"); scrollTop(); }} />
      {shareFor && <ShareSheet {...shareFor} onClose={() => setShareFor(null)} />}
    </div>
  );
}

/* ========================================================================== */

function Nav({ onHome, showApp, onApp }) {
  return (
    <header className="bd-nav">
      <div className="bd-nav-in">
        <button className="bd-logo" onClick={onHome}>Bond</button>
        <div className="bd-nav-r">
          {showApp && <button className="bd-nav-link" onClick={onApp}>My pets</button>}
          <Buy small label="Get the collar" />
        </div>
      </div>
    </header>
  );
}

/* The one button that matters. Same component everywhere so the words,
   the price and the promise never drift apart. */
function Buy({ small, label = "Get the collar — $89", block }) {
  if (!WAITLIST_URL) {
    return (
      <span className={"bd-buy-off" + (small ? " sm" : "")}>
        Add WAITLIST_URL
      </span>
    );
  }
  return (
    <a className={"bd-buy" + (small ? " sm" : "") + (block ? " blk" : "")}
      href={WAITLIST_URL} target="_blank" rel="noreferrer">
      {label}{!small && <ArrowRight size={17} />}
    </a>
  );
}

/* --- The product, drawn ---------------------------------------------------
   No photograph exists yet, so this is the product: a collar seen head-on,
   light pipe lit, brass tag hanging. Without a picture of the thing you are
   selling, a store reads as vapour. */

function CollarArt({ glow = "#D9A441", lit = true }) {
  return (
    <svg viewBox="0 0 340 300" className="bd-art" role="img"
      aria-label="A dog collar with a lit strip running through it and an engraved brass tag hanging from the front">
      <defs>
        <linearGradient id="bdStrap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A4F42" /><stop offset=".5" stopColor="#2B3D33" />
          <stop offset="1" stopColor="#1C2A22" />
        </linearGradient>
        <linearGradient id="bdBrass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EBCE85" /><stop offset=".38" stopColor="#CBA044" />
          <stop offset=".72" stopColor="#A87C24" /><stop offset="1" stopColor="#DCBA62" />
        </linearGradient>
        <filter id="bdGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* strap */}
      <ellipse cx="170" cy="128" rx="118" ry="96" fill="none" stroke="url(#bdStrap)" strokeWidth="26" />
      <ellipse cx="170" cy="128" rx="118" ry="96" fill="none" stroke="#465C4D"
        strokeWidth="26" strokeDasharray="1 4" opacity=".5" />

      {/* light pipe */}
      <ellipse cx="170" cy="128" rx="118" ry="96" fill="none"
        stroke={lit ? glow : "#22332A"} strokeWidth="7"
        filter={lit ? "url(#bdGlow)" : undefined} opacity={lit ? ".96" : "1"} />

      {/* buckle */}
      <rect x="150" y="14" width="40" height="26" rx="7" fill="none" stroke="#8A7440" strokeWidth="4" />
      <line x1="170" y1="14" x2="170" y2="40" stroke="#8A7440" strokeWidth="4" />

      {/* D-ring + tag */}
      <circle cx="170" cy="222" r="11" fill="none" stroke="#8A7440" strokeWidth="4" />
      <rect x="139" y="231" width="62" height="58" rx="12" fill="url(#bdBrass)" />
      <circle cx="170" cy="242" r="4.5" fill="#16241D" />
      <text x="170" y="277" textAnchor="middle" className="bd-art-num">58</text>
    </svg>
  );
}

/* --- Landing -------------------------------------------------------------- */

function Landing({ onTry }) {
  return (
    <>
      {/* 1. The feeling, then the product */}
      <section className="bd-hero">
        <div className="bd-wrap bd-hero-in">
          <div className="bd-hero-txt">
            <p className="bd-eyebrow">They live four times faster than we do</p>
            <h1 className="bd-h1">You get about<br />5,000 days<br />with a dog.</h1>
            <p className="bd-lede">
              In that time they'll pass roughly sixty birthdays on their own clock.
              They turn 31 in their first year alone. Almost every one of those days
              goes by without anyone noticing.
            </p>
            <p className="bd-lede bd-lede-b">
              Bond is a collar that lights up on the evening they reach one.
            </p>
            <div className="bd-cta-row">
              <Buy />
              <button className="bd-ghost" onClick={onTry}>See your pet's age — free</button>
            </div>
            <p className="bd-tiny">$89 · ships March 2027 · nothing charged today</p>
          </div>
          <div className="bd-hero-art"><CollarArt /></div>
        </div>
      </section>

      {/* 2. Why it matters — the problem, in numbers */}
      <section className="bd-band-lt">
        <div className="bd-wrap">
          <h2 className="bd-h2">Their whole life fits inside one of your decades.</h2>
          <div className="bd-stats">
            <div>
              <p className="bd-stat">31</p>
              <p className="bd-stat-l">A dog's age, in human terms, on their <b>first</b> birthday.
                The fastest year of their life is the one you photograph least.</p>
            </div>
            <div>
              <p className="bd-stat">62</p>
              <p className="bd-stat-l">Where they are by seven, when a vet first says the word
                <b> senior</b> and you think they must have the wrong chart.</p>
            </div>
            <div>
              <p className="bd-stat">5,000</p>
              <p className="bd-stat-l">Days, give or take, from the day you bring them home to the
                day you don't. <b>None of it is on a calendar.</b></p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The collar — the actual product */}
      <section className="bd-wrap bd-sec">
        <p className="bd-kicker">The collar</p>
        <h2 className="bd-h2">It tells you by lighting up.</h2>
        <p className="bd-body">
          A rechargeable collar with a light running through the strap. On the evening your pet
          reaches a milestone it glows for three hours from dusk — on their neck, where you and
          everyone else can see it. No buzzing, no notification to dismiss. The dog just walks
          into the kitchen glowing and you remember to make a fuss.
        </p>
        <div className="bd-two">
          <div className="bd-feat">
            <h3>Every other night, it's a safety light</h3>
            <p>Five colours, steady or blinking, rechargeable over USB-C. That's why it stays on
              the dog the 360 days a year that aren't milestones — and why it's worth owning
              before the first one arrives.</p>
          </div>
          <div className="bd-feat">
            <h3>No subscription. Ever.</h3>
            <p>You buy the collar once. The app is free and always will be. There's no monthly fee,
              no locked features, and nothing stops working if you stop paying, because there's
              nothing to pay.</p>
          </div>
          <div className="bd-feat">
            <h3>The phone does the thinking</h3>
            <p>The free app works out the year ahead and hands the collar a short list of dates.
              The collar keeps going for months with your phone switched off or left at home.</p>
          </div>
          <div className="bd-feat">
            <h3>Twelve species, not just dogs</h3>
            <p>Cats, rabbits, ferrets, rats, guinea pigs, and a few stranger ones. An opossum
              reaches twelve milestones a year, which tells you something about opossums.</p>
          </div>
        </div>
      </section>

      {/* 4. THE COLOUR LANGUAGE — taught before it's ever used */}
      <section className="bd-band-lt">
        <div className="bd-wrap">
          <p className="bd-kicker">What the colours mean</p>
          <h2 className="bd-h2">Four kinds of day.</h2>
          <p className="bd-body">
            You'll know which one it is from across the room, without checking your phone.
          </p>
          <div className="bd-kinds">
            {Object.entries(KIND).map(([k, v]) => (
              <div key={k} className="bd-kind">
                <span className="bd-kind-dot" style={{ background: v.hex, boxShadow: `0 0 16px ${v.hex}` }} />
                <div>
                  <p className="bd-kind-n">{v.name}</p>
                  <p className="bd-kind-p">{v.plain}</p>
                  <p className="bd-kind-d">{v.detail}</p>
                  <p className="bd-kind-x">{v.pattern}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. How it works */}
      <section className="bd-wrap bd-sec">
        <p className="bd-kicker">How it works</p>
        <ol className="bd-steps">
          <li><span>1</span><div>
            <h3>Tell us their birthday</h3>
            <p>Species, breed, date of birth. Ten seconds. If they're a rescue and you're guessing,
              that's fine — say so and we'll treat it as an estimate.</p>
          </div></li>
          <li><span>2</span><div>
            <h3>We work out their real age</h3>
            <p>Not multiply-by-seven. For dogs we use the 2020 epigenetic clock from UC San Diego;
              for cats, the 2021 AAHA/AAFP veterinary guidelines. Breed matters enormously — a
              Great Dane ages nearly twice as fast as a chihuahua.</p>
          </div></li>
          <li><span>3</span><div>
            <h3>The collar lights up on the day</h3>
            <p>Three hours from dusk, in the colour for that kind of day. You get about eight
              evenings a year with a dog. Twelve with an opossum.</p>
          </div></li>
        </ol>
        <div className="bd-try">
          <div>
            <h3>Try it before you buy anything</h3>
            <p>The app is free, needs no account, and works without the collar. Put your pet in and
              see what the year ahead looks like.</p>
          </div>
          <button className="bd-ghost" onClick={onTry}>See your pet's age</button>
        </div>
      </section>

      {/* 6. Specs + FAQ — the boring furniture that makes a store real */}
      <section className="bd-band-lt">
        <div className="bd-wrap">
          <p className="bd-kicker">Details</p>
          <h2 className="bd-h2">The specifics.</h2>
          <div className="bd-two">
            <dl className="bd-spec">
              <div><dt>Price</dt><dd>$89, shipping included in the US</dd></div>
              <div><dt>Sizes</dt><dd>Small, medium, large</dd></div>
              <div><dt>Battery</dt><dd>USB-C rechargeable. About 60 days on milestones alone;
                9–22 hours of continuous night light</dd></div>
              <div><dt>Water</dt><dd>Rain and puddles, yes. Swimming, not yet.</dd></div>
              <div><dt>App</dt><dd>Free, iPhone and Android. No account.</dd></div>
              <div><dt>Subscription</dt><dd>None</dd></div>
              <div><dt>First run</dt><dd>250 collars</dd></div>
              <div><dt>Ships</dt><dd>March 2027</dd></div>
            </dl>
            <div className="bd-faq">
              <Faq q="Is this a tracker? Does it know where my dog is?"
                a="No. There's no GPS and no location of any kind. It's a light and a clock. Your pet's details stay on your phone." />
              <Faq q="Why should I trust the numbers?"
                a="Dogs use a peer-reviewed epigenetic clock published in Cell Systems in 2020, built by reading DNA methylation in 104 Labradors. Cats use the 2021 AAHA/AAFP veterinary life-stage guidelines. Ten other species are modelled from published longevity data and clearly labelled as estimates — we'd rather tell you which numbers are softer than pretend they're all the same." />
              <Faq q="What if my rescue's birthday is a guess?"
                a="Most are. Tick the box that says it's an estimate and we'll mark it throughout. A guess within a month or two barely moves anything." />
              <Faq q="Am I being charged today?"
                a="No. The form tells us you're interested and gets you the email when collars are ready to order. Nothing is taken until you actually buy one." />
              <Faq q="Who's making these?"
                a="One person, honestly. First run is 250 collars. If the date slips you'll hear it from us before the date passes, not after — with a full refund if you'd rather not wait." />
            </div>
          </div>
        </div>
      </section>

      {/* 7. Close */}
      <section className="bd-close">
        <div className="bd-wrap bd-close-in">
          <h2 className="bd-h1 bd-h1-sm">Don't let the good days<br />go by unmarked.</h2>
          <p className="bd-lede">$89. First run of 250. Ships March 2027.</p>
          <Buy block label="Get the collar — $89" />
          <p className="bd-tiny">Nothing charged today. Just tell us where to email you.</p>
        </div>
      </section>
    </>
  );
}

function Faq({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"bd-fq" + (open ? " on" : "")}>
      <button onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{q}</span>{open ? <Minus size={16} /> : <Plus size={16} />}
      </button>
      {open && <p>{a}</p>}
    </div>
  );
}

function Footer({ onHome }) {
  return (
    <footer className="bd-foot">
      <div className="bd-wrap bd-foot-in">
        <div>
          <button className="bd-logo bd-logo-sm" onClick={onHome}>Bond</button>
          <p>A collar that celebrates on their clock.</p>
        </div>
        <div className="bd-foot-links">
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <a href="/privacy">Privacy</a>
          <span>Free US shipping · 30-day returns</span>
          <span>© {new Date().getFullYear()} Bond</span>
        </div>
      </div>
    </footer>
  );
}

/* --- The app -------------------------------------------------------------- */

function PetSwitch({ pets, activeId, onPick, onAdd }) {
  return (
    <nav className="bd-switch" aria-label="Your pets">
      {pets.map((p) => (
        <button key={p.id} onClick={() => onPick(p.id)}
          className={"bd-tab" + (p.id === activeId ? " on" : "")}>{p.name}</button>
      ))}
      <button className="bd-tab bd-tab-add" onClick={onAdd} aria-label="Add another pet">
        <Plus size={13} strokeWidth={2.5} />
      </button>
    </nav>
  );
}

function PetView({ pet, now, onShare, onRemove, onUpdate }) {
  const birth = new Date(pet.birthday).getTime();
  const ageYears = (now - birth) / MS_YEAR;
  const human = Math.floor(humanAge(pet, ageYears));
  const stage = lifeStage(pet, ageYears);
  const rate = agingRate(pet, ageYears);
  const sp = SPECIES[pet.species];

  const year = useMemo(
    () => generateMilestones(pet, new Date(now), new Date(now + MS_YEAR)),
    [pet.id, pet.birthday, pet.species, pet.breed, pet.lifestyle, Math.floor(now / 3600000)]
  );
  const next = year[0];

  return (
    <main>
      {/* The headline sentence — states plainly what the number means. This is
          the single most misread thing in the app, so it gets words. */}
      <section className="bd-answer">
        <p className="bd-answer-line">
          {pet.name} is <b>{fmtAge(ageYears)}</b>.
        </p>
        <p className="bd-answer-big">
          On {article(sp.name)} {sp.name.toLowerCase()}'s clock, that's <b>{human}</b>.
        </p>
        <p className="bd-answer-sub">
          {pet.species === "dog" ? pet.breed
            : pet.species === "cat" ? `${pet.lifestyle.replace("_", " and ")} cat`
            : sp.name} · currently {stage.toLowerCase()} ·
          gaining {rate < 1 ? rate.toFixed(1) : Math.round(rate)} years for every one of ours
          {pet.estimate && <em className="bd-tag-est">birthday estimated</em>}
          {sp.tier === 3 && <em className="bd-tag-est">age modelled</em>}
        </p>
      </section>

      {next && (
        <section className="bd-next" style={{ "--k": KIND[next.kind].hex }}>
          <p className="bd-next-when">{fmtDate(next.when)} · {fmtLeft(next.when.getTime() - now)}</p>
          <h2 className="bd-next-t">{next.title}</h2>
          <p className="bd-next-s">{next.sub}</p>
          <div className="bd-next-lamp"><span /></div>
          <p className="bd-next-x">
            The collar glows {KIND[next.kind].name.toLowerCase()} that evening —
            {" "}{KIND[next.kind].pattern.toLowerCase()}.
          </p>
        </section>
      )}

      <section className="bd-blk">
        <h2 className="bd-lbl">
          The next twelve months
          <span>{year.length} {year.length === 1 ? "day" : "days"} to mark</span>
        </h2>
        {year.length === 0 ? (
          <p className="bd-muted">Nothing in the next year — that happens with very young pets.
            Check back in a few weeks.</p>
        ) : (
          <ol className="bd-list">
            {year.map((m, i) => {
              const k = KIND[m.kind];
              return (
                <li key={i} className={i === 0 ? "on" : ""}>
                  <span className="bd-date">{fmtShort(m.when)}</span>
                  <span className="bd-bar" style={{ background: k.hex }} />
                  <span className="bd-item">
                    <b>{m.title}</b>
                    <em>{k.name} · {m.sub}</em>
                  </span>
                  <button onClick={() => onShare({ pet, m })} aria-label={`Share: ${m.title}`}>
                    <Share2 size={13} />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="bd-sell">
        <div className="bd-sell-art"><CollarArt glow={next ? KIND[next.kind].hex : "#D9A441"} /></div>
        <div>
          <h2 className="bd-h2 bd-h2-sm">
            {year.length > 0
              ? <>That's {year.length} evening{year.length === 1 ? "" : "s"} the collar lights up for {pet.name}.</>
              : <>The collar lights up on {pet.name}'s day.</>}
          </h2>
          <p className="bd-body">
            Rechargeable, doubles as a night-walk safety light, no subscription. $89, shipping
            March 2027. Nothing charged today.
          </p>
          <Buy block />
        </div>
      </section>

      <Collar pet={pet} onUpdate={onUpdate} />

      <button className="bd-del" onClick={() => {
        if (window.confirm(`Remove ${pet.name}? Their timeline is cleared from this device.`))
          onRemove(pet.id);
      }}><Trash2 size={12} /> Remove {pet.name}</button>
    </main>
  );
}

function Collar({ pet, onUpdate }) {
  const c = { ...DEFAULT_COLLAR, ...(pet.collar || {}) };
  const [test, setTest] = useState(null);
  const set = (patch) => onUpdate(pet.id, { collar: { ...c, ...patch } });
  const nightHex = NIGHT_COLORS.find((n) => n.key === c.nightColor)?.hex || "#5FCF88";
  const pattern = NIGHT_PATTERNS.find((n) => n.key === c.nightPattern) || NIGHT_PATTERNS[1];
  const run = (hex, cls) => { setTest({ hex, cls }); setTimeout(() => setTest(null), 3000); };

  return (
    <section className="bd-blk">
      <h2 className="bd-lbl">
        Collar settings
        <span>{c.nightOn ? `${pattern.hours} hrs a charge` : "60 days a charge"}</span>
      </h2>
      <p className="bd-muted bd-muted-sm">
        These control a collar you don't own yet — have a look at what it will do.
      </p>

      <div className={"bd-lamp" + (test ? " t " + test.cls : "")}
        style={{ "--k": test ? test.hex : nightHex }} aria-hidden="true"><span /></div>

      <div className="bd-set">
        <div>
          <p className="bd-set-n">Night light</p>
          <p className="bd-set-s">For walks after dark. You switch it on and off.</p>
        </div>
        <Toggle on={c.nightOn} onChange={() => set({ nightOn: !c.nightOn })} label="Night light" />
      </div>
      {c.nightOn && (
        <div className="bd-open">
          <div className="bd-dots">
            {NIGHT_COLORS.map((n) => (
              <button key={n.key} style={{ "--s": n.hex }} title={n.name} aria-label={n.name}
                className={"bd-dot" + (c.nightColor === n.key ? " on" : "")}
                onClick={() => { set({ nightColor: n.key }); run(n.hex, "steady"); }} />
            ))}
          </div>
          <div className="bd-seg">
            {NIGHT_PATTERNS.map((n) => (
              <button key={n.key} className={"bd-seg-b" + (c.nightPattern === n.key ? " on" : "")}
                onClick={() => { set({ nightPattern: n.key }); run(nightHex, n.key); }}>{n.name}</button>
            ))}
          </div>
        </div>
      )}

      <div className="bd-set">
        <div>
          <p className="bd-set-n">Milestone glow</p>
          <p className="bd-set-s">Automatic, on the days above. Nothing to set.</p>
        </div>
        <Toggle on={c.milestoneOn} onChange={() => set({ milestoneOn: !c.milestoneOn })} label="Milestone glow" />
      </div>
      {c.milestoneOn && (
        <div className="bd-open">
          {Object.entries(KIND).map(([k, v]) => (
            <button key={k} className="bd-leg" onClick={() => run(v.hex, "breathe")}>
              <span style={{ background: v.hex }} />
              <b>{v.name}</b>
              <em>{v.plain}</em>
              <i>see it</i>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <button className={"bd-tog" + (on ? " on" : "")} onClick={onChange}
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
      <h1 className="bd-h2">Who are we keeping time for?</h1>
      <p className="bd-body bd-body-sm">Free, no account, and nothing leaves your phone.</p>

      <label className="bd-f">
        <span className="bd-lbl">Their name</span>
        <input className="bd-in" value={name} maxLength={24} autoFocus
          onChange={(e) => setName(e.target.value)} placeholder="Cooper" />
      </label>

      <div className="bd-f">
        <span className="bd-lbl">What are they</span>
        <div className="bd-grid">
          {Object.entries(SPECIES).map(([k, s]) => (
            <button key={k} onClick={() => setSpecies(k)}
              className={"bd-opt" + (species === k ? " on" : "")}>{s.name}</button>
          ))}
        </div>
      </div>

      {species === "dog" && (
        <label className="bd-f">
          <span className="bd-lbl">Breed</span>
          <select className="bd-in" value={breed} onChange={(e) => setBreed(e.target.value)}>
            {Object.keys(DOG_BREEDS).map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <span className="bd-hint">A Great Dane ages nearly twice as fast as a chihuahua, so this matters.</span>
        </label>
      )}

      {species === "cat" && (
        <div className="bd-f">
          <span className="bd-lbl">Where they live</span>
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
        <span className="bd-lbl">Date of birth</span>
        <input className="bd-in" type="date" value={birthday}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirthday(e.target.value)} />
      </label>

      <button className={"bd-chk" + (estimate ? " on" : "")} onClick={() => setEstimate(!estimate)}>
        <span>{estimate && <Check size={11} strokeWidth={3.5} />}</span>
        It's a guess — they're a rescue
      </button>

      {sp.exotic && (
        <p className="bd-note">Keeping {sp.name.toLowerCase()}s is restricted or illegal in many
          states. Worth checking your local rules.</p>
      )}
      {sp.tier === 3 && (
        <p className="bd-note soft">No ageing clock has been published for {sp.name.toLowerCase()}s,
          so we model it from maturity and lifespan data and label it an estimate. Dogs and cats use
          peer-reviewed research.</p>
      )}

      <button className="bd-buy blk" disabled={!ok} onClick={() => ok && onSave({
        id: String(Date.now()), name: name.trim(), species, birthday, estimate,
        breed: species === "dog" ? breed : null,
        lifestyle: species === "cat" ? lifestyle : null,
        collar: { ...DEFAULT_COLLAR },
      })}>Show me their age</button>
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
    try { await navigator.clipboard.writeText(line); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
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
        <p className="bd-tiny bd-ctr">Screenshot the card, or copy the words.</p>
        <button className="bd-buy blk" onClick={copy}>
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
@import url('https://fonts.googleapis.com/css2?family=Petrona:ital,wght@0,400;0,500;0,600;1,400&family=Karla:wght@400;500;600;700&family=Azeret+Mono:wght@400;500&display=swap');

/* Dusk in a park, and the brass on a collar. Alternating dark and light bands
   give the page the rhythm of a real store rather than one long dark screen. */
.bd{
  --moss:#16241D; --pine:#1D2E26; --bark:#2C4136; --line:#354B3F;
  --lichen:#8FA095; --dim:#718276; --oat:#EFEADC; --brass:#D9A441; --rust:#C4573A;
  --lt:#F3EFE4; --lt-2:#E6E0CF; --lt-ink:#1B2A22; --lt-dim:#5B6B60;
  background:var(--moss); color:var(--oat); min-height:100vh;
  font-family:'Karla',system-ui,sans-serif; -webkit-font-smoothing:antialiased;
  font-size:16px; line-height:1.5;
}
.bd *,.bd *::before,.bd *::after{ box-sizing:border-box; }
.bd button{ font-family:inherit; cursor:pointer; border:none; background:none; color:inherit; }
.bd a{ color:inherit; }
.bd button:focus-visible,.bd a:focus-visible,.bd input:focus-visible,.bd select:focus-visible{
  outline:2px solid var(--brass); outline-offset:3px; border-radius:3px; }
.bd-wrap{ max-width:1080px; margin:0 auto; padding:0 24px; }
.bd-pad{ padding-top:34px; padding-bottom:56px; }

/* type scale */
.bd-h1{ font-family:'Petrona',Georgia,serif; font-weight:500; font-size:52px; line-height:1.06;
  letter-spacing:-0.025em; margin:0 0 22px; }
.bd-h1-sm{ font-size:40px; }
.bd-h2{ font-family:'Petrona',serif; font-weight:500; font-size:32px; line-height:1.18;
  letter-spacing:-0.018em; margin:0 0 18px; }
.bd-h2-sm{ font-size:25px; }
.bd-eyebrow,.bd-kicker{ font-family:'Azeret Mono',monospace; font-size:10.5px; letter-spacing:.16em;
  text-transform:uppercase; color:var(--brass); margin:0 0 16px; }
.bd-lede{ font-size:17px; line-height:1.6; color:var(--lichen); margin:0 0 16px; max-width:44ch; }
.bd-lede-b{ color:var(--oat); font-weight:500; }
.bd-body{ font-size:15.5px; line-height:1.68; color:var(--lichen); margin:0 0 22px; max-width:62ch; }
.bd-body-sm{ font-size:14px; margin-bottom:28px; }
.bd-tiny{ font-family:'Azeret Mono',monospace; font-size:10px; letter-spacing:.09em;
  text-transform:uppercase; color:var(--dim); margin:14px 0 0; }
.bd-ctr{ text-align:center; }
.bd-muted{ color:var(--lichen); font-size:14.5px; margin:0; }
.bd-muted-sm{ font-size:13px; margin:-4px 0 16px; }
.bd-lbl{ display:flex; justify-content:space-between; align-items:baseline; gap:14px;
  font-family:'Azeret Mono',monospace; font-size:10px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--lichen); font-weight:400; margin:0 0 15px; }
.bd-lbl>span{ letter-spacing:.03em; text-transform:none; color:var(--brass); }
.bd-hint{ display:block; font-size:12px; color:var(--dim); margin-top:8px; line-height:1.5; }

/* nav */
.bd-nav{ position:sticky; top:0; z-index:40; background:rgba(22,36,29,.94);
  backdrop-filter:blur(10px); border-bottom:1px solid var(--bark); }
.bd-nav-in{ max-width:1080px; margin:0 auto; padding:13px 24px; display:flex;
  align-items:center; justify-content:space-between; gap:16px; }
.bd-logo{ font-family:'Petrona',serif; font-size:22px; font-weight:600; letter-spacing:-0.025em; }
.bd-logo-sm{ font-size:19px; }
.bd-nav-r{ display:flex; align-items:center; gap:14px; }
.bd-nav-link{ font-size:13.5px; color:var(--lichen); }
.bd-nav-link:hover{ color:var(--oat); }

/* buy button — one component, one set of words */
.bd-buy{ display:inline-flex; align-items:center; justify-content:center; gap:8px;
  padding:15px 26px; border-radius:10px; background:var(--brass); color:#1A1305;
  font-size:15px; font-weight:700; text-decoration:none; transition:.16s ease;
  border:none; cursor:pointer; }
.bd-buy:hover{ background:#E8B551; transform:translateY(-1px); }
.bd-buy.sm{ padding:9px 15px; font-size:13px; border-radius:8px; }
.bd-buy.blk{ display:flex; width:100%; }
.bd-buy:disabled{ opacity:.3; cursor:not-allowed; transform:none; }
.bd-buy-off{ display:inline-block; padding:9px 14px; border:1px dashed var(--brass);
  border-radius:8px; font-family:'Azeret Mono',monospace; font-size:10px; color:var(--brass); }
.bd-ghost{ display:inline-flex; align-items:center; justify-content:center; padding:15px 24px;
  border-radius:10px; border:1px solid var(--line); font-size:15px; font-weight:500;
  transition:.16s ease; }
.bd-ghost:hover{ background:var(--pine); border-color:var(--lichen); }

/* hero */
.bd-hero{ padding:56px 0 64px; border-bottom:1px solid var(--bark); }
.bd-hero-in{ display:grid; grid-template-columns:1.15fr .85fr; gap:40px; align-items:center; }
.bd-cta-row{ display:flex; gap:11px; flex-wrap:wrap; margin-top:26px; }
.bd-hero-txt{ min-width:0; }
.bd-art{ width:100%; max-width:340px; display:block; margin:0 auto; }
.bd-art-num{ font-family:'Petrona',serif; font-size:31px; font-weight:600; fill:#4A3810; }

/* light bands */
.bd-band-lt{ background:var(--lt); color:var(--lt-ink); padding:64px 0; }
.bd-band-lt .bd-h2{ color:var(--lt-ink); }
.bd-band-lt .bd-body,.bd-band-lt .bd-lede{ color:var(--lt-dim); }
.bd-band-lt .bd-kicker{ color:#9A7420; }
.bd-sec{ padding:64px 24px; }

/* stats */
.bd-stats{ display:grid; grid-template-columns:repeat(3,1fr); gap:32px; margin-top:38px; }
.bd-stat{ font-family:'Petrona',serif; font-size:62px; line-height:1; font-weight:500;
  color:#9A7420; margin:0 0 12px; letter-spacing:-0.03em; }
.bd-stat-l{ font-size:14.5px; line-height:1.6; color:var(--lt-dim); margin:0; }
.bd-stat-l b{ color:var(--lt-ink); font-weight:600; }

/* features */
.bd-two{ display:grid; grid-template-columns:1fr 1fr; gap:34px; margin-top:34px; }
.bd-feat h3{ font-family:'Petrona',serif; font-size:19px; font-weight:500; margin:0 0 8px;
  letter-spacing:-0.01em; }
.bd-feat p{ font-size:14.5px; line-height:1.62; color:var(--lichen); margin:0; }

/* colour language */
.bd-kinds{ display:grid; grid-template-columns:1fr 1fr; gap:26px; margin-top:36px; }
.bd-kind{ display:flex; gap:15px; align-items:flex-start; }
.bd-kind-dot{ width:15px; height:15px; border-radius:50%; flex:none; margin-top:5px; }
.bd-kind-n{ font-family:'Petrona',serif; font-size:19px; font-weight:600; margin:0 0 3px; }
.bd-kind-p{ font-size:14.5px; margin:0 0 5px; color:var(--lt-ink); }
.bd-kind-d{ font-size:13.5px; color:var(--lt-dim); margin:0 0 5px; line-height:1.55; }
.bd-kind-x{ font-family:'Azeret Mono',monospace; font-size:10px; letter-spacing:.06em;
  color:#9A7420; margin:0; }

/* steps */
.bd-steps{ list-style:none; margin:34px 0 0; padding:0; counter-reset:s; }
.bd-steps li{ display:flex; gap:20px; padding:0 0 30px; }
.bd-steps li>span{ font-family:'Petrona',serif; font-size:26px; color:var(--brass);
  width:38px; flex:none; line-height:1.1; }
.bd-steps h3{ font-family:'Petrona',serif; font-size:20px; font-weight:500; margin:0 0 7px; }
.bd-steps p{ font-size:14.5px; line-height:1.62; color:var(--lichen); margin:0; max-width:58ch; }
.bd-try{ display:flex; align-items:center; justify-content:space-between; gap:26px;
  padding:26px; border:1px solid var(--line); border-radius:14px; margin-top:12px; }
.bd-try h3{ font-family:'Petrona',serif; font-size:20px; font-weight:500; margin:0 0 6px; }
.bd-try p{ font-size:14px; color:var(--lichen); margin:0; max-width:48ch; }

/* specs + faq */
.bd-spec{ margin:0; }
.bd-spec>div{ display:flex; justify-content:space-between; gap:20px; padding:13px 0;
  border-bottom:1px solid var(--lt-2); }
.bd-spec dt{ font-size:14px; color:var(--lt-dim); flex:none; }
.bd-spec dd{ font-size:14px; margin:0; text-align:right; font-weight:500; }
.bd-faq{ border-top:1px solid var(--lt-2); }
.bd-fq{ border-bottom:1px solid var(--lt-2); }
.bd-fq>button{ display:flex; width:100%; align-items:center; justify-content:space-between;
  gap:16px; padding:15px 0; text-align:left; font-size:14.5px; font-weight:600; }
.bd-fq>p{ font-size:14px; line-height:1.65; color:var(--lt-dim); margin:0 0 16px; }

/* close */
.bd-close{ padding:72px 0 80px; text-align:center; border-top:1px solid var(--bark); }
.bd-close-in{ max-width:520px; }
.bd-close .bd-lede{ max-width:none; margin-bottom:26px; }

/* footer */
.bd-foot{ background:#101B15; border-top:1px solid var(--bark); padding:38px 0 44px; }
.bd-foot-in{ display:flex; justify-content:space-between; gap:30px; flex-wrap:wrap; }
.bd-foot p{ font-size:13px; color:var(--dim); margin:6px 0 0; }
.bd-foot-links{ display:flex; flex-direction:column; gap:8px; text-align:right; font-size:13px;
  color:var(--dim); }
.bd-foot-links a{ text-decoration:none; }
.bd-foot-links a:hover{ color:var(--brass); }

/* ---- app view ---- */
.bd-switch{ display:flex; gap:6px; flex-wrap:wrap; margin-bottom:26px; }
.bd-tab{ padding:7px 14px; border-radius:99px; border:1px solid var(--line);
  font-size:13px; color:var(--lichen); transition:.16s ease; }
.bd-tab.on{ background:var(--oat); color:var(--moss); border-color:var(--oat); font-weight:600; }
.bd-tab-add{ display:flex; align-items:center; padding:7px 11px; }

.bd-answer{ padding:0 0 30px; border-bottom:1px solid var(--bark); margin-bottom:28px; }
.bd-answer-line{ font-size:16px; color:var(--lichen); margin:0 0 6px; }
.bd-answer-line b{ color:var(--oat); font-weight:600; }
.bd-answer-big{ font-family:'Petrona',serif; font-size:31px; font-weight:500; line-height:1.22;
  margin:0 0 12px; letter-spacing:-0.018em; }
.bd-answer-big b{ font-size:46px; color:var(--brass); font-weight:600; }
.bd-answer-sub{ font-size:13.5px; color:var(--dim); margin:0; line-height:1.6; }
.bd-tag-est{ font-family:'Azeret Mono',monospace; font-style:normal; font-size:9px;
  letter-spacing:.1em; text-transform:uppercase; color:var(--brass);
  border:1px solid rgba(217,164,65,.35); border-radius:3px; padding:1px 6px; margin-left:8px; }

.bd-next{ background:var(--pine); border:1px solid var(--line); border-left:3px solid var(--k);
  border-radius:12px; padding:22px; margin-bottom:30px; }
.bd-next-when{ font-family:'Azeret Mono',monospace; font-size:10.5px; letter-spacing:.11em;
  text-transform:uppercase; color:var(--k); margin:0 0 9px; }
.bd-next-t{ font-family:'Petrona',serif; font-size:25px; font-weight:500; margin:0 0 5px;
  letter-spacing:-0.015em; }
.bd-next-s{ font-size:14px; color:var(--lichen); margin:0 0 16px; }
.bd-next-lamp{ height:7px; border-radius:99px; background:#0E1812; overflow:hidden; margin-bottom:11px; }
.bd-next-lamp>span{ display:block; height:100%; background:var(--k);
  animation:bd-breathe 3.4s ease-in-out infinite; }
.bd-next-x{ font-size:12.5px; color:var(--dim); margin:0; }
@keyframes bd-breathe{ 0%,100%{opacity:.15} 50%{opacity:.95} }

.bd-blk{ margin-bottom:38px; }
.bd-list{ list-style:none; margin:0; padding:0; }
.bd-list li{ display:flex; align-items:center; gap:13px; padding:13px 0;
  border-bottom:1px solid rgba(44,65,54,.6); }
.bd-list li.on{ background:rgba(217,164,65,.045); margin:0 -12px; padding:13px 12px;
  border-radius:8px; }
.bd-date{ font-family:'Azeret Mono',monospace; font-size:11.5px; color:var(--lichen);
  width:54px; flex:none; }
.bd-bar{ width:3px; align-self:stretch; border-radius:2px; flex:none; }
.bd-item{ flex:1; min-width:0; }
.bd-item b{ display:block; font-size:14.5px; font-weight:500; margin-bottom:2px; }
.bd-item em{ font-style:normal; font-size:12px; color:var(--dim); }
.bd-list button{ color:#5F7166; padding:4px; }
.bd-list button:hover{ color:var(--oat); }

.bd-sell{ display:grid; grid-template-columns:.8fr 1.2fr; gap:28px; align-items:center;
  background:var(--pine); border:1px solid var(--line); border-radius:16px;
  padding:28px; margin-bottom:38px; }
.bd-sell-art .bd-art{ max-width:210px; }

.bd-lamp{ height:14px; border-radius:99px; background:#0E1812; border:1px solid var(--bark);
  overflow:hidden; margin-bottom:8px; }
.bd-lamp>span{ display:block; height:100%; background:var(--k); opacity:.12; transition:opacity .3s; }
.bd-lamp.t>span{ box-shadow:0 0 20px var(--k); }
.bd-lamp.t.steady>span{ opacity:.95; }
.bd-lamp.t.breathe>span{ animation:bd-breathe 2.6s ease-in-out infinite; }
.bd-lamp.t.slow>span{ animation:bd-blink 1.4s steps(1) infinite; }
.bd-lamp.t.fast>span{ animation:bd-blink .42s steps(1) infinite; }
@keyframes bd-blink{ 0%,49%{opacity:.95} 50%,100%{opacity:.07} }

.bd-set{ display:flex; align-items:center; justify-content:space-between; gap:16px;
  padding:17px 0; border-bottom:1px solid var(--bark); }
.bd-set-n{ font-size:15px; margin:0 0 3px; }
.bd-set-s{ font-size:12.5px; color:var(--lichen); margin:0; }
.bd-open{ padding:16px 0 18px; border-bottom:1px solid var(--bark); }
.bd-tog{ width:46px; height:26px; border-radius:99px; background:var(--bark); position:relative;
  flex:none; transition:background .18s ease; }
.bd-tog>span{ position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%;
  background:var(--lichen); transition:.18s ease; }
.bd-tog.on{ background:var(--brass); }
.bd-tog.on>span{ transform:translateX(20px); background:#1A1305; }

.bd-dots{ display:flex; gap:10px; margin-bottom:15px; }
.bd-dot{ width:32px; height:32px; border-radius:50%; background:var(--s); opacity:.34;
  border:2px solid transparent; transition:.16s ease; }
.bd-dot.on{ opacity:1; border-color:var(--oat); box-shadow:0 0 15px var(--s); }
.bd-seg{ display:flex; gap:6px; }
.bd-seg-b{ flex:1; padding:11px 4px; border-radius:8px; border:1px solid var(--line);
  font-size:12.5px; color:var(--lichen); transition:.16s ease; }
.bd-seg-b.on{ background:var(--bark); border-color:var(--oat); color:var(--oat); }

.bd-leg{ display:flex; align-items:center; gap:12px; width:100%; text-align:left; padding:9px 0; }
.bd-leg>span{ width:10px; height:10px; border-radius:50%; flex:none; }
.bd-leg b{ font-size:13.5px; font-weight:500; width:96px; flex:none; }
.bd-leg em{ font-style:normal; font-size:12.5px; color:var(--lichen); }
.bd-leg i{ margin-left:auto; font-style:normal; font-family:'Azeret Mono',monospace;
  font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:#5F7166; }
.bd-leg:hover i{ color:var(--brass); }

.bd-del{ display:flex; align-items:center; gap:6px; margin:0 auto; font-size:12.5px; color:#4F6157; }
.bd-del:hover{ color:var(--rust); }

/* form */
.bd-form{ max-width:520px; }
.bd-back{ display:flex; align-items:center; gap:3px; font-size:13.5px; color:var(--lichen);
  margin-bottom:22px; }
.bd-f{ display:block; margin-bottom:24px; }
.bd-in{ width:100%; padding:14px; border-radius:9px; background:var(--pine);
  border:1px solid var(--line); color:var(--oat); font-size:15.5px; font-family:inherit; }
.bd-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }
.bd-opt{ padding:13px 5px; border-radius:8px; background:var(--pine); border:1px solid var(--line);
  font-size:13px; color:var(--lichen); transition:.16s ease; }
.bd-opt.on{ background:var(--bark); border-color:var(--oat); color:var(--oat); font-weight:600; }
.bd-chk{ display:flex; align-items:center; gap:10px; font-size:14px; color:var(--lichen);
  margin-bottom:22px; }
.bd-chk>span{ width:19px; height:19px; border-radius:5px; border:1px solid var(--line);
  display:flex; align-items:center; justify-content:center; flex:none; }
.bd-chk.on>span{ background:var(--brass); border-color:var(--brass); color:#1A1305; }
.bd-note{ font-size:13px; line-height:1.6; color:var(--brass); background:rgba(217,164,65,.07);
  border-left:2px solid var(--brass); padding:13px 15px; border-radius:0 8px 8px 0; margin:0 0 20px; }
.bd-note.soft{ color:var(--lichen); border-left-color:var(--line); background:rgba(255,255,255,.022); }

/* share */
.bd-modal{ position:fixed; inset:0; background:rgba(8,14,11,.86); backdrop-filter:blur(7px);
  display:flex; align-items:center; justify-content:center; padding:22px; z-index:60; }
.bd-modal-in{ width:100%; max-width:330px; position:relative; }
.bd-x{ position:absolute; top:-34px; right:0; color:var(--lichen); }
.bd-card{ position:relative; overflow:hidden; text-align:center; border-radius:19px;
  padding:34px 24px 24px; background:linear-gradient(163deg,#233A2E,#141F19);
  border:1px solid var(--line); }
.bd-card-glow{ position:absolute; top:-58px; left:50%; transform:translateX(-50%); width:186px;
  height:112px; background:var(--k); filter:blur(46px); opacity:.42; }
.bd-card-top{ position:relative; font-family:'Azeret Mono',monospace; font-size:9.5px;
  letter-spacing:.16em; text-transform:uppercase; color:var(--k); margin:0 0 13px; }
.bd-card-big{ position:relative; font-family:'Petrona',serif; font-size:78px; line-height:.92;
  font-weight:500; margin:0 0 15px; letter-spacing:-0.04em; }
.bd-card-line{ position:relative; font-size:14px; line-height:1.55; margin:0 0 25px; }
.bd-card-foot{ position:relative; font-family:'Petrona',serif; font-size:12px; font-weight:600;
  color:var(--lichen); margin:0; }

/* responsive */
@media (max-width:860px){
  .bd-hero-in,.bd-two,.bd-kinds,.bd-stats,.bd-sell{ grid-template-columns:1fr; }
  .bd-hero{ padding:36px 0 44px; }
  .bd-hero-art{ order:-1; margin-bottom:14px; }
  .bd-art{ max-width:230px; }
  .bd-h1{ font-size:38px; }
  .bd-h1-sm{ font-size:31px; }
  .bd-h2{ font-size:26px; }
  .bd-stats{ gap:26px; }
  .bd-stat{ font-size:46px; }
  .bd-sec,.bd-band-lt{ padding:44px 24px; }
  .bd-try{ flex-direction:column; align-items:flex-start; gap:18px; }
  .bd-foot-in{ flex-direction:column; }
  .bd-foot-links{ text-align:left; }
  .bd-answer-big{ font-size:25px; }
  .bd-answer-big b{ font-size:38px; }
  .bd-cta-row .bd-buy,.bd-cta-row .bd-ghost{ flex:1; }
}
@media (prefers-reduced-motion:reduce){ .bd *{ animation:none !important; transition:none !important; } }
    `}</style>
  );
}
