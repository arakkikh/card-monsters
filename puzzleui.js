// ============================================================
// 詰めパズルの画面（しくみは puzzle.js、問題は puzzles.js）
//   盤面は対戦画面をそのまま使う。オートバトルは使えない。
// ============================================================

let pz = null; // 遊んでいる問題 { def, hintLevel: 見たヒントの段数, usedHint, sawAnswer, undo: [1手前の盤面…], playing: 答えの再生中か }

const pzState = id => profile.puzzle.done[id] || 0;
const PZ_MARK = { 0: '', 1: '✓ クリア', 2: '★ ヒントなしでクリア', 3: 'クリア（答えを見た）' };

function puzzleButtonText() {
  const done = PUZZLES.filter(p => pzState(p.id)).length, stars = PUZZLES.filter(p => pzState(p.id) === 2).length;
  return `パズル（${done}/${PUZZLES.length}${stars ? `　★${stars}` : ''}）`;
}

// ---------- 問題一覧 ----------

function renderPuzzleList() {
  const reward = lv => { const r = PUZZLE.REWARD[lv]; return r.gold ? `💰${r.gold}` : `🔷${r.stones}`; };
  $('#pz-list').innerHTML = PUZZLE.LEVELS.map(([lv, name]) => {
    const list = PUZZLES.filter(p => p.level === lv);
    const rows = list.map((p, i) => {
      const st = pzState(p.id);
      return `<button class="pz-row s${st}" data-pz="open" data-id="${p.id}"><span class="pz-no">${i + 1}</span><span class="pz-name"><b>${p.title}</b><small>${puzzleGoalText(p.goal)}</small></span><span class="pz-mark">${st === 2 ? '★' : st === 1 ? '✓' : st === 3 ? '👁' : ''}</span></button>`;
    }).join('');
    return `<h2>${name}<small>　${list.filter(p => pzState(p.id)).length}/${list.length}　初回クリア ${reward(lv)}</small></h2>${rows}`;
  }).join('') + '<p class="dk-hint">★＝ヒントなしでクリア　✓＝クリア　👁＝答えを見てクリア。決まった盤面から、目標を達成してください。運の要素は固定されています。</p>';
}

function openPuzzles() {
  hideOverlay();
  pz = null;
  renderPuzzleList();
  showScreen('puzzles');
}

// ---------- 問題を始める ----------

function puzzleBarHtml() {
  const d = pz.def;
  const can = !busy && !pz.playing;
  const answer = puzzleCanSeeAnswer(profile, d);
  return `<div class="tb-row pz-goal"><b>🎯 目標</b><span>${puzzleGoalText(d.goal)}</span></div>
    <div class="tb-row pz-tools">
      <button class="btn small" data-pz="rules">ルール</button>
      <button class="btn small" data-pz="hint">ヒント${pz.hintLevel ? ` ${pz.hintLevel}/3` : ''}</button>
      <button class="btn small" data-pz="undo" ${can && pz.undo.length ? '' : 'disabled'}>1手戻す</button>
      <button class="btn small" data-pz="reset" ${pz.playing ? 'disabled' : ''}>やり直し</button>
      <button class="btn small" data-pz="answer" ${answer && !pz.playing ? '' : 'disabled'}>答え</button>
      <button class="btn small" data-pz="list">一覧</button>
    </div>`;
}
function renderPuzzleBar() { if (pz) $('#terrain-bar').innerHTML = puzzleBarHtml(); }

// 盤面を最初の状態にする
function resetPuzzle() {
  state = buildPuzzle(pz.def);
  pz.undo = [];
  selectedUid = inspectUid = null;
  battleLog = [];
  busy = false;
  autoRunning = false;
  say('目標を達成してください。カードを出して「ターン終了」');
  $('#battle-bg').innerHTML = sceneHtml(sceneNameFor({ type: 'puzzle' }, state.terrain));
  $('#screen-battle').classList.toggle('puzzle', true);
  $('#screen-battle').classList.toggle('auto', false);
  renderPuzzleBar();
  render();
}

function startPuzzle(id) {
  const def = PUZZLE_BY_ID[id];
  if (!def) return;
  pz = { def, hintLevel: 0, usedHint: false, sawAnswer: false, undo: [], playing: false };
  battleMode = { type: 'puzzle', def };
  hideOverlay();
  showScreen('battle');
  resetPuzzle();
  showPuzzleRules(true);
}

function leavePuzzle() {
  $('#screen-battle').classList.toggle('puzzle', false);
  pz = null;
  battleMode = { type: 'free' };
  state = null;
}

// 「この問題のルール」：学べること・目標・固定した運の要素
function showPuzzleRules(first) {
  const d = pz.def;
  const no = PUZZLES.filter(p => p.level === d.level).indexOf(d) + 1;
  const level = PUZZLE.LEVELS.find(x => x[0] === d.level)[1];
  showOverlay(`<div class="result detail dk-panel pz-panel">
    <p class="pz-tag">${level} ${no}</p><h2>${d.title}</h2>
    <p class="pz-lesson">${d.lesson}</p>
    <p class="boss-note"><b>🎯 目標</b>：${puzzleGoalText(d.goal)}</p>
    ${state && state.terrain ? `<p class="land-note">${terrainHtml(state.terrain)}</p>` : ''}
    <div class="tip-sub">この問題のルール</div>
    <ul class="pz-rules">${puzzleRules(d).map(r => `<li>${r}</li>`).join('')}</ul>
    ${d.start !== false ? '<p class="dk-hint">自分のターン開始時のスキル（Inspire など）は、発動済みの状態から始まります。</p>' : ''}
    <button class="btn primary" data-act="close-detail">${first ? 'はじめる' : 'とじる'}</button>
  </div>`);
}

// 手順1つを文にする
function puzzleStepText(def, step) {
  const card = i => puzzleCard(def.me.hand[i]);
  const [k, a, b] = step;
  if (k === 'm') return `${card(a).name}を、スロット${b + 1}に出す`;
  if (k === 'e') return `${card(a).name}を、自分のスロット${b + 1}のモンスターに装備する`;
  if (k === 'f') { const mode = flashTarget(card(a)); return `${card(a).name}を使う${mode === 'none' ? '' : `（対象：${mode === 'enemy' ? '相手' : '自分'}のスロット${b + 1}）`}`; }
  if (k === 's') return `${card(a).name}を生贄にする`;
  if (k === 'x') return `自分のスロット${a + 1}のモンスターを生贄にする`;
  return 'ターン終了を押す';
}

// ヒント：押すたびに1段ずつ増える（1：使うべきカード、2：順番、3：最初の一手）
function showPuzzleHint() {
  const d = pz.def;
  pz.hintLevel = Math.min(3, pz.hintLevel + 1);
  pz.usedHint = true;
  const hints = [d.hints[0], d.hints[1], `最初の一手：${puzzleStepText(d, d.solution[0])}`].slice(0, pz.hintLevel);
  showOverlay(`<div class="result detail dk-panel pz-panel">
    <h2>ヒント ${pz.hintLevel}/3</h2>
    ${hints.map((h, i) => `<p class="pz-hint"><b>${i + 1}</b> ${h}</p>`).join('')}
    <p class="dk-hint">ヒントを見ると、この挑戦では★が付きません。${pz.hintLevel < 3 ? 'もう一度「ヒント」を押すと、次の段が見られます。' : ''}</p>
    <button class="btn primary" data-act="close-detail">とじる</button>
  </div>`);
  renderPuzzleBar();
}

// ---------- 1手戻す ----------

// 今の盤面をまるごと写す（ログも含む）
function puzzleSnapshot(s) {
  const c = puzzleClone(s);
  c.log = s.log.slice(); c.moveBuf = []; c.fallBuf = [];
  c.tally = JSON.parse(JSON.stringify(s.tally)); c.stats = JSON.parse(JSON.stringify(s.stats));
  c.decks = s.decks; c.startEvents = []; c.endEvents = []; c.attrition = []; c.terrainEvents = [];
  return c;
}

// 画面をクリックする直前の盤面を覚えておき、クリックで行動が1つ進んでいたら「1手前」として積む
function puzzleTrackClick() {
  if (!pz || pz.playing || busy || !state || state.phase !== 'play' || state.current !== 0) return;
  const st = state, n = st.log.length, snap = puzzleSnapshot(st);
  setTimeout(() => {
    if (!pz || state !== st || st.log.length === n) return;
    pz.undo.push(snap);
    renderPuzzleBar();
  }, 0);
}
if (document.addEventListener) document.addEventListener('click', puzzleTrackClick, true);

function undoPuzzle() {
  if (!pz || busy || pz.playing || !pz.undo.length) return false;
  state = pz.undo.pop();
  selectedUid = inspectUid = null;
  say('1手戻しました');
  renderPuzzleBar();
  render();
  return true;
}

// ---------- 判定（ui.js の endTurn から、攻撃フェーズのあとに呼ばれる） ----------

async function puzzleAfterAttack() {
  const goal = pz.def.goal;
  const mine = state.current === 0;
  let r;
  if (mine) { state.turnsUsed++; r = puzzleJudge(state, goal); }
  else { state.foeDone = true; r = goal.type === 'hold' ? puzzleJudge(state, goal) : goal.noLoss && state.deaths[0] > 0 ? 'fail' : 'go'; }
  render();
  if (r === 'go') {
    // まだ続く：相手の番（CPUが動く）→ 自分の次の番
    finishTurn(state);
    if (state.endEvents.length) await playSkillEvents(state.endEvents);
    pz.undo = [];
    await beginTurn();
    renderPuzzleBar();
    return;
  }
  await sleep(500);
  if (r === 'win') puzzleWon(); else puzzleFailed();
}

function puzzleWon() {
  const d = pz.def;
  const rec = recordPuzzleClear(profile, d, { hints: pz.usedHint, answer: pz.sawAnswer });
  saveProfile(profile);
  renderTitle();
  sfx('win');
  const list = PUZZLES;
  const next = list[list.indexOf(d) + 1];
  const how = pz.sawAnswer ? '答えを見てクリア' : pz.usedHint ? 'クリア！' : '★ ヒントなしでクリア！';
  const reward = rec.first ? `<div class="rewards">初回クリアの報酬：${rec.reward.gold ? `💰 ゴールド +${rec.reward.gold}` : `🔷 魔石 +${rec.reward.stones}`}</div>` : '';
  pz.playing = false;
  showOverlay(`<div class="result win">
    <div class="result-icon">🧩</div><h2>${how}</h2>
    <p>${d.title}</p><p class="pz-lesson">${d.lesson}</p>${reward}
    <p>記録：${PZ_MARK[rec.state]}</p>
    ${next ? `<button class="btn primary big" data-pz="open" data-id="${next.id}">次の問題へ</button>` : '<p class="lvup">最後の問題です。おつかれさまでした！</p>'}
    <button class="btn big" data-pz="retry">もう一度解く</button>
    <button class="btn big" data-pz="list">問題一覧へ</button>
  </div>`);
}

function puzzleFailed() {
  const d = pz.def;
  const wasAnswer = pz.playing;
  pz.playing = false;
  const fails = wasAnswer ? (profile.puzzle.fails[d.id] || 0) : recordPuzzleFail(profile, d);
  saveProfile(profile);
  sfx('lose');
  const can = puzzleCanSeeAnswer(profile, d);
  showOverlay(`<div class="result lose">
    <div class="result-icon">🧩</div><h2>失敗…</h2>
    <p>目標：${puzzleGoalText(d.goal)}</p>
    <p class="dk-hint">${can ? '「答えを見る」が使えます。' : `あと${PUZZLE.FAILS_FOR_ANSWER - fails}回失敗すると、「答えを見る」が使えるようになります。`}</p>
    <button class="btn primary big" data-pz="retry">やり直す</button>
    <button class="btn big" data-pz="hint">ヒントを見る</button>
    ${can ? '<button class="btn big" data-pz="answer">答えを見る</button>' : ''}
    <button class="btn big" data-pz="list">問題一覧へ</button>
  </div>`);
}

// ---------- 答えを見る（手順を順番に再生する） ----------

async function playPuzzleAnswer() {
  if (!pz || pz.playing || !puzzleCanSeeAnswer(profile, pz.def)) return;
  const me = pz;
  hideOverlay();
  resetPuzzle();
  pz.sawAnswer = true;
  pz.playing = true;
  busy = true;
  renderPuzzleBar();
  render();
  for (const step of me.def.solution) {
    await sleep(900);
    if (pz !== me) return; // 途中で一覧へ戻った
    say(`答え：${puzzleStepText(me.def, step)}`);
    render();
    await sleep(700);
    if (pz !== me) return;
    if (step[0] === 'end') { await endTurn(); if (pz !== me || !me.playing) return; busy = true; render(); continue; }
    const action = puzzleAction(state, step);
    const done = applyAction(state, 0, action);
    if (action.type === 'monster') sfx('summon');
    if (action.type === 'equip') sfx('equip');
    if (action.type === 'flash' && done) await showFlash(done, 'あなた');
    if (done && done.events && done.events.length) { render(); await playSkillEvents(done.events); }
    busy = true;
    render();
  }
}

// ---------- 操作 ----------

function puzzleClick(e) {
  const el = e.target.closest ? e.target.closest('[data-pz]') : null;
  if (!el || el.disabled) return;
  const act = el.dataset.pz;
  if (act === 'open') { startPuzzle(el.dataset.id); return; }
  if (act === 'list') { leavePuzzle(); openPuzzles(); renderTitle(); return; }
  if (!pz) return;
  if (act === 'rules') showPuzzleRules(false);
  if (act === 'hint') showPuzzleHint();
  if (act === 'undo') undoPuzzle();
  if (act === 'reset' || act === 'retry') { hideOverlay(); pz.playing = false; resetPuzzle(); }
  if (act === 'answer') playPuzzleAnswer();
}

$('#btn-puzzle').addEventListener('click', openPuzzles);
$('#btn-pz-back').addEventListener('click', () => { showScreen('title'); renderTitle(); });
$('#pz-list').addEventListener('click', puzzleClick);
$('#terrain-bar').addEventListener('click', puzzleClick);
$('#overlay').addEventListener('click', puzzleClick);

// ここが最後に読み込まれるスクリプト。全部そろったので、タイトル画面を表示する
bootTitle();
