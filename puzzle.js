// ============================================================
// 詰めパズルのしくみ（画面には触らない）。問題のデータは puzzles.js
//   決まった盤面から始めて、目標を達成すれば成功。
//   運の要素は固定する（engine.js の state.fixed）：遠隔のブロックは起きない。Flying の回避・カオスのダメージ・
//   確率で発動するスキルは、問題ごとに決める（指定がなければ：回避しない／最大値／発動しない）。
//   ランダムに対象を選ぶもの（カオスの対象、Doublestrike・Fear の相手）は、いつも前から数えて最初の相手。
//   山札・残りモンスター数による勝敗判定と、場が空のペナルティは使わない（state.noResult）。
// ============================================================

const PUZZLE = {
  LEVELS: [['beginner', '入門'], ['middle', '中級'], ['advanced', '上級']],
  REWARD: { beginner: { gold: 40 }, middle: { gold: 80 }, advanced: { stones: 10 } }, // 初回クリアの報酬
  FAILS_FOR_ANSWER: 3,   // この回数失敗すると「答えを見る」が押せる
  SOLVER_NODES: 60000,   // 全探索で調べる盤面の上限
};

// ---------- 盤面を作る ----------

// 問題のカードの書き方： 'r01' または { id: 'r01', lv: 2, hp: 3, armor: 1, item: 'e01', status: { disease: 2 }, perm: {...} }
function puzzleCard(spec) {
  const o = typeof spec === 'string' ? { id: spec } : spec;
  return cardAt(o.id, o.lv || 1, o.opt);
}

function puzzleMon(spec, owner) {
  if (!spec) return null;
  const o = typeof spec === 'string' ? { id: spec } : spec;
  const mon = setOwner(makeMonster(uidSeq++, puzzleCard(o)), owner);
  if (o.item) {
    const it = cardAt(o.item, o.itemLv || 1);
    mon.item = it;
    mon.armor += (it.armor || 0) + (it.armor ? skillX(mon, 'enchantarmor') : 0);
    mon.hp += it.hp || 0;
    mon.maxHp += it.hp || 0;
  }
  if (o.hp != null) mon.hp = o.hp;
  if (o.armor != null) mon.armor = o.armor;
  if (o.status) mon.status = { ...o.status };
  if (o.perm) mon.perm = { ...o.perm };
  return mon;
}

// 問題から、対戦の盤面を作る。自分（プレイヤー0）のプレイフェーズから始まる
function buildPuzzle(def) {
  const empty = { monsters: [], items: [] };
  let seed = 12345;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const s = newGame(empty, empty, rng, { terrain: def.terrain });
  s.log = [];
  s.fixed = { ...(def.fixed || {}) }; // 運の要素を固定する
  s.noResult = true;                  // 残りモンスター数では決着しない
  s.deaths = [0, 0];                  // 場で倒された数 [自分, 相手]
  s.current = 0; s.first = 0; s.turn = def.turn || 3; s.phase = 'play';
  [def.me, def.foe].forEach((side, pi) => {
    const p = s.players[pi];
    p.name = pi === 0 ? 'あなた' : '相手';
    p.crystals = side.crystals || 0;
    p.hero = side.hero ? { id: 'puzzle', name: pi === 0 ? 'あなた' : '相手', skill: side.hero } : null;
    p.slots = [0, 1, 2].map(i => puzzleMon((side.field || [])[i], p));
    p.hand = (side.hand || []).map(spec => ({ uid: uidSeq++, card: puzzleCard(spec), copy: 0 }));
    p.deck = [];
    p.sacrificed = !!side.sacrificed;
  });
  s.holdUids = s.players[0].slots.filter(m => m).map(m => m.uid); // 最初から場にいる自分のモンスター（「守る」目標の対象）
  s.handUids = s.players[0].hand.map(h => h.uid); // 最初の手札の並び（正解手順は「何番目のカードか」で書く）
  // 自分のターン開始時のスキル（Inspire・Heal・Fear など）は、発動済みの状態から始める
  if (def.start !== false) { s.startEvents = startOfTurnSkills(s); s.log = []; }
  s.turnsUsed = 0;
  return s;
}

// ---------- 行動 ----------
// 手順の書き方：['m', 手札の番号, スロット] モンスターを出す / ['e', 番号, スロット] 装備 / ['f', 番号, スロット（対象なしは -1）] フラッシュ
//             ['s', 番号] 手札を生贄 / ['x', スロット] 場のモンスターを生贄 / ['end'] ターン終了

function puzzleAction(s, step) {
  const [kind, a, b] = step;
  const uid = s.handUids[a];
  if (kind === 'm') return { type: 'monster', uid, slot: b };
  if (kind === 'e') return { type: 'equip', uid, slot: b };
  if (kind === 'f') return { type: 'flash', uid, slot: b };
  if (kind === 's') return { type: 'sacrifice', uid };
  if (kind === 'x') return { type: 'sacrificeField', slot: a };
  return null;
}
// engine の行動 → 手順の書き方
function puzzleStepOf(s, action) {
  const i = s.handUids.indexOf(action.uid);
  if (action.type === 'monster') return ['m', i, action.slot];
  if (action.type === 'equip') return ['e', i, action.slot];
  if (action.type === 'flash') return ['f', i, action.slot];
  if (action.type === 'sacrifice') return ['s', i];
  return ['x', action.slot];
}

// 手番プレイヤーができる行動をすべて挙げる（全探索用。意味のない手も含む）
function puzzleMoves(s) {
  const pi = s.current, p = s.players[pi], foe = s.players[1 - pi];
  const count = p.slots.filter(m => m).length;
  const moves = [];
  for (const h of p.hand) {
    const c = h.card;
    if (c.kind === 'monster') {
      if (count < 3 && costOf(p, h) <= p.crystals) for (let at = 0; at <= count; at++) moves.push({ type: 'monster', uid: h.uid, slot: at });
    } else if (costOf(p, h) <= p.crystals) {
      if (c.kind === 'equip') {
        for (let slot = 0; slot < 3; slot++) if (p.slots[slot] && canEquip(c, p.slots[slot]) && costOf(p, h, p.slots[slot]) <= p.crystals) moves.push({ type: 'equip', uid: h.uid, slot });
      } else if (flashUsable(p, c)) {
        const mode = flashTarget(c);
        if (mode === 'none') moves.push({ type: 'flash', uid: h.uid, slot: -1 });
        else for (let slot = 0; slot < 3; slot++) if ((mode === 'enemy' ? foe : p).slots[slot]) moves.push({ type: 'flash', uid: h.uid, slot });
      }
    }
    if (!p.sacrificed) moves.push({ type: 'sacrifice', uid: h.uid });
  }
  if (!p.sacrificed) for (let slot = 0; slot < 3; slot++) if (p.slots[slot] && !p.slots[slot].isToken) moves.push({ type: 'sacrificeField', slot });
  return moves;
}

// 攻撃フェーズを最後まで進める（演出なし）
function puzzleAttack(s) { for (const ev of attackPhase(s)) { /* 結果だけ使う */ } }

// 相手の番を最後まで進める（CPUが動く）。そのあと、自分の次の番のプレイフェーズになる
function puzzleFoeTurn(s) {
  finishTurn(s);
  startTurn(s);
  let a, n = 0;
  while ((a = cpuNextAction(s)) && n++ < 30) applyAction(s, s.current, a);
  puzzleAttack(s);
  s.foeDone = true;
  finishTurn(s);
  startTurn(s);
}

// ---------- 目標 ----------
// goal: { type, n, turns, noLoss }
//   type 'wipe'  … 自分の攻撃フェーズが終わったとき、相手の場にモンスターがいない
//   type 'kills' … 相手のモンスターを n 体倒す
//   type 'hold'  … 相手の次の番が終わるまで、最初から場にいる自分のモンスターが全員、場に残っている
//   turns  … 何ターン以内か（省略すると1。2なら、相手の番をはさんで自分の番がもう1回ある）
//   noLoss … 自分のモンスターが1体も倒されないこと（ほかの目標と合わせる条件）

function puzzleGoalText(goal) {
  const t = goal.turns > 1 ? `${goal.turns}ターン以内に` : 'このターンで';
  const base = goal.type === 'wipe' ? `${t}、相手の場を全滅させる`
    : goal.type === 'kills' ? `${t}、相手のモンスターを${goal.n}体倒す`
      : '相手の次の番が終わるまで、今いる自分のモンスターを全員、場に残す（倒されない・生贄にしない・山札に戻さない）';
  return base + (goal.noLoss && goal.type !== 'hold' ? '（自分のモンスターを1体も倒されずに）' : '');
}

// 自分の攻撃フェーズが終わった時点の判定： 'win' | 'fail' | 'go'（まだ続く）
function puzzleJudge(s, goal) {
  const lost = s.deaths[0] > 0;
  if (goal.type === 'hold') {
    const here = s.players[0].slots.filter(m => m).map(m => m.uid);
    return lost || !s.holdUids.every(uid => here.includes(uid)) ? 'fail' : s.foeDone ? 'win' : 'go';
  }
  if (goal.noLoss && lost) return 'fail';
  const done = goal.type === 'wipe' ? s.players[1].slots.every(m => !m) : s.deaths[1] >= goal.n;
  if (done) return 'win';
  return s.turnsUsed >= (goal.turns || 1) ? 'fail' : 'go';
}

// ターンを終える：攻撃フェーズ → 判定。まだ続くなら相手の番を進めて、次の自分の番へ。判定を返す
function puzzleEndTurn(s, goal) {
  puzzleAttack(s);
  s.turnsUsed++;
  let r = puzzleJudge(s, goal);
  if (r !== 'go') return r;
  puzzleFoeTurn(s);
  r = goal.type === 'hold' ? puzzleJudge(s, goal) : (goal.noLoss && s.deaths[0] > 0 ? 'fail' : 'go');
  return r;
}

// 手順を最初から実行する。{ result: 'win' | 'fail' | 'go' | 'illegal', state }
function runPuzzle(def, steps) {
  const s = buildPuzzle(def);
  let result = 'go';
  for (const step of steps) {
    if (result !== 'go') return { result: 'illegal', state: s };
    if (step[0] === 'end') { result = puzzleEndTurn(s, def.goal); continue; }
    const done = applyAction(s, 0, puzzleAction(s, step));
    if (done === false || done === null) return { result: 'illegal', state: s };
  }
  return { result, state: s };
}

// ---------- 全探索 ----------

// 探索用の複製（ログなし。手札の番号の対応も引き継ぐ）
function puzzleClone(s) {
  const c = aiClone(s, s.rng);
  c.handUids = s.handUids; c.holdUids = s.holdUids; c.turnsUsed = s.turnsUsed; c.foeDone = s.foeDone;
  return c;
}

// 問題を全探索する。
//   solution: 正解の手順（いちばん短いもの。なければ null）
//   endings: 調べた「ターン終了」の数　wins: そのうち成功した数　capped: 上限で打ち切ったか
function solvePuzzle(def, maxNodes = PUZZLE.SOLVER_NODES) {
  const out = { solution: null, endings: 0, wins: 0, nodes: 0, capped: false };
  // 1ターンぶん：行動の組み合わせを、短い順（幅優先）に調べる
  const turn = (start, prefix) => {
    const seen = new Set([aiKey(start)]);
    let layer = [{ s: start, path: prefix }];
    while (layer.length) {
      const next = [];
      for (const node of layer) {
        // ここでターンを終えた場合
        const e = puzzleClone(node.s);
        const r = puzzleEndTurn(e, def.goal);
        const path = [...node.path, ['end']];
        if (r === 'go') turn(e, path); // 相手の番が終わり、自分の次の番
        else {
          out.endings++;
          if (r === 'win') { out.wins++; if (!out.solution || path.length < out.solution.length) out.solution = path; }
        }
        for (const mv of puzzleMoves(node.s)) {
          if (out.nodes >= maxNodes) { out.capped = true; break; }
          const c = puzzleClone(node.s);
          const done = applyAction(c, 0, mv);
          if (done === false || done === null) continue;
          const key = aiKey(c);
          if (seen.has(key)) continue;
          seen.add(key);
          out.nodes++;
          next.push({ s: c, path: [...node.path, puzzleStepOf(c, mv)] });
        }
      }
      layer = next;
    }
  };
  turn(buildPuzzle(def), []);
  return out;
}

// 「何も考えなくても解ける」かどうかの目安：
//   idle: 何もせずにターン終了で成功する　greedy: CPUと同じ決まった手順（出せるものを順に出す）で成功する
function puzzleTrivial(def) {
  const idle = runPuzzle(def, [...Array(def.goal.turns || 1)].map(() => ['end'])).result === 'win';
  const s = buildPuzzle(def);
  let r = 'go';
  for (let t = 0; t < (def.goal.turns || 1) && r === 'go'; t++) {
    let a, n = 0;
    while ((a = cpuNextAction(s)) && n++ < 30) applyAction(s, 0, a);
    r = puzzleEndTurn(s, def.goal);
  }
  return { idle, greedy: r === 'win' };
}

// ---------- この問題のルール（固定した運の要素）の説明 ----------

function puzzleRules(def) {
  const f = def.fixed || {};
  const all = [...(def.me.field || []), ...(def.foe.field || []), ...(def.me.hand || []), ...(def.foe.hand || [])].filter(x => x)
    .flatMap(spec => { const o = typeof spec === 'string' ? { id: spec } : spec; const c = puzzleCard(o); return [c, o.item ? cardAt(o.item) : null]; }).filter(x => x);
  const has = id => all.some(c => (c.skills || []).some(k => k.id === id));
  const type = t => all.some(c => attackTypesOf(c).includes(t));
  const rules = ['遠隔攻撃のブロックは起きない'];
  if (has('flying')) rules.push(f.dodge ? 'Flying は、近接・遠隔攻撃を必ず回避する' : 'Flying は回避しない');
  if (type('chaos')) rules.push(`カオス攻撃のダメージは、${f.chaos ? `いつも${f.chaos}（攻撃力がそれより低ければ攻撃力）` : 'いつも最大値'}。対象は、相手の場の一番前`);
  if (has('counter') || has('magiccounter')) rules.push(`Counter-Attack・Magic Counter は${f.counter ? '必ず発動する' : '発動しない'}`);
  if (has('magicreflect')) rules.push(`Magic Reflect は${f.reflect ? '必ず発動する' : '発動しない'}`);
  if (has('entangle')) rules.push(`Entangle は${f.entangle ? '必ず成功する' : '成功しない'}`);
  if (has('doublestrike')) rules.push('Doublestrike の追加ダメージは、後列のうちスロット2の相手（いなければスロット3）に入る');
  if (has('fear')) rules.push('Fear で入れ替わる相手は、後列のうちスロット2のモンスター（いなければスロット3）');
  rules.push('山札はなく、残りモンスター数では決着しない。場が空のペナルティもない');
  return rules;
}

// ---------- セーブデータ ----------
// profile.puzzle = { done: { 問題id: 1（クリア）| 2（★ヒントなし）| 3（答えを見てクリア） }, fails: { 問題id: 失敗した回数 } }

function newPuzzleData() { return { done: {}, fails: {} }; }
function sanitizePuzzleData(d) {
  const out = newPuzzleData();
  if (!d || typeof d !== 'object') return out;
  for (const id in d.done || {}) if ([1, 2, 3].includes(d.done[id])) out.done[id] = d.done[id];
  for (const id in d.fails || {}) if (Number.isFinite(d.fails[id]) && d.fails[id] > 0) out.fails[id] = Math.floor(d.fails[id]);
  return out;
}

// クリアを記録する。hints: この挑戦でヒントを使ったか　answer: 答えを見たか。初回クリアなら報酬を渡して返す
function recordPuzzleClear(profile, def, { hints = false, answer = false } = {}) {
  const d = profile.puzzle;
  const before = d.done[def.id] || 0;
  const now = answer ? 3 : hints ? 1 : 2;
  // 良い記録を残す：★(2) > クリア(1) > 答えを見た(3)
  const rank = v => ({ 0: 0, 3: 1, 1: 2, 2: 3 }[v]);
  if (rank(now) > rank(before)) d.done[def.id] = now;
  if (before) return { first: false, reward: null, state: d.done[def.id] };
  const reward = PUZZLE.REWARD[def.level];
  profile.gold += reward.gold || 0;
  profile.stones += reward.stones || 0;
  return { first: true, reward, state: d.done[def.id] };
}

function recordPuzzleFail(profile, def) {
  profile.puzzle.fails[def.id] = (profile.puzzle.fails[def.id] || 0) + 1;
  return profile.puzzle.fails[def.id];
}
const puzzleCanSeeAnswer = (profile, def) => (profile.puzzle.fails[def.id] || 0) >= PUZZLE.FAILS_FOR_ANSWER || !!profile.puzzle.done[def.id];
