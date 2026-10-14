// ルールを変える前後で比べるための、決まった乱数での対戦まとめ（3000試合）
const snap = cardReport(3000, 3, 501);
const out = { games: snap.games, firstWin: snap.firstWin, avgTurns: snap.avgTurns, maxTurns: snap.maxTurns,
  colors: Object.fromEntries(snap.colors.map(c => [c.key, c.rate])),
  skills: Object.fromEntries(snap.skills.map(s => [s.key, [s.rate, s.n]])),
  top: snap.cards.slice().sort((a, b) => b.rate - a.rate).slice(0, 8).map(c => [CARD_DEFS[c.key].name, c.rate, c.n]),
  bottom: snap.cards.slice().sort((a, b) => a.rate - b.rate).slice(0, 8).map(c => [CARD_DEFS[c.key].name, c.rate, c.n]) };
const st = stageReport(200, 502);
out.stages = Object.fromEntries((st.stages || st).map(s => [s.id, s.rate]));
out.puzzles = PUZZLES.map(p => [p.id, runPuzzle(p, p.solution).result]).filter(x => x[1] !== 'win').map(x => x[0]);
print(JSON.stringify(out));
