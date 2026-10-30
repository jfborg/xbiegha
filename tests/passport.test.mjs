import test from 'node:test';
import assert from 'node:assert/strict';
import { countries, documentSpec, passportDimensions } from '../src/passport.ts';
import { passportChecks, exportProblems, manualChecks, dateIsRecent, sourceScale, assessmentKey, validateFileSize } from '../src/compliance.ts';
import { visionFindings } from '../src/visionRules.ts';
import { sheetPositions } from '../src/geometry.ts';
const now = new Date(2026,9,30,12);
const photo = {id:'original',src:'data:image/jpeg;base64,fixture',width:3000,height:4000,x:0,y:0,zoom:1,rotation:0,flip:false};
const project = (country='ae-passport', passport={}) => ({mode:'passport',country,photos:[{...photo}],passport:{takenOn:'2026-10-30',age:'adult',...passport}});
const check = (p,id) => passportChecks(p,now).find(c=>c.id===id);

test('catalogue includes 14 regions and all three UAE driving routes',()=>{
  assert.equal(new Set(Object.values(countries).map(s=>s.region)).size,14);
  assert.equal(Object.keys(countries).length,20);
  for (const id of ['ae-dl-dubai','ae-dl-abudhabi','ae-dl-moi','ae-passport-upload','ae-id-upload']) assert.equal(documentSpec(id).route,'custom');
  for (const id of ['mt','uk','us']) assert.ok(countries[id]);
  for (const s of Object.values(countries)) { assert.ok(s.source.startsWith('https://')); assert.ok(s.width>0 && s.height>0); }
});
test('physical and digital exports use the chosen document dimensions',()=>{
  const uae = passportDimensions(countries['ae-id']); assert.equal(uae.width,827);assert.equal(uae.height,1063);assert.equal(uae.dpi,600);
  assert.equal(passportDimensions(countries.us).width,1200);
  assert.equal(passportDimensions(countries.ca).height,1654);
  assert.deepEqual([passportDimensions(countries.sg).width,passportDimensions(countries.sg).height],[400,514]);
  assert.equal(passportDimensions(countries.nz).printable,false);
  assert.equal(countries.fr.backgroundTone,'not-white');
  for(const s of Object.values(countries).filter(s=>s.route==='print')) assert.ok(sheetPositions(s.width,s.height).length>0);
});
test('custom application contracts reject missing limits, tiny, fractional or excessive dimensions',()=>{
  for(const passport of [{},{width:600,height:800},{width:.1,height:.1,maxKB:0},{width:10000,height:800,maxKB:0},{width:600.5,height:800,maxKB:0}]) assert.equal(check(project('ae-dl-dubai',passport),'contract').pass,false);
  assert.equal(check(project('ae-dl-moi',{width:600,height:800,unit:'px',maxKB:240}),'contract').pass,true);
  assert.equal(check(project('ae-dl-abudhabi',{width:35,height:45,unit:'mm',dpi:400,maxKB:0}),'contract').pass,true);
  const invalid=passportDimensions(countries['ae-dl-dubai'],{width:.1,height:.1});assert.ok(invalid.width>=100 && invalid.height>=100);
});
test('capture date uses calendar-month limits and rejects missing, future and invalid dates',()=>{
  assert.equal(dateIsRecent('2026-04-30',6,now),true); assert.equal(dateIsRecent('2026-04-29',6,now),false);
  assert.equal(dateIsRecent('2026-10-31',6,now),false);assert.equal(dateIsRecent('2026-02-30',6,now),false);assert.equal(dateIsRecent(undefined,6,now),false);
  assert.equal(dateIsRecent('2026-02-28',1,new Date(2026,2,31,12)),true);
});
test('measured framing, original, mirror, child and resolution guards block unsafe exports',()=>{
  assert.equal(check(project(),'fill').pass,true);
  assert.equal(check(project('ae-id',{crown:10,chin:95}),'fill').pass,false);
  assert.equal(check(project('jp',{crown:20,chin:95}),'margin').pass,false);
  assert.equal(check(project('nl',{faceLeft:10,faceRight:90}),'width').pass,false);
  assert.equal(check(project('us',{crown:10,chin:75}),'head').pass,true);
  assert.equal(check({...project(),photos:[{...photo,src:'/samples/portrait.jpg'}]},'photo').pass,false);
  assert.equal(check({...project(),photos:[{...photo,flip:true}]},'mirror').pass,false);
  assert.equal(check(project('us',{age:'child'}),'adult').pass,false);
  assert.equal(check({...project(),photos:[{...photo,width:400,height:600}]},'resolution').pass,false);
  assert.ok(sourceScale({...photo,rotation:90},1200,600)<=1);
});
test('export requires every confirmation including versioned terms, and file limits are strict',()=>{
  const p=project();const confirmations=Object.fromEntries(manualChecks(p).map(c=>[c.id,true]));
  assert.deepEqual(exportProblems(p,confirmations,now),[]);
  delete confirmations['terms-2026-10-30'];assert.ok(exportProblems(p,confirmations,now).some(c=>c.includes('Terms')));
  assert.equal(validateFileSize(project('sg'),8_000_000),'');assert.ok(validateFileSize(project('sg'),8_000_001));
  assert.ok(validateFileSize(project('nz'),249_999)); assert.equal(validateFileSize(project('nz'),250_000),'');
  assert.ok(validateFileSize(project('ae-id-upload',{maxKB:240}),240001));
});
test('assessment keys invalidate on crop, orientation, document and custom dimensions',()=>{
  const p=project();for(const next of [{...p,country:'us'},{...p,photos:[{...photo,x:.1}]},{...p,photos:[{...photo,zoom:1.2}]},{...p,passport:{...p.passport,width:800}}]) assert.notEqual(assessmentKey(p),assessmentKey(next));
  assert.equal(assessmentKey(p),assessmentKey({...p,passport:{...p.passport,takenOn:'2026-10-29'}}));
});
const metrics={faces:1,glasses:.01,backgroundMean:250,backgroundSpread:3,backgroundChroma:2,sharpness:100};
const finding=(m,id,rule='remove',background='white')=>visionFindings({...metrics,...m},rule,background).find(r=>r.id===id);
test('glasses detection blocks prohibited eyewear and explicitly flags uncertain/allowed results',()=>{
  assert.equal(finding({glasses:.95},'glasses').status,'fail');assert.match(finding({glasses:.95},'glasses').detail,/Glasses detected/);
  assert.equal(finding({glasses:.95},'glasses','clear').status,'review');assert.equal(finding({glasses:.5},'glasses').status,'review');assert.equal(finding({glasses:undefined},'glasses').status,'review');
  assert.equal(finding({glasses:.01},'glasses').status,'clear');
});
test('automatic checks block missing/multiple faces, turned heads, smiles and closed eyes',()=>{
  for(const faces of [0,2]) assert.equal(visionFindings({faces})[0].status,'fail');
  assert.equal(finding({yaw:20},'pose').status,'fail');assert.equal(finding({smile:.8},'expression').status,'fail');assert.equal(finding({mouthOpen:.5},'expression').status,'fail');assert.equal(finding({blink:.9},'eyes').status,'fail');
  assert.equal(finding({colourChroma:0},'colour').status,'fail');
  assert.equal(finding({},'background','clear','not-white').status,'review');assert.equal(finding({sharpness:5},'sharpness').status,'review');
});
