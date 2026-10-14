// ステージの難しさを、ルール変更前の勝率に近づける（相手の最初のクリスタルだけを動かす）
const before = JSON.parse(read('devtests/snap-before.json')).stages;
const N = 500;
const rateOf = (st, seed) => { const rng = seededRng(seed); const foe = stageDeck(st); let w = 0; for (let g = 0; g < N; g++) if (simulateGame(referenceDeck(st.chapter, rng), foe, rng, st).winner === 0) w++; return 100 * w / N; };
const out = {};
for (const st of STAGES) {
  const target = before[st.id], start = st.bonus || 0;
  let best = null;
  for (let b = -4; b <= 5; b++) {
    st.bonus = b;
    const r = rateOf(st, 900 + b * 0); // 同じ乱数で比べる
    const score = Math.abs(r - target) + Math.abs(b - start) * 0.4; // 同じくらいなら、変更の小さいほう
    if (!best || score < best.score) best = { b, r, score };
  }
  st.bonus = best.b;
  out[st.id] = { from: start, to: best.b, target, rate: Math.round(best.r * 10) / 10, check: Math.round(rateOf(st, 4242) * 10) / 10 };
}
print(JSON.stringify(out));
