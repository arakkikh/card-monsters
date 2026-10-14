// ============================================================
// 攻略本の本文（章ごと）。build-lib.js の道具を使って、HTMLを標準出力に書き出す
// ============================================================

const C = CONFIG, GR = GROWTH;
const table = (head, rows, cls = '') => `<div class="tw keep"><table class="${cls}"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const box = (title, body, cls = '') => `<div class="box keep ${cls}"><b class="box-t">${title}</b>${body}</div>`;
const li = list => `<ul>${list.map(x => `<li>${x}</li>`).join('')}</ul>`;
const cardLink = id => `<a href="#card-${id}" class="cl c-${CARD_DEFS[id].color || 'none'}">${esc(CARD_DEFS[id].name)}</a>`;
const skillLink = id => `<a href="#skill-${id}" class="sl">${SKILLS[id].icon}${SKILLS[id].name}</a>`;
const stageName = st => `${st.id} ${st.boss ? '👑' : ''}${esc(st.enemy)}`;
const terr = id => (TERRAIN_BY_ID[id] ? `${TERRAIN_BY_ID[id].icon}${TERRAIN_BY_ID[id].name}` : 'なし');
const byRate = (a, b) => (rankOf(b).rate || 0) - (rankOf(a).rate || 0);
const bestOf = (list, n) => list.slice().sort((a, b) => byRate(a.id, b.id)).slice(0, n);
const fmt = x => (x == null ? '-' : `${x}%`);
const S3 = SIM.a.cards3, S1 = SIM.a.cards1;

const CHAPS = [];
function chapter(id, title, body) { CHAPS.push({ id, title, body }); }

// ---------- 1. はじめに ----------
(() => {
  const starter = [...DEFAULT_DECK.monsters, ...DEFAULT_DECK.items];
  const commons = bestOf(allCards.filter(c => c.rarity === 'common' && !c.elite), 6);
  const st = SIM.c.stages.slice(0, 10);
  chapter('intro', '1. はじめに', `
    <p>Card Monsters は、<b>モンスター${C.DECK_MONSTERS}枚＋アイテム${C.DECK_ITEMS}枚</b>のデッキで戦う、1人用のカードバトルです。相手のモンスターを、<b>場・手札・山札のすべてからいなくすれば勝ち</b>です。</p>
    <h3>1試合の流れ</h3>
    <div class="flow keep"><div><b>① コイントス</b><span>先攻・後攻が決まる。後攻は最初のクリスタル+${C.SECOND_PLAYER_BONUS}、ターン${C.SECOND_PLAYER_LATE.turn}にも+${C.SECOND_PLAYER_LATE.bonus}</span></div><i>→</i>
      <div><b>② 自分のターン開始</b><span>クリスタル+${C.CRYSTALS_PER_TURN}、カードを1枚引く。開始時スキル（Heal・Inspire など）が発動</span></div><i>→</i>
      <div><b>③ カードを使う</b><span>モンスターを出す・装備を付ける・フラッシュを使う・生贄（1ターン1回）</span></div><i>→</i>
      <div><b>④ ターン終了＝攻撃</b><span>自分のモンスターが、スロット3 → 2 → 1 の順に自動で攻撃</span></div><i>→</i>
      <div><b>⑤ 相手のターン</b><span>同じ流れ。これをくり返す</span></div></div>
    <p>最初の手札は${C.INITIAL_HAND}枚。使わなかったクリスタルは次のターンに持ち越せます。試合の長さは、平均で${S3.avgTurns}ターン（最長${S3.maxTurns}ターン）でした。${src(S3.games, '試合（CPU同士・カードLv3・ランダムなデッキ）')}</p>
    <h3>初心者がまずやること</h3>
    ${li([
    `<b>ホームの「バトル」を押して、1章を進める。</b>1-1〜1-3 は入門ステージで、相手が毎ターンもらえるクリスタルが1個少なくなっています。`,
    `<b>勝つたびに通常パックが${GR.PACKS_WIN}つもらえる</b>ので、下の「パック」タブで開けてカードを増やします（1パック${GR.PACK_SIZE}枚）。`,
    `プレイヤーLv${GR.UNLOCK.free}でフリー対戦、Lv${GR.UNLOCK.daily}でデイリークエスト・分解・作成、Lv${GR.UNLOCK.upgrade}でカードの強化、Lv${GR.UNLOCK.event}でイベントが解放されます。`,
    `<b>1-5 をクリアすると${packType(PACK_SHOP.CHAPTER_COLOR[1]).name}</b>、ボスの 1-10 をクリアすると高級パックと、新しいヒーロー（${HEROES.find(h => h.unlock === '1-10').name}）がもらえます。`,
    `手持ちが増えたら、<a href="#decks">第5章のおすすめデッキ</a>の「初心者向け」をデッキコードで読み込むと、すぐ試せます。`,
  ])}
    <h3>最初の10ステージの目安</h3>
    <p>下の表は、1章に来たころのデッキ（コモンだけ・カードLv1をランダムに組んだもの）での勝率です。勝率が低いのは ${st.slice().sort((a, b) => a.ref - b.ref).slice(0, 2).map(r => `${r.id}（${r.ref}%）`).join(' と ')} です。そこまでにパックを開けて、デッキを強くしておきましょう。</p>
    ${table(['ステージ', '相手', '地形', '勝率', '★3が取れた割合'], st.map(r => { const s = STAGE_BY_ID[r.id]; return [s.id + (s.boss ? ' 👑' : ''), esc(s.enemy), terr(s.terrain), pctBar(r.ref), fmt(r.star3)]; }))}
    <p>${src(SIM.c.refGames, '試合ずつ（CPU同士。自分側は毎回ランダムに組んだコモンのデッキ）')}</p>
    <h3>最初に強化するカード</h3>
    <p>強化はプレイヤーLv${GR.UNLOCK.upgrade}から。同じカードの予備（パックで重なったぶん）とゴールド・魔石を使います。コモンは費用が安いので、<b>よく使うコモン</b>から上げるのが効率的です。下は、コモンの中で「入れたデッキの勝率」が高かった6枚です。</p>
    <div class="cards">${commons.map(c => miniCard(c.id, 1, rankBadge(c.id))).join('')}</div>
    <p>${src(S3.games, '試合（カードLv3）。ランクの見方は<a href="#cards">第4章</a>')}</p>
    <p class="note">スターターデッキ：${starter.map(cardLink).join('、')}</p>`);
})();

// ---------- 2. 基本ルール ----------
chapter('rules', '2. 基本ルール', `
  <h3>場とスロット</h3>
  <p>場は3スロット。<b>スロット1が前列（中央）</b>、スロット2（左）とスロット3（右）が後列です。モンスターは必ず前から詰めて並びます。</p>
  ${table(['スロット', '攻撃できる種類'], [['1（前列）', `${ATTACK_TYPES.melee.icon}近接・${ATTACK_TYPES.magic.icon}魔法・${ATTACK_TYPES.chaos.icon}カオス`], ['2・3（後列）', `${ATTACK_TYPES.ranged.icon}遠隔・${ATTACK_TYPES.magic.icon}魔法・${ATTACK_TYPES.chaos.icon}カオス`]])}
  <p>つまり、<b>近接は前列、遠隔は後列</b>に置かないと攻撃できません（${skillLink('reach')} があれば、後列からでも近接攻撃ができます）。</p>
  <h3>攻撃の順番と狙う相手</h3>
  ${li([
  `<b>モンスターの順番</b>：スロット3 → 2 → 1。`,
  `<b>1体が複数の攻撃を持つとき</b>（装備で攻撃の種類が増えたとき）：魔法 → カオス → 遠隔 → 近接 の順。`,
  `<b>近接</b>：相手の前列。`,
  `<b>遠隔</b>：対角 → 正面 → 前列の順（スロット2からは相手のスロット3、スロット3からは相手のスロット2が先）。${skillLink('taunt')} 持ちがいれば、そちらが最優先。`,
  `<b>魔法</b>：正面（同じ番号のスロット）。いなければ前列。`,
  `<b>カオス</b>：ランダムな相手1体。ダメージも 1〜攻撃力 のランダム。固定ダメージなので、アーマーや盾を無視します。`,
  `後列にいる ${skillLink('stealth')} 持ちは、遠隔と魔法では狙えません。`,
])}
  ${RULE_SCENES.slice(0, 5).map(ruleSceneHtml).join('')}
  <h3>詰めと押し出し</h3>
  <p>モンスターがいなくなると、後ろのモンスターが前に詰めます（2→1、3→2）。モンスターがいるスロットに新しく出すと、そこから後ろが1つずつ後ろへ<b>押し出されます</b>。攻撃できない並びは、押し出しで直せます。</p>
  ${ruleSceneHtml(RULE_SCENES[5])}
  <h3>アーマーとブロック</h3>
  ${li([
  `物理ダメージ（近接・遠隔）は、まず<b>アーマー</b>を削ります。アーマーを壊したときの余りは消えます（${skillLink('piercing')} があればHPに届く）。`,
  `<b>魔法ダメージはアーマーを無視</b>します。カオスの固定ダメージも、アーマーを素通りします。`,
  `アーマーが残っているモンスターは、遠隔攻撃を<b>${Math.round(C.RANGED_BLOCK_CHANCE * 100)}%</b>の確率でブロックします。`,
  `${skillLink('flying')} 持ちは、近接を${Math.round(C.FLYING_DODGE_MELEE * 100)}%、遠隔を${Math.round(C.FLYING_DODGE_RANGED * 100)}%の確率で回避します（攻撃側が Flying か ${skillLink('antiair')} を持っていれば回避されません。魔法とカオスも回避されません）。`,
])}
  ${ruleSceneHtml(RULE_SCENES[6])}${ruleSceneHtml(RULE_SCENES[7])}
  <h3>クリスタルに関するルール</h3>
  ${table(['できごと', 'クリスタル'], [
    ['自分のターン開始', `+${C.CRYSTALS_PER_TURN}`], ['後攻のボーナス', `最初に+${C.SECOND_PLAYER_BONUS}、ターン${C.SECOND_PLAYER_LATE.turn}の開始時に+${C.SECOND_PLAYER_LATE.bonus}`],
    ['生贄（1ターンに1回。手札・場を合わせて）', `アイテム+${C.SACRIFICE_ITEM}、モンスター+${C.SACRIFICE_MONSTER}（生贄にしたカードは試合から取り除かれる）`],
    ['自分のモンスターが場で倒された', `+${C.FALLEN_CRYSTAL}（相手のターン中でもすぐ入る。生贄・山札に戻る・Phantom の分身では入らない）`],
  ])}
  <h3>負けにつながるルール</h3>
  ${li([
    `<b>場が空のペナルティ</b>：自分のターンが終わったとき、自分の場にモンスターが1体もいないと、手札と山札の中からランダムに1枚が捨てられます。`,
    `<b>消耗ダメージ</b>：ターン${C.ATTRITION_START}から、各ターンの開始時に、場のモンスター全員（両者）がダメージを受けます。最初は1で、${C.ATTRITION_STEP}ターンごとに+1。アーマーや盾を無視します。`,
    `<b>勝敗</b>：場・手札・山札のどこにもモンスターがいなくなった側の負け。両者が同時にいなくなったら、そのターンの手番側の勝ち。`,
  ])}
  <p>先攻の勝率は${S3.firstWin}%でした${Math.abs(S3.firstWin - 50) <= 2 ? '（ほぼ五分）' : S3.firstWin > 50 ? '（先攻がやや有利）' : '（後攻がやや有利）'}。${src(S3.games, '試合（CPU同士・カードLv3）')}</p>`);

// ---------- 3. スキル大全 ----------
(() => {
  const skills = DICT.filter(e => e.group === 'skill');
  const statuses = DICT.filter(e => e.group === 'status');
  const skillRate = Object.fromEntries(S3.skills.map(s => [s.key, s]));
  const holders = id => allCards.filter(c => (CARD_DEFS[c.id].levels || []).some(l => (l.skills || []).some(k => k.id === id)) || (CARD_DEFS[c.id].options || []).some(k => k.id === id));
  const entry = e => {
    const h = holders(e.id);
    const r = skillRate[e.id];
    return `<div class="sk keep" id="skill-${e.id}" data-search="${esc(e.name + ' ' + e.ja + ' ' + e.yomi)}" data-kind="スキル" data-skill="${e.id}">
      <div class="sk-h"><span class="sk-i">${e.icon}</span><b>${e.name}</b><small>${e.ja}</small>${r ? `<span class="sk-r" title="そのスキルのカードが入っていたデッキの勝率">${r.rate}%</span>` : ''}</div>
      <p class="sk-d" data-desc="${e.id}">${esc(SKILLS[e.id].desc('X'))}</p>
      <p class="sk-w">発動：${esc(e.when || '')}</p>
      ${h.length ? `<p class="sk-c">持っているカード：${h.slice(0, 8).map(c => cardLink(c.id)).join('、')}${h.length > 8 ? ` ほか${h.length - 8}枚` : ''}</p>` : ''}
      ${e.rel && e.rel.length ? `<p class="sk-c">関連：${e.rel.filter(k => k.startsWith('skill:') && SKILLS[k.slice(6)]).map(k => skillLink(k.slice(6))).join('　')}</p>` : ''}</div>`;
  };
  const cats = Object.keys(DICT_CATS).map(cat => { const list = skills.filter(e => e.cat === cat); return list.length ? `<h4>${DICT_CATS[cat]}のスキル（${list.length}）</h4><div class="sks">${list.map(entry).join('')}</div>` : ''; }).join('');
  const startOrder = ['rearguard', 'vanguard', 'steadyaim', 'dive', 'groupdive', 'cleanse', 'masscleanse', 'regenerate', 'heal', 'groupheal', 'mendingaura', 'healingshield', 'poisonhalo', 'trickery', 'inspire', 'shoot', 'antimagic', 'demoralize', 'suppress', 'jinx', 'toxicfog', 'entangle'];
  const hitOrder = ['magicreflect', 'deflect', 'staticguard', 'outbreak', 'scorch', 'disease', 'magicblast', 'echo', 'trample', 'luckyshot', 'leech', 'keeneye', 'thorns', 'shieldspike', 'crosscounter', 'counter', 'magiccounter', 'opportunity', 'doublestrike', 'swallow', 'harvest'];
  const combos = SIM.a.combos.pairs;
  const hv = SIM.a.healVsDisease;
  const COMBO_NOISE = 3;
  const comboGood = combos.filter(p => p.synergy > COMBO_NOISE), comboBad = combos.filter(p => p.synergy < -COMBO_NOISE);
  chapter('skills', '3. スキル大全', `
    <p>スキルは全部で${skills.length}種類。説明文の <b>X</b> はカードごとの数値です。右上の%は、そのスキルを持つカードが入っていたデッキの勝率です。${src(S3.games, '試合（カードLv3・ランダムなデッキ）')}</p>
    ${cats}
    <h3>状態異常と強化</h3>
    ${table(['状態', '効果', '補足'], statuses.map(e => [`${e.icon} ${e.name}`, esc(e.desc), esc(e.note || '')]))}
    <h3>発動順の早見表</h3>
    ${box('自分のターン開始時（上から順）', `<p>${startOrder.filter(id => SKILLS[id]).map(skillLink).join(' → ')}</p><p class="note">全体にかかる強化・弱体（Inspire・Shoot Command・Anti-Magic Shield・Demoralize・Suppress Magic）は、<b>いちばん強いものだけ</b>が効きます（重ねがけはできません）。Disease 状態のモンスターは、Inspire・Shoot Command・Demoralize・Suppress Magic・Trickery を使えません。Silence 状態では Heal・Group Heal と魔法攻撃が使えません。拘束（Entangle）されているあいだは、すべてのスキルを失います。</p>`)}
    ${box('攻撃1回の中（上から順）', `<p>対象の決定 → 回避（${skillLink('flying')}）→ ブロック → ダメージの計算（カオスの乱数・${skillLink('trickery')}・${skillLink('antiair')}・${skillLink('bombard')}・${skillLink('ambush')}・${skillLink('exploit')}）→ ダメージ（${skillLink('fog')}・盾・アーマー。${skillLink('sunder')} はアーマーを無視）→ ${hitOrder.map(skillLink).join(' → ')}</p><p class="note">攻撃を受けずに返すスキル（Magic Reflect・Deflect・Static Guard）が発動したときは、ダメージも、そのあとの効果も起きません。倒されたときのスキル（${skillLink('partinggift')}・${skillLink('finalbow')}）は、倒された直後に発動します。${skillLink('laststand')} は、倒される直前に発動して、倒されるのを防ぎます。</p>`)}
    ${box('自分のターン終了時', `<p>${skillLink('outbreakhalo')} → Disease のダメージ（自分のモンスターが、スタック数ぶんの魔法ダメージを受ける）→ 燃焼のダメージ（両者のモンスター。スタック数ぶんの魔法ダメージを受け、スタックが1減る）→ 拘束・Silence・Stall が解ける → 場が空のペナルティ</p>`)}
    <h3>スキル同士の相性</h3>
    <h4>ルール上そうなるもの（処理の順番から決まる）</h4>
    ${li([
    `${skillLink('fear')} ＋ ${skillLink('menace')}：Fear 持ちを場に出すと、相手の前列と後列が入れ替わり、位置が変わった2体に Menace のダメージが入ります。倒して詰めさせたときにも Menace は発動します。`,
    `${skillLink('disease')} ＋ ${skillLink('outbreak')}：Outbreak は、相手の Disease のスタック数ぶんの追加魔法ダメージを与えます（スタックは減りません）。Disease 状態のモンスターは、自分のターン終了時にもスタック数ぶんの魔法ダメージを受けるので、スタックをためるほど、毎ターンのダメージが増えます。`,
    `${skillLink('disease')} と ${skillLink('heal')}：Disease 状態のモンスターへの回復は、まずスタックを減らすのに使われ、残りでHPが回復します。`,
    `${skillLink('disease')} と ${skillLink('magicreflect')}：Magic Reflect は、Disease 状態のあいだ使えません。`,
    `${skillLink('seethrough')}：攻撃のとき（近接だけでなく、遠隔・魔法・カオスでも）、相手の Counter-Attack・Cross-Counter-Attack・Flying・Fog・Opportunity・Shield・Thorns を無視します。`,
    `${skillLink('batter')}・${skillLink('doublestrike')} と ${skillLink('thorns')}：近接の回数が増えるほど、Thorns で受けるダメージも増えます。`,
    `${skillLink('inspire')} と ${skillLink('fear')}：Inspire を受けているモンスターは、Fear で動かされません。`,
    `${skillLink('shoot')}：Shoot Command を受けているあいだ、遠隔攻撃はアーマーにブロックされません。`,
    `${skillLink('perseverance')}：Disease・Entangle・Silence・Demoralize・Suppress Magic・Jinx・Stall・燃焼を受けません。`,
    `${skillLink('regenerate')}・${skillLink('heal')} ＋ ${skillLink('bloom')}：Bloom 持ちは、回復されるたびに攻撃力と最大HPが育ちます。Regenerate と一緒に持っていれば、傷つくたびに自分で育ちます。`,
    `永続で育つスキル（${skillLink('grudge')}・${skillLink('keeneye')}・${skillLink('bloom')}・${skillLink('leech')}）は、1体につき合計+${C.GROW_CAP}までです。`,
    `${skillLink('scorch')}・${skillLink('disease')} ＋ ${skillLink('exploit')}：Exploit は、相手の状態異常の種類の数だけ魔法ダメージが増えます。`,
    `${skillLink('trickery')} ＋ ${skillLink('luckyshot')}：Trickery でカオスが最大値になるので、Lucky Shot が必ず発動します。`,
    `${skillLink('toxicfog')}・${skillLink('groupdisease')} ＋ ${skillLink('plagueburst')}：Plague Burst は、ためた Disease のスタック数に応じたダメージを、スタックを減らさずに与えます。`,
    `${skillLink('terminate')}：Terminate で倒したモンスターの、倒されたときのスキル（Parting Gift・Final Bow）は発動しません。Last Stand も効きません。`,
  ])}
    <h4>勝率で確かめた組み合わせ</h4>
    <p>「Aを持つカード」と「Bを持つカード」を1枚ずつ、ランダムなデッキに入れたときの勝率です。<b>上乗せ</b>は「両方入り −（Aだけ）−（Bだけ）＋（どちらもなし）」で、プラスなら一緒に入れる意味がある、という見方をします。</p>
    ${table(['組み合わせ', '両方入り', 'Aだけ', 'Bだけ', 'どちらもなし', '上乗せ'], combos.map(p => [`${skillLink(p.a)} ＋ ${skillLink(p.b)}`, fmt(p.both), fmt(p.onlyA), fmt(p.onlyB), fmt(p.none), `${p.synergy > 0 ? '+' : ''}${p.synergy}`]))}
    <p>${src(SIM.a.combos.games, '試合ずつ（カードLv3）')}</p>
    <p class="note"><b>読み方の注意</b>：1つの数字には±1ポイントほど、上乗せには±2ポイントほどの誤差があります（上乗せが±${COMBO_NOISE}以内なら、差があるとは言えません）。${comboGood.length ? `この測り方で上乗せがはっきり出たのは、${comboGood.map(p => `${SKILLS[p.a].name}＋${SKILLS[p.b].name}（+${p.synergy}）`).join('、')}です。` : 'この測り方では、<b>はっきりした上乗せが出た組み合わせはありませんでした</b>。'}${comboBad.length ? `逆に、${comboBad.map(p => `${SKILLS[p.a].name}＋${SKILLS[p.b].name}（${p.synergy}）`).join('、')}は、一緒に入れると勝率が下がりました。` : ''}1枚ずつ入れただけでは、2枚が同時に場にそろう試合が少ないので、組み合わせの効果は数字に出にくくなります。活かすには、同じカードを2枚入れる、役割の同じカードを何枚か入れるなど、そろいやすくする工夫が必要です。</p>
    <p class="note">Heal 持ちを入れたデッキの勝率は、Disease 持ちを入れた相手に${hv.vsDisease}%、入れていない相手に${hv.vsNormal}%でした（${Math.abs(hv.vsDisease - hv.vsNormal) < 3 ? '差は誤差の範囲' : hv.vsDisease < hv.vsNormal ? 'Disease 持ちの相手に弱い' : 'Disease 持ちの相手でも下がらない'}）。${src(hv.games, '試合ずつ')}</p>`);
})();

// ---------- 4. カード図鑑 ----------
(() => {
  const packsOf = c => {
    if (CARD_DEFS[c.id].elite) { const ev = EVENTS.filter(e => e.elite === c.id); return `イベント「${ev.map(e => e.name).join('」「')}」で3勝（パックからは出ない）`; }
    const list = ['通常パック', c.kind === 'monster' ? 'モンスターパック' : 'アイテムパック', '高級パック'];
    if (c.color) list.push(`${COLORS[c.color].name}のパック`); else if (c.kind !== 'monster') list.push('すべての色のパック');
    return list.join('・') + '、または魔石で作成';
  };
  const entry = c => {
    const def = CARD_DEFS[c.id];
    const r = rankOf(c.id);
    const lv = def.levels.map((x, i) => cardAt(c.id, i + 1));
    const stat = x => (x.kind === 'monster' ? `${x.atk}/${x.hp}${x.armor ? `/🛡️${x.armor}` : ''}` : statsText(x) || '-');
    const rows = lv.map(x => [`Lv${x.level}`, x.cost, stat(x), skillsText(x.skills) || '-']);
    const one = cardAt(c.id, 1);
    return `<div class="cd keep c-${c.color || 'none'}" id="card-${c.id}" data-search="${esc(c.name)}" data-kind="カード" data-card="${c.id}" data-stats="${esc(lv.map(x => [x.level, x.cost, x.atk == null || typeof x.atk === 'object' ? JSON.stringify(x.atk || null) : x.atk, x.hp || 0, x.armor || 0, (x.skills || []).map(k => k.id + (k.x === undefined ? '' : k.x)).join('+')].join(':')).join('|'))}">
      <div class="cd-h"><span class="cd-art">${cardArt(one)}</span><div><b>${esc(c.name)}</b>${rankBadge(c.id)}<br><small><span class="r-${c.rarity}">${R[c.rarity].name}</span>・${colorName(c.color)}・${kindName[c.kind]}${c.kind === 'monster' ? `・${ATTACK_TYPES[c.type].icon}${ATTACK_TYPES[c.type].name}` : ''}${def.elite ? '・<b class="elite-t">Elite</b>' : ''}</small>
        <br><small>採用時の勝率：${r.rate == null ? '測定なし' : `<b>${r.rate}%</b>（${r.n}試合）`}${RATE1[c.id] ? `　Lv1では${RATE1[c.id].rate}%` : ''}</small></div></div>
      ${table(['', 'コスト', c.kind === 'monster' ? '攻撃/HP' : '効果', 'スキル'], rows, 'lv')}
      ${def.options ? `<p class="cd-o">選択スキル（Lv${def.optionLevel}から1つ選べる）：${def.options.map(k => skillTag(k.id, k.x)).join(' ／ ')}</p>` : ''}
      <p class="cd-o">入手：${packsOf(c)}</p></div>`;
  };
  const group = (title, list) => `<h4>${title}（${list.length}枚）</h4><div class="cds">${list.map(entry).join('')}</div>`;
  const colorRows = Object.keys(COLORS).map(col => {
    const r3 = S3.colors.find(x => x.key === col), r1 = S1.colors.find(x => x.key === col);
    const top = bestOf(MONSTERS.filter(m => m.color === col), 3);
    return [`<b class="c-${col} color-name">${COLORS[col].name}</b>`, COLORS[col].theme, fmt(r1 && r1.rate), fmt(r3 && r3.rate), top.map(m => cardLink(m.id)).join('、')];
  });
  const ranked = allCards.filter(c => rankOf(c.id).rate != null);
  const rankList = ['S', 'A', 'B', 'C'].map(k => { const l = ranked.filter(c => rankOf(c.id).rank === k).sort((a, b) => byRate(a.id, b.id)); return [`<span class="rank rank-${k}">${k}</span>`, l.length, l.map(c => cardLink(c.id)).join('、')]; });
  chapter('cards', '4. カード図鑑', `
    <p>カードは全部で${allCards.length}枚（モンスター${MONSTERS.length}＋Elite ${ELITES.length}、装備${ITEMS.filter(c => c.kind === 'equip').length}、フラッシュ${ITEMS.filter(c => c.kind === 'flash').length}）。数値はすべてゲームのデータから作っています。</p>
    <h3>色ごとの特徴</h3>
    ${table(['色', 'テーマ', '勝率（Lv1）', '勝率（Lv3）', '評価の高いモンスター'], colorRows)}
    <p>勝率は、その色のモンスターが3体以上入っていたデッキの勝率です。${src(S3.games, '試合（Lv3）と' + S1.games.toLocaleString() + '試合（Lv1）')}</p>
    <h3>強さのランク</h3>
    <p><b>採用時の勝率</b>＝ランダムに組んだデッキ同士を対戦させ、そのカードが入っていた側が勝った割合（カードLv3）。ランクは、S：${RANK_RULE[0][1]}%以上、A：${RANK_RULE[1][1]}%以上、B：${RANK_RULE[2][1]}%以上、C：それ未満です。</p>
    ${table(['ランク', '枚数', 'カード（勝率の高い順）'], rankList)}
    <p>${src(S3.games, '試合（カードLv3。1枚あたり約' + Math.round(S3.cards.reduce((n, c) => n + c.n, 0) / S3.cards.length).toLocaleString() + '試合ぶん）')}　Elite は、1枚入れたデッキで別に測っています（${SIM.a.elites.games}試合ずつ）。</p>
    <p class="note"><b>読み方の注意</b>：1枚あたりの誤差は±1ポイントほどです。CPUが使ったときの数字なので、使い方に工夫がいるカード（とどめに使うフラッシュ、組み合わせ前提のスキルなど）は、人が使うともっと強いことがあります。</p>
    <h3>入手方法</h3>
    ${li([`パック：通常・色・モンスター・アイテム・高級・ヒーロー・イベントの各パック（<a href="#growth">第11章</a>）。どのパックも${GR.PACK_SIZE}枚入りで、最後の1枚はレア以上。`,
      `作成：魔石で作れます（プレイヤーLv${GR.UNLOCK.craft}から）。コモン${GR.CRAFT.common}・レア${GR.CRAFT.rare}・エピック${GR.CRAFT.epic}・レジェンド${GR.CRAFT.legend}。`,
      `ヒーローのカード：ボスを倒してヒーローが解放されたときに、対応するカードを1枚もらえます。`,
      `Elite カード：イベントで3勝するともらえます。パックからは出ず、作成・分解もできません。`])}
    <h3>モンスター</h3>
    ${Object.keys(COLORS).map(col => group(`${COLORS[col].name}：${COLORS[col].theme}`, [...MONSTERS, ...ELITES].filter(c => c.color === col))).join('')}
    <h3>アイテム</h3>
    ${group('装備', ITEMS.filter(c => c.kind === 'equip'))}${group('フラッシュ（使い切り）', ITEMS.filter(c => c.kind === 'flash'))}`);
})();

// ---------- 5. デッキ構築 ----------
(() => {
  const deckHtml = d => {
    const vs = Object.keys(COLORS).map(c => [c, d.vs[c]]).sort((a, b) => b[1] - a[1]);
    const key = bestOf([...new Set(d.deck.monsters)].map(id => CARD_DEFS[id]), 3);
    const types = Object.keys(ATTACK_TYPES).filter(t => d.types[t]).map(t => `${ATTACK_TYPES[t].icon}${ATTACK_TYPES[t].name}${d.types[t]}`).join('・');
    const tips = [];
    if ((d.types.melee || 0) >= 4) tips.push('近接が多いので、前列が倒れたら次の近接が詰めて戦う形になる。後列で待つ近接は攻撃できないので、遠隔・魔法のモンスターを先に後列へ出す');
    if ((d.types.ranged || 0) >= 3) tips.push('遠隔は後列でしか攻撃できない。前列を任せる近接（か、打たれ強いモンスター）を必ず1体は場に置く');
    if ((d.types.magic || 0) + (d.types.chaos || 0) >= 4) tips.push('魔法・カオスはどのスロットからでも攻撃できるので、並びで困りにくい。魔法は正面を狙うので、倒したい相手の正面に置く');
    if (d.avg >= 2.6) tips.push('コストが高め。序盤はクリスタルを残して、次のターンに高コストを出すことも考える');
    else tips.push('コストが低め。毎ターン使い切って、場を早く3体にする');
    const dup = deckGroups([...d.deck.monsters, ...d.deck.items]).filter(g => g[1] > 1).map(g => CARD_DEFS[g[0]].name);
    if (dup.length) tips.push(`${dup.join('・')}は2枚入り。引きやすくして、役割を安定させている`);
    return `<div class="dk keep" id="deck-${d.i}" data-search="${esc(d.name)}" data-kind="デッキ" data-deck-code="${d.code}">
      <h4>${d.name}<small>${TIER_LABEL[d.tier]}・${TIER_NOTE[d.tier]}</small></h4>
      <p>ヒーロー：<b>${d.hero.name}</b>「${d.hero.skills[d.skill].name}」（${d.hero.skills[d.skill].desc}）　平均コスト ${d.avg}　${types}</p>
      <div class="cards">${deckGroups(d.deck.monsters).map(([id, n]) => miniCard(id, d.deck.levels[id], n > 1 ? '<span class="mc-n">×2</span>' : '')).join('')}</div>
      <div class="cards">${deckGroups(d.deck.items).map(([id, n]) => miniCard(id, d.deck.levels[id], n > 1 ? '<span class="mc-n">×2</span>' : '')).join('')}</div>
      <p>勝率 ${pctBar(d.rate)}　${src(d.games, '試合（同じ条件で組んだ、いろいろな色のランダムなデッキ12個が相手）')}</p>
      <p>勝率が高い相手：${vs.slice(0, 2).map(v => `${COLORS[v[0]].name}中心のデッキ（${v[1]}%）`).join('、')}　／　勝率が低い相手：${vs.slice(-2).reverse().map(v => `${COLORS[v[0]].name}中心のデッキ（${v[1]}%）`).join('、')}　<span class="src">根拠：各${d.vsGames}試合のシミュレーション結果</span></p>
      <p><b>回し方</b>：軸になるのは ${key.map(c => cardLink(c.id)).join('・')}。</p>${li(tips)}
      <p class="code"><b>デッキコード</b>（デッキ画面の「新しいデッキ」→「デッキコードを読み込む」に貼る）<br><code>${d.code}</code></p></div>`;
  };
  const pr = SIM.a.pairs;
  chapter('decks', '5. デッキ構築', `
    <h3>考え方</h3>
    ${li([
    `<b>枚数</b>：モンスター${C.DECK_MONSTERS}枚＋アイテム${C.DECK_ITEMS}枚。同じカードは${C.DECK_COPIES}枚まで、レジェンドは${C.DECK_COPIES_LEGEND}枚まで。`,
    `<b>序盤に出せるモンスター</b>：毎ターンのクリスタルは${C.CRYSTALS_PER_TURN}。コスト${C.CRYSTALS_PER_TURN}以下のモンスターが少ないと、場が空のペナルティを受けやすくなります。`,
    `<b>近接・遠隔のバランス</b>：近接が攻撃できるのは前列の1か所、遠隔は後列の2か所です。近接ばかり、遠隔ばかりだと、攻撃できないモンスターが出ます。魔法とカオスはどこからでも攻撃できます。`,
    `<b>色</b>：色つきの装備・フラッシュは、その色のモンスターにしか使えません（フラッシュは、その色のモンスターが場にいるときだけ）。色を増やすほど、使えないアイテムが出やすくなります。`,
    `<b>モンスターの数がそのまま残り体力</b>：モンスターを生贄にすると、勝敗に近づきます。生贄はアイテムから。`,
  ])}
    <h4>同じカードを2枚入れるか</h4>
    <p>ランダムに選んだカードを2枚にしたデッキが、1枚ずつのデッキに勝った割合は、2枚組が1組ずつ：${pr[0].rate}%、2組ずつ：${pr[1].rate}%、4組ずつ：${pr[2].rate}%でした。${src(pr[0].games, '試合ずつ（カードLv3）')}　${pr.every(x => x.rate < 49) ? '<b>でたらめに2枚にすると、弱くなります。</b>種類が減るぶん、対応できる場面が減るためと考えられます。' : pr.every(x => x.rate > 51) ? '2枚にしたほうが、やや強くなりました。' : 'ほぼ差はありませんでした。'}2枚にするのは、<b>評価の高いカード</b>や、<b>デッキの軸になるカード</b>に絞りましょう。</p>
    <h3>おすすめデッキ</h3>
    <p>下の${GDECKS.length}個は、条件（使えるレアリティとカードレベル）ごとに、<b>カードを1〜2枚ずつ入れ替えては対戦させ、勝率が上がった形を残す</b>方法で探したものです（探索に合計${SIM.b.searchGames.toLocaleString()}試合）。載せている勝率は、探したときとは別の相手で測り直した値です。</p>
    <p class="note"><b>注意</b>：CPU同士の勝率です。相手は「同じ条件でランダムに組んだデッキ」なので、数字は高めに出ます。ステージの相手との勝率は<a href="#stages">第8章</a>にあります。デッキコードのヒーローやスキルをまだ持っていない場合、読み込むと今のヒーローに置き換わります。持っていないカードは「足りないカード」として表示されます。</p>
    ${['beginner', 'middle', 'advanced'].map(t => `<h3>${TIER_LABEL[t]}</h3>${GDECKS.filter(d => d.tier === t).map(deckHtml).join('')}`).join('')}`);
})();

// ---------- 6. 対戦のテクニック ----------
chapter('tech', '6. 対戦のテクニック', `
  <p>この章は、ルールとオートの思考のしくみから言えることをまとめています。勝率の数字があるところには、根拠を書いています。</p>
  <h3>配置</h3>
  ${li([
  '<b>近接は前列、遠隔は後列。</b>攻撃できない位置のモンスターは、絵がくすんで「Zz」が出ます。',
  '<b>押し出しで並びを直す。</b>前列に遠隔がいて攻撃できないときは、近接を「スロット1」に出すと、遠隔が後ろへ下がります。',
  '<b>攻撃はスロット3から。</b>後列が先に相手を倒すと、相手が詰めて、次の攻撃の狙いが変わります。倒しきりたい相手を、どの順番で殴るかを考えます。',
  `<b>魔法は正面。</b>相手の後列を魔法で倒したいなら、その正面のスロットに置きます。`,
  `<b>${SKILLS.thorns.name}・${SKILLS.counter.name} 持ちの正面に、打たれ弱い近接を置かない。</b>遠隔・魔法で倒すか、フラッシュで先に倒します。`,
  `<b>${SKILLS.taunt.name}</b> 持ちは、相手の遠隔を引き受けます。HPやアーマーの高いモンスターに持たせると、後列が守られます。`,
])}
  <h3>装備</h3>
  ${li([
    '<b>そのスロットで使える攻撃を伸ばす。</b>前列の近接には近接の装備、後列には遠隔・魔法の装備。使えない種類の攻撃を足しても、攻撃は増えません。',
    '<b>本体と違う種類の攻撃が付く装備</b>は、別の攻撃として追加されます（例：魔法のモンスターに剣を付けて前列に置くと、魔法と近接の2回攻撃）。',
    '<b>すぐ倒されそうなモンスターには付けない。</b>倒されると装備も一緒に失います。',
    '<b>付け替えると、古い装備は捨て札になります。</b>',
  ])}
  <h3>フラッシュ</h3>
  ${li([
    '<b>とどめに使う。</b>ダメージ系は「あと少しで倒せる相手」に。倒せば、その相手の攻撃が1回減ります。',
    `<b>${SKILLS.terminate.name}・${SKILLS.unsummon.name}</b> は、いちばん脅威の大きい相手に。Unsummon は山札に戻すだけで、倒したことにはなりません（相手にクリスタルも入りません）。`,
    `<b>${SKILLS.corrosion.name}</b> は、アーマー装備を付けた相手にだけ使えます。`,
    '<b>色つきのフラッシュ</b>は、その色のモンスターが自分の場にいないと使えません。',
  ])}
  <h3>クリスタルと生贄</h3>
  ${li([
    `使わなかったクリスタルは持ち越せます。<b>次のターンに高コストを出すために残す</b>のは有効です。`,
    `生贄は1ターンに1回。<b>使い道のないアイテム</b>（付ける相手がいない装備など）から。モンスターの生贄は、残りモンスター数を自分で減らすことになります。`,
    `場のモンスターも生贄にできます（+${C.SACRIFICE_MONSTER}）。攻撃できない位置で固まったときに、前のモンスターを生贄にして詰め直す、という使い方があります。`,
    `<b>倒されるとクリスタル+${C.FALLEN_CRYSTAL}。</b>倒されそうなモンスターは、生贄にするより、相手の攻撃を1回受けさせてから倒されたほうが得なことがあります。`,
  ])}
  <h3>よくある負けパターンと対策</h3>
  ${table(['負け方', '対策'], [
    ['場が空のままターンを終えて、カードを捨てられる', 'コストの低いモンスターをデッキに入れる。出せないときは、アイテムを生贄にしてでも1体出す'],
    ['攻撃できないモンスターばかり並ぶ', '近接と遠隔のバランスを見直す。押し出し・場の生贄で並べ直す'],
    ['Thorns や反撃で、自分の近接が倒れていく', '遠隔・魔法・フラッシュで倒す。See-through 持ちを使う'],
    ['アーマーの高い相手を削れない', '魔法（アーマー無視）、Piercing、Corrosion を用意する'],
    ['Flying に攻撃が当たらない', '魔法・カオス（回避されない）、Anti-Air、自分も Flying'],
    ['Heal で粘られる', 'Silence（Heal を止める）、Disease（回復を打ち消す）、1ターンで倒しきる'],
    ['Disease のダメージで、毎ターン削られる', 'Heal・Group Heal でスタックを減らす。Cleanse で消す。Perseverance 持ちは Disease を受けない'],
    [`長引いて消耗ダメージ（ターン${C.ATTRITION_START}〜）で共倒れ`, '消耗ダメージは場のモンスターだけが受ける。残りモンスター数で勝っているなら、そのまま押し切れる'],
  ])}
  <h3>オートバトルの使い方</h3>
  <p>対戦画面の「オート」を押すと、自分の番も自動で進みます。設定で強さを「ふつう」「つよい」から選べます。「つよい」は、そのターンにできる行動の組み合わせを試算して、いちばん点数の高い手を選びます。「つよい」は「ふつう」に${SIM.a.auto.rate}%勝ちました。${src(SIM.a.auto.games, '試合（同じデッキの組で席を入れ替えて対戦）')}</p>
  ${box('手動のほうがよい場面（オートの思考のしくみから）', li([
    '<b>相手の手札を読みたいとき。</b>オートは相手の手札を見ず、「相手は今の場のまま攻撃してくる」として試算します。相手がこれから出すカードは考えません。',
    '<b>2ターン以上先の計画。</b>オートの先読みは「自分の攻撃 → 相手の次の番」まで。数ターンかけてそろえるコンボは組みません。',
    '<b>強いフラッシュの温存。</b>オートは点数が上がれば使います。ボスの切り札に取っておきたいときは手動で。',
    '<b>★3を狙うとき。</b>オートは勝つことを優先し、「残りモンスター6体以上で勝つ」ことは狙いません。',
  ]) + '<p class="note">これは対戦の数字ではなく、思考のしくみからの説明です。</p>')}`);

// ---------- 7. ヒーローと地形 ----------
(() => {
  const hr = Object.fromEntries(SIM.d.heroes.skills.map(s => [s.id, s.rate]));
  const heroHtml = h => {
    const deck = GDECKS.filter(d => d.hero.id === h.id);
    const best = h.skills.map((k, i) => [i, hr[k.id]]).sort((a, b) => b[1] - a[1])[0];
    return `<div class="box keep" id="hero-${h.id}" data-search="${esc(h.name + ' ' + h.skills.map(k => k.name).join(' '))}" data-kind="ヒーロー">
      <b class="box-t c-${h.color} color-name">${h.name}（${COLORS[h.color].name}）</b>
      <p>解放：${h.unlock ? `ステージ ${h.unlock} をクリア` : '最初から'}。カード：${cardLink(h.card)}</p>
      ${table(['スキル', '解放', '効果', '勝率'], h.skills.map((k, i) => [`<b>${k.name}</b>`, `ヒーローLv${HERO_RULES.SKILL_LEVELS[i]}`, esc(k.desc), pctBar(hr[k.id])]))}
      <p>勝率がいちばん高かったのは「${h.skills[best[0]].name}」（${best[1]}%）。${deck.length ? `おすすめデッキ：${deck.map(d => `<a href="#deck-${d.i}">${d.name}</a>`).join('、')}` : ''}</p></div>`;
  };
  const tr = Object.fromEntries(SIM.d.terrains.list.map(t => [t.id, t]));
  const terrRow = t => {
    const c = tr[t.id].colors;
    const sorted = Object.keys(COLORS).filter(k => c[k] != null).sort((a, b) => c[b] - c[a]);
    return [`<span id="terrain-${t.id}" data-search="${esc(t.name + ' ' + t.yomi)}" data-kind="地形">${t.icon} <b>${t.name}</b>${t.special ? '<small>（ボス専用）</small>' : ''}</span>`, esc(t.desc),
      `${COLORS[sorted[0]].name} ${c[sorted[0]]}%`, `${COLORS[sorted[sorted.length - 1]].name} ${c[sorted[sorted.length - 1]]}%`, tr[t.id].turns];
  };
  const order = HEROES.map(h => h.skills.map((k, i) => ({ h, k, i, r: hr[k.id] }))).flat().sort((a, b) => b.r - a.r);
  chapter('heroes', '7. ヒーローと地形', `
    <h3>ヒーロー</h3>
    <p>ヒーローは${HEROES.length}人。デッキごとに1人とスキル1つを選びます。スキルは、ヒーローLv${HERO_RULES.SKILL_LEVELS.join('・')}で1つずつ解放されます（最大Lv${HERO_RULES.MAX_LEVEL}）。レベル上げには、そのヒーローの<b>ギフト</b>を使います。ギフトは、対戦に勝つと使用中のヒーローに${HERO_RULES.GIFT_WIN}つ入るほか、デイリー・ログイン・イベント・ヒーローパックでももらえます。</p>
    <p>勝率は、そのヒーロースキルを付けたランダムなデッキが、ヒーローなしのランダムなデッキに勝った割合です（50%より高いほど、スキルのぶん有利）。${src(SIM.d.heroes.games, '試合ずつ（カードLv3）')}</p>
    ${HEROES.map(heroHtml).join('')}
    <h4>レベル上げの優先順位</h4>
    <p>勝率の高いスキルの順です：${order.slice(0, 6).map(o => `${o.h.name}「${o.k.name}」${o.r}%（Lv${HERO_RULES.SKILL_LEVELS[o.i]}）`).join(' ＞ ')}。</p>
    <p class="note">どのデッキにも効くスキル（回復や、前列の近接+1など）が上位に来ます。特定のスキルを強くするもの（Heal +1、Shoot Command +1 など）は、そのスキルのカードを入れていないと効果がないので、ランダムなデッキでは低く出ます。自分のデッキに合うなら、数字より強く働きます。</p>
    <h3>地形</h3>
    <p>ステージは決まった地形、フリー対戦とイベントはランダムな地形で戦います。「有利な色」「不利な色」は、その色のモンスターが3体以上入ったデッキの勝率が、いちばん高かった色・低かった色です。</p>
    ${table(['地形', '効果', '有利な色', '不利な色', '平均ターン'], TERRAINS.map(terrRow))}
    <p>${src(SIM.d.terrains.games, '試合ずつ（カードLv3）')}　1つの数字には±2ポイントほどの誤差があります。差が3ポイント以内の地形は、ほぼ影響なしと考えてください。</p>`);
})();

// ---------- 8. ステージ攻略 ----------
(() => {
  const C8 = Object.fromEntries(SIM.c.stages.map(s => [s.id, s]));
  const threats = st => { const d = stageDeck(st); return bestOf([...new Set(d.monsters)].map(id => CARD_DEFS[id]), 3).map(c => cardLink(c.id)).join('、'); };
  const bestDeck = r => { const b = r.decks.slice().sort((x, y) => y.rate - x.rate)[0]; return b ? `<a href="#deck-${b.i}">${GDECKS[b.i].name}</a> ${b.rate}%（★3 ${b.star3}%）` : '-'; };
  const fix = st => (st.income < 0 ? `相手のクリスタル 毎ターン${C.CRYSTALS_PER_TURN + st.income}` : st.bonus > 0 ? `相手の最初のクリスタル+${st.bonus}` : st.bonus < 0 ? `相手の最初のクリスタル${st.bonus}` : '-');
  const chapterHtml = ch => {
    const list = STAGES.filter(s => s.chapter === ch.id);
    const boss = list.find(s => s.boss);
    const r = C8[boss.id];
    const d = stageDeck(boss);
    const hs = HERO_SKILL_INFO[d.hero.skill];
    const lvRow = r.byLevel.map(x => `カードLv${x.level}：<b>${x.rate}%</b>`).join('　');
    const rec = r.byLevel.find(x => x.rate >= 40) || r.byLevel[r.byLevel.length - 1];
    return `<h3 id="chapter-${ch.id}">${ch.id}章　${ch.icon} ${ch.name}</h3>
      ${table(['ステージ', '地形', '相手の色・Lv', '補正', '要注意カード', '基準デッキの勝率', '★3', 'おすすめデッキ'], list.filter(s => !s.boss).map(st => [
      `<span id="stage-${st.id}" data-search="${esc(st.id + ' ' + st.enemy)}" data-kind="ステージ" data-stage="${st.id}" data-stage-info="${[st.terrain, st.level, st.bonus || 0, st.income || 0].join(':')}">${st.id}</span>`,
      terr(st.terrain), `${st.colors.map(c => COLORS[c].name).join('・')}　Lv${st.level}`, fix(st), threats(st), pctBar(C8[st.id].ref), fmt(C8[st.id].star3), bestDeck(C8[st.id])]), 'stg')}
      <div class="box keep boss" id="stage-${boss.id}" data-search="${esc(boss.id + ' ' + boss.enemy)}" data-kind="ボス" data-stage="${boss.id}" data-stage-info="${[boss.terrain, boss.level, boss.bonus || 0, boss.income || 0].join(':')}">
        <b class="box-t">👑 ${boss.id}　${esc(boss.enemy)}</b>
        <p>${esc(boss.feature)}</p>
        <p>地形：${terr(boss.terrain)}（${esc(TERRAIN_BY_ID[boss.terrain].desc)}）　カードLv${boss.level}　補正：${fix(boss)}</p>
        <p>ヒーロースキル「<b>${hs.name}</b>」：${esc(hs.desc)}</p>
        <div class="cards">${deckGroups(d.monsters).map(([id, n]) => miniCard(id, d.levels[id], n > 1 ? '<span class="mc-n">×2</span>' : '')).join('')}</div>
        <div class="cards">${deckGroups(d.items).map(([id, n]) => miniCard(id, d.levels[id], n > 1 ? '<span class="mc-n">×2</span>' : '')).join('')}</div>
        <p><b>弱点と攻略</b>：${esc(boss.hint)}</p>
        <p><b>勝率（基準デッキ）</b>：${lvRow}　→ <b>推奨カードレベル：Lv${rec.level}以上</b>　${src(SIM.c.bossGames, '試合ずつ')}</p>
        <p><b>おすすめデッキでの勝率</b>：${r.decks.slice().sort((x, y) => y.rate - x.rate).map(b => `<a href="#deck-${b.i}">${GDECKS[b.i].name}</a> ${b.rate}%`).join('　')}　<span class="src">各${SIM.c.deckGames}試合</span></p>
        <p>初クリアの報酬：💰${stageReward(boss).gold}　🔷${stageReward(boss).stones}　${packBagText(stageReward(boss).bag)}${HEROES.find(h => h.unlock === boss.id) ? `　＋ヒーロー「${HEROES.find(h => h.unlock === boss.id).name}」解放` : ''}</p></div>`;
  };
  chapter('stages', '8. ステージ攻略', `
    <p>ステージは全${STAGES.length}個（5章×10）。各章の10番目がボスです。★は、勝ったときの残りモンスター数で決まります（★★：${STAGE_RULES.STAR_2}体以上、★★★：${STAGE_RULES.STAR_3}体以上）。</p>
    ${box('表の見方', li([
    '<b>基準デッキの勝率</b>：その章に来るころに持っていそうなデッキ（レアリティとカードレベルを章ごとに決め、毎回ランダムに組んだもの）での勝率。ステージの難しさの目安です。',
    `<b>おすすめデッキ</b>：<a href="#decks">第5章</a>のデッキ（1・2章は初心者向け、3・4章は中級者向け、5章は上級者向け。カードレベルはその章の基準）のうち、勝率がいちばん高かったもの。`,
    '<b>要注意カード</b>：相手のデッキの中で、評価（採用時の勝率）が高いモンスター。',
    '<b>★3を取るコツ</b>：モンスターを生贄にしない。倒されにくい前列（HP・アーマーの高いモンスター）を置く。長引かせず、攻撃の数で押し切る。',
  ]) + `<p>${src(SIM.c.refGames, '試合ずつ（基準デッキ）、' + SIM.c.deckGames + '試合ずつ（おすすめデッキ）。すべてCPU同士')}</p>`)}
    ${CHAPTERS.map(chapterHtml).join('')}`);
})();

// ---------- 9. ダンジョン攻略 ----------
(() => {
  const cr = Object.fromEntries(SIM.d.charms.list.map(c => [c.id, c.rate]));
  const base = SIM.d.charms.base;
  const rk = v => (v - base >= 10 ? 'S' : v - base >= 6 ? 'A' : v - base >= 2.5 ? 'B' : 'C');
  const battle = DUNGEON_CHARMS.filter(c => c.battle).sort((a, b) => cr[b.id] - cr[a.id]);
  const meta = DUNGEON_CHARMS.filter(c => !c.battle);
  const dg = SIM.d.dungeon;
  chapter('dungeon', '9. ダンジョン攻略', `
    <p>ダンジョンは、手持ちのカードを使わず、ダンジョンの中だけのデッキで全${DUNGEON.CHAPTERS}章（1章${DUNGEON.ROWS}マス、最後がボス）を進むモードです。最初はモンスター${DUNGEON.START_MONSTERS}枚＋アイテム${DUNGEON.START_ITEMS}枚（すべてLv1のコモン）。命は${DUNGEON.LIVES}つで、戦闘に負けると1つ減ります。</p>
    <h3>マスの種類</h3>
    ${table(['マス', '内容'], Object.keys(DUNGEON_NODES).map(k => [`${DUNGEON_NODES[k].icon} <b>${DUNGEON_NODES[k].name}</b>`, esc(DUNGEON_NODES[k].desc)]))}
    <p>戦闘のコイン：戦闘${DUNGEON.COINS.battle}・強敵${DUNGEON.COINS.elite}・ボス${DUNGEON.COINS.boss}。商人の値段：コモン${DUNGEON.PRICE.common}・レア${DUNGEON.PRICE.rare}・エピック${DUNGEON.PRICE.epic}・レジェンド${DUNGEON.PRICE.legend}・お守り${DUNGEON.PRICE.charm}。</p>
    <h3>ルートの選び方</h3>
    ${li([
    '<b>序盤は戦闘を多く踏む。</b>最初のデッキは8枚しかなく、モンスターの数がそのまま粘り強さです。戦闘に勝つたびに1枚増やせます。',
    '<b>命に余裕があるときだけ強敵へ。</b>強敵はカードが1枚多く、レベルも1高い相手です。勝てばレア以上のカードとお守りが手に入ります。',
    '<b>ボスの前のマスは、必ず祠か鍛冶屋</b>です。命が減っていれば祠で回復、減っていなければ鍛冶屋で主力を強化。',
    '<b>負けたあとの「戦わずに進む」</b>は、命を守る手段です（報酬はなし。ボスは避けられません）。',
  ])}
    <h3>章ごとの敵</h3>
    ${table(['章', '敵の色', '敵のデッキ（前半→後半）', '敵のカードLv', 'ボス', 'ボスのスキル'], DUNGEON_CHAPTERS.map((ch, i) => [`${i + 1}章 ${ch.icon}${ch.name}`, ch.colors.map(c => COLORS[c].name).join('・'), `${ch.size[0]}+${ch.size[1]}枚 → ${ch.size[0] + 1}+${ch.size[1] + 1}枚`, `Lv${ch.level}`, `${esc(ch.boss.name)}（Lv${ch.boss.level}・${ch.boss.deck.monsters.length}+${ch.boss.deck.items.length}枚）`, esc(HERO_SKILL_INFO[ch.boss.skill].desc)]))}
    <h3>お守りの評価</h3>
    <p>お守りは挑戦中ずっと効きます。対戦中に効く${battle.length}種類は、「お守りを1つ持った側」の勝率で評価しました（持たないときは${base}%）。${src(SIM.d.charms.games, '試合ずつ（コモンとレアのランダムなデッキ・カードLv1・CPU同士）')}</p>
    ${table(['ランク', 'お守り', '効果', '勝率', '上がり幅'], battle.map(c => [`<span class="rank rank-${rk(cr[c.id])}">${rk(cr[c.id])}</span>`, `<span id="charm-${c.id}" data-search="${esc(c.name)}" data-kind="お守り">${c.icon} <b>${c.name}</b></span>`, esc(c.desc), pctBar(cr[c.id]), `+${Math.round(10 * (cr[c.id] - base)) / 10}`]))}
    <p class="note">ランクは上がり幅で付けています（S：+10以上、A：+6以上、B：+2.5以上、C：それ未満）。条件つきのお守り（同じ色3体、カオス攻撃など）は、ランダムなデッキでは条件を満たしにくく、低く出ます。自分のデッキが条件に合うなら、もっと強く働きます。</p>
    <h4>進み方に効くお守り（対戦の勝率では測れないもの）</h4>
    ${table(['お守り', '効果', 'ひとこと'], meta.map(c => [`<span id="charm-${c.id}" data-search="${esc(c.name)}" data-kind="お守り">${c.icon} <b>${c.name}</b></span>`, esc(c.desc), { heart: '命が1つ増えるのは、戦闘1回ぶんの失敗を許すのと同じ。早いほど価値が高い', scout: '候補が4枚になり、欲しい種類を引きやすい', lucky: '序盤のデッキ強化が早くなる', smith: '鍛冶屋を踏む回数が多いルートで', coin_plus: '商人を使うルートで', discount: '商人を使うルートで' }[c.id] || '']))}
    <h4>強い組み合わせ（効果の重なり方から）</h4>
    ${li([
    `${CHARM_BY_ID.tough.name}＋${CHARM_BY_ID.first_armor.name}／${CHARM_BY_ID.first_hp.name}：最初に前列へ出す1体が、非常に倒されにくくなります。`,
    `${CHARM_BY_ID.front_melee.name}＋近接の多いデッキ（${HEROES.find(h => h.id === 'agni').name}の「${HEROES.find(h => h.id === 'agni').skills[1].name}」とも重なります）。`,
    `${CHARM_BY_ID.sac_plus.name}＋${CHARM_BY_ID.fallen_plus.name}：クリスタルが増え、高コストのカードを早く出せます。`,
  ])}
    <h3>カードの取り方</h3>
    ${li([
    `<b>モンスターは8体まで積極的に取る。</b>デッキが小さいうちは、モンスターの数が勝敗に直結します。`,
    `<b>使えないアイテムは取らない。</b>色つきの装備・フラッシュは、その色のモンスターがいないと使えません。取らないことも選べます。`,
    `<b>枠がいっぱいになったら、入れ替え。</b>レアリティの低いカード、レベルを上げていないカードから外します。`,
    `<b>同じカードは2枚まで</b>（レジェンドは1枚）。鍛冶屋のレベルアップは、同じカード2枚の両方に効きます。`,
    `祠の「カードを取り除く」は、弱いアイテムを抜いて、強いカードを引きやすくする使い方です。`,
  ])}
    <h3>難しさ（試練）</h3>
    <p>クリアすると、次の試練が解放されます（試練1〜${DUNGEON.MAX_TRIAL}。試練nでは1〜nがすべて重なります）。持ち帰れる報酬は、試練1つにつき+${Math.round(DUNGEON.REWARD.trialBonus * 100)}%。</p>
    ${table(['試練', '加わる内容'], DUNGEON_TRIALS.map((t, i) => [i + 1, esc(t.desc)]))}
    ${table(['試練', 'クリア率', '平均到達マス', '1章で終了', '2章で終了', '3章で終了', '戦闘の勝率'], dg.map(x => [x.trial === 0 ? '通常' : x.trial, pctBar(x.clear), `${x.floor} / ${DUNGEON.CHAPTERS * DUNGEON.ROWS}`, fmt(x.died[0]), fmt(x.died[1]), fmt(x.died[2]), fmt(x.battleWin)]))}
    <p>${src(dg[0].runs, '回の挑戦（通常）、試練は各' + dg[1].runs + '回。オート「つよい」＋決まった方針（戦闘を優先、命が1つなら回復を優先、レアリティの高いカードを取る）')}　人が考えて進めれば、これより高くなるはずです。</p>
    <p>持ち帰れる報酬：進んだマス1つにつき💰${DUNGEON.REWARD.goldPerFloor}・🔷${DUNGEON.REWARD.stonesPerFloor}、クリアで💰${DUNGEON.REWARD.clearGold}・🔷${DUNGEON.REWARD.clearStones}。カードは持ち帰れません。</p>`);
})();

// ---------- 10. 詰めパズル ----------
(() => {
  const stepText = (def, step) => {
    const card = i => puzzleCard(def.me.hand[i]);
    const [k, a, b] = step;
    if (k === 'm') return `${card(a).name}を、スロット${b + 1}に出す`;
    if (k === 'e') return `${card(a).name}を、自分のスロット${b + 1}のモンスターに装備する`;
    if (k === 'f') { const mode = flashTarget(card(a)); return `${card(a).name}を使う${mode === 'none' ? '' : `（対象：${mode === 'enemy' ? '相手' : '自分'}のスロット${b + 1}）`}`; }
    if (k === 's') return `${card(a).name}を生贄にする`;
    if (k === 'x') return `自分のスロット${a + 1}のモンスターを生贄にする`;
    return 'ターン終了';
  };
  const pz = (p, n) => `<div class="pz keep" id="puzzle-${p.id}" data-search="${esc(p.title)}" data-kind="パズル" data-puzzle="${p.id}">
    <b>${n}. ${esc(p.title)}</b><small>目標：${esc(puzzleGoalText(p.goal))}</small>
    <p>${esc(p.lesson)}</p>
    <p>ヒント1：${esc(p.hints[0])}</p><p>ヒント2：${esc(p.hints[1])}</p>
    <details><summary>答えを見る（ネタバレ）</summary><ol>${p.solution.map(s => `<li>${esc(stepText(p, s))}</li>`).join('')}</ol></details></div>`;
  chapter('puzzle', '10. 詰めパズル', `
    <p>パズルは${PUZZLES.length}問（${PUZZLE.LEVELS.map(([lv, name]) => `${name}${PUZZLES.filter(p => p.level === lv).length}問`).join('・')}）。決まった盤面から、目標を達成します。運の要素は固定されています（遠隔のブロックは起きない、カオスは最大値で相手の一番前、など。問題ごとの「ルール」で確認できます）。初回クリアの報酬は、入門💰${PUZZLE.REWARD.beginner.gold}・中級💰${PUZZLE.REWARD.middle.gold}・上級🔷${PUZZLE.REWARD.advanced.stones}。ヒントなしで解くと★が付きます。</p>
    <h3>解き方の考え方</h3>
    ${li([
    '<b>まず、今のままターン終了したらどうなるかを数える。</b>攻撃はスロット3 → 2 → 1 の順。だれが、だれに、何ダメージ入れるかを順に追います。',
    '<b>足りないダメージを数える。</b>「あと何ダメージ」「どの相手に」が分かれば、使うカードが絞れます。',
    '<b>倒す順番から逆算する。</b>前列が倒れると後ろが詰めます。先に倒すと、次の攻撃の狙いが変わります。',
    '<b>押し出しと場の生贄で、並びを変えられる。</b>攻撃できないモンスターを、攻撃できる位置へ動かせないか考えます。',
    '<b>クリスタルを数える。</b>使えるカードの組み合わせは、たいてい1〜2通りしかありません。',
    '<b>2ターンの問題</b>は、相手の番にCPUが動きます。次の自分の番のクリスタルは「残した数＋3＋倒された数」です。',
  ])}
    ${PUZZLE.LEVELS.map(([lv, name]) => `<h3>${name}</h3><div class="pzs">${PUZZLES.filter(p => p.level === lv).map((p, i) => pz(p, i + 1)).join('')}</div>`).join('')}
    <p class="note">答えは、ゲームの処理で全パターンを調べて確かめた手順です（ほかにも正解がある問題があります）。</p>`);
})();

// ---------- 11. イベント・デイリー・成長 ----------
(() => {
  const er = Object.fromEntries(SIM.d.events.list.map(e => [e.id, e]));
  const evTip = ev => {
    const r = ev.rule;
    if (r.deckColor) return `${COLORS[r.deckColor].name}のモンスターだけのデッキを使用中にすると、自分のデッキで戦えます（なければ貸し出しデッキ）。相手も${COLORS[r.deckColor].name}なので、その色に強いカードを。`;
    if (r.randomDeck) return 'カードは貸し出しのランダムなデッキ。ヒーローだけ自分のものを使うので、どのデッキにも効くスキルのヒーローを使用中にしておく。';
    if (r.grant) return `全員が ${Object.keys(r.grant).map(s => SKILLS[s].name).join('・')} を持ちます。${r.grant.flying ? '近接・遠隔は回避されやすいので、魔法・カオス・Anti-Air が有利。' : ''}`;
    if (r.income) return `毎ターンのクリスタルが+${r.income}。コストの高いカードを多めに入れても回ります。`;
    if (r.attritionStart) return `消耗ダメージがターン${r.attritionStart}から。長期戦はできないので、攻撃力の高いデッキで早く決める。`;
    if (r.sacrificeMult) return `生贄のクリスタルが${r.sacrificeMult}倍。使わないアイテムを毎ターン生贄にして、高コストを早く出す。`;
    return '';
  };
  const packRows = ['normal', 'red', 'monster', 'item', 'premium', 'hero:leafia'].map(id => {
    const t = packType(id);
    const rates = packRatesOf(t);
    const ev = RARITY_ORDER.reduce((n, k) => n + rates[k] * GR.DISMANTLE[k], 0);
    const sure = RARITY_ORDER.slice(1).reduce((n, k) => n + rates[k] * GR.DISMANTLE[k], 0) / (1 - rates.common);
    const g = t.guarantee || 1;
    const value = Math.round(ev * (GR.PACK_SIZE - g) + sure * g);
    return [`<span data-pack="${id}" data-pack-info="${[t.price.gold || 0, t.price.stones || 0, RARITY_ORDER.map(k => rates[k]).join('/'), g].join(':')}">${t.icon} <b>${id.startsWith('hero:') ? 'ヒーローパック' : id === 'red' ? '色のパック（5色）' : t.name}</b></span>`, esc(id.startsWith('hero:') ? `そのヒーローの色と、相性のよいスキルのカードが${PACK_SHOP.BOOST}倍出やすい。ギフト1つ入り（ヒーローLv${PACK_SHOP.HERO_LEVEL}以上で買える）` : id === 'red' ? 'その色のカードと、無色のアイテムだけが出る' : t.desc),
      t.price.gold ? `💰${t.price.gold}` : `🔷${t.price.stones}`, RARITY_ORDER.map(k => `${R[k].name}${Math.round(1000 * rates[k]) / 10}%`).join(' '), `最後の${g}枚`, `約🔷${value}`];
  });
  chapter('growth', '11. イベント・デイリー・成長', `
    <h3>イベント</h3>
    <p>イベントは週替わり（${EVENTS.length}種類が順番に来ます）。プレイヤーLv${GR.UNLOCK.event}で解放。${EVENT_CONFIG.BATTLES}連戦で、${EVENT_CONFIG.MAX_LOSSES}敗すると終了です。相手の最初のクリスタルは、${EVENT_CONFIG.FOE_BONUS.map((b, i) => `${i + 1}戦目+${b}`).join('・')}。何度でも挑戦できますが、各段階の報酬は週に1回です。</p>
    ${table(['勝ち数', '報酬'], EVENT_TIERS.map(t => [`${t.wins}勝`, t.reward.elite ? '✨ その週の Elite カード' : [t.reward.gold && `💰${t.reward.gold}`, t.reward.stones && `🔷${t.reward.stones}`, t.reward.packs && `イベントパック×${t.reward.packs}`, t.reward.gifts && `🎀ギフト×${t.reward.gifts}`].filter(x => x).join('　')]))}
    ${table(['イベント', '特殊ルール', 'Elite カード', '攻略', '平均の勝ち数', '3勝以上'], EVENTS.map(ev => [`<span id="event-${ev.id}" data-search="${esc(ev.name + ' ' + ev.yomi)}" data-kind="イベント">${ev.icon} <b>${ev.name}</b></span>`, esc(ev.desc), cardLink(ev.elite), evTip(ev), er[ev.id].wins, fmt(er[ev.id].elite)]), 'stg')}
    <p>「平均の勝ち数」と「3勝以上」は、自分と同じ強さの相手に5連戦したときの結果です。${src(Math.round(SIM.d.events.games / 4), '回の連戦ずつ（CPU同士・カードLv3）')}　3勝で Elite カードがもらえます。</p>
    <h3>デイリークエストとログインボーナス</h3>
    <p>デイリークエストは1日${DAILY.QUESTS}つ（プレイヤーLv${GR.UNLOCK.daily}で解放）。1日${DAILY.SWAPS}回、気に入らないクエストを交換できます。降参した対戦は数えません。</p>
    ${table(['クエスト', '報酬'], QUEST_DEFS.map(q => [esc(q.text), rewardText(q.reward)]))}
    ${li([
    '<b>「◯◯を含むデッキで3勝」</b>は、その色のモンスターが1体でも入っていれば数えます。5色を1体ずつ入れたデッキなら、どの色のクエストも同時に進みます。',
    '<b>「◯◯攻撃で敵を倒す」</b>は、その種類の攻撃でとどめを刺した数です。その種類のモンスターを多めに入れたデッキで。',
    '<b>ステージ・フリー対戦・イベントのどれでも進みます</b>（ダンジョンとパズルは数えません）。勝ちやすいステージをくり返すのが早道です。',
    '報酬は、デイリーの画面の「まとめて受け取る」で一度に受け取れます。',
  ])}
    <p>ログインボーナス（7日周期）：${LOGIN_REWARDS.map((r, i) => `${i + 1}日目 ${rewardText(r)}`).join('／')}</p>
    <h3>ゴールドと魔石の入り方</h3>
    ${table(['入手元', 'もらえるもの'], [
      ['対戦に勝つ', `経験値${GR.XP_WIN}・💰${GR.GOLD_WIN}・通常パック${GR.PACKS_WIN}・ヒーローのギフト${HERO_RULES.GIFT_WIN}`], ['対戦に負ける', `経験値${GR.XP_LOSS}・💰${GR.GOLD_LOSS}`],
      ['プレイヤーレベルアップ', `💰${GR.GOLD_LEVEL_UP}・通常パック${GR.PACKS_LEVEL_UP}`],
      ['ステージの初クリア', `💰${stageReward(STAGE_BY_ID['1-1']).gold}×章・🔷${stageReward(STAGE_BY_ID['1-1']).stones}×章。各章の5番目は、さらに ${packBagText(stageReward(STAGE_BY_ID['1-5']).bag).replace(/^\S*?(赤|青|緑|黄|紫)の/, 'その章の色の')}`], ['ボスの初クリア', `💰${stageReward(STAGE_BY_ID['1-10']).gold}×章・🔷${stageReward(STAGE_BY_ID['1-10']).stones}×章・高級パック${stageReward(STAGE_BY_ID['1-10']).bag.premium}つ・その章の色のパック${stageReward(STAGE_BY_ID['1-10']).bag.red}つ`],
      ['カードの分解', `コモン🔷${GR.DISMANTLE.common}・レア🔷${GR.DISMANTLE.rare}・エピック🔷${GR.DISMANTLE.epic}・レジェンド🔷${GR.DISMANTLE.legend}`],
    ])}
    <h3>どのパックを買うか</h3>
    ${table(['パック', '中身', '値段', '1枚ごとの排出率', 'レア以上確定', '全部分解したときの期待値'], packRows, 'stg')}
    <p>「期待値」は、排出率と分解の魔石から計算した値です（計算式は<a href="#appendix">付録</a>）。</p>
    ${li([
    '<b>まずは勝利でもらえる通常パックを開ける。</b>ショップは、欲しい種類を狙うための追加手段です。',
    '<b>デッキの色が決まったら、色のパック。</b>その色のカードと無色のアイテムだけが出るので、無駄が少なくなります。',
    '<b>モンスターが足りなければモンスターパック、装備・フラッシュが足りなければアイテムパック。</b>',
    '<b>高級パックは魔石で買う。</b>分解の期待値は値段より低いので、「買って分解して増やす」ことはできません。エピック・レジェンドを狙うときに。特定の1枚が欲しいなら、魔石で直接作成するほうが確実です。',
    '<b>ヒーローパックは、そのヒーローを育てているときに。</b>ギフトが1つ入っています。',
  ])}
    <h3>カード強化の優先順位</h3>
    <p>強化（Lv L → L+1）には、同じカードの予備 L 枚と、ゴールド・魔石（下の値 × L）が必要です。</p>
    ${table(['レアリティ', 'ゴールド', '魔石', '最大レベル'], RARITY_ORDER.map(k => [`<span class="r-${k}">${R[k].name}</span>`, `${GR.UPGRADE_GOLD[k]} × L`, `${GR.UPGRADE_STONES[k]} × L`, `Lv${Math.max(...allCards.filter(c => c.rarity === k).map(c => maxLevel(c.id)))}`]))}
    ${li([
    '<b>デッキに入れているカードから。</b>使っていないカードを上げても、勝率は変わりません。',
    '<b>コモンは安い。</b>予備も集まりやすいので、主力のコモンを先に上げるのが効率的です。',
    '<b>エピック・レジェンドは、選択スキルが解放されるレベル</b>（モンスターはLv3、装備はLv2が多い）まで上げると、スキルを1つ追加で選べます。',
    '<b>ボスで詰まったら</b>、<a href="#stages">第8章</a>の「推奨カードレベル」を目安に、デッキ全体のレベルを上げます。',
  ])}`);
})();

// ---------- 12. よくある質問 ----------
chapter('faq', '12. よくある質問', [
  ['攻撃しないモンスターがいるのはなぜ？', `そのスロットで使える攻撃を持っていないためです。近接はスロット1、遠隔はスロット2・3でしか攻撃できません（絵がくすんで「Zz」が出ます）。ほかに、拘束（Entangle）されている、Silence 状態で魔法が使えない、Demoralize・Suppress Magic で攻撃力が0になっている、相手の場が空、という場合があります。`],
  ['アーマーがあるのにHPが減った', `魔法ダメージはアーマーを無視します。${SKILLS.piercing.name} 持ちの攻撃は、アーマーを壊した余りがHPに届きます。消耗ダメージ・地形のダメージ・${SKILLS.menace.name} もアーマーを無視します。`],
  ['遠隔攻撃が「BLOCK」された', `アーマーが残っている相手は、遠隔攻撃を${Math.round(C.RANGED_BLOCK_CHANCE * 100)}%の確率でブロックします。${SKILLS.shoot.name} を受けているあいだは、ブロックされません。`],
  ['攻撃が外れた（MISS）', `${SKILLS.flying.name} 持ちは、近接を${Math.round(C.FLYING_DODGE_MELEE * 100)}%、遠隔を${Math.round(C.FLYING_DODGE_RANGED * 100)}%で回避します。地形「${TERRAIN_BY_ID.mist.name}」では、遠隔攻撃が外れることがあります。`],
  ['後列の相手を狙ってくれない', `近接は必ず相手の前列を狙います。魔法は正面、遠隔は対角を先に狙います。${SKILLS.taunt.name} 持ちがいると遠隔はそこへ向かい、後列の ${SKILLS.stealth.name} 持ちは遠隔・魔法では狙えません。`],
  ['カオス攻撃のダメージが毎回違う', `カオスは 1〜攻撃力 のランダムで、相手もランダムです。${SKILLS.trickery.name} を受けていると、最大値になります。`],
  ['フラッシュ・装備が使えない', `色つきの装備は、同じ色のモンスターにしか付けられません。色つきのフラッシュは、その色のモンスターが自分の場にいるときだけ使えます。${SKILLS.corrosion.name} は、アーマー装備を付けた相手にしか使えません。`],
  ['生贄のボタンが押せない', `生贄は1ターンに1回です（手札・場を合わせて）。`],
  ['場が空だったら、カードが勝手に捨てられた', `自分のターンが終わったとき、自分の場にモンスターが1体もいないと、手札と山札からランダムに1枚が捨てられます（場が空のペナルティ）。`],
  ['モンスターが全員ダメージを受けはじめた', `ターン${C.ATTRITION_START}から、消耗ダメージが始まります。各ターンの開始時に、場のモンスター全員がダメージを受けます。`],
  ['相手のモンスターを倒したら、相手のクリスタルが増えた', `場のモンスターが倒されると、その持ち主がクリスタルを${C.FALLEN_CRYSTAL}個もらいます（自分も相手も同じ）。`],
  ['後攻のクリスタルが途中で増えた', `後攻は、最初の+${C.SECOND_PLAYER_BONUS}に加えて、ターン${C.SECOND_PLAYER_LATE.turn}の開始時にも+${C.SECOND_PLAYER_LATE.bonus}もらいます。先攻が有利になりすぎないための調整です。`],
  ['同じ名前のモンスターに①②が付いている', `同じカードを2枚入れたデッキでは、区別のために番号が付きます。別々のモンスターとして扱われます。`],
  ['デッキが「未完成」「カードが足りません」になった', `16枚そろっていないデッキ、分解などで手持ちからなくなったカードが入ったデッキは、対戦に使えません。デッキ編集で直してください。`],
  ['Elite カードはどうやって手に入れる？', `週替わりのイベントで3勝するともらえます。パックからは出ず、作成・分解もできません。`],
  ['ダンジョンのカードやレベルは、ふだんのデッキに持ち帰れる？', `持ち帰れません。持ち帰れるのは、終わったときのゴールドと魔石だけです。`],
].map(([q, a]) => `<div class="qa keep" data-search="${esc(q)}" data-kind="質問"><b>Q. ${esc(q)}</b><p>${a}</p></div>`).join(''));

// ---------- 付録 ----------
(() => {
  const terms = [
    ['スロット', '場の置き場所。1が前列（中央）、2・3が後列'], ['前列・後列', 'スロット1が前列、スロット2・3が後列'], ['詰め', 'モンスターがいなくなったとき、後ろが前に移動すること'], ['押し出し', 'モンスターがいるスロットに出して、後ろへずらすこと'],
    ['物理ダメージ', '近接・遠隔のダメージ。アーマーで止まる'], ['固定ダメージ', 'カオス攻撃・Menace・消耗ダメージなど。アーマーや盾を無視してHPに届く'], ['スタック', 'Disease の重なった数'], ['バフ・デバフ', '強化と弱体。次の自分のターン開始まで続くものが多い'], ['生贄', 'カードをクリスタルに換えること。1ターンに1回'],
    ['採用時の勝率', 'そのカードが入っていたデッキの勝率（ランダムなデッキ同士の対戦）'], ['基準デッキ', 'その章に来るころに持っていそうな、ランダムに組んだデッキ'], ['予備', '同じカードを重ねて引いたぶん。強化と分解に使う'], ['お守り', 'ダンジョンの中だけで効く特殊効果'],
  ];
  const rates = GR.PACK_RATES;
  const sims = [
    ['カードの採用時の勝率・色・スキルの勝率（Lv3）', `${S3.games.toLocaleString()}試合`, '第1・3・4章'], ['同（Lv1）', `${S1.games.toLocaleString()}試合`, '第4章'], ['Elite カードの勝率', `各${SIM.a.elites.games}試合`, '第4章'],
    ['スキルの組み合わせ', `各条件${SIM.a.combos.games}試合`, '第3章'], ['2枚入りデッキ', `各${SIM.a.pairs[0].games}試合`, '第5章'], ['オート「つよい」対「ふつう」', `${SIM.a.auto.games}試合`, '第6章'],
    ['おすすめデッキの探索', `${SIM.b.searchGames.toLocaleString()}試合`, '第5章'], ['おすすめデッキの勝率', `各${GDECKS[0].games}試合＋色別 各${GDECKS[0].vsGames}試合`, '第5章'],
    ['ステージ（基準デッキ）', `各${SIM.c.refGames}試合`, '第1・8章'], ['ステージ（おすすめデッキ）', `各${SIM.c.deckGames}試合`, '第8章'], ['ボス（カードレベル別）', `各${SIM.c.bossGames}試合`, '第8章'],
    ['ヒーロースキル', `各${SIM.d.heroes.games}試合`, '第7章'], ['地形', `各${SIM.d.terrains.games}試合`, '第7章'], ['イベント', `各${SIM.d.events.games}試合＋連戦`, '第11章'],
    ['お守り', `各${SIM.d.charms.games}試合`, '第9章'], ['ダンジョンの挑戦', SIM.d.dungeon.map(x => `試練${x.trial}：${x.runs}回`).join('、'), '第9章'],
  ];
  chapter('appendix', '付録', `
    <h3>用語集</h3>
    ${table(['用語', '意味'], terms.map(t => [`<span data-search="${esc(t[0])}" data-kind="用語">${t[0]}</span>`, t[1]]))}
    <h3>計算式</h3>
    ${li([
    `<b>物理ダメージ</b>＝攻撃力 −（Shield・Sacred Shield）。まずアーマーを削り、アーマーを壊した余りは消える（Piercing があればHPに届く）。`,
    `<b>魔法ダメージ</b>＝攻撃力 −（Mirror Shield・Sacred Shield・Anti-Magic Shield）。アーマーは無視。`,
    `<b>カオスのダメージ</b>＝1〜攻撃力 のランダム（Trickery を受けていれば最大値）。固定ダメージで、アーマーと盾を無視する。`,
    `<b>Disease のダメージ</b>＝自分のターン終了時に、スタック数ぶんの魔法ダメージ（スタックは減らない）。`,
    `<b>消耗ダメージ</b>＝1 ＋（今のターン − ${C.ATTRITION_START}）÷ ${C.ATTRITION_STEP} の切り捨て（ターン${C.ATTRITION_START}から）。`,
    `<b>確率</b>：遠隔のブロック${Math.round(C.RANGED_BLOCK_CHANCE * 100)}%／Flying の回避 近接${Math.round(C.FLYING_DODGE_MELEE * 100)}%・遠隔${Math.round(C.FLYING_DODGE_RANGED * 100)}%／Entangle ${Math.round(C.ENTANGLE_CHANCE * 100)}%／Counter-Attack・Magic Counter ${Math.round(C.COUNTER_CHANCE * 100)}%／Magic Reflect ${Math.round(C.MAGIC_REFLECT_CHANCE * 100)}%（1ターンに${C.MAGIC_REFLECT_MAX}回まで）／Cross-Counter-Attack は1ターンに${C.CROSS_COUNTER_MAX}回まで。`,
    `<b>パックの排出率（通常）</b>：${RARITY_ORDER.map(k => `${R[k].name}${Math.round(1000 * rates[k]) / 10}%`).join('・')}。最後の1枚はレア以上で、そのときは「コモンを除いた割合」（レア${Math.round(1000 * rates.rare / (1 - rates.common)) / 10}%・エピック${Math.round(1000 * rates.epic / (1 - rates.common)) / 10}%・レジェンド${Math.round(1000 * rates.legend / (1 - rates.common)) / 10}%）。モンスターが出る割合は約${Math.round(GR.PACK_MONSTER_RATE * 100)}%。`,
    `<b>パックを分解したときの期待値</b>＝（ふつうの枠の枚数 × 1枚の期待値）＋（確定枠の枚数 × 確定枠の期待値）。1枚の期待値＝Σ（排出率 × 分解の魔石）。`,
    `<b>必要経験値</b>（Lv L → L+1）＝${GR.XP_BASE} ＋ ${GR.XP_STEP} ×（L − 1）。`,
    `<b>★の数</b>：勝ったときの残りモンスター数が${STAGE_RULES.STAR_3}体以上で★3、${STAGE_RULES.STAR_2}体以上で★2。`,
  ])}
    <h3>数値の根拠</h3>
    <p>この攻略本の勝率は、すべて<b>CPU同士の対戦</b>をゲームのルールのまま大量に行って出したものです。人が操作したときの強さとは、ずれることがあります。試合数が少ない数字ほど誤差が大きくなります（目安：1,000試合で±1.5ポイント、400試合で±2.5ポイント、100試合で±5ポイント）。</p>
    ${table(['何を測ったか', '試合数', '使っている章'], sims)}
    <p class="note">カードの数値・スキルの説明・ステージ・ヒーロー・地形・お守り・パズル・パックの情報は、ゲームのデータファイルから自動で作っています。ゲームを更新したら、<code>./build-guide.sh</code>（シミュレーションもやり直すなら <code>./build-guide.sh --sim</code>）で作り直せます。</p>`);
})();
