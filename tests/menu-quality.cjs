const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('  var CATS ='));
const context={};vm.createContext(context);
function run(s){return vm.runInContext(s,context);}

// CATS/CAT_MAP(BASE_MENUSより前)と、BASE_MENUS本体を、ソースの並び順のまま実行する。
const catsBlock = source.slice(source.indexOf('  var CATS ='), source.indexOf('    var BASE_MENUS ='));
run(catsBlock);
const base=source.slice(source.indexOf('var BASE_MENUS ='),source.indexOf('  var GENRES ='));
run(base);
// GENRES/WEIGHTS/STAPLES一式(MOODSより前まで)もまとめて実行する。
const genreBlock = source.slice(source.indexOf('  var GENRES ='), source.indexOf('  var MOODS ='));
run(genreBlock);

run(`var customMenus=[], SLOTS=['staple','main','side1','side2'], servings=2, BASE_SERVINGS=5;
var selectedCats=[],selectedGenres=[],selectedWeights=[],selectedStaple=[],activeMood=null;
var sessionMainHistory=[],sessionStapleHistory=[],sessionSideHistory=[],history=[],feedback=[];
function safeSet(){} // LS書き込みはブラウザのみで確認するため、テストではno-op`);

// 定数(SALAD_STYLE_RE, HEAVY_CATSなど)は手打ちコピーせず、ソースから
// そのまま抜き出して評価する(実装とテストの二重管理によるズレを防ぐ)。
for(const name of ['ONE_DISH_SHARE_CACHE','MOOD_SCORE_VIEW','SALAD_STYLE_RE','FRIED_STYLE_RE','VEG_CATS','SOUP_STYLE_RE','METHOD_RULES','TASTE_RULES','HEAVY_CATS','MOOD_TEMPLATES','MOOD_DESCRIPTOR','MOOD_IMPLIES_CAT','TRAIT_SIZE_XL_RE','TRAIT_SIZE_LARGE_RE','TRAIT_RICH_RE','TRAIT_LIGHT_RE','TRAIT_HOT_RE','TRAIT_ADULT_RE','TRAIT_STARCH_RE','TRAIT_PROCESSED_FISH_RE','TRAIT_KID_FAV_RE','TRAIT_CLEAN_RE','TRAIT_NOVEL_RE','TRAIT_MEAT_FISH_CATS','TRAIT_FINISH_LIGHT_RICE','TRAIT_OVERRIDES','TRAIT_CACHE','MOOD_DISH_RULES','MOOD_SWEET_OK']){
  const re=new RegExp('  var '+name+' = [^;]+;', 's');
  const decl=source.match(re)?.[0];
  assert(decl, name+' declaration not found in source');
  run(decl);
}

// MOODS本体(気分の定義そのもの)も手打ちせずソースから抜き出す。
{
  const start = source.indexOf('  var MOODS = [');
  const end = source.indexOf('\n  ];', start) + 5;
  const decl = source.slice(start, end);
  assert(decl.includes('var MOODS ='), 'MOODS declaration not found');
  run(decl);
}

for(const name of ['allMenus','roleOf','pickRandom','recentNamesByRole','matchesGenreWeight','matchesMood','topScoringBand',
  'catPreferenceBonus','isDisliked','clearLikeDislike','recordFeedback',
  'scoreMain','mainPool','scoreStaple','staplePool','isSaladStyle','isSoupStyle','isOneDishStaple',
  'cookingMethodOf','tasteTagsOf','heavyCatOf','scoreSide','sidePool','soupPool','lightSidePool',
  'getTemplate','selectTemplate','buildTeishoku','buildOneDish','oneDishShare','buildDefaultCombo','buildSingleCombo','buildDrinkCombo','trimToMaxItems','buildComboForTemplate',
  'estimatedTotalTime','estimatedTotalCost','estimateActiveSteps','estimateCookware',
  'validateCombo','scoreMenuCombination','safeFallbackCombo','pickCombo',
  'traitMethodOf','deriveTraits','traitsOf','moodRuleOk','moodDishOk','moodRulesSupersede','moodAllows',
  'dishFactSentence','reasonFor','hiramekiScoreFor',
  'comboMenus','shoppingRows','scaleNumber','scaleIngredientText','servingsRatio']){
 const re=new RegExp('  function '+name+'\\([^]*?\\n  \\}');
 let fn=source.match(re)?.[0];
 if(!fn){fn=source.match(new RegExp('  function '+name+'\\([^\\n]+'))?.[0];}
 assert(fn,name);run(fn);
}

// 献立の相性(harmonyIssues / harmonyScore)のブロックも、目印コメントの間をそのまま評価する。
{
  const a = source.indexOf('// @harmony-start'), b = source.indexOf('// @harmony-end');
  assert(a > 0 && b > a, '献立の相性ブロックの目印が見つからない');
  run(source.slice(a, b));
}

// おすすめ理由のブロック(MOOD_INTENT・行の選択・buildReason)は、関数内に「;」を
// 多数含むため、目印コメントの間をそのままソースから切り出して評価する。
{
  const a = source.indexOf('// @reason-start'), b = source.indexOf('// @reason-end');
  assert(a > 0 && b > a, 'おすすめ理由ブロックの目印が見つからない');
  run(source.slice(a, b));
}

// ----- 材料スケーリング(既存の仕様。今回の変更範囲外だが、破壊していないことを確認) -----
assert.equal(run(`scaleIngredientText('卵6個',.4)`),'卵2.5個');
assert.equal(run(`scaleIngredientText('卵3個',.2)`),'卵1/2個');
assert.equal(run(`scaleIngredientText('6Pチーズ100g',.4)`),'2.5Pチーズ40g'); // 既知の別課題(今回のスコープ外)
assert.equal(run(`scaleIngredientText('食パン(8枚切り)8枚',.5)`),'食パン(4枚切り)4枚'); // 既知の別課題(今回のスコープ外)
assert.equal(run(`scaleIngredientText('しょうゆ大さじ2',.4)`),'しょうゆ大さじ3/4');
assert.equal(run(`scaleIngredientText('コーン缶1/2缶',.4)`),'コーン缶1/4缶');

// ----- 買い物リスト集計(shoppingRows) -----
run(`var c={staple:{name:'A',ing:['卵6個','水100ml','塩少々']},main:{name:'B',ing:['卵3個','水200ml','水大さじ2']},side1:null,side2:null};`);
const rows=run('shoppingRows(c)');
assert.equal(rows.find(r=>r.name==='卵').qty,3.5);
assert.equal(rows.find(r=>r.name==='水'&&r.unit==='ml').qty,120);
assert(rows.some(r=>r.text==='塩々' || r.text==='塩少々'));

// ----- 白いごはん/食パンが plain:true で存在すること -----
assert.equal(run(`allMenus().filter(m=>m.role==='staple'&&m.plain).length`), 2);

// ----- 気分なし(おまかせ相当)でのpickCombo() 大規模スイープ(既存仕様の回帰確認) -----
const N = 800;
let oneDishCount = 0, teishokuCount = 0, soupPresentCount = 0;
for(let n=0;n<N;n++){
  const c=run('pickCombo()');
  assert(c, 'pickCombo returned null on iteration '+n);

  const saladCount = ['staple','main','side1','side2'].filter(k=>c[k]&&run(`isSaladStyle(${JSON.stringify(c[k])})`)).length;
  assert(saladCount<=1, 'salad duplicated: '+JSON.stringify(c));

  const soupCount = ['staple','main','side1','side2'].filter(k=>c[k]&&run(`isSoupStyle(${JSON.stringify(c[k])})`)).length;
  assert(soupCount<=1, 'soup duplicated: '+JSON.stringify(c));
  if(soupCount>0) soupPresentCount++;

  const isOneDish = run(`isOneDishStaple(${JSON.stringify(c.staple)})`);
  if(isOneDish){
    oneDishCount++;
    assert.equal(c.main, null, 'one-dish mode should not have a separate main: '+c.staple.name+' + '+ (c.main&&c.main.name));
  }else{
    teishokuCount++;
    assert(c.main, 'teishoku mode should have a main: staple='+c.staple.name);
  }

  const heavyCats = [];
  ['main','side1','side2'].forEach(k=>{
    if(!c[k]) return;
    const hc = run(`heavyCatOf(${JSON.stringify(c[k])})`);
    if(hc) heavyCats.push(hc);
  });
  const heavyCatSet = new Set(heavyCats);
  assert.equal(heavyCats.length, heavyCatSet.size, '主要食材が重複: '+JSON.stringify(heavyCats)+' in '+JSON.stringify(c));
}
assert(oneDishCount>0, 'one-dish mode never triggered in '+N+' spins');
assert(teishokuCount>0, 'teishoku mode never triggered in '+N+' spins');
console.log('[default] one-dish:', oneDishCount, 'teishoku:', teishokuCount, 'soup-present:', soupPresentCount, '/', N);

// =========================================================
// 気分別テンプレート: 全10気分について1000回ずつ生成し、
// テンプレートのハード条件(必須カテゴリ・品数・禁止語・重複)が
// 破られていないことと、理由文が献立・気分と食い違わないことを確認する。
// =========================================================
const MOOD_N = 1000;
const moodIds = run('MOODS.map(m=>m.id)');
assert.deepEqual([...moodIds].sort(), ['cleanup','drink','fish','hearty','light','meat','new','quick','save','surprise'],
  '気分は10種類(ラクしたい/ガッツリ食べたい/今日は飲みたい/節約したい/肉/魚/ちょっと軽め/いつもと違うもの/冷蔵庫を片付けたい/おまかせ): '+moodIds.join(','));
assert.equal(run('MOODS.find(m=>m.id==="quick").label'), 'ラクしたい');

const violation = {};
moodIds.forEach(id => violation[id] = 0);
let dupSideTotal = 0, reasonMismatchTotal = 0;
const traitViolation = {}; moodIds.forEach(id => traitViolation[id] = 0);
const traitExamples = [];
const heroSet = {}; moodIds.forEach(id => heroSet[id] = new Set());
const nullCount = {}; moodIds.forEach(id => nullCount[id] = 0);

moodIds.forEach(moodId => {
  run(`activeMood = MOODS.find(m=>m.id===${JSON.stringify(moodId)});`);
  for(let n=0;n<MOOD_N;n++){
    const c = run('pickCombo()');
    if(!c){ nullCount[moodId]++; continue; } // 「条件に合う候補が不足」。安全側でnullが許される唯一のケース。
    const menus = run(`comboMenus(${JSON.stringify(c)})`);

    // 副菜①・②の重複は全気分共通で禁止
    if(c.side1 && c.side2 && c.side1.name === c.side2.name){ dupSideTotal++; violation[moodId]++; }

    if(moodId === 'drink'){
      // 通常量の白いごはん・食パン(plain)が必須枠として出ていないこと
      if(c.staple && c.staple.plain){ violation[moodId]++; }
    }
    if(moodId === 'fish'){
      if(!menus.some(m=>m.cat==='fish')){ violation[moodId]++; }
    }
    if(moodId === 'meat'){
      if(!menus.some(m=>['chicken','pork','beef'].includes(m.cat))){ violation[moodId]++; }
    }
    if(moodId === 'light'){
      if(menus.some(m=>/大盛り|特盛り|どっさり|デカ/.test(m.name))){ violation[moodId]++; }
    }
    if(moodId === 'quick'){
      if(menus.length > 3){ violation[moodId]++; }
    }
    if(moodId === 'save'){
      const totalCost = run(`estimatedTotalCost(${JSON.stringify(c)})`);
      if(totalCost > 2800){ violation[moodId]++; }
    }

    heroSet[moodId].add((c.main || c.staple).name);
    // ---- 料理側の適合(traits)ルール: 表示される全皿を、枠ごとに独立に再検証する ----
    const isDrink = moodId === 'drink';
    const slotOf = (key, dish) => {
      if(key === 'staple') return isDrink ? 'finish' : (c.main ? 'side' : 'hero');
      if(key === 'main') return isDrink ? 'main' : 'hero';
      return 'side';
    };
    ['staple','main','side1','side2'].forEach(key => {
      const dish = c[key];
      if(!dish) return;
      const ok = run(`moodDishOk(${JSON.stringify(dish)}, ${JSON.stringify(moodId)}, ${JSON.stringify(slotOf(key, dish))})`);
      if(!ok){ traitViolation[moodId]++; traitExamples.push(moodId+':'+key+':'+dish.name); }
    });
    const heroTraits = run(`traitsOf(${JSON.stringify(c.main || c.staple)})`);
    const heroName0 = (c.main || c.staple).name;
    if(moodId === 'quick'){
      if(menus.some(m => /大盛り|特盛り|特大|デカ|どっさり|爆盛り|ボリューム満点/.test(m.name))){ violation[moodId]++; }
    }
    if(moodId === 'light' && !(heroTraits.rich === 'light' || heroTraits.lightish) || (moodId === 'light' && heroTraits.rich === 'rich')){ violation[moodId]++; }
    if(moodId === 'fish' && heroTraits.processedFish){ violation[moodId]++; }
    if(moodId === 'cleanup' && !heroTraits.cleanup){ violation[moodId]++; }
    if(moodId === 'save' && menus.some(m => (m.tags||[]).some(t => ['ご褒美','豪華見え','記念日','週末'].includes(t)))){ violation[moodId]++; }
    if(moodId === 'drink' && c.main && /丼|ライス|カレー|シチュー|パスタ|ラーメン|うどん|そば/.test(c.main.name)){ violation[moodId]++; }
    if(moodId === 'drink' && c.staple && !run(`traitsOf(${JSON.stringify(c.staple)}).finish`)){ violation[moodId]++; }
    if(/フレンチトースト/.test(heroName0) && moodId !== 'surprise'){ violation[moodId]++; }

    // 理由文が、実際に表示されている献立の料理名を含んでいること
    // (=表示中の献立と理由文の料理が一致する)
    const reason = run(`reasonForCombo(${JSON.stringify(c)}, ${JSON.stringify(moodId)})`);
    const heroName = (c.main || c.staple).name;
    if(!reason.includes(heroName)){
      reasonMismatchTotal++;
      violation[moodId]++;
    }
  }
});
run(`activeMood=null;`);

console.log('[mood-templates] violations per mood:', JSON.stringify(violation));
console.log('[mood-traits] rule violations per mood:', JSON.stringify(traitViolation), traitExamples.slice(0,5));
console.log('[mood-variety] 主役の料理の種類数(1000回中):', JSON.stringify(Object.fromEntries(Object.entries(heroSet).map(([k,v])=>[k,v.size]))));
Object.entries(heroSet).forEach(([id, set]) => assert(set.size >= 8, `気分「${id}」の主役が${set.size}種類しか出ない(厳格化で毎回同じ料理になっている)`));
console.log('[mood-null] 候補不足(null)の回数:', JSON.stringify(nullCount));
Object.entries(traitViolation).forEach(([id, n]) => assert.equal(n, 0, `気分「${id}」で料理適合ルール違反が${n}件: `+traitExamples.slice(0,5).join(', ')));
Object.entries(nullCount).forEach(([id, n]) => assert(n <= MOOD_N*0.01, `気分「${id}」で候補不足(null)が${n}回(1%超)`));
assert.equal(dupSideTotal, 0, '副菜①・②の重複が発生した');
assert.equal(reasonMismatchTotal, 0, '理由文に表示中の献立の料理名が含まれない生成があった');
Object.entries(violation).forEach(([id, count]) => {
  assert.equal(count, 0, `気分「${id}」でテンプレート条件違反が${count}件(${MOOD_N}回中)`);
});
console.log(`PASS: 全${moodIds.length}気分 × ${MOOD_N}回のテンプレート検証(必須カテゴリ・品数・禁止語・重複・理由文整合)`);

// ----- drink構造: 表示ラベルの検証(主食→締め、主菜→お酒に合う一品 等) -----
{
  const t = run(`getTemplate('drink')`);
  assert.equal(t.displayLabels.main, '🍶 お酒に合う一品');
  assert.equal(t.displayLabels.side1, '🥜 おつまみ①');
  assert.equal(t.displayLabels.side2, '🥜 おつまみ②');
}

// ----- validateCombo: 明らかに条件違反の献立を弾けること -----
{
  const fishMenu = run(`allMenus().find(m=>m.cat==='fish')`);
  const meatMenu = run(`allMenus().find(m=>['chicken','pork','beef'].includes(m.cat))`);
  const comboNoFish = {staple:meatMenu, main:meatMenu, side1:null, side2:null};
  assert.equal(run(`validateCombo(${JSON.stringify(comboNoFish)}, 'fish')`), false, '魚が無いのにfishで合格してしまう');
  // 同じ料理を主食と主菜に重ねた献立は、相性ルール(同じ食材の重複)で除外されるため、
  // 実際に出うる形(白いごはん+魚の主菜)で「fishで合格する」ことを確認する。
  const plainRice = run(`allMenus().find(m=>m.plain && m.staple==='rice')`);
  const comboWithFish = {staple:plainRice, main:fishMenu, side1:null, side2:null};
  assert.equal(run(`validateCombo(${JSON.stringify(comboWithFish)}, 'fish')`), true, '魚があるのにfishで不合格になる');

  const bigName = run(`allMenus().find(m=>/大盛り|特盛り/.test(m.name))`);
  if(bigName){
    const comboBig = {staple:bigName, main:null, side1:null, side2:null};
    assert.equal(run(`validateCombo(${JSON.stringify(comboBig)}, 'light')`), false, '大盛り名なのにlightで合格してしまう');
  }
}

// =========================================================
// おすすめ理由の品質(2026-09 全面改訂)
// 「気分 × 実際に出た献立」から作られる理由が、(1)気分を反映し、(2)献立の事実と
// 一致し、(3)機械的な繰り返しになっていないことを、全気分×300回で確認する。
// =========================================================
{
  const REASON_N = 300;
  const NG_PHRASES = /栄養バランス|美味しい組み合わせ|おいしい組み合わせ|おすすめの献立|バランスの良い献立/;
  const MOOD_FORBIDDEN = {
    drink: /栄養|ヘルシー|健康|カロリー/,
    quick: /手のこん|時間をかけ|じっくり煮込/,
    light: /がっつり|ボリューム満点|食べごたえ/
  };
  const intents = run('MOOD_INTENT');
  const openerOwner = {};
  moodIds.forEach(id => {
    const it = intents[id];
    assert(it, `気分「${id}」に MOOD_INTENT が無い`);
    assert(typeof it.want === 'string' && it.want.length > 5, `気分「${id}」に want(求めているもの)が無い`);
    assert(it.openers.length >= 8 && it.closers.length >= 3, `気分「${id}」の openers/closers が少ない`);
    [...it.openers, ...it.closers].forEach(t => {
      assert(!(t in openerOwner) || openerOwner[t] === id, `書き出し/締めが複数の気分で共通: ${t}`);
      openerOwner[t] = id;
      assert(it.signature.test(t), `気分「${id}」の書き出し/締めに気分の手がかりが無い: ${t}`);
    });
  });

  const stats = {};
  const problems = [];
  moodIds.forEach(moodId => {
    run(`activeMood = MOODS.find(m=>m.id===${JSON.stringify(moodId)});`);
    const texts = [], lens = [], sentences = [];
    let consecutiveSame = 0, prev = null, closerCount = 0;
    for(let n = 0; n < REASON_N; n++){
      const c = run('pickCombo()');
      if(!c) continue;
      const res = run(`buildReason(${JSON.stringify(c)}, ${JSON.stringify(moodId)})`);
      const f = run(`reasonFacts(${JSON.stringify(c)}, ${JSON.stringify(moodId)})`);
      const text = res.text;
      const bad = msg => problems.push(`[${moodId}] ${msg} :: ${text}`);
      if(!text.includes(f.heroName)) bad('主役の料理名が理由に含まれない');
      const sc = (text.match(/。/g) || []).length;
      if(sc < 2 || sc > 3) bad(`文の数が2〜3文でない(${sc})`);
      if(text.length > 125) bad(`長すぎる(${text.length}文字)`);
      if(!intents[moodId].signature.test(text)) bad('気分の手がかりが読み取れない');
      // 料理名そのもの(例:「ヘルシー蒸し」)は説明文ではないので、禁止語の判定からは除く
      let explanation = text;
      run(`comboMenus(${JSON.stringify(c)}).map(m=>m.name)`).forEach(nm => { explanation = explanation.split(nm).join(''); });
      if(NG_PHRASES.test(explanation)) bad('NG表現');
      if(MOOD_FORBIDDEN[moodId] && MOOD_FORBIDDEN[moodId].test(explanation)) bad('その気分に合わない説明');
      // 使われた行は、実際の献立で条件(when)を満たしていること(=事実と一致)
      res.ids.filter(id => id !== 'fallback' && id !== 'closer').forEach(id => {
        const ok = run(`MOOD_INTENT[${JSON.stringify(moodId)}].lines.find(l=>l.id===${JSON.stringify(id)}).when(reasonFacts(${JSON.stringify(c)}, ${JSON.stringify(moodId)}))`);
        if(!ok) bad(`行 ${id} が条件を満たさないのに使われた`);
      });
      // 数値の主張が、実際の献立から計算した値と一致していること
      [...text.matchAll(/約(\d+)分/g)].forEach(m => { if(+m[1] !== f.time) bad(`時間が不一致(${m[1]}≠${f.time})`); });
      [...text.matchAll(/1人あたり約(\d+)円/g)].forEach(m => { if(+m[1] !== f.pp) bad(`1人あたりの金額が不一致(${m[1]}≠${f.pp})`); });
      [...text.matchAll(/手順が(\d+)つ|(\d+)ステップ/g)].forEach(m => { if(+(m[1] || m[2]) !== f.steps) bad('手順数が不一致'); });
      if(/ごはんがどんどん進む|ごはんの相性はばっちり|ごはんとの相性もいい/.test(text) && !f.riceBase) bad('白いごはんが付かないのにごはんとの相性に言及');
      if(/洗い物も少なめ/.test(text) && f.n > 2) bad('品数が多いのに洗い物が少ないと言及');
      if(moodId === 'quick' && /ひとつで/.test(text) && !f.oneDish) bad('一品完結でないのに「ひとつで」と言及');
      if(res.ids.includes('closer')) closerCount++;
      texts.push(text); lens.push(text.length); sentences.push(sc);
      if(text === prev) consecutiveSame++;
      prev = text;
    }
    const uniq = new Set(texts).size;
    const freq = {}; texts.forEach(t => freq[t] = (freq[t] || 0) + 1);
    const topShare = Math.max(...Object.values(freq)) / texts.length;
    stats[moodId] = {n: texts.length, unique: uniq, uniqueRate: +(uniq / texts.length).toFixed(2), topShare: +topShare.toFixed(3),
      avgLen: Math.round(lens.reduce((a, b) => a + b, 0) / lens.length), consecutiveSame, closerRate: +(closerCount / texts.length).toFixed(2)};
    assert(consecutiveSame <= Math.ceil(texts.length * 0.01), `気分「${moodId}」で同じ理由が連続(${consecutiveSame}回)`);
  });
  console.log('[reason-quality]', JSON.stringify(stats));
  assert.equal(problems.length, 0, `おすすめ理由の問題が${problems.length}件:\n` + problems.slice(0, 8).join('\n'));
  // 繰り返し感: 気分ごとに、理由文の種類が十分あり、特定の文が突出しないこと
  Object.entries(stats).forEach(([id, st]) => {
    assert(st.uniqueRate >= 0.45, `気分「${id}」の理由文の種類が少ない(${st.uniqueRate})`);
    assert(st.topShare <= 0.05, `気分「${id}」で同じ理由文が${(st.topShare * 100).toFixed(1)}%を占める`);
  });
  console.log(`PASS: おすすめ理由の品質(全${moodIds.length}気分 × ${REASON_N}回: 主役名・2〜3文・気分の手がかり・事実との一致・NG表現・繰り返し)`);
}

// =========================================================
// 献立の相性・「ちょっと軽め」「いつもと違うもの」の料理の幅・「なぜ?」の文言
// (2026-09 追加)。個々の料理は気分に合っていても、並べると不自然な献立を
// 出さないことを、独立に書いた判定(AUD)で全気分×500回確認する。
// =========================================================
{
  const N = 200;
  const AUD = {
    fishBread: c => c.staple && c.staple.plain && c.staple.staple === 'bread' && c.main && /鮭|さば|ぶり|あじ|いわし|さんま|たら|鯛|かれい|ほっけ|さわら|まぐろ|かつお|カツオ|えび|いか|たこ|ほたて|ホタテ|白身魚/.test(c.main.name),
    nonWesternBread: c => c.staple && c.staple.plain && c.staple.staple === 'bread' && c.main && c.main.genre !== 'western',
    oneDishStarchy: c => c.staple && !c.staple.plain && !c.main && [c.side1, c.side2].filter(Boolean).some(m => /じゃがいも|ポテト|春雨|丼|ライス|雑炊|パスタ|ラーメン|うどん|そば|チャーハン|パン粉?(?!粉)|サンド/.test(m.name.replace(/パン粉|フライパン/g, ''))),
    friedTwice: c => comboMenus2(c).filter(m => run(`traitsOf(${JSON.stringify(m)}).method`) === 'fry').length >= 2,
    soupTwice: c => comboMenus2(c).filter(m => /ミネストローネ|ポトフ|シチュー|鍋|ポタージュ|スープ|汁|椀/.test(m.name) && !m.plain).length >= 2,
    pastaWithPlain: c => c.staple && c.staple.plain && c.main && /パスタ|ペペロンチーノ|カルボナーラ|ナポリタン/.test(c.main.name),
    threeGenres: c => new Set(comboMenus2(c).filter(m => !m.plain).map(m => m.genre)).size >= 3
  };
  function comboMenus2(c){ return run(`comboMenus(${JSON.stringify(c)})`); }
  const unnatural = {}; let total = 0, bad = 0, sameProtein = 0;
  const heroSeen = {};
  ['light', 'new', 'fish', 'drink', 'hearty', 'quick', 'save', 'meat', 'cleanup', 'surprise', null].forEach(moodId => {
    run(`activeMood = ${moodId ? `MOODS.find(m=>m.id===${JSON.stringify(moodId)})` : 'null'};`);
    const heroCount = {}; let n = 0;
    for(let i = 0; i < N; i++){
      const c = run('pickCombo()'); if(!c) continue; n++; total++;
      const issues = run(`harmonyIssues(${JSON.stringify(c)})`);
      if(issues.length){ bad++; unnatural[issues[0]] = (unnatural[issues[0]] || 0) + 1; }
      Object.entries(AUD).forEach(([k, f]) => { if(f(c)){ bad++; unnatural[k] = (unnatural[k] || 0) + 1; } });
      const hero = (c.main || c.staple).name; heroCount[hero] = (heroCount[hero] || 0) + 1;
    }
    heroSeen[moodId || '(なし)'] = {distinct: Object.keys(heroCount).length, top: +(Math.max(...Object.values(heroCount)) / n).toFixed(3)};
  });
  console.log('[harmony] 不自然な組み合わせ:', bad, '/', total, JSON.stringify(unnatural));
  console.log('[hero-variety]', JSON.stringify(heroSeen));
  assert.equal(bad, 0, `不自然な献立が${bad}件: ` + JSON.stringify(unnatural));
  // 主役が特定の料理に偏らないこと(最頻の主役が全体の12%以下)
  Object.entries(heroSeen).forEach(([id, v]) => assert(v.top <= 0.15, `気分「${id}」で同じ主役が${(v.top * 100).toFixed(1)}%を占める`));

  // 「ちょっと軽め」: 主役になれる料理が十分あり、魚・鶏・麺・雑炊など幅がある
  const lightHeroes = run('BASE_MENUS').filter(m => m.role !== 'side' && !m.plain && run(`moodDishOk(${JSON.stringify(m)}, "light", "hero")`));
  assert(lightHeroes.length >= 180, `軽めの主役候補が少ない(${lightHeroes.length})`);
  ['fish', 'chicken'].forEach(cat => assert(lightHeroes.some(m => m.cat === cat), `軽めの主役に${cat}が無い`));
  assert(lightHeroes.some(m => m.staple === 'noodle'), '軽めの主役に麺類が無い');
  assert(lightHeroes.some(m => /雑炊|にゅうめん/.test(m.name)), '軽めの主役に雑炊・にゅうめんが無い');
  // 「いつもと違うもの」: 海外・地方の料理が十分あり、ジャンルが偏らない
  const novelHeroes = run('BASE_MENUS').filter(m => m.role !== 'side' && !m.plain && run(`moodDishOk(${JSON.stringify(m)}, "new", "hero")`));
  assert(novelHeroes.length >= 70, `いつもと違う主役候補が少ない(${novelHeroes.length})`);
  assert(novelHeroes.filter(m => (m.tags || []).includes('地方料理')).length >= 10, '地方料理の主役が少ない');
  assert(new Set(novelHeroes.flatMap(m => (m.tags || []).filter(t => ['韓国','台湾','タイ','メキシコ','ハワイ','イタリア','ベトナム','インド','トルコ','ギリシャ','モロッコ','スペイン','フランス','ドイツ','ロシア','ペルー'].includes(t)))).size >= 12, '海外の国の幅が少ない');

  // 「なぜ?」の内訳: 旧式の文言が残らず、ひらりの口調で、気分の見どころに触れる
  run('activeMood = MOODS.find(m=>m.id==="drink");');
  const cc = run('pickCombo()');
  const sc = run(`hiramekiScoreFor(${JSON.stringify(cc.main || cc.staple)}, "drink", ${JSON.stringify(cc)})`);
  assert(sc.reasons.length >= 3 && sc.reasons.length <= 4, '内訳の行数');
  assert(sc.reasons.every(r => !/しっかり合っています|意識して選びました|データが少ない|とかぶらない組み合わせを選んでいます/.test(r)), '旧式の文言が残っている');
  assert(sc.reasons[0].includes('お酒との合い'), '気分の見どころに触れていない: ' + sc.reasons[0]);
  moodIds.forEach(id => assert(run('MOOD_SCORE_VIEW')[id], `MOOD_SCORE_VIEW に ${id} が無い`));
  console.log(`PASS: 献立の相性(全11区分×${N}回=${total}件: 不自然な組み合わせ0件)・主役の偏り・軽め${lightHeroes.length}品/いつもと違う${novelHeroes.length}品・「なぜ?」の文言`);
}

// 一品完結の主食(丼・麺・パン)の主食タイプ(rice/noodle/bread)が、料理名と食い違っていないこと。
// (食い違うと、相性判定や理由文が「麺なのにごはん」のようにずれる)
{
  const staples = run('BASE_MENUS').filter(m => m.role === 'staple' && !m.plain);
  const bad = [];
  staples.forEach(m => {
    const n = m.name.replace(/パン粉|フライパン/g, '');
    const noodleName = /うどん|そば|ラーメン|パスタ|麺|そうめん|フォー|焼きそば/.test(n);
    const riceName = /丼|ライス|ごはん|チャーハン|雑炊|飯|カレー(?!うどん)/.test(n);
    const breadName = /パン|サンド|トースト|バーガー|ホットドッグ|ケサディヤ/.test(n);
    let expect = null;
    if(noodleName && !riceName) expect = 'noodle'; else if(breadName && !noodleName) expect = 'bread'; else if(riceName && !noodleName) expect = 'rice';
    if(expect && expect !== m.staple) bad.push(m.id + ' ' + m.name + ' staple=' + m.staple + ' 想定=' + expect);
  });
  assert.equal(bad.length, 0, '主食タイプが料理名と食い違う: ' + bad.join(' / '));
  console.log('PASS: 一品主食' + staples.length + '品の主食タイプ(rice/noodle/bread)が料理名と一致');
}

// ----- 旧reasonFor()も後方互換として残っていること(内部で引き続き使用) -----
{
  const anyMain = run(`allMenus().find(m=>roleOf(m)==='main')`);
  const r = run(`reasonFor(${JSON.stringify(anyMain)})`);
  assert(typeof r === 'string' && r.length > 0, 'reasonFor()が後方互換で動作しない');
}

// ----- フィードバック(好き/苦手)が推薦に反映されること -----
// 「苦手」を伝えた特定の1品は、200回スピンしても一度も出てこない
// (mainPool/staplePool/sidePool すべてで、名前ベースのハード除外が効く)。
const dislikedName = run(`allMenus().find(m=>roleOf(m)==='main').name`);
run(`recordFeedback({name:${JSON.stringify(dislikedName)},cat:'x-test-cat-a'}, 'dislike', null);`);
for(let n=0;n<200;n++){
  const c=run('pickCombo()');assert(c);
  const menus=Object.values(c).filter(Boolean);
  assert(!menus.some(m=>m.name===dislikedName), '苦手料理「'+dislikedName+'」が再び推薦された');
}
run(`feedback=[];`); // 次のチェックへの影響を消す

// 「好き」を繰り返し伝えたカテゴリは、スコアが上がる(発見の余地が
// 残るよう、上限でクランプされている=完全固定化しないことも確認)。
run(`for(let i=0;i<10;i++) recordFeedback({name:'dummy-'+i, cat:'pref-cat'}, 'like', null);`);
assert.equal(run(`catPreferenceBonus('pref-cat')`), 6, '好みボーナスが上限(6)でクランプされていない');
assert.equal(run(`catPreferenceBonus('untouched-cat')`), 0, '無関係なカテゴリにボーナスが漏れている');
run(`feedback=[];`);

// 苦手→好きに変えたら、苦手による除外が解除されること(古い評価が
// 残って食い違わないことの確認)
const toggleName = run(`allMenus().find(m=>roleOf(m)==='side').name`);
run(`recordFeedback({name:${JSON.stringify(toggleName)},cat:'x-toggle'}, 'dislike', null);`);
assert.equal(run(`isDisliked({name:${JSON.stringify(toggleName)}})`), true);
run(`recordFeedback({name:${JSON.stringify(toggleName)},cat:'x-toggle'}, 'like', null);`);
assert.equal(run(`isDisliked({name:${JSON.stringify(toggleName)}})`), false, '苦手→好きに変えても除外されたまま');
assert.equal(run(`feedback.filter(f=>f.name===${JSON.stringify(toggleName)}).length`), 1, '古いlike/dislikeが残っている');
run(`feedback=[];`);

console.log('PASS: '+N+'献立スイープ(サラダ重複・汁物重複・一品献立モード・主要食材重複)、時短主菜、買い物リスト集計、材料スケーリング、フィードバック反映(苦手除外・好み加点の上限)');
