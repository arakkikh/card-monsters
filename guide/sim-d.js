// 攻略本のシミュレーション D：ヒーロー・地形・イベント・お守り・ダンジョン
const G = typeof GUIDE_SCALE === 'undefined' ? 1 : GUIDE_SCALE;
const n = x => Math.max(4, Math.round(x * G));
const OUT = {};
OUT.heroes = { games: n(700), level: 3, skills: Object.values(HERO_SKILL_INFO).map(k => {
  const rng = seededRng(4); let w = 0; const N = n(700);
  for (let g = 0; g < N; g++) { const a = deckAtLevel(randomDeck(rng), 3, rng); a.hero = { id: k.hero || 'boss', name: k.name, skill: k.id }; if (simulateGame(a, deckAtLevel(randomDeck(rng), 3, rng), rng).winner === 0) w++; }
  return { id: k.id, hero: k.hero || null, rate: pct(w, N) };
}) };
// 地形ごと：色寄りデッキ（その色のモンスター3体以上）の勝率と、平均ターン
OUT.terrains = { games: n(1200), level: 3, list: TERRAINS.map(t => {
  const rng = seededRng(5); const stat = {}; let turns = 0, N = 0;
  for (let g = 0; g < n(1200); g++) {
    const decks = [deckAtLevel(randomDeck(rng), 3, rng), deckAtLevel(randomDeck(rng), 3, rng)];
    const r = simulateGame(decks[0], decks[1], rng, { terrain: t.id }); if (r.winner == null) continue; turns += r.turns; N++;
    decks.forEach((d, i) => { const c = {}; d.monsters.forEach(id => { const col = CARD_DEFS[id].color; c[col] = (c[col] || 0) + 1; }); for (const col in c) if (c[col] >= 3) { stat[col] = stat[col] || [0, 0]; stat[col][1]++; if (r.winner === i) stat[col][0]++; } });
  }
  return { id: t.id, turns: Math.round(10 * turns / N) / 10, colors: Object.fromEntries(Object.keys(COLORS).map(c => [c, stat[c] ? pct(stat[c][0], stat[c][1]) : null])) };
}) };
OUT.events = { games: n(400), level: 3, list: eventReport(n(400), 3).map((e, i) => ({ id: EVENTS[i].id, first: e.first, turns: e.turns, wins: e.wins, elite: e.elite })) };
// お守り（対戦中に効くもの）：ランダムなデッキ同士で、お守りを1つ持った側の勝率
function charmGame(a, b, rng, charms) {
  const s = newGame(a, b, rng, { charms }); let res = null;
  while (!res) { const pi = s.current; res = startTurn(s); if (res) break; let x, k = 0; while ((x = cpuNextAction(s)) && k++ < 40) applyAction(s, pi, x); if (s.result) { res = s.result; break; } for (const ev of attackPhaseAll(s)) { /* */ } res = finishTurn(s); if (!res && s.turn > 300) return null; }
  return res.winner;
}
(() => {
  const N = n(1500);
  const run = charms => { const rng = seededRng(88); let w = 0; for (let g = 0; g < N; g++) if (charmGame(deckAtLevel(randomDeck(rng, { rarities: ['common', 'rare'] }), 1, rng), deckAtLevel(randomDeck(rng, { rarities: ['common', 'rare'] }), 1, rng), rng, charms) === 0) w++; return pct(w, N); };
  const base = run([]);
  OUT.charms = { games: N, base, list: DUNGEON_CHARMS.filter(c => c.battle).map(c => ({ id: c.id, rate: run([c.id]) })) };
})();
// ダンジョン：オート（つよい）＋かんたんな方針での挑戦
OUT.dungeon = [[0, n(200)], [1, n(100)], [3, n(100)], [5, n(100)], [10, n(100)]].map(([trial, N]) => {
  const rng = seededRng(77 + trial);
  const profile = newProfile(); profile.dungeon.maxTrial = 10; profile.hero.unlocked = HEROES.map(h => h.id); HEROES.forEach(h => { profile.hero.levels[h.id] = 1; });
  let clear = 0, floor = 0, wins = 0, losses = 0; const died = [0, 0, 0]; const byHero = {};
  for (let i = 0; i < N; i++) { const hero = HEROES[i % HEROES.length].id; const r = playRun(profile, hero, trial, Math.floor(rng() * 4e9), autoStrongAction, rng);
    byHero[hero] = byHero[hero] || [0, 0]; byHero[hero][1]++; if (r.over === 'clear') { clear++; byHero[hero][0]++; } else died[r.chapter]++; floor += r.floor; wins += r.wins; losses += r.losses; }
  return { trial, runs: N, clear: pct(clear, N), floor: Math.round(10 * floor / N) / 10, died: died.map(x => pct(x, N)), battleWin: pct(wins, wins + losses), byHero: Object.fromEntries(Object.keys(byHero).map(h => [h, pct(byHero[h][0], byHero[h][1])])) };
});
print(JSON.stringify(OUT));
