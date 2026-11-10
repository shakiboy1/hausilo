// The four ilos as real-time 3D models. Each one is built like its name:
// Lumi = a lantern, Hilo = high/low on a spring, Silo = a silo tower, Xilo = an X-frame drone.
// Usage: import { mountIlos } from "./ilos3d.js"; mountIlos();  // fills every <canvas data-ilo="lumi|hilo|silo|xilo">
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const TAU = Math.PI * 2, clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lathe = (pts, seg = 96) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);
const mesh = (geo, mat, o = {}) => {
  const m = new THREE.Mesh(geo, mat); m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false;
  if (o.p) m.position.set(...o.p); if (o.r) m.rotation.set(...o.r); return m;
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
// bend flat geometry (built facing +z, centred on x=0) around a cylinder of radius R
function wrap(geo, R) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = p.getX(i) / R, r = R + p.getZ(i); p.setXYZ(i, r * Math.sin(a), p.getY(i), r * Math.cos(a)); }
  geo.computeVertexNormals(); return geo;
}
const band = (R, h, theta, at = 0) => new THREE.CylinderGeometry(R, R, h, Math.max(8, Math.round(theta * 40)), 1, true, at - theta / 2, theta);
// a coil spring whose height can change every frame
function springGeo(R, wire, turns, seg = 22, rad = 10) {
  const N = Math.round(turns * seg), geo = new THREE.BufferGeometry(), n = (N + 1) * (rad + 1);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  geo.setIndex(idx); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  const T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3();
  geo.userData.set = h => {
    let k = 0;
    for (let i = 0; i <= N; i++) {
      const u = i / N, th = u * turns * TAU, w = turns * TAU;
      T.set(-R * Math.sin(th) * w, h, R * Math.cos(th) * w).normalize(); Nn.set(Math.cos(th), 0, Math.sin(th)); B.crossVectors(T, Nn).normalize();
      for (let j = 0; j <= rad; j++) {
        const ph = j / rad * TAU, c = Math.cos(ph), s = Math.sin(ph), nx = Nn.x * c + B.x * s, ny = Nn.y * c + B.y * s, nz = Nn.z * c + B.z * s;
        pos[k] = R * Math.cos(th) + nx * wire; pos[k + 1] = u * h + ny * wire; pos[k + 2] = R * Math.sin(th) + nz * wire;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz; k += 3;
      }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, h / 2, 0), R + h);
  };
  geo.userData.set(.4); return geo;
}
function rivets(R, y, count, mat, size = .013) {
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 10, 8), mat, count), m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) { const a = (i + .5) / count * TAU; m.makeTranslation(R * Math.sin(a), y, R * Math.cos(a)); im.setMatrixAt(i, m); }
  im.castShadow = false; im.receiveShadow = true; return im;
}
const blackGlass = () => new THREE.MeshPhysicalMaterial({ color: 0x050608, metalness: .2, roughness: .08, clearcoat: 1, clearcoatRoughness: .04 });

// ---------------- HILO: high / low ----------------
function hilo() {
  const g = new THREE.Group(), R = .64;
  const black = new THREE.MeshPhysicalMaterial({ color: 0x15161b, metalness: .4, roughness: .3, clearcoat: 1, clearcoatRoughness: .16 });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xE0A126, metalness: 1, roughness: .3, clearcoat: .35, clearcoatRoughness: .2 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe6eaee, metalness: 1, roughness: .14, side: THREE.DoubleSide });
  const upLit = lit(0xFFF1CF, 2.4), dnLit = lit(0xFFB02E, 2.2), ringLit = lit(0xFFB02E, 1.6);
  // lo: the black base
  g.add(mesh(lathe([[0, 0], [.5, 0], [.56, .012], [.6, .05], [.63, .22], [R, .5], [.635, .76], [.61, .86], [.57, .895], [.33, .9], [.33, .82], [0, .82]]), black));
  g.add(mesh(new THREE.TorusGeometry(.585, .016, 12, 96), gold, { p: [0, .888, 0], r: [Math.PI / 2, 0, 0] }));
  g.add(mesh(new THREE.TorusGeometry(.565, .012, 10, 96), ringLit, { p: [0, .03, 0], r: [Math.PI / 2, 0, 0], cast: false }));
  const floorGlow = mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: GLOW, color: 0xFFA826, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false }), { p: [0, .004, 0], r: [-Math.PI / 2, 0, 0], cast: false, recv: false });
  g.add(floorGlow);
  // the spring and the rod it rides on
  g.add(mesh(new THREE.CylinderGeometry(.066, .066, 1.12, 28), chrome, { p: [0, 1.36, 0] }));
  const sgeo = springGeo(.21, .033, 5.5), spring = mesh(sgeo, chrome, { p: [0, .84, 0] }); g.add(spring);
  // hi: the gold top
  const top = new THREE.Group(); g.add(top);
  top.add(mesh(lathe([[0, .08], [.33, .08], [.33, 0], [.57, 0], [.61, .03], [.635, .12], [R, .38], [.625, .6], [.56, .82], [.43, .99], [.25, 1.08], [.08, 1.105], [0, 1.108]]), gold));
  top.add(mesh(new THREE.TorusGeometry(.585, .016, 12, 96), black, { p: [0, .012, 0], r: [Math.PI / 2, 0, 0] }));
  top.add(mesh(new THREE.TorusGeometry(.6, .006, 8, 96), black, { p: [0, .7, 0], r: [Math.PI / 2, 0, 0], cast: false }));
  top.add(mesh(wrap(new THREE.PlaneGeometry(.62, .3, 24, 1).translate(0, 0, .004), R), blackGlass(), { p: [0, .36, 0], cast: false }));
  const chev = (up, mat, Rs) => { const k = up ? 1 : -1, o = new THREE.Group();
    for (const s of [1, -1]) o.add(mesh(wrap(new THREE.BoxGeometry(.2, .05, .014, 12, 1, 1).rotateZ(s * k * .62).translate(-s * .077, 0, .006), Rs), mat, { cast: false }));
    return o; };
  const up = chev(true, upLit, R + .004); up.position.y = .36; top.add(up);
  const upGlow = glow(0xFFE2A8, .9, .5); upGlow.position.set(0, .36, R + .06); top.add(upGlow);
  const dn = chev(false, dnLit, R + .002); dn.position.y = .5; g.add(dn);
  const dnGlow = glow(0xFFA826, .9, .5); dnGlow.position.set(0, .5, R + .06); g.add(dnGlow);
  const P = 4.4;   // seconds per cycle: crouch, up high, hold, down low, hold
  const seg = [[0, .2, .34], [.07, .78, .2], [.5, .13, .78], [.93, .34, .13]];   // [start (0-1), target gap, gap it comes from]
  return { group: g, height: 2.5, update(t) {
    const c = (t % P) / P; let s = seg[0]; for (const q of seg) if (c >= q[0]) s = q;
    const tau = (c - s[0]) * P, gap = s[1] + (s[2] - s[1]) * Math.exp(-5.2 * tau) * Math.cos(11 * tau);
    top.position.y = .9 + gap; sgeo.userData.set(gap + .14);
    const hi = ease((gap - .3) / .4), lo = ease((.3 - gap) / .16);
    upLit.color.set(0xFFF1CF).multiplyScalar(.7 + 2.2 * hi); upGlow.material.opacity = .15 + .6 * hi;
    dnLit.color.set(0xFFB02E).multiplyScalar(.6 + 2.2 * lo); dnGlow.material.opacity = .12 + .6 * lo;
    floorGlow.material.opacity = .2 + .25 * lo; top.rotation.y = .05 * Math.sin(t * .9);
  } };
}

// ---------------- LUMI: the light ----------------
function lumi() {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
  const teal = new THREE.MeshPhysicalMaterial({ color: 0x0FA396, metalness: .92, roughness: .32, clearcoat: .3, clearcoatRoughness: .3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xd4dade, metalness: 1, roughness: .2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xF2FFFC, roughness: .03, metalness: 0, transparent: true, opacity: .26, clearcoat: 1, envMapIntensity: 1.9, side: THREE.DoubleSide, depthWrite: false });
  b.add(mesh(lathe([[0, -.07], [.15, -.07], [.2, -.01], [.44, 0], [.5, .025], [.535, .09], [.535, .2], [.51, .25], [.47, .27], [0, .27]]), teal));
  b.add(mesh(new THREE.TorusGeometry(.535, .01, 8, 96), steel, { p: [0, .145, 0], r: [Math.PI / 2, 0, 0], cast: false }));
  const prof = []; for (let i = 0; i <= 34; i++) { const u = i / 34; prof.push([.455 + .075 * Math.sin(u * Math.PI) + (i % 2 ? .013 : 0), .27 + u * .95]); }
  b.add(mesh(lathe(prof, 120), glass, { cast: false, recv: false }));
  const coreLit = lit(0xFFF4D4, 3.2), core = mesh(lathe([[0, 0], [.075, .03], [.105, .11], [.09, .21], [.05, .31], [.014, .39], [0, .41]], 40), coreLit, { p: [0, .55, 0], cast: false, recv: false }); b.add(core);
  const haze = mesh(new THREE.CylinderGeometry(.4, .4, .9, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0xFFD27A, transparent: true, opacity: .15, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), { p: [0, .745, 0], cast: false, recv: false }); b.add(haze);
  const flare = glow(0xFFDFA0, 2.7, .85); flare.position.set(0, .745, 0); b.add(flare);
  const halo = glow(0xFFC560, 4.4, .3); halo.position.set(0, .745, -.2); b.add(halo);
  b.add(mesh(new THREE.CylinderGeometry(.05, .07, .28, 20), steel, { p: [0, .41, 0], cast: false }));
  const motes = []; for (let i = 0; i < 9; i++) { const m = glow(0xFFE6B0, .07, .9); m.userData = { a: i * 2.4, r: .12 + (i * .37 % .22), s: .12 + (i * .13 % .1), o: i / 9 }; b.add(m); motes.push(m); }
  b.add(mesh(lathe([[.47, 1.22], [.51, 1.22], [.555, 1.24], [.575, 1.29], [.555, 1.335], [.46, 1.39], [.31, 1.47], [.15, 1.525], [.07, 1.535], [.07, 1.6], [.1, 1.61], [.1, 1.64], [0, 1.645]]), teal));
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; b.add(mesh(new THREE.CylinderGeometry(.013, .013, .97, 10), steel, { p: [Math.cos(a) * .575, .745, Math.sin(a) * .575] })); }
  for (const s of [1, -1]) b.add(mesh(new THREE.CylinderGeometry(.04, .04, .05, 16), steel, { p: [s * .575, 1.29, 0], r: [0, 0, Math.PI / 2] }));
  const handle = mesh(new THREE.TorusGeometry(.575, .022, 12, 72, Math.PI), steel, { p: [0, 1.29, 0] }); b.add(handle);
  const under = mesh(new THREE.TorusGeometry(.17, .014, 10, 48), lit(0xFFD98F, 2.2), { p: [0, -.06, 0], r: [Math.PI / 2, 0, 0], cast: false }); b.add(under);
  const pool = mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: GLOW, color: 0xFFC560, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }), { p: [0, .004, 0], r: [-Math.PI / 2, 0, 0], cast: false, recv: false });
  g.add(pool);
  return { group: g, height: 2.75, update(t) {
    const bob = Math.sin(t * 1.35); b.position.y = .6 + .07 * bob; b.rotation.z = .035 * Math.sin(t * .8); b.rotation.y = .12 * Math.sin(t * .5);
    const p = .5 + .5 * Math.sin(t * 2.6), q = .82 + .18 * p;
    coreLit.color.set(0xFFF4D4).multiplyScalar(2.6 + 1.2 * p); core.scale.set(.95 + .12 * Math.sin(t * 9.1) * Math.sin(t * 2.3), .96 + .1 * p + .04 * Math.sin(t * 13.7), .95 + .12 * Math.cos(t * 7.7) * Math.sin(t * 3.1)); flare.material.opacity = .65 + .3 * p; flare.scale.setScalar(2.5 + .45 * p);
    halo.material.opacity = .2 + .14 * p; haze.material.opacity = .11 + .07 * p; pool.material.opacity = (.34 + .16 * p) * (1 - .25 * bob); pool.scale.setScalar(1 - .08 * bob);
    handle.rotation.x = -.1 * Math.sin(t * 1.35 - .6);
    for (const m of motes) { const u = (t * m.userData.s + m.userData.o) % 1, a = m.userData.a + t * .5; m.position.set(Math.cos(a) * m.userData.r, .34 + u * .8, Math.sin(a) * m.userData.r); m.material.opacity = Math.sin(u * Math.PI) * .9 * q; }
  } };
}

// ---------------- SILO: the tower ----------------
function silo() {
  const g = new THREE.Group();
  const blue = new THREE.MeshPhysicalMaterial({ color: 0x486EAB, metalness: .55, roughness: .4, clearcoat: .3, clearcoatRoughness: .4 });
  const roofM = new THREE.MeshStandardMaterial({ color: 0xB4C4DA, metalness: 1, roughness: .27 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x18202c, metalness: .85, roughness: .4 });
  const seamLit = lit(0xBFE2FF, 1.4), eyeLit = lit(0x9CCBFF, 1.5);
  const ringProf = (r, h) => { const p = [[r - .07, 0], [r - .014, 0], [r, .014]]; for (let i = 0; i <= 40; i++) { const u = i / 40; p.push([r + .015 * (.5 - .5 * Math.cos(u * TAU * 5)), .03 + u * (h - .06)]); } p.push([r, h - .014], [r - .014, h], [r - .07, h]); return p; };
  g.add(mesh(lathe([[0, 0], [.7, 0], [.735, .02], [.74, .07], [.71, .1], [.6, .1]]), dark));
  const H = .5, radii = [.7, .685, .67], rings = [];
  g.add(mesh(new THREE.CylinderGeometry(.6, .6, 1.62, 48, 1, true), seamLit, { p: [0, .9, 0], cast: false, recv: false }));
  radii.forEach((r, i) => { const o = new THREE.Group(); o.userData.y = .1 + i * (H + .012); o.add(mesh(lathe(ringProf(r, H)), blue)); o.add(rivets(r + .004, .045, 22, roofM)); o.add(rivets(r + .004, H - .045, 22, roofM)); g.add(o); rings.push(o); });
  const roof = new THREE.Group(); roof.userData.y = .1 + 3 * (H + .012); g.add(roof); rings.push(roof);
  roof.add(mesh(lathe([[.6, 0], [.7, 0], [.735, .018], [.745, .055], [.725, .09], [.66, .19], [.54, .33], [.38, .44], [.21, .51], [.1, .535], [.1, .59], [.14, .595], [.15, .625], [.13, .65], [0, .655]]), roofM));
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, pts = []; for (let k = 0; k <= 10; k++) { const u = k / 10, rr = .7 - .56 * u, yy = .08 + .44 * Math.sin(u * Math.PI / 2); pts.push(new THREE.Vector3(Math.sin(a) * rr, yy + .012, Math.cos(a) * rr)); }
    roof.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, .008, 6), roofM, { cast: false })); }
  // the eye: one calm bar of light behind dark glass
  const top = rings[2];
  top.add(mesh(band(radii[2] + .016, .12, 1.7), blackGlass(), { p: [0, .3, 0], cast: false }));
  const eye = mesh(band(radii[2] + .02, .03, .66), eyeLit, { p: [0, .3, 0], cast: false, recv: false }); top.add(eye);
  const eyeGlow = glow(0x8CC4FF, 1.2, .5); eyeGlow.position.set(0, .3, radii[2] + .08); top.add(eyeGlow);
  // level gauge on the middle ring
  const mid = rings[1]; mid.add(mesh(band(radii[1] + .016, .36, .3), blackGlass(), { p: [0, .25, 0], cast: false }));
  const bars = []; for (let i = 0; i < 5; i++) { const m = lit(0xFFB93B, 2), bar = mesh(band(radii[1] + .02, .04, .2), m, { p: [0, .25 - .13 + i * .065, 0], cast: false, recv: false }); mid.add(bar); bars.push(m); }
  // ladder up the side
  const lad = new THREE.Group(), LR = .775, a0 = .66, da = .085; g.add(lad);
  for (const s of [-1, 1]) { const a = a0 + s * da; lad.add(mesh(new THREE.CylinderGeometry(.012, .012, 1.56, 8), dark, { p: [Math.sin(a) * LR, .9, Math.cos(a) * LR] })); }
  for (let i = 0; i < 13; i++) { const y = .18 + i * .12, A = new THREE.Vector3(Math.sin(a0 - da) * LR, y, Math.cos(a0 - da) * LR), B = new THREE.Vector3(Math.sin(a0 + da) * LR, y, Math.cos(a0 + da) * LR), m = mesh(new THREE.CylinderGeometry(.009, .009, A.distanceTo(B), 6), dark); m.position.copy(A).lerp(B, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); lad.add(m); }
  const puffs = []; for (let i = 0; i < 5; i++) { const s = glow(0xDCEBFF, .3, 0); s.material.blending = THREE.NormalBlending; g.add(s); puffs.push(s); }
  const P = 6.4;
  return { group: g, height: 2.45, update(t) {
    const c = (t % P) / P, s = ease(c / .3) * (1 - ease((c - .55) / .3));       // breathe out, hold, settle
    rings.forEach((o, i) => { o.position.y = o.userData.y + s * .045 * i; });
    seamLit.color.set(0xBFE2FF).multiplyScalar(.35 + 1.7 * s);
    bars.forEach((m, i) => m.color.set(0xFFB93B).multiplyScalar(c > .08 + i * .09 && c < .93 ? 2.1 : .16));
    const blink = (t % 5.1) > 4.94 ? .12 : 1; eye.scale.y = blink; eyeGlow.material.opacity = .28 + .14 * Math.sin(t * 1.3);
    puffs.forEach((p, i) => { const u = (c - .56 - i * .035) / .32, top = roof.position.y + .66; if (u <= 0 || u >= 1) { p.material.opacity = 0; return; } p.position.set(.05 * Math.sin(i * 2.1 + u * 3), top + u * .55, .04 * Math.cos(i * 1.7)); p.scale.setScalar(.16 + .42 * u); p.material.opacity = .5 * Math.sin(u * Math.PI); });
  } };
}

// ---------------- XILO: the X ----------------
function xilo() {
  const g = new THREE.Group(), c = new THREE.Group(); g.add(c); g.scale.setScalar(.74);
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
    const x = -.22 * dart(.3, .36) + .44 * dart(.62, .68) - .22 * dart(.9, .97);
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
  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .035).texture;
  return { renderer, env, built: {}, items: [], raf: 0, t0: performance.now(), last: 0, still: false, at: 1.2, W: 0, H: 0, slow: 0, frozen: false,
    io: "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { const it = R.items.find(i => i.canvas === e.target); if (it) it.seen = e.isIntersecting; }), { rootMargin: "80px" }) : null };
}
function build(name, sharp) {
  const ilo = BUILD[name](), scene = new THREE.Scene(); scene.environment = R.env; scene.environmentIntensity = .85;
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-1.5, 9, 4.2); key.castShadow = true; key.shadow.mapSize.setScalar(sharp ? 1024 : 512);
  Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.6, bottom: -2.6, near: 1, far: 22 }); key.shadow.radius = 5; key.shadow.blurSamples = 14; key.shadow.bias = -.0005; key.shadow.normalBias = .03;
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.5); rim.position.set(4.5, 3.2, -5);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: .3 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(key, rim, ground, ilo.group);
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
  let moving = false;
  for (const it of live) {
    if (!it.held && !R.still && (it.yaw || it.vel)) { it.vel += (-30 * it.yaw - 5.5 * it.vel) * Math.min(dt, .05); it.yaw += it.vel * Math.min(dt, .05); if (Math.abs(it.yaw) < .002 && Math.abs(it.vel) < .01) it.yaw = it.vel = 0; }
    if (it.held || it.vel) moving = true;
    const { canvas, w, h } = it, s = R.built[canvas.dataset.ilo], tt = t + (+canvas.dataset.offset || 0), sig = `${w}x${h}@${it.yaw}@${tt}`;
    if (sig === it.sig) continue; it.sig = sig;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    s.cam.aspect = w / h; s.cam.updateProjectionMatrix(); s.ilo.group.rotation.y = it.yaw; s.ilo.update(tt);
    R.renderer.setViewport(0, 0, w, h); R.renderer.setScissor(0, 0, w, h); R.renderer.render(s.scene, s.cam);
    it.ctx.clearRect(0, 0, w, h); it.ctx.drawImage(R.renderer.domElement, 0, R.H - h, w, h, 0, 0, w, h);
  }
  return moving;
}
function frame(now) {
  R.raf = 0; R.items = R.items.filter(it => it.canvas.isConnected || (R.io && R.io.unobserve(it.canvas), false));
  if (!R.items.length) return;                                  // nothing on the page: stop until mountIlos() is called again
  const dt = (now - R.last) / 1000;
  if (dt < .012) return wake();                                 // cap at about 60 frames a second
  R.last = now; const t = (now - R.t0) / 1000, began = performance.now(); draw(R.still ? R.at : t, dt);
  // a device that cannot keep up (no graphics card) gets a still picture instead of a page that stutters
  if (!R.still) { R.slow = performance.now() - began > 45 ? R.slow + 1 : 0; if (R.slow >= 6) { R.frozen = R.still = true; R.at = t; } }
  wake();
}
function wake() { if (R && !R.raf) R.raf = requestAnimationFrame(frame); }

export function mountIlos(root = document, opts = {}) {
  const fresh = [...root.querySelectorAll("canvas[data-ilo]")].filter(c => BUILD[c.dataset.ilo] && !c.__ilo);
  if (!R) { if (!fresh.length) return null; R = setup(); }
  R.still = opts.still ?? (R.frozen || matchMedia("(prefers-reduced-motion: reduce)").matches); if (opts.at != null) R.at = opts.at;
  for (const canvas of fresh) {
    const name = canvas.dataset.ilo; R.built[name] ||= build(name, canvas.clientWidth * Math.min(devicePixelRatio || 1, 2) >= 420);
    const it = { canvas, ctx: canvas.getContext("2d"), seen: true, yaw: 0, vel: 0, held: false, sig: "" };
    canvas.__ilo = true; R.items.push(it); if (R.io) R.io.observe(canvas); grab(it);
  }
  draw(R.still ? R.at : (performance.now() - R.t0) / 1000); if (!opts.manual) wake();
  return { draw: t => { R.items.forEach(it => { it.sig = ""; }); draw(t); }, stop: () => { cancelAnimationFrame(R.raf); R.raf = 0; }, renderer: R.renderer };
}
