function click(sel, target) { handlers[sel + ':click'].forEach(fn => fn({ target: target || { dataset: {}, closest: () => null } })); }
const actEl = act => ({ dataset: { act }, closest: () => ({ dataset: { act } }) });
const slotEl = s => ({ closest: () => ({ dataset: { slot: String(s) } }) });
const cardEl = uid => ({ closest: () => ({ dataset: { uid: String(uid) } }) });
async function settle() { for (let i = 0; i < 4000; i++) await null; }
async function untilOver(max = 400) { for (let i = 0; i < max && state.phase !== 'over'; i++) await settle(); }
(async () => { try {
  profile.level = 3; refreshDaily(profile); profile.daily.quests = ['play', 'kill_melee', 'flash'].map(id => ({ id, progress: 0, claimed: false }));
  // A: オートのまま最後まで
  if (FX.auto) throw new Error('auto should start off');
  click('#btn-free');  await settle();
  click('#btn-auto');
  if (!FX.auto || !els['#btn-auto'].classList.has('on')) throw new Error('auto not on');
  await untilOver();
  if (state.phase !== 'over' || !state.result) throw new Error('A: not finished ' + state.phase + ' turn ' + state.turn);
  if (els['#overlay'].innerHTML.indexOf('もう一度') < 0) throw new Error('A: no result screen');
  if (profile.wins + profile.losses !== 1 || battleHistory.length !== 1) throw new Error('A: not recorded');
  const mine = state.log.filter(e => e[1] === 0 && 'PEFS'.includes(e[0])).length;
  if (!mine) throw new Error('A: auto actions not in log');
  const q = profile.daily.quests.map(x => x.progress);
  if (q[0] !== 1) throw new Error('A: quest play not counted ' + q);
  print('A ok: turns', state.turn, 'winner', state.result.winner, 'my logged actions', mine, 'quests', JSON.stringify(q), 'stats', JSON.stringify(state.stats[0]));
  if (JSON.parse(localStorage.getItem(FX_KEY)).auto !== true) throw new Error('auto not saved');
  // B: 次の対戦にも引き継がれる。自分の番の途中でオフにして、手動で続ける
  let calls = 0; const orig = autoActionFor;
  autoActionFor = (s, lv) => { if (++calls === 2) click('#btn-auto'); return orig(s, lv); };
  click('#overlay', actEl('restart')); await settle();
  for (let i = 0; i < 50 && FX.auto; i++) await settle();
  autoActionFor = orig;
  if (FX.auto) throw new Error('B: auto still on');
  await settle();
  if (state.phase === 'over') throw new Error('B: game ended before manual');
  if (busy || autoRunning || state.current !== 0 || state.phase !== 'play') throw new Error('B: not handed back: busy=' + busy + ' running=' + autoRunning + ' cur=' + state.current + ' ' + state.phase);
  const turnAt = state.turn;
  // 手動で1ターン：手札を選んで出す → ターン終了
  let a, n = 0;
  while ((a = cpuNextAction(state)) && ++n < 20) {
    if (a.type === 'sacrificeField') break;
    click('#hand', cardEl(a.uid));
    if (selectedUid !== a.uid) throw new Error('B: select failed');
    if (a.type === 'sacrifice') click('#btn-sacrifice');
    else if (a.type === 'flash') { const m = flashTarget(state.players[0].hand.find(h => h.uid === a.uid).card); if (m === 'none') click('#btn-use'); else click(m === 'enemy' ? '#field-1' : '#field-0', slotEl(a.slot)); }
    else click('#field-0', slotEl(a.slot));
    await settle();
    if (state.phase === 'over') break;
  }
  if (state.phase !== 'over') { click('#btn-end'); await settle(); }
  if (state.phase !== 'over' && (state.current !== 0 || busy)) throw new Error('B: manual turn did not come back');
  print('B ok: handed back at turn', turnAt, 'now turn', state.turn, 'manual actions', n);
  // C: 自分の番の途中でオンにすると、その場から自動で進む
  if (state.phase !== 'over') { click('#btn-auto'); if (!busy || !autoRunning) throw new Error('C: auto did not take over'); await untilOver(); }
  if (state.phase !== 'over') throw new Error('C: not finished');
  if (profile.wins + profile.losses !== 2) throw new Error('C: battle count');
  print('C ok: finished at turn', state.turn, 'quests', JSON.stringify(profile.daily.quests.map(x => x.progress)));
  // D: ステージとイベントでもオートで最後まで
  click('#overlay', actEl('title'));
  click('#btn-start'); click('#stage-list', { closest: () => ({ dataset: { stage: '1-1' } }) });
  click('#overlay', { dataset: { act: 'stage-go', stage: '1-1' }, closest: () => ({ dataset: { act: 'stage-go', stage: '1-1' } }) });
  
  await untilOver();
  if (state.phase !== 'over' || battleMode.type !== 'stage') throw new Error('D: stage');
  profile.level = 7; click('#overlay', actEl('title')); click('#overlay', actEl('event-go')); await settle(); await untilOver();
  if (!battleHistory[0].dn) throw new Error('D: history has no deck name');
  if (state.phase !== 'over' || battleMode.type !== 'event' || profile.event.wins + profile.event.losses !== 1) throw new Error('D: event ' + JSON.stringify(profile.event));
  print('D ok: stage + event, event record', profile.event.wins + '-' + profile.event.losses, 'history', battleHistory.length);
  // 速度の切り替え
  const before = FX.speed; click('#btn-speed'); const mid = FX.speed; click('#btn-speed'); click('#btn-speed');
  if (mid === before || FX.speed !== before) throw new Error('speed cycle');
  click('#btn-auto'); if (FX.auto) throw new Error('auto off');
  print('AUTO OK');
} catch (e) { print('FAIL', e, e.stack); } })();
