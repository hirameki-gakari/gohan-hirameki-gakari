const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('  var CATS ='));
const context={};vm.createContext(context);
function run(s){return vm.runInContext(s,context);}
const base=source.slice(source.indexOf('var BASE_MENUS ='),source.indexOf('  var GENRES ='));
run(base);
run(`var customMenus=[], SLOTS=['staple','main','side1','side2'], servings=2, BASE_SERVINGS=5;
var selectedCats=[],selectedGenres=[],selectedWeights=[],selectedStaple=[],activeMood=null;
var sessionMainHistory=[],sessionStapleHistory=[],sessionSideHistory=[],history=[];`);

// 定数(SALAD_STYLE_RE, HEAVY_CATSなど)は手打ちコピーせず、ソースから
// そのまま抜き出して評価する(実装とテストの二重管理によるズレを防ぐ)。
for(const name of ['SALAD_STYLE_RE','FRIED_STYLE_RE','VEG_CATS','SOUP_STYLE_RE','METHOD_RULES','TASTE_RULES','HEAVY_CATS']){
  const re=new RegExp('  var '+name+' = [^;]+;', 's');
  const decl=source.match(re)?.[0];
  assert(decl, name+' declaration not found in source');
  run(decl);
}

for(const name of ['allMenus','roleOf','pickRandom','recentNamesByRole','matchesGenreWeight','matchesMood','topScoringBand',
  'scoreMain','mainPool','scoreStaple','staplePool','isSaladStyle','isSoupStyle','isOneDishStaple',
  'cookingMethodOf','tasteTagsOf','heavyCatOf','scoreSide','sidePool','soupPool','lightSidePool','pickCombo',
  'comboMenus','shoppingRows','scaleNumber','scaleIngredientText','servingsRatio']){
 const re=new RegExp('  function '+name+'\\([^]*?\\n  \\}');
 let fn=source.match(re)?.[0];
 if(!fn){fn=source.match(new RegExp('  function '+name+'\\([^\\n]+'))?.[0];}
 assert(fn,name);run(fn);
}

// ----- 材料スケーリング(既存の仕様。今回の変更範囲外だが、破壊していないことを確認) -----
assert.equal(run(`scaleIngredientText('卵6個',.4)`),'卵2.5個');
assert.equal(run(`scaleIngredientText('卵3個',.2)`),'卵1/2個');
assert.equal(run(`scaleIngredientText('6Pチーズ100g',.4)`),'2.5Pチーズ40g'); // 既知の別課題: "6P"のような商品名内の数字も一緒にスケールされてしまう(今回のスコープ外)
assert.equal(run(`scaleIngredientText('食パン(8枚切り)8枚',.5)`),'食パン(4枚切り)4枚'); // 既知の別課題: 括弧内の商品仕様の数字もスケールされてしまう(今回のスコープ外)
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

// ----- pickCombo() 大規模スイープ -----
const N = 800;
let oneDishCount = 0, teishokuCount = 0, soupPresentCount = 0;
for(let n=0;n<N;n++){
  const c=run('pickCombo()');
  assert(c, 'pickCombo returned null on iteration '+n);

  // salad: 最大1品
  const saladCount = ['staple','main','side1','side2'].filter(k=>c[k]&&run(`isSaladStyle(${JSON.stringify(c[k])})`)).length;
  assert(saladCount<=1, 'salad duplicated: '+JSON.stringify(c));

  // soup: 最大1品
  const soupCount = ['staple','main','side1','side2'].filter(k=>c[k]&&run(`isSoupStyle(${JSON.stringify(c[k])})`)).length;
  assert(soupCount<=1, 'soup duplicated: '+JSON.stringify(c));
  if(soupCount>0) soupPresentCount++;

  // 一品献立モード: staple.plain===false(=一品完結)なら main は必ず null
  const isOneDish = run(`isOneDishStaple(${JSON.stringify(c.staple)})`);
  if(isOneDish){
    oneDishCount++;
    assert.equal(c.main, null, 'one-dish mode should not have a separate main: '+c.staple.name+' + '+ (c.main&&c.main.name));
  }else{
    teishokuCount++;
    assert(c.main, 'teishoku mode should have a main: staple='+c.staple.name);
  }

  // 主要食材(HEAVY_CATS)の重複チェック: 存在する非nullの料理間で、
  // 同じ主要食材カテゴリが2回以上使われていないか(staple自体は一品完結型だと
  // 主菜を兼ねるため対象外、teishoku型のstapleはplainなのでcatは対象外)
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
console.log('one-dish:', oneDishCount, 'teishoku:', teishokuCount, 'soup-present:', soupPresentCount, '/', N);

// ----- 時短ムード: 主菜のcookingTime<=15が守られる(既存仕様) -----
run(`activeMood={id:'quick',filter:m=>typeof m.cookingTime==='number'&&m.cookingTime<=15};`);
for(let n=0;n<100;n++){
  const c=run('pickCombo()');assert(c);
  if(c.main) assert(c.main.cookingTime<=15, 'quick mood main too slow: '+c.main.name);
}
run(`activeMood=null;`);

console.log('PASS: '+N+'献立スイープ(サラダ重複・汁物重複・一品献立モード・主要食材重複)、時短主菜、買い物リスト集計、材料スケーリング');
