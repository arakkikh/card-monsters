async function settle() { for (let i = 0; i < 4000; i++) await null; }
const pzc = (act, extra = {}) => { if (act === 'retry' || act === 'open' || act === 'answer') els['#overlay'].innerHTML = ''; return pzcRaw(act, extra); };
const pzcRaw = (act, extra = {}) => puzzleClick({ target: { closest: () => ({ dataset: { pz: act, ...extra } }) } });
const badHtml = () => /undefined|NaN/.test(els['#terrain-bar'].innerHTML + els['#overlay'].innerHTML + els['#pz-list'].innerHTML);
const overlay = () => els['#overlay'].innerHTML;
(async () => { try {
  FX.auto = true; FX.speed = 'skip'; FX.mute = true; // オートがオンでも、パズルでは自動で進まない
  handlers['#btn-puzzle:click'].forEach(fn => fn({}));
  if (els['#pz-list'].innerHTML.indexOf('入門') < 0 || badHtml()) throw new Error('list');
  const gold0 = profile.gold, stones0 = profile.stones;
  let solved = 0;
  for (const def of PUZZLES) {
    pzc('open', { id: def.id });
    if (battleMode.type !== 'puzzle' || !pz || overlay().indexOf('この問題のルール') < 0 || badHtml()) throw new Error('open ' + def.id);
    hideOverlay(); els['#overlay'].innerHTML = '';
    if (busy || state.current !== 0 || state.phase !== 'play') throw new Error('not playable ' + def.id);
    // 1手進めて戻す → やり直し
    const first = def.solution[0];
    if (first[0] !== 'end') {
      const before = JSON.stringify(state.players.map(p => [p.crystals, p.hand.length, p.slots.map(m => m && [m.card.id, m.hp, m.item && m.item.id])]));
      puzzleTrackClick();
      applyAction(state, 0, puzzleAction(state, first));
      await settle();
      if (pz.undo.length !== 1) throw new Error('undo stack ' + def.id);
      if (!undoPuzzle()) throw new Error('undo ' + def.id);
      const after = JSON.stringify(state.players.map(p => [p.crystals, p.hand.length, p.slots.map(m => m && [m.card.id, m.hp, m.item && m.item.id])]));
      if (before !== after) throw new Error('undo did not restore ' + def.id);
      if (state.players[0].slots.some(m => m && m.owner !== state.players[0])) throw new Error('owner lost after undo');
    }
    // 正解の手順を、画面の流れ（ターン終了 → 攻撃 → 判定）で実行する
    for (const step of def.solution) {
      if (step[0] === 'end') { handlers['#btn-end:click'].forEach(fn => fn({})); for (let i = 0; i < 80 && overlay().indexOf('クリア') < 0 && overlay().indexOf('失敗') < 0 && (busy || state.current !== 0); i++) await settle(); await settle(); }
      else if (applyAction(state, 0, puzzleAction(state, step)) === false) throw new Error('illegal ' + def.id);
    }
    if (overlay().indexOf('ヒントなしでクリア') < 0) throw new Error('not solved in UI: ' + def.id + ' ' + overlay().replace(/<[^>]+>/g, '').slice(0, 80));
    if (pzState(def.id) !== 2) throw new Error('star ' + def.id);
    solved++;
  }
  if (profile.gold - gold0 !== 10 * 40 + 10 * 80 || profile.stones - stones0 !== 100) throw new Error('rewards ' + (profile.gold - gold0) + ' ' + (profile.stones - stones0));
  // 失敗 → 3回で答えが見られる → 答えの再生
  profile.puzzle = newPuzzleData();
  const d = PUZZLE_BY_ID.b02;
  pzc('open', { id: d.id }); hideOverlay();
  for (let k = 0; k < 3; k++) {
    if (puzzleCanSeeAnswer(profile, d)) throw new Error('answer too early');
    handlers['#btn-end:click'].forEach(fn => fn({})); for (let i = 0; i < 40 && overlay().indexOf('失敗') < 0; i++) await settle();
    if (overlay().indexOf('失敗') < 0) throw new Error('fail screen');
    pzc('retry');
  }
  if (!puzzleCanSeeAnswer(profile, d) || /data-pz="answer"\s+disabled/.test(els['#terrain-bar'].innerHTML)) throw new Error('answer should unlock ' + JSON.stringify(profile.puzzle.fails) + els['#terrain-bar'].innerHTML.slice(-260));
  pzc('hint'); pzc('hint'); pzc('hint'); pzc('hint');
  if (pz.hintLevel !== 3 || overlay().indexOf('最初の一手') < 0 || badHtml()) throw new Error('hints');
  hideOverlay(); els['#overlay'].innerHTML = '';
  pzc('answer');
  for (let i = 0; i < 200 && overlay().indexOf('クリア') < 0; i++) await settle();
  if (overlay().indexOf('答えを見てクリア') < 0 || pzState(d.id) !== 3) throw new Error('answer playback ' + overlay().replace(/<[^>]+>/g, '').slice(0, 80));
  // ヒントありでクリア → ✓。もう一度ヒントなしで解くと ★
  pzc('retry'); pz.usedHint = true; pz.sawAnswer = false;
  for (const step of d.solution) { if (step[0] === 'end') { handlers['#btn-end:click'].forEach(fn => fn({})); for (let i = 0; i < 40 && overlay().indexOf('クリア') < 0; i++) await settle(); } else applyAction(state, 0, puzzleAction(state, step)); }
  if (pzState(d.id) !== 1) throw new Error('hint clear should be 1: ' + pzState(d.id));
  pzc('list');
  if (pz || els['#pz-list'].innerHTML.indexOf('✓') < 0) throw new Error('back to list');
  if (JSON.parse(store[GROWTH.SAVE_KEY]).puzzle.done.b02 !== 1) throw new Error('not saved');
  print('PUZZLE OK: solved in UI', solved, '/', PUZZLES.length);
} catch (e) { print('FAIL', e, String(e.stack).split('\n').slice(0, 3).join(' | ')); } })();
