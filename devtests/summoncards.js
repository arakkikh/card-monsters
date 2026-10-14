const ids = ['r19', 'g18', 'f32', 'f33'];
for (const [lv, games] of [[3, 12000], [1, 6000]]) {
  const r = cardReport(games, lv, 850 + lv);
  print(`Lv${lv} first ${r.firstWin} turns ${r.avgTurns} max ${r.maxTurns} | ` + r.cards.filter(c => ids.includes(c.key)).map(c => `${CARD_DEFS[c.key].name} ${c.rate}`).join(' / '));
}
