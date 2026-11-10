// The four ilos as real-time 3D robots, each with a dark visor that carries its own sign:
// Silo = a heavy four-legged keeper (three bars), Hilo = a two-legged scout that stands tall and drops low (a chevron),
// Lumi = a winged bird that carries a lantern (a spark), Xilo = an X-frame drone (an X).
// Usage: import { mountIlos } from "./ilos3d.js"; mountIlos();  // fills every <canvas data-ilo="lumi|hilo|silo|xilo">
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const TAU = Math.PI * 2, clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
// a profile spun round the upright axis; listed bottom to top so the surface faces outward (a profile listed top to bottom is flipped)
const lathe = (pts, seg = 96, from = 0, len = TAU) => new THREE.LatheGeometry((pts[0][1] > pts[pts.length - 1][1] ? [...pts].reverse() : pts).map(p => new THREE.Vector2(p[0], p[1])), seg, from, len);
const mesh = (geo, mat, o = {}) => {
  const m = new THREE.Mesh(geo, mat); m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false;
  if (o.p) m.position.set(...o.p); if (o.r) m.rotation.set(...o.r); if (o.live) m.userData.live = true; return m;   // live: this part moves on its own every frame
};
const lit = (color, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });
let GLOW;
function glowTex() {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.22, "rgba(255,255,255,.5)"); r.addColorStop(.55, "rgba(255,255,255,.12)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glow = (color, size, opacity = 1) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.setScalar(size); return s;
};
const blackGlass = () => new THREE.MeshPhysicalMaterial({ color: 0x050608, metalness: .2, roughness: .08, clearcoat: 1, clearcoatRoughness: .04 });

// ---------------- shared robot parts ----------------
const paint = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, metalness: .7, roughness: .3, clearcoat: 1, clearcoatRoughness: .14, ...o });
const carbon = () => new THREE.MeshStandardMaterial({ color: 0x15151b, metalness: .55, roughness: .48 });
const steel = () => new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 1, roughness: .22 });
const smoked = () => new THREE.MeshPhysicalMaterial({ color: 0x06070a, metalness: 0, roughness: .36, specularIntensity: .34, clearcoat: .22, clearcoatRoughness: .42, envMapIntensity: .2 });   // big visors: dark glass without mirror flashes
const rbox = (w, h, d, r = .03, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, r);
const cyl = (r1, r2, h, seg = 24) => new THREE.CylinderGeometry(r1, r2, h, seg);
const X90 = [Math.PI / 2, 0, 0], Z90 = [0, 0, Math.PI / 2];
// a flat outline with rounded corners...
function outline(pts, r) {
  const s = new THREE.Shape(), n = pts.length, v = pts.map(p => new THREE.Vector2(p[0], p[1]));
  for (let i = 0; i < n; i++) {
    const p = v[i], a = v[(i + n - 1) % n], b = v[(i + 1) % n];
    const A = p.clone().add(a.clone().sub(p).setLength(Math.min(r, p.distanceTo(a) / 2))), B = p.clone().add(b.clone().sub(p).setLength(Math.min(r, p.distanceTo(b) / 2)));
    if (i) s.lineTo(A.x, A.y); else s.moveTo(A.x, A.y); s.quadraticCurveTo(p.x, p.y, B.x, B.y);
  }
  s.closePath(); return s;
}
// ...pushed out into an armour plate with soft edges, centred on its thickness
function plate(pts, depth, r = .03, bevel = .02) {
  const geo = new THREE.ExtrudeGeometry(outline(pts, r), { depth: Math.max(.001, depth - 2 * bevel), bevelEnabled: true, bevelSize: bevel, bevelOffset: -bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 8 });
  return geo.translate(0, 0, -(depth - 2 * bevel) / 2);
}
const side = geo => geo.rotateY(-Math.PI / 2);      // an outline drawn as (forward, up) becomes a part seen from the side
const flat = geo => geo.rotateX(Math.PI / 2);        // an outline drawn as (right, forward) becomes a part seen from above
const UP = new THREE.Vector3(0, 1, 0), VV = new THREE.Vector3();
// point a part (built along +y from its origin) from A toward B; with stretch, a part one unit tall reaches all the way
function aim(o, A, B, stretch) { VV.subVectors(B, A); const L = VV.length() || 1; o.position.copy(A); o.quaternion.setFromUnitVectors(UP, VV.divideScalar(L)); if (stretch) o.scale.y = L; return o; }
// where the knee sits for a two-part leg from P to Q (part lengths a and b); it bends forward or backward
function kneeAt(P, Q, a, b, forward, out) {
  const dy = Q.y - P.y, dz = Q.z - P.z, D = Math.hypot(dy, dz) || 1, d = clamp(D, Math.abs(a - b) + 1e-4, a + b - 1e-4), k = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - k * k));
  const uy = dy / D, uz = dz / D; let ny = -uz, nz = uy; if ((nz < 0) === !!forward) { ny = -ny; nz = -nz; }
  return out.set(P.x, P.y + k * uy + h * ny, P.z + k * uz + h * nz);
}
// ---------------- HILO: the scout that stands tall and drops low ----------------
function hilo() {
  const g = new THREE.Group(), bot = new THREE.Group(); g.add(bot); bot.rotation.y = .6; bot.scale.setScalar(1.06);
  const gold = paint(0xDD9E1F, { metalness: .9, roughness: .3, clearcoat: .7 }), dark = carbon(), metal = steel(), glass = smoked();
  const upLit = lit(0xFFF1CF, 2.4), dnLit = lit(0xFFB02E, 2.2), trim = lit(0xFFB02E, 1.7);
  // hips, with the body pod riding on a turret above them
  const T = new THREE.Group(), pod = new THREE.Group(); bot.add(T); pod.position.set(0, .2, .03); T.add(pod);
  T.add(mesh(rbox(.56, .2, .34, .07), dark), mesh(cyl(.13, .15, .1, 32), metal, { p: [0, .13, .02] }));
  for (const s of [1, -1]) T.add(mesh(cyl(.15, .15, .12, 32), dark, { p: [s * .36, 0, 0], r: Z90 }), mesh(new THREE.TorusGeometry(.1, .012, 8, 40), trim, { p: [s * .425, 0, 0], r: [0, Math.PI / 2, 0], cast: false, recv: false }));
  pod.add(mesh(side(plate([[-.52, .02], [-.56, .24], [-.36, .42], [.2, .44], [.52, .3], [.6, .1], [.44, -.04], [-.32, -.06]], .68, .12, .09)), gold));
  pod.add(mesh(side(plate([[-.4, -.1], [-.44, .06], [.46, .06], [.5, -.02], [.36, -.13], [-.28, -.15]], .52, .06, .04)), dark));
  pod.add(mesh(side(plate([[.17, .456], [.532, .312], [.614, .1], [.452, -.054], [.38, .0], [.52, .11], [.47, .26], [.17, .36]], .55, .04, .02)), glass, { cast: false }));
  const face = new THREE.Group(); face.position.set(0, .2, .588); face.rotation.x = -.32; pod.add(face);
  const chev = (up, mat) => { const k = up ? 1 : -1, o = new THREE.Group(); for (const s of [1, -1]) o.add(mesh(rbox(.2, .046, .014, .006, 2), mat, { p: [-s * .077, 0, 0], r: [0, 0, s * k * .62], cast: false, recv: false })); return o; };
  const up = chev(true, upLit), dn = chev(false, dnLit); face.add(up, dn);
  const eyeGlow = glow(0xFFD28A, .8, .5); eyeGlow.position.set(0, 0, .08); face.add(eyeGlow);
  pod.add(mesh(rbox(.42, .016, .016, .006, 2), trim, { p: [0, -.012, .47], cast: false, recv: false }));
  pod.add(mesh(rbox(.18, .03, .44, .012), dark, { p: [0, .447, -.12] }), mesh(rbox(.028, .012, .32, .005, 2), trim, { p: [0, .465, -.12], cast: false, recv: false }));
  // tail fin, whip aerial and engine port
  pod.add(mesh(side(plate([[-.2, .4], [-.5, .74], [-.6, .74], [-.52, .36]], .045, .03, .016)), gold), mesh(side(plate([[-.3, .4], [-.36, .47], [-.5, .47], [-.5, .36]], .07, .02, .016)), dark));
  pod.add(mesh(rbox(.012, .1, .012, .004, 2), trim, { p: [0, .68, -.585], r: [.27, 0, 0], cast: false, recv: false }));
  const whip = new THREE.Group(); whip.position.set(.2, .42, -.3); whip.add(mesh(cyl(.005, .012, .5, 8).translate(0, .25, 0), metal)); pod.add(whip);
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) pod.add(mesh(rbox(.02, .022, .18, .008, 2), glass, { p: [s * .338, .25 - i * .05, -.22], cast: false }));
  pod.add(mesh(cyl(.1, .1, .05, 32), dark, { p: [0, .18, -.545], r: X90 }), mesh(new THREE.TorusGeometry(.066, .012, 8, 36), trim, { p: [0, .18, -.572], cast: false, recv: false }));
  pod.add(mesh(cyl(.05, .05, .05, 24), metal, { p: [0, -.13, .34], r: X90 }), mesh(cyl(.034, .034, .054, 20), glass, { p: [0, -.13, .342], r: X90, cast: false }));
  // legs: thigh, shin and a foot bar; the feet stay planted and the knees do the work
  const L1 = .56, L2 = .62, P = new THREE.Vector3(), K = new THREE.Vector3(), A = new THREE.Vector3(), Bv = new THREE.Vector3();
  const legs = [1, -1].map(s => {
    const x = s * .46, ball = new THREE.Vector3(x, .085, s > 0 ? .2 : -.04), hock = ball.clone().add(new THREE.Vector3(0, .42, -.26));
    const foot = new THREE.Group(); foot.position.copy(ball); bot.add(foot);
    for (const t of [1, -1]) { const toe = new THREE.Group(); toe.rotation.y = t * .26; toe.add(mesh(rbox(.12, .08, .34, .036), dark, { p: [0, -.043, .14] }), mesh(rbox(.124, .068, .12, .032), gold, { p: [0, -.047, .29] })); foot.add(toe); }
    foot.add(mesh(rbox(.09, .065, .18, .03), dark, { p: [0, -.05, -.1] }), mesh(cyl(.062, .062, .18, 24), dark, { r: Z90 }));
    const bar = new THREE.Group(); bar.add(mesh(cyl(.05, .06, .494, 16).translate(0, .247, 0), dark), mesh(rbox(.08, .3, .05, .02), gold, { p: [0, .25, .052] })); aim(bar, ball, hock); bot.add(bar);
    bot.add(mesh(cyl(.07, .07, .19, 24), dark, { p: [hock.x, hock.y, hock.z], r: Z90 }), mesh(new THREE.TorusGeometry(.05, .009, 8, 32), trim, { p: [hock.x + s * .098, hock.y, hock.z], r: [0, Math.PI / 2, 0], cast: false, recv: false }));
    const thigh = new THREE.Group(), shin = new THREE.Group(), kn = new THREE.Group(); bot.add(thigh, shin, kn);
    thigh.add(mesh(rbox(.19, L1 + .1, .23, .08), dark, { p: [0, L1 / 2, 0] }), mesh(rbox(.2, L1 - .04, .25, .09), gold, { p: [s * .03, L1 / 2 + .01, .012] }));
    shin.add(mesh(cyl(.05, .062, L2, 16).translate(0, L2 / 2, 0), dark), mesh(rbox(.14, .36, .07, .03), gold, { p: [0, L2 * .5, .062] }));
    kn.add(mesh(cyl(.09, .09, .22, 28), dark, { r: Z90 }), mesh(new THREE.TorusGeometry(.062, .011, 8, 36), trim, { p: [s * .113, 0, 0], r: [0, Math.PI / 2, 0], cast: false, recv: false }));
    const rod = mesh(cyl(.016, .016, 1, 10).translate(0, .5, 0), metal, { live: true }), sleeve = mesh(cyl(.028, .028, 1, 12).translate(0, .5, 0), dark, { live: true }); bot.add(rod, sleeve);
    return { x, s, hock, thigh, shin, kn, rod, sleeve };
  });
  const floorGlow = mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: GLOW, color: 0xFFA826, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false }), { p: [0, .004, 0], r: [-Math.PI / 2, 0, 0], cast: false, recv: false });
  g.add(floorGlow);
  const Pd = 5.2, seg = [[0, .2, .3], [.1, 1, .12], [.56, .2, 1], [.9, .3, .2]];   // [start (0-1), target height (0 low, 1 tall), height it comes from]
  const lift = t => { const c = ((t % Pd) + Pd) % Pd / Pd; let s = seg[0]; for (const q of seg) if (c >= q[0]) s = q; const tau = (c - s[0]) * Pd; return s[1] + (s[2] - s[1]) * Math.exp(-5.6 * tau) * Math.cos(10.5 * tau); };
  return { group: g, height: 2.5, update(t) {
    const h = lift(t), v = (h - lift(t - .07)) / .07, hi = ease((h - .35) / .5), lo = 1 - hi;
    const H = .66 + .8 * h, sway = Math.sin(t * .9);
    T.position.set(.012 * sway, H, -.02 + .04 * lo); T.rotation.set(.06 * lo, 0, .02 * sway);
    whip.rotation.set(-.5 - .25 * v + .03 * Math.sin(t * 6), 0, -.1);
    pod.rotation.set(.16 * lo - .1 * hi - .06 * v, hi * (.5 * Math.sin(t * 1.25) + .1 * Math.sin(t * 2.9)) + lo * .16 * Math.sin(t * .8), .025 * Math.sin(t * 1.7));
    for (const L of legs) {
      P.set(L.x, H + L.s * .46 * Math.sin(T.rotation.z), T.position.z); kneeAt(P, L.hock, L1, L2, true, K);
      aim(L.thigh, P, K); aim(L.shin, K, L.hock); L.kn.position.copy(K);
      A.copy(P).lerp(K, .3); A.z -= .12; Bv.copy(K).lerp(L.hock, .62); Bv.z -= .08; aim(L.sleeve, A, Bv, true); L.sleeve.scale.y *= .5; aim(L.rod, A, Bv, true);
    }
    upLit.color.set(0xFFF1CF).multiplyScalar(.25 + 2.4 * hi); dnLit.color.set(0xFFB02E).multiplyScalar(.2 + 2.3 * lo); up.visible = hi > .5; dn.visible = !up.visible;
    eyeGlow.material.opacity = .2 + .3 * lo + .16 * hi; eyeGlow.material.color.set(hi > .5 ? 0xFFE6B8 : 0xFFA826); floorGlow.material.opacity = .08 + .16 * lo;
  } };
}

// ---------------- LUMI: the lantern bird ----------------
const HOT_LUMI = new THREE.Color(0xFFE9A8);
function lumi() {
  const g = new THREE.Group(), bot = new THREE.Group(), b = new THREE.Group(); g.add(bot); bot.add(b); bot.rotation.y = -.34; bot.position.x = -.09; bot.scale.setScalar(1.08);
  const teal = paint(0x10A698, { metalness: .85, roughness: .3 }), satin = paint(0x0FA093, { metalness: .7, roughness: .46, clearcoat: .25, clearcoatRoughness: .5 }), dark = carbon(), metal = steel(), glass = smoked();
  const eyeLit = lit(0xFFF1D0, 2.6), ringLit = lit(0xFFD98F, 2), coreLit = lit(0xFFF1CC, 2.4);
  const amber = new THREE.MeshPhysicalMaterial({ color: 0xF0880F, metalness: 0, roughness: .12, clearcoat: 1, clearcoatRoughness: .06, transparent: true, opacity: .72, emissive: 0xFF8A00, emissiveIntensity: .3, depthWrite: false });
  const along = geo => geo.rotateX(Math.PI / 2);        // a shape spun round the upright axis, laid down to run back to front (phi 0 ends up underneath)
  // body: a helmet up front and a slim tail behind it
  const fus = [[.02, -.62], [.06, -.5], [.11, -.3], [.16, -.1], [.178, .05], [.165, .16]];
  b.add(mesh(along(lathe(fus, 48, Math.PI - 2.72, 5.44)), teal), mesh(along(lathe(fus, 16, -.422, .844)), dark), mesh(rbox(.012, .008, .3, .003, 2), ringLit, { p: [0, -.147, -.16], r: [.245, 0, 0], cast: false, recv: false }));
  b.add(mesh(rbox(.05, .02, .46, .008), dark, { p: [0, .142, -.2], r: [-.245, 0, 0] }), mesh(rbox(.012, .008, .36, .003, 2), ringLit, { p: [0, .155, -.2], r: [-.245, 0, 0], cast: false, recv: false }));
  b.add(mesh(cyl(.186, .186, .06, 40), dark, { p: [0, 0, .07], r: X90 }), mesh(new THREE.TorusGeometry(.19, .007, 8, 56), ringLit, { p: [0, 0, .045], cast: false, recv: false }));
  const head = new THREE.Group(); head.position.set(0, .03, .23); b.add(head);
  const helm = [[0, -.165], [.1, -.15], [.17, -.1], [.2, -.02], [.205, .06], [.19, .14], [.14, .21], [.07, .245], [0, .25]], sleek = geo => geo.scale(.93, .87, 1.12);
  head.add(mesh(sleek(lathe(helm, 64)), teal), mesh(sleek(lathe([[.1835, -.08], [.206, -.02], [.211, .06], [.198, .13]], 40, -1.3, 2.6)), glass, { cast: false }));
  head.add(mesh(plate([[0, .058], [.012, .012], [.058, 0], [.012, -.012], [0, -.058], [-.012, -.012], [-.058, 0], [-.012, .012]], .01, .002, .002), eyeLit, { p: [0, .018, .24], cast: false, recv: false }));
  const eyeGlow = glow(0xFFE2A8, .64, .5); eyeGlow.position.set(0, .018, .29); head.add(eyeGlow);
  head.add(mesh(side(plate([[.0, .195], [-.17, .265], [-.36, .235], [-.23, .08], [-.1, .165]], .028, .03, .011)), teal));
  const tail = new THREE.Group(); tail.position.set(0, 0, -.58); b.add(tail);
  const quills = [0, 1, -1].map(k => { const o = new THREE.Group(); o.add(mesh(flat(plate([[-.04, .02], [-.058, -.2], [0, k ? -.3 : -.38], [.058, -.2], [.04, .02]], .014, .02, .005)), teal, { p: [0, -.004 * Math.abs(k), 0] })); tail.add(o); return { o, k }; });
  tail.add(mesh(new THREE.SphereGeometry(.04, 16, 12), dark));
  // wings: an arm, a forearm and seven blades each; the left one is the right one mirrored
  const L1 = .32, L2 = .34, strips = [0, 1, 2, 3, 4, 5, 6].map(() => lit(0xFFD98F, 1));
  const blade = (L, i, z) => { const o = new THREE.Group(); o.position.z = z;
    o.add(mesh(plate([[0, 0], [0, .038], [.55 * L, .052], [.9 * L, .03], [L, 0]], .012, .012, .004), satin, { r: [-.2, 0, 0] }), mesh(plate([[0, 0], [L, 0], [.86 * L, -.028], [.5 * L, -.042], [0, -.03]], .012, .012, .004), satin, { r: [.2, 0, 0] }));   // two faces that meet in a ridge
    for (const f of [1, -1]) o.add(mesh(rbox(.5 * L, .009, .004, .002, 2), strips[i], { p: [.46 * L, .004, f * .0085], cast: false, recv: false })); return o; };
  const spar = (r1, r2, L) => cyl(r1, r2, L, 14).translate(0, L / 2, 0).rotateZ(-Math.PI / 2);
  const wings = [1, -1].map(s => {
    const sweep = new THREE.Group(), raise = new THREE.Group(), tilt = new THREE.Group(), fore = new THREE.Group(); sweep.position.set(s * .17, .07, -.02); sweep.scale.x = s; b.add(sweep); sweep.add(raise); raise.add(tilt); fore.position.x = L1; tilt.add(fore);
    b.add(mesh(cyl(.075, .075, .1, 24), dark, { p: [s * .16, .07, -.02], r: Z90 }));
    tilt.add(mesh(spar(.028, .038, L1), dark), mesh(rbox(.24, .05, .034, .014), teal, { p: [.17, .012, .012] }), mesh(new THREE.SphereGeometry(.05, 18, 12), dark, { p: [L1, 0, 0] }), mesh(new THREE.TorusGeometry(.036, .007, 8, 24), ringLit, { p: [L1, 0, .044], cast: false, recv: false }));
    fore.add(mesh(spar(.02, .03, L2), dark), mesh(rbox(.24, .044, .03, .012), teal, { p: [.19, .01, .01] }), mesh(new THREE.SphereGeometry(.03, 14, 10), dark, { p: [L2, 0, 0] }));
    const fan = [];
    [[.34, .56, .12], [.255, .54, .42], [.17, .5, .72], [.085, .44, 1.0]].forEach(([x, L, a], i) => { const o = blade(L, i, -.014 * (i + 1)); o.position.x = x; fore.add(o); fan.push({ o, a }); });
    [[.28, .4, 1.22], [.19, .36, 1.38], [.1, .32, 1.5]].forEach(([x, L, a], i) => { const o = blade(L, i + 4, -.014 * (i + 5)); o.position.x = x; tilt.add(o); fan.push({ o, a }); });
    return { sweep, raise, tilt, fore, fan, s };
  });
  // two short legs carry the lantern
  const grip = new THREE.Vector3(0, -.36, -.04), lamp = new THREE.Group(); lamp.position.copy(grip); b.add(lamp);
  for (const s of [1, -1]) { const leg = new THREE.Group(), hip = new THREE.Vector3(s * .09, -.13, -.1), L = hip.distanceTo(grip); leg.add(mesh(cyl(.014, .024, L, 10).translate(0, L / 2, 0), dark), mesh(cyl(.027, .03, .07, 12).translate(0, L * .4, 0), teal)); aim(leg, hip, new THREE.Vector3(s * .012, grip.y, grip.z)); b.add(leg); }
  lamp.add(mesh(new THREE.TorusGeometry(.03, .007, 8, 20), metal, { p: [0, -.02, 0] }), mesh(lathe([[.012, -.05], [.045, -.06], [.078, -.085], [.084, -.105], [.07, -.107]], 32), teal));
  lamp.add(mesh(cyl(.026, .026, .2, 16), coreLit, { p: [0, -.22, 0], cast: false, recv: false }), mesh(lathe([[.05, -.35], [.078, -.33], [.084, -.22], [.078, -.115], [.066, -.105]], 36), amber, { recv: false }));
  lamp.add(mesh(lathe([[0, -.385], [.03, -.38], [.055, -.36], [.06, -.345], [.045, -.343]], 28), teal), mesh(new THREE.TorusGeometry(.086, .006, 8, 36), teal, { p: [0, -.22, 0], r: X90 }));
  const flare = glow(0xFFDFA0, 1.25, .6); flare.position.set(0, -.22, 0); lamp.add(flare);
  const shine = new THREE.PointLight(0xFFC873, 0, 3.4, 1.7); shine.position.set(0, -.22, .12); lamp.add(shine);      // the lantern really lights the bird from below
  const motes = []; for (let i = 0; i < 6; i++) { const m = glow(0xFFE6B0, .05, 0); m.userData = { a: i * 2.4, r: .03 + (i * .37 % .1), s: .2 + (i * .13 % .1), o: i / 6 }; bot.add(m); motes.push(m); }
  const pool = mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: GLOW, color: 0xFFC560, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false }), { p: [0, .004, 0], r: [-Math.PI / 2, 0, 0], cast: false, recv: false, live: true });
  g.add(pool);
  const Pd = 6.4, Tf = 1.3, at = new THREE.Vector3();
  return { group: g, height: 2.8, update(t) {
    const c = (t % Pd) / Pd, bump = (c0, w) => Math.exp(-(((c - c0) / w) ** 2));
    const show = ease((c - .4) / .1) * (1 - ease((c - .76) / .14)), lit2 = clamp(bump(.27, .014) + bump(.325, .014) + show, 0, 1.2), sweepDown = bump(.425, .028);   // two blinks, then it spreads its wings and lets the lantern blaze
    const f = TAU * t / Tf, beat = 1 - .75 * show, up = Math.sin(f), pitch = -.46 - .1 * show + .03 * Math.sin(t * .9);
    b.position.set(.03 * Math.sin(t * .6), 1.38 - .04 * up * beat + .07 * show + .05 * bump(.45, .03) + .02 * Math.sin(t * 1.1), .03 * Math.sin(t * .8)); b.rotation.set(pitch, .1 * Math.sin(t * .45), .04 * Math.sin(t * .7));
    head.rotation.set(-pitch + .08 + .22 * show * Math.sin(Math.PI * clamp((c - .4) / .2, 0, 1)), .5 * Math.sin(t * .6) * (1 - show), .03 * Math.sin(t * .75));
    wings.forEach(({ sweep, raise, tilt, fore, fan, s }) => {
      const ph = f + (s > 0 ? 0 : .12);
      sweep.rotation.y = -(.1 + .12 * Math.sin(ph - .5) * beat); raise.rotation.z = 1.17 + .2 * Math.sin(ph) * beat + .08 * show - .2 * sweepDown; tilt.rotation.x = .12 - .2 * Math.cos(ph) * beat - .1 * show; fore.rotation.z = .2 + .2 * Math.sin(ph - .9) * beat + .06 * show;
      const spread = .92 + .16 * Math.sin(ph - 1.4) * beat + .2 * show + .1 * sweepDown; fan.forEach(({ o, a }, i) => { o.rotation.z = -a * spread + .02 * Math.sin(t * 3 + i); });
    });
    quills.forEach(({ o, k }) => { o.rotation.set(.1 * up * beat + .06 * k * k, k * (.42 + .18 * show + .05 * Math.sin(t * 1.3)), 0); }); tail.rotation.x = -.1 - .1 * up * beat;
    strips.forEach((m, i) => { const k = i < 4 ? 3 - i : 10 - i; m.color.set(0xFFD98F).multiplyScalar(.45 + 1.3 * ease(lit2 * 1.6 - k * .09) + 1.1 * show * Math.max(0, Math.sin(t * 5.2 - k * .8)) ** 3 + .1 * Math.sin(t * 2.6 - k * .5)); });
    lamp.rotation.set(-pitch + .08 * Math.sin(f - 1.2) * beat, 0, -b.rotation.z + .05 * Math.sin(t * 1.9));
    amber.emissive.set(0xFF8A00).lerp(HOT_LUMI, .3 * clamp(lit2, 0, 1)); amber.emissiveIntensity = .3 + 1.1 * lit2 + .06 * Math.sin(t * 2.6); coreLit.color.set(0xFFF1CC).multiplyScalar(1.1 + 1.8 * lit2);
    flare.material.opacity = .2 + .55 * lit2; flare.scale.setScalar(.7 + .6 * lit2); shine.intensity = .1 + 1.5 * lit2; eyeLit.color.set(0xFFF1D0).multiplyScalar(1.9 + 1.1 * Math.min(1, lit2)); eyeGlow.material.opacity = .36 + .3 * Math.min(1, lit2);
    b.updateWorldMatrix(true, true); flare.getWorldPosition(at); bot.worldToLocal(at);
    for (const m of motes) { const u = (t * m.userData.s * 1.6 + m.userData.o) % 1, q = m.userData.a + t * .6; m.position.set(at.x + Math.cos(q) * m.userData.r * (1 + u), at.y - .18 - u * .45, at.z + Math.sin(q) * m.userData.r * (1 + u)); m.material.opacity = Math.sin(u * Math.PI) * clamp(lit2 * 1.5 - .5, 0, 1); }
    pool.material.opacity = .08 + .4 * Math.min(1, lit2); pool.scale.setScalar(.8 + .2 * Math.min(1, lit2));
  } };
}

// ---------------- SILO: the heavy keeper ----------------
function silo() {
  const g = new THREE.Group(), bot = new THREE.Group(), body = new THREE.Group(); g.add(bot); bot.add(body); bot.rotation.y = .62; bot.position.set(-.17, 0, -.2); bot.scale.setScalar(1.1);
  const blue = paint(0x3463B0, { metalness: .8, roughness: .3 }), silver = paint(0xB9C6D8, { metalness: 1, roughness: .26, clearcoat: .4 }), dark = carbon(), glass = smoked();
  const eyeLit = lit(0xBFE2FF, 2.2), seamLit = lit(0xBFE2FF, 1.4), trim = lit(0xBFE2FF, 1.6);
  // hull: tall at the shoulders, sloping down to the hips, dark underneath
  const slope = .273, top = z => z < -.1 ? .34 + .28 * (z + .1) : .34 + .6 * (z + .1);
  body.add(mesh(side(plate([[-.66, -.05], [-.72, .1], [-.6, .2], [-.1, .34], [.2, .52], [.46, .5], [.62, .3], [.66, .1], [.6, -.07]], .56, .07, .045)), blue));
  body.add(mesh(side(plate([[-.6, -.26], [-.66, -.02], [.6, -.04], [.52, -.28]], .5, .05, .03)), dark));
  const bars = [];
  for (const s of [1, -1]) {
    body.add(mesh(side(plate([[.14, -.22], [.62, -.16], [.68, .14], [.52, .44], [.18, .46], [.08, .1]], .16, .07, .04)), silver, { p: [s * .34, 0, 0] }));
    for (let i = 0; i < 3; i++) body.add(mesh(rbox(.02, .024, .2, .008, 2), glass, { p: [s * .418, .3 - i * .06, .38], cast: false }));
    body.add(mesh(side(plate([[-.7, -.18], [-.24, -.2], [-.2, .08], [-.34, .26], [-.62, .22], [-.74, .0]], .14, .07, .04)), blue, { p: [s * .33, 0, 0] }));
    body.add(mesh(rbox(.03, .14, .25, .012), glass, { p: [s * .285, .1, -.065], cast: false }));
    body.add(mesh(cyl(.056, .062, .44, 20), silver, { p: [s * .15, .68, .07], r: [-.25, 0, 0] }), mesh(cyl(.068, .068, .05, 20), dark, { p: [s * .15, .885, .017], r: [-.25, 0, 0] }));
    body.add(mesh(rbox(.016, .02, .3, .006, 2), trim, { p: [s * .424, -.1, .38], cast: false, recv: false }));
  }
  for (let i = 0; i < 5; i++) { const m = lit(0xFFB93B, 2); for (const s of [1, -1]) body.add(mesh(rbox(.01, .09, .03, .004, 2), m, { p: [s * .302, .1, -.155 + i * .045], cast: false, recv: false })); bars.push(m); }
  body.add(mesh(rbox(.03, .012, .2, .005, 2), trim, { p: [0, .522, .36], cast: false, recv: false }), mesh(rbox(.46, .05, .17, .02), silver, { p: [0, .455, .085], r: [-.54, 0, 0] }));
  // three back plates that lift one after another when it vents, with light underneath
  body.add(mesh(rbox(.36, .02, .5, .008), seamLit, { p: [0, top(-.35) + .002, -.35], r: [-slope, 0, 0], cast: false, recv: false }));
  const plates = [0, 1, 2].map(i => {
    const z = -.1 - i * .165, piv = new THREE.Group(); piv.position.set(0, top(z) + .016, z); body.add(piv);
    piv.add(mesh(flat(plate([[-.2, -.17], [-.25, -.06], [-.23, 0], [.23, 0], [.25, -.06], [.2, -.17]], .03, .03, .012)), blue));
    return piv;
  });
  // head: a low helm with a wide visor; three bars look around
  const head = new THREE.Group(); head.position.set(0, .04, .72); body.add(head);
  head.add(mesh(cyl(.15, .17, .24, 24), dark, { p: [0, -.02, -.1], r: X90 }), mesh(new THREE.TorusGeometry(.176, .008, 8, 48), trim, { p: [0, -.02, -.135], cast: false, recv: false }));
  head.add(mesh(side(plate([[-.12, -.18], [-.19, .12], [0, .26], [.34, .24], [.42, .17], [.52, -.07], [.42, -.2]], .5, .045, .03)), blue));
  head.add(mesh(side(plate([[.08, .274], [.345, .254], [.432, .18], [.534, -.074], [.44, -.2], [.4, -.14], [.47, -.06], [.385, .13], [.32, .195], [.08, .215]], .4, .03, .016)), glass, { cast: false }));
  head.add(mesh(side(plate([[-.07, -.24], [.42, -.24], [.4, -.16], [-.1, -.14]], .38, .03, .02)), dark));
  const face = new THREE.Group(); face.position.set(0, .05, .488); face.rotation.x = -.395; head.add(face);
  const eye = new THREE.Group(); eye.position.z = .006; face.add(eye);
  for (let i = -1; i <= 1; i++) eye.add(mesh(rbox(.14, .024, .01, .004, 2), eyeLit, { p: [0, i * .044, 0], cast: false, recv: false }));
  const eyeGlow = glow(0x8CC4FF, .56, .6); eyeGlow.position.z = .06; eye.add(eyeGlow);
  for (const s of [1, -1]) head.add(mesh(side(plate([[-.17, .14], [-.36, .36], [-.41, .31], [-.24, .07]], .045, .02, .015)), silver, { p: [s * .21, 0, 0], r: [0, 0, -s * .15] }));
  // four legs: elbows back in front, knees forward behind, feet planted
  const L1 = .5, L2 = .56, P = new THREE.Vector3(), K = new THREE.Vector3(), F = new THREE.Vector3();
  const legs = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([s, f]) => {
    const x = s * .46, home = new THREE.Vector3(x, .14, f > 0 ? .52 + (s < 0 ? .06 : -.04) : -.52 + (s < 0 ? -.04 : .06)), foot = new THREE.Group(), thigh = new THREE.Group(), shin = new THREE.Group(), kn = new THREE.Group(); bot.add(foot, thigh, shin, kn);
    foot.add(mesh(rbox(.28, .1, .38, .04), dark, { p: [0, -.09, .03] }), mesh(rbox(.286, .076, .16, .035), blue, { p: [0, -.075, .155] }), mesh(cyl(.075, .075, .2, 20), dark, { r: Z90 }));
    thigh.add(mesh(side(plate([[-.075, -.03], [.075, -.03], [.06, L1], [-.06, L1]], .13, .03, .02)), dark));
    thigh.add(mesh(side(plate([[-.17, -.13], [.15, -.13], [.19, .1], [.1, L1 - .09], [-.07, L1 - .04], [-.19, .12]], .08, .07, .03)), blue, { p: [s * .09, 0, 0] }));
    thigh.add(mesh(cyl(.062, .062, .03, 24), silver, { p: [s * .135, 0, 0], r: Z90 }), mesh(new THREE.TorusGeometry(.042, .008, 8, 28), trim, { p: [s * .152, 0, 0], r: [0, Math.PI / 2, 0], cast: false, recv: false }));
    shin.add(mesh(side(plate([[-.08, 0], [.08, 0], [.06, L2], [-.06, L2]], .13, .03, .02)), dark));
    shin.add(mesh(plate([[-.09, .08], [.09, .08], [.062, L2 - .08], [-.062, L2 - .08]], .06, .03, .02), blue, { p: [0, 0, f * -.1] }));
    kn.add(mesh(cyl(.1, .1, .22, 28), dark, { r: Z90 }), mesh(cyl(.066, .066, .232, 24), silver, { r: Z90 }));
    return { x, s, f, home, foot, thigh, shin, kn };
  });
  const puffs = []; for (let i = 0; i < 6; i++) { const s = glow(0xDCEBFF, .3, 0); s.material.blending = THREE.NormalBlending; body.add(s); puffs.push(s); }
  const Pd = 6.4;
  return { group: g, height: 2.5, update(t) {
    const c = (t % Pd) / Pd, v = ease((c - .12) / .25) * (1 - ease((c - .6) / .28)), sway = Math.sin(t * .8);      // breathe in, hold, let it out
    const step = Math.sin(Math.PI * clamp(c / .1, 0, 1)), thud = Math.exp(-(((c - .11) / .03) ** 2));               // one front foot lifts and comes down hard
    const H = .98 + .05 * v - .045 * thud + .012 * step + .01 * Math.sin(t * 1.7);
    body.position.set(.02 * sway, H, .02 * Math.sin(t * .55)); body.rotation.set(.03 * v + .04 * thud - .02 * step + .012 * Math.sin(t * .6), 0, .014 * sway - .035 * step);
    head.rotation.set(.16 - .14 * v + .1 * thud, .34 * Math.sin(t * .5) * (1 - .5 * v), .03 * Math.sin(t * .7));
    eye.position.x = .095 * Math.sin(t * .7) + .025 * Math.sin(t * 1.9); eye.scale.y = (t % 5.3) > 5.18 ? .15 : 1; eyeGlow.material.opacity = .3 + .15 * Math.sin(t * 1.3);
    plates.forEach((q, i) => { q.rotation.x = -slope + .5 * ease(v * 1.5 - i * .22); }); seamLit.color.set(0xBFE2FF).multiplyScalar(.1 + 2 * v);
    bars.forEach((m, i) => m.color.set(0xFFB93B).multiplyScalar(c > .14 + i * .07 && c < .9 ? 2.1 : .14));
    for (const L of legs) {
      const lead = L.s < 0 && L.f > 0, hz = L.f > 0 ? .42 : -.46;
      F.copy(L.home); if (lead) { F.y += .2 * step; F.z += .04 * step; }
      L.foot.position.copy(F); L.foot.rotation.x = lead ? -.34 * step : 0;
      P.set(L.x, H + L.s * .46 * Math.sin(body.rotation.z) - hz * Math.sin(body.rotation.x) - (L.f > 0 ? .02 : .06), body.position.z + hz); kneeAt(P, F, L1, L2, L.f < 0, K);
      aim(L.thigh, P, K); aim(L.shin, K, F); L.kn.position.copy(K);
    }
    puffs.forEach((p, i) => { const u = (c - .62 - (i >> 1) * .04) / .3; if (u <= 0 || u >= 1) { p.material.opacity = 0; return; } p.position.set((i % 2 ? 1 : -1) * .15 + .05 * Math.sin(i * 2.1 + u * 3), .93 + u * .5, 0 - u * .2 + .04 * Math.cos(i * 1.7)); p.scale.setScalar(.14 + .4 * u); p.material.opacity = .5 * Math.sin(u * Math.PI); });
  } };
}

// ---------------- XILO: the X ----------------
function xilo() {
  const g = new THREE.Group(), c = new THREE.Group(); g.add(c); g.scale.setScalar(.71);
  const violet = new THREE.MeshPhysicalMaterial({ color: 0x5B2BD6, metalness: .7, roughness: .28, clearcoat: 1, clearcoatRoughness: .12 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x121118, metalness: .55, roughness: .5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 1, roughness: .22 });
  const xLit = lit(0xFF4FD0, 2.4), ledLit = lit(0xFF4FD0, 2);
  c.add(mesh(new RoundedBoxGeometry(.84, .4, .84, 6, .15), violet));
  c.add(mesh(new RoundedBoxGeometry(.5, .1, .5, 4, .045), carbon, { p: [0, .23, 0] }));
  for (const s of [1, -1]) c.add(mesh(new THREE.BoxGeometry(.52, .012, .05), xLit, { p: [0, .283, 0], r: [0, s * Math.PI / 4, 0], cast: false, recv: false }));
  c.add(mesh(new RoundedBoxGeometry(.7, .29, .05, 4, .022), blackGlass(), { p: [0, 0, .405], cast: false }));
  for (const s of [1, -1]) c.add(mesh(new THREE.BoxGeometry(.56, .05, .012), xLit, { p: [0, 0, .434], r: [0, 0, s * .4], cast: false, recv: false }));
  const xGlow = glow(0xFF4FD0, 1.7, .6); xGlow.position.set(0, 0, .5); c.add(xGlow);
  const props = [], discs = [];
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.y = Math.PI / 4 + i * Math.PI / 2; c.add(arm);
    arm.add(mesh(new RoundedBoxGeometry(.78, .065, .12, 3, .028), carbon, { p: [.76, .03, 0] }));
    arm.add(mesh(new THREE.BoxGeometry(.5, .012, .03), ledLit, { p: [.74, -.006, 0], cast: false, recv: false }));
    arm.add(mesh(new THREE.CylinderGeometry(.095, .11, .17, 24), steel, { p: [1.14, .07, 0] }));
    arm.add(mesh(new THREE.TorusGeometry(.31, .028, 12, 64), violet, { p: [1.14, .16, 0], r: [Math.PI / 2, 0, 0] }));
    for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + .5; arm.add(mesh(new THREE.BoxGeometry(.2, .014, .022), carbon, { p: [1.14 + Math.cos(a) * .2, .145, Math.sin(a) * .2], r: [0, -a, 0], cast: false })); }
    const prop = new THREE.Group(); prop.position.set(1.14, .175, 0); arm.add(prop);
    for (const r of [0, Math.PI / 2]) prop.add(mesh(new THREE.BoxGeometry(.56, .008, .05), carbon, { r: [0, r, 0], cast: false }));
    const disc = mesh(new THREE.CircleGeometry(.28, 40), new THREE.MeshBasicMaterial({ color: 0xC9A2FF, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false }), { p: [1.14, .178, 0], r: [-Math.PI / 2, 0, 0], cast: false, recv: false });
    arm.add(disc); props.push(prop); discs.push(disc);
  }
  for (const s of [1, -1]) {
    const pts = [[-.36, -.2], [-.42, -.44], [.42, -.44], [.36, -.2]].map(p => new THREE.Vector3(s * .27 + s * (p[1] < -.3 ? .08 : 0), p[1], p[0]));
    c.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", .05), 40, .018, 8), carbon));
  }
  c.add(mesh(new THREE.TorusGeometry(.2, .016, 10, 48), ledLit, { p: [0, -.205, 0], r: [Math.PI / 2, 0, 0], cast: false }));
  const belly = glow(0xFF4FD0, 1.1, .35); belly.position.set(0, -.3, 0); c.add(belly);
  const P = 5;
  return { group: g, height: 2.5, width: 3.1, update(t) {
    const u = (t % P) / P;
    // hover, dart left, brake, dart right, brake
    const dart = (a, b) => ease((u - a) / (b - a));
    const x = -.06 - .2 * dart(.3, .36) + .36 * dart(.62, .68) - .16 * dart(.9, .97);
    const bump = (c0, w) => Math.exp(-(((u - c0) / w) ** 2));
    const bank = bump(.33, .035) * .5 - bump(.65, .035) * .6 + bump(.935, .04) * .35 - bump(.4, .03) * .12 + bump(.72, .03) * .14;
    c.position.set(x, 1.95 + .07 * Math.sin(t * 2.3) + .025 * Math.sin(t * 7.1), 0);
    c.rotation.set(.5 + .03 * Math.sin(t * 1.7), .28 + .05 * Math.sin(t * .9), bank + .025 * Math.sin(t * 3.1));
    props.forEach((p, i) => { p.rotation.y = (i % 2 ? -1 : 1) * t * 38; });
    const scan = .5 + .5 * Math.sin(t * 5); xLit.color.set(0xFF4FD0).multiplyScalar(1.9 + .9 * scan); xGlow.material.opacity = .4 + .25 * scan;
  } };
}

const BUILD = { lumi, hilo, silo, xilo };

// One WebGL renderer draws every stage and copies the picture into that stage's own canvas.
// Call mountIlos() again whenever the page gains new canvases. Canvases that left the page are dropped,
// and each ilo is built only once however many times it is shown. Throws if the browser has no WebGL.
let R = null;
function setup() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap; renderer.setScissorTest(true);
  GLOW = GLOW || glowTex();
  // the room only has to light the robots, so its reflection map is made at a quarter of the usual width: on a weak graphics card that takes a fraction of the time
  const room = new THREE.PMREMGenerator(renderer); room._setSize = function () { this._cubeSize = 64; };
  const env = room.fromScene(new RoomEnvironment(), .035).texture;
  return { renderer, env, built: {}, items: [], raf: 0, t0: performance.now(), last: 0, still: false, at: 1.2, W: 0, H: 0, slow: 0, frozen: false, cost: 0, tick: 0, drew: 0, live: 0, every: 1, busy: false,
    io: "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { const it = R.items.find(i => i.canvas === e.target); if (it) it.seen = e.isIntersecting; }), { rootMargin: "80px" }) : null };
}
// Parts that never move on their own are welded together, one piece per material in each moving group.
// The picture is the same and there is about a third less to draw, which helps weak laptops keep up.
function weld(root) {
  const groups = []; root.traverse(o => { if (!o.isMesh && !o.isSprite && !o.isLight) groups.push(o); });
  for (const g of groups) {
    const sets = new Map();
    for (const m of g.children) {
      if (!m.isMesh || m.userData.live || m.children.length || m.material.transparent) continue;
      const key = m.material.uuid + (m.castShadow ? "c" : "-") + (m.receiveShadow ? "r" : "-"); sets.has(key) ? sets.get(key).push(m) : sets.set(key, [m]);
    }
    for (const list of sets.values()) {
      if (list.length < 2) continue;
      const one = mergeGeometries(list.map(m => { m.updateMatrix(); const q = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); for (const k of Object.keys(q.attributes)) if (k !== "position" && k !== "normal") q.deleteAttribute(k); return q.applyMatrix4(m.matrix); }));
      if (!one) continue;
      g.remove(...list); g.add(mesh(one, list[0].material, { cast: list[0].castShadow, recv: list[0].receiveShadow }));
    }
  }
}
function build(name, sharp) {
  const ilo = BUILD[name](), scene = new THREE.Scene(); scene.environment = R.env; scene.environmentIntensity = .85; weld(ilo.group);
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-1.5, 9, 4.2); key.castShadow = true; key.shadow.mapSize.setScalar(sharp ? 1024 : 512);
  Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.6, bottom: -2.6, near: 1, far: 22 }); key.shadow.radius = 5; key.shadow.blurSamples = 14; key.shadow.bias = -.0005; key.shadow.normalBias = .03;
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.5); rim.position.set(4.5, 3.2, -5);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: .3 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(key, rim, ground, ilo.group);
  if (!ilo.group.getObjectByProperty("isPointLight", true)) scene.add(new THREE.PointLight(0xffffff, 0));   // one point light on every stage (only Lumi's lantern shines) lets all four share the same shaders
  const cam = new THREE.PerspectiveCamera(24, 3 / 4, .1, 60), mid = 1.36, dist = 3.3 / (2 * Math.tan(12 * Math.PI / 180));
  cam.position.set(0, mid + dist * .19, dist); cam.lookAt(0, mid, 0);
  return { ilo, scene, cam };
}
// drag sideways to turn an ilo; let go and it swings back to face you
function grab(it) {
  const c = it.canvas; let id = null, x0 = 0, t0 = 0;
  c.addEventListener("pointerdown", e => { id = e.pointerId; x0 = e.clientX; t0 = e.timeStamp; it.held = true; it.vel = 0; try { c.setPointerCapture(id); } catch {} c.style.cursor = "grabbing"; wake(); });
  c.addEventListener("pointermove", e => { if (e.pointerId !== id) return; const d = (e.clientX - x0) * .012, dt = Math.max(1, e.timeStamp - t0) / 1000; x0 = e.clientX; t0 = e.timeStamp; it.yaw += d; it.vel = clamp(d / dt, -14, 14); });
  const up = e => { if (e.pointerId !== id) return; id = null; it.held = false; c.style.cursor = ""; it.yaw = ((it.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI; };
  c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
}
function draw(t, dt = 0) {
  const live = R.items.filter(it => it.seen || R.still), dpr = Math.min(devicePixelRatio || 1, 2);
  for (const it of live) { it.w = Math.max(2, Math.round(it.canvas.clientWidth * dpr)); it.h = Math.max(2, Math.round(it.canvas.clientHeight * dpr)); }
  const W = Math.max(R.W, ...live.map(it => it.w)), H = Math.max(R.H, ...live.map(it => it.h));
  if (W !== R.W || H !== R.H) { R.W = W; R.H = H; R.renderer.setSize(W, H, false); }
  // a machine that struggles draws half (or a quarter) of the stages on each frame; every ilo still moves by the clock, so none of them slows down
  const every = R.every = R.still ? 1 : R.cost > (R.every > 2 ? 34 : 44) ? 4 : R.cost > (R.every > 1 ? 10 : 15) ? 2 : 1; let moving = false, turn = R.tick; R.drew = 0; R.live = live.length;
  for (const it of live) {
    if (!it.held && !R.still && (it.yaw || it.vel)) { it.vel += (-30 * it.yaw - 5.5 * it.vel) * Math.min(dt, .05); it.yaw += it.vel * Math.min(dt, .05); if (Math.abs(it.yaw) < .002 && Math.abs(it.vel) < .01) it.yaw = it.vel = 0; }
    if (it.held || it.vel) moving = true;
    const { canvas, w, h } = it, s = R.built[canvas.dataset.ilo]; if (!s) continue;                             // still being made
    const tt = t + (+canvas.dataset.offset || 0), sig = `${w}x${h}@${it.yaw}@${tt}@${canvas.dataset.yaw || 0}`;
    if (sig === it.sig || (++turn % every && it.sig && !it.held && !it.yaw)) continue; it.sig = sig; R.drew++;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    s.cam.aspect = w / h; s.cam.updateProjectionMatrix(); s.ilo.group.rotation.y = it.yaw + (+canvas.dataset.yaw || 0); s.ilo.update(tt);
    R.renderer.setViewport(0, 0, w, h); R.renderer.setScissor(0, 0, w, h); R.renderer.render(s.scene, s.cam);
    it.ctx.clearRect(0, 0, w, h); it.ctx.drawImage(R.renderer.domElement, 0, R.H - h, w, h, 0, 0, w, h);
    if (canvas.style.opacity === "0") canvas.style.opacity = 1;
  }
  return moving;
}
function frame(now) {
  R.raf = 0; R.items = R.items.filter(it => it.canvas.isConnected || (R.io && R.io.unobserve(it.canvas), false));
  if (!R.items.length) return;                                  // nothing on the page: stop until mountIlos() is called again
  const dt = (now - R.last) / 1000;
  if (dt < .012) return wake();                                 // cap at about 60 frames a second
  R.last = now; R.tick++; const t = (now - R.t0) / 1000, began = performance.now(); draw(R.still ? R.at : t, dt);
  // a device that cannot keep up (no graphics card) gets a still picture instead of a page that stutters
  const took = performance.now() - began; if (R.drew) R.cost += (took * R.live / R.drew - R.cost) * .2;   // what a frame with every stage on it would cost
  if (!R.still) { R.slow = took > 45 ? R.slow + 1 : 0; if (R.slow >= 6) { R.frozen = R.still = true; R.at = t; } }
  wake();
}
function wake() { if (R && !R.raf) R.raf = requestAnimationFrame(frame); }
// Making an ilo and its shaders takes a moment on a slow machine, so they are made one at a time with a pause between them
// (the shaders off the main thread where the browser can) and each ilo fades in when it is ready, so the page stays usable meanwhile.
const sharpFor = canvas => canvas.clientWidth * Math.min(devicePixelRatio || 1, 2) >= 640;
async function prepare() {
  if (R.busy) return; R.busy = true;
  try {
    for (let it; (it = R.items.find(i => !R.built[i.canvas.dataset.ilo]));) {
      await new Promise(done => setTimeout(done));               // a timer, not a frame, so a tab opened in the background gets its ilos ready too
      const name = it.canvas.dataset.ilo, made = build(name, sharpFor(it.canvas));
      if (R.renderer.extensions.has("KHR_parallel_shader_compile")) await R.renderer.compileAsync(made.scene, made.cam);
      R.built[name] = made; wake();
    }
  } catch (e) { document.documentElement.classList.add("no3d"); }   // the page then shows its flat symbols instead
  R.busy = false;
}

export function mountIlos(root = document, opts = {}) {
  const fresh = [...root.querySelectorAll("canvas[data-ilo]")].filter(c => BUILD[c.dataset.ilo] && !c.__ilo);
  if (!R) { if (!fresh.length) return null; R = setup(); }
  R.still = opts.still ?? (R.frozen || matchMedia("(prefers-reduced-motion: reduce)").matches); if (opts.at != null) R.at = opts.at;
  const atOnce = opts.manual || opts.still === true;            // tools that ask for a still picture get it straight away
  for (const canvas of fresh) {
    const name = canvas.dataset.ilo; if (atOnce) R.built[name] ||= build(name, sharpFor(canvas));
    const it = { canvas, ctx: canvas.getContext("2d"), seen: true, yaw: 0, vel: 0, held: false, sig: "" };
    canvas.__ilo = true; R.items.push(it); if (R.io) R.io.observe(canvas); grab(it);
    if (!R.built[name]) { canvas.style.opacity = 0; canvas.style.transition = "opacity .6s"; }
  }
  if (!atOnce) prepare();
  draw(R.still ? R.at : (performance.now() - R.t0) / 1000); if (!opts.manual) wake();
  return { draw: t => { R.items.forEach(it => { it.sig = ""; }); draw(t); }, stop: () => { cancelAnimationFrame(R.raf); R.raf = 0; }, renderer: R.renderer };
}
