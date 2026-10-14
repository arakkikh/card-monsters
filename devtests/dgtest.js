async function settle() { for (let i = 0; i < 4000; i++) await null; }
async function untilOver(max = 600) { for (let i = 0; i < max && state.phase !== 'over'; i++) await settle(); }
const dg = (act, extra = {}) => dungeonClick({ target: { closest: () => ({ dataset: { dg: act, ...extra } }) } });
const bad = () => /undefined|NaN/.test(els['#dg-body'].innerHTML + els['#dg-status'].innerHTML + els['#overlay'].innerHTML);
(async () => { try {
  FX.auto = true; FX.speed = 'skip'; FX.mute = true; FX.autoLevel = 'strong';
  const gold0 = profile.gold;
  handlers['#btn-dungeon:click'].forEach(fn => fn({}));
  if (els['#dg-body'].innerHTML.indexOf('ヒーローを選ぶ') < 0 || bad()) throw new Error('start screen');
  dg('start');
  let run = profile.dungeon.run;
  if (!run || run.deck.monsters.length !== 4 || run.deck.items.length !== 4) throw new Error('run start');
  if (els['#dg-body'].innerHTML.indexOf('dg-map') < 0 || bad()) throw new Error('map');
  let battles = 0, resumed = 0, steps = 0, kinds = {};
  while (profile.dungeon.run && steps++ < 400) {
    run = profile.dungeon.run;
    if (bad()) throw new Error('bad html at step ' + steps + ' ' + JSON.stringify(run.pending).slice(0, 120));
    // 途中で閉じて開き直しても続きから（セーブデータから読み直す）
    if (steps % 7 === 3) { profile = loadProfile(); run = profile.dungeon.run; if (!run) throw new Error('lost on reload'); resumed++; renderDungeon(); }
    if (!run.pending) { const id = dungeonChoices(run)[0]; dg('node', { node: String(id) }); if (els['#overlay'].innerHTML.indexOf('ここへ進む') < 0) throw new Error('node info'); dg('enter', { node: String(id) }); continue; }
    const p = run.pending; kinds[p.type] = 1;
    if (dgReplace) { dg('replace', { index: '0' }); continue; }
    if (p.phase === 'battle') {
      dg('fight'); await untilOver();
      if (state.phase !== 'over' || battleMode.type !== 'dungeon') throw new Error('battle');
      if (els['#overlay'].innerHTML.indexOf('ダンジョンへ戻る') < 0) throw new Error('result button');
      battles++;
      handlers['#overlay:click'].forEach(fn => fn({ target: { closest: sel => (sel === '[data-dg]' ? { dataset: { dg: 'return' } } : null) } }));
      continue;
    }
    if (p.phase === 'lost') { dg(p.type === 'boss' || run.lives > 1 ? 'retry' : 'skip'); continue; }
    if (p.steps.length) { dg('take', { card: p.steps[0].offers[0] }); if (profile.dungeon.run && profile.dungeon.run.pending && profile.dungeon.run.pending.steps[0] === p.steps[0] && !dgReplace) dg('pass'); continue; }
    if (p.type === 'smith' && p.left > 0 && runUpgradable(run).length) { dg('smith', { card: runUpgradable(run)[0] }); continue; }
    if (p.type === 'shrine' && !p.used) { if (shrineCanHeal(run)) dg('heal'); else { dg('shrine-remove'); dg('remove', { key: 'items', index: '0' }); if (!p.used) dg('leave'); } continue; }
    if (p.type === 'shop' && p.stock.some((it, i) => !it.sold && run.coins >= shopPrice(run, it) && !p['tried' + i])) { const i = p.stock.findIndex((it, k) => !it.sold && run.coins >= shopPrice(run, it) && !p['tried' + k]); p['tried' + i] = 1; dg('buy', { index: String(i) }); continue; }
    if (p.type === 'mystery' && p.result == null) { dg('event', { index: '1' }); continue; }
    dg('leave');
  }
  if (profile.dungeon.run) throw new Error('run did not end, steps ' + steps);
  if (els['#overlay'].innerHTML.indexOf('持ち帰った報酬') < 0 || bad()) throw new Error('summary');
  if (profile.gold <= gold0) throw new Error('no reward');
  if (!battleHistory.some(r => r.m === 'd' && r.dn === 'ダンジョンのデッキ')) throw new Error('history');
  if (JSON.parse(store[GROWTH.SAVE_KEY]).dungeon.run !== null) throw new Error('run not cleared in save');
  if (profile.wins + profile.losses !== 0) throw new Error('dungeon battles must not count as normal battles');
  print('DUNGEON OK: battles', battles, 'reloads', resumed, 'best', JSON.stringify(profile.dungeon.best), 'kinds', Object.keys(kinds).join(','), 'gold +' + (profile.gold - gold0));
} catch (e) { print('FAIL', e, e.stack); } })();
