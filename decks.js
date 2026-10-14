// ============================================================
// 複数デッキの保存（画面には触らない）
//   profile.decks:      [{ id, name, monsters: [id], items: [id], hero: ヒーローid, skill: スキルの番号 }]（最大10個）
//   profile.activeDeck: 使用中のデッキの id
//   profile.lastDeck:   以前の版の「そのモードで前回使ったデッキ」。今は使っていない（対戦はいつも「使用中」のデッキで行う）
//   profile.deck と profile.hero.selected / skill は「使用中のデッキ」の写し（今までのしくみはこれを見る）。
//   使用中のデッキは、いつも対戦に使える状態（16枚そろい、すべて持っている）に保つ。
//   ほかのデッキは未完成でも保存できる。同じカードを複数のデッキに入れてよい。
// ============================================================

const DECKS = {
  MAX: 10,        // 保存できるデッキの数
  NAME_MAX: 16,   // デッキ名の長さ
  CODE: 'CM1',    // デッキコードの先頭（形式の版）
  MODES: ['stage', 'free', 'event'],
};

const deckIndex = (profile, id) => profile.decks.findIndex(d => d.id === id);
const deckById = (profile, id) => profile.decks[deckIndex(profile, id)] || null;
const activeDeck = profile => deckById(profile, profile.activeDeck);

// 使われていない番号で「デッキN」を作る
function freeDeckName(profile) {
  for (let n = 1; ; n++) if (!profile.decks.some(d => d.name === 'デッキ' + n)) return 'デッキ' + n;
}

function cleanDeckName(name) {
  return String(name == null ? '' : name).replace(/[\u0000-\u001f<>&"]/g, '').trim().slice(0, DECKS.NAME_MAX);
}

// カードの並びを点検する：実在する・種類が合う・同じカードは2枚まで（レジェンドは1枚）・枚数は上限まで（持っているかは問わない）
function cleanDeckCards(ids, monster, max) {
  const out = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    if (CARD_DEFS[id] && (CARD_DEFS[id].kind === 'monster') === monster && deckCount(out, id) < copyLimit(id) && out.length < max) out.push(id);
  }
  return out;
}

// その並びに、そのカードが何枚入っているか
const deckCount = (ids, id) => ids.filter(x => x === id).length;
// 同じカードをまとめた並び [[id, 枚数]]（最初に出てきた順）
function deckGroups(ids) {
  const out = [];
  for (const id of ids) { const g = out.find(x => x[0] === id); if (g) g[1]++; else out.push([id, 1]); }
  return out;
}
// 1枚足せるか（同じカードは2枚まで、レジェンドは1枚まで・全体の枚数の上限まで）
function canAddToDeck(ids, id, max) { return ids.length < max && deckCount(ids, id) < copyLimit(id); }

function nextDeckId(profile) {
  profile.deckSeq = (profile.deckSeq || 0) + 1;
  return profile.deckSeq;
}

// デッキの状態。
//   complete: 16枚そろっている / missing: 持っていないカード / playable: 対戦に使える
function deckStatus(profile, deck) {
  const ids = [...deck.monsters, ...deck.items];
  const missing = [...new Set(ids)].filter(id => !owns(profile, id));
  const complete = deck.monsters.length === CONFIG.DECK_MONSTERS && deck.items.length === CONFIG.DECK_ITEMS;
  return { complete, missing, playable: complete && !missing.length, monsters: deck.monsters.length, items: deck.items.length };
}

// 一覧に出す要約：入っている色・代表のモンスター（コストの高い順に3体まで）・平均コスト
function deckSummary(deck) {
  const mons = deck.monsters.map(id => CARD_DEFS[id]);
  const colors = Object.keys(COLORS).filter(c => mons.some(m => m.color === c));
  const top = [...new Set(mons)].sort((a, b) => b.cost - a.cost).slice(0, 3).map(m => m.id);
  const all = [...deck.monsters, ...deck.items].map(id => CARD_DEFS[id].cost);
  const avg = all.length ? Math.round(10 * all.reduce((n, c) => n + c, 0) / all.length) / 10 : 0;
  return { colors, top, avg };
}

// 使用中のデッキの内容を、profile.deck とヒーローの選択に写す
function syncActiveDeck(profile) {
  const d = activeDeck(profile);
  profile.deck = { monsters: d.monsters.slice(), items: d.items.slice() };
  if (heroSkillUnlocked(profile, d.hero, d.skill)) { profile.hero.selected = d.hero; profile.hero.skill = d.skill; }
  else { d.hero = profile.hero.selected; d.skill = profile.hero.skill; }
}

// 読み込んだセーブデータのデッキを点検する。古いセーブ（デッキが1つ）は、そのデッキを「デッキ1」として引き継ぐ。
//   out: 作りかけのプロフィール（cards・hero・deck は点検済み）　p: 読み込んだままのデータ
function sanitizeDecks(out, p) {
  const list = [];
  let seq = 0;
  for (const d of Array.isArray(p.decks) ? p.decks.slice(0, DECKS.MAX) : []) {
    if (!d || typeof d !== 'object') continue;
    const id = Number.isInteger(d.id) && d.id > 0 && !list.some(x => x.id === d.id) ? d.id : seq + 1;
    seq = Math.max(seq, id);
    const hero = out.hero.unlocked.includes(d.hero) ? d.hero : out.hero.selected;
    list.push({
      id, name: cleanDeckName(d.name) || 'デッキ' + (list.length + 1),
      monsters: cleanDeckCards(d.monsters, true, CONFIG.DECK_MONSTERS), items: cleanDeckCards(d.items, false, CONFIG.DECK_ITEMS),
      hero, skill: heroSkillUnlocked(out, hero, d.skill) ? d.skill : 0,
    });
  }
  // 古いセーブ：今のデッキを「デッキ1」にする
  if (!list.length) list.push({ id: ++seq, name: 'デッキ1', monsters: out.deck.monsters.slice(), items: out.deck.items.slice(), hero: out.hero.selected, skill: out.hero.skill });
  out.decks = list;
  out.deckSeq = Math.max(seq, Number.isInteger(p.deckSeq) ? p.deckSeq : 0);
  // 使用中のデッキは対戦に使えるものにする。使えるデッキが1つもなければ、使用中のデッキをスターターの内容に戻す
  const usable = d => deckStatus(out, d).playable;
  let active = deckById(out, p.activeDeck) || list[0];
  if (!usable(active)) active = list.find(usable) || active;
  if (!usable(active)) {
    [...DEFAULT_DECK.monsters, ...DEFAULT_DECK.items].forEach(id => { if (!out.cards[id]) out.cards[id] = { level: 1, copies: 0 }; });
    active.monsters = DEFAULT_DECK.monsters.slice();
    active.items = DEFAULT_DECK.items.slice();
  }
  out.activeDeck = active.id;
  out.lastDeck = {}; // 今は使っていない
  syncActiveDeck(out);
  return out;
}

// ---------- 操作 ----------

// 使用中にする（対戦に使えるデッキだけ）
function setActiveDeck(profile, id) {
  const d = deckById(profile, id);
  if (!d || !deckStatus(profile, d).playable) return false;
  profile.activeDeck = id;
  syncActiveDeck(profile);
  return true;
}

// 新しいデッキを作る。from: 'empty'（空）/ 'starter'（スターターデッキ）/ デッキの内容 { monsters, items, hero, skill }
// 作ったデッキを返す（10個あるときは null）
function addDeck(profile, from = 'empty', name) {
  if (profile.decks.length >= DECKS.MAX) return null;
  const src = from === 'starter' ? DEFAULT_DECK : from === 'empty' ? {} : from;
  const hero = profile.hero.unlocked.includes(src.hero) ? src.hero : profile.hero.selected;
  const deck = {
    id: nextDeckId(profile), name: cleanDeckName(name) || freeDeckName(profile),
    monsters: cleanDeckCards(src.monsters, true, CONFIG.DECK_MONSTERS), items: cleanDeckCards(src.items, false, CONFIG.DECK_ITEMS),
    hero, skill: heroSkillUnlocked(profile, hero, src.skill) ? src.skill : hero === profile.hero.selected && src.skill == null ? profile.hero.skill : 0,
  };
  profile.decks.push(deck);
  return deck;
}

// 複製する（元のすぐ下に入る）
function duplicateDeck(profile, id) {
  const src = deckById(profile, id);
  if (!src) return null;
  const copy = addDeck(profile, src, cleanDeckName(src.name + 'のコピー'));
  if (!copy) return null;
  profile.decks.splice(profile.decks.indexOf(copy), 1);
  profile.decks.splice(deckIndex(profile, id) + 1, 0, copy);
  return copy;
}

function renameDeck(profile, id, name) {
  const d = deckById(profile, id);
  const clean = cleanDeckName(name);
  if (!d || !clean) return false;
  d.name = clean;
  return true;
}

// 削除できるか。最後の1つは消せない。使用中のデッキは、ほかに対戦に使えるデッキがあるときだけ消せる
function canDeleteDeck(profile, id) {
  if (!deckById(profile, id)) return { ok: false, reason: 'デッキがありません' };
  if (profile.decks.length <= 1) return { ok: false, reason: '最後の1つは削除できません' };
  if (id === profile.activeDeck && !profile.decks.some(d => d.id !== id && deckStatus(profile, d).playable)) {
    return { ok: false, reason: 'ほかに対戦に使えるデッキがないので、削除できません' };
  }
  return { ok: true, reason: '' };
}

function deleteDeck(profile, id) {
  const can = canDeleteDeck(profile, id);
  if (!can.ok) return can;
  profile.decks.splice(deckIndex(profile, id), 1);
  if (profile.activeDeck === id) setActiveDeck(profile, profile.decks.find(d => deckStatus(profile, d).playable).id);
  return can;
}

// 並べ替え：dir = -1（上へ）/ +1（下へ）
function moveDeck(profile, id, dir) {
  const i = deckIndex(profile, id), j = i + dir;
  if (i < 0 || j < 0 || j >= profile.decks.length) return false;
  [profile.decks[i], profile.decks[j]] = [profile.decks[j], profile.decks[i]];
  return true;
}

// 編集した内容を保存する。未完成でも保存できるが、使用中のデッキだけは対戦に使える状態でないと保存できない
function saveDeckEdit(profile, id, edit) {
  const d = deckById(profile, id);
  if (!d) return { ok: false, reason: 'デッキがありません' };
  const next = {
    monsters: cleanDeckCards(edit.monsters, true, CONFIG.DECK_MONSTERS), items: cleanDeckCards(edit.items, false, CONFIG.DECK_ITEMS),
    hero: edit.hero == null ? d.hero : edit.hero, skill: edit.skill == null ? d.skill : edit.skill,
  };
  if (!heroSkillUnlocked(profile, next.hero, next.skill)) return { ok: false, reason: 'そのヒーロースキルは使えません' };
  if (id === profile.activeDeck && !deckStatus(profile, next).playable) {
    return { ok: false, reason: '使用中のデッキは、16枚そろえてから保存してください（ほかのデッキを使用中にすれば、未完成のまま保存できます）' };
  }
  Object.assign(d, next);
  if (id === profile.activeDeck) syncActiveDeck(profile);
  return { ok: true, reason: '' };
}

// ---------- 対戦前のデッキ選択 ----------

// そのモードで選べるデッキの一覧 [{ deck, ok, reason }]。event: イベント（色指定があれば、その色のモンスターだけのデッキに限る）
function deckChoices(profile, type, event) {
  const color = type === 'event' && event && event.rule.deckColor;
  return profile.decks.map(deck => {
    const st = deckStatus(profile, deck);
    let reason = '';
    if (!st.complete) reason = '未完成';
    else if (st.missing.length) reason = 'カードが足りません';
    else if (color && !deckIsColor(deck, color)) reason = `${COLORS[color].name}のモンスターだけではない`;
    return { deck, ok: !reason, reason };
  });
}

// 対戦を始められるか（いつも「使用中」のデッキで戦う）。
//   ok: 始められる　loaner: 貸し出しデッキで戦う（色指定のイベントで、使用中のデッキが条件に合わないとき）
//   reason: 始められない理由（使用中のデッキが未完成・カードが足りない）
function battleDeckCheck(profile, type, event) {
  const deck = activeDeck(profile);
  const st = deckStatus(profile, deck);
  if (!st.complete) return { ok: false, loaner: false, reason: `使用中のデッキ「${deck.name}」は未完成です（${st.monsters + st.items}/${CONFIG.DECK_MONSTERS + CONFIG.DECK_ITEMS}枚）` };
  if (st.missing.length) return { ok: false, loaner: false, reason: `使用中のデッキ「${deck.name}」は、カードが足りません（${st.missing.length}枚）` };
  const color = type === 'event' && event && event.rule.deckColor;
  return { ok: true, loaner: !!(color && !deckIsColor(deck, color)), reason: '' };
}

// デッキを切り替える：選んだデッキを「使用中」にする（対戦に使えるデッキだけ）
function chooseDeckForBattle(profile, type, id, event) {
  const c = deckChoices(profile, type, event).find(x => x.deck.id === id);
  return !!(c && c.ok && setActiveDeck(profile, id));
}

// ---------- デッキコード（共有用の短い文字列） ----------
// 形式： CM1-モンスターのid（3文字ずつ）-アイテムのid（3文字ずつ）-ヒーローid+スキル番号-確認用の2文字

function deckCodeCheck(body) {
  let sum = 7;
  for (let i = 0; i < body.length; i++) sum = (sum * 31 + body.charCodeAt(i) * (i + 1)) % 1296;
  return sum.toString(36).padStart(2, '0');
}

function deckToCode(deck) {
  const body = `${DECKS.CODE}-${deck.monsters.join('')}-${deck.items.join('')}-${deck.hero}${deck.skill}`;
  return `${body}-${deckCodeCheck(body)}`;
}

// コードを読む。{ ok, deck: { monsters, items, hero, skill }, error }
function deckFromCode(code) {
  const bad = error => ({ ok: false, deck: null, error });
  const text = String(code == null ? '' : code).replace(/\s+/g, '');
  if (!text) return bad('デッキコードを入力してください');
  const parts = text.split('-');
  if (parts.length !== 5 || parts[0] !== DECKS.CODE) return bad('デッキコードの形が正しくありません');
  if (deckCodeCheck(parts.slice(0, 4).join('-')) !== parts[4].toLowerCase()) return bad('デッキコードが壊れています（一部が欠けているか、書きかえられています）');
  const cut = s => (s.length % 3 === 0 ? s.match(/.{3}/g) || [] : null);
  const monsters = cut(parts[1]), items = cut(parts[2]);
  const hm = /^([a-z]+)(\d)$/.exec(parts[3]);
  if (!monsters || !items || !hm || !HERO_BY_ID[hm[1]] || !HERO_BY_ID[hm[1]].skills[Number(hm[2])]) return bad('デッキコードの中身が正しくありません');
  const okCards = (ids, monster, max) => ids.length <= max
    && ids.every(id => CARD_DEFS[id] && (CARD_DEFS[id].kind === 'monster') === monster && deckCount(ids, id) <= copyLimit(id));
  if (!okCards(monsters, true, CONFIG.DECK_MONSTERS) || !okCards(items, false, CONFIG.DECK_ITEMS)) return bad('デッキコードに、このゲームにないカードが入っています');
  return { ok: true, deck: { monsters, items, hero: hm[1], skill: Number(hm[2]) }, error: '' };
}

// コードから新しいデッキを作る。{ ok, deck, missing: 持っていないカード, heroChanged: ヒーローを使えず今のヒーローにした, error }
function importDeck(profile, code) {
  const r = deckFromCode(code);
  if (!r.ok) return { ok: false, deck: null, missing: [], error: r.error };
  if (profile.decks.length >= DECKS.MAX) return { ok: false, deck: null, missing: [], error: `デッキは${DECKS.MAX}個までです。先にどれかを削除してください` };
  const deck = addDeck(profile, r.deck, '読み込んだデッキ');
  return { ok: true, deck, missing: deckStatus(profile, deck).missing, heroChanged: deck.hero !== r.deck.hero || deck.skill !== r.deck.skill, error: '' };
}
