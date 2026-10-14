// オート「つよい」対「ふつう」を、使うカードの範囲を変えて測る
const COST = ['r18', 'b18', 'g17', 'y19', 'y20', 'p18', 'e44', 'f30', 'f31'];
const isNew = id => /^(r1[5-8]|b1[5-8]|g1[4-7]|y1[6-9]|y20|p1[5-8]|e(29|3\d|4[0-4])|f(2[89]|3[01]))$/.test(id);
function measure(label, bad, pairs) {
  const rng = seededRng(4242);
  const deck = () => { for (;;) { const d = randomDeck(rng); if (![...d.monsters, ...d.items].some(bad)) return deckAtLevel(d, 3, rng); } };
  let w = 0, n = 0;
  const t0 = Date.now();
  for (let g = 0; g < pairs; g++) {
    const a = deck(), b = deck(), seed = 1000 + g * 2;
    if (simulateGame(a, b, seededRng(seed), { brains: [autoStrongAction, autoNextAction] }).winner === 0) w++;
    if (simulateGame(b, a, seededRng(seed + 1), { brains: [autoNextAction, autoStrongAction] }).winner === 1) w++;
    n += 2;
  }
  print(label, 'games', n, 'strong', Math.round(1000 * w / n) / 10 + '%', 'sec', Math.round((Date.now() - t0) / 1000));
}
const P = typeof PAIRS === 'undefined' ? 500 : PAIRS;
if (typeof ONLY === 'undefined' || ONLY === 0) measure('全カード', () => false, P);
if (typeof ONLY === 'undefined' || ONLY === 1) measure('コストのカード9枚を除く', id => COST.includes(id), P);
if (typeof ONLY === 'undefined' || ONLY === 2) measure('追加カードをすべて除く', isNew, P);
