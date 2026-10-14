// オート「つよい」対「ふつう」を、カードごとに見る：そのカードを「つよい」側が持つとき／「ふつう」側が持つときの、つよいの勝率
const rng = seededRng(SEED);
const own = {}, opp = {};
const add = (t, id, win) => { const r = t[id] || (t[id] = [0, 0]); r[0] += win; r[1]++; };
let w = 0, n = 0;
for (let g = 0; g < PAIRS; g++) {
  const a = deckAtLevel(randomDeck(rng), 3, rng), b = deckAtLevel(randomDeck(rng), 3, rng), seed = Math.floor(rng() * 1e9);
  for (const [strong, normal, first] of [[a, b, true], [b, a, false]]) {
    const r = first ? simulateGame(strong, normal, seededRng(seed), { brains: [autoStrongAction, autoNextAction] }).winner === 0
      : simulateGame(normal, strong, seededRng(seed + 1), { brains: [autoNextAction, autoStrongAction] }).winner === 1;
    const win = r ? 1 : 0; w += win; n++;
    const sIds = new Set([...strong.monsters, ...strong.items]), nIds = new Set([...normal.monsters, ...normal.items]);
    for (const id of sIds) if (!nIds.has(id)) add(own, id, win);
    for (const id of nIds) if (!sIds.has(id)) add(opp, id, win);
  }
}
print(JSON.stringify({ w, n, own, opp }));
