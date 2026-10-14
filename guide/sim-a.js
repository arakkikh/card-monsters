// 攻略本のシミュレーション A：カードの評価・スキルの相性・基本の統計
const OUT = { games: {} };
const G = typeof GUIDE_SCALE === 'undefined' ? 1 : GUIDE_SCALE;
const n = x => Math.max(20, Math.round(x * G));

// 1. カードごとの「採用時の勝率」（ランダムなデッキ同士。そのカードが入っていた側の勝率）
for (const lv of [1, 3]) {
  const r = cardReport(n(20000), lv, 11 + lv);
  OUT['cards' + lv] = { games: r.games, level: lv, firstWin: r.firstWin, avgTurns: r.avgTurns, maxTurns: r.maxTurns, cards: r.cards, skills: r.skills, colors: r.colors };
}
// 2. Elite カード（ランダムデッキには入らないので、1枚入れたデッキで測る）
function forced(rng, id, copies, level) {
  const d = randomDeck(rng);
  const key = CARD_DEFS[id].kind === 'monster' ? 'monsters' : 'items';
  d[key] = [...Array(copies).fill(id), ...d[key].filter(x => x !== id).slice(0, 8 - copies)];
  return deckAtLevel(d, level, rng);
}
OUT.elites = { games: n(2000), level: 3, cards: ELITES.map(c => {
  const rng = seededRng(77); let w = 0; const N = n(2000);
  for (let g = 0; g < N; g++) if (g % 2 ? simulateGame(deckAtLevel(randomDeck(rng), 3, rng), forced(rng, c.id, 1, 3), rng).winner === 1 : simulateGame(forced(rng, c.id, 1, 3), deckAtLevel(randomDeck(rng), 3, rng), rng).winner === 0) w++;
  return { key: c.id, n: N, rate: pct(w, N) };
}) };
// 3. スキルの組み合わせ：Aを持つカードとBを持つカードを両方入れたデッキ／片方だけ／どちらもなし の勝率
const has = (d, s) => cardAt(d.id).skills.some(k => k.id === s);
const withSkill = (s, other) => MONSTERS.filter(d => d.rarity !== 'legend' && has(d, s) && !(other && has(d, other)));
function comboDeck(rng, ids, level) {
  const d = randomDeck(rng);
  const rest = d.monsters.filter(x => !ids.includes(x)).slice(0, 8 - ids.length);
  d.monsters = [...ids, ...rest];
  return deckAtLevel(d, level, rng);
}
const PAIRS = [['disease', 'outbreak'], ['inspire', 'batter'], ['shoot', 'craze'], ['flying', 'massbombard'], ['heal', 'thorns'], ['silence', 'suppress'], ['taunt', 'heal'], ['inspire', 'shoot'], ['entangle', 'flying']];
OUT.combos = { games: n(2500), level: 3, pairs: PAIRS.map(([a, b]) => {
  const A = withSkill(a, b), B = withSkill(b, a);
  if (!A.length || !B.length) return null;
  const run = (pick, seed) => { const rng = seededRng(seed); let w = 0; const N = n(2500);
    for (let g = 0; g < N; g++) { const ids = pick(rng); if (g % 2 ? simulateGame(deckAtLevel(randomDeck(rng), 3, rng), comboDeck(rng, ids, 3), rng).winner === 1 : simulateGame(comboDeck(rng, ids, 3), deckAtLevel(randomDeck(rng), 3, rng), rng).winner === 0) w++; }
    return pct(w, N); };
  const one = (list, rng) => list[Math.floor(rng() * list.length)].id;
  const both = run(rng => [one(A, rng), one(B, rng)], 301), onlyA = run(rng => [one(A, rng)], 301), onlyB = run(rng => [one(B, rng)], 301), none = run(() => [], 301);
  return { a, b, both, onlyA, onlyB, none, synergy: Math.round(10 * (both - onlyA - onlyB + none)) / 10 };
}).filter(x => x) };
// 4. 回復と Disease：Heal 持ちのデッキが、Disease 持ちの相手に対して勝率を落とすか
(() => {
  const healer = withSkill('heal'), sick = withSkill('disease');
  const N = n(2500);
  const run = (foeIds, seed) => { const rng = seededRng(seed); let w = 0; for (let g = 0; g < N; g++) { const me = comboDeck(rng, [healer[Math.floor(rng() * healer.length)].id], 3); const foe = comboDeck(rng, foeIds(rng), 3); if (simulateGame(me, foe, rng).winner === 0) w++; } return pct(w, N); };
  OUT.healVsDisease = { games: N, vsDisease: run(rng => [sick[Math.floor(rng() * sick.length)].id, sick[Math.floor(rng() * sick.length)].id].filter((x, i, l) => l.indexOf(x) === i), 401), vsNormal: run(() => [], 401) };
})();
// 5. 同じカードを2枚入れたデッキと、1枚ずつのデッキ
OUT.pairs = [1, 2, 4].map(k => { const rng = seededRng(900 + k); let w = 0, N = 0; for (let g = 0; g < n(2000); g++) { if (simulateGame(deckAtLevel(randomDeck(rng, { pairs: k }), 3, rng), deckAtLevel(randomDeck(rng), 3, rng), rng).winner === 0) w++; if (simulateGame(deckAtLevel(randomDeck(rng), 3, rng), deckAtLevel(randomDeck(rng, { pairs: k }), 3, rng), rng).winner === 1) w++; N += 2; } return { pairs: k, games: N, rate: pct(w, N) }; });
// 6. オート「つよい」対「ふつう」
(() => { const rng = seededRng(21); let w = 0, N = 0; for (let g = 0; g < n(600); g++) { const a = deckAtLevel(randomDeck(rng), 3, rng), b = deckAtLevel(randomDeck(rng), 3, rng); const seed = Math.floor(rng() * 1e9);
  if (simulateGame(a, b, seededRng(seed), { brains: [autoStrongAction, autoNextAction] }).winner === 0) w++; if (simulateGame(b, a, seededRng(seed + 1), { brains: [autoNextAction, autoStrongAction] }).winner === 1) w++; N += 2; }
  OUT.auto = { games: N, rate: pct(w, N) }; })();
print(JSON.stringify(OUT));
