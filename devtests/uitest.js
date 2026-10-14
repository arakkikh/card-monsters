
function click(sel, target) { handlers[sel + ':click'].forEach(fn => fn({ target: target || { dataset: {}, closest: () => null } })); }
const actEl = act => ({ dataset: { act }, closest: () => ({ dataset: { act } }) });
const slotEl = s => ({ closest: () => ({ dataset: { slot: String(s) } }) });
const cardEl = uid => ({ closest: () => ({ dataset: { uid: String(uid) } }) });
async function settle() { for (let i = 0; i < 4000; i++) await null; }
// boot check: startup must finish without errors (title buttons filled, mute icon drawn)
if (!els['#btn-mute'].innerHTML || !els['#btn-battle'].innerHTML || !els['#btn-puzzle'].innerHTML || !els['#btn-dungeon'].innerHTML || !els['#profile-bar'].innerHTML) { print('FAIL boot: title not fully rendered at startup'); }
(async () => {
  const tally = {}; let firsts = 0; const seen = {}, sample = {}; const KEYS = ['Flyingで回避', 'Thorns', 'Doublestrike', 'Outbreak', 'Disease：', 'Swallow', 'Heal：', 'Group Heal：', 'Inspire：', 'Shoot Command：', 'Demoralize：', 'Suppress Magic：', 'Entangle：', 'Silence：', 'Cleanse：', 'Silenceで魔法', 'Entangleで拘束', 'Shieldで', 'Piercing', 'Anti-Air', 'Batter', '手札に戻した', '敵全員にDisease', '味方全員を回復', '消耗ダメージ', 'ペナルティ', 'を使えない'];
  for (let g = 0; g < 200; g++) {
    // even games: stage mode through the stage screen; odd games: free battle
    if (g % 2 === 0) {
      click('#btn-start');
      const open = STAGES.filter(st => stageUnlocked(profile, st.id));
      const st = open[open.length - 1];
      if (/undefined|NaN/.test(els['#stage-list'].innerHTML)) throw new Error('stage list');
      click('#stage-list', { closest: () => ({ dataset: { stage: st.id } }) });
      if (els['#overlay'].innerHTML.indexOf('使用中のデッキ') < 0 || els['#overlay'].innerHTML.indexOf('挑戦する') < 0 || /undefined|NaN/.test(els['#overlay'].innerHTML)) throw new Error('stage info ' + st.id);
      click('#overlay', { dataset: { act: 'stage-go', stage: st.id }, closest: () => ({ dataset: { act: 'stage-go', stage: st.id } }) });
      if (battleMode.type !== 'stage' || state.players[1].name !== st.enemy) throw new Error('stage start');
    } else { profile.level = Math.max(profile.level, 2); click('#btn-free'); if (battleMode.type !== 'free') throw new Error('free start'); }
    while (profile.packs > 0) openPack(profile);
    await settle();
    let guard = 0;
    while (state.phase !== 'over') {
      if (++guard > 150) throw new Error('stuck');
      if (busy || state.current !== 0 || state.phase !== 'play') throw new Error('not player turn: ' + state.phase + busy);
      // play through the real tap handlers, using the CPU brain to choose
      let a, n = 0;
      while ((a = cpuNextAction(state)) && ++n < 20) {
        if (a.type !== 'sacrificeField') { click('#hand', cardEl(a.uid));
        if (selectedUid !== a.uid) throw new Error('select failed'); }
        if (a.type === 'sacrificeField') { click('#field-0', slotEl(a.slot)); if (els['#btn-sacrifice'].disabled) throw new Error('sac disabled'); click('#btn-sacrifice'); if (els['#overlay'].innerHTML.indexOf('よろしいですか') < 0) throw new Error('no confirm'); click('#overlay', actEl('sacrifice-field')); tally.sacField = (tally.sacField || 0) + 1; if (!state.players[0].sacrificed) throw new Error('field sac failed'); continue; }
        if (a.type === 'sacrifice') click('#btn-sacrifice');
        else if (a.type === 'flash') { const m = flashTarget(state.players[0].hand.find(h => h.uid === a.uid).card); if (m === 'none') { if (els['#btn-use'].classList.has('hidden')) throw new Error('use hidden'); click('#btn-use'); } else click(m === 'enemy' ? '#field-1' : '#field-0', slotEl(a.slot)); await settle(); tally.flash = (tally.flash || 0) + 1; if (state.phase === 'over') break; }
        else click('#field-0', slotEl(a.slot)); await settle();
        if (selectedUid !== null) throw new Error('action failed ' + JSON.stringify(a) + ' ' + message);
      }
      if (state.phase === 'over') break;
      if (!/残り \d/.test(els['#info-1'].innerHTML)) throw new Error('no left count');
      if (els['#field-0'].innerHTML.indexOf('undefined') >= 0 || els['#hand'].innerHTML.indexOf('undefined') >= 0 || els['#detail'].innerHTML.indexOf('undefined') >= 0) throw new Error('undefined in html');
      click('#field-1', slotEl(0)); click('#field-0', slotEl(0)); if (busy) throw new Error('busy stuck');
      if (els['#detail'].innerHTML.indexOf('undefined') >= 0 || els['#detail'].innerHTML.indexOf('NaN') >= 0) throw new Error('bad detail');
      if (g === 7 && guard === 2) { click('#btn-surrender'); click('#overlay', actEl('surrender')); break; }
      /* TIPCHECK */
      for (const pl of state.players) pl.slots.forEach((m, sl) => { if (m) { const html = monTipHtml(m, sl, pl.name); if (/undefined|NaN/.test(html)) throw new Error('bad mon tip ' + html); } });
      for (const h of state.players[0].hand) { if (/undefined|NaN/.test(tipHtmlOf({ type: 'hand', key: h.uid }))) throw new Error('bad hand tip'); }
      click('#btn-end'); await settle();
    }
    const r = state.result; const k = (r.winner === null ? 'draw' : r.winner === 0 ? 'win' : 'lose') + '/' + r.reason;
    tally[k] = (tally[k] || 0) + 1;
    if (els['#overlay'].innerHTML.indexOf('もう一度') < 0) throw new Error('no result screen');
    if (/undefined|NaN/.test(els['#overlay'].innerHTML)) throw new Error('bad result html');
    if (state.stageResult && state.stageResult.firstClear) firsts++;
    for (const l of battleLog) { if (/undefined|NaN|\[object/.test(l)) throw new Error('bad log: ' + l); for (const k of KEYS) if (l.indexOf(k) >= 0) { seen[k] = (seen[k] || 0) + 1; if (!sample[k]) sample[k] = l; } }
    for (const id of ['#field-0', '#field-1', '#hand', '#detail']) if (/undefined|NaN|\[object/.test(els[id].innerHTML)) throw new Error('bad html ' + id);
  }
  print(JSON.stringify(tally));
  print('missing keys:', KEYS.filter(k => !seen[k]).join(' | '));
  for (const k of KEYS) if (sample[k]) print('  ', sample[k]);
  // ---- growth screens ----
  if (profile.wins + profile.losses !== 200) throw new Error('battle count ' + (profile.wins + profile.losses));
  print('stages cleared', Object.keys(profile.stages).length, 'first clears', firsts, 'stars', JSON.stringify(Object.values(profile.stages).reduce((m, s) => { m[s] = (m[s] || 0) + 1; return m; }, {})));
  print('after 200 games: Lv' + profile.level, 'gold', profile.gold, 'packs', profile.packs, 'wins', profile.wins, 'stones', profile.stones);
  if (!/経験値 \+/.test(els['#overlay'].innerHTML) && !/降参したため/.test(els['#overlay'].innerHTML)) throw new Error('no reward text');
  click('#overlay', actEl('title'));
  if (!/Lv\d/.test(els['#profile-bar'].innerHTML)) throw new Error('title profile');
  profile.packs = 4;
  const owned0 = Object.keys(profile.cards).length, packs0 = profile.packs;
  click('#btn-pack'); // 2パック以上あるので、開け方を選ぶ画面が出る
  if (profile.packs !== packs0 || !/まとめて開ける/.test(els['#overlay'].innerHTML)) throw new Error('pack chooser');
  click('#overlay', actEl('pack-again'));
  if (profile.packs !== packs0 - 1 || !/通常パック/.test(els['#overlay'].innerHTML)) throw new Error('pack open');
  click('#overlay', actEl('pack-again'));
  if (profile.packs !== packs0 - 2) throw new Error('pack again');
  while (profile.packs > 0) click('#overlay', actEl('pack-again'));
  click('#overlay', actEl('close-detail'));
  print('cards owned', owned0, '->', Object.keys(profile.cards).length, 'of', Object.keys(CARD_DEFS).length);
  click('#btn-collection');
  if (!/モンスター \d+\/\d+/.test(els['#col-tabs'].innerHTML) || /undefined|NaN/.test(els['#col-list'].innerHTML)) throw new Error('collection');
  click('#col-tabs', { dataset: { tab: 'flash' } });
  if (!/石つぶて/.test(els['#col-list'].innerHTML)) throw new Error('tab');
  const idEl = id => ({ closest: () => ({ dataset: { id } }) });
  for (const id of Object.keys(CARD_DEFS)) { click('#col-list', idEl(id)); if (/undefined|NaN/.test(els['#overlay'].innerHTML)) throw new Error('detail ' + id); }
  // craft, upgrade, dismantle through the detail overlay
  profile.level = 10; profile.gold = 5000; profile.stones = 5000;
  click('#col-list', idEl('p08'));
  const had = owns(profile, 'p08') ? profile.cards.p08.copies + 1 : 0;
  click('#overlay', actEl('craft')); click('#overlay', actEl('craft'));
  if (profile.cards.p08.copies + 1 !== had + 2) throw new Error('craft');
  const lv = profile.cards.p08.level;
  click('#overlay', actEl('upgrade'));
  if (profile.cards.p08.level !== lv + 1) throw new Error('upgrade: ' + canUpgrade(profile, 'p08').reason);
  while (profile.cards.p08.copies > 0) click('#overlay', actEl('dismantle'));
  click('#overlay', actEl('dismantle'));
  if (!owns(profile, 'p08') || !/最後の1枚を分解します/.test(els['#overlay'].innerHTML)) throw new Error('confirm last');
  click('#overlay', actEl('dismantle-last'));
  if (owns(profile, 'p08')) throw new Error('dismantle last');
  if (JSON.parse(store[GROWTH.SAVE_KEY]).stones !== profile.stones) throw new Error('not saved');
  click('#btn-col-back');
  // deck editor: only owned cards, saves into the profile
  click('#btn-deck');
  if (els['#deck-list'].innerHTML.indexOf('使用中') < 0 || /undefined|NaN/.test(els['#deck-list'].innerHTML)) throw new Error('deck list');
  // deck list operations through the overlay
  const dk = (act, extra) => click('#overlay', { dataset: { act, ...extra }, closest: () => ({ dataset: { act, ...extra } }) });
  const firstId = profile.decks[0].id;
  click('#deck-list', { closest: sel => (sel === '.dk-row' ? { dataset: { deck: String(firstId) } } : null) });
  if (els['#overlay'].innerHTML.indexOf('複製する') < 0) throw new Error('deck menu');
  dk('dk-copy', { deck: String(firstId) });
  if (profile.decks.length !== 2) throw new Error('duplicate');
  const copyId = profile.decks[1].id;
  dk('dk-rename', { deck: String(copyId) }); $('#dk-name-input').value = 'テスト用'; dk('dk-rename-ok', { deck: String(copyId) });
  if (profile.decks[1].name !== 'テスト用') throw new Error('rename ' + profile.decks[1].name);
  dk('dk-export', { deck: String(copyId) });
  const code = deckToCode(profile.decks[1]);
  if (els['#overlay'].innerHTML.indexOf(code) < 0) throw new Error('export');
  dk('dk-import'); $('#dk-code-in').value = 'CM1-broken'; dk('dk-import-ok');
  if (profile.decks.length !== 2 || els['#overlay'].innerHTML.indexOf('⚠️') < 0) throw new Error('broken code must not import');
  $('#dk-code-in').value = code; dk('dk-import-ok');
  if (profile.decks.length !== 3 || els['#overlay'].innerHTML.indexOf('読み込みました') < 0) throw new Error('import');
  click('#deck-list', { closest: sel => (sel === '[data-move]' ? { dataset: { deck: String(copyId), move: '-1' } } : null) });
  if (profile.decks[0].id !== copyId) throw new Error('move');
  dk('dk-use', { deck: String(copyId) });
  if (profile.activeDeck !== copyId) throw new Error('use');
  dk('dk-delete', { deck: String(firstId) }); if (els['#overlay'].innerHTML.indexOf('削除しますか') < 0) throw new Error('confirm');
  dk('dk-delete-ok', { deck: String(firstId) });
  if (profile.decks.length !== 2 || deckById(profile, firstId)) throw new Error('delete');
  dk('dk-new', { from: 'empty' });
  if (profile.decks.length !== 3 || editDeck.monsters.length !== 0) throw new Error('new empty');
  click('#btn-deck-save');
  if (deckStatus(profile, profile.decks[2]).complete) throw new Error('empty deck saved as incomplete');
  if (els['#deck-list'].innerHTML.indexOf('未完成') < 0) throw new Error('incomplete badge');
  if (JSON.parse(store[GROWTH.SAVE_KEY]).decks.length !== 3) throw new Error('decks not saved');
  showDeckSwitch({ type: 'free' });
  if (els['#overlay'].innerHTML.indexOf('選べません：未完成') < 0) throw new Error('switcher shows unusable');
  hideOverlay();
  openDeckEditor(profile.activeDeck);
  if (/data-id="p08"/.test(els['#list-monsters'].innerHTML)) throw new Error('unowned card in deck editor');
  const out = editDeck.monsters[0];
  click('#list-monsters', { closest: sel => (sel === '.card' ? { dataset: { id: out } } : sel === '[data-minus]' ? {} : null) });
  if (editDeck.monsters.includes(out)) throw new Error('minus should remove');
  if (!els['#btn-deck-save'].disabled) throw new Error('save should be disabled with 7');
  const spare = Object.keys(profile.cards).find(id => CARD_DEFS[id].kind === 'monster' && CARD_DEFS[id].rarity !== 'legend' && !editDeck.monsters.includes(id) && id !== out);
  const plus = id => click('#list-monsters', { closest: sel => (sel === '.card' ? { dataset: { id } } : null) });
  plus(spare || out);
  if (spare) { // 2枚目に入れ替える：1枚外して、同じカードをもう1枚
    const other = editDeck.monsters.find(id => id !== spare);
    click('#list-monsters', { closest: sel => (sel === '.card' ? { dataset: { id: other } } : sel === '[data-minus]' ? {} : null) });
    plus(spare);
    if (deckCount(editDeck.monsters, spare) !== 2) throw new Error('second copy');
    plus(spare);
    if (deckCount(editDeck.monsters, spare) !== 2 || editDeck.monsters.length !== 8) throw new Error('third copy must not be added');
    if (els['#list-monsters'].innerHTML.indexOf('×2 最大') < 0 || els['#deck-contents'].innerHTML.indexOf('×2') < 0) throw new Error('x2 display');
  }
  if (els['#btn-deck-save'].disabled) throw new Error('deck toggle');
  click('#btn-deck-save');
  if (spare && (!profile.deck.monsters.includes(spare) || !activeDeck(profile).monsters.includes(spare))) throw new Error('deck save');
  // reset
  click('#btn-more'); click('#overlay', actEl('more-reset')); click('#overlay', actEl('reset'));
  if (JSON.stringify(profile) !== JSON.stringify(newProfile())) throw new Error('reset');
  for (const id in CARD_BY_ID) { if (CARD_BY_ID[id].token || CARD_BY_ID[id].special) continue; /* 召喚モンスター・特別カードはコレクションに出ない */ const html = tipHtmlOf({ type: 'deck', key: id }); if (!html || /undefined|NaN/.test(html)) throw new Error('bad card tip ' + id); }
  print('UI OK');
})().catch(e => { print('FAIL', e, e.stack); });
