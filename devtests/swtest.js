async function settle() { for (let i = 0; i < 4000; i++) await null; }
const ov = (act, extra = {}) => handlers['#overlay:click'].forEach(fn => fn({ target: { dataset: { act, ...extra }, closest: sel => (sel === '[data-act]' ? { dataset: { act, ...extra } } : null) } }));
const html = () => els['#overlay'].innerHTML;
const mono = color => ({ monsters: MONSTERS.filter(c => c.color === color).slice(0, 8).map(c => c.id), items: ITEMS.filter(c => !c.color || c.color === color).slice(0, 8).map(c => c.id) });
(async () => { try {
  FX.auto = false; FX.speed = 'skip'; FX.mute = true;
  profile.level = 10;
  for (const c of [...MONSTERS, ...ITEMS]) profile.cards[c.id] = profile.cards[c.id] || { level: 1, copies: 0 };
  const first = profile.decks[0];
  const blue = addDeck(profile, mono('blue'), '青単'), half = addDeck(profile, { monsters: mono('red').monsters.slice(0, 3), items: [] }, '作りかけ');
  profile.stages = { '1-1': 3, '1-2': 3 };
  renderTitle();
  if (els['#btn-home-deck'].innerHTML.indexOf('デッキ1') < 0) throw new Error('title deck name: ' + els['#btn-home-deck'].innerHTML);
  // 1. ステージ：情報画面 → 挑戦する → デッキ選択を挟まずに開始
  showStageInfo('1-1');
  if (html().indexOf('使用中のデッキ') < 0 || html().indexOf('デッキ1') < 0 || html().indexOf('dk-switch') < 0) throw new Error('stage info deck line');
  ov('stage-go', { stage: '1-1' });
  if (battleMode.type !== 'stage' || !state || state.decks[0].monsters.join() !== first.monsters.join()) throw new Error('stage did not start with active deck');
  if (html().indexOf('デッキを切り替える') >= 0 || html().indexOf('使うデッキを選ぶ') >= 0) throw new Error('picker shown');
  await settle();
  // 2. 情報画面でデッキを切り替える → 使用中が変わり、情報画面に戻る → そのデッキで始まる
  showStageInfo('1-2');
  ov('dk-switch', { back: 'stage:1-2' });
  if (html().indexOf('デッキを切り替える') < 0 || html().indexOf('青単') < 0 || html().indexOf('選べません：未完成') < 0 || /undefined|NaN/.test(html())) throw new Error('switch list');
  ov('dk-switch-pick', { deck: String(half.id) });
  if (profile.activeDeck !== first.id) throw new Error('unusable deck must not be picked');
  ov('dk-switch-pick', { deck: String(blue.id) });
  if (profile.activeDeck !== blue.id) throw new Error('switch');
  if (html().indexOf('挑戦する') < 0 || html().indexOf('青単') < 0) throw new Error('back to stage info with new deck');
  if (els['#btn-home-deck'].innerHTML.indexOf('青単') < 0) throw new Error('title not updated');
  if (JSON.parse(store[GROWTH.SAVE_KEY]).activeDeck !== blue.id) throw new Error('not saved');
  ov('stage-go', { stage: '1-2' });
  if (state.decks[0].monsters.join() !== blue.monsters.join() || battleMode.deckName !== '青単') throw new Error('battle with switched deck');
  await settle();
  // 3. フリー対戦も、すぐ始まる（前回のモードごとの記憶は使わない）
  profile.lastDeck = { free: first.id };
  handlers['#btn-free:click'].forEach(fn => fn({}));
  if (battleMode.type !== 'free' || state.decks[0].monsters.join() !== blue.monsters.join()) throw new Error('free');
  await settle();
  // 4. 使用中のデッキが未完成：対戦は始まらず、理由と切り替え一覧が出る
  const before = state;
  const keep = blue.monsters.slice(); blue.monsters = keep.slice(0, 4); syncActiveDeck(profile);
  showStageInfo('1-3'); ov('stage-go', { stage: '1-3' });
  if (state !== before) throw new Error('battle must not start with an incomplete deck');
  if (html().indexOf('未完成') < 0 || html().indexOf('デッキを切り替える') < 0) throw new Error('reason + switch list: ' + html().replace(/<[^>]+>/g, '').slice(0, 80));
  handlers['#btn-free:click'].forEach(fn => fn({}));
  if (state !== before || html().indexOf('未完成') < 0) throw new Error('free must not start either');
  ov('dk-switch-pick', { deck: String(first.id) });
  if (profile.activeDeck !== first.id) throw new Error('switch to usable');
  blue.monsters = keep;
  // 5. 色指定のイベント：条件に合わない → 一言出して、貸し出しデッキで始まる
  const real = currentEvent;
  const ev = EVENTS.find(e => e.rule.deckColor === 'blue');
  currentEvent = () => ev;
  profile.event = newEventData();
  showEvent();
  if (html().indexOf('貸し出しデッキ') < 0 || html().indexOf('使用中のデッキ') < 0) throw new Error('event panel note');
  ov('event-go');
  if (html().indexOf('貸し出しデッキで戦います') < 0) throw new Error('loaner notice');
  await settle();
  if (battleMode.type !== 'event' || !battleMode.loaner || battleMode.deckName !== '貸し出しデッキ' || !state.decks[0].monsters.every(id => CARD_DEFS[id].color === 'blue')) throw new Error('loaner battle');
  await settle();
  // 条件に合うデッキを使用中にすれば、自分のデッキで始まる
  setActiveDeck(profile, blue.id); profile.event = newEventData();
  ov('event-go'); await settle();
  if (battleMode.loaner || state.decks[0].monsters.join() !== blue.monsters.join()) throw new Error('own deck in color event');
  currentEvent = real;
  print('SWITCH OK');
} catch (e) { print('FAIL', e, String(e.stack).split('\n').slice(0, 2).join(' | ')); } })();
