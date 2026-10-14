// オート「つよい」対「ふつう」を、追加カードのグループごとに測る（もとのカード＋そのグループだけでデッキを組む）
const GROUPS = {
  bc: id => /^(r1[5-7]|b1[5-7]|g1[4-6]|y1[6-8]|p1[5-7]|e(29|3\d|4[0-3])|f2[89])$/.test(id),
  cost: id => ['r18', 'b18', 'g17', 'y19', 'y20', 'p18', 'e44', 'f30', 'f31'].includes(id),
  summon: id => ['r19', 'g18', 'f32', 'f33'].includes(id),
  special: id => ['r20', 'b19', 'g19', 'y21', 'p19', 'p20', 'f34'].includes(id),
};
const isNew = id => Object.values(GROUPS).some(f => f(id));
const allow = KEEP.split(',').filter(x => x);
const bad = id => isNew(id) && !allow.some(g => GROUPS[g](id));
const rng = seededRng(4242);
const deck = () => { for (;;) { const d = randomDeck(rng); if (![...d.monsters, ...d.items].some(bad)) return deckAtLevel(d, 3, rng); } };
let w = 0, n = 0;
for (let g = 0; g < PAIRS; g++) {
  const a = deck(), b = deck(), seed = 1000 + g * 2;
  if (simulateGame(a, b, seededRng(seed), { brains: [autoStrongAction, autoNextAction] }).winner === 0) w++;
  if (simulateGame(b, a, seededRng(seed + 1), { brains: [autoNextAction, autoStrongAction] }).winner === 1) w++;
  n += 2;
}
print('もとのカード＋[' + KEEP + ']', 'games', n, Math.round(1000 * w / n) / 10 + '%');
