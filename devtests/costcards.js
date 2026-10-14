const ids = ['r18', 'b18', 'g17', 'y19', 'y20', 'p18', 'e44', 'f30', 'f31'];
for (const [lv, games] of [[3, 12000], [1, 6000]]) {
  const r = cardReport(games, lv, 800 + lv);
  print(`Lv${lv} first ${r.firstWin} turns ${r.avgTurns} max ${r.maxTurns} colors ${r.colors.map(c => c.key + ' ' + c.rate).join(', ')}`);
  print(' cost cards: ' + r.cards.filter(c => ids.includes(c.key)).sort((a, b) => b.rate - a.rate).map(c => `${CARD_DEFS[c.key].name} ${c.rate}`).join(' / '));
  print(' flying: ' + r.skills.filter(s => ['flying', 'evacuate', 'heal'].includes(s.key)).map(s => s.key + ' ' + s.rate).join(' / '));
}
