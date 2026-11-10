// Hausilo. One file, no build step. Data lives in Supabase; settings are in config.js.
// The deal logic below is "Portunus": Silo checks the numbers, Hilo scores, Lumi matches buy boxes, Xilo flags what's new.
(() => {
"use strict";
const CFG = window.HAUSILO || {}, LIVE = !!(CFG.supabaseUrl && CFG.supabaseKey);
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $("#view");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = n => Math.round(n).toLocaleString("en-US");
const usd = n => n == null || isNaN(n) ? "n/a" : (n < 0 ? "-$" : "$") + num(Math.abs(n));
const K = n => { if (n == null || isNaN(n)) return "n/a"; const a = Math.abs(n), s = n < 0 ? "-" : ""; return a >= 1e6 ? s + "$" + (a / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M" : a >= 1e4 ? s + "$" + Math.round(a / 1e3) + "K" : s + "$" + num(a); };
const money = v => +String(v ?? "").replace(/[^0-9.]/g, "") || 0;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const median = a => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : NaN; };
const after = (a, b) => !!a && (!b || Date.parse(a) > Date.parse(b));
const year = y => y >= 1800 && y <= 2100 ? Math.round(y) : null;
const day = s => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
let toastT; const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 4200); };

// ---------- Houston zips: centre point of each, and the area name people use ----------
const ZIPS = {}; "77002:29.757,-95.366;77003:29.75,-95.346;77004:29.725,-95.364;77005:29.718,-95.424;77006:29.741,-95.391;77007:29.772,-95.411;77008:29.798,-95.417;77009:29.795,-95.368;77010:29.754,-95.36;77011:29.744,-95.309;77012:29.719,-95.274;77013:29.792,-95.229;77014:29.981,-95.464;77015:29.764,-95.173;77016:29.863,-95.3;77017:29.69,-95.252;77018:29.826,-95.426;77019:29.754,-95.409;77020:29.773,-95.314;77021:29.698,-95.357;77022:29.832,-95.38;77023:29.722,-95.318;77024:29.771,-95.512;77025:29.686,-95.435;77026:29.8,-95.329;77027:29.74,-95.446;77028:29.826,-95.286;77029:29.76,-95.256;77030:29.707,-95.402;77031:29.652,-95.546;77032:29.988,-95.353;77033:29.667,-95.335;77034:29.619,-95.191;77035:29.653,-95.475;77036:29.702,-95.535;77037:29.89,-95.393;77038:29.919,-95.441;77039:29.911,-95.341;77040:29.875,-95.527;77041:29.859,-95.581;77042:29.741,-95.56;77043:29.813,-95.584;77044:29.907,-95.181;77045:29.636,-95.433;77046:29.734,-95.433;77047:29.611,-95.387;77048:29.619,-95.324;77049:29.833,-95.149;77050:29.903,-95.269;77051:29.656,-95.379;77053:29.584,-95.461;77054:29.68,-95.405;77055:29.797,-95.492;77056:29.748,-95.469;77057:29.744,-95.488;77058:29.562,-95.1;77059:29.614,-95.119;77060:29.935,-95.395;77061:29.647,-95.277;77062:29.574,-95.131;77063:29.736,-95.523;77064:29.918,-95.536;77065:29.927,-95.603;77066:29.957,-95.503;77067:29.953,-95.447;77068:30.007,-95.488;77069:29.988,-95.531;77070:29.98,-95.573;77071:29.652,-95.521;77072:29.7,-95.585;77073:29.999,-95.4;77074:29.688,-95.516;77075:29.62,-95.269;77076:29.86,-95.382;77077:29.75,-95.615;77078:29.852,-95.254;77079:29.776,-95.603;77080:29.816,-95.523;77081:29.712,-95.481;77082:29.724,-95.64;77083:29.694,-95.65;77084:29.827,-95.66;77085:29.621,-95.486;77086:29.918,-95.49;77087:29.686,-95.304;77088:29.881,-95.453;77089:29.587,-95.226;77090:30.008,-95.439;77091:29.853,-95.436;77092:29.83,-95.474;77093:29.863,-95.341;77094:29.769,-95.681;77095:29.909,-95.651;77096:29.675,-95.479;77098:29.735,-95.416;77099:29.671,-95.586;77201:29.766,-95.364;77336:30.063,-95.099;77338:30.017,-95.286;77339:30.047,-95.221;77345:30.053,-95.158;77346:29.994,-95.177;77355:30.156,-95.749;77357:30.161,-95.19;77362:30.161,-95.669;77365:30.107,-95.297;77373:30.062,-95.384;77375:30.095,-95.586;77377:30.062,-95.682;77379:30.041,-95.529;77380:30.137,-95.468;77381:30.178,-95.501;77382:30.195,-95.548;77385:30.188,-95.416;77386:30.1,-95.356;77388:30.059,-95.471;77389:30.123,-95.517;77396:29.944,-95.259;77401:29.704,-95.461;77406:29.646,-95.795;77407:29.67,-95.708;77423:29.848,-95.977;77429:29.998,-95.669;77433:29.934,-95.748;77441:29.67,-95.922;77447:30.048,-95.834;77449:29.838,-95.734;77450:29.746,-95.742;77459:29.529,-95.531;77464:29.592,-95.955;77469:29.483,-95.68;77471:29.548,-95.862;77476:29.688,-95.952;77477:29.624,-95.568;77478:29.62,-95.606;77479:29.567,-95.636;77484:30.08,-95.932;77489:29.6,-95.516;77493:29.853,-95.831;77494:29.741,-95.83;77498:29.644,-95.653;77502:29.68,-95.2;77503:29.703,-95.159;77504:29.648,-95.19;77505:29.646,-95.14;77506:29.714,-95.2;77507:29.625,-95.063;77518:29.507,-94.987;77520:29.733,-94.994;77521:29.802,-94.97;77530:29.786,-95.117;77532:29.933,-95.057;77535:30.054,-94.922;77536:29.698,-95.121;77545:29.537,-95.475;77546:29.515,-95.192;77547:29.736,-95.238;77562:29.833,-95.051;77565:29.536,-95.026;77571:29.688,-95.057;77573:29.504,-95.087;77578:29.481,-95.361;77581:29.562,-95.28;77584:29.545,-95.35;77586:29.584,-95.036;77587:29.661,-95.23;77598:29.539,-95.136".split(";").forEach(s => { const [z, ll] = s.split(":"), [a, b] = (ll || "").split(","); if (z) ZIPS[z] = { lat: +a, lng: +b }; });
"77002:Downtown;77003:EaDo;77004:Third Ward;77005:West University;77006:Montrose;77007:Rice Military;77008:The Heights;77009:Near Northside;77011:East End;77012:Harrisburg;77016:Trinity Gardens;77017:Meadowbrook;77018:Oak Forest;77019:River Oaks;77020:Fifth Ward;77021:South Union;77022:Independence Heights;77023:Eastwood;77024:Memorial;77025:Braeswood;77026:Kashmere Gardens;77027:Highland Village;77028:Settegast;77029:Pleasantville;77030:Medical Center;77033:South Park;77035:Westbury;77036:Sharpstown;77042:Westchase;77045:Hiram Clarke;77051:Sunnyside;77055:Spring Branch;77056:Galleria;77061:Glenbrook Valley;77071:Fondren Southwest;77072:Alief;77074:Sharpstown;77076:Northline;77077:Energy Corridor;77078:East Houston;77080:Spring Branch;77081:Gulfton;77084:Bear Creek;77087:Golfcrest;77088:Acres Homes;77091:Acres Homes;77092:Oak Forest;77093:Eastex;77096:Meyerland;77098:Upper Kirby;77099:Alief;77338:Humble;77339:Kingwood;77345:Kingwood;77346:Humble;77373:Spring;77375:Tomball;77379:Spring;77388:Spring;77401:Bellaire;77429:Cypress;77433:Cypress;77449:Katy;77450:Katy;77477:Stafford;77478:Sugar Land;77479:Sugar Land;77489:Missouri City;77502:Pasadena;77503:Pasadena;77504:Pasadena;77506:Pasadena;77520:Baytown;77521:Baytown;77530:Channelview;77536:Deer Park;77547:Galena Park;77571:La Porte;77581:Pearland;77584:Pearland;77587:South Houston"
  .split(";").forEach(s => { const [z, n] = s.split(":"); if (ZIPS[z]) ZIPS[z].name = n; });
const zipLabel = z => ZIPS[z]?.name ? `${ZIPS[z].name} ${z}` : `Houston ${z}`;

// ---------- the four symbols ----------
const SYM = {
  lumi: '<path d="M0-10C1.2-3 3-1.2 10 0C3 1.2 1.2 3 0 10C-1.2 3-3 1.2-10 0C-3-1.2-1.2-3 0-10Z" fill="currentColor"/>',
  hilo: '<path d="M-8-2L0-10L8-2M-8 3L0 11L8 3" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>',
  silo: '<path d="M-9-7H9M-9 0H9M-9 7H9" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>',
  xilo: '<path d="M-8-8L8 8M8-8L-8 8" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>'
};
const sym = (k, cls = "") => `<svg class="${cls}" viewBox="-13 -13 26 26" aria-hidden="true">${SYM[k]}</svg>`;
const HOUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5L12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---------- Portunus: the deal logic ----------
const COND = { 1: "Heavy rehab", 2: "Needs work", 3: "Dated", 4: "Good shape", 5: "Renovated" };
const REPAIR = { 1: 55, 2: 35, 3: 20, 4: 8, 5: 0 };            // rule-of-thumb repair cost per square foot
const AS_IS = { 1: .55, 2: .72, 3: .9, 4: 1, 5: 1.06 };         // as-is value as a share of repaired value
const TYPES = ["House", "Duplex", "Triplex/Quad", "Townhome", "Condo", "Lot"];
const STATUS = { pending: "In review", active: "Available", under_contract: "Under contract", sold: "Sold", rejected: "Not approved", removed: "Removed" };
const TX = { taxIns: .034, rentRatio: .0075 };                  // Texas tax + insurance per year, and rent per month, as shares of value
const isLot = d => d.property_type === "Lot";
const ruleRepairs = d => isLot(d) ? 0 : Math.round((REPAIR[d.condition] * d.sqft + (d.condition <= 3 ? 5000 : 0)) / 500) * 500;

// Silo: does the seller's math hold up against their own comps and common rules of thumb?
function silo(d) {
  const comps = (d.comps || []).filter(c => c.price > 0 && c.sqft > 0), notes = [];
  const compArv = comps.length ? Math.round(median(comps.map(c => c.price / c.sqft)) * d.sqft / 1000) * 1000 : null;
  const rr = ruleRepairs(d), gap = compArv ? d.arv / compArv - 1 : null, rep = rr ? d.repairs / rr : 1;
  let verdict = "ok", label = "Numbers hold";
  const flag = (v, l) => { if (v === "bad" || (v === "warn" && verdict !== "bad")) { verdict = v; label = l; } };
  if (!comps.length) { verdict = "na"; label = "No comps given"; notes.push("The seller gave no sold comps, so the after-repair value is their word only."); }
  else {
    notes.push(`${comps.length} sold comp${comps.length > 1 ? "s" : ""} from the seller point to about ${K(compArv)} after repairs. The seller says ${K(d.arv)}.`);
    if (comps.length === 1) flag("warn", "Only one comp");
    if (gap > .2) flag("bad", "Value above its comps"); else if (gap > .1) flag("warn", "Value looks high");
  }
  const fixer = d.condition <= 3 && !isLot(d);
  if (fixer) {
    notes.push(`A house this size in "${COND[d.condition].toLowerCase()}" condition usually takes about ${K(rr)} of work. The seller says ${K(d.repairs)}.`);
    if (rep < .6) flag("bad", "Repairs far too low"); else if (rep < .8) flag("warn", "Repairs look low");
  }
  const arvUsed = compArv ? Math.min(d.arv, compArv) : d.arv, repUsed = Math.max(d.repairs, fixer ? rr : 0);
  const price = d.asking, closing = .02 * price, hold = .012 * (price + repUsed) * 5, sell = .07 * arvUsed;
  const flipCost = price + repUsed + closing + hold, profit = arvUsed - flipCost - sell;
  const rentEst = !d.rent, rent = d.rent || (isLot(d) ? 0 : Math.round(arvUsed * TX.rentRatio / 25) * 25);
  const taxIns = TX.taxIns * arvUsed / 12, opex = .25 * rent, cf = rent ? rent - taxIns - opex : 0, allIn = price + repUsed + closing;
  const ceiling = Math.round((.7 * arvUsed - repUsed) / 500) * 500;
  notes.push(price <= ceiling ? `It asks ${K(price)}, under the 70% rule ceiling of ${K(ceiling)}.` : `It asks ${K(price)}. The 70% rule (70% of value, minus repairs) puts a flipper's ceiling near ${K(Math.max(0, ceiling))}.`);
  if (verdict === "ok" && profit < .05 * arvUsed && cf < 100) flag("warn", "Thin margin");
  return { verdict, label, notes, comps, compArv, rr, arvUsed, repUsed, closing, hold, sell, profit, roi: profit / flipCost, rent, rentEst, taxIns, opex, cf, coc: cf * 12 / allIn, allIn, ceiling };
}
// Hilo: one score from 1 (low) to 99 (high)
function hilo(d, c) {
  const s = 45 * clamp(c.profit / c.arvUsed / .18, 0, 1) + 20 * clamp(c.coc / .1, 0, 1) + { ok: 20, warn: 8, na: 5, bad: 0 }[c.verdict]
    + ((d.photos || []).length >= 3 ? 5 : (d.photos || []).length ? 2 : 0) + (c.comps.length >= 3 ? 5 : c.comps.length >= 2 ? 3 : 0) + (d.verified ? 4 : 0);
  return clamp(Math.round(s), 1, 99);
}
const band = s => s >= 70 ? "High" : s >= 45 ? "Mid" : "Low";
// Lumi: does this deal fit this buy box?
function boxMatch(d, b) {
  if (!b.active || d.status !== "active") return false;
  if (b.zips?.length && !b.zips.includes(d.zip)) return false;
  if (d.asking < (b.min_price || 0) || (b.max_price && d.asking > b.max_price)) return false;
  if (b.min_beds && d.beds < b.min_beds) return false;
  if (b.types?.length && !b.types.includes(d.property_type)) return false;
  const flip = d.c.profit >= (b.min_profit || 0), rent = d.c.rent > 0 && d.c.cf >= (b.min_cashflow || 0);
  return b.strategy === "flip" ? flip : b.strategy === "rent" ? rent : flip || rent;
}
const prep = d => { d.c = silo(d); d.score = hilo(d, d.c); return d; };
const fits = d => S.boxes.some(b => boxMatch(d, b));

// ---------- state ----------
let sb = null, memberLoad = Promise.resolve(), hold = false;   // hold: a form is about to send the visitor somewhere, so don't redraw under them
const S = { user: null, profile: null, admin: false, deals: [], priv: {}, boxes: [], saves: new Set(), mine: [], inq: [], interest: {}, stats: null, ready: false, seenAt: "", newCount: 0, cache: {}, recover: false, err: "" };
const F = { zip: "", max: "", beds: "", type: "", fit: false, ver: false, sort: "new" };
const photo = p => `${CFG.supabaseUrl}/storage/v1/object/public/listing-photos/${p.split("/").map(encodeURIComponent).join("/")}`;
const loadScript = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src)); document.head.append(s); });

let loadedAt = 0;
async function loadPublic() {
  loadedAt = Date.now();
  const [d, ic, st] = await Promise.all([
    sb.from("listings").select("*").in("status", ["active", "under_contract"]).order("published_at", { ascending: false }).limit(400),
    sb.rpc("interest_counts"), sb.rpc("site_stats")]);
  if (d.error) { S.err = nice(d.error); return; }
  S.err = ""; S.deals = d.data.map(prep); S.interest = Object.fromEntries((ic.data || []).map(r => [r.listing_id, r.investors])); S.stats = st.data?.[0] || null;
}
async function loadMember() {
  if (!S.user) return Object.assign(S, { profile: null, admin: false, priv: {}, boxes: [], saves: new Set(), mine: [], inq: [], newCount: 0, seenAt: "", cache: {} });
  const u = S.user.id;
  const [p, a, pv, b, sv, mine, inq] = await Promise.all([
    sb.from("profiles").select("*").eq("id", u).maybeSingle(), sb.rpc("is_admin"), sb.from("listing_private").select("*"),
    sb.from("buy_boxes").select("*").eq("user_id", u).order("created_at"), sb.from("saves").select("listing_id").eq("user_id", u),
    sb.from("listings").select("*").eq("owner_id", u).order("created_at", { ascending: false }), sb.from("inquiries").select("*").order("created_at", { ascending: false })]);
  if (S.user?.id !== u) return;                       // signed out or switched accounts while this was loading
  let profile = p.data;
  if (!profile && !p.error) {
    const m = S.user.user_metadata || {};
    profile = (await sb.from("profiles").insert({ id: u, role: ["investor", "wholesaler", "owner"].includes(m.role) ? m.role : "investor", name: m.name || "", phone: m.phone || "", email: S.user.email || "" }).select().maybeSingle()).data;
  }
  const priv = {}; (pv.data || []).forEach(x => priv[x.listing_id] = x);
  Object.assign(S, { profile, admin: a.data === true, priv, boxes: b.data || [], saves: new Set((sv.data || []).map(x => x.listing_id)), mine: (mine.data || []).map(prep), inq: inq.data || [], seenAt: profile?.seen_at || "", cache: {} });
  S.newCount = S.deals.filter(d => fits(d) && after(d.published_at, S.seenAt)).length;
}
// people keep tabs open: when they move between pages, pick up deals posted since the page loaded
async function freshen(name) {
  if (!sb || Date.now() - loadedAt < 60000) return;
  await loadPublic(); await loadMember();
  if (lastRoute.split("/")[0] === name && !document.activeElement?.matches?.("input,select,textarea")) route();
}
const reload = async () => { await loadPublic(); await loadMember(); nav(); route(); };
const go = h => { if (location.hash === h) route(); else location.hash = h; };
const need = () => { if (S.user) return true; toast("Sign in or join free to do that"); location.hash = "#/account"; return false; };
const nice = e => { const m = e?.message || String(e);
  return /check constraint/.test(m) ? "one of the values is out of range. Check the numbers and try again" : /row-level security|permission denied/.test(m) ? "your account is not allowed to do that"
    : /duplicate key/.test(m) ? "that is already saved" : /Failed to fetch|NetworkError|Load failed/i.test(m) ? "no connection. Check your internet and try again" : m; };
const fail = (e, what) => { toast(`${what}: ${nice(e)}`); return false; };

// ---------- shell ----------
function nav() {
  const here = (location.hash.slice(2) || "").split("/")[0];
  const items = LIVE ? [["deals", "Deals"], ["post", "Post a deal"], ["buybox", "Buy box"], ["owners", "Homeowners"]] : [];
  $("#nav").innerHTML = items.map(([r, t]) => `<a href="#/${r}"${r === here ? ' aria-current="page"' : ""}>${t}${r === "buybox" && S.newCount ? ` <span class="badge" title="New matches since your last visit">${S.newCount}</span>` : ""}</a>`).join("");
  $("#acct").innerHTML = !LIVE ? `<a class="btn sm" href="#/early">Get early access</a>`
    : S.user ? `${S.admin ? '<a class="btn sm ghost" href="#/admin">Admin</a>' : ""}<a class="btn sm ghost hide-s" href="#/mine">My deals</a><a class="btn sm ghost" href="#/account">${esc((S.profile?.name || "").split(" ")[0] || "Account")}</a>`
    : `<a class="btn sm ghost" href="#/account">Sign in</a><a class="btn sm" href="#/account/join">Join free</a>`;
}
const ILOS = [
  ["silo", "Silo checks it", "Asking price against after-repair value, repairs, and the sold comps the seller gives. If the value sits above its own comps or the repairs look light, the deal says so."],
  ["hilo", "Hilo scores it", "One number from 1 to 99, built from the flip margin, the rental return and how well the numbers are backed up."],
  ["lumi", "Lumi matches it", "Each deal is matched against buy boxes. Buyers see what fits them, and sellers see how many buyers want a zip before they post."],
  ["xilo", "Xilo flags what's new", "When you come back, the deals that matched since your last visit are marked."]];
const crew = () => `<section class="band"><h2>Four ilos work on every deal</h2>
  <ul class="crew">${ILOS.map(([k, h, p]) => `<li style="--c:var(--${k})"><canvas data-ilo="${k}" role="img" aria-label="${cap(k)}, a 3D model. Drag sideways to turn it."></canvas>${sym(k, "glyph")}<div class="shelf"><h3>${h}</h3><p>${p}</p></div></li>`).join("")}</ul>
  <p class="muted small" style="margin:14px 0 0">The engine the four of them run on is called Portunus, after the Roman god of keys and doors.</p></section>`;
let ilosMod;
async function ilos() {
  if (!$("canvas[data-ilo]")) return;
  try { ilosMod ||= await import("./ilos3d.js"); ilosMod.mountIlos(document); } catch (e) { document.documentElement.classList.add("no3d"); }
}

// ---------- pieces ----------
const typeWord = d => d.property_type.toLowerCase();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const title = d => d.headline || cap(`${d.beds && !isLot(d) ? d.beds + " bed " : ""}${typeWord(d)} in ${d.area || zipLabel(d.zip)}`);
const sub = d => (isLot(d) ? [d.headline ? "Lot" : "", `${num(d.sqft)} sq ft`, d.headline ? (d.area || zipLabel(d.zip)) : d.zip]
  : [d.headline ? `${d.beds ? d.beds + " bd, " : ""}${+d.baths ? +d.baths + " ba " : ""}${typeWord(d)}` : (+d.baths ? +d.baths + " bath" : ""), `${num(d.sqft)} sq ft`, d.year_built ? "built " + d.year_built : "", COND[d.condition].toLowerCase(), d.headline ? (d.area || zipLabel(d.zip)) : d.zip]).filter(Boolean).join(", ");
const stamp = c => `<span class="pill stamp ${c.verdict}" title="Silo's check of the seller's numbers">${sym("silo")}${esc(c.label)}</span>`;
const scoreChip = d => `<span class="pill score" title="Hilo's score, 1 to 99"><span>Hilo ${d.score} ${band(d.score)}</span></span>`;
const profitColor = c => `var(--${c.profit >= 15000 ? "ok" : c.profit > 0 ? "warn" : "bad"})`;
function card(d) {
  const c = d.c, m = fits(d), n = S.interest[d.id];
  return `<a class="deal" href="#/deal/${d.id}">
    <div class="ph">${d.photos?.[0] ? `<img src="${esc(photo(d.photos[0]))}" alt="" loading="lazy">` : HOUSE}${d.status !== "active" ? `<span class="pill over">${STATUS[d.status]}</span>` : ""}</div>
    <div class="bd"><div class="spread"><h3>${esc(title(d))}</h3><div class="price num">${K(d.asking)}</div></div>
      <div class="muted small">${esc(sub(d))}</div>
      <div class="tags">${stamp(c)}${scoreChip(d)}${d.verified ? '<span class="pill ver" title="Hausilo has seen proof of the contract or deed">Proof seen</span>' : ""}${m ? `<span class="pill match">${sym("lumi")}Fits your buy box</span>` : ""}${m && S.user && after(d.published_at, S.seenAt) ? `<span class="pill new">${sym("xilo")}New</span>` : ""}${n ? `<span class="pill">${n} interested</span>` : ""}</div>
      <div class="nums"><div><span>${isLot(d) ? "Resale value" : "After repairs"}</span><b>${K(c.arvUsed)}</b></div><div><span>Repairs</span><b>${K(c.repUsed)}</b></div><div><span>${isLot(d) ? "Resale profit" : "Flip profit"}</span><b style="color:${profitColor(c)}">${K(c.profit)}</b></div></div>
    </div></a>`;
}
const calcs = (d, c = d.c) => `<div class="two">
  <div><h3>${isLot(d) ? "If you resell it" : "If you flip it"}</h3><div class="calc" style="margin-top:8px">
    <span>${isLot(d) ? "Sells for" : "Sells for, after repairs"}</span><b>${usd(c.arvUsed)}</b><span>Buy price</span><b>-${usd(d.asking)}</b><span>${isLot(d) ? "Clearing and prep" : "Repairs"}</span><b>-${usd(c.repUsed)}</b>
    <span>Closing (2%)</span><b>-${usd(c.closing)}</b><span>Holding, 5 months</span><b>-${usd(c.hold)}</b><span>Selling costs (7%)</span><b>-${usd(c.sell)}</b>
    <span class="t">Profit</span><b class="t" style="color:${profitColor(c)}">${usd(c.profit)}</b></div>
    <p class="muted small" style="margin:6px 0 0">${Math.round(c.roi * 100)}% return on the cash you put in.</p></div>
  ${c.rent ? `<div><h3>If you rent it</h3><div class="calc" style="margin-top:8px">
    <span>Rent${c.rentEst ? " (estimate)" : " (seller's number)"}</span><b>${usd(c.rent)}/mo</b><span>Taxes and insurance, Texas rates</span><b>-${usd(c.taxIns)}</b><span>Vacancy, upkeep, management (25%)</span><b>-${usd(c.opex)}</b>
    <span class="t">Cash flow</span><b class="t">${usd(c.cf)}/mo</b></div>
    <p class="muted small" style="margin:6px 0 0">${(c.coc * 100).toFixed(1)}% a year on ${K(c.allIn)} all in, before any loan.</p></div>` : ""}</div>`;
const siloPanel = (d, c = d.c) => `<div class="sheet"><div class="rowx" style="margin-bottom:8px">${stamp(c)}${d.score ? scoreChip(d) : ""}</div>
  <h3>Silo's check</h3><ul style="margin:8px 0 0;padding-left:18px">${c.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>
  <p class="muted small" style="margin:10px 0 0">Silo checks the seller's own numbers. It uses the lower value and the higher repair figure below, so the profit shown leans cautious. It has not seen the house.</p></div>`;

// ---------- home ----------
function home() {
  const st = S.stats, latest = S.deals.filter(d => d.status === "active").slice(0, 3);
  const newest = latest.length ? `<section class="band"><div class="spread" style="margin-bottom:12px"><h2>Newest deals</h2><a href="#/deals">See all ${S.deals.length}</a></div><div class="grid">${latest.map(card).join("")}</div></section>` : "";
  return `<section class="hero">
      <h1>Off-market Houston deals, checked before you call.</h1>
      <p class="lede" style="margin:16px 0 20px">Hausilo is where Houston wholesalers and homeowners put deals in front of cash buyers. Every deal's math is checked and scored, matched to your buy box, and flagged when it's new.</p>
      <div class="rowx">${LIVE ? `<a class="btn" href="#/deals">Browse deals</a><a class="btn ghost" href="#/post">Post a deal</a>` : `<a class="btn" href="#/early">Get early access</a>`}</div>
      ${LIVE && st && (st.deals || st.buyers) ? `<p class="muted small" style="margin:16px 0 0">${[st.deals ? `${st.deals} deal${st.deals === 1 ? "" : "s"} live.` : "", st.buyers ? `${st.buyers} buyer${st.buyers === 1 ? "" : "s"} with a buy box saved.` : ""].join(" ")}</p>` : ""}
    </section>
  ${newest}${crew()}
  <section class="three band">
    <div class="sheet"><h3>You buy houses</h3><p class="muted" style="margin:6px 0 10px">Save where you buy and what you pay. Deals that fit show up first, with the flip and rental math already worked out.</p>${LIVE ? '<a href="#/buybox">Set your buy box</a>' : ""}</div>
    <div class="sheet"><h3>You wholesale</h3><p class="muted" style="margin:6px 0 10px">Post a deal and see how many buyers want that zip at your price. Numbers that hold up get a clean stamp buyers trust.</p>${LIVE ? '<a href="#/post">Post a deal</a>' : ""}</div>
    <div class="sheet"><h3>You own the house</h3><p class="muted" style="margin:6px 0 10px">See a cash investor's likely range next to what an agent sale would leave you, before you talk to anyone.</p>${LIVE ? '<a href="#/owners">See your numbers</a>' : ""}</div>
  </section>
  ${LIVE ? "" : early()}`;
}
const early = () => `<section id="early" style="margin-top:8px"><h2 style="margin-bottom:12px">Get early access</h2><div class="two">
  <form class="sheet" data-form="mail" data-subject="My buy box"><h3>Investors and wholesalers</h3>
    <label>Name<input name="Name" required maxlength="80"></label><label>Phone or email<input name="Contact" required maxlength="120"></label>
    <label>Zips or areas you buy in<input name="Zips or areas" maxlength="160" placeholder="77026, 77028, Northside"></label>
    <div class="f2"><label>Max price<input name="Max price" inputmode="numeric" maxlength="20" placeholder="$150,000"></label><label>Plan<select name="Plan"><option>Flip or rent</option><option>Flip</option><option>Rent</option><option>I wholesale</option></select></label></div>
    <button class="btn" style="justify-self:start">Send my buy box</button></form>
  <form class="sheet" data-form="mail" data-subject="Cash offer request"><h3>Homeowners</h3>
    <label>Name<input name="Name" required maxlength="80"></label><label>Phone or email<input name="Contact" required maxlength="120"></label>
    <label>Property address<input name="Address" required maxlength="160"></label>
    <label>When would you like to sell?<select name="Timeline"><option>As soon as possible</option><option>Within 3 months</option><option>Within a year</option><option>Just exploring</option></select></label>
    <button class="btn" style="justify-self:start">Ask for an offer</button></form></div>
  <p class="muted small" style="margin-top:10px">Each button opens your email app with your answers filled in, addressed to hello@hausilo.com.</p></section>`;
const soon = () => `<div class="empty"><h2 style="color:var(--ink)">Opening soon</h2><p style="margin-top:8px">Deals, buy boxes and accounts switch on shortly. <a href="#/early">Get early access</a> and you'll hear first.</p></div>`;

// ---------- deals list + map ----------
function dealList() {
  let ds = S.deals.filter(d => (!F.zip || d.zip === F.zip || (d.area || "").toLowerCase().includes(F.zip.toLowerCase())) && (!F.max || d.asking <= money(F.max)) && (!F.beds || d.beds >= +F.beds) && (!F.type || d.property_type === F.type) && (!F.fit || fits(d)) && (!F.ver || d.c.verdict === "ok"));
  const by = { new: (a, b) => (b.published_at || "").localeCompare(a.published_at || ""), score: (a, b) => b.score - a.score, profit: (a, b) => b.c.profit - a.c.profit, cash: (a, b) => b.c.cf - a.c.cf, price: (a, b) => a.asking - b.asking };
  return ds.sort((a, b) => (b.featured - a.featured) || by[F.sort](a, b));
}
const gridHtml = ds => ds.length ? ds.map(card).join("") : `<div class="empty" style="grid-column:1/-1">${S.err ? "Could not load deals: " + esc(S.err) : S.deals.length ? "No deals fit these filters." : `No deals are live yet. <a href="#/post">Post the first one</a>, or <a href="#/buybox">save a buy box</a> so new deals reach you first.`}</div>`;
function deals() {
  if (!LIVE) return soon();
  const zs = [...new Set(S.deals.map(d => d.zip))].sort();
  return `<div class="spread"><h1>Deals</h1><span class="muted">${S.deals.length} live in the Houston area</span></div>
  <form class="filters" data-live="filters">
    <label>Zip or area<input name="zip" list="zl" value="${esc(F.zip)}" placeholder="Any" style="width:150px"><datalist id="zl">${zs.map(z => `<option value="${z}">${esc(zipLabel(z))}</option>`).join("")}</datalist></label>
    <label>Max price<input name="max" inputmode="numeric" value="${esc(F.max)}" placeholder="Any" style="width:120px"></label>
    <label>Beds<select name="beds">${["", 1, 2, 3, 4].map(b => `<option value="${b}"${String(F.beds) === String(b) ? " selected" : ""}>${b ? b + "+" : "Any"}</option>`).join("")}</select></label>
    <label>Type<select name="type"><option value="">Any</option>${TYPES.map(t => `<option${F.type === t ? " selected" : ""}>${t}</option>`).join("")}</select></label>
    <label>Sort<select name="sort">${[["new", "Newest"], ["score", "Hilo score"], ["profit", "Flip profit"], ["cash", "Cash flow"], ["price", "Lowest price"]].map(([v, t]) => `<option value="${v}"${F.sort === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="ck" style="padding-bottom:9px"><input type="checkbox" name="ver"${F.ver ? " checked" : ""}>Numbers hold</label>
    ${S.boxes.length ? `<label class="ck" style="padding-bottom:9px"><input type="checkbox" name="fit"${F.fit ? " checked" : ""}>Fits my buy box</label>` : ""}
  </form>
  <div class="cols"><div class="grid" id="grid">${gridHtml(dealList())}</div><div class="side"><div id="map" aria-label="Map of deals. Pins are placed by zip code, not exact address."></div><p class="muted small" style="margin:0">Pins sit near the middle of each deal's zip code. Members see the street address on the deal.</p></div></div>`;
}
let Lp, map, pins;
const leaflet = () => Lp ||= (async () => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"; document.head.append(l); await loadScript("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"); return window.L; })();
async function drawMap(ds) {
  const el = $("#map"); if (!el) return;
  let L; try { L = await leaflet(); } catch { el.textContent = ""; return; }
  if (!$("#map")) return;
  if (map && map.getContainer() !== el) { try { map.remove(); } catch {} map = null; }
  if (!map) { map = L.map(el, { scrollWheelZoom: false }).setView([29.76, -95.37], 10); L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map); pins = L.layerGroup().addTo(map); }
  pins.clearLayers(); const pts = [];
  for (const d of ds) { if (d.lat == null || d.lng == null) continue; pts.push([d.lat, d.lng]);
    L.marker([d.lat, d.lng], { icon: L.divIcon({ className: "", html: `<span class="pin">${K(d.asking)}</span>`, iconSize: null, iconAnchor: [22, 12] }), title: title(d) }).on("click", () => { location.hash = "#/deal/" + d.id; }).addTo(pins); }
  if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 13, animate: false });
}

// ---------- one deal ----------
function deal(id) {
  if (!LIVE) return soon();
  let d = S.deals.find(x => x.id === id) || S.mine.find(x => x.id === id) || S.cache["d" + id];
  if (d === undefined) { S.cache["d" + id] = null; sb.from("listings").select("*").eq("id", id).maybeSingle().then(r => { S.cache["d" + id] = r.data ? prep(r.data) : false; route(); }); }
  if (!d) return d === false ? `<div class="empty">That deal is not available any more. <a href="#/deals">See live deals</a></div>` : `<p class="muted">Loading the deal…</p>`;
  const c = d.c, pv = S.priv[d.id], own = S.user && d.owner_id === S.user.id, mineInq = S.inq.find(i => i.listing_id === d.id && i.from_user === S.user?.id), ph = d.photos || [];
  const contact = pv ? `<div class="sheet"><h3>Address and contact</h3><p style="margin:8px 0 2px"><b>${esc(pv.street)}</b>, Houston, TX ${d.zip}</p>
      <p class="small" style="margin:0 0 8px"><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pv.street + ", Houston, TX " + d.zip)}">Open in Google Maps</a></p>
      <p style="margin:0">${esc(pv.contact_name)}${pv.contact_phone ? `, <a href="tel:${esc(pv.contact_phone)}">${esc(pv.contact_phone)}</a>` : ""}${pv.contact_email ? `, <a href="mailto:${esc(pv.contact_email)}">${esc(pv.contact_email)}</a>` : ""}</p>
      ${pv.access_notes ? `<p class="muted small" style="margin:6px 0 0">Access: ${esc(pv.access_notes)}</p>` : ""}
      ${own ? "" : d.status === "sold" ? "" : mineInq ? `<div class="note" style="margin-top:10px">You told the seller you're interested on ${day(mineInq.created_at)}. <button class="linkbtn" data-act="uninterest" data-id="${d.id}">Withdraw</button></div>`
        : `<form data-form="interest" data-id="${d.id}" style="margin-top:12px"><label>Tell the seller you're interested (they get your name, phone and email)<textarea name="message" maxlength="1000" style="min-height:70px" placeholder="Cash buyer, can close in 10 days."></textarea></label><button class="btn" style="justify-self:start">I'm interested</button></form>`}</div>`
    : `<div class="sheet"><h3>Address and contact</h3><p class="muted" style="margin:8px 0 12px">${S.user ? "Shown once the deal is live." : "Members see the street address and the seller's phone and email. Joining is free."}</p>${S.user ? "" : '<div class="rowx"><a class="btn" href="#/account/join">Join free</a><a class="btn ghost" href="#/account">Sign in</a></div>'}</div>`;
  const adminBar = S.admin ? `<div class="sheet"><h3>Admin</h3><div class="rowx" style="margin-top:8px">
      ${d.status !== "active" ? `<button class="btn sm" data-act="astatus" data-id="${d.id}" data-v="active">Approve and publish</button>` : ""}
      <button class="btn sm ghost" data-act="aflag" data-id="${d.id}" data-k="verified" data-v="${!d.verified}">${d.verified ? "Remove proof-seen mark" : "Mark proof seen"}</button>
      <button class="btn sm ghost" data-act="aflag" data-id="${d.id}" data-k="featured" data-v="${!d.featured}">${d.featured ? "Stop featuring" : "Feature"}</button></div>
      <form data-form="reject" data-id="${d.id}" class="rowx" style="margin-top:10px;display:flex"><input name="reason" maxlength="300" placeholder="Reason, shown to the poster" style="flex:1;min-width:180px"><button class="btn sm warn">Reject</button></form>
      <p class="muted small" style="margin:8px 0 0">Only mark proof seen after you have looked at the purchase contract or the deed yourself.</p></div>` : "";
  const ownBar = own ? `<div class="sheet"><div class="spread"><h3>Your deal</h3><span class="pill">${STATUS[d.status]}</span></div>${d.status === "rejected" && d.reject_reason ? `<p class="note" style="margin-top:8px"><b>Not approved:</b> ${esc(d.reject_reason)} Edit the deal to send it back for review.</p>` : ""}${d.status === "pending" ? `<p class="muted small" style="margin:8px 0 0">In review. It goes live once Hausilo approves it.</p>` : ""}<div class="rowx" style="margin-top:10px"><a class="btn sm" href="#/edit/${d.id}">Edit</a>${ownActions(d)}</div></div>` : "";
  return `<p class="small"><a href="#/deals">All deals</a></p>
  <div class="cols dealpg"><div class="stack">
    <div class="gal lead"><div class="main" id="gmain">${ph[0] ? `<img src="${esc(photo(ph[0]))}" alt="Photo of the property">` : HOUSE}</div>${ph.length > 1 ? `<div class="thumbs">${ph.map((p, i) => `<button data-act="shot" data-src="${esc(photo(p))}"${i ? "" : ' aria-current="true"'} aria-label="Photo ${i + 1}"><img src="${esc(photo(p))}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}</div>
    <div class="lead"><div class="spread"><h1 style="font-size:clamp(26px,3.4vw,38px)">${esc(title(d))}</h1><div class="price num" style="font-size:34px">${usd(d.asking)}</div></div>
      <p class="muted" style="margin:6px 0 10px">${esc(sub(d))}</p>
      <div class="tags">${d.status !== "active" ? `<span class="pill" style="background:var(--ink);color:var(--paper)">${STATUS[d.status]}</span>` : ""}${d.verified ? '<span class="pill ver" title="Hausilo has seen proof of the contract or deed">Proof seen</span>' : ""}${fits(d) ? `<span class="pill match">${sym("lumi")}Fits your buy box</span>` : ""}<span class="pill">${d.seller_type === "owner" ? "Sold by the owner" : "Contract assignment"}</span>${S.interest[d.id] ? `<span class="pill">${S.interest[d.id]} interested</span>` : ""}</div></div>
    <div class="sheet"><div class="kv">
      <div><span>Asking</span><b>${usd(d.asking)}</b></div><div><span>Seller's after-repair value</span><b>${usd(d.arv)}</b></div><div><span>Seller's repair figure</span><b>${usd(d.repairs)}</b></div>
      <div><span>Occupancy</span><b>${{ vacant: "Vacant", owner: "Owner lives there", tenant: "Tenant in place" }[d.occupancy]}</b></div>${d.close_by ? `<div><span>Close by</span><b>${day(d.close_by + "T12:00:00")}</b></div>` : ""}${d.emd ? `<div><span>Earnest money</span><b>${usd(d.emd)}</b></div>` : ""}
      <div><span>Posted</span><b>${day(d.published_at || d.created_at)}</b></div></div></div>
    <div class="sheet">${calcs(d)}</div>
    ${c.comps.length ? `<div class="sheet"><h3>Comps the seller gave</h3><div class="tbl" style="margin-top:8px"><table><tr><th>Sold for</th><th>Sq ft</th><th>Per sq ft</th><th>Notes</th></tr>${c.comps.map(x => `<tr><td class="num">${usd(x.price)}</td><td class="num">${num(x.sqft)}</td><td class="num">${usd(x.price / x.sqft)}</td><td>${esc(x.note || "")}</td></tr>`).join("")}</table></div><p class="muted small" style="margin:8px 0 0">Texas does not publish sale prices, so comps come from the seller. Check them yourself before you offer.</p></div>` : ""}
    ${d.notes ? `<div class="sheet"><h3>From the seller</h3><p style="white-space:pre-wrap;margin:8px 0 0">${esc(d.notes)}</p></div>` : ""}
    <div class="note">${d.seller_type === "owner" ? "<b>Sold by the owner.</b> The person who posted this says they own the property." : "<b>Contract assignment.</b> The seller of this deal holds a purchase contract on the property (an equitable interest) and is offering to assign that contract. They do not own the property."} Hausilo is not a party to any sale.</div>
  </div><div class="side">${ownBar}${adminBar}${siloPanel(d)}${contact}
    <div class="rowx">${S.user && !own ? `<button class="btn sm ghost" data-act="save" data-id="${d.id}">${S.saves.has(d.id) ? "Saved" : "Save"}</button>` : ""}<button class="btn sm ghost" data-act="share">Copy link</button></div>
    ${S.user && !own ? `<details class="small muted"><summary>Something wrong with this deal?</summary><form data-form="report" data-id="${d.id}" style="margin-top:8px"><input name="reason" required minlength="3" maxlength="500" placeholder="What's wrong?"><button class="btn sm ghost" style="justify-self:start">Send to Hausilo</button></form></details>` : ""}
  </div></div>`;
}
const ownActions = d => (d.status === "active" ? `<button class="btn sm ghost" data-act="status" data-id="${d.id}" data-v="under_contract">Mark under contract</button>` : d.status === "under_contract" ? `<button class="btn sm ghost" data-act="status" data-id="${d.id}" data-v="active">Back to available</button>` : "")
  + (["active", "under_contract"].includes(d.status) ? `<button class="btn sm ghost" data-act="status" data-id="${d.id}" data-v="sold">Mark sold</button>` : "")
  + (d.status !== "removed" ? `<button class="btn sm ghost" data-act="status" data-id="${d.id}" data-v="removed" data-sure="Remove this deal?">Remove</button>` : `<button class="btn sm ghost" data-act="status" data-id="${d.id}" data-v="pending">Send back for review</button>`);

// ---------- post or edit a deal ----------
let P = null;   // the draft being edited
const blank = () => ({ id: null, seller_type: "wholesaler", zip: "", area: "", property_type: "House", beds: 3, baths: 2, sqft: "", year_built: "", condition: 2, occupancy: "vacant", asking: "", arv: "", repairs: "", rent: "", close_by: "", emd: "", headline: "", notes: "", comps: [{}, {}, {}], photos: [], gone: [], street: "", contact_name: S.profile?.name || "", contact_phone: S.profile?.phone || "", contact_email: S.profile?.email || S.user?.email || "", access_notes: "" });
function post(id) {
  if (!LIVE) return soon();
  if (!S.user) return gate("Post a deal", "Join free to post a deal. It takes a minute, and it's how buyers reach you.");
  if (id && (!P || P.id !== id)) {
    const d = S.mine.find(x => x.id === id) || (S.admin && (S.deals.find(x => x.id === id) || S.cache["d" + id])), pv = S.priv[id];
    if (!d) return `<div class="empty">That deal isn't yours to edit. <a href="#/mine">See your deals</a></div>`;
    P = { ...blank(), ...d, ...(pv || {}), id, zip0: d.zip, photos0: (d.photos || []).join("|"), status0: d.status, comps: [...(d.comps || []), {}, {}, {}].slice(0, Math.max(3, (d.comps || []).length)), photos: (d.photos || []).map(p => ({ path: p, url: photo(p) })), gone: [], close_by: d.close_by || "", rent: d.rent || "", emd: d.emd || "", year_built: d.year_built || "" };
  } else if (!id && (!P || P.id)) P = blank();
  if (!P.id && S.profile) { P.contact_name ||= S.profile.name; P.contact_phone ||= S.profile.phone; P.contact_email ||= S.profile.email || S.user.email || ""; }
  const v = P, sel = (name, opts, cur) => `<select name="${name}">${opts.map(o => { const [val, txt] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}"${String(cur) === String(val) ? " selected" : ""}>${esc(txt)}</option>`; }).join("")}</select>`;
  return `<h1>${id ? "Edit your deal" : "Post a deal"}</h1><p class="lede" style="margin:8px 0 18px">${id ? "Price changes go live right away. Changes to photos, words or the address go back to Hausilo for a quick review." : "Hausilo reviews every deal before it goes live, usually within a day."}</p>
  <div class="cols"><form class="sheet" data-form="post" data-live="post" novalidate>
    <fieldset><legend>Who is selling</legend><div class="roles" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <label><input type="radio" name="seller_type" value="wholesaler"${v.seller_type === "wholesaler" ? " checked" : ""}>I have it under contract<span>You're assigning your purchase contract</span></label>
      <label><input type="radio" name="seller_type" value="owner"${v.seller_type === "owner" ? " checked" : ""}>I own it<span>Your name is on the deed</span></label></div></fieldset>
    <fieldset><legend>The property</legend>
      <label>Street address (only members see this)<input name="street" required maxlength="140" value="${esc(v.street)}" placeholder="4512 Example St" autocomplete="off"></label>
      <div class="f2"><label>Zip code<input name="zip" required inputmode="numeric" pattern="[0-9]{5}" maxlength="5" value="${esc(v.zip)}" list="pz"><datalist id="pz">${Object.keys(ZIPS).map(z => `<option value="${z}">${esc(ZIPS[z].name || "")}</option>`).join("")}</datalist></label>
        <label>Area or neighborhood<input name="area" maxlength="60" value="${esc(v.area)}" placeholder="Kashmere Gardens"></label></div>
      <div class="f4"><label>Type${sel("property_type", TYPES, v.property_type)}</label><label>Beds<input name="beds" type="number" min="0" max="20" value="${esc(v.beds)}"></label><label>Baths<input name="baths" type="number" min="0" max="20" step="0.5" value="${esc(v.baths)}"></label><label>Sq ft<input name="sqft" inputmode="numeric" required value="${esc(v.sqft)}"></label></div>
      <div class="f3"><label>Year built<input name="year_built" inputmode="numeric" maxlength="4" value="${esc(v.year_built)}"></label><label>Condition${sel("condition", Object.entries(COND), v.condition)}</label><label>Occupancy${sel("occupancy", [["vacant", "Vacant"], ["owner", "Owner lives there"], ["tenant", "Tenant in place"]], v.occupancy)}</label></div></fieldset>
    <fieldset><legend>The deal</legend>
      <div class="f3"><label>Asking price (what the buyer pays)<input name="asking" inputmode="numeric" required value="${esc(v.asking)}" placeholder="78,000"></label><label>Value after repairs<input name="arv" inputmode="numeric" required value="${esc(v.arv)}" placeholder="165,000"></label><label>Repairs needed<input name="repairs" inputmode="numeric" required value="${esc(v.repairs)}" placeholder="38,000"></label></div>
      <div class="f3"><label>Monthly rent, if you know it<input name="rent" inputmode="numeric" value="${esc(v.rent)}"></label><label>Must close by<input name="close_by" type="date" value="${esc(v.close_by)}"></label><label>Earnest money<input name="emd" inputmode="numeric" value="${esc(v.emd)}"></label></div></fieldset>
    <fieldset><legend>Sold comps</legend><p class="muted small" style="margin:0">Fixed-up houses near this one that sold in the last six months or so. Two or more lets Silo back up your value.</p>
      ${v.comps.map((c, i) => `<div class="f3"><label>Sold for<input name="cp${i}" inputmode="numeric" value="${esc(c.price || "")}"></label><label>Sq ft<input name="cs${i}" inputmode="numeric" value="${esc(c.sqft || "")}"></label><label>Street and when<input name="cn${i}" maxlength="80" value="${esc(c.note || "")}" placeholder="4400 Lavender, Aug"></label></div>`).join("")}
      ${v.comps.length < 6 ? '<button type="button" class="linkbtn" data-act="addcomp" style="justify-self:start">Add another comp</button>' : ""}</fieldset>
    <fieldset><legend>Photos</legend><div class="shots" id="shots">${shots()}</div>
      <label>Add up to 8 photos<input type="file" id="pfile" accept="image/jpeg,image/png,image/webp" multiple></label></fieldset>
    <fieldset><legend>In your words</legend><label>Headline (optional)<input name="headline" maxlength="90" value="${esc(v.headline)}" placeholder="Brick 3/1 two blocks from the park"></label>
      <label>Notes for buyers<textarea name="notes" maxlength="3000" placeholder="Roof, foundation, what's been done, what's left, how to see it.">${esc(v.notes)}</textarea></label>
      <p class="muted small" style="margin:0">Describe the house, not the people. Fair housing law bars wording about race, religion, family, disability and the like.</p></fieldset>
    <fieldset><legend>How buyers reach you</legend><div class="f3"><label>Name<input name="contact_name" required maxlength="80" value="${esc(v.contact_name)}"></label><label>Phone<input name="contact_phone" maxlength="30" value="${esc(v.contact_phone)}"></label><label>Email<input name="contact_email" type="email" maxlength="200" value="${esc(v.contact_email)}"></label></div>
      <label>Access notes (optional)<input name="access_notes" maxlength="500" value="${esc(v.access_notes)}" placeholder="Lockbox on the back door, text first"></label></fieldset>
    <label class="ck"><input type="checkbox" name="ack" required><span id="ackt">${ackText(v.seller_type)}</span></label>
    <label class="ck"><input type="checkbox" name="true" required><span>The numbers and photos are accurate as far as I know.</span></label>
    <div class="rowx"><button class="btn">${id ? "Save changes" : "Send for review"}</button><a href="#/mine">Cancel</a></div>
  </form><div class="side" id="postside">${postSide()}</div></div>`;
}
const ackText = t => t === "owner" ? "I own this property or have the legal right to sell it." : "I am selling my purchase contract (an equitable interest), not the property itself. I have told the owner this in writing, as Texas law requires, and I will tell every buyer.";
const shots = () => P.photos.map((p, i) => `<div><img src="${esc(p.url)}" alt="Photo ${i + 1}"><button type="button" data-act="rmshot" data-i="${i}" aria-label="Remove photo ${i + 1}">&times;</button></div>`).join("") || '<span class="muted small">No photos yet. Deals with photos get more interest.</span>';
function readPost(f) {
  const g = n => (f.elements[n]?.value ?? "").trim(), v = P;
  Object.assign(v, { seller_type: f.elements.seller_type.value, street: g("street"), zip: g("zip"), area: g("area"), property_type: g("property_type"), beds: +g("beds") || 0, baths: +g("baths") || 0, sqft: money(g("sqft")), year_built: +g("year_built") || "", condition: +g("condition"), occupancy: g("occupancy"),
    asking: money(g("asking")), arv: money(g("arv")), repairs: money(g("repairs")), rent: money(g("rent")) || "", close_by: g("close_by"), emd: money(g("emd")) || "", headline: g("headline"), notes: g("notes"), contact_name: g("contact_name"), contact_phone: g("contact_phone"), contact_email: g("contact_email"), access_notes: g("access_notes") });
  v.comps = v.comps.map((_, i) => ({ price: money(g("cp" + i)) || "", sqft: money(g("cs" + i)) || "", note: g("cn" + i) }));
  return v;
}
function postSide() {
  const v = P; if (!(v.sqft > 0 && v.asking > 0 && v.arv > 0)) return `<div class="sheet"><h3>Silo's check</h3><p class="muted" style="margin:8px 0 0">Fill in the size, asking price and after-repair value, and Silo checks the math as you type.</p></div>`;
  const d = prep({ ...v, repairs: +v.repairs || 0, rent: +v.rent || 0, comps: v.comps.filter(c => c.price && c.sqft), photos: v.photos, status: "active" });
  return `${siloPanel(d)}<div class="sheet" id="demand"><h3>Buyers for this</h3><p class="muted" style="margin:8px 0 0">${v.demand == null ? "Enter the zip to see how many saved buy boxes it fits." : v.demand ? `<b style="color:var(--ink)">${v.demand} buyer${v.demand === 1 ? "" : "s"}</b> on Hausilo want${v.demand === 1 ? "s" : ""} ${esc(v.zip)} at this price.` : `No saved buy box covers ${esc(v.zip)} at this price yet.`}</p></div><div class="sheet">${calcs(d)}</div>`;
}
let demandT;
function askDemand() { clearTimeout(demandT); const v = P; if (!/^\d{5}$/.test(v.zip)) return; demandT = setTimeout(async () => { const r = await sb.rpc("buyer_count", { p_zip: v.zip, p_price: Math.round(v.asking) || 0 }); if (P !== v) return; v.demand = r.error ? null : r.data; const s = $("#postside"); if (s) s.innerHTML = postSide(); }, 500); }
async function shrink(file) {
  try { const bm = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bm.width, bm.height)), c = document.createElement("canvas"); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), "image/jpeg", .82)); } catch { return file; }
}
async function savePost(f) {
  if (!need()) return;
  const v = readPost(f), bad = m => { toast(m); return false; };
  if (v.street.length < 3) return bad("Add the street address"); if (!/^\d{5}$/.test(v.zip)) return bad("Add the 5-digit zip code");
  if (!(v.sqft >= 100 && v.sqft <= 50000)) return bad("Add the square footage"); if (!(v.asking >= 1000 && v.arv >= 1000)) return bad("Add the asking price and the value after repairs");
  if (v.contact_name.length < 2 || !(v.contact_phone || v.contact_email)) return bad("Add your name and a phone or email");
  if (!f.elements.ack.checked || !f.elements.true.checked) return bad("Tick both boxes at the bottom to post");
  const btn = $("button.btn", f); btn.disabled = true; btn.textContent = "Saving…";
  const done = ok => { btn.disabled = false; btn.textContent = v.id ? "Save changes" : "Send for review"; return ok; };
  const z = ZIPS[v.zip], jit = s => ((parseInt(s, 36) % 1000) / 1000 - .5) * .012, key = Math.random().toString(36).slice(2, 8);
  const pub = { seller_type: v.seller_type, zip: v.zip, area: v.area || (z?.name || ""), property_type: v.property_type, beds: v.beds, baths: v.baths, sqft: Math.round(v.sqft), year_built: year(v.year_built), condition: v.condition, occupancy: v.occupancy, asking: Math.round(v.asking), arv: Math.round(v.arv), repairs: Math.round(+v.repairs || 0), rent: v.rent ? Math.round(v.rent) : null, close_by: v.close_by || null, emd: v.emd ? Math.round(v.emd) : null, headline: v.headline, notes: v.notes, comps: v.comps.filter(c => c.price && c.sqft) };
  const prv = { street: v.street, contact_name: v.contact_name, contact_phone: v.contact_phone, contact_email: v.contact_email, access_notes: v.access_notes };
  let id = v.id;
  if (!id) {
    if (z) { pub.lat = +(z.lat + jit(key)).toFixed(4); pub.lng = +(z.lng + jit(key.split("").reverse().join(""))).toFixed(4); }
    const r = await sb.from("listings").insert({ ...pub, disclosure_ack_at: new Date().toISOString() }).select().single(); if (r.error) return done(fail(r.error, "Could not save the deal"));
    id = r.data.id; const pr = await sb.from("listing_private").insert({ listing_id: id, ...prv });
    if (pr.error) { await sb.from("listings").delete().eq("id", id); return done(fail(pr.error, "Could not save the deal")); }
  } else {
    const pr = await sb.from("listing_private").update(prv).eq("listing_id", id); if (pr.error) return done(fail(pr.error, "Could not save the deal"));
    if (z && v.zip !== v.zip0) { pub.lat = +(z.lat + jit(key)).toFixed(4); pub.lng = +(z.lng + jit(key.split("").reverse().join(""))).toFixed(4); }
    if (v.status0 === "rejected") pub.status = "pending";
    const r = await sb.from("listings").update(pub).eq("id", id); if (r.error) return done(fail(r.error, "Could not save the deal"));
  }
  const paths = []; let missed = 0;
  for (const p of v.photos) {
    if (p.path) { paths.push(p.path); continue; }
    const path = `${S.user.id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`, up = await sb.storage.from("listing-photos").upload(path, await shrink(p.file), { contentType: "image/jpeg" });
    if (up.error) missed++; else paths.push(path);
  }
  if (paths.join("|") !== (v.photos0 || "")) { const r = await sb.from("listings").update({ photos: paths }).eq("id", id); if (r.error) fail(r.error, "Photos were not saved"); }
  if (v.gone.length) await sb.storage.from("listing-photos").remove(v.gone);
  P = null; S.cache = {}; await loadPublic(); await loadMember(); nav(); location.hash = "#/mine";
  toast(missed ? `Saved, but ${missed} photo${missed > 1 ? "s" : ""} did not upload. Edit the deal to try again.` : v.id ? "Saved." : "Sent for review. It goes live once Hausilo approves it.");
}

// ---------- my deals ----------
function mine() {
  if (!LIVE) return soon(); if (!S.user) return gate("Your deals", "Sign in to see the deals you posted and who's interested.");
  const ids = new Set(S.mine.map(d => d.id)), saved = S.deals.filter(d => S.saves.has(d.id));
  return `<div class="spread"><h1>Your deals</h1><a class="btn" href="#/post">Post a deal</a></div>
  <div style="display:grid;gap:14px;margin-top:16px">${S.mine.length ? S.mine.map(d => { const q = S.inq.filter(i => i.listing_id === d.id && i.from_user !== S.user.id);
    return `<div class="sheet"><div class="spread"><h3><a href="#/deal/${d.id}">${esc(title(d))}</a></h3><span class="rowx"><span class="pill"${d.status === "active" ? ' style="background:var(--accent-soft);color:var(--accent)"' : ""}>${STATUS[d.status]}</span><b class="num">${usd(d.asking)}</b></span></div>
      <p class="muted small" style="margin:4px 0 8px">${esc(S.priv[d.id]?.street || "")} ${d.zip}. Posted ${day(d.created_at)}.</p>
      ${d.status === "rejected" && d.reject_reason ? `<p class="note"><b>Not approved:</b> ${esc(d.reject_reason)} Edit it to send it back for review.</p>` : ""}
      <div class="rowx"><a class="btn sm" href="#/edit/${d.id}">Edit</a>${ownActions(d)}</div>
      <h3 style="font-size:16px;margin-top:14px">${q.length ? `${q.length} interested buyer${q.length > 1 ? "s" : ""}` : "No interest yet"}</h3>
      ${q.length ? `<div class="tbl"><table>${q.map(i => `<tr><td><b>${esc(i.name)}</b><br><span class="muted small">${day(i.created_at)}</span></td><td>${i.phone ? `<a href="tel:${esc(i.phone)}">${esc(i.phone)}</a><br>` : ""}${i.email ? `<a href="mailto:${esc(i.email)}">${esc(i.email)}</a>` : ""}</td><td>${esc(i.message)}</td></tr>`).join("")}</table></div>` : ""}</div>`; }).join("")
    : `<div class="empty">You haven't posted a deal yet. <a href="#/post">Post one</a> and see how many buyers want that zip.</div>`}</div>
  ${saved.length ? `<h2 style="margin:28px 0 12px">Saved deals</h2><div class="grid">${saved.map(card).join("")}</div>` : ""}`;
}

// ---------- buy boxes ----------
let B = null;
function buybox(id) {
  if (!LIVE) return soon(); if (!S.user) return gate("Your buy box", "Join free and save what you buy. Deals that fit reach you first.");
  const fresh0 = () => ({ id: null, label: "", zips: [], min_price: "", max_price: "", min_beds: 0, types: [], strategy: "both", min_profit: "", min_cashflow: "", active: true });
  if (id === "new") B = fresh0();
  else if (id) { const b = S.boxes.find(x => x.id === id); B = b ? { ...b, zips: [...b.zips], types: [...b.types] } : null; }
  else B = S.boxes.length ? null : fresh0();
  const hits = S.deals.filter(fits), fresh = hits.filter(d => after(d.published_at, S.seenAt)).length;
  if (S.newCount && !id) setTimeout(async () => { S.newCount = 0; nav(); await sb.from("profiles").update({ seen_at: new Date().toISOString() }).eq("id", S.user.id); }, 1500);
  const form = B ? `<form class="sheet" data-form="box"><h3>${B.id ? "Edit buy box" : "New buy box"}</h3>
      <label>Name<input name="label" maxlength="60" value="${esc(B.label)}" placeholder="North side flips"></label>
      <label>Zip codes, separated by commas (leave empty for anywhere in Houston)<input name="zips" value="${esc(B.zips.join(", "))}" placeholder="77026, 77028, 77016"></label>
      <div class="f3"><label>Min price<input name="min_price" inputmode="numeric" value="${esc(B.min_price || "")}"></label><label>Max price<input name="max_price" inputmode="numeric" value="${esc(B.max_price || "")}" placeholder="No limit"></label><label>Beds at least<input name="min_beds" type="number" min="0" max="10" value="${esc(B.min_beds || 0)}"></label></div>
      <div class="rowx">${TYPES.map(t => `<label class="ck"><input type="checkbox" name="types" value="${t}"${B.types.includes(t) ? " checked" : ""}>${t}</label>`).join("")}</div><p class="muted small" style="margin:-6px 0 0">Leave all unticked for any type.</p>
      <div class="f3"><label>Plan<select name="strategy">${[["both", "Flip or rent"], ["flip", "Flip"], ["rent", "Rent"]].map(([v, t]) => `<option value="${v}"${B.strategy === v ? " selected" : ""}>${t}</option>`).join("")}</select></label><label>Flip profit at least<input name="min_profit" inputmode="numeric" value="${esc(B.min_profit || "")}" placeholder="20,000"></label><label>Cash flow at least, per month<input name="min_cashflow" inputmode="numeric" value="${esc(B.min_cashflow || "")}" placeholder="250"></label></div>
      <label class="ck"><input type="checkbox" name="active"${B.active ? " checked" : ""}>Active. Sellers see that a buyer wants these zips, never who.</label>
      <div class="rowx"><button class="btn">Save buy box</button>${S.boxes.length ? '<a href="#/buybox">Cancel</a>' : ""}${B.id ? `<button type="button" class="btn sm ghost" data-act="delbox" data-id="${B.id}" data-sure="Delete this buy box?">Delete</button>` : ""}</div></form>` : "";
  return `<div class="spread"><h1>Your buy box</h1>${S.boxes.length && S.boxes.length < 5 && !B ? '<a class="btn ghost" href="#/buybox/new">Add another</a>' : ""}</div>
  <div class="cols" style="margin-top:16px"><div style="display:grid;gap:14px">
    <div class="spread"><h2>${hits.length} deal${hits.length === 1 ? "" : "s"} fit${hits.length === 1 ? "s" : ""}</h2>${fresh ? `<span class="pill new">${sym("xilo")}${fresh} new since your last visit</span>` : ""}</div>
    <div class="grid">${hits.length ? hits.map(card).join("") : `<div class="empty" style="grid-column:1/-1">${S.boxes.length ? "Nothing fits yet. New deals that match will show here, marked as new." : "Save a buy box and matching deals show up here."} <a href="#/deals">Browse all deals</a></div>`}</div>
  </div><div class="side">${form}${S.boxes.map(b => `<div class="sheet"><div class="spread"><h3>${esc(b.label || "Buy box")}</h3><a href="#/buybox/${b.id}">Edit</a></div><p class="muted small" style="margin:6px 0 0">${b.zips.length ? esc(b.zips.join(", ")) : "Anywhere in Houston"}. ${b.max_price ? "Up to " + K(b.max_price) : "Any price"}. ${{ both: "Flip or rent", flip: "Flip", rent: "Rent" }[b.strategy]}.${b.active ? "" : " Paused."}</p></div>`).join("")}</div></div>`;
}

// ---------- homeowners ----------
let O = { zip: "", property_type: "House", beds: 3, baths: 1, sqft: "", year_built: "", condition: 2, est_value: "", owe: "", timeline: "As soon as possible", reason: "", street: "", name: "", contact: "", sent: false };
function ownerSide() {
  const o = O; if (!(o.sqft > 0 && o.est_value > 0)) return `<div class="sheet"><h3>Your numbers</h3><p class="muted" style="margin:8px 0 0">Add the size of the house and your best guess at what it would sell for fixed up. The ranges appear here as you type.</p></div>`;
  const rep = ruleRepairs(o), lo = Math.max(0, Math.round((o.est_value * .62 - rep) / 1000) * 1000), hi = Math.max(0, Math.round((o.est_value * .75 - rep) / 1000) * 1000), asIs = Math.round(o.est_value * AS_IS[o.condition] / 1000) * 1000, agent = Math.round(asIs * .92 / 1000) * 1000, owe = +o.owe || 0;
  const left = (a, b) => b - owe <= 0 ? "Not enough to pay off the loan" : a - owe <= 0 ? "Up to " + K(b - owe) : a === b ? K(a - owe) : `${K(a - owe)} to ${K(b - owe)}`;
  return `<div class="sheet"><h3>Your two main options</h3><div class="calc" style="margin-top:10px">
      <span><b>Cash investor</b><br><span class="muted small">As it sits. No repairs, no showings. Two to four weeks.</span></span><b>${K(lo)} to ${K(hi)}</b>
      <span>You would walk away with</span><b style="color:var(--${hi - owe > 0 ? "ok" : "bad"})">${left(lo, hi)}</b>
      <span style="padding-top:10px"><b>List with an agent, as it sits</b><br><span class="muted small">After about 6% commission and 2% closing. Often one to three months.</span></span><b style="padding-top:10px">${K(agent)}</b>
      <span>You would walk away with</span><b style="color:var(--${agent - owe > 0 ? "ok" : "bad"})">${left(agent, agent)}</b></div>
    <p class="note" style="margin:12px 0 0">An agent usually leaves you with more money. An investor is faster and takes the house as it is. ${o.demand ? `<b>${o.demand} buyer${o.demand === 1 ? "" : "s"}</b> on Hausilo buy${o.demand === 1 ? "s" : ""} in ${esc(o.zip)}. ` : ""}These are rough estimates built from your own numbers and about ${K(rep)} of repairs. They are not offers.</p></div>
    ${o.reason === "Behind on payments" || owe > asIs ? `<div class="note"><b>Behind on payments, or owe more than it's worth?</b> A HUD-approved housing counselor will walk you through your options for free, including ones that keep you in the house: <a href="tel:8005694287">800-569-4287</a>.</div>` : ""}`;
}
function owners() {
  if (!LIVE) return soon();
  if (O.sent) return `<div class="sheet" style="max-width:640px"><h1 style="font-size:34px">Request sent</h1><p style="margin:10px 0">Hausilo will look at your house and get back to you, usually within two days. You are never obligated to sell.</p><button class="btn ghost" data-act="again">Start over</button></div>`;
  const o = O;
  return `<h1>What would an investor pay for your house?</h1><p class="lede" style="margin:8px 0 18px">See a cash investor's likely range next to what an agent sale would leave you. No account needed, and nothing is shared until you ask for an offer.</p>
  <div class="cols"><form class="sheet" data-form="owner" data-live="owner" novalidate>
    <fieldset><legend>The house</legend>
      <div class="f2"><label>Zip code<input name="zip" inputmode="numeric" maxlength="5" value="${esc(o.zip)}"></label><label>Type<select name="property_type">${TYPES.slice(0, 5).map(t => `<option${o.property_type === t ? " selected" : ""}>${t}</option>`).join("")}</select></label></div>
      <div class="f4"><label>Beds<input name="beds" type="number" min="0" max="20" value="${esc(o.beds)}"></label><label>Baths<input name="baths" type="number" min="0" max="20" step="0.5" value="${esc(o.baths)}"></label><label>Sq ft<input name="sqft" inputmode="numeric" value="${esc(o.sqft)}"></label><label>Year built<input name="year_built" inputmode="numeric" maxlength="4" value="${esc(o.year_built)}"></label></div>
      <label>Condition<select name="condition">${Object.entries(COND).map(([k, t]) => `<option value="${k}"${+o.condition === +k ? " selected" : ""}>${t}</option>`).join("")}</select></label>
      <div class="f2"><label>What would it sell for fixed up? Your best guess<input name="est_value" inputmode="numeric" value="${esc(o.est_value)}" placeholder="165,000"></label><label>What you still owe on it<input name="owe" inputmode="numeric" value="${esc(o.owe)}" placeholder="0"></label></div></fieldset>
    <fieldset><legend>Want a real offer?</legend><p class="muted small" style="margin:0">Only Hausilo sees this. It is not posted on the site.</p>
      <label>Street address<input name="street" maxlength="140" value="${esc(o.street)}" autocomplete="street-address"></label>
      <div class="f2"><label>Your name<input name="name" maxlength="80" value="${esc(o.name)}" autocomplete="name"></label><label>Phone or email<input name="contact" maxlength="120" value="${esc(o.contact)}"></label></div>
      <div class="f2"><label>When would you like to sell?<select name="timeline">${["As soon as possible", "Within 3 months", "Within a year", "Just exploring"].map(t => `<option${o.timeline === t ? " selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Main reason (optional)<select name="reason">${["", "Inherited the house", "Moving", "Needs too many repairs", "Behind on payments", "Tired landlord", "Other"].map(t => `<option value="${t}"${o.reason === t ? " selected" : ""}>${t || "Prefer not to say"}</option>`).join("")}</select></label></div>
      <input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
      <button class="btn" style="justify-self:start">Ask for an offer</button></fieldset>
  </form><div class="side" id="ownerside">${ownerSide()}</div></div>`;
}
function readOwner(f) { const g = n => (f.elements[n]?.value ?? "").trim(); Object.assign(O, { zip: g("zip"), property_type: g("property_type"), beds: +g("beds") || 0, baths: +g("baths") || 0, sqft: money(g("sqft")), year_built: +g("year_built") || "", condition: +g("condition"), est_value: money(g("est_value")), owe: money(g("owe")), street: g("street"), name: g("name"), contact: g("contact"), timeline: g("timeline"), reason: g("reason"), trap: g("website") }); return O; }

// ---------- account ----------
const gate = (h, p) => `<div class="sheet" style="max-width:560px"><h1 style="font-size:34px">${h}</h1><p class="muted" style="margin:10px 0 14px">${p}</p><div class="rowx"><a class="btn" href="#/account/join">Join free</a><a class="btn ghost" href="#/account">Sign in</a></div></div>`;
function account(tab) {
  if (!LIVE) return soon();
  if (S.recover && S.user) return `<form class="sheet" data-form="newpass" style="max-width:460px"><h1 style="font-size:32px">Set a new password</h1><label>New password, at least 8 characters<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><button class="btn" style="justify-self:start">Save password</button></form>`;
  if (!S.user) return tab === "join" ? `<form class="sheet" data-form="join" style="max-width:560px"><h1 style="font-size:32px">Join Hausilo</h1><p class="muted" style="margin:0">Free. Members see addresses and seller contacts, save buy boxes and post deals.</p>
      <div class="roles"><label><input type="radio" name="role" value="investor" checked>I buy houses<span>Flips or rentals</span></label><label><input type="radio" name="role" value="wholesaler">I wholesale<span>I assign contracts</span></label><label><input type="radio" name="role" value="owner">I own a house<span>Thinking of selling</span></label></div>
      <div class="f2"><label>Your name<input name="name" required maxlength="80" autocomplete="name"></label><label>Phone<input name="phone" maxlength="30" autocomplete="tel"></label></div>
      <label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password, at least 8 characters<input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
      <label class="ck"><input type="checkbox" name="agree" required><span>I agree to the <a href="#/terms" target="_blank">terms</a> and the <a href="#/privacy" target="_blank">privacy notice</a>.</span></label>
      <div class="rowx"><button class="btn">Create account</button><a href="#/account">I already have one</a></div></form>`
    : tab === "forgot" ? `<div class="sheet" style="max-width:460px"><h1 style="font-size:32px">Forgot your password?</h1>${CFG.resetByEmail ? `<form data-form="forgot" style="margin-top:10px"><label>Email<input name="email" type="email" required autocomplete="email"></label><button class="btn" style="justify-self:start">Email me a reset link</button></form>` : `<p style="margin:10px 0">Email <a href="mailto:hello@hausilo.com?subject=Password%20reset">hello@hausilo.com</a> from the address on your account and we'll reset it for you.</p>`}<p style="margin:12px 0 0"><a href="#/account">Back to sign in</a></p></div>`
    : `<form class="sheet" data-form="signin" style="max-width:460px"><h1 style="font-size:32px">Sign in</h1><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" required autocomplete="current-password"></label>
      <div class="rowx"><button class="btn">Sign in</button><a href="#/account/join">Join free</a><a href="#/account/forgot">Forgot password?</a></div></form>`;
  const p = S.profile || {};
  return `<h1>Your account</h1><div class="two" style="margin-top:16px;align-items:start">
    <form class="sheet" data-form="profile"><h3>Profile</h3><p class="muted small" style="margin:0">Signed in as ${esc(S.user.email)}.</p>
      <label>Name<input name="name" maxlength="80" value="${esc(p.name)}"></label><div class="f2"><label>Phone<input name="phone" maxlength="30" value="${esc(p.phone)}"></label><label>Company (optional)<input name="company" maxlength="80" value="${esc(p.company)}"></label></div>
      <label>Contact email shown to people you deal with<input name="email" type="email" maxlength="200" value="${esc(p.email)}"></label>
      <label>I mostly<select name="role">${[["investor", "Buy houses"], ["wholesaler", "Wholesale"], ["owner", "Own a house"]].map(([v, t]) => `<option value="${v}"${p.role === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>
      <div class="rowx"><button class="btn">Save profile</button><button type="button" class="btn ghost" data-act="signout">Sign out</button></div></form>
    <div style="display:grid;gap:14px"><form class="sheet" data-form="newpass"><h3>Change password</h3><label>New password, at least 8 characters<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><button class="btn ghost" style="justify-self:start">Save password</button></form>
      <form class="sheet" data-form="close"><h3>Close your account</h3><p class="muted small" style="margin:0">Removes your profile, deals, buy boxes and messages for good.</p><label>Type DELETE to confirm<input name="sure" autocomplete="off"></label><button class="btn warn" style="justify-self:start">Close account</button></form></div></div>`;
}

// ---------- admin ----------
let AT = "queue";
function admin(tab) {
  if (!LIVE) return soon(); if (!S.admin) return `<div class="empty">This page is for the site owner.</div>`;
  if (tab) AT = tab;
  const A = S.cache.admin;
  if (!A) { if (A === undefined) { S.cache.admin = null; Promise.all([sb.from("listings").select("*").order("created_at", { ascending: false }).limit(500), sb.from("seller_requests").select("*").order("created_at", { ascending: false }).limit(300), sb.from("profiles").select("*").order("created_at", { ascending: false }).limit(1000), sb.from("buy_boxes").select("*").limit(2000), sb.from("reports").select("*").order("created_at", { ascending: false }).limit(200)])
      .then(([l, r, p, b, f]) => { S.cache.admin = { all: (l.data || []).map(prep), reqs: r.data || [], people: p.data || [], boxes: b.data || [], flags: f.data || [] }; route(); }); } return `<p class="muted">Loading…</p>`; }
  const who = id => A.people.find(p => p.id === id) || {}, queue = A.all.filter(d => d.status === "pending"), liveD = A.all.filter(d => ["active", "under_contract"].includes(d.status)), newReq = A.reqs.filter(r => r.status === "new").length;
  const tabs = [["queue", `Review (${queue.length})`], ["live", `Live deals (${liveD.length})`], ["reqs", `Homeowners (${newReq} new)`], ["people", `People (${A.people.length})`], ["demand", "Buyer demand"], ["interest", `Interest (${S.inq.length})`], ["flags", `Flags (${A.flags.length})`]];
  const drow = d => { const pv = S.priv[d.id] || {}, o = who(d.owner_id), m = A.boxes.filter(b => boxMatch({ ...d, status: "active" }, b));
    return `<div class="sheet"><div class="spread"><h3><a href="#/deal/${d.id}">${esc(title(d))}</a></h3><span class="rowx">${stamp(d.c)}${scoreChip(d)}<b class="num">${usd(d.asking)}</b></span></div>
      <p class="small muted" style="margin:6px 0">${esc(pv.street || "")} ${d.zip}. Posted by ${esc(o.name || "?")} (${esc(o.role || "")}), ${esc(o.phone || "")} ${esc(o.email || "")}, ${day(d.created_at)}. ${d.seller_type === "owner" ? "Owner sale." : "Contract assignment."}</p>
      <div class="rowx">${d.status === "pending" ? `<button class="btn sm" data-act="astatus" data-id="${d.id}" data-v="active">Approve and publish</button>` : `<button class="btn sm ghost" data-act="aflag" data-id="${d.id}" data-k="verified" data-v="${!d.verified}">${d.verified ? "Remove proof-seen" : "Mark proof seen"}</button><button class="btn sm ghost" data-act="aflag" data-id="${d.id}" data-k="featured" data-v="${!d.featured}">${d.featured ? "Stop featuring" : "Feature"}</button>`}
        <form data-form="reject" data-id="${d.id}" class="rowx" style="display:flex;flex:1;min-width:240px"><input name="reason" maxlength="300" placeholder="Reason, shown to the poster" style="flex:1"><button class="btn sm warn">${d.status === "pending" ? "Reject" : "Take down"}</button></form></div>
      ${m.length ? `<details class="small" style="margin-top:8px"><summary>${m.length} buy box${m.length > 1 ? "es fit" : " fits"} this deal</summary><ul style="margin:6px 0 0;padding-left:18px">${m.map(b => { const u = who(b.user_id); return `<li>${esc(u.name || "?")}, ${esc(u.phone || "")} ${esc(u.email || "")} (${esc(b.label || "buy box")})</li>`; }).join("")}</ul></details>` : ""}</div>`; };
  const body = { queue: () => queue.length ? queue.map(drow).join("") : `<div class="empty">Nothing waiting for review.</div>`,
    live: () => liveD.length ? liveD.map(drow).join("") : `<div class="empty">No live deals.</div>`,
    reqs: () => A.reqs.length ? A.reqs.map(r => `<form class="sheet" data-form="req" data-id="${r.id}"><div class="spread"><h3>${esc(r.name)}, ${esc(r.street)} ${r.zip}</h3><span class="muted small">${day(r.created_at)}</span></div>
        <p class="small" style="margin:0">${esc(r.contact)}. ${esc(r.property_type)}, ${r.beds || "?"} bd, ${r.sqft ? num(r.sqft) + " sq ft" : "size unknown"}, ${COND[r.condition] || ""}. Thinks it is worth ${usd(r.est_value)} fixed up, owes ${usd(r.owe)}. ${esc(r.timeline)}${r.reason ? ". " + esc(r.reason) : ""}.</p>
        <div class="rowx"><select name="status" style="width:auto">${[["new", "New"], ["contacted", "Contacted"], ["offer_made", "Offer made"], ["closed", "Closed"], ["not_a_fit", "Not a fit"]].map(([v, t]) => `<option value="${v}"${r.status === v ? " selected" : ""}>${t}</option>`).join("")}</select><input name="admin_notes" maxlength="2000" value="${esc(r.admin_notes)}" placeholder="Your notes" style="flex:1;min-width:180px"><button class="btn sm">Save</button></div></form>`).join("") : `<div class="empty">No requests yet.</div>`,
    people: () => `<div class="sheet tbl"><table><tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Joined</th></tr>${A.people.map(p => `<tr><td>${esc(p.name)}${p.company ? `<br><span class="muted small">${esc(p.company)}</span>` : ""}</td><td>${esc(p.role)}</td><td>${esc(p.phone)}</td><td>${esc(p.email)}</td><td>${day(p.created_at)}</td></tr>`).join("")}</table></div>`,
    demand: () => { const z = {}; A.boxes.filter(b => b.active).forEach(b => (b.zips.length ? b.zips : ["Anywhere"]).forEach(x => (z[x] ||= new Set()).add(b.user_id))); const rows = Object.entries(z).sort((a, b) => b[1].size - a[1].size);
      return rows.length ? `<div class="sheet tbl"><table><tr><th>Zip</th><th>Buyers</th><th>Who</th></tr>${rows.map(([k, s]) => `<tr><td>${esc(k === "Anywhere" ? k : zipLabel(k))}</td><td class="num">${s.size}</td><td class="small">${[...s].map(u => esc(who(u).name || "?")).join(", ")}</td></tr>`).join("")}</table></div>` : `<div class="empty">No buy boxes saved yet.</div>`; },
    interest: () => S.inq.length ? `<div class="sheet tbl"><table><tr><th>Buyer</th><th>Deal</th><th>Message</th><th>When</th></tr>${S.inq.map(i => { const d = A.all.find(x => x.id === i.listing_id); return `<tr><td><b>${esc(i.name)}</b><br><span class="small">${esc(i.phone)} ${esc(i.email)}</span></td><td>${d ? `<a href="#/deal/${d.id}">${esc(title(d))}</a>` : ""}</td><td>${esc(i.message)}</td><td>${day(i.created_at)}</td></tr>`; }).join("")}</table></div>` : `<div class="empty">No interest yet.</div>`,
    flags: () => A.flags.length ? `<div class="sheet tbl"><table><tr><th>Deal</th><th>Reason</th><th>From</th><th></th></tr>${A.flags.map(f => { const d = A.all.find(x => x.id === f.listing_id); return `<tr><td>${d ? `<a href="#/deal/${d.id}">${esc(title(d))}</a>` : ""}</td><td>${esc(f.reason)}</td><td>${esc(who(f.from_user).name || "?")}</td><td><button class="linkbtn" data-act="clearflag" data-id="${f.id}">Clear</button></td></tr>`; }).join("")}</table></div>` : `<div class="empty">No flags.</div>` };
  return `<h1>Admin</h1><div class="tabs" role="tablist" style="margin-top:14px">${tabs.map(([k, t]) => `<button role="tab" aria-selected="${AT === k}" data-act="atab" data-v="${k}">${t}</button>`).join("")}</div><div style="display:grid;gap:14px">${body[AT]()}</div>`;
}

// ---------- terms and privacy ----------
const terms = () => `<div class="sheet" style="max-width:780px"><h1 style="font-size:34px">Terms</h1><p class="muted small">Plain-language starting draft. Have a Texas attorney review it before you rely on it.</p>
  <h3>What Hausilo is</h3><p>Hausilo is a place to post and find off-market real estate deals in the Houston area. Hausilo is not a real estate broker or agent, does not represent buyers or sellers, and is not a party to any sale. Any deal is between the people who make it.</p>
  <h3>If you post a deal</h3><p>You may post only a property you own or have under a signed purchase contract. If you are assigning a contract, Texas law requires you to tell the owner and every buyer, in writing, that you are selling an equitable interest and not the property. You are responsible for what you post, for following fair housing law, and for holding any license your activity needs. Hausilo may edit, decline or remove any deal.</p>
  <h3>The numbers</h3><p>Checks, scores, ranges and matches on this site are automated estimates built from what posters and owners type in. They are not appraisals, inspections, offers or advice. "Proof seen" means only that Hausilo looked at a contract or deed. Do your own inspection, title work and comps before you send money.</p>
  <h3>Your account</h3><p>Give real contact details and keep your password to yourself. Do not scrape the site, spam members or post anything false. Hausilo may close accounts that do.</p>
  <h3>No guarantees</h3><p>The site is provided as is. To the extent the law allows, Hausilo is not liable for losses from deals found here or from errors on the site.</p>
  <p class="muted small">Questions: <a href="mailto:hello@hausilo.com">hello@hausilo.com</a></p></div>`;
const privacy = () => `<div class="sheet" style="max-width:780px"><h1 style="font-size:34px">Privacy</h1><p class="muted small">Plain-language starting draft. Have an attorney review it before you rely on it.</p>
  <h3>What we keep</h3><p>Your account email, name, phone and role. The deals you post, including the street address and your contact details. Your buy boxes, saved deals, and messages of interest. If you ask for an offer as a homeowner, your name, contact, address and what you tell us about the house.</p>
  <h3>Who sees it</h3><p>Anyone can see a live deal's photos, numbers, zip code and area. Only signed-in members see its street address and the seller's contact details. When you say you're interested in a deal, the seller gets your name, phone and email. Sellers see how many buyers want a zip, never who. Homeowner requests are seen only by Hausilo. We do not sell your information.</p>
  <h3>Where it lives</h3><p>Data is stored with Supabase, our database provider. The site itself is served by GitHub Pages, and the map tiles come from OpenStreetMap. Fonts come from Google Fonts. Those services see your IP address when your browser loads them.</p>
  <h3>Your choices</h3><p>Edit your profile any time. Closing your account on the account page deletes your profile, deals, buy boxes and messages. To remove a homeowner request, email <a href="mailto:hello@hausilo.com">hello@hausilo.com</a>.</p></div>`;

// ---------- router ----------
const ROUTES = { "": home, early: home, deals, deal, post, edit: post, mine, buybox, owners, account, admin, terms, privacy };
const TITLES = { deals: "Deals", deal: "Deal", post: "Post a deal", edit: "Edit deal", mine: "Your deals", buybox: "Buy box", owners: "Homeowners", account: "Account", admin: "Admin", terms: "Terms", privacy: "Privacy" };
let lastRoute = "";
function route() {
  const h = location.hash.startsWith("#/") ? location.hash.slice(2) : "", [name, arg] = h.split("/"), fn = ROUTES[name] || home;
  if (!S.ready) { view.innerHTML = `<p class="muted">Loading…</p>`; return; }
  if (name === "edit" && !arg) { location.hash = "#/post"; return; }
  if (LIVE && !sb && name) { view.innerHTML = `<div class="empty"><h2 style="color:var(--ink)">Hausilo can't reach its database right now</h2><p style="margin-top:8px">Check your connection and reload the page.${S.err ? " (" + esc(S.err) + ")" : ""}</p></div>`; nav(); return; }
  view.innerHTML = fn(arg); nav(); ilos();
  if (LIVE && sb && ["", "deals", "deal", "buybox", "mine"].includes(name)) freshen(name);
  if (name === "deals") drawMap(dealList());
  if ((name === "post" || name === "edit") && P && S.user) askDemand();
  document.title = TITLES[name] ? `${TITLES[name]} | Hausilo` : "Hausilo: off-market Houston deals";
  if (h !== lastRoute) { const first = !lastRoute && !h; lastRoute = h; if (name === "early") $("#early")?.scrollIntoView(); else { scrollTo(0, 0); if (!first) view.focus({ preventScroll: true }); } }
}
addEventListener("hashchange", route);

// ---------- actions ----------
const sure = b => { if (!b.dataset.sure || b.dataset.armed) return true; b.dataset.armed = 1; b.dataset.was = b.textContent; b.textContent = b.dataset.sure; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = b.dataset.was; } }, 3500); return false; };
const ACT = {
  async status(b) { if (!sure(b)) return; const r = await sb.from("listings").update({ status: b.dataset.v }).eq("id", b.dataset.id); if (r.error) return fail(r.error, "Could not update"); await reload(); toast("Updated."); },
  async astatus(b) { const r = await sb.from("listings").update({ status: b.dataset.v, reject_reason: "" }).eq("id", b.dataset.id); if (r.error) return fail(r.error, "Could not update"); S.cache = {}; await reload(); toast("Published."); },
  async aflag(b) { const r = await sb.from("listings").update({ [b.dataset.k]: b.dataset.v === "true" }).eq("id", b.dataset.id); if (r.error) return fail(r.error, "Could not update"); S.cache = {}; await reload(); },
  atab(b) { AT = b.dataset.v; route(); },
  async clearflag(b) { await sb.from("reports").delete().eq("id", b.dataset.id); S.cache = {}; route(); },
  async save(b) { if (!need()) return; const id = b.dataset.id, on = S.saves.has(id), r = on ? await sb.from("saves").delete().eq("listing_id", id).eq("user_id", S.user.id) : await sb.from("saves").insert({ listing_id: id }); if (r.error) return fail(r.error, "Could not save"); on ? S.saves.delete(id) : S.saves.add(id); b.textContent = on ? "Save" : "Saved"; },
  async share() { try { await navigator.clipboard.writeText(location.href); toast("Link copied."); } catch { toast(location.href); } },
  shot(b) { $("#gmain").innerHTML = `<img src="${esc(b.dataset.src)}" alt="Photo of the property">`; $$(".thumbs button").forEach(x => x.removeAttribute("aria-current")); b.setAttribute("aria-current", "true"); },
  async uninterest(b) { const r = await sb.from("inquiries").delete().eq("listing_id", b.dataset.id).eq("from_user", S.user.id); if (r.error) return fail(r.error, "Could not withdraw"); await reload(); },
  addcomp() { readPost($('form[data-form="post"]')); P.comps.push({}); route(); },
  rmshot(b) { const p = P.photos.splice(+b.dataset.i, 1)[0]; if (p?.path) P.gone.push(p.path); $("#shots").innerHTML = shots(); },
  async delbox(b) { if (!sure(b)) return; const r = await sb.from("buy_boxes").delete().eq("id", b.dataset.id); if (r.error) return fail(r.error, "Could not delete"); B = null; await reload(); location.hash = "#/buybox"; },
  async signout() { await sb.auth.signOut(); location.hash = "#/"; toast("Signed out."); },
  again() { O = { ...O, sent: false, street: "", name: "", contact: "" }; route(); }
};
const once = async (el, fn) => { if (el.dataset.busy) return; el.dataset.busy = 1; try { await fn(el); } catch (e) { fail(e, "Something went wrong"); } finally { delete el.dataset.busy; } };
document.addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b && ACT[b.dataset.act]) { e.preventDefault(); once(b, ACT[b.dataset.act]); } });
document.addEventListener("change", e => {
  if (e.target.id !== "pfile") return;
  for (const f of e.target.files) { if (P.photos.length >= 8) { toast("Up to 8 photos."); break; } if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast("Photos need to be JPG, PNG or WebP."); continue; } P.photos.push({ file: f, url: URL.createObjectURL(f) }); }
  e.target.value = ""; $("#shots").innerHTML = shots();
});
document.addEventListener("input", e => {
  const f = e.target.closest("form[data-live]"); if (!f) return;
  if (f.dataset.live === "filters") { const d = new FormData(f); Object.assign(F, { zip: (d.get("zip") || "").trim(), max: d.get("max") || "", beds: d.get("beds") || "", type: d.get("type") || "", sort: d.get("sort") || "new", ver: d.has("ver"), fit: d.has("fit") }); const ds = dealList(); $("#grid").innerHTML = gridHtml(ds); drawMap(ds); }
  if (f.dataset.live === "post") { const z0 = P.zip, a0 = P.asking; readPost(f); if (e.target.name === "seller_type") $("#ackt").textContent = ackText(P.seller_type); if (e.target.name === "zip" && ZIPS[P.zip]?.name && !f.elements.area.value) { f.elements.area.value = ZIPS[P.zip].name; P.area = ZIPS[P.zip].name; } if (P.zip !== z0 || P.asking !== a0) askDemand(); $("#postside").innerHTML = postSide(); }
  if (f.dataset.live === "owner") { const z0 = O.zip; readOwner(f); if (O.zip !== z0 && /^\d{5}$/.test(O.zip)) sb.rpc("buyer_count", { p_zip: O.zip, p_price: 0 }).then(r => { O.demand = r.data || 0; const s = $("#ownerside"); if (s) s.innerHTML = ownerSide(); }); $("#ownerside").innerHTML = ownerSide(); }
});
const FORM = {
  mail(f) { const lines = [...new FormData(f)].map(([k, v]) => `${k}: ${String(v).trim()}`); location.href = `mailto:hello@hausilo.com?subject=${encodeURIComponent(f.dataset.subject)}&body=${encodeURIComponent(lines.join("\n"))}`; },
  post: savePost,
  async interest(f) { if (!need()) return; const p = S.profile || {}; if (!p.name || !(p.phone || p.email)) { toast("Add your name and phone to your account first"); location.hash = "#/account"; return; }
    const r = await sb.from("inquiries").insert({ listing_id: f.dataset.id, name: p.name, phone: p.phone, email: p.email || S.user.email, message: f.elements.message.value.trim() }); if (r.error) return fail(r.error, "Could not send"); await reload(); toast("Sent. The seller has your name, phone and email."); },
  async report(f) { const r = await sb.from("reports").insert({ listing_id: f.dataset.id, reason: f.elements.reason.value.trim() }); if (r.error && r.error.code !== "23505") return fail(r.error, "Could not send"); f.innerHTML = "<p>Thanks. Hausilo will take a look.</p>"; },
  async reject(f) { const reason = f.elements.reason.value.trim(); if (reason.length < 3) return toast("Add a short reason for the poster"); const r = await sb.from("listings").update({ status: "rejected", reject_reason: reason, verified: false }).eq("id", f.dataset.id); if (r.error) return fail(r.error, "Could not update"); S.cache = {}; await reload(); toast("Done. The poster sees your reason."); },
  async req(f) { const r = await sb.from("seller_requests").update({ status: f.elements.status.value, admin_notes: f.elements.admin_notes.value }).eq("id", f.dataset.id); if (r.error) return fail(r.error, "Could not save"); const x = S.cache.admin.reqs.find(q => String(q.id) === f.dataset.id); if (x) Object.assign(x, { status: f.elements.status.value, admin_notes: f.elements.admin_notes.value }); toast("Saved."); },
  async box(f) { const d = new FormData(f), zips = [...new Set(String(d.get("zips")).split(/[\s,;]+/).filter(z => /^\d{5}$/.test(z)))];
    const row = { label: String(d.get("label")).trim() || "My buy box", zips, min_price: Math.round(money(d.get("min_price"))), max_price: Math.round(money(d.get("max_price"))), min_beds: +d.get("min_beds") || 0, types: d.getAll("types"), strategy: d.get("strategy"), min_profit: Math.round(money(d.get("min_profit"))), min_cashflow: Math.round(money(d.get("min_cashflow"))), active: d.has("active") };
    const r = B.id ? await sb.from("buy_boxes").update(row).eq("id", B.id) : await sb.from("buy_boxes").insert(row); if (r.error) return fail(r.error, "Could not save"); B = null; await reload(); location.hash = "#/buybox"; toast("Buy box saved."); },
  async owner(f) { const o = readOwner(f); if (o.trap) return; if (!/^\d{5}$/.test(o.zip)) return toast("Add the zip code"); if (o.street.length < 3 || o.name.length < 2 || o.contact.length < 5) return toast("Add the street address, your name and a phone or email");
    const r = await sb.from("seller_requests").insert({ name: o.name, contact: o.contact, street: o.street, zip: o.zip, property_type: o.property_type, beds: o.beds, baths: o.baths, sqft: o.sqft ? Math.round(o.sqft) : null, year_built: year(o.year_built), condition: o.condition, est_value: o.est_value ? Math.round(o.est_value) : null, owe: Math.round(o.owe || 0), timeline: o.timeline, reason: o.reason });
    if (r.error) return fail(r.error, "Could not send"); O.sent = true; route(); },
  async join(f) { const d = new FormData(f); if (!d.has("agree")) return toast("Tick the box to agree to the terms"); if (String(d.get("password")).length < 8) return toast("Use a password of at least 8 characters");
    hold = true; const r = await sb.auth.signUp({ email: String(d.get("email")).trim(), password: d.get("password"), options: { data: { role: d.get("role"), name: String(d.get("name")).trim(), phone: String(d.get("phone")).trim() } } }); await memberLoad; hold = false;
    if (r.error) return fail(r.error, "Could not create the account"); if (!r.data.session) { view.innerHTML = `<div class="sheet" style="max-width:520px"><h1 style="font-size:32px">Check your email</h1><p style="margin:10px 0 0">We sent a link to ${esc(d.get("email"))}. Open it to finish creating your account.</p></div>`; return; }
    toast("Welcome to Hausilo."); go(d.get("role") === "wholesaler" ? "#/post" : d.get("role") === "owner" ? "#/owners" : "#/buybox"); },
  async signin(f) { const d = new FormData(f); hold = true; const r = await sb.auth.signInWithPassword({ email: String(d.get("email")).trim(), password: d.get("password") }); await memberLoad; hold = false; if (r.error) return fail(r.error, "Could not sign in"); go("#/deals"); },
  async forgot(f) { const r = await sb.auth.resetPasswordForEmail(String(new FormData(f).get("email")).trim(), { redirectTo: location.origin + location.pathname }); if (r.error) return fail(r.error, "Could not send the link"); f.innerHTML = "<p>If that email has an account, a reset link is on its way.</p>"; },
  async newpass(f) { const pw = f.elements.password.value; if (pw.length < 8) return toast("Use at least 8 characters"); const r = await sb.auth.updateUser({ password: pw }); if (r.error) return fail(r.error, "Could not change the password"); S.recover = false; f.reset(); toast("Password saved."); route(); },
  async profile(f) { const d = new FormData(f), r = await sb.from("profiles").update({ name: String(d.get("name")).trim(), phone: String(d.get("phone")).trim(), company: String(d.get("company")).trim(), email: String(d.get("email")).trim(), role: d.get("role") }).eq("id", S.user.id); if (r.error) return fail(r.error, "Could not save"); await loadMember(); nav(); toast("Profile saved."); },
  async close(f) { if (f.elements.sure.value.trim() !== "DELETE") return toast("Type DELETE to confirm");
    const ph = S.mine.flatMap(d => d.photos || []); if (ph.length) await sb.storage.from("listing-photos").remove(ph);
    const r = await sb.rpc("delete_my_account"); if (r.error) return fail(r.error, "Could not close the account"); await sb.auth.signOut().catch(() => {}); location.hash = "#/"; toast("Your account is closed."); }
};
document.addEventListener("submit", e => { const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault(); if (f.dataset.form !== "post" && f.dataset.form !== "owner" && !f.reportValidity()) return; if (FORM[f.dataset.form]) once(f, FORM[f.dataset.form]); });

// ---------- start ----------
(async () => {
  nav();
  if (!LIVE) { S.ready = true; return route(); }
  try {
    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js");
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
    sb.auth.onAuthStateChange((ev, session) => { const was = S.user?.id || null, now = session?.user?.id || null; S.user = session?.user || null; if (ev === "PASSWORD_RECOVERY") { S.recover = true; location.hash = "#/account"; }
      if (S.ready && (was !== now || ev === "PASSWORD_RECOVERY")) memberLoad = new Promise(done => setTimeout(async () => { try { await loadMember(); nav(); if (!hold) route(); } finally { done(); } }, 0)); });
    S.user = (await sb.auth.getSession()).data.session?.user || null;
    await loadPublic(); await loadMember();
  } catch (e) { S.err = e.message || String(e); }
  S.ready = true; nav(); route();
})();
})();
