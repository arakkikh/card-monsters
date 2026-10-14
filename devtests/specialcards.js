const ids = ['r20', 'b19', 'g19', 'y21', 'p19', 'p20', 'f34'];
for (const [lv, games] of [[3, 12000], [1, 6000]]) {
  const r = cardReport(games, lv, 870 + lv);
  print(`Lv${lv} first ${r.firstWin} turns ${r.avgTurns} max ${r.maxTurns} | ` + r.cards.filter(c => ids.includes(c.key)).sort((a, b) => b.rate - a.rate).map(c => `${CARD_DEFS[c.key].name} ${c.rate}`).join(' / '));
}
