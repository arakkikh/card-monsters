// ============================================================
// 攻略本（guide.html）の内容が、ゲームのデータ・ゲームの動きと合っているかを確かめる
//   ./build-guide.sh の最後に自動で実行される。単独でも実行できる（build-guide.sh の最後の行を参照）
// ============================================================
const html = read('guide.html');
let checks = 0;
const errors = [];
const ok = (cond, msg) => { checks++; if (!cond) errors.push(msg); };
const attr = (name, re = '[^"]*') => { const out = []; const rx = new RegExp(name + '="(' + re + ')"', 'g'); let m; while ((m = rx.exec(html))) out.push(m[1]); return out; };
const blockOf = (marker, len = 6000) => { const i = html.indexOf(marker); return i < 0 ? '' : html.slice(i, i + len); };

// 1. カード：全カードが載っていて、レベルごとの数値・スキルがゲームのデータと同じ
const cardIds = attr('data-card', '[a-z][0-9]{2}');
ok(new Set(cardIds).size === allCards.length && allCards.every(c => cardIds.includes(c.id)), `カードの数：攻略本${new Set(cardIds).size}・ゲーム${allCards.length}`);
for (const c of allCards) {
  const b = blockOf(`id="card-${c.id}"`);
  const m = /data-stats="([^"]*)"/.exec(b);
  ok(!!m, c.id + '：数値の欄がない');
  if (!m) continue;
  const rows = m[1].replace(/&quot;/g, '"').split('|');
  ok(rows.length === maxLevel(c.id), c.id + '：レベルの数');
  rows.forEach((row, i) => {
    const x = cardAt(c.id, i + 1);
    const want = [x.level, x.cost, x.atk == null || typeof x.atk === 'object' ? JSON.stringify(x.atk || null) : x.atk, x.hp || 0, x.armor || 0, (x.skills || []).map(k => k.id + (k.x === undefined ? '' : k.x)).join('+')].join(':');
    ok(row === want, `${c.id} Lv${i + 1}：攻略本「${row}」・ゲーム「${want}」`);
  });
  ok(b.includes(esc(c.name)), c.id + '：名前');
  // 表に出ている文字（コスト・攻撃/HP）も確かめる
  const one = cardAt(c.id, 1);
  if (c.kind === 'monster') ok(b.includes(`<td>${one.cost}</td><td>${one.atk}/${one.hp}`), c.id + '：Lv1の表示');
}
// 2. スキル：全スキルの説明文が、ゲームの説明と同じ
const skillIds = attr('data-skill', '[a-z]+');
ok(skillIds.length === Object.keys(SKILLS).length, `スキルの数：攻略本${skillIds.length}・ゲーム${Object.keys(SKILLS).length}`);
for (const id of Object.keys(SKILLS)) {
  const m = new RegExp(`data-desc="${id}">([^<]*)<`).exec(html);
  ok(m && m[1] === esc(SKILLS[id].desc('X')), id + '：スキルの説明');
}
// 3. ステージ：地形・カードレベル・補正
const stageIds = attr('data-stage', '[0-9]-[0-9]+');
ok(new Set(stageIds).size === STAGES.length, `ステージの数：攻略本${new Set(stageIds).size}・ゲーム${STAGES.length}`);
for (const st of STAGES) {
  const m = new RegExp(`data-stage="${st.id}" data-stage-info="([^"]*)"`).exec(html);
  ok(m && m[1] === [st.terrain, st.level, st.bonus || 0, st.income || 0].join(':'), st.id + '：ステージの情報');
  ok(html.includes(esc(st.enemy)), st.id + '：相手の名前');
}
// 4. パックの値段と排出率
for (const m of html.matchAll(/data-pack="([^"]*)" data-pack-info="([^"]*)"/g)) {
  const t = packType(m[1]); const r = packRatesOf(t);
  ok(m[2] === [t.price.gold || 0, t.price.stones || 0, RARITY_ORDER.map(k => r[k]).join('/'), t.guarantee || 1].join(':'), m[1] + '：パックの情報');
}
// 5. パズル：全問が載っていて、答えはたたんである
const pzIds = attr('data-puzzle', '[a-z][0-9]{2}');
ok(pzIds.length === PUZZLES.length && PUZZLES.every(p => pzIds.includes(p.id)), 'パズルの数');
for (const p of PUZZLES) { const b = blockOf(`id="puzzle-${p.id}"`, 3000); ok(b.includes(esc(p.hints[0])) && b.includes(esc(p.hints[1])) && b.indexOf('<details>') > 0 && b.indexOf('<details>') < b.indexOf('<ol>'), p.id + '：ヒントと、たたんだ答え'); ok(runPuzzle(p, p.solution).result === 'win', p.id + '：答えで解ける'); }
// 6. おすすめデッキ：デッキコードをゲームに読み込める。読み込むと、載せたとおりのデッキになり、対戦に使える
const codes = attr('data-deck-code', '[^"]*');
ok(codes.length === GDECKS.length && codes.length >= 10, `デッキの数：${codes.length}`);
const owner = newProfile();
allCards.forEach(c => { owner.cards[c.id] = { level: maxLevel(c.id), copies: 0 }; });
owner.hero.unlocked = HEROES.map(h => h.id); HEROES.forEach(h => { owner.hero.levels[h.id] = HERO_RULES.MAX_LEVEL; });
codes.forEach((code, i) => {
  const d = GDECKS[i];
  const parsed = deckFromCode(code);
  ok(parsed.ok, `${d.name}：デッキコードが読めない（${parsed.error}）`);
  if (!parsed.ok) return;
  ok(JSON.stringify([parsed.deck.monsters, parsed.deck.items]) === JSON.stringify([d.deck.monsters, d.deck.items]), d.name + '：コードの中身が、載せたデッキと違う');
  owner.decks = owner.decks.slice(0, 1);
  const r = importDeck(owner, code);
  ok(r.ok && !r.missing.length && !r.heroChanged && deckStatus(owner, r.deck).playable, d.name + '：読み込んだデッキが対戦に使えない');
  ok(r.ok && setActiveDeck(owner, r.deck.id) && deckIsValid(owner, owner.deck), d.name + '：使用中にできない');
  const from = html.indexOf(`id="deck-${i}"`), next = html.indexOf(`id="deck-${i + 1}"`, from);
  const b = html.slice(from, next < 0 ? html.indexOf('</section>', from) : next);
  ok([...new Set([...d.deck.monsters, ...d.deck.items])].every(id => b.includes(`href="#card-${id}"`)), d.name + '：カードの表示');
});
// 7. ルールの図：同じ盤面をゲームの処理で動かし、ルールどおりの結果になること・攻略本にその結果が書かれていること
const scene = id => RULE_SCENES.find(s => s.id === id);
const atk = id => sceneAttacks(scene(id)).attacks.filter(a => !a.skip);
ok(JSON.stringify(atk('order').map(a => a.from)) === '[2,1,0]', '図：攻撃はスロット3 → 2 → 1 の順');
ok(atk('melee').length === 0 && sceneAttacks(scene('melee')).idle.length === 2, '図：前列の遠隔・後列の近接は攻撃できない');
const mg = atk('magic'), foeName = (id, i) => cardAt(typeof scene(id).foe[i] === 'string' ? scene(id).foe[i] : scene(id).foe[i].id).name;
ok(mg.find(a => a.from === 1).to === foeName('magic', 1) && mg.find(a => a.from === 2).to === foeName('magic', 0), '図：魔法は正面。いなければ前列');
const rg = atk('ranged');
ok(rg.find(a => a.from === 2).to === foeName('ranged', 1) && rg.find(a => a.from === 1).to === foeName('ranged', 2), '図：遠隔は対角');
ok(atk('taunt').find(a => a.type === 'ranged').to === foeName('taunt', 0), '図：Taunt 持ちに向かう');
const cp = atk('compact');
ok(cp.length === 2 && cp[0].killed && cp[0].to === foeName('compact', 0) && cp[1].to === foeName('compact', 1), '図：倒すと詰めて、追加攻撃はその相手に当たる');
const ar = atk('armor');
ok(ar.find(a => a.type === 'magic').dmg > 0 && ar.find(a => a.type === 'magic').armorDmg === 0 && ar.find(a => a.type === 'melee').dmg === 0 && ar.find(a => a.type === 'melee').armorDmg > 0, '図：魔法はアーマー無視、物理はアーマーで止まる');
ok(atk('thorns')[0].extras.some(x => x.kind === 'thorns' && x.dmg === 2), '図：Thorns 2');
for (const sc of RULE_SCENES) ok(html.includes(sceneResultHtml(sc)), '図「' + sc.title + '」：攻略本の結果が、ゲームの処理の結果と違う');
// 8. 本文に書いた決まりごとの数字（ゲームの設定から書いているが、念のため本文の文字でも確かめる）
for (const text of [`モンスター${CONFIG.DECK_MONSTERS}枚＋アイテム${CONFIG.DECK_ITEMS}枚`, `ターン${CONFIG.ATTRITION_START}から`, `1パック${GROWTH.PACK_SIZE}枚`, `ターン${CONFIG.SECOND_PLAYER_LATE.turn}`, `同じカードは${CONFIG.DECK_COPIES}枚まで、レジェンドは${CONFIG.DECK_COPIES_LEGEND}枚まで`]) ok(html.includes(text), '本文：「' + text + '」');
// 9. 章・検索・印刷用レイアウトがそろっている。おかしな文字（undefined・NaN）がない
ok((html.match(/<section class="chap"/g) || []).length === 13, '章の数（12章＋付録）');
ok(html.includes('@media print') && html.includes('break-inside: avoid') && html.includes('break-before: page'), '印刷用レイアウト');
ok(html.includes('id="q"') && attr('data-search').length > 250, '検索の対象');
const text = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script>[\s\S]*?<\/script>/, '').replace(/<svg[\s\S]*?<\/svg>/g, '');
ok(!/undefined|NaN|\[object/.test(text), 'おかしな文字がある: ' + (/.{30}(undefined|NaN|\[object).{30}/.exec(text) || [''])[0].replace(/\s+/g, ' '));
ok((html.match(/根拠：/g) || []).length >= 15, 'シミュレーションの根拠の表示');

if (errors.length) { print(`攻略本の確認：${errors.length}件の食い違い（${checks}項目中）`); errors.slice(0, 30).forEach(e => print('  ✗ ' + e)); }
else print(`攻略本の確認：OK（${checks}項目すべて、ゲームのデータ・動きと一致）`);
