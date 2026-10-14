// ダンジョンを自動で最後まで進める、かんたんな方針（攻略本のシミュレーション用）
//   マス：命が少なければ祠・鍛冶屋を優先、そうでなければ戦闘を優先。カード：レアリティの高いものを取る
// ダンジョンの大量挑戦。オート（つよい）＋かんたんな選択方針
const rk = id => RARITY_ORDER.indexOf(CARD_DEFS[id].rarity);
function playBattle(run, rng, brain) {
  const foe = run.pending.foe;
  const s = newGame(runDeckForBattle(run), foe.deck, rng, { terrain: foe.terrain, charms: runBattleCharms(run) });
  s.players[1].bonusIncome = foe.income; s.players[1].crystals += foe.bonus;
  let res = null;
  while (!res) {
    const pi = s.current; res = startTurn(s); if (res) break;
    const b = pi === 0 ? brain : cpuNextAction; let a, n = 0;
    while ((a = b(s)) && n++ < 40) applyAction(s, pi, a);
    if (s.result) { res = s.result; break; }
    for (const ev of attackPhaseAll(s)) { /* */ }
    res = finishTurn(s);
    if (!res && s.turn > 300) return false;
  }
  return res.winner === 0;
}
function takeCard(run, offers) {
  const best = offers.slice().sort((a, b) => rk(b) - rk(a) || CARD_DEFS[b].cost - CARD_DEFS[a].cost)[0];
  if (!best) return dungeonChoose(run, null);
  if (!runFull(run, best)) return dungeonChoose(run, best);
  const list = run.deck[runKey(best)];
  const worst = list.map((id, i) => [id, i]).sort((x, y) => rk(x[0]) - rk(y[0]) || runLevel(run, x[0]) - runLevel(run, y[0]) || CARD_DEFS[x[0]].cost - CARD_DEFS[y[0]].cost)[0];
  if (rk(best) > rk(worst[0])) return dungeonChoose(run, best, worst[1]) || dungeonChoose(run, null);
  return dungeonChoose(run, null);
}
function playRun(profile, hero, trial, seed, brain, rng) {
  const run = startDungeon(profile, hero, 0, trial, seed);
  let guard = 0;
  while (!run.over && guard++ < 2000) {
    if (!run.pending) {
      const opts = dungeonChoices(run).map(id => run.map.nodes[id]);
      const pref = run.lives <= 1 ? ['shrine', 'smith', 'mystery', 'shop', 'battle', 'elite', 'boss'] : ['battle', 'elite', 'smith', 'mystery', 'shop', 'shrine', 'boss'];
      const pick = opts.sort((a, b) => pref.indexOf(a.type) - pref.indexOf(b.type))[0];
      enterNode(run, pick.id); continue;
    }
    const p = run.pending;
    if (p.phase === 'battle') { dungeonBattleEnd(run, playBattle(run, rng, brain)); continue; }
    if (p.phase === 'lost') { if (p.type === 'boss' || run.lives > 1) dungeonRetry(run); else dungeonSkip(run); continue; }
    if (p.phase === 'dead') break;
    if (p.steps.length) { const st = p.steps[0]; if (st.kind === 'card') takeCard(run, st.offers); else dungeonChoose(run, st.offers[0]); continue; }
    if (p.type === 'smith' && p.left > 0) { const up = runUpgradable(run).sort((a, b) => rk(b) - rk(a) || CARD_DEFS[b].cost - CARD_DEFS[a].cost)[0]; if (up && smithUpgrade(run, up)) continue; }
    if (p.type === 'shrine' && !p.used) { if (shrineHeal(run)) continue; const i = run.deck.items.map((id, k) => [id, k]).sort((x, y) => rk(x[0]) - rk(y[0]))[0]; if (run.deck.items.length > 5 && i && shrineRemove(run, 'items', i[1])) continue; }
    if (p.type === 'shop') { let bought = false; p.stock.forEach((it, i) => { if (!it.sold && it.kind === 'charm' && shopBuy(run, i)) bought = true; }); p.stock.forEach((it, i) => { if (!it.sold && it.kind === 'card' && rk(it.id) >= 1 && !runFull(run, it.id) && shopBuy(run, i)) bought = true; }); if (bought) continue; }
    if (p.type === 'mystery' && p.result == null) { const ev = DUNGEON_EVENT_BY_ID[p.event]; const skipRisk = (ev.id === 'pact' || ev.id === 'gamble') && run.lives < 3; const i = skipRisk ? 1 : ev.options.findIndex(o => !o.can || o.can(run)); mysteryChoose(run, i); continue; }
    if (!leaveNode(run)) throw new Error('stuck ' + JSON.stringify(p).slice(0, 200));
  }
  const info = { over: run.over, floor: run.floor, chapter: run.chapter, row: run.pending ? run.map.nodes[run.pending.node].row : -1, boss: run.pending && run.pending.type === 'boss', deck: run.deck.monsters.length + run.deck.items.length, charms: run.charms.length, wins: run.stats.wins, losses: run.stats.losses };
  endDungeon(profile, 'dead');
  return info;
}
