// ホーム画面とタブから、すべての機能にたどり着けるか
const tap = id => { if (!handlers['#' + id + ':click']) throw new Error('no handler: ' + id); if (els['#' + id] && els['#' + id].disabled) throw new Error('disabled: ' + id); handlers['#' + id + ':click'].forEach(fn => fn({ target: { closest: () => null, dataset: {} } })); };
const ov = (act, extra = {}) => handlers['#overlay:click'].forEach(fn => fn({ target: { dataset: { act, ...extra }, closest: sel => (sel === '[data-act]' ? { dataset: { act, ...extra } } : null) } }));
const html = () => els['#overlay'].innerHTML;
const open = () => !els['#overlay'].classList.has('hidden');
const expect = (cond, what) => { if (!cond) throw new Error(what); };
const home = () => { tap('tab-home'); expect(currentScreen === 'title' && !open(), 'home tab returns to title'); };
(async () => { try {
  FX.mute = true; profile.level = 10; profile.packs = 2; profile.stages = { '1-1': 3 }; renderTitle();
  const reached = [];
  // ホームの中身：次のステージ・デッキ名・バッジ・鍵
  expect(els['#btn-battle'].innerHTML.indexOf('1-2') >= 0 && els['#btn-battle'].innerHTML.indexOf(CHAPTERS[0].name) >= 0, 'battle button shows next stage');
  expect(els['#btn-home-deck'].innerHTML.indexOf('デッキ1') >= 0, 'deck name');
  expect(els['#home-gold'].innerHTML.indexOf(String(profile.gold)) >= 0 && els['#btn-pack-top'].innerHTML.indexOf('2') >= 0, 'resources');
  expect(els['#tab-pack-badge'].textContent === '2', 'pack badge');
  expect(els['#tab-home'].classList.has('on') && !els['#btn-deck'].classList.has('on'), 'home tab lit');
  // バトル → 次のステージの情報 → 挑戦
  tap('btn-battle'); expect(open() && html().indexOf('1-2') >= 0 && html().indexOf('挑戦する') >= 0, 'battle → stage info'); reached.push('ステージ（次のステージ）'); hideOverlay();
  tap('btn-start'); expect(currentScreen === 'stages', 'stage list'); reached.push('ステージ一覧'); home();
  tap('btn-dungeon'); expect(currentScreen === 'dungeon', 'dungeon'); reached.push('ダンジョン'); home();
  tap('btn-puzzle'); expect(currentScreen === 'puzzles', 'puzzles'); reached.push('パズル'); home();
  tap('btn-event'); expect(open() && html().indexOf('特殊ルール') >= 0, 'event'); reached.push('イベント'); hideOverlay();
  tap('btn-daily'); expect(open() && html().indexOf('デイリークエスト') >= 0, 'daily'); reached.push('デイリークエスト'); hideOverlay();
  tap('btn-login'); expect(open() && html().indexOf('ログインボーナス') >= 0, 'login'); reached.push('ログインボーナス'); hideOverlay();
  tap('btn-history'); expect(currentScreen === 'history', 'history'); reached.push('対戦履歴'); home();
  expect(handlers['#btn-dict:click'] && handlers['#btn-dict:click'].length === 1 && typeof openDict === 'function', 'dict'); reached.push('辞典');
  tap('btn-settings-title'); expect(open() && html().indexOf('演出の速さ') >= 0 && html().indexOf('オートバトルの強さ') >= 0, 'settings'); reached.push('設定'); hideOverlay();
  tap('btn-home-deck'); expect(open() && html().indexOf('デッキを切り替える') >= 0, 'deck switch'); reached.push('デッキの切り替え'); ov('dk-switch-close'); expect(!open(), 'switch closes');
  tap('btn-more'); expect(open() && html().indexOf('あそびかた') >= 0 && html().indexOf('データリセット') >= 0, 'more');
  ov('more-rules'); expect(html().indexOf('あそびかた') >= 0 && html().indexOf('rules') >= 0, 'rules'); reached.push('あそびかた');
  tap('btn-more'); ov('more-reset'); expect(html().indexOf('リセットする') >= 0, 'reset confirm'); reached.push('データリセット'); hideOverlay();
  tap('btn-more'); ov('more-settings'); expect(html().indexOf('演出の速さ') >= 0, 'settings via more'); hideOverlay();
  tap('btn-more'); ov('more-stages'); expect(currentScreen === 'stages', 'stages via more'); home();
  // タブ
  tap('btn-deck'); expect(currentScreen === 'decks' && els['#btn-deck'].classList.has('on') && !els['#tab-home'].classList.has('on'), 'deck tab'); reached.push('デッキ（一覧・編集・コード）');
  tap('btn-collection'); expect(currentScreen === 'collection' && els['#btn-collection'].classList.has('on'), 'collection tab'); reached.push('コレクション（強化・分解・作成）');
  tap('btn-pack'); expect(open() && els['#btn-pack'].classList.has('on'), 'pack tab'); reached.push('パック'); hideOverlay(); expect(!els['#btn-pack'].classList.has('on') && els['#btn-collection'].classList.has('on'), 'tab light returns');
  tap('btn-pack-top'); expect(open(), 'pack from top bar'); hideOverlay();
  tap('btn-hero'); expect(open() && els['#btn-hero'].classList.has('on') && html().indexOf('ヒーロー') >= 0, 'hero tab'); reached.push('ヒーロー'); hideOverlay();
  home();
  profile.packs = 0; profile.packBag = {}; renderTitle(); tap('btn-pack'); expect(open() && html().indexOf('ショップ') >= 0 && html().indexOf('で買う') >= 0 && !els['#tab-pack-badge'].classList.has('show'), 'no packs → shop'); hideOverlay();
  // フリー対戦：すぐ始まり、対戦中はタブバーが隠れる。終わってタイトルへ戻ると出る
  home(); tap('btn-free'); expect(currentScreen === 'battle' && els['#app'].classList.has('in-battle'), 'free battle hides tabs'); reached.push('フリー対戦');
  showScreen('title'); expect(!els['#app'].classList.has('in-battle'), 'tabs back');
  // 未解放：鍵と条件が出て、押せない
  profile.level = 1; renderTitle();
  for (const [id, lv] of [['btn-free', GROWTH.UNLOCK.free], ['btn-event', GROWTH.UNLOCK.event], ['btn-daily', GROWTH.UNLOCK.daily]]) expect(els['#' + id].disabled && els['#' + id].innerHTML.indexOf('🔒') >= 0 && els['#' + id].innerHTML.indexOf('Lv' + lv + 'で解放') >= 0, 'lock ' + id);
  expect(!els['#btn-dungeon'].disabled && !els['#btn-puzzle'].disabled, 'dungeon/puzzle always open');
  expect(els['#home-note'].textContent.indexOf('解放') >= 0, 'unlock note');
  // 全ステージクリア後は、バトルがステージ一覧へ
  profile.level = 10; STAGES.forEach(st => { profile.stages[st.id] = 3; }); renderTitle();
  expect(els['#btn-battle'].innerHTML.indexOf('全ステージクリア') >= 0, 'all clear label'); tap('btn-battle'); expect(currentScreen === 'stages', 'all clear → list');
  expect(!/undefined|NaN/.test(els['#btn-battle'].innerHTML + els['#profile-bar'].innerHTML + els['#btn-event'].innerHTML + els['#btn-dungeon'].innerHTML), 'no undefined');
  print('HOME OK: ' + reached.length + ' 機能に到達: ' + reached.join('、'));
} catch (e) { print('FAIL', e, String(e.stack).split('\n').slice(0, 2).join(' | ')); } })();
