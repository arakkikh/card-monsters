// ============================================================
// バランス集計（CPU同士の大量対戦）
// balance.html をブラウザで開くと実行できる。
// （ターミナルなら: jsc skills.js cards-monsters.js cards-items.js cards.js terrains.js engine.js save.js stages.js heroes.js quests.js events.js balance.js）
// ============================================================

// 再現できる乱数
function seededRng(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

// CPU同士で1試合。{ winner, turns, first, left: [残りモンスター数], attrition, penalty } を返す
//   foe: 相手（プレイヤー1）への補正 { income: 毎ターンのクリスタル増減, bonus: 最初に持っているクリスタル }
//   foe.brains: [プレイヤー0の思考, プレイヤー1の思考]（省略するとどちらもCPUの思考）。オートの新旧を比べるのに使う
function simulateGame(deckA, deckB, rng, foe = {}) {
  const s = newGame(deckA, deckB, rng, { terrain: foe.terrain, rules: foe.rules });
  s.players[1].bonusIncome = foe.income || 0;
  applyStartBonus(s.players[1], foe.bonus || 0);
  const first = s.current;
  let res = null;
  while (!res) {
    const pi = s.current;
    res = startTurn(s);
    if (res) break;
    let a;
    const brain = (foe.brains && foe.brains[pi]) || cpuNextAction;
    while ((a = brain(s))) applyAction(s, pi, a);
    if (s.result) { res = s.result; break; }
    for (const ev of attackPhase(s)) { /* 演出なし */ }
    res = finishTurn(s);
    if (!res && s.turn > 400) return { winner: null, turns: s.turn, first, left: s.players.map(monstersLeft) };
  }
  return { winner: res.winner, turns: s.turn, first, left: s.players.map(monstersLeft), attrition: !!res.attrition, penalty: !!res.penalty };
}

// デッキの全カードを指定レベル（各カードの最大まで）にする
function deckAtLevel(deck, level, rng = Math.random) {
  const levels = {};
  [...deck.monsters, ...deck.items].forEach(id => { levels[id] = Math.min(level, maxLevel(id)); });
  const out = { monsters: deck.monsters, items: deck.items, levels };
  out.options = randomOptions(out, rng); // 選択スキルはランダムに選ぶ
  return out;
}

const pct = (w, n) => (n ? Math.round(1000 * w / n) / 10 : 0);

// ランダムデッキ同士の対戦で、カード別・スキル別・色別の勝率（そのカードがデッキに入っていた試合の勝率）を出す
function cardReport(games, level, seed = 1) {
  const rng = seededRng(seed);
  const card = {}, skill = {}, color = {};
  const add = (map, key, win) => { const e = map[key] || (map[key] = { n: 0, w: 0 }); e.n++; if (win) e.w++; };
  let firstWins = 0, turns = 0, undecided = 0, maxTurns = 0;
  for (let g = 0; g < games; g++) {
    const decks = [deckAtLevel(randomDeck(rng), level, rng), deckAtLevel(randomDeck(rng), level, rng)];
    const r = simulateGame(decks[0], decks[1], rng);
    if (r.winner === null) { undecided++; continue; }
    if (r.winner === r.first) firstWins++;
    turns += r.turns; maxTurns = Math.max(maxTurns, r.turns);
    decks.forEach((d, pi) => {
      const win = r.winner === pi;
      const skills = new Set(), colors = {};
      for (const id of [...d.monsters, ...d.items]) {
        add(card, id, win);
        const c = cardAt(id, d.levels[id], d.options[id]);
        c.skills.forEach(k => skills.add(k.id));
        if (c.kind === 'monster') colors[c.color] = (colors[c.color] || 0) + 1;
      }
      skills.forEach(k => add(skill, k, win));
      // その色のモンスターが3体以上入っているデッキを「その色寄り」とみなす
      for (const c in colors) if (colors[c] >= 3) add(color, c, win);
    });
  }
  const rows = map => Object.keys(map).map(k => ({ key: k, n: map[k].n, rate: pct(map[k].w, map[k].n) })).sort((a, b) => b.rate - a.rate);
  return {
    games, level, undecided, firstWin: pct(firstWins, games - undecided), avgTurns: Math.round(10 * turns / (games - undecided)) / 10, maxTurns,
    cards: rows(card), skills: rows(skill), colors: rows(color),
  };
}

// 単色デッキ同士の総当たり
function colorReport(gamesPerPair, level, seed = 2) {
  const rng = seededRng(seed);
  const colors = Object.keys(COLORS);
  const deckOf = color => deckAtLevel({
    monsters: shuffle(MONSTERS.filter(m => m.color === color), rng).slice(0, 8).map(c => c.id),
    items: shuffle(ITEMS.filter(i => !i.color || i.color === color), rng).slice(0, 8).map(c => c.id),
  }, level, rng);
  const win = {}, n = {};
  for (const a of colors) for (const b of colors) {
    if (a === b) continue;
    for (let g = 0; g < gamesPerPair; g++) {
      const r = simulateGame(deckOf(a), deckOf(b), rng);
      const w = r.winner === 0 ? a : b;
      win[w] = (win[w] || 0) + 1; n[a] = (n[a] || 0) + 1; n[b] = (n[b] || 0) + 1;
    }
  }
  return colors.map(c => ({ key: c, rate: pct(win[c] || 0, n[c]) }));
}

// その章に来るころのプレイヤーが持っていそうなデッキ（レアリティの内訳とカードレベル）
const REFERENCE_DECKS = {
  1: { level: 1, monsters: { common: 8 }, items: { common: 8 } },
  2: { level: 2, monsters: { common: 6, rare: 2 }, items: { common: 6, rare: 2 } },
  3: { level: 3, monsters: { common: 4, rare: 3, epic: 1 }, items: { common: 5, rare: 2, epic: 1 } },
  4: { level: 4, monsters: { common: 2, rare: 4, epic: 2 }, items: { common: 3, rare: 3, epic: 2 } },
  5: { level: 5, monsters: { common: 1, rare: 3, epic: 3, legend: 1 }, items: { common: 2, rare: 3, epic: 2, legend: 1 } },
};

function referenceDeck(chapter, rng) {
  const ref = REFERENCE_DECKS[chapter];
  const pick = (pool, mix) => Object.keys(mix).flatMap(r => shuffle(pool.filter(c => c.rarity === r), rng).slice(0, mix[r]).map(c => c.id));
  const deck = deckAtLevel({ monsters: pick(MONSTERS, ref.monsters), items: pick(ITEMS, ref.items) }, ref.level, rng);
  // その章までに解放されているヒーローからランダムに選ぶ。スキルは章が進むほど後ろのもの
  const heroes = HEROES.filter(h => !h.unlock || Number(h.unlock.split('-')[0]) < chapter);
  const hero = heroes[Math.floor(rng() * heroes.length)];
  deck.hero = { id: hero.id, name: hero.name, skill: hero.skills[chapter >= 5 ? 2 : chapter >= 3 ? 1 : 0].id };
  return deck;
}

// 各ステージに、その章の基準デッキで挑んだときの勝率と平均の星
function stageReport(gamesPerStage, seed = 3) {
  const rng = seededRng(seed);
  return STAGES.map(st => {
    const foe = stageDeck(st);
    let w = 0, stars = 0;
    for (let g = 0; g < gamesPerStage; g++) {
      const r = simulateGame(referenceDeck(st.chapter, rng), foe, rng, st);
      if (r.winner === 0) { w++; stars += starsFor(r.left[0]); }
    }
    return { id: st.id, boss: st.boss, rate: pct(w, gamesPerStage), stars: w ? Math.round(10 * stars / w) / 10 : 0 };
  });
}

// ヒーロースキルごとの勝率（ヒーローなしの相手と、ランダムデッキ同士で対戦）
function heroReport(games, level, seed = 4) {
  const rng = seededRng(seed);
  return Object.values(HERO_SKILL_INFO).map(k => {
    let w = 0;
    for (let g = 0; g < games; g++) {
      const a = deckAtLevel(randomDeck(rng), level, rng);
      a.hero = { id: k.hero || 'boss', name: k.name, skill: k.id };
      if (simulateGame(a, deckAtLevel(randomDeck(rng), level, rng), rng).winner === 0) w++;
    }
    return { key: k.name, rate: pct(w, games) };
  }).sort((a, b) => b.rate - a.rate);
}

// 地形ごとの、色寄りデッキの勝率（ランダムデッキ同士）
function terrainReport(games, level, seed = 5) {
  return TERRAINS.map(t => {
    const rng = seededRng(seed);
    const stat = {};
    for (let g = 0; g < games; g++) {
      const decks = [deckAtLevel(randomDeck(rng), level, rng), deckAtLevel(randomDeck(rng), level, rng)];
      const r = simulateGame(decks[0], decks[1], rng, { terrain: t.id });
      decks.forEach((d, i) => {
        const n = {};
        d.monsters.forEach(id => { const c = CARD_DEFS[id].color; n[c] = (n[c] || 0) + 1; });
        for (const c in n) if (n[c] >= 3) { stat[c] = stat[c] || [0, 0]; stat[c][1]++; if (r.winner === i) stat[c][0]++; }
      });
    }
    return { name: t.name, turns: 0, colors: Object.keys(COLORS).map(c => `${COLORS[c].name}${pct(stat[c][0], stat[c][1])}%`).join(' ') };
  });
}

// イベントの特殊ルールごとの様子：先攻勝率・平均ターン・色寄りデッキの勝率、
// それと「自分と同じ強さの相手に5連戦」したときの平均勝ち数（3敗で終了）
function eventReport(games, level, seed = 6) {
  return EVENTS.map(ev => {
    const rng = seededRng(seed);
    const mk = () => (ev.rule.deckColor ? colorDeck(ev.rule.deckColor, level, rng) : deckAtLevel(randomDeck(rng), level, rng));
    let first = 0, turns = 0, undecided = 0;
    for (let g = 0; g < games; g++) {
      const r = simulateGame(mk(), mk(), rng, { rules: ev.rule });
      if (r.winner === null || r.winner === undefined) undecided++;
      if (r.winner === r.first) first++;
      turns += r.turns;
    }
    let wins = 0, elite = 0;
    const runs = Math.round(games / 4);
    for (let i = 0; i < runs; i++) {
      let w = 0, l = 0;
      while (l < EVENT_CONFIG.MAX_LOSSES && w + l < EVENT_CONFIG.BATTLES) {
        if (simulateGame(mk(), mk(), rng, { rules: ev.rule, bonus: EVENT_CONFIG.FOE_BONUS[w + l] }).winner === 0) w++; else l++;
      }
      wins += w; if (w >= 3) elite++;
    }
    return { name: ev.name, undecided, first: pct(first, games), turns: Math.round(10 * turns / games) / 10, wins: Math.round(100 * wins / runs) / 100, elite: pct(elite, runs) };
  });
}

// ---------- 実行と表示 ----------

function runBalance(scale = 1, log = console.log) {
  const name = id => (CARD_DEFS[id] ? `${CARD_DEFS[id].name}(${RARITIES[CARD_DEFS[id].rarity].name[0]})` : id);
  for (const level of [1, 5]) {
    const r = cardReport(Math.round(4000 * scale), level);
    log(`■ ランダムデッキ同士 ${r.games}試合・カードLv${level}：未決着${r.undecided}　先攻勝率${r.firstWin}%　平均${r.avgTurns}ターン（最長${r.maxTurns}）`);
    log('  色寄りデッキ: ' + r.colors.map(c => `${COLORS[c.key].name}${c.rate}%`).join('  '));
    log('  強いカード: ' + r.cards.slice(0, 8).map(c => `${name(c.key)}${c.rate}%`).join('  '));
    log('  弱いカード: ' + r.cards.slice(-8).reverse().map(c => `${name(c.key)}${c.rate}%`).join('  '));
    log('  スキル: ' + r.skills.map(s => `${SKILLS[s.key].name}${s.rate}%`).join('  '));
    log('  単色デッキ総当たり: ' + colorReport(Math.round(80 * scale), level).map(c => `${COLORS[c.key].name}${c.rate}%`).join('  '));
  }
  log('■ ヒーロースキル（ヒーローなしの相手との勝率・カードLv3）: ' + heroReport(Math.round(600 * scale), 3).map(h => `${h.key}${h.rate}%`).join('  '));
  log('■ 地形ごとの色寄りデッキの勝率（カードLv3）');
  terrainReport(Math.round(1500 * scale), 3).forEach(t => log(`  ${t.name}: ${t.colors}`));
  log('■ イベントの特殊ルール（カードLv3）');
  eventReport(Math.round(400 * scale), 3).forEach(e => log(`  ${e.name}: 未決着${e.undecided}　先攻${e.first}%　平均${e.turns}ターン　5連戦の平均${e.wins}勝　3勝以上${e.elite}%`));
  const st = stageReport(Math.round(100 * scale));
  for (let ch = 1; ch <= 5; ch++) {
    log(`■ ${ch}章（基準デッキでの勝率）: ` + st.filter(s => s.id.startsWith(ch + '-')).map(s => `${s.id}${s.boss ? '👑' : ''} ${s.rate}%`).join('  '));
  }
}

if (typeof document === 'undefined' && typeof BALANCE_NO_RUN === 'undefined') {
  runBalance(typeof BALANCE_SCALE === 'undefined' ? 1 : BALANCE_SCALE, s => print(s));
}
