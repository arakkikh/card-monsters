// まだ難しすぎるステージ：相手の「強いカードの枚数」も減らして探す
const before = JSON.parse(read('devtests/snap-before.json')).stages;
const tuned = JSON.parse(read('devtests/tune.json'));
const N = 500;
const rateOf = (st, seed) => { const rng = seededRng(seed); const foe = stageDeck(st); let w = 0; for (let g = 0; g < N; g++) if (simulateGame(referenceDeck(st.chapter, rng), foe, rng, st).winner === 0) w++; return 100 * w / N; };
const out = {};
for (const st of STAGES) {
  const t = tuned[st.id];
  st.bonus = t.to;
  if (Math.abs(t.check - t.target) <= 8 || st.boss) continue;
  const strong0 = st.strong;
  let best = null;
  for (let ds = 0; ds >= -Math.min(4, strong0); ds--) for (let b = -4; b <= 1; b++) {
    st.strong = strong0 + ds; st.bonus = b;
    const r = (rateOf(st, 900) + rateOf(st, 901)) / 2;
    const score = Math.abs(r - t.target) + Math.abs(ds) * 1.5 + Math.abs(b - t.from) * 0.3;
    if (!best || score < best.score) best = { ds, b, r, score };
  }
  st.strong = strong0 + best.ds; st.bonus = best.b;
  out[st.id] = { strongFrom: strong0, strong: st.strong, bonus: best.b, target: t.target, check: Math.round(rateOf(st, 4242) * 10) / 10 };
}
print(JSON.stringify(out));
