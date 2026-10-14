// 攻略本のシミュレーション B：おすすめデッキを探す（山登り法）。同じ条件の相手12デッキとの勝率で比べる
const G = typeof GUIDE_SCALE === 'undefined' ? 1 : GUIDE_SCALE;
const n = x => Math.max(2, Math.round(x * G));
const rank = id => RARITY_ORDER.indexOf(CARD_DEFS[id].rarity);
const HERO_OF = Object.fromEntries(HEROES.map(h => [h.color, h]));

// 段階ごとの条件。maxRank: 使えるレアリティの上限　strong: 上限のレアリティを何枚まで　level: カードレベル
const TIERS = {
  beginner: { label: '初心者向け', level: 1, rarities: ['common', 'rare'], cap: { rare: 2 }, heroSkill: 0, optionLv: false },
  middle: { label: '中級者向け', level: 3, rarities: ['common', 'rare', 'epic'], cap: { epic: 4 }, heroSkill: 1, optionLv: true },
  advanced: { label: '上級者向け', level: 5, rarities: ['common', 'rare', 'epic', 'legend'], cap: { legend: 3 }, heroSkill: 2, optionLv: true },
};
const PLANS = [
  ...Object.keys(COLORS).map(c => ({ tier: 'beginner', main: c, minMain: 4 })),
  { tier: 'middle', main: 'red', minMain: 4 }, { tier: 'middle', main: 'blue', minMain: 4 }, { tier: 'middle', main: 'purple', minMain: 4 },
  { tier: 'advanced', main: 'green', minMain: 3 }, { tier: 'advanced', main: 'yellow', minMain: 3 },
];

function finish(deck, plan) {
  const T = TIERS[plan.tier];
  const levels = {};
  [...deck.monsters, ...deck.items].forEach(id => { levels[id] = Math.min(T.level, maxLevel(id)); });
  const options = {};
  if (T.optionLv) for (const id of [...deck.monsters, ...deck.items]) if (optionAvailable(id, levels[id])) options[id] = 0;
  const hero = HERO_OF[plan.main];
  return { monsters: deck.monsters.slice(), items: deck.items.slice(), levels, options, hero: { id: hero.id, name: hero.name, skill: hero.skills[T.heroSkill].id } };
}
// 条件に合っているか：枚数・同じカードの枚数・レアリティの上限・主な色の数・アイテムが使える色か
function legal(deck, plan) {
  const T = TIERS[plan.tier];
  const all = [...deck.monsters, ...deck.items];
  if (deck.monsters.length !== 8 || deck.items.length !== 8) return false;
  for (const id of all) { if (!T.rarities.includes(CARD_DEFS[id].rarity)) return false; if (all.filter(x => x === id).length > copyLimit(id)) return false; }
  for (const r in T.cap) if (all.filter(id => CARD_DEFS[id].rarity === r).length > T.cap[r]) return false;
  if (deck.monsters.filter(id => CARD_DEFS[id].color === plan.main).length < plan.minMain) return false;
  const colors = new Set(deck.monsters.map(id => CARD_DEFS[id].color));
  if (!deck.items.every(id => !CARD_DEFS[id].color || colors.has(CARD_DEFS[id].color))) return false;
  return deck.monsters.some(id => CARD_DEFS[id].cost <= CONFIG.CRYSTALS_PER_TURN);
}
// 比べる相手：同じ段階の条件（レアリティの上限など）で組んだ、いろいろな色のランダムなデッキ12個
function gauntlet(plan, seed) {
  const rng = seededRng(seed);
  const colors = Object.keys(COLORS);
  return [...Array(12)].map((x, i) => { const p = { tier: plan.tier, main: colors[i % colors.length], minMain: 3 }; return finish(randomLegal(p, rng), p); });
}
function evaluate(deck, plan, foes, games, seed) {
  const d = finish(deck, plan); const rng = seededRng(seed); let w = 0, N = 0;
  for (const f of foes) for (let g = 0; g < games; g++) { if (g % 2 ? simulateGame(f, d, rng).winner === 1 : simulateGame(d, f, rng).winner === 0) w++; N++; }
  return w / N;
}
function startDeckFor(plan, rng) {
  const T = TIERS[plan.tier];
  const ok = c => T.rarities.includes(c.rarity);
  // 主な色のモンスターを、コモン → レア…の順に必要な数だけ入れ、残りはほかの色のコモンで埋める
  const mine = shuffle(MONSTERS.filter(c => ok(c) && c.color === plan.main), rng).sort((a, b) => rank(a.id) - rank(b.id)).slice(0, plan.minMain);
  const others = shuffle(MONSTERS.filter(c => ok(c) && c.rarity === 'common' && c.color !== plan.main), rng);
  const monsters = [...mine, ...others].slice(0, 8).map(c => c.id);
  const colors = new Set(monsters.map(id => CARD_DEFS[id].color));
  const items = shuffle(ITEMS.filter(c => c.rarity === 'common' && (!c.color || colors.has(c.color))), rng).slice(0, 8).map(c => c.id);
  return { monsters, items };
}
// 条件に合うランダムなデッキ（最初の形から、でたらめに25回入れ替える）
function randomLegal(plan, rng) {
  let d = startDeckFor(plan, rng), tries = 0;
  while (!legal(d, plan) && tries++ < 200) d = startDeckFor(plan, rng);
  if (!legal(d, plan)) throw new Error('デッキを作れない: ' + JSON.stringify(plan));
  for (let i = 0; i < 25; i++) d = mutate(d, plan, rng) || d;
  return d;
}
function mutate(deck, plan, rng) {
  const T = TIERS[plan.tier];
  for (let tries = 0; tries < 60; tries++) {
    const next = { monsters: deck.monsters.slice(), items: deck.items.slice() };
    const key = rng() < 0.5 ? 'monsters' : 'items';
    const pool = (key === 'monsters' ? MONSTERS : ITEMS).filter(c => T.rarities.includes(c.rarity));
    next[key][Math.floor(rng() * 8)] = pool[Math.floor(rng() * pool.length)].id;
    if (rng() < 0.3) { const k2 = rng() < 0.5 ? 'monsters' : 'items'; const p2 = (k2 === 'monsters' ? MONSTERS : ITEMS).filter(c => T.rarities.includes(c.rarity)); next[k2][Math.floor(rng() * 8)] = p2[Math.floor(rng() * p2.length)].id; }
    if (legal(next, plan) && JSON.stringify(next) !== JSON.stringify(deck)) return next;
  }
  return null;
}
const sortDeck = d => ({ monsters: d.monsters.slice().sort((a, b) => CARD_DEFS[a].cost - CARD_DEFS[b].cost || (a < b ? -1 : 1)), items: d.items.slice().sort((a, b) => (CARD_DEFS[a].kind < CARD_DEFS[b].kind ? -1 : CARD_DEFS[a].kind > CARD_DEFS[b].kind ? 1 : CARD_DEFS[a].cost - CARD_DEFS[b].cost)) });

const out = { searchGames: 0, tiers: Object.fromEntries(Object.keys(TIERS).map(k => [k, { level: TIERS[k].level, rarities: TIERS[k].rarities, cap: TIERS[k].cap }])), decks: [] };
PLANS.forEach((plan, pi) => {
  const rng = seededRng(5000 + pi);
  const foes = gauntlet(plan, 6000 + pi);
  let best = startDeckFor(plan, rng);
  let tries = 0;
  while (!legal(best, plan) && tries++ < 200) best = startDeckFor(plan, rng);
  if (!legal(best, plan)) throw new Error('最初のデッキを作れない: ' + JSON.stringify(plan));
  const per = n(16);
  let score = evaluate(best, plan, foes, per, 1);
  const startRate = score;
  for (let i = 0; i < n(160); i++) {
    const cand = mutate(best, plan, rng);
    if (!cand) continue;
    const s = evaluate(cand, plan, foes, per, 1); // 同じ乱数で比べる
    out.searchGames += foes.length * per;
    if (s > score) { best = cand; score = s; }
  }
  // 探したときとは別の相手・別の乱数で、あらためて勝率を測る（探索で運よく高く出たぶんを除く）
  const fresh = gauntlet(plan, 9000 + pi);
  const N = n(60);
  const rate = evaluate(best, plan, fresh, N, 2);
  // 色ごとの相手（その色のモンスターだけのデッキ）との勝率
  const T = TIERS[plan.tier];
  const vs = {};
  for (const c of Object.keys(COLORS)) {
    const r2 = seededRng(7000 + pi); const pc = { tier: plan.tier, main: c, minMain: 4 }; const foesC = [...Array(4)].map(() => finish(randomLegal(pc, r2), pc));
    vs[c] = Math.round(1000 * evaluate(best, plan, foesC, n(40), 3)) / 10;
  }
  const d = sortDeck(best);
  out.decks.push({ tier: plan.tier, main: plan.main, deck: finish(d, plan), startRate: Math.round(1000 * startRate) / 10, rate: Math.round(1000 * rate) / 10, games: fresh.length * N, vs, vsGames: 4 * n(40) });
});
print(JSON.stringify(out));
