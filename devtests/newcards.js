// 追加スキル・追加カードの強さ（ランダムなデッキ同士。カードLv3とLv1）
const NEWS = ['fury', 'sunder', 'grudge', 'followthrough', 'vanguard', 'trample', 'recast', 'echo', 'spellpierce', 'exploit', 'staticguard', 'stall', 'bloom', 'regenerate', 'mendingaura', 'laststand',
  'partinggift', 'leech', 'keeneye', 'arrowrain', 'pointblank', 'steadyaim', 'deflect', 'ambush', 'scatter', 'cull', 'jinx', 'luckyshot', 'plagueburst', 'finalbow', 'scorch', 'harvest'];
const isNew = id => /^(r1[5-7]|b1[5-7]|g1[4-6]|y1[6-8]|p1[5-7]|e(29|3\d|4[0-3])|f2[89])$/.test(id);
for (const [lv, games] of [[3, 12000], [1, 6000]]) {
  const r = cardReport(games, lv, 700 + lv);
  print(`Lv${lv} games ${r.games} first ${r.firstWin} turns ${r.avgTurns} max ${r.maxTurns} colors ${r.colors.map(c => c.key + ' ' + c.rate).join(', ')}`);
  print(' new cards: ' + r.cards.filter(c => isNew(c.key)).sort((a, b) => b.rate - a.rate).map(c => `${CARD_DEFS[c.key].name} ${c.rate}`).join(' / '));
  print(' new skills: ' + r.skills.filter(s => NEWS.includes(s.key)).sort((a, b) => b.rate - a.rate).map(s => `${s.key} ${s.rate}`).join(' / '));
  print(' top5 all: ' + r.cards.slice().sort((a, b) => b.rate - a.rate).slice(0, 5).map(c => `${CARD_DEFS[c.key].name} ${c.rate}`).join(' / ') + '   bottom5: ' + r.cards.slice().sort((a, b) => a.rate - b.rate).slice(0, 5).map(c => `${CARD_DEFS[c.key].name} ${c.rate}`).join(' / '));
}
