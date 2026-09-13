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
var sessionMainHistory=[],sessionStapleHistory=[],sessionSideHistory=[],history=[];
var SALAD_STYLE_RE=/サラダ|マリネ|ラペ|コールスロー|酢の物|なます/;
var FRIED_STYLE_RE=/揚げ|フライ|カツ|唐揚げ|竜田揚げ/;
var VEG_CATS=['onion','carrot','green_onion','tomato','lettuce','cabbage','potato','burdock','bell_pepper','chives','daikon'];
var SOUP_STYLE_RE=/味噌汁|スープ/;`);
for(const name of ['allMenus','roleOf','pickRandom','recentNamesByRole','matchesGenreWeight','matchesMood','topScoringBand','scoreMain','mainPool','scoreStaple','staplePool','isSaladStyle','scoreSide','sidePool','comboMenus','pickCombo','scaleNumber','scaleIngredientText','servingsRatio','shoppingRows']){
 const re=new RegExp('  function '+name+'\\([^]*?\\n  \\}');
 let fn=source.match(re)?.[0];
 if(!fn){fn=source.match(new RegExp('  function '+name+'\\([^\\n]+'))?.[0];}
 assert(fn,name);run(fn);
}
assert.equal(run(`scaleIngredientText('卵6個',.4)`),'卵2個');
assert.equal(run(`scaleIngredientText('卵3個',.2)`),'卵1個');
assert.equal(run(`scaleIngredientText('6Pチーズ100g',.4)`),'6Pチーズ40g');
assert.equal(run(`scaleIngredientText('食パン(8枚切り)8枚',.5)`),'食パン(8枚切り)4枚');
assert.equal(run(`scaleIngredientText('しょうゆ大さじ2',.4)`),'しょうゆ大さじ3/4');
assert.equal(run(`scaleIngredientText('コーン缶1/2缶',.4)`),'コーン缶1/4缶');
assert.equal(run(`allMenus().some(m=>m.id==='b115')`),false);
run(`var c={staple:{name:'A',ing:['卵6個','水100ml','塩少々']},main:{name:'B',ing:['卵3個','水200ml','水大さじ2']},side1:null,side2:null};`);
const rows=run('shoppingRows(c)');
assert.equal(rows.find(r=>r.name==='卵').qty,3);
assert.equal(rows.find(r=>r.name==='水'&&r.unit==='ml').qty,120);
assert(rows.some(r=>r.text==='塩少々'));
for(let n=0;n<500;n++){
 const c=run('pickCombo()');assert(c);
 const menus=Object.values(c).filter(Boolean);
 assert(menus.filter(m=>/味噌汁|スープ/.test(m.name)).length<=1);
 assert(!/フレンチトースト/.test(c.staple.name));
 assert(!/味噌汁|スープ/.test(c.main.name));
}
run(`activeMood={id:'quick',filter:m=>typeof m.cookingTime==='number'&&m.cookingTime<=15};`);
for(let n=0;n<100;n++){
 const c=run('pickCombo()');assert(c);assert.equal(c.side1,null);assert.equal(c.side2,null);assert(c.main.cookingTime<=15);
}
console.log('PASS: 600献立、汁物重複、時短2品、卵丸め、食材名保護、分数、同一単位の材料集約');
