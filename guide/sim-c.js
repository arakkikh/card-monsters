// 攻略本のシミュレーション C：全ステージ。その章の「基準デッキ」での勝率と、おすすめデッキでの勝率
const G = typeof GUIDE_SCALE === 'undefined' ? 1 : GUIDE_SCALE;
const n = x => Math.max(4, Math.round(x * G));
const B = JSON.parse(read('guide/sim-b.json'));
const tierOf = ch => (ch <= 2 ? 'beginner' : ch <= 4 ? 'middle' : 'advanced');
const relevel = (deck, level) => { const levels = {}; [...deck.monsters, ...deck.items].forEach(id => { levels[id] = Math.min(level, maxLevel(id)); }); const options = {}; for (const id in deck.options || {}) if (optionAvailable(id, levels[id])) options[id] = deck.options[id]; return { ...deck, levels, options }; };
const out = { refGames: n(300), deckGames: n(120), bossGames: n(400), stages: [] };
for (const st of STAGES) {
  const foe = stageDeck(st);
  const level = REFERENCE_DECKS[st.chapter].level;
  // 基準デッキ（その章に来るころに持っていそうなデッキ。毎回ランダムに組む）
  let rng = seededRng(3 + st.index), w = 0, s3 = 0, s2 = 0;
  for (let g = 0; g < out.refGames; g++) { const r = simulateGame(referenceDeck(st.chapter, rng), foe, rng, st); if (r.winner === 0) { w++; const stars = starsFor(r.left[0]); if (stars === 3) s3++; if (stars >= 2) s2++; } }
  const row = { id: st.id, ref: pct(w, out.refGames), star3: pct(s3, out.refGames), star2: pct(s2, out.refGames), decks: [] };
  // おすすめデッキ（その章の段階のもの。カードレベルは章の基準に合わせる）
  B.decks.forEach((d, i) => {
    if (d.tier !== tierOf(st.chapter)) return;
    const deck = relevel(d.deck, level); const r2 = seededRng(500 + st.index * 31 + i); let ww = 0, t3 = 0;
    for (let g = 0; g < out.deckGames; g++) { const r = simulateGame(deck, foe, r2, st); if (r.winner === 0) { ww++; if (starsFor(r.left[0]) === 3) t3++; } }
    row.decks.push({ i, rate: pct(ww, out.deckGames), star3: pct(t3, out.deckGames) });
  });
  // ボス：カードレベルを変えたときの勝率（基準デッキ）
  if (st.boss) {
    row.byLevel = [level - 1, level, level + 1].filter(lv => lv >= 1 && lv <= 5).map(lv => {
      const r3 = seededRng(900 + st.index + lv); let ww = 0;
      for (let g = 0; g < out.bossGames; g++) { const d = relevel(referenceDeck(st.chapter, r3), lv); if (simulateGame(d, foe, r3, st).winner === 0) ww++; }
      return { level: lv, rate: pct(ww, out.bossGames) };
    });
  }
  out.stages.push(row);
}
print(JSON.stringify(out));
