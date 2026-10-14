// ============================================================
// オートバトル専用の思考（つよい）
//   敵CPU（engine.js の cpuNextAction）とは別物。CPUの強さは変えない。
//   考え方：
//     1. 自分の番にできる行動の組み合わせ（出す・装備・フラッシュ・生贄・何もしない）を調べ、
//        「ターンの終わり方」の候補を作る。同じ盤面になる手順は1つにまとめる
//     2. 候補ごとに盤面を複製して、自分の攻撃 → 相手の次の番（開始時の効果と攻撃）まで実際のルールで進める
//     3. 進めたあとの盤面を点数にする。乱数のある部分は何回か試して平均する
//   相手の手札と山札の中身は見ない（相手の次の番は「今の場のまま攻撃してくる」として試算する）。
//   画面には触らない。計算は少しずつ進められる形（ジェネレータ）にしてあり、画面側が小分けに実行する。
// ============================================================

CONFIG.AUTO_AI = {
  BUDGET_MS: 500,       // 1ターンの思考時間の上限（ミリ秒）
  SLICE_MS: 12,         // 画面を固めないために、この時間ごとに計算を区切る
  MAX_NODES: 500,       // 候補づくりで調べる盤面の数の上限
  MAX_CANDIDATES: 80,   // 試算する候補の上限（多いときは、試算なしの点数が低いものを先に除く）
  // 試算の回数：[上位何件, 1件あたり何回]。有望な候補ほど回数を増やす
  ROUNDS: [[Infinity, 3], [10, 6], [3, 12]],
  MAX_NOTES: 4,         // 1ターンにログへ残す理由の数
  // 盤面の点数の重み
  W: {
    win: 1000,          // 勝ち・負け
    left: 12,           // 残りモンスター1体（場・手札・山札）。勝敗に直結するので最も重い
    endgame: 6,         // 残りが少ない側ほど、1体の重みが増す（÷残り数）
    body: 1.5,          // 場にいること自体
    cost: 0.4,          // 場のモンスターのコスト（スキルの強さの目安）
    item: 0.4,          // 付いている装備のコスト
    hp: 0.6,            // 場のHP 1点
    armor: 0.5,         // 場のアーマー 1点
    atk: 1.2,           // そのスロットで実際に使える攻撃力 1点
    disease: 1.0,       // Disease 1スタック（毎ターン、スタック数ぶんのダメージを受ける）
    fog: 1.5,           // Fog 状態（次のダメージを0にする）
    emptyField: 4,      // 場が空（ペナルティの危険）
    crystal: 0.7,       // 次のターンに持ち越すクリスタル1個
    crystalCap: 5,      // これより多いクリスタルは数えない
    handMon: 0.3,       // 手札のモンスター（次のターンに出せるなら、コスト1あたり）
    handMonFar: 0.1,    // 手札のモンスター（次のターンにも出せない）
    handEquip: 0.5,     // 手札の装備（付けられる相手がいる）
    handFlash: 0.8,     // 手札のフラッシュ（コスト+1 あたり。小さな効果のために使わず、効くときまで取っておく）
    holdRemoval: 17,    // Terminate を手札に持っている価値（小さい相手には使わず、脅威に取っておく）
  },
};

// 再現できる乱数（試算用。対戦の乱数は使わない）
function aiRng(seed) {
  let x = (seed >>> 0) || 1;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}

const aiNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

// ---------- 盤面の複製 ----------

function aiCloneMon(m, owner) {
  if (!m) return null;
  const c = Object.assign({}, m);
  c.buff = Object.assign({}, m.buff);
  if (m.buff.grant) c.buff.grant = Object.assign({}, m.buff.grant);
  c.status = Object.assign({}, m.status);
  return setOwner(c, owner);
}

const AI_NO_BUF = { push() {} }; // 試算では、詰めの移動の記録を捨てる

// 試算用の複製。ログや集計は持たない（engine.js の記録処理は log が null なら何もしない）
function aiClone(state, rng) {
  const s = {
    rng, terrain: state.terrain, rules: state.rules, turn: state.turn, current: state.current, phase: state.phase,
    result: state.result, first: state.first, fixed: state.fixed, noResult: state.noResult, deaths: state.deaths ? state.deaths.slice() : undefined, log: null, moveBuf: AI_NO_BUF, tally: null, stats: null, sink: null, players: [],
  };
  for (const p of state.players) {
    const q = {
      // 手札・山札の1枚ごとの情報（コストの増減）は、試算の中で変わっても元の対戦に影響しないよう、写しを作る
      name: p.name, isCpu: p.isCpu, hero: p.hero, hand: p.hand.map(h => Object.assign({}, h)), deck: p.deck.map(h => Object.assign({}, h)), crystals: p.crystals,
      slots: null, discard: p.discard.slice(), sacrificed: p.sacrificed, terrain: p.terrain, rules: p.rules,
      bonusIncome: p.bonusIncome, wipedBySacrifice: p.wipedBySacrifice, charms: p.charms, playedFirst: p.playedFirst, debt: p.debt,
    };
    q.slots = p.slots.map(m => aiCloneMon(m, q));
    s.players.push(q);
  }
  linkPlayers(s);
  return s;
}

// 同じ盤面かどうかを見分ける文字列（出す順番が違っても、結果が同じなら1つの候補にまとめる）
function aiKey(s) {
  const pi = s.current, p = s.players[pi], foe = s.players[1 - pi];
  const mon = m => (m ? `${m.uid}.${m.item ? m.item.id : ''}.${m.hp}.${m.armor}.${JSON.stringify(m.status)}${m.phantomPending ? 'P' : ''}` : '-');
  return `${p.crystals}|${p.sacrificed ? 1 : 0}|${p.hand.map(h => h.uid).join(',')}|${p.slots.map(mon).join(' ')}|${foe.slots.map(mon).join(' ')}|${foe.deck.length}|${s.result ? s.result.winner : ''}`;
}

// ---------- 盤面の点数 ----------

// そのスロットで実際に使える攻撃力の合計（追加攻撃も数える。カオスは平均。拘束中は0）
function aiAttackPower(m, slot) {
  if (m.status.entangle) return 0;
  let atk = 0;
  for (const a of actionAttacks(m, slot)) {
    if (a.skip) continue;
    atk += a.type === 'chaos' && !m.buff.trickery ? (a.atk + 1) / 2 : a.atk;
  }
  return atk;
}

// 片方の側の点数。withHand: 手札も数える（自分の側だけ。相手の手札は見ない）
function aiSideValue(state, pi, withHand) {
  const W = CONFIG.AUTO_AI.W;
  const p = state.players[pi];
  const left = monstersLeft(p);
  if (!left) return -W.win;
  let v = W.left * left - W.endgame / left;
  let onField = 0;
  for (let s = 0; s < 3; s++) {
    const m = p.slots[s];
    if (!m || m.isPhantom) continue;
    onField++;
    v += W.body + W.cost * m.card.cost + (m.item ? W.item * m.item.cost : 0)
      + W.hp * m.hp + W.armor * m.armor + W.atk * aiAttackPower(m, s)
      - W.disease * ((m.status.disease || 0) + (m.status.burn || 0) * 0.6) + (m.status.fog ? W.fog : 0)
      - (m.status.stall ? W.atk * aiAttackPower(m, s) * 0.8 : 0);
  }
  if (!onField) v -= W.emptyField;
  // クリスタルは両者とも数える（倒されるとクリスタルが入るので、相手を倒すと相手のクリスタルも増える）
  v += W.crystal * Math.min(p.crystals, W.crystalCap);
  if (!withHand) return v;
  const next = p.crystals + CONFIG.CRYSTALS_PER_TURN + (p.bonusIncome || 0) + ((state.rules && state.rules.income) || 0);
  const colors = [...p.slots.filter(m => m).map(m => m.card.color), ...p.hand.filter(h => h.card.kind === 'monster').map(h => h.card.color)];
  for (const h of p.hand) {
    const c = h.card;
    if (c.kind === 'monster') v += c.cost * (costOf(p, h) <= next ? W.handMon : W.handMonFar);
    else if (c.kind === 'equip') v += !c.color || colors.includes(c.color) ? W.handEquip : 0;
    else if (!c.junk) v += c.skills[0].id === 'terminate' ? W.holdRemoval : W.handFlash * (c.cost + 1); // じゃまカードは0点
  }
  return v;
}

// me から見た盤面の点数（高いほど有利）
function aiEval(state, me) {
  const W = CONFIG.AUTO_AI.W;
  if (state.result) return state.result.winner === me ? W.win : -W.win;
  return aiSideValue(state, me, true) - aiSideValue(state, 1 - me, false);
}

// ---------- 試算 ----------

// 候補の盤面（自分の行動が終わったところ）から、自分の攻撃 → 相手の次の番の開始時効果と攻撃 まで進めて点数を返す
function aiSimulate(end, me, seed) {
  const s = aiClone(end, aiRng(seed));
  if (!s.result) {
    for (const ev of attackPhaseAll(s)) { /* 結果だけ使う */ }
    finishTurn(s); // ターン終了時のスキル・場が空のペナルティ・勝敗判定・手番の交代
  }
  if (!s.result && !startTurn(s)) { // 相手の番：消耗ダメージ・地形・開始時スキル
    for (const ev of attackPhaseAll(s)) { /* 相手は、今の場のまま攻撃してくるものとする */ }
    endOfTurnSkills(s);
    endOfTurnStatuses(s.players[s.current]);
    checkResult(s);
  }
  return aiEval(s, me);
}

// ---------- 候補づくり ----------

// 手札に持っておく価値の低い順（生贄の候補選び用）
function aiHoldValue(p, card) {
  const W = CONFIG.AUTO_AI.W;
  if (card.kind === 'monster') return 100 + card.cost;
  if (card.kind === 'flash') return card.junk ? 0 : card.skills[0].id === 'terminate' ? W.holdRemoval : 1 + card.cost; // じゃまカードは価値なし
  const owned = [...p.slots.filter(m => m), ...p.hand.filter(h => h.card.kind === 'monster').map(h => h.card)];
  const best = Math.max(0, ...owned.map(t => (canEquip(card, t.card ? t : { card: t }) ? itemScore(card, t) : 0)));
  return best <= 0 ? 0 : 0.5 + best / 4;
}

// その盤面でできる行動の一覧。first: そのターンの最初の行動か（生贄は最初にだけ考える。先に行っても後に行っても結果は同じため）
function aiMoves(s, first) {
  const pi = s.current, p = s.players[pi], foe = s.players[1 - pi];
  const moves = [];
  const count = p.slots.filter(m => m).length;
  const seen = {};
  for (const h of p.hand) {
    const c = h.card;
    const key = c.id + ':' + cardMod(h);
    if (seen[key]) continue; // 同じカードが2枚あっても、調べるのは1回（コストが変わっている1枚は別に調べる）
    seen[key] = true;
    if (c.kind === 'monster') {
      if (count < 3 && costOf(p, h) <= p.crystals) for (let at = 0; at <= count; at++) moves.push({ type: 'monster', uid: h.uid, slot: at });
    } else if (costOf(p, h) > p.crystals) {
      continue;
    } else if (c.kind === 'equip') {
      for (let slot = 0; slot < 3; slot++) {
        const mon = p.slots[slot];
        if (!mon || !canEquip(c, mon) || costOf(p, h, mon) > p.crystals) continue;
        if (mon.item && mon.item.cost >= c.cost) continue;       // 付け替えは、より高い装備にするときだけ（古い装備は捨てられる）
        if (itemScore(c, mon, slot, false, {}) <= 0) continue;   // 付けても意味のない装備
        moves.push({ type: 'equip', uid: h.uid, slot });
      }
    } else if (flashUsable(p, c)) {
      const id = c.skills[0].id;
      const mode = flashTarget(c);
      if (mode === 'none') {
        if (id === 'reinforcement' && c.skills[0].x <= c.cost) continue;
        if (id === 'groupheal' && !p.slots.some(m => m && (m.hp < m.maxHp || m.status.disease))) continue;
        if ((id === 'groupdisease' || id === 'masscorrosion') && !foe.slots.some(m => m)) continue;
        if (id === 'plagueburst' && !foe.slots.some(m => m && m.status.disease)) continue;
        if (id === 'purge' && ![...p.hand, ...p.deck].some(x => x.added && x.card.junk)) continue; // 自分の側にじゃまカードがあるときだけ
        if (id === 'swarm' && count >= 3) continue;
        if (id === 'unwelcomegift' && foe.slots.filter(m => m).length >= 3) continue;
        if (id === 'tax' && foe.hand.length < 2) continue; // 相手の手札の中身は見ない。枚数だけで判断する
        moves.push({ type: 'flash', uid: h.uid, slot: -1 });
        continue;
      }
      for (let slot = 0; slot < 3; slot++) {
        const t = (mode === 'enemy' ? foe : p).slots[slot];
        if (!t) continue;
        if (id === 'heal' && t.hp >= t.maxHp && !t.status.disease) continue;       // 満タンの味方は回復しない
        if (id === 'lingeringfog' && t.status.fog) continue;
        if (id === 'stall' && (t.status.stall || hasSkill(t, 'perseverance'))) continue;
        if ((id === 'retreat' || id === 'regroup') && count < 2) continue;                                // 場が1体のときは戻さない
        moves.push({ type: 'flash', uid: h.uid, slot });
      }
    }
  }
  if (first && !p.sacrificed) {
    const left = monstersLeft(p);
    const safe = left > CONFIG.AUTO_KEEP_MONSTERS; // 残りが少ないときは、モンスターを生贄にしない
    const hold = h => aiHoldValue(p, h.card);
    const items = p.hand.filter(h => h.card.kind !== 'monster').sort((a, b) => hold(a) - hold(b)).slice(0, 2);
    for (const h of items) moves.push({ type: 'sacrifice', uid: h.uid });
    if (safe) {
      const cheap = p.hand.filter(h => h.card.kind === 'monster').sort((a, b) => a.card.cost - b.card.cost)[0];
      if (cheap) moves.push({ type: 'sacrifice', uid: cheap.uid });
    }
    // 場の生贄：残りに余裕があるとき。または、場の誰も攻撃できない膠着を直すとき
    const stuck = count >= 2 && lineupAttack(p.slots.filter(m => m)) === 0 && !p.hand.some(h => h.card.kind === 'monster');
    if (count >= 2 && (safe || stuck)) for (let slot = 0; slot < count; slot++) if (!p.slots[slot].isToken) moves.push({ type: 'sacrificeField', slot });
  }
  return moves;
}

// 今の思考（ふつう）が選ぶ手順。必ず候補に入れる（新しい思考が、今より悪い手を選ばないようにするため）
function aiBaseline(state) {
  const s = aiClone(state, aiRng(state.turn + 5));
  const actions = [];
  let a;
  while (!s.result && actions.length < 30 && (a = cpuNextAction(s, { keep: CONFIG.AUTO_KEEP_MONSTERS }))) {
    if (applyAction(s, s.current, a) === false) break;
    actions.push(a);
  }
  return { state: s, actions, first: false, base: true };
}

// ---------- 思考の本体 ----------

// 少しずつ進められる思考。終わると plan を state.autoPlan に置いて返す。
//   ctl.deadline: この時刻（aiNow の値）を過ぎたら、そこまでの結果で決める
//   yield のたびに、呼び出し側は画面に処理を返してよい
function* autoSearch(state, ctl = {}) {
  const A = CONFIG.AUTO_AI;
  const me = state.current;
  const started = aiNow();
  const late = () => ctl.deadline != null && aiNow() > ctl.deadline;
  const root = { state: aiClone(state, aiRng(state.turn + 3)), actions: [], first: true };
  const nodes = new Map([[aiKey(root.state), root]]);
  const stack = [root];
  let work = 0;
  // 1. 候補づくり（深さ優先。同じ盤面は1つにまとめる）
  while (stack.length && nodes.size < A.MAX_NODES && !late()) {
    const node = stack.pop();
    if (node.state.result) continue;
    for (const mv of aiMoves(node.state, node.first)) {
      const s = aiClone(node.state, node.state.rng);
      const done = applyAction(s, me, mv);
      if (done === false || done === null) continue;
      const key = aiKey(s);
      if (nodes.has(key)) continue;
      const child = { state: s, actions: [...node.actions, mv], first: false };
      nodes.set(key, child);
      stack.push(child);
      if (nodes.size >= A.MAX_NODES) break;
    }
    if (++work % 8 === 0) yield;
  }
  const base = aiBaseline(state);
  const baseKey = aiKey(base.state);
  if (nodes.has(baseKey)) nodes.get(baseKey).base = true; else nodes.set(baseKey, base);

  // 2. 多すぎる候補は、試算なしの点数で先に除く（今の思考の手と「何もしない」は残す）
  let cands = [...nodes.values()];
  for (const c of cands) { c.quick = aiEval(c.state, me); c.sum = 0; c.n = 0; c.wins = 0; }
  if (cands.length > A.MAX_CANDIDATES) {
    cands.sort((a, b) => b.quick - a.quick);
    cands = cands.filter((c, i) => i < A.MAX_CANDIDATES || c.base || !c.actions.length);
  }
  yield;

  // 3. 試算。同じ回には全候補に同じ乱数を使い、運の差で順位が変わらないようにする
  const mean = c => (c.n ? c.sum / c.n : c.quick - 1e6);
  const better = (a, b) => mean(b) - mean(a) || a.actions.length - b.actions.length;
  let sims = 0, k = 0, pool = cands;
  rounds: for (const [top, times] of A.ROUNDS) {
    pool = pool.slice().sort(better).slice(0, top);
    if (pool.length < 2 && pool[0].n) break;
    for (let i = 0; i < times; i++, k++) {
      const seed = state.turn * 1009 + k * 7919 + 17;
      for (const c of pool) {
        const v = aiSimulate(c.state, me, seed);
        c.sum += v; c.n++; sims++;
        if (v >= CONFIG.AUTO_AI.W.win) c.wins++;
        if (sims % 6 === 0) { yield; if (late()) break rounds; }
      }
    }
  }
  const tried = cands.filter(c => c.n);
  const minN = Math.min(...pool.map(c => c.n));
  // 時間切れで回数がそろっていないときは、同じ回数まで試した候補どうしで比べる
  const best = (pool.every(c => c.n === minN) ? pool : tried).slice().sort(better)[0] || base;
  const plan = aiMakePlan(state, best, {
    nodes: nodes.size, candidates: cands.length, sims, ms: aiNow() - started,
    score: mean(best), baseScore: nodes.get(baseKey).n ? mean(nodes.get(baseKey)) : null,
    usedBase: !!best.base,
  });
  state.autoPlan = plan;
  return plan;
}

// 最後まで一気に考える（テスト・大量対戦用。時間の上限なし）
function autoThinkSync(state, ctl = {}) {
  const gen = autoSearch(state, ctl);
  let r;
  do { r = gen.next(); } while (!r.done);
  return r.value;
}

// 画面用：計算を小分けにして、合間に画面へ処理を返しながら考える（Promise を返す）
function autoThink(state) {
  const A = CONFIG.AUTO_AI;
  const gen = autoSearch(state, { deadline: aiNow() + A.BUDGET_MS });
  return new Promise(resolve => {
    const step = () => {
      const t = aiNow();
      let r;
      do { r = gen.next(); } while (!r.done && aiNow() - t < A.SLICE_MS);
      if (r.done) resolve(r.value); else setTimeout(step, 0);
    };
    step();
  });
}

// 今の盤面に合った計画が、もうできているか
function autoPlanReady(state) {
  const plan = state.autoPlan;
  if (!plan || plan.turn !== state.turn || plan.side !== state.current) return false;
  return plan.fallback || aiKey(state) === (plan.queue.length ? plan.queue[0].expect : plan.endKey);
}

// ---------- 理由 ----------

const AI_COUNTER_SKILLS = ['thorns', 'crosscounter', 'counter', 'shieldspike'];

// 選んだ手順に、主な理由を付けて plan にする
//   理由は [種類, …] の短い配列。文にするのは battlelog.js（対戦ログの ['N', 側, 種類, …]）
function aiMakePlan(state, best, stats) {
  const me = state.current;
  const w = aiClone(state, aiRng(state.turn + 9));
  const queue = [];
  const cardOf = uid => { const h = w.players[me].hand.find(x => x.uid === uid); return h ? h.card : null; };
  const firstPlayed = best.actions.map(a => (a.type === 'monster' || a.type === 'equip' || a.type === 'flash' ? cardOf(a.uid) : null)).filter(c => c)
    .sort((a, b) => (b.kind === 'monster') - (a.kind === 'monster') || b.cost - a.cost)[0];
  for (const a of best.actions) {
    const p = w.players[me], foe = w.players[1 - me];
    const expect = aiKey(w);
    const c = a.uid != null ? cardOf(a.uid) : null;
    const ref = a.uid != null ? logCardRef(w.players[me].hand.find(x => x.uid === a.uid)) : '';
    let why = null;
    if (a.type === 'monster') {
      const count = p.slots.filter(m => m).length;
      const melee = c.type === 'melee' && !(c.skills || []).some(k => k.id === 'reach');
      const front = foe.slots[0];
      const danger = front && AI_COUNTER_SKILLS.find(id => hasSkill(front, id));
      const caster = foe.slots.some(m => m && (getAttacks(m).some(x => x.type === 'magic') || skillX(m, 'heal') || skillX(m, 'groupheal')));
      if ((c.skills || []).some(k => k.id === 'silence') && caster) why = ['silence', ref];
      else if (a.slot === 0 && count === 0) why = ['open', ref];
      else if (a.slot === 0) why = [c.armor > 0 ? 'tank' : 'front', ref, logRef(w, p.slots[0])];
      else if (melee && danger) why = ['avoid', ref, logRef(w, front), danger];
      else if (melee) why = ['wait', ref];
      else why = ['back', ref, c.type];
    } else if (a.type === 'equip') {
      const mon = p.slots[a.slot];
      const gain = Object.keys(c.atk || {}).some(t => canUseType({ ...mon, item: c }, t, a.slot));
      why = [mon.item ? 'swap' : gain ? 'eqatk' : c.armor || c.hp ? 'eqdef' : 'eqskill', c.id, logRef(w, mon), mon.item ? mon.item.id : 0];
    } else if (a.type === 'flash') {
      const id = c.skills[0].id;
      const mode = flashTarget(c);
      const t = mode === 'enemy' ? foe.slots[a.slot] : mode === 'ally' ? p.slots[a.slot] : null;
      why = ['flash', c.id, logRef(w, t), id];
    } else if (a.type === 'sacrifice') {
      why = ['sac', c.id, firstPlayed ? firstPlayed.id : 0];
    } else if (a.type === 'sacrificeField') {
      why = ['sacf', logCardRef(p.slots[a.slot]), firstPlayed ? firstPlayed.id : 0];
    }
    const done = applyAction(w, me, a);
    if (why && why[0] === 'flash' && done && done.killed && why[3] !== 'terminate') why[3] = 'kill';
    queue.push({ ...a, why, expect });
  }
  // 行動のあとに残す理由：勝ちきれる見込み・温存
  const notes = [];
  const p = w.players[me];
  if (best.n && best.wins / best.n >= 0.5 && !w.result) notes.push(['win']);
  const next = p.crystals + CONFIG.CRYSTALS_PER_TURN + (p.bonusIncome || 0) + ((state.rules && state.rules.income) || 0);
  const room = p.slots.some(m => !m);
  const big = p.hand.filter(h => h.card.kind === 'monster' && costOf(p, h) > p.crystals && costOf(p, h) <= next)
    .sort((a, b) => b.card.cost - a.card.cost)[0];
  const idleMon = room && p.hand.find(h => h.card.kind === 'monster' && costOf(p, h) <= p.crystals);
  const idleFlash = p.hand.find(h => h.card.kind === 'flash' && costOf(p, h) <= p.crystals && flashUsable(p, h.card));
  if (!w.result) {
    if (p.crystals > 0 && big && (idleMon || idleFlash || p.crystals >= 2)) notes.push(['save', p.crystals, big.card.id, costOf(p, big)]);
    else if (idleFlash) notes.push(['hold', idleFlash.card.id, 'flash']);
    else if (idleMon) notes.push(['hold', idleMon.card.id, 'monster']);
  }
  // ログに残す数を絞る（フラッシュ・生贄・配置の工夫を優先し、ふつうの配置と装備は後回し）
  const rank = y => ({ flash: 0, sac: 1, sacf: 1, avoid: 1, silence: 2, tank: 3, swap: 3, front: 4, wait: 4, eqatk: 5, eqdef: 5, eqskill: 5, back: 6, open: 6 }[y[0]]);
  const keep = queue.filter(a => a.why).map(a => a.why).sort((x, y) => rank(x) - rank(y)).slice(0, Math.max(0, CONFIG.AUTO_AI.MAX_NOTES - notes.length));
  for (const a of queue) if (a.why && !keep.includes(a.why)) a.why = null;
  return { turn: state.turn, side: me, queue, notes, endKey: aiKey(w), stats };
}

// ---------- 画面・対戦から呼ぶ入口 ----------

// オート（つよい）の次の行動。何もすることがなければ null（＝ターン終了）。
// 計画がまだなければ、その場で最後まで考える（画面からは、先に autoSearch を小分けに進めておく）。
// 行動を返すときに、その理由を対戦ログに記録する
function autoStrongAction(state) {
  if (state.phase !== 'play') return null;
  // 計画がない・途中で手動の操作が入って盤面と合わなくなった、のどちらかなら考え直す
  const plan = autoPlanReady(state) ? state.autoPlan : autoThinkSync(state);
  if (plan.fallback) return autoNextAction(state);
  const a = plan.queue.shift();
  if (!a) {
    if (plan.notes.length) logPush(state, ...plan.notes.map(n => ['N', state.current, ...n]));
    plan.notes = [];
    return null;
  }
  const action = { type: a.type, slot: a.slot };
  if (a.uid != null) action.uid = a.uid;
  if (a.why) logPush(state, ['N', state.current, ...a.why]);
  return action;
}

// オートの次の行動を、強さに合わせて返す（'strong' = つよい / それ以外 = ふつう＝CPUと同じ思考）
function autoActionFor(state, level) {
  return level === 'strong' ? autoStrongAction(state) : autoNextAction(state);
}
