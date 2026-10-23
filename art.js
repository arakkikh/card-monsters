// ============================================================
// カードの絵（すべてSVGで描いたオリジナル）
//   monsterArt(card) / equipArt(card) / flashArt(card) / bossArt(stageId)
// モンスターは「種族の部品（獣・人型・鳥・巨人…）」＋「色・形・装飾の設定」で描く。
// カードに image: '画像のパス' を書くと、その画像を優先して表示する（cardArtHtml）。
// 設定のないカード（あとから足したカードなど）は、攻撃タイプの紋章になる。
// ============================================================

// 色ごとの絵の具
const ART_PAL = {
  red:    { main: '#dc2626', dark: '#7f1d1d', light: '#fca5a5', accent: '#fbbf24', skin: '#f1c9a5' },
  blue:   { main: '#2563eb', dark: '#1e3a8a', light: '#93c5fd', accent: '#e0f2fe', skin: '#dbeafe' },
  green:  { main: '#16a34a', dark: '#14532d', light: '#86efac', accent: '#facc15', skin: '#e7d3b0' },
  yellow: { main: '#eab308', dark: '#854d0e', light: '#fde68a', accent: '#ffffff', skin: '#f3d2a6' },
  purple: { main: '#9333ea', dark: '#3b0764', light: '#d8b4fe', accent: '#a3e635', skin: '#c9b8a8' },
  none:   { main: '#94a3b8', dark: '#334155', light: '#e2e8f0', accent: '#fbbf24', skin: '#e2e8f0' },
};

// ---------- 描画の小道具 ----------
const INK = '#0b1020';
const OUT = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"`;
const aE = (cx, cy, rx, ry, f, x = OUT) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" ${x}/>`;
const aC = (cx, cy, r, f, x = OUT) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${x}/>`;
const aP = (d, f, x = OUT) => `<path d="${d}" fill="${f}" ${x}/>`;
const aL = (d, s, w, x = '') => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${x}/>`;
const aR = (x, y, w, h, f, rx = 0, ex = OUT) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${ex}/>`;
const NO = ''; // 輪郭なし
const METAL = '#cbd5e1', WOOD = '#8b5a2b';

// 目。glow=true（高レベル）なら光る目になる
function artEyes(list, p, o) {
  return list.map(([x, y, r = 2.4]) => {
    if (o.glow) return aC(x, y, r + 1.8, p.accent, 'opacity=".45"') + aC(x, y, r, '#fff', NO);
    if (o.eye === 'button') return aC(x, y, r, '#111', NO) + aL(`M${x - 1.2} ${y - 1.2} L${x + 1.2} ${y + 1.2} M${x + 1.2} ${y - 1.2} L${x - 1.2} ${y + 1.2}`, '#eee', 0.7);
    if (o.eye === 'red') return aC(x, y, r, '#fecaca', NO) + aC(x, y, r * 0.55, '#b91c1c', NO);
    const brow = o.eye === 'angry' ? aL(`M${x - r - 1} ${y - r - 1.5} L${x + r} ${y - r + 0.5}`, INK, 1.3, x > 50 ? `transform="scale(-1 1) translate(${-2 * x} 0)"` : '') : '';
    return aC(x, y, r, '#fff', `stroke="${INK}" stroke-width=".8"`) + aC(x + 0.4, y + 0.3, r * 0.55, '#111', NO) + brow;
  }).join('');
}

// ---------- 種族の部品。[SVG, 頭の中心x, 頭のてっぺんy] を返す ----------

// 四つ足の獣（横向き）
function artBeast(p, o) {
  const c = o.col || p.main, s = o.size || 1, by = 64, leg = o.leg || 14;
  let g = '';
  // しっぽ
  if (o.tail === 'flame') g += aP('M26 60 Q10 50 16 34 Q20 46 24 40 Q22 52 30 56Z', p.accent) + aP('M24 58 Q16 50 19 42 Q22 50 27 54Z', '#fff7d6', NO);
  else if (o.tail === 'bushy') g += aE(22, 56, 9, 6, c) + aE(18, 55, 4, 3, p.light, NO);
  else if (o.tail === 'long') g += aL('M26 64 Q6 66 8 82 Q12 90 22 86', c, 5) + aL('M26 64 Q6 66 8 82 Q12 90 22 86', INK, 0.01);
  else g += aL('M26 62 Q12 58 10 44', o.tailCol || p.dark, 2.4);
  // 脚
  const lx = o.low ? [34, 44, 56, 64] : [34, 42, 56, 64];
  g += lx.map((x, i) => aR(x, by + 6, 5.5, leg, i % 2 ? c : p.dark, 2)).join('');
  // 胴
  g += aE(46, by, 23 * s, (o.low ? 10 : 13) * s, c) + aE(46, by + 5, 16 * s, 5 * s, p.light, 'opacity=".55"');
  if (o.spikes) g += [30, 38, 46, 54].map(x => aP(`M${x} ${by - 11} l4 -10 l4 10z`, p.accent)).join('');
  if (o.spots) g += [[36, 60], [48, 56], [56, 64], [42, 68]].map(([x, y]) => aC(x, y, 2.2, o.spots, NO)).join('');
  if (o.moss) g += aP('M30 56 Q38 48 46 53 Q54 46 62 55 Q54 58 46 57 Q38 60 30 56Z', '#65a30d');
  // 頭
  const hx = 72, hy = o.low ? 58 : 48, hr = 11 * (o.head || 1);
  if (o.ear === 'round') g += aC(hx - 7, hy - 10, 6.5, c) + aC(hx - 7, hy - 10, 3.2, p.light, NO) + aC(hx + 5, hy - 11, 6.5, c) + aC(hx + 5, hy - 11, 3.2, p.light, NO);
  if (o.ear === 'point') g += aP(`M${hx - 9} ${hy - 6} l-1 -15 l10 9z`, c) + aP(`M${hx + 2} ${hy - 9} l5 -14 l5 13z`, c);
  if (o.ear === 'ragged') g += aP(`M${hx - 9} ${hy - 6} l-4 -12 l5 3 l1 -5 l7 9z`, c) + aP(`M${hx + 1} ${hy - 9} l3 -12 l3 5 l4 -4 l1 12z`, c);
  if (o.antlers) g += aL(`M${hx - 3} ${hy - 9} l-5 -14 m2 6 l-6 -3 M${hx + 4} ${hy - 9} l5 -14 m-2 6 l6 -3`, '#a16207', 2);
  g += aC(hx, hy, hr, c) + aE(hx + 10, hy + 4, 7 * (o.snout || 1), 5, o.snoutCol || c) + aC(hx + 15 * (o.snout || 1), hy + 2, 1.9, '#111', NO);
  if (o.teeth) g += aP(`M${hx + 6} ${hy + 8} l2 4 l2 -4 l2 4 l2 -4z`, '#fff', `stroke="${INK}" stroke-width=".6"`);
  if (o.whisker) g += aL(`M${hx + 12} ${hy + 5} l8 -2 M${hx + 12} ${hy + 6} l8 2`, '#e5e7eb', 0.7);
  g += artEyes([[hx + 3, hy - 2, 2.6]], p, o);
  return [g, hx, hy - hr];
}

// 人型（正面）。帽子・武器・表情の組み合わせで描き分ける
function artHumanoid(p, o) {
  const c1 = o.c1 || p.main, c2 = o.c2 || p.dark, skin = o.skin || p.skin, metal = o.metal || METAL;
  let g = '';
  if (o.cape) g += aP('M34 44 Q50 40 66 44 L74 86 Q50 78 26 86Z', o.cape === true ? p.dark : o.cape);
  // 武器（体の後ろ側）
  const W = {
    spear: () => aL('M77 90 L77 12', WOOD, 2.6) + aP('M73 15 L77 1 L81 15Z', metal),
    staff: () => aL('M77 90 L77 22', WOOD, 3) + aC(77, 16, 6.5, p.accent, 'opacity=".5"') + aC(77, 16, 4.5, o.orb || p.light),
    flag: () => aL('M77 90 L77 6', WOOD, 2.6) + aP('M78 8 Q88 4 98 12 Q90 16 98 24 Q88 20 78 24Z', p.main) + aC(86, 16, 2.5, p.accent, NO),
    bow: () => aL('M82 26 Q98 50 82 74', WOOD, 3) + aL('M82 26 L82 74', '#f1f5f9', 0.9),
    lightningbow: () => aL('M82 26 Q98 50 82 74', p.accent, 3) + aL('M82 26 L82 74', '#fff', 0.9) + aP('M88 30 l-5 12 h5 l-5 12', 'none', `stroke="#fff" stroke-width="1.6"`),
  };
  if (W[o.weapon]) g += W[o.weapon]();
  // 脚
  if (!o.robe) g += aR(41, 68, 7.5, 20, c2, 2) + aR(51.5, 68, 7.5, 20, c2, 2) + aE(44, 89, 6, 2.6, INK, NO) + aE(56, 89, 6, 2.6, INK, NO);
  // 胴
  g += o.robe ? aP('M34 44 Q50 38 66 44 L72 90 H28Z', c1) + aP('M47 44 L50 90 L53 44Z', c2, NO)
    : aP('M35 44 Q50 38 65 44 L61 72 H39Z', c1) + aR(39, 66, 22, 4.5, c2, 1);
  if (o.armor) g += aP('M39 46 Q50 42 61 46 L59 62 Q50 67 41 62Z', metal) + aL('M50 45 V64', INK, 0.8);
  if (o.stitch) g += aL('M44 50 l12 0 M46 47 v6 M50 47 v6 M54 47 v6', '#111', 0.9);
  // 腕
  const rx = o.armUp ? 76 : 75, ry = o.armUp ? 40 : 62;
  g += aL('M37 47 L26 62', c1, 6.5) + aL(`M63 47 L${rx} ${ry}`, c1, 6.5);
  g += aC(26, 63, o.weapon === 'fists' ? 8 : 4, o.weapon === 'fists' ? p.accent : skin) + aC(rx, ry + 1, o.weapon === 'fists' ? 8 : 4, o.weapon === 'fists' ? p.accent : skin);
  if (o.weapon === 'fists') g += aL('M20 60 h12 M20 65 h12 M69 60 h12 M69 65 h12', p.dark, 1.2);
  // 武器（手前側）
  const F = {
    sword: () => aL('M75 62 L90 26', metal, 4) + aL('M75 62 L90 26', '#fff', 1, 'opacity=".7"') + aL('M70 56 L81 61', p.accent, 3),
    daggers: () => aL('M26 62 L14 44', metal, 3) + aL('M75 62 L88 44', metal, 3),
    drum: () => aR(35, 62, 30, 15, p.main, 3) + aE(50, 62, 15, 4.5, '#fef3c7') + aL('M36 66 l6 9 M46 66 l6 9 M56 66 l6 9', p.accent, 1) + aL('M22 54 L42 60 M78 54 L58 60', WOOD, 2),
    shield: () => aP('M10 46 H36 V64 Q23 80 10 64Z', metal) + aP('M16 51 H30 V62 Q23 71 16 62Z', p.main) + aC(23, 58, 2.6, p.accent, NO),
    crossbow: () => aL('M30 58 H74', WOOD, 3.4) + aL('M66 44 Q80 58 66 72', metal, 3) + aL('M66 44 L66 72', '#fff', 0.8) + aP('M24 58 l8 -3 v6z', metal),
    book: () => aR(16, 56, 16, 12, p.dark, 1.5) + aR(18, 58, 12, 8, '#fef3c7', 1, NO) + aL('M24 58 v8', p.dark, 0.8),
    basket: () => aP('M15 60 H35 L32 72 H18Z', '#b45309') + aP('M19 60 q3 -9 6 -1 q3 -10 7 1', '#4ade80'),
    sling: () => aL('M75 62 q10 -18 4 -30', WOOD, 1.6) + aC(79, 31, 4, '#a8a29e'),
  };
  if (F[o.weapon]) g += F[o.weapon]();
  // 2つ目の武器（左手。2種類の攻撃を持つモンスターが、2つ目の攻撃の道具を持つ）
  const F2 = {
    orb: () => aC(23, 58, 7.5, p.accent, 'opacity=".45"') + aC(23, 58, 5, o.orb2 || p.light) + aE(21, 56, 1.8, 1.2, '#fff', 'opacity=".8"'),
    dice: () => aR(14, 51, 13, 13, '#f8fafc', 2.5) + aC(18, 55, 1.4, INK, NO) + aC(23.5, 60.5, 1.4, INK, NO) + aC(20.7, 57.7, 1.5, o.orb2 || p.main, NO),
    knife: () => aL('M26 62 L12 49', metal, 3) + aL('M24 60 l-3 4', p.accent, 2),
    javelin: () => aL('M20 78 L30 34', WOOD, 2) + aL('M14 76 L24 34', WOOD, 2) + aP('M28 36 L31 27 L33 37Z', metal) + aP('M22 36 L25 27 L27 37Z', metal),
  };
  if (F2[o.weapon2]) g += F2[o.weapon2]();
  // 頭
  const hx = 50, hy = 31, hr = 12;
  if (o.hat === 'ears') g += aP('M39 30 L26 22 L39 36Z', skin) + aP('M61 30 L74 22 L61 36Z', skin);
  if (o.hat !== 'fullhelm') g += aC(hx, hy, hr, skin);
  if (o.hair) g += aP('M38 30 Q38 17 50 17 Q62 17 62 30 Q56 22 50 24 Q44 22 38 30Z', o.hair) + (o.longHair ? aP('M38 28 Q32 46 37 56 L41 44Z', o.hair) + aP('M62 28 Q68 46 63 56 L59 44Z', o.hair) : '');
  const H = {
    helmet: () => aP('M37.5 31 Q37 16 50 16 Q63 16 62.5 31Z', metal) + aR(48.6, 25, 2.8, 11, metal, 1),
    plume: () => aP('M37.5 31 Q37 16 50 16 Q63 16 62.5 31Z', metal) + aR(48.6, 25, 2.8, 11, metal, 1) + aP('M50 16 Q54 0 70 6 Q60 9 57 18Z', p.accent),
    hood: () => aP('M35 38 Q32 13 50 12 Q68 13 65 38 Q61 24 50 24 Q39 24 35 38Z', c1),
    witch: () => aE(50, 21, 21, 4.5, c2) + aP('M38 21 Q46 6 58 -3 Q60 10 63 21Z', c2) + aR(40, 17.5, 21, 3, p.accent, 0, NO),
    tall: () => aP('M38 22 L43 -1 L61 3 L62 22Z', c1) + aP('M47 8 l1.6 3.4 l3.6 .4 l-2.7 2.4 l.8 3.6 l-3.3 -1.9 l-3.3 1.9 l.8 -3.6 l-2.7 -2.4 l3.6 -.4z', p.accent, NO),
    straw: () => aE(50, 22, 23, 5, '#d6b36a') + aP('M39 22 Q50 7 61 22Z', '#c79f4f'),
    turban: () => aE(50, 21, 14.5, 8.5, '#f5f5f4') + aL('M38 22 q12 -8 24 0', '#d6d3d1', 1) + aC(50, 19, 2.6, p.main),
    band: () => aR(37.5, 23, 25, 4.2, p.accent, 1) + aL('M62 25 l9 -3 M62 26 l9 4', p.accent, 2),
    jester: () => aL('M40 23 Q32 4 22 11', p.main, 6) + aL('M60 23 Q68 4 78 11', p.accent, 6) + aC(22, 11, 3.4, p.accent) + aC(78, 11, 3.4, p.main) + aR(38, 21, 24, 4, p.dark, 1),
    mask: () => aR(37.5, 26, 25, 8, '#111827', 3),
    fullhelm: () => aP('M37 45 V27 Q37 15 50 15 Q63 15 63 27 V45Q50 49 37 45Z', metal) + aR(41, 29, 18, 3.6, '#111827', 1) + aL('M50 33 V45', INK, 0.9) + aP('M50 15 Q53 4 60 7 Q56 9 55 16Z', p.accent),
    leaf: () => aP('M38 26 q-8 -10 2 -14 q2 8 6 10z', '#22c55e') + aP('M62 26 q8 -10 -2 -14 q-2 8 -6 10z', '#22c55e') + aP('M46 20 q4 -12 8 0z', '#4ade80'),
    goggles: () => aR(37.5, 27, 25, 3, '#44403c', 1, NO) + aC(45, 29.5, 4.6, o.glow ? '#fff' : '#7dd3fc') + aC(55, 29.5, 4.6, o.glow ? '#fff' : '#7dd3fc'),
  };
  if (H[o.hat]) g += H[o.hat]();
  // 顔
  if (o.hat === 'fullhelm') g += aC(45, 30.8, o.glow ? 2.2 : 1.5, o.glow ? '#fff' : p.accent, NO) + aC(55, 30.8, o.glow ? 2.2 : 1.5, o.glow ? '#fff' : p.accent, NO);
  else if (o.hat !== 'goggles') g += artEyes([[45, 31], [55, 31]], p, o);
  if (o.mouth === 'grin') g += aP('M43 36 Q50 43 57 36 Q50 39 43 36Z', '#fff', `stroke="${INK}" stroke-width=".8"`);
  if (o.mouth === 'jaw') g += aP('M43 36 H57 L55 42 H45Z', '#1f2937') + aL('M45 36 v3 M49 36 v3 M53 36 v3', '#fff', 1);
  if (o.mouth === 'stitch') g += aL('M44 38 H56 M46 36.5 v3 M50 36.5 v3 M54 36.5 v3', '#111', 0.8);
  if (o.beard) g += aP('M41 36 Q50 60 59 36 Q50 42 41 36Z', '#f1f5f9');
  if (o.scarf) g += aP('M40 40 Q50 46 60 40 L60 45 Q50 51 40 45Z', o.scarf);
  return [g, hx, o.hat === 'witch' || o.hat === 'tall' ? 0 : o.hat === 'jester' ? 8 : 15];
}

// 鳥・コウモリ（正面、翼を広げた姿）
function artBird(p, o) {
  const c = o.col || p.main, w = o.wing || 1, bat = o.bat;
  let g = '';
  const wing = side => {
    const d = bat
      ? `M50 52 Q${50 + side * 22} ${30} ${50 + side * 42 * w} 36 Q${50 + side * 38 * w} 46 ${50 + side * 34 * w} 44 Q${50 + side * 34 * w} 56 ${50 + side * 26 * w} 52 Q${50 + side * 24} 64 ${50 + side * 16} 60Z`
      : `M50 50 Q${50 + side * 20} 26 ${50 + side * 44 * w} 30 Q${50 + side * 40 * w} 40 ${50 + side * 36 * w} 42 Q${50 + side * 34 * w} 50 ${50 + side * 28 * w} 52 Q${50 + side * 24} 60 ${50 + side * 16} 62Z`;
    return aP(d, bat ? p.dark : c) + (bat ? '' : aL(`M${50 + side * 14} 50 Q${50 + side * 26} 40 ${50 + side * 38 * w} 36`, p.light, 1.4, 'opacity=".8"'));
  };
  if (!o.noWing) g += wing(-1) + wing(1);
  if (o.tailF) g += aP('M42 76 L50 92 L58 76Z', p.dark);
  g += aE(50, 62, 13 * (o.fat || 1), 17, c) + aE(50, 67, 8 * (o.fat || 1), 10, p.light, 'opacity=".6"');
  g += aL('M45 78 v8 m-3 0 h6 M55 78 v8 m-3 0 h6', o.feet || '#f59e0b', 1.8);
  const hy = 40, hr = 11 * (o.head || 1);
  if (bat) g += aP('M41 34 l-3 -14 l9 9z', c) + aP('M59 34 l3 -14 l-9 9z', c);
  g += aC(50, hy, hr, c);
  if (o.crest) g += aP('M46 30 l-2 -11 l5 6 l1 -9 l1 9 l5 -6 l-2 11z', o.crest);
  if (o.helmet) g += aP('M39.5 39 Q39 26 50 26 Q61 26 60.5 39Z', METAL) + aP('M50 26 l2 -6 l2 6z', p.dark);
  g += bat ? aP('M46 45 l1.5 5 l1.5 -5 M51 45 l1.5 5 l1.5 -5', '#fff', `stroke="${INK}" stroke-width=".5"`)
    : aP(`M46 43 L50 ${o.hook ? 53 : 50} L54 43Z`, '#f59e0b');
  g += artEyes([[45, hy - 1, 2.5], [55, hy - 1, 2.5]], p, o);
  return [g, 50, hy - hr];
}

// しずく・貝などの小さな精霊
function artBlob(p, o) {
  let g = '';
  if (o.shell) {
    g += aP('M22 70 Q20 34 50 30 Q80 34 78 70Z', p.main) + [34, 42, 50, 58, 66].map(x => aL(`M50 32 Q${x} 50 ${x - (50 - x) * 0.4} 70`, p.dark, 1.4)).join('');
    g += aP('M24 70 H76 L72 82 H28Z', p.dark) + aR(30, 71, 40, 7, '#111827', 3);
    g += artEyes([[42, 74.5, 2.6], [58, 74.5, 2.6]], p, o) + aP('M50 30 l-4 -8 l4 3 l4 -3z', p.accent);
    return [g, 50, 26];
  }
  if (o.mist) g += aE(30, 74, 22, 9, '#e2e8f0', 'opacity=".5"') + aE(72, 80, 20, 8, '#e2e8f0', 'opacity=".45"');
  g += aP('M50 12 Q76 48 72 66 Q68 88 50 88 Q32 88 28 66 Q24 48 50 12Z', o.col || p.main) + aP('M50 22 Q66 50 64 64 Q62 78 50 80 Q60 60 50 22Z', p.light, 'opacity=".5"');
  g += aE(40, 48, 4, 7, '#fff', 'opacity=".7"') + artEyes([[43, 62, 3], [57, 62, 3]], p, o) + aL('M45 71 Q50 75 55 71', INK, 1.4);
  g += aC(22, 40, 3, p.light) + aC(80, 54, 2.2, p.light);
  return [g, 50, 12];
}

// 巨人・樹木など大きな体（正面）
function artGiant(p, o) {
  let g = '', top = 14;
  if (o.kind === 'tree') {
    const big = o.big;
    g += aP('M36 90 Q30 80 22 88 Q30 70 38 66 L40 40 H60 L62 66 Q70 70 78 88 Q70 80 64 90Z', '#78350f');
    g += aL('M40 52 L24 40 M60 52 L76 40', '#78350f', 5) + aC(22, 38, 6, p.main) + aC(78, 38, 6, p.main);
    g += aC(50, 26, big ? 26 : 22, p.dark) + aC(36, 22, 13, p.main) + aC(64, 22, 13, p.main) + aC(50, 14, 14, p.main) + aC(44, 12, 5, p.light, NO) + aC(62, 18, 4, p.light, NO);
    if (big) g += aC(50, 60, 9, p.accent, 'opacity=".45"') + aC(50, 60, 5, '#fff7d6') + [[20, 16], [82, 12], [14, 60], [86, 62]].map(([x, y]) => aP(`M${x} ${y} q4 -6 8 0 q-4 5 -8 0z`, p.light)).join('');
    g += artEyes([[44, 50, 2.6], [56, 50, 2.6]], p, o) + aL('M45 58 Q50 61 55 58', INK, 1.4);
    if (o.beard) g += aP('M42 60 Q50 80 58 60 Q50 66 42 60Z', '#d9f99d');
    return [g, 50, big ? -2 : 2];
  }
  if (o.kind === 'cactus') {
    g += aR(38, 26, 24, 62, p.main, 12) + aP('M38 56 H28 Q20 56 20 46 V40 h8 v6 q0 2 2 2 h8z', p.main) + aP('M62 62 H72 Q80 62 80 52 V44 h-8 v8 q0 2 -2 2 h-8z', p.main);
    g += [[38, 34], [38, 48], [38, 70], [62, 36], [62, 50], [62, 74], [20, 44], [80, 50], [50, 26]].map(([x, y]) => aL(`M${x} ${y} l${x < 50 ? -6 : x > 50 ? 6 : 0} ${x === 50 ? -6 : -2}`, p.accent, 1.6)).join('');
    g += aL('M46 30 V84 M54 30 V84', p.dark, 1) + aC(50, 22, 5, '#f472b6') + artEyes([[45, 44, 2.6], [55, 44, 2.6]], p, { ...o, eye: 'angry' });
    g += aR(40, 64, 20, 9, METAL, 2) + aP('M46 66 h8 l-4 6z', p.accent, NO);
    return [g, 50, 14];
  }
  // 氷の巨人
  const c = p.main;
  g += aP('M30 44 L40 34 H60 L70 44 L74 74 L62 90 H38 L26 74Z', c) + aP('M40 34 L50 46 L60 34Z', p.light) + aP('M30 44 L50 46 L38 90 L26 74Z', p.dark, 'opacity=".45"');
  g += aP('M30 44 L14 52 L10 72 L22 76 L28 60Z', c) + aP('M70 44 L86 52 L90 72 L78 76 L72 60Z', c);
  g += aP('M22 46 l-4 -16 l10 10z', p.accent) + aP('M78 46 l4 -16 l-10 10z', p.accent) + aP('M30 40 l2 -12 l8 8z', p.light);
  g += aP('M40 34 L44 18 H56 L60 34Z', c) + aP('M44 18 l6 -8 l6 8z', p.accent);
  g += artEyes([[46, 27, 2.2], [54, 27, 2.2]], p, { ...o, eye: 'angry' }) + aL('M40 60 l8 6 l-4 8 M58 56 l-6 8', p.light, 1);
  return [g, 50, 8];
}

// 大蛇・海竜（とぐろを巻いた姿）
function artSerpent(p, o) {
  const c = p.main;
  let g = aL('M30 84 Q10 70 30 60 Q60 50 70 66 Q78 82 54 86 Q36 88 34 76', INK, 15) + aL('M30 84 Q10 70 30 60 Q60 50 70 66 Q78 82 54 86 Q36 88 34 76', c, 12);
  g += aL('M56 60 Q40 44 54 30', INK, 14) + aL('M56 60 Q40 44 54 30', c, 11);
  g += aL('M30 84 Q10 70 30 60 Q60 50 70 66', p.light, 2, 'opacity=".6" stroke-dasharray="1 5"');
  if (o.fins) g += aP('M44 44 l-14 -6 l8 10z', p.accent) + aP('M48 54 l-14 2 l10 6z', p.accent) + aP('M74 70 l14 -8 l-4 14z', p.accent);
  g += aE(58, 24, 15, 11, c) + aE(66, 27, 8, 6, p.light, 'opacity=".5"');
  if (o.fins) g += aP('M46 20 l-12 -12 l14 4z', p.accent) + aP('M52 14 l-2 -14 l10 10z', p.accent);
  if (o.crown) g += aP('M50 15 l2 -9 l4 6 l3 -8 l3 8 l4 -6 l2 9z', '#fbbf24');
  g += artEyes([[62, 21, 3]], p, o) + aL('M70 28 l10 2 m-10 -2 l9 5', '#ef4444', 1.3) + aP('M66 30 l1.5 4 l1.5 -4z', '#fff', `stroke="${INK}" stroke-width=".5"`);
  if (o.vines) g += aL('M14 66 q-6 -10 2 -16 M82 84 q8 -6 4 -16', '#84cc16', 2) + aP('M14 50 q-6 -4 -2 -9 q5 3 2 9z', '#84cc16');
  return [g, 58, 13];
}

// 竜
function artDragon(p, o) {
  const c = p.main;
  let g = aP('M50 46 Q26 20 4 26 Q12 34 10 44 Q20 40 22 52 Q32 46 36 60Z', p.dark) + aP('M50 46 Q74 20 96 26 Q88 34 90 44 Q80 40 78 52 Q68 46 64 60Z', p.dark);
  g += aL('M50 46 L10 30 M50 46 L24 46 M50 46 L90 30 M50 46 L76 46', c, 1.6);
  g += aP('M36 90 Q30 62 44 50 H56 Q70 62 64 90Z', c) + aP('M42 90 Q40 68 50 58 Q60 68 58 90Z', p.accent, 'opacity=".85"') + aL('M43 70 h14 M42 78 h16 M42 86 h16', p.dark, 1);
  g += aP('M38 34 L30 14 L42 24Z', '#fef3c7') + aP('M62 34 L70 14 L58 24Z', '#fef3c7');
  g += aP('M36 40 Q36 22 50 22 Q64 22 64 40 L58 54 H42Z', c) + aE(50, 50, 10, 6, p.light, 'opacity=".5"') + aC(46, 50, 1.3, INK, NO) + aC(54, 50, 1.3, INK, NO);
  g += artEyes([[43, 36, 3], [57, 36, 3]], p, { ...o, eye: o.glow ? '' : 'angry' });
  g += aP('M44 56 Q50 74 56 56 Q50 62 44 56Z', '#fde047') + aP('M47 58 Q50 68 53 58Z', '#fff', NO);
  return [g, 50, 12];
}

// 魔王（角と翼のある大きな人影）
function artDemon(p, o) {
  let g = aP('M50 50 Q24 26 6 40 Q16 44 14 56 Q24 52 28 64 Q36 56 42 66Z', p.dark) + aP('M50 50 Q76 26 94 40 Q84 44 86 56 Q76 52 72 64 Q64 56 58 66Z', p.dark);
  g += aP('M30 92 Q28 60 38 48 H62 Q72 60 70 92Z', '#1e1b4b') + aP('M44 50 L50 92 L56 50Z', p.main);
  g += aL('M38 52 L22 72 M62 52 L78 72', '#1e1b4b', 7) + aP('M18 70 l-4 10 l5 -4 l1 6 l3 -6 l4 4 l-2 -10z', p.light) + aP('M82 70 l4 10 l-5 -4 l-1 6 l-3 -6 l-4 4 l2 -10z', p.light);
  g += aP('M38 28 Q26 22 28 6 Q36 16 42 20Z', '#e7e5e4') + aP('M62 28 Q74 22 72 6 Q64 16 58 20Z', '#e7e5e4');
  g += aP('M37 34 Q37 18 50 18 Q63 18 63 34 Q62 48 50 50 Q38 48 37 34Z', p.light);
  g += aP('M42 20 l2 -8 l3 6 l3 -9 l3 9 l3 -6 l2 8z', '#fbbf24');
  g += artEyes([[44, 33, 3], [56, 33, 3]], p, { ...o, eye: o.glow ? '' : 'red' }) + aL('M40 28 l7 3 M60 28 l-7 3', INK, 1.5);
  g += aP('M44 41 H56 L54 46 H46Z', '#1f2937') + aP('M45 41 l1.5 3.5 l1.5 -3.5 M52 41 l1.5 3.5 l1.5 -3.5', '#fff', `stroke="${INK}" stroke-width=".4"`);
  g += aC(50, 62, 5, p.accent, 'opacity=".5"') + aC(50, 62, 3, '#fff', NO);
  return [g, 50, 6];
}

const ART_BUILDERS = { beast: artBeast, humanoid: artHumanoid, bird: artBird, blob: artBlob, giant: artGiant, serpent: artSerpent, dragon: artDragon, demon: artDemon };

// ---------- モンスター40体の設定：[種族, 形・装飾] ----------
const MONSTER_ART = {
  // 2種類の攻撃を持つモンスター（weapon2：左手に2つ目の攻撃の道具）
  r21: ['humanoid', { hat: 'band', weapon: 'sword', weapon2: 'orb', orb2: '#fb923c', c1: '#991b1b', cape: '#1f2937', hair: '#fde047', eye: 'angry', armUp: true }],
  r22: ['humanoid', { hat: 'plume', weapon: 'spear', weapon2: 'javelin', armor: true, metal: '#fca5a5', c1: '#7f1d1d', hair: '#fbbf24', longHair: true, cape: '#ea580c' }],
  b20: ['humanoid', { hat: 'fullhelm', weapon: 'spear', weapon2: 'orb', orb2: '#e0f2fe', armor: true, metal: '#bae6fd', c1: '#1e3a8a', cape: '#0c4a6e' }],
  b21: ['humanoid', { hat: 'hood', weapon: 'staff', weapon2: 'dice', orb2: '#7c3aed', robe: true, c1: '#0e7490', orb: '#a5f3fc', hair: '#e0f2fe', longHair: true }],
  g21: ['humanoid', { hat: 'leaf', weapon: 'bow', weapon2: 'orb', orb2: '#bbf7d0', c1: '#166534', hair: '#78350f', scarf: '#a3e635' }],
  g22: ['beast', { moss: true, low: true, tail: 'long', ear: '', snout: 1.4, teeth: true, spikes: true, col: '#4d7c0f', spots: '#bef264', leg: 8, eye: 'angry' }],
  y22: ['humanoid', { hat: 'straw', weapon: 'spear', weapon2: 'javelin', c1: '#a16207', c2: '#57534e', scarf: '#dc2626', beard: true }],
  y23: ['humanoid', { hat: 'plume', weapon: 'lightningbow', weapon2: 'orb', orb2: '#fef9c3', armor: true, metal: '#fde68a', cape: '#1e3a8a', c1: '#ca8a04' }],
  p21: ['humanoid', { hat: 'witch', weapon: 'staff', weapon2: 'dice', orb2: '#a3e635', robe: true, c1: '#3b0764', orb: '#a3e635', eye: 'red' }],
  p22: ['humanoid', { hat: 'hood', weapon: 'sword', weapon2: 'dice', orb2: '#a855f7', c1: '#1e1b4b', cape: '#3b0764', eye: 'red', mouth: 'grin', armUp: true }],
  // 赤：炎の獣と戦士
  r01: ['beast', { size: 0.8, ear: 'round', tail: 'thin', tailCol: '#fca5a5', snout: 0.8, whisker: true, leg: 9 }],
  r02: ['beast', { ear: 'point', tail: 'flame', teeth: true, eye: 'angry', col: '#b91c1c' }],
  r03: ['humanoid', { hat: 'band', weapon: 'drum', c1: '#b45309' }],
  r04: ['humanoid', { hat: 'helmet', weapon: 'spear', armor: true, metal: '#d97706', eye: 'angry' }],
  r05: ['humanoid', { hat: 'band', weapon: 'fists', hair: '#111827', eye: 'angry', c1: '#7f1d1d', skin: '#e0a878' }],
  r06: ['beast', { low: true, tail: 'long', spikes: true, ear: '', snout: 1.3, teeth: true, col: '#ea580c', spots: '#fde047', leg: 8 }],
  r07: ['humanoid', { hat: 'plume', weapon: 'sword', armor: true, cape: '#7f1d1d', metal: '#fcd34d', eye: 'angry', armUp: true }],
  r08: ['dragon', {}],
  r10: ['humanoid', { hat: 'band', weapon: 'fists', hair: '#7c2d12', longHair: true, eye: 'angry', c1: '#b45309', skin: '#d9a066', cape: '#7c2d12', armUp: true }],
  r11: ['bird', { bat: true, wing: 1.05, col: '#ea580c', eye: 'angry', feet: '#7f1d1d', crest: '#fde047', tailF: true }],
  r12: ['humanoid', { hat: 'mask', mouth: 'jaw', eye: 'red', armor: true, metal: '#7f1d1d', c1: '#450a0a', weapon: 'sword', skin: '#ef4444', hair: '#111827' }],
  r13: ['humanoid', { hat: 'plume', armor: true, cape: '#111827', metal: '#ef4444', weapon: 'sword', beard: true, eye: 'angry', c1: '#1f2937', skin: '#e0a878', armUp: true }],
  r09: ['humanoid', { hat: 'band', weapon: 'sword', hair: '#f8fafc', longHair: true, eye: 'sleepy', cape: '#450a0a', c1: '#1f2937', scarf: '#dc2626', armUp: true }],
  // 青：水と氷の魔導士
  b01: ['blob', {}],
  b02: ['humanoid', { hat: 'hood', weapon: 'staff', robe: true, orb: '#bae6fd', c1: '#38bdf8' }],
  b03: ['blob', { shell: true }],
  b04: ['humanoid', { hat: 'hood', weapon: 'book', robe: true, c1: '#64748b', c2: '#334155', eye: 'sleepy', scarf: '#93c5fd' }],
  b05: ['humanoid', { hat: 'witch', weapon: 'staff', robe: true, hair: '#0e7490', longHair: true, c1: '#0e7490', c2: '#164e63', orb: '#5eead4' }],
  b06: ['giant', { kind: 'ice' }],
  b07: ['humanoid', { hat: 'tall', weapon: 'staff', robe: true, beard: true, c1: '#1e3a8a', orb: '#fde68a' }],
  b08: ['serpent', { fins: true, crown: true }],
  b10: ['humanoid', { hat: 'tall', weapon: 'shield', robe: true, c1: '#0ea5e9', metal: '#e0f2fe', hair: '#e0f2fe', longHair: true }],
  b11: ['humanoid', { hat: 'goggles', weapon: 'staff', robe: true, c1: '#1d4ed8', orb: '#f97316', hair: '#f59e0b', armUp: true }],
  b12: ['blob', { col: '#94a3b8', mist: true }],
  b13: ['humanoid', { hat: 'hood', robe: true, beard: true, weapon: 'staff', c1: '#e0f2fe', c2: '#38bdf8', orb: '#ffffff', skin: '#bfdbfe' }],
  b09: ['humanoid', { hat: 'turban', weapon: 'book', robe: true, beard: true, c1: '#0f766e', c2: '#fde68a', skin: '#e2e8f0' }],
  // 緑：森の精霊と植物
  g01: ['beast', { size: 0.9, antlers: true, tail: 'bushy', moss: true, leg: 17, col: '#a16207', snout: 0.9, spots: '#fef9c3' }],
  g02: ['humanoid', { hat: 'straw', weapon: 'basket', c1: '#15803d', hair: '#92400e' }],
  g03: ['humanoid', { hat: 'leaf', weapon: 'bow', c1: '#166534', hair: '#14532d', scarf: '#84cc16' }],
  g04: ['giant', { kind: 'cactus' }],
  g05: ['humanoid', { hat: 'ears', weapon: 'staff', robe: true, hair: '#fde68a', longHair: true, c1: '#f0fdf4', c2: '#86efac', orb: '#bbf7d0' }],
  g06: ['giant', { kind: 'tree', beard: true }],
  g07: ['serpent', { vines: true, eye: 'angry' }],
  g08: ['giant', { kind: 'tree', big: true }],
  g12: ['humanoid', { hat: 'ears', robe: true, hair: '#15803d', longHair: true, weapon: 'staff', c1: '#fefce8', c2: '#22c55e', orb: '#fde047', scarf: '#f472b6' }],
  g09: ['humanoid', { hat: 'hood', weapon: 'shield', robe: true, c1: '#f0fdf4', c2: '#16a34a', metal: '#fde68a' }],
  g10: ['giant', { kind: 'tree', eye: 'angry' }],
  g11: ['humanoid', { hat: 'fullhelm', armor: true, metal: '#a3a3a3', c1: '#166534', weapon: 'sword' }],
  // 黄：鳥と天空の騎士
  y01: ['bird', { fat: 1.15, wing: 0.55, head: 1.05, helmet: true, col: '#fde047' }],
  y02: ['humanoid', { hat: 'turban', weapon: 'shield', c1: '#ca8a04', skin: '#d6a373', scarf: '#f5f5f4' }],
  y03: ['bird', { wing: 1, hook: true, crest: '#854d0e', col: '#a16207', tailF: true, eye: 'angry' }],
  y04: ['humanoid', { hat: 'helmet', weapon: 'flag', c1: '#ca8a04', metal: '#e5e7eb' }],
  y05: ['humanoid', { hat: 'goggles', weapon: 'crossbow', c1: '#78716c', c2: '#44403c', hair: '#57534e' }],
  y06: ['humanoid', { hat: 'fullhelm', weapon: 'shield', armor: true, metal: '#fcd34d', cape: '#f8fafc', c1: '#fef3c7' }],
  y07: ['humanoid', { hat: 'hood', weapon: 'lightningbow', c1: '#1e3a8a', c2: '#172554', eye: 'angry', scarf: '#fde047' }],
  y08: ['bird', { wing: 1.05, hook: true, crest: '#fbbf24', col: '#f8fafc', tailF: true, fat: 1.1, eye: 'angry', feet: '#fbbf24' }],
  y10: ['humanoid', { hat: 'band', weapon: 'bow', c1: '#a16207', hair: '#451a03', scarf: '#fde047', eye: 'angry' }],
  y11: ['bird', { wing: 0.9, hook: true, col: '#64748b', tailF: true, eye: 'angry', fat: 0.85, crest: '#fde047' }],
  y12: ['bird', { wing: 1.1, hook: true, col: '#92400e', crest: '#f8fafc', helmet: true, tailF: true }],
  y13: ['humanoid', { hat: 'plume', weapon: 'shield', armor: true, metal: '#f8fafc', cape: '#fde047', c1: '#fef9c3' }],
  y14: ['humanoid', { hat: 'ears', hair: '#fde047', longHair: true, weapon: 'lightningbow', cape: '#fbbf24', c1: '#fffbeb', c2: '#ca8a04', eye: 'angry' }],
  y09: ['humanoid', { hat: 'witch', weapon: 'flag', cape: '#78350f', c1: '#f5f5f4', c2: '#ca8a04', hair: '#78350f', beard: true }],
  // 紫：アンデッドと悪魔
  p01: ['bird', { bat: true, wing: 0.95, col: '#6b21a8', fat: 0.8, eye: 'red', feet: '#3b0764' }],
  p02: ['beast', { size: 0.85, ear: 'ragged', tail: 'thin', tailCol: '#f9a8d4', snout: 1.1, teeth: true, spots: '#a3e635', col: '#6b7280', eye: 'red', leg: 9, whisker: true }],
  p03: ['humanoid', { hat: 'mask', weapon: 'daggers', c1: '#1f2937', c2: '#111827', scarf: '#7e22ce', hair: '#111827' }],
  p04: ['humanoid', { eye: 'button', mouth: 'stitch', stitch: true, hair: '#7c2d12', longHair: true, robe: true, c1: '#a21caf', skin: '#fde2c4' }],
  p05: ['humanoid', { mouth: 'jaw', eye: 'red', skin: '#86a886', c1: '#44403c', hair: '#3f3f46', armUp: true, scarf: '#7e22ce' }],
  p06: ['humanoid', { hat: 'hood', weapon: 'staff', robe: true, skin: '#e7e5e4', eye: 'red', c1: '#581c87', orb: '#a3e635', mouth: 'stitch' }],
  p07: ['humanoid', { hat: 'jester', mouth: 'grin', eye: 'angry', skin: '#fafafa', c1: '#7e22ce', weapon: 'daggers' }],
  p08: ['demon', {}],
  p10: ['humanoid', { hat: 'witch', weapon: 'staff', robe: true, c1: '#4c1d95', c2: '#a3e635', orb: '#a3e635', skin: '#d9f99d', eye: 'red' }],
  p11: ['humanoid', { hat: 'tall', robe: true, weapon: 'book', c1: '#3b0764', skin: '#e7e5e4', mouth: 'stitch', eye: 'red', beard: true }],
  p12: ['humanoid', { hat: 'straw', weapon: 'daggers', mouth: 'grin', c1: '#86198f', scarf: '#a3e635', hair: '#111827' }],
  p13: ['humanoid', { hat: 'ears', hair: '#86198f', longHair: true, robe: true, c1: '#4a044e', c2: '#a3e635', weapon: 'daggers', eye: 'red', scarf: '#a3e635', skin: '#e9d5ff' }],
  p09: ['humanoid', { hat: 'fullhelm', weapon: 'shield', armor: true, metal: '#6b21a8', cape: '#1e1b4b', c1: '#3b0764', eye: 'red' }],  // 追加のモンスター
  r15: ['humanoid', { hat: 'band', weapon: 'sword', hair: '#7f1d1d', longHair: true, eye: 'red', mouth: 'jaw', c1: '#450a0a', skin: '#d9a066', scarf: '#f8fafc', stitch: true, armUp: true }],
  r16: ['humanoid', { hat: 'plume', weapon: 'flag', armor: true, metal: '#fca5a5', cape: '#b91c1c', c1: '#dc2626', hair: '#fbbf24' }],
  r17: ['beast', { size: 1.15, ear: 'point', tail: 'thin', tailCol: '#7f1d1d', snout: 1.35, snoutCol: '#fecaca', teeth: true, eye: 'angry', col: '#991b1b', spikes: true, leg: 13, head: 1.15 }],
  b15: ['humanoid', { hat: 'ears', weapon: 'staff', robe: true, hair: '#bae6fd', longHair: true, c1: '#0369a1', c2: '#e0f2fe', orb: '#f0abfc', armUp: true }],
  b16: ['humanoid', { hat: 'witch', weapon: 'book', robe: true, hair: '#1e3a8a', longHair: true, c1: '#312e81', c2: '#93c5fd', eye: 'sleepy', scarf: '#f0abfc', glow: '#93c5fd' }],
  b17: ['humanoid', { hat: 'fullhelm', weapon: 'shield', armor: true, metal: '#7dd3fc', c1: '#1e40af', cape: '#fde047', glow: '#fde047' }],
  g14: ['giant', { kind: 'tree' }],
  g15: ['beast', { low: true, size: 1.1, ear: '', tail: 'thin', tailCol: '#365314', snout: 0.9, col: '#4d7c0f', spots: '#a3e635', leg: 7, moss: true, eye: 'sleepy' }],
  g16: ['humanoid', { hat: 'helmet', weapon: 'shield', armor: true, metal: '#d4d4d8', cape: '#166534', c1: '#14532d', beard: true, hair: '#e5e7eb', eye: 'sleepy' }],
  y16: ['humanoid', { hat: 'hood', weapon: 'crossbow', c1: '#713f12', c2: '#422006', scarf: '#fef08a', eye: 'sleepy', hair: '#fef3c7' }],
  y17: ['humanoid', { hat: 'leaf', weapon: 'bow', c1: '#ca8a04', c2: '#fef9c3', hair: '#f8fafc', longHair: true, cape: '#0ea5e9', armUp: true }],
  y18: ['humanoid', { hat: 'turban', weapon: 'shield', armor: true, metal: '#fde68a', c1: '#a16207', skin: '#c68a5a', scarf: '#dc2626' }],
  p15: ['humanoid', { hat: 'jester', weapon: 'daggers', mouth: 'grin', eye: 'red', skin: '#bef264', c1: '#581c87', c2: '#a3e635', armUp: true }],
  p16: ['humanoid', { hat: 'hood', weapon: 'daggers', robe: true, c1: '#0f0a1e', c2: '#3b0764', eye: 'red', skin: '#a8a29e', scarf: '#dc2626', glow: '#7e22ce' }],
  r20: ['humanoid', { hat: 'ears', weapon: 'daggers', c1: '#7f1d1d', c2: '#f97316', hair: '#f97316', scarf: '#fde047', eye: 'angry', mouth: 'grin', skin: '#fed7aa' }],
  b19: ['humanoid', { hat: 'goggles', weapon: 'book', robe: true, c1: '#1e40af', c2: '#f97316', orb: '#f97316', hair: '#64748b', beard: true }],
  g19: ['humanoid', { hat: 'straw', weapon: 'staff', robe: true, c1: '#4d7c0f', c2: '#fef9c3', orb: '#f472b6', hair: '#fef9c3', longHair: true, eye: 'sleepy' }],
  y21: ['humanoid', { hat: 'goggles', weapon: 'crossbow', c1: '#a16207', c2: '#57534e', hair: '#b45309', scarf: '#38bdf8', beard: true }],
  p19: ['beast', { size: 0.8, ear: 'ragged', tail: 'long', tailCol: '#a3e635', snout: 0.8, col: '#581c87', spots: '#a3e635', eye: 'red', teeth: true, leg: 9, whisker: true }],
  p20: ['humanoid', { hat: 'hood', weapon: 'book', robe: true, c1: '#4a044e', c2: '#fbbf24', skin: '#d6d3d1', hair: '#e5e7eb', longHair: true, eye: 'sleepy', orb: '#fbbf24', scarf: '#fbbf24' }],
  r19: ['humanoid', { hat: 'helmet', weapon: 'flag', armor: true, metal: '#78716c', c1: '#991b1b', cape: '#44403c', beard: true, eye: 'angry', armUp: true }],
  g18: ['humanoid', { hat: 'hood', weapon: 'staff', robe: true, c1: '#57534e', c2: '#65a30d', orb: '#a8a29e', skin: '#d6d3d1', eye: 'sleepy', beard: true }],
  // 召喚モンスター
  tk1: ['blob', { col: '#a8a29e', shell: true }],
  tk2: ['beast', { size: 0.9, ear: '', tail: '', snout: 1.2, col: '#78716c', spikes: true, teeth: true, eye: 'angry', leg: 10 }],
  tk3: ['blob', { col: '#b45309' }],
  tk4: ['giant', { kind: 'ice' }],
  r18: ['humanoid', { hat: 'straw', weapon: 'basket', c1: '#b91c1c', c2: '#7f1d1d', hair: '#451a03', scarf: '#fbbf24', skin: '#e0a878' }],
  b18: ['humanoid', { hat: 'turban', weapon: 'staff', robe: true, c1: '#075985', c2: '#22d3ee', orb: '#22d3ee', beard: true, skin: '#cffafe', eye: 'angry' }],
  g17: ['humanoid', { hat: 'leaf', weapon: 'staff', robe: true, hair: '#a7f3d0', longHair: true, c1: '#065f46', c2: '#fde68a', orb: '#f9a8d4', eye: 'sleepy', glow: '#86efac' }],
  y19: ['humanoid', { hat: 'band', weapon: 'spear', c1: '#fde047', c2: '#a16207', hair: '#f8fafc', scarf: '#f8fafc', skin: '#f3d2a6', armUp: true }],
  y20: ['bird', { wing: 1, hook: true, col: '#f59e0b', crest: '#dc2626', helmet: true, tailF: true, fat: 0.9, feet: '#dc2626' }],
  p18: ['bird', { wing: 0.85, col: '#1f1147', crest: '#a3e635', eye: 'red', fat: 0.95, tailF: true, feet: '#a3e635', hook: true }],
  p17: ['humanoid', { hat: 'tall', eye: 'button', mouth: 'stitch', stitch: true, skin: '#fafafa', c1: '#701a75', c2: '#fbbf24', hair: '#111827', scarf: '#fbbf24' }],
};

// ---------- レベルによる装飾 ----------

// 背景：Lv3からオーラ、最大レベルで強いオーラ
function artBackdrop(p, lv, max) {
  let g = aE(50, 91, 30, 5, '#000', 'opacity=".35"');
  if (lv >= 3) g = aC(50, 54, lv >= max ? 46 : 40, p.accent, `opacity="${lv >= max ? 0.3 : 0.18}"`) + aC(50, 54, 30, '#fff', 'opacity=".08"') + g;
  return g;
}

const artStar = (x, y, r, f) => aP(`M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3}Z`, f, NO);

// 前景：Lv2からきらめき、最大レベルで冠
function artDeco(p, lv, max, hx, hy) {
  let g = '';
  if (lv >= 2) g += artStar(14, 20, 4, '#fff') + artStar(88, 74, 3, p.accent);
  if (lv >= 3) g += artStar(86, 22, 3.5, '#fff') + artStar(12, 70, 2.6, p.accent);
  if (lv >= 4) g += artStar(50, 96, 2.4, '#fff');
  if (lv >= max && max > 1) {
    const y = Math.max(9, hy - 3);
    g += aP(`M${hx - 8} ${y} l1 -8 l4 4 l3 -7 l3 7 l4 -4 l1 8z`, '#fbbf24', `stroke="#92400e" stroke-width=".8"`) + aC(hx, y - 4.5, 1.3, '#ef4444', NO);
  }
  return g;
}

// 設定のないカード用：攻撃タイプの紋章
function artEmblem(p, type) {
  const E = {
    melee: aL('M30 76 L70 24', METAL, 7) + aL('M26 60 L46 78', p.accent, 6),
    ranged: aL('M36 20 Q78 50 36 80', WOOD, 5) + aL('M36 20 L36 80', '#fff', 1.4) + aL('M30 50 H78', METAL, 3),
    magic: aC(50, 50, 22, p.main) + aC(42, 42, 7, '#fff', 'opacity=".6"'),
    chaos: aL('M50 50 q10 -16 22 -4 q8 16 -12 24 q-26 6 -30 -18 q0 -28 30 -30', p.main, 6),
  };
  return aC(50, 50, 36, p.dark) + (E[type] || E.magic);
}

function monsterArt(card) {
  const p = ART_PAL[card.color] || ART_PAL.none;
  const lv = card.level || 1, max = card.maxLevel || lv;
  const spec = MONSTER_ART[card.id];
  if (!spec) return `<svg class="art" viewBox="0 0 100 100" aria-hidden="true">${artEmblem(p, card.type)}</svg>`;
  const [body, hx, hy] = ART_BUILDERS[spec[0]](p, { ...spec[1], glow: lv >= 4 });
  return `<svg class="art" viewBox="0 0 100 100" aria-hidden="true">${artBackdrop(p, lv, max)}${body}${artDeco(p, lv, max, hx, hy)}</svg>`;
}

// ---------- 装備（武器・防具・アクセサリー） ----------
const ITEM_ART = {
  // 2種類の攻撃を足す装備
  e45: p => aL('M30 80 L70 20', METAL, 7) + aL('M30 80 L70 20', '#c4b5fd', 2.4) + aL('M24 64 L44 84', '#4c1d95', 6) + aC(26, 84, 4, '#a78bfa') + aC(52, 47, 3.6, '#7c3aed', NO) + artStar(66, 30, 4, '#fff'),
  e46: p => aL('M22 56 H78', WOOD, 4) + aL('M22 64 H78', '#57534e', 4) + aL('M62 36 Q80 60 62 84', METAL, 3) + aL('M62 36 L62 84', '#fff', 0.8) + aP('M14 56 l9 -4 v8z', METAL) + aP('M14 64 l9 -4 v8z', '#a855f7') + aL('M82 24 q8 6 0 12 q-8 6 0 12', '#a3e635', 2),
  e47: p => aL('M24 84 L72 20', WOOD, 4) + aP('M68 24 L84 8 L78 32Z', METAL) + aP('M30 78 Q20 70 26 58 Q30 66 34 62 Q32 72 38 74Z', '#f97316') + aP('M32 76 Q26 70 29 64 Q31 69 34 68Z', '#fde047', NO) + aL('M44 60 l8 6', '#dc2626', 4),
  e48: p => aL('M50 88 L50 30', '#bae6fd', 6) + aL('M50 88 L50 30', '#fff', 1.6, 'opacity=".7"') + aL('M36 74 H64', '#1e3a8a', 5) + aP('M50 30 L40 16 L50 4 L60 16Z', '#38bdf8') + aP('M50 4 L50 30 L40 16Z', '#e0f2fe') + artStar(72, 22, 4, '#fff'),
  e49: p => aL('M30 12 Q86 50 30 88', '#eab308', 5) + aL('M34 14 Q82 50 34 86', '#38bdf8', 2) + aL('M30 12 L30 88', '#f1f5f9', 1.2) + aL('M22 50 H82', '#a8a29e', 3) + aP('M80 44 l12 6 l-12 6z', '#fde68a') + artStar(70, 24, 4, '#fff'),
  e50: p => aL('M36 76 L66 30', METAL, 6) + aL('M36 76 L66 30', '#d8b4fe', 1.6) + aL('M28 66 L46 80', '#3b0764', 5) + aC(30, 82, 4, '#a3e635') + aL('M70 60 q10 -4 8 6 q-2 10 -12 4 q-6 -6 2 -10', '#a855f7', 2.4),
  e51: p => aL('M34 14 Q76 50 34 86', WOOD, 5) + aL('M34 14 L34 86', '#f1f5f9', 1.2) + aC(34, 12, 6, '#4ade80') + aP('M60 40 q12 -6 14 4 q-10 4 -14 -4z', '#22c55e') + aP('M58 60 q12 6 14 -4 q-10 -4 -14 4z', '#16a34a') + aC(34, 88, 4, '#a3e635'),
  e01: p => aL('M30 78 L70 22', METAL, 8) + aL('M30 78 L70 22', '#fff', 2, 'opacity=".7"') + aL('M24 62 L44 82', '#b45309', 6) + aC(26, 82, 4, '#fbbf24'),
  e02: p => aL('M34 16 Q84 50 34 84', WOOD, 5.5) + aL('M34 16 L34 84', '#f1f5f9', 1.4) + aL('M26 50 H80', '#a8a29e', 3) + aP('M78 44 l12 6 l-12 6z', METAL),
  e03: p => aC(50, 46, 24, '#7c3aed') + aC(50, 46, 24, '#c4b5fd', 'opacity=".35"') + aE(42, 38, 8, 5, '#fff', 'opacity=".7"') + aP('M30 74 H70 L64 86 H36Z', '#b45309'),
  e04: p => aP('M26 24 L40 18 Q50 26 60 18 L74 24 L70 44 L66 84 H34 L30 44Z', '#92400e') + aL('M50 26 V84', '#451a03', 1.6) + aL('M36 48 H64 M36 62 H64', '#451a03', 1.2) + aC(44, 40, 2, '#fbbf24', NO) + aC(56, 40, 2, '#fbbf24', NO),
  e05: p => aL('M30 20 Q50 44 70 20', '#a8a29e', 2.4) + aP('M50 36 Q70 44 62 66 Q50 84 38 66 Q30 44 50 36Z', '#16a34a') + aP('M50 44 l-6 12 h5 l-3 12 l10 -15 h-5z', '#bbf7d0', NO),
  e06: p => aP('M22 18 H78 V54 Q50 92 22 54Z', '#94a3b8') + aP('M30 26 H70 V52 Q50 80 30 52Z', '#475569') + aL('M50 26 V78 M30 44 H70', METAL, 3) + aC(50, 44, 5, '#fbbf24'),
  e07: p => aL('M22 86 L74 22', WOOD, 5) + aP('M68 28 L88 8 L80 34Z', METAL) + aL('M60 36 l10 8', '#ef4444', 4),
  e08: p => aL('M30 90 V10', WOOD, 5) + aP('M32 14 H82 L70 34 L82 54 H32Z', '#b91c1c') + aP('M46 24 l4 8 l9 1 l-7 6 l2 9 l-8 -5 l-8 5 l2 -9 l-7 -6 l9 -1z', '#fbbf24', NO),
  e09: p => aP('M26 34 Q26 20 44 22 H66 Q78 22 78 38 V58 Q78 70 64 70 H48 L40 84 H26Z', '#b91c1c') + aL('M40 34 V56 M52 32 V56 M64 34 V56', '#7f1d1d', 2) + aR(24, 70, 26, 12, '#fbbf24', 2),
  e10: p => aP('M50 10 L72 40 L58 90 L34 62 L26 34Z', '#7c3aed') + aP('M50 10 L52 46 L26 34Z', '#c4b5fd') + aP('M52 46 L72 40 L58 90Z', '#4c1d95') + aL('M78 20 q8 6 0 14 M18 70 q-8 6 0 14', '#a3e635', 2),
  e11: p => aP('M34 82 Q60 60 52 34 Q66 44 64 20 Q84 46 66 74 Q58 88 34 82Z', '#f97316') + aP('M44 78 Q60 64 56 46 Q70 58 60 74Z', '#fde047', NO) + aL('M26 88 L44 70', '#7f1d1d', 7) + aL('M34 62 L52 80', '#fbbf24', 5),
  e12: p => aR(14, 40, 72, 16, '#dc2626', 4) + aC(50, 48, 9, '#fef3c7') + aC(50, 48, 4.5, '#dc2626') + aL('M86 44 l10 -10 M86 52 l10 12', '#dc2626', 5),
  e13: p => aL('M40 90 L56 30', '#bae6fd', 5) + aP('M56 34 L46 14 L60 4 L72 16 L66 34Z', '#38bdf8') + aP('M60 4 L60 34 L46 14Z', '#e0f2fe') + artStar(78, 30, 5, '#fff') + artStar(34, 22, 3.5, '#fff'),
  e14: p => aP('M22 24 Q50 14 78 24 Q80 62 50 86 Q20 62 22 24Z', '#e2e8f0') + aP('M32 40 q8 -6 14 2 q-7 5 -14 -2z', '#0f172a') + aP('M54 42 q6 -8 14 -2 q-7 7 -14 2z', '#0f172a') + aL('M42 64 l16 0 M44 60 l12 8 M56 60 l-12 8', '#2563eb', 2.4),
  e15: p => aP('M30 18 Q50 28 70 18 L84 86 Q50 76 16 86Z', '#166534') + aL('M50 26 V80', '#14532d', 1.6) + [[22, 52], [18, 72], [78, 52], [82, 72], [34, 30], [66, 30]].map(([x, y]) => aP(`M${x} ${y} l${x < 50 ? -9 : 9} -5 l${x < 50 ? 2 : -2} 9z`, '#84cc16')).join(''),
  e16: p => aP('M50 8 Q88 32 74 70 Q62 92 50 92 Q38 92 26 70 Q12 32 50 8Z', '#22c55e') + aL('M50 14 V90 M50 34 L34 24 M50 34 L66 24 M50 54 L30 42 M50 54 L70 42 M50 72 L34 62 M50 72 L66 62', '#bbf7d0', 1.8) + artStar(80, 20, 5, '#fef08a') + artStar(18, 60, 3.5, '#fef08a'),
  e17: p => aP('M34 26 H66 L60 88 H40Z', '#a16207') + aL('M34 38 H66', '#fbbf24', 3) + [42, 50, 58].map(x => aL(`M${x} 28 V8`, WOOD, 2) + aP(`M${x - 4} 16 l4 -12 l4 12z`, METAL)).join(''),
  e18: p => aP('M30 30 H50 V66 H76 Q84 66 84 76 V84 H30Z', '#fbbf24') + aL('M30 44 H50 M30 56 H50', '#92400e', 1.6) + aP('M30 40 Q8 30 6 12 Q16 22 22 20 Q18 28 30 30Z', '#f8fafc') + aP('M30 52 Q12 48 8 36 Q18 42 30 44Z', '#e2e8f0'),
  e19: p => aP('M36 14 Q62 10 60 34 Q58 70 46 90 Q40 64 34 46 Q28 30 36 14Z', '#f5f5f4') + aP('M46 90 Q50 74 52 60 L60 64 Q54 80 46 90Z', '#a3e635') + aC(68, 76, 5, '#a3e635') + aC(76, 62, 3, '#a3e635') + aC(26, 70, 3.5, '#a3e635'),
  e20: p => aC(50, 50, 30, '#3b0764') + aE(50, 50, 24, 15, '#f5f3ff') + aC(50, 50, 11, '#a21caf') + aC(50, 50, 5, '#111', NO) + aC(46, 46, 2.4, '#fff', NO) + aL('M22 28 l-8 -8 M78 28 l8 -8 M22 72 l-8 8 M78 72 l8 8', '#c084fc', 3),
};

// ---------- フラッシュ（魔法のエフェクト） ----------
const artBolt = (c, w) => aP('M58 6 L30 52 H48 L38 94 L72 42 H54Z', c, `stroke="#fff" stroke-width="${w}" stroke-linejoin="round"`);
Object.assign(ITEM_ART, {
  f01: p => aP('M26 60 L40 34 L64 30 L78 52 L68 76 L38 80Z', '#78716c') + aP('M40 34 L52 52 L26 60Z', '#a8a29e') + aP('M52 52 L78 52 L68 76Z', '#57534e') + aL('M10 24 L24 38 M14 44 L26 50 M30 14 L36 28', '#e7e5e4', 2.4),
  f02: p => aC(50, 50, 34, '#1e3a8a', 'opacity=".5"') + artBolt('#fde047', 2),
  f03: p => aC(50, 50, 34, '#f9a8d4', 'opacity=".35"') + aP('M50 80 Q14 54 26 32 Q38 18 50 36 Q62 18 74 32 Q86 54 50 80Z', '#ec4899') + aP('M46 40 h8 v9 h9 v8 h-9 v9 h-8 v-9 h-9 v-8 h9z', '#fff', NO),
  f04: p => aP('M16 40 Q30 44 50 30 L76 20 Q90 24 86 50 Q78 68 60 60 Q40 56 22 58Z', '#d97706') + aE(80, 38, 7, 16, '#fbbf24') + aL('M14 36 v24', '#92400e', 5) + aL('M92 22 l6 -6 M96 38 h6 M92 54 l6 6', '#fde68a', 2.4),
  f05: p => aC(36, 54, 20, '#7e22ce', 'opacity=".75"') + aC(62, 42, 22, '#6b21a8', 'opacity=".75"') + aC(56, 68, 16, '#581c87', 'opacity=".8"') + [[30, 44], [64, 34], [56, 66], [44, 62], [72, 54]].map(([x, y]) => aC(x, y, 4, '#a3e635')).join(''),
  f06: p => aL('M74 66 A28 28 0 1 1 74 34', '#38bdf8', 9) + aP('M62 22 L90 30 L70 50Z', '#38bdf8') + aC(50, 50, 9, '#e0f2fe'),
  f07: p => aE(50, 30, 34, 16, '#94a3b8') + aE(34, 26, 16, 12, '#cbd5e1') + aE(62, 22, 18, 13, '#e2e8f0') + [[28, 56], [44, 62], [60, 56], [74, 64], [36, 78], [54, 82], [68, 82]].map(([x, y]) => aP(`M${x} ${y - 8} q5 9 0 12 q-5 -3 0 -12z`, '#4ade80')).join(''),
  f08: p => aC(58, 42, 26, '#f97316') + aC(58, 42, 17, '#fde047') + aC(58, 42, 8, '#fff7d6', NO) + aP('M36 54 Q10 70 8 92 Q22 74 44 66Z', '#f97316') + aP('M44 66 Q24 84 26 94 Q36 80 52 70Z', '#fb923c'),
  f09: p => aC(50, 50, 40, '#fde047', 'opacity=".25"') + artBolt('#fff7d6', 3) + aL('M14 20 l10 14 M86 20 l-8 16 M12 78 l12 -6 M88 80 l-10 -8', '#fde047', 3),
  f10: p => aP('M50 12 L78 40 L50 90 L22 40Z', '#38bdf8') + aP('M50 12 L78 40 L50 44Z', '#bae6fd') + aP('M22 40 L50 44 L50 90Z', '#0ea5e9') + artStar(82, 20, 7, '#fff') + artStar(18, 72, 5, '#fff') + artStar(80, 76, 4, '#e0f2fe'),
  f11: p => aP('M22 70 H78 L72 90 H28Z', '#64748b') + aE(50, 70, 28, 7, '#38bdf8') + aL('M50 68 V28', '#7dd3fc', 5) + aL('M50 30 Q30 20 26 46 M50 30 Q70 20 74 46 M50 40 Q38 34 36 54 M50 40 Q62 34 64 54', '#bae6fd', 3) + artStar(50, 16, 5, '#fff'),
  f12: p => aC(50, 44, 28, '#f5f5f4') + aP('M34 64 H66 V82 H34Z', '#f5f5f4') + aC(40, 42, 8, '#111827') + aC(60, 42, 8, '#111827') + aP('M50 50 l-4 9 h8z', '#111827') + aL('M42 70 v12 M50 70 v12 M58 70 v12', '#111827', 1.6) + aC(40, 42, 3, '#a3e635', NO) + aC(60, 42, 3, '#a3e635', NO),
  f13: p => aP('M28 12 H72 V20 Q72 40 54 50 Q72 60 72 80 V88 H28 V80 Q28 60 46 50 Q28 40 28 20Z', '#fde68a') + aP('M36 22 H64 Q62 36 50 44 Q38 36 36 22Z', '#f59e0b', NO) + aP('M40 84 H60 Q58 70 50 64 Q42 70 40 84Z', '#f59e0b', NO) + aR(24, 8, 52, 7, '#92400e', 2) + aR(24, 85, 52, 7, '#92400e', 2),
  f14: p => aL('M16 84 L66 34', '#bae6fd', 5) + aP('M60 26 L88 12 L74 40Z', '#38bdf8') + aP('M88 12 L74 40 L68 32Z', '#e0f2fe') + aL('M16 84 l-6 -10 M16 84 l10 6', '#7dd3fc', 3) + artStar(40, 30, 5, '#fff') + artStar(70, 66, 4, '#fff'),
  f15: p => aP('M18 40 L60 82 L82 60 L40 18Z', '#fde68a') + aP('M36 34 L56 54 L50 60 L30 40Z', '#fef9c3', NO) + [[42, 44], [48, 50], [54, 56]].map(([x, y]) => aC(x, y, 1.6, '#a16207', NO)).join('') + aP('M70 16 h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 v-8 h8z', '#ef4444'),
});

Object.assign(ITEM_ART, {
  e27: p => aP('M22 18 H78 V54 Q50 92 22 54Z', '#bae6fd') + aP('M30 26 H70 V52 Q50 80 30 52Z', '#f0f9ff') + aL('M38 34 L52 48 M44 30 L62 48', '#7dd3fc', 3) + artStar(64, 30, 6, '#fff'),
  e28: p => aP('M22 18 H78 V54 Q50 92 22 54Z', '#78716c') + aP('M30 26 H70 V52 Q50 80 30 52Z', '#44403c') + [[50, 34], [38, 46], [62, 46], [50, 60]].map(([x, y]) => aP(`M${x - 6} ${y + 5} L${x} ${y - 9} L${x + 6} ${y + 5}Z`, '#e7e5e4')).join(''),
  f21: p => aP('M30 26 H70 V52 Q50 80 30 52Z', '#94a3b8') + aP('M44 30 q-10 16 0 22 q10 -6 0 -22z', '#a3e635') + aP('M60 44 q-7 11 0 15 q7 -4 0 -15z', '#84cc16') + aL('M34 60 l10 8 M62 66 l8 -8', '#1e293b', 2.4),
  f22: p => [[26, 30], [50, 22], [74, 30], [36, 56], [64, 56], [50, 76]].map(([x, y]) => aP(`M${x} ${y - 12} q-12 18 0 26 q12 -8 0 -26z`, '#84cc16')).join('') + aC(50, 50, 40, 'none', 'stroke="#bef264" stroke-width="2" stroke-dasharray="4 6"'),
  f23: p => aC(50, 50, 36, '#1e1b4b') + aL('M26 26 L74 74 M74 26 L26 74', '#f87171', 9) + aL('M26 26 L74 74 M74 26 L26 74', '#fff', 2.5),
  f24: p => aR(26, 60, 48, 26, '#475569', 4) + aR(26, 54, 48, 26, '#64748b', 4) + aL('M50 10 V44', '#38bdf8', 8) + aP('M34 34 L50 56 L66 34Z', '#38bdf8'),
  f25: p => aE(40, 44, 28, 16, '#e2e8f0') + aE(62, 54, 26, 15, '#cbd5e1') + aE(42, 66, 30, 13, '#f1f5f9') + aL('M14 84 H60 M40 92 H86', '#e2e8f0', 4),
  f27: p => aP('M30 86 V44 Q30 20 46 20 Q62 20 62 44 V86 l-8 -7 l-8 7 l-8 -7z', '#c4b5fd', 'opacity=".5"') + aP('M42 88 V48 Q42 24 58 24 Q74 24 74 48 V88 l-8 -7 l-8 7 l-8 -7z', '#ede9fe') + aC(52, 46, 3.4, '#4c1d95', NO) + aC(64, 46, 3.4, '#4c1d95', NO) + aL('M52 58 q6 5 12 0', '#4c1d95', 2),
  // 追加の装備・フラッシュ
  e29: p => aL('M30 90 L60 22', WOOD, 6) + aP('M50 14 Q84 8 88 44 Q70 40 58 50 L46 28Z', METAL) + aP('M58 50 Q70 40 88 44 Q82 54 62 58Z', '#64748b') + aL('M72 62 l10 12 M80 58 l12 6', '#fbbf24', 2.5),
  e30: p => [[30, 26], [44, 40], [58, 54], [72, 68]].map(([x, y], i) => aE(x, y, 11, 7, 'none', `stroke="${i % 2 ? '#64748b' : '#94a3b8'}" stroke-width="5" transform="rotate(45 ${x} ${y})"`)).join('') + aC(22, 18, 7, '#7f1d1d') + aP('M78 74 l12 4 l-4 12 l-12 -4z', '#7f1d1d'),
  e31: p => aP('M28 30 Q28 18 44 20 H64 Q76 20 76 36 V54 Q76 66 62 66 H46 L38 80 H26Z', '#9a3412') + aL('M40 30 V52 M52 28 V52 M64 30 V52', '#431407', 2) + aL('M70 74 q14 2 16 -12 M78 62 l8 -2 l2 8', '#fbbf24', 3) + aL('M14 60 q-6 12 6 20 M12 78 l8 2 l-2 -8', '#fbbf24', 3),
  e32: p => aP('M50 6 L66 40 L50 94 L34 40Z', '#38bdf8') + aP('M50 6 L50 94 L34 40Z', '#e0f2fe') + aL('M22 30 L34 40 M78 30 L66 40', '#0369a1', 4) + aP('M18 22 l10 2 l-4 10z', '#7dd3fc') + aP('M82 22 l-10 2 l4 10z', '#7dd3fc'),
  e33: p => aC(32, 50, 16, '#0c4a6e') + aC(68, 50, 16, '#0c4a6e') + aC(32, 50, 10, '#7dd3fc') + aC(68, 50, 10, '#7dd3fc') + aL('M46 46 Q50 42 54 46', '#0c4a6e', 4) + aC(32, 50, 4, '#0f172a', NO) + aC(68, 50, 4, '#0f172a', NO) + aL('M16 46 L6 38 M84 46 L94 38', '#0c4a6e', 4),
  e34: p => aP('M30 54 H70 L64 84 H36Z', '#a16207') + aE(50, 54, 21, 6, '#fde68a') + aL('M30 62 H70', '#fbbf24', 2) + aL('M42 46 q-8 -10 2 -18 q8 -8 0 -16 M58 46 q8 -10 -2 -18 q-6 -6 0 -12', '#bbf7d0', 3.5) + artStar(74, 24, 4.5, '#fef08a'),
  e35: p => aL('M50 92 L50 50 M50 70 L34 46 M50 70 L66 46', '#15803d', 4) + [[50, 34, '#f472b6'], [32, 38, '#fde047'], [68, 38, '#f0abfc']].map(([x, y, c]) => [0, 72, 144, 216, 288].map(a => aE(x, y - 8, 5, 8, c, `${OUT} transform="rotate(${a} ${x} ${y})"`)).join('') + aC(x, y, 4, '#fff7ed')).join('') + aP('M40 78 H60 L56 92 H44Z', '#fca5a5'),
  e36: p => aP('M34 12 Q46 44 40 84 Q30 60 26 34Z', '#f5f5f4') + aP('M66 12 Q54 44 60 84 Q70 60 74 34Z', '#f5f5f4') + aP('M40 84 q-6 6 0 10 q6 -4 0 -10z', '#dc2626') + aP('M60 84 q-6 6 0 10 q6 -4 0 -10z', '#dc2626') + aL('M26 14 Q50 4 74 14', '#7f1d1d', 5),
  e37: p => aL('M40 24 Q76 50 40 76', WOOD, 6) + aL('M40 24 L40 76', '#f1f5f9', 1.4) + aL('M32 50 H70', '#a8a29e', 3) + aP('M68 43 l14 7 l-14 7z', METAL) + aC(22, 50, 12, 'none', 'stroke="#ef4444" stroke-width="3"') + aC(22, 50, 4, '#ef4444', NO),
  e38: p => aP('M50 10 Q78 20 80 50 L88 90 Q50 78 12 90 L20 50 Q22 20 50 10Z', '#422006') + aP('M50 10 Q66 22 64 44 Q50 52 36 44 Q34 22 50 10Z', '#1c1917') + aC(44, 34, 2.6, '#fde047', NO) + aC(56, 34, 2.6, '#fde047', NO) + aL('M30 64 q20 10 40 0', '#a16207', 2),
  e39: p => aR(18, 40, 58, 20, '#57534e', 6) + aC(80, 50, 15, '#292524') + aC(80, 50, 9, '#7dd3fc') + aL('M80 41 V59 M71 50 H89', '#0f172a', 1.6) + aR(34, 30, 16, 10, '#44403c', 2) + aR(24, 60, 10, 14, '#44403c', 2),
  e40: p => aP('M50 20 Q76 22 76 52 Q76 70 50 70 Q24 70 24 52 Q24 22 50 20Z', '#6b21a8') + aL('M28 56 H72', '#3b0764', 3) + aC(50, 78, 8, '#a3e635') + aL('M50 20 V8', '#a8a29e', 4) + aP('M40 40 l6 -8 l2 8z', '#111') + aP('M60 40 l-6 -8 l-2 8z', '#111') + aL('M84 30 q8 8 0 18 M16 30 q-8 8 0 18', '#a3e635', 2.5),
  e41: p => aC(50, 50, 32, '#ca8a04') + aC(50, 50, 25, '#fde047') + [0, 90, 180, 270].map(a => aE(50, 38, 7, 9, '#16a34a', `${OUT} transform="rotate(${a} 50 50)"`)).join('') + aC(50, 50, 4, '#14532d', NO) + artStar(84, 20, 5, '#fff'),
  e42: p => aP('M34 84 Q58 60 52 32 Q66 44 64 16 Q88 46 68 76 Q58 90 34 84Z', '#ea580c') + aL('M28 82 L68 26', METAL, 8) + aL('M28 82 L68 26', '#fff', 2, 'opacity=".7"') + aL('M22 66 L42 86', '#7c2d12', 6) + aP('M58 40 Q66 50 60 62 Q54 52 58 40Z', '#fde047', NO),
  e43: p => aL('M30 92 L46 30', WOOD, 6) + aP('M44 34 Q60 8 92 26 Q64 22 52 44Z', METAL) + aL('M70 60 q4 -14 14 -18 M78 72 q6 -10 14 -10 M64 76 q0 -10 6 -16', '#eab308', 3.5),
  e44: p => aP('M20 40 Q20 28 34 30 L74 44 Q88 50 84 62 Q78 72 64 66 L30 56 Q20 54 20 40Z', '#b45309') + aE(80, 55, 7, 11, '#451a03', `${OUT} transform="rotate(20 80 55)"`) + aL('M34 30 L30 56', '#fbbf24', 3) + aL('M18 80 V60', WOOD, 3) + aP('M20 60 H44 L38 68 L44 76 H20Z', '#f8fafc'),
  f30: p => aC(50, 50, 34, '#1e3a8a', 'opacity=".55"') + aL('M70 30 Q88 50 70 70', '#93c5fd', 5) + aP('M28 50 L52 30 V42 H74 V58 H52 V70Z', '#fde047') + artStar(22, 22, 4, '#fff'),
  f31: p => aP('M26 10 H74 V84 l-8 6 l-8 -6 l-8 6 l-8 -6 l-8 6 l-8 -6Z', '#f8fafc') + aL('M36 26 H64 M36 38 H64 M36 50 H54', '#64748b', 3) + aC(62, 66, 13, '#dc2626') + aL('M56 66 H68 M62 60 V72', '#fff', 3),
  f32: p => [[30, 62], [50, 62], [70, 62], [40, 42], [60, 42], [50, 22]].map(([x, y]) => aR(x - 10, y - 9, 20, 18, '#b45309', 3) + aL(`M${x - 6} ${y - 3} H${x + 6}`, '#7c2d12', 1.6)).join('') + aL('M16 80 H84', '#57534e', 4),
  f33: p => aR(22, 44, 56, 40, '#7e22ce', 5) + aR(18, 34, 64, 14, '#a855f7', 4) + aL('M50 34 V84', '#fde047', 6) + aP('M50 34 Q34 12 30 26 Q30 36 50 34 Q70 36 70 26 Q66 12 50 34Z', '#fde047') + aC(72, 74, 9, '#1f2937') + aL('M72 65 V58 M66 58 H78', '#1f2937', 3),
  f34: p => aL('M70 12 L44 58', WOOD, 6) + aP('M30 54 L58 62 L52 92 L16 82Z', '#eab308') + aL('M26 66 L22 84 M36 68 L32 88 M46 70 L43 90', '#a16207', 2) + artStar(78, 70, 5, '#fff') + artStar(22, 28, 4, '#fff'),
  // 特別カード
  sp1: p => aP('M30 30 H70 L64 88 H36Z', '#64748b') + aR(26, 22, 48, 10, '#94a3b8', 3) + aL('M42 40 V78 M50 40 V78 M58 40 V78', '#334155', 2.5) + aL('M44 22 V14 H56 V22', '#94a3b8', 3),
  sp2: p => aR(26, 12, 48, 76, '#1f2937', 6) + aR(32, 18, 36, 64, '#450a0a', 4) + aL('M40 34 L60 66 M60 34 L40 66', '#f87171', 5),
  sp3: p => aP('M62 14 Q84 40 66 68 Q56 86 38 78 Q20 68 26 48 Q34 58 42 50 Q36 28 62 14Z', '#f97316') + aP('M56 40 Q66 54 56 68 Q46 74 40 64 Q48 62 50 52 Q50 44 56 40Z', '#fde047', NO),
  sp4: p => aR(42, 10, 16, 14, '#a8a29e', 3) + aP('M40 24 H60 L72 50 V80 Q72 90 62 90 H38 Q28 90 28 80 V50Z', '#bbf7d0') + aP('M30 58 H70 V80 Q70 88 62 88 H38 Q30 88 30 80Z', '#22c55e') + aC(44, 70, 3, '#dcfce7', NO) + aC(56, 78, 2.4, '#dcfce7', NO),
  sp5: p => aR(26, 12, 48, 76, '#fef3c7', 6) + aR(32, 18, 36, 64, '#b91c1c', 4) + aC(50, 50, 12, '#fde047') + artStar(50, 50, 7, '#fff'),
  f28: p => aP('M50 8 L70 30 L62 60 L74 88 H26 L38 60 L30 30Z', '#7dd3fc') + aP('M50 8 L50 88 H26 L38 60 L30 30Z', '#e0f2fe') + aL('M38 60 H62 M30 30 H70', '#0369a1', 1.6) + aC(50, 46, 9, '#fff') + aL('M50 46 V40 M50 46 H55', '#0f172a', 2),
  f29: p => aC(50, 50, 20, '#65a30d') + [0, 45, 90, 135, 180, 225, 270, 315].map(a => aP('M50 22 L46 6 L54 6Z', '#a3e635', `${OUT} transform="rotate(${a} 50 50)"`)).join('') + aC(44, 44, 5, '#ecfccb', NO) + aC(58, 56, 3.5, '#ecfccb', NO) + aC(20, 22, 4, '#a3e635') + aC(82, 80, 5, '#a3e635'),
  f26: p => aC(50, 50, 38, '#fde68a', 'opacity=".4"') + aP('M30 22 H70 V52 Q50 84 30 52Z', '#f8fafc') + aP('M46 32 h8 v10 h10 v8 h-10 v14 h-8 v-14 h-10 v-8 h10z', '#f59e0b', NO),
});

function itemArt(card) {
  const p = ART_PAL[card.color] || ART_PAL.none;
  // 色付き版（同色割引）は、無色版と同じ絵に、その色の光をまとわせる
  const draw = ITEM_ART[card.id] || ITEM_ART[card.base];
  const tint = card.base ? aC(50, 50, 47, p.main, 'opacity=".4"') + aC(50, 50, 47, 'none', `stroke="${p.light}" stroke-width="2.5" stroke-dasharray="6 5"`) : '';
  const lv = card.level || 1, max = card.maxLevel || lv;
  const body = draw ? draw(p) : card.kind === 'flash' ? aC(50, 50, 30, p.main, 'opacity=".5"') + artBolt('#fde047', 2) : aP('M22 18 H78 V54 Q50 92 22 54Z', p.main);
  const glow = lv >= max && max > 1 ? aC(50, 50, 46, '#fbbf24', 'opacity=".22"') : '';
  const stars = lv >= 2 ? artStar(12, 14, 4.5, '#fff') + (lv >= 3 ? artStar(90, 88, 4, '#fde68a') : '') : '';
  return `<svg class="art" viewBox="0 0 100 100" aria-hidden="true">${glow}${tint}${body}${stars}</svg>`;
}
const equipArt = itemArt;
const flashArt = itemArt;

// カードの絵のHTML。card.image があればその画像を上に重ね、読み込めなければSVGが見える
function cardArtHtml(card) {
  const svg = card.kind === 'monster' ? monsterArt(card) : itemArt(card);
  if (!card.image) return svg;
  return `${svg}<img class="art-img" src="${card.image}" alt="" loading="lazy" onerror="this.remove()">`;
}

// ---------- ボス（専用の大きな絵。viewBox 0 0 140 140） ----------
const BOSS_ART = {
  // 突撃隊長ガルド：双斧を持つ赤い鎧の隊長
  '1-10': p => {
    const [body] = artHumanoid(p, { hat: 'plume', armor: true, cape: '#450a0a', metal: '#f59e0b', eye: 'angry', c1: '#991b1b' });
    const axe = x => aL(`M${x} 96 L${x} 20`, WOOD, 4) + aP(`M${x} 24 Q${x + 26} 22 ${x + 22} 48 Q${x + 12} 40 ${x} 46Z`, METAL) + aP(`M${x} 24 Q${x - 26} 22 ${x - 22} 48 Q${x - 12} 40 ${x} 46Z`, '#e5e7eb');
    return aC(70, 74, 60, '#f97316', 'opacity=".22"') + [20, 44, 96, 120].map((x, i) => aP(`M${x} 126 q-8 -22 4 -34 q2 12 8 8 q-2 16 -4 26z`, i % 2 ? '#fbbf24' : '#f97316', NO)).join('')
      + axe(26) + axe(114) + `<g transform="translate(-12 0) scale(1.64 1.36)">${body}</g>`;
  },
  // 霧の女王セレーネ：月の杖を持つ女王
  '2-10': p => {
    const [body] = artHumanoid(p, { hat: 'ears', robe: true, hair: '#e0f2fe', longHair: true, c1: '#1d4ed8', c2: '#93c5fd', skin: '#eff6ff', weapon: 'staff', orb: '#fef9c3', cape: '#1e3a8a' });
    return aC(70, 66, 58, '#93c5fd', 'opacity=".2"') + aC(108, 26, 16, '#fef9c3') + aC(114, 22, 14, '#1e293b', NO)
      + `<g transform="translate(-12 4) scale(1.64 1.4)">${body}${aP('M40 19 l2 -9 l4 5 l4 -9 l4 9 l4 -5 l2 9z', '#fbbf24')}</g>`
      + [[14, 100, 34], [100, 112, 40], [50, 124, 46]].map(([x, y, r]) => aE(x + r / 2, y, r, 9, '#e0f2fe', 'opacity=".4"')).join('');
  },
  // 茨の守護者ユグ：トゲのツタをまとった大樹
  '3-10': p => {
    const [body] = artGiant(p, { kind: 'tree', big: true, beard: true, eye: 'angry' });
    const vine = (d) => aL(d, '#14532d', 6) + aL(d, '#84cc16', 2.4);
    return aC(70, 70, 60, '#4ade80', 'opacity=".18"') + vine('M4 120 Q20 60 44 96 Q60 120 30 132') + vine('M136 116 Q120 56 98 92 Q84 118 112 132')
      + [[14, 88], [30, 70], [124, 86], [108, 68], [44, 110], [98, 108]].map(([x, y]) => aP(`M${x} ${y} l6 -12 l4 12z`, '#bef264')).join('')
      + `<g transform="translate(-10 2) scale(1.6 1.44)">${body}</g>`;
  },
  // 天空王アクィラ：冠をいただく大鷲
  '4-10': p => {
    const [body] = artBird(p, { wing: 1.1, hook: true, crest: '#fbbf24', col: '#f8fafc', tailF: true, fat: 1.15, eye: 'angry', feet: '#fbbf24' });
    return aC(70, 66, 60, '#fde047', 'opacity=".22"') + [[18, 14], [116, 20], [64, 4]].map(([x, y]) => aP(`M${x} ${y} l-8 20 h8 l-8 20`, 'none', 'stroke="#fff7d6" stroke-width="3" stroke-linejoin="round"')).join('')
      + `<g transform="translate(-14 -8) scale(1.68 1.5)">${body}${aP('M41 31 l2 -11 l4 6 l3 -10 l3 10 l4 -6 l2 11z', '#fbbf24', 'stroke="#92400e" stroke-width=".8"')}</g>`
      + aE(26, 126, 30, 8, '#fff', 'opacity=".7"') + aE(108, 130, 34, 8, '#fff', 'opacity=".7"');
  },
  // 終焉の魔王ネザー：紫の炎をまとう魔王
  '5-10': p => {
    const [body] = artDemon(p, {});
    return aC(70, 72, 62, '#a21caf', 'opacity=".28"') + [10, 30, 54, 86, 110, 128].map((x, i) => aP(`M${x} 134 q-10 -26 4 -42 q2 14 8 10 q-2 18 -4 32z`, i % 2 ? '#e879f9' : '#7e22ce', NO)).join('')
      + aL('M118 118 L118 26', '#1e1b4b', 5) + aP('M110 30 L118 4 L126 30Z', '#e879f9') + aL('M106 34 H130', '#fbbf24', 4)
      + `<g transform="translate(-12 -2) scale(1.64 1.48)">${body}</g>`;
  },
};

function bossArt(stageId) {
  const draw = BOSS_ART[stageId];
  if (!draw) return '';
  const color = { '1-10': 'red', '2-10': 'blue', '3-10': 'green', '4-10': 'yellow', '5-10': 'purple' }[stageId];
  return `<svg class="art boss-art" viewBox="0 0 140 140" aria-hidden="true">${draw(ART_PAL[color])}</svg>`;
}

// Elite カードの絵（既存の部品を組み合わせた、金色を基調にした姿）
Object.assign(MONSTER_ART, {
  r14: ['humanoid', { hat: 'plume', weapon: 'sword', armor: true, cape: '#fbbf24', metal: '#fde68a', eye: 'red', armUp: true, c1: '#7f1d1d', skin: '#fca5a5', beard: true }],
  b14: ['humanoid', { hat: 'tall', weapon: 'staff', robe: true, hair: '#e0f2fe', longHair: true, c1: '#0c4a6e', c2: '#fde68a', orb: '#a5f3fc', skin: '#e0f2fe' }],
  g13: ['serpent', { vines: true, eye: 'glow', col: '#365314' }],
  y15: ['bird', { wing: 1.2, hook: true, crest: '#f59e0b', col: '#fde047', tailF: true, fat: 1.15, eye: 'angry', feet: '#b45309' }],
  p14: ['humanoid', { hat: 'jester', mouth: 'grin', eye: 'red', skin: '#e9d5ff', c1: '#3b0764', c2: '#fbbf24', weapon: 'daggers', cape: '#fbbf24' }],
});

// ヒーローの顔（対戦画面のアイコンなど）。ボスは専用の絵、それ以外は対応するモンスターカードの絵
function heroArt(hero) {
  if (!hero) return '';
  if (hero.boss) return bossArt(hero.boss);
  return monsterArt(cardAt(HERO_BY_ID[hero.id].card));
}
