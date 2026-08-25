import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { DATA, LOGO_B64 } from './data.js';

Chart.register(...registerables);

/* =========================================================
   FIELD INDEX MAP (matches Python extraction order)
   ========================================================= */
const F = {
  REGION:0, URBAN:1, GENDER:2, GEN:3, EDU:4, INCOME:5, REV:6, OREV:7, OSHARE:8, DMI:9,
  DMI_S:10, DMI_ST:11, DMI_P:12, DMI_PPL:13, DMI_C:14, REGC:15, REGE:16,
  PLAT:17, PLAT_N:9,
  OFFL:26, OFFL_N:5,
  PAY:31, PAY_N:11,
  SHIP:42, SHIP_N:9,
  BARR:51, BARR_N:9,
  CAT:60, CAT_N:16,
  C2B:76, C2C:77, C2G:78, C2B_REV:79, C2C_REV:80, C2G_REV:81
};

const C = {
  gold:'#E0932A', goldDim:'#B9761C', teal:'#0FA89A', tealDim:'#0C7B70',
  coral:'#E1544A', violet:'#6C63C7', text:'#1A2233', textMid:'#5B6478', textDim:'#8891A0',
  grid:'rgba(20,33,61,0.07)', card:'#FFFFFF', gray:'#4A5170'
};

const DMI_LEVELS = [
  {name:'Digital Novice',   min:0.00, max:1.75, color:'#E1544A'},
  {name:'Digital Follower', min:1.76, max:2.50, color:'#E0932A'},
  {name:'Digital Native',   min:2.51, max:3.25, color:'#0FA89A'},
  {name:'Digital Champion', min:3.26, max:4.00, color:'#6C63C7'}
];
function dmiLevel(score){ for(const lv of DMI_LEVELS){ if(score<=lv.max) return lv; } return DMI_LEVELS[DMI_LEVELS.length-1]; }
function renderLevelLegend(id){
  const el=document.getElementById(id); if(!el) return;
  el.innerHTML = DMI_LEVELS.map(lv=>`<div class="item"><span class="dot" style="background:${lv.color}"></span>${lv.name} (${lv.min.toFixed(2)}–${lv.max.toFixed(2)})</div>`).join('');
}
function fmtNum(n){ return Math.round(n).toLocaleString('en-US'); }
function pct(n,d){ return d>0 ? (n/d*100) : 0; }
function avg(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function corr(xs,ys){
  const n=xs.length; if(n<2) return 0;
  const mx=avg(xs), my=avg(ys);
  let cov=0,sx=0,sy=0;
  for(let i=0;i<n;i++){ cov+=(xs[i]-mx)*(ys[i]-my); sx+=(xs[i]-mx)**2; sy+=(ys[i]-my)**2; }
  if(sx===0||sy===0) return 0;
  return cov/Math.sqrt(sx*sy);
}

/* =========================================================
   FILTER ENGINE
   ========================================================= */
let ROWS = []; // set after data loads
let LOOKUPS = {};
const state = { region:-1, urban:-1, gen:-1, reg:-1 };

function matchRow(r, f, excludeDim){
  if(excludeDim!=='region' && f.region!==-1 && r[F.REGION]!==f.region) return false;
  if(excludeDim!=='urban'  && f.urban!==-1  && r[F.URBAN]!==f.urban) return false;
  if(excludeDim!=='gen'    && f.gen!==-1    && r[F.GEN]!==f.gen) return false;
  if(excludeDim!=='reg'    && f.reg!==-1    && r[F.REGE]!==f.reg) return false;
  return true;
}
function filterRows(excludeDim){
  return ROWS.filter(r => matchRow(r, state, excludeDim || null));
}

/* =========================================================
   AGGREGATION HELPERS
   ========================================================= */
function validNums(rows, idx, allowNeg){
  const out=[];
  for(const r of rows){ const v=r[idx]; if(v!==-1 || allowNeg) out.push(v); }
  return out;
}
function avgValid(rows, idx){
  const vals = rows.map(r=>r[idx]).filter(v=>v!==-1 && v!==null && v!==undefined);
  return avg(vals);
}
function pctFlag(rows, idx){
  if(!rows.length) return 0;
  const cnt = rows.reduce((a,r)=> a + (r[idx]===1?1:0), 0);
  return pct(cnt, rows.length);
}

function computeKPIs(rows){
  const n = rows.length;
  const revVals = rows.map(r=>r[F.REV]).filter(v=>v>=0);
  const orevVals = rows.map(r=>r[F.OREV]).filter(v=>v>=0);
  const dmiVals = rows.map(r=>r[F.DMI]).filter(v=>v>=0);
  const regEVals = rows.map(r=>r[F.REGE]).filter(v=>v===0||v===1);
  const regCVals = rows.map(r=>r[F.REGC]).filter(v=>v===0||v===1);
  const avgRev = avg(revVals), avgOrev = avg(orevVals);
  return {
    n, avgRev, avgOrev,
    onlineShare: avgRev>0 ? (avgOrev/avgRev*100) : 0,
    avgDmi: avg(dmiVals),
    regEPct: regEVals.length ? pct(regEVals.reduce((a,b)=>a+b,0), regEVals.length) : 0,
    regCPct: regCVals.length ? pct(regCVals.reduce((a,b)=>a+b,0), regCVals.length) : 0
  };
}

function computeRegionBreakdown(){
  const rows = filterRows('region');
  const REGIONS = LOOKUPS.REGIONS;
  return REGIONS.map((name, idx)=>{
    const sub = rows.filter(r=>r[F.REGION]===idx);
    const revVals = sub.map(r=>r[F.REV]).filter(v=>v>=0);
    const orevVals = sub.map(r=>r[F.OREV]).filter(v=>v>=0);
    const dmiVals = sub.map(r=>r[F.DMI]).filter(v=>v>=0);
    return { region:name, count:sub.length, avgRev:avg(revVals), avgOrev:avg(orevVals), avgDmi:avg(dmiVals) };
  });
}

function computeUrbanBreakdown(){
  const rows = filterRows('urban');
  const inZ = rows.filter(r=>r[F.URBAN]===1).length;
  const outZ = rows.filter(r=>r[F.URBAN]===0).length;
  return { inZone:inZ, outZone:outZ, total: inZ+outZ };
}

function computeGenBreakdown(){
  const rows = filterRows('gen');
  const GENS = LOOKUPS.GENS;
  return GENS.map((name, idx)=>{
    const sub = rows.filter(r=>r[F.GEN]===idx);
    return { gen:name, count:sub.length };
  });
}

function computeRegBreakdown(){
  const rows = filterRows('reg');
  const yes = rows.filter(r=>r[F.REGE]===1);
  const no = rows.filter(r=>r[F.REGE]===0);
  const yesOrev = yes.map(r=>r[F.OREV]).filter(v=>v>=0);
  const noOrev = no.map(r=>r[F.OREV]).filter(v=>v>=0);
  const yesDmi = yes.map(r=>r[F.DMI]).filter(v=>v>=0);
  const noDmi = no.map(r=>r[F.DMI]).filter(v=>v>=0);
  const total = yes.length + no.length;
  return {
    yesCount:yes.length, noCount:no.length, total,
    yesPct: pct(yes.length,total), noPct: pct(no.length,total),
    yesAvgOrev: avg(yesOrev), noAvgOrev: avg(noOrev),
    yesAvgDmi: avg(yesDmi), noAvgDmi: avg(noDmi)
  };
}

function computeGenderBreakdown(rows){
  const counts = {0:0,1:0,2:0};
  rows.forEach(r=>{ const g=r[F.GENDER]; if(g!==-1) counts[g] = (counts[g]||0)+1; });
  return counts;
}

function computePlatformMix(rows, start, count, names){
  const out=[];
  for(let i=0;i<count;i++){
    const vals = rows.map(r=>r[start+i]).filter(v=>v!==-1);
    out.push({ name:names[i], avg: avg(vals) });
  }
  return out;
}

function computeFlagPct(rows, start, count, names){
  const out=[];
  for(let i=0;i<count;i++){ out.push({ name:names[i], pct: pctFlag(rows, start+i) }); }
  return out;
}

function computeCategoryPct(rows){
  const names = LOOKUPS.CAT_NAMES;
  const out=[];
  for(let i=0;i<F.CAT_N;i++){ out.push({ name:names[i], pct: pctFlag(rows, F.CAT+i) }); }
  out.sort((a,b)=>b.pct-a.pct);
  return out;
}

function computeEduIncome(rows, idx, names){
  const out = names.map((name,i)=>({ name, count:0 }));
  rows.forEach(r=>{ const v=r[idx]; if(v>=0 && v<names.length) out[v].count++; });
  return out.filter(x=>x.count>0);
}

function computeC2x(rows){
  const c2b = rows.map(r=>r[F.C2B]).filter(v=>v!==-1);
  const c2c = rows.map(r=>r[F.C2C]).filter(v=>v!==-1);
  const c2g = rows.map(r=>r[F.C2G]).filter(v=>v!==-1);
  const c2bRev = rows.map(r=>r[F.C2B_REV]).filter(v=>v>0);
  const c2cRev = rows.map(r=>r[F.C2C_REV]).filter(v=>v>0);
  const c2gRev = rows.map(r=>r[F.C2G_REV]).filter(v=>v>0);
  return {
    c2bPct: avg(c2b), c2cPct: avg(c2c), c2gPct: avg(c2g),
    c2bRev: avg(c2bRev), c2cRev: avg(c2cRev), c2gRev: avg(c2gRev),
    c2bN: c2bRev.length, c2cN: c2cRev.length, c2gN: c2gRev.length
  };
}

function computeDmiByRegion(){
  const rows = filterRows('region');
  const REGIONS = LOOKUPS.REGIONS;
  return REGIONS.map((name,idx)=>{
    const sub = rows.filter(r=>r[F.REGION]===idx);
    const dmiVals = sub.map(r=>r[F.DMI]).filter(v=>v>=0);
    return { region:name, avgDmi: avg(dmiVals), count: sub.length };
  }).filter(x=>x.count>0);
}

function computeDmiLevelVsRev(rows){
  const buckets = DMI_LEVELS.map(lv=>({ name:lv.name, color:lv.color, vals:[], n:0 }));
  rows.forEach(r=>{
    const d = r[F.DMI]; if(d<0) return;
    const lv = dmiLevel(d);
    const b = buckets.find(x=>x.name===lv.name);
    b.n++;
    const orev = r[F.OREV];
    if(orev>=0) b.vals.push(orev);
  });
  return buckets.map(b=>({ name:b.name, color:b.color, avgOrev: avg(b.vals), n:b.n }));
}

/* =========================================================
   CHART INSTANCES + RENDER PIPELINE
   ========================================================= */
const charts = {};
function killChart(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }
function baseFont(){ return "'Noto Sans Thai','IBM Plex Mono',sans-serif"; }

function renderAll(){
  const rows = filterRows(null);
  const kpi = computeKPIs(rows);

  document.getElementById('fCountShown').textContent = fmtNum(kpi.n);
  document.getElementById('kpiN').innerHTML = fmtNum(kpi.n) + ' <span class="unit">ราย</span>';
  document.getElementById('kpiRev').innerHTML = fmtNum(kpi.avgRev) + ' <span class="unit">บาท</span>';
  document.getElementById('kpiOrev').innerHTML = fmtNum(kpi.avgOrev) + ' <span class="unit">บาท</span>';
  document.getElementById('kpiOrevSub').textContent = 'คิดเป็น ' + kpi.onlineShare.toFixed(1) + '% ของรายได้รวม';
  document.getElementById('kpiReg').innerHTML = kpi.regEPct.toFixed(1) + ' <span class="unit">%</span>';
  document.getElementById('kpiRegSub').textContent = 'จดทะเบียนพาณิชย์ทั่วไป ' + kpi.regCPct.toFixed(1) + '%';
  document.getElementById('kpiDmi').innerHTML = kpi.avgDmi.toFixed(2) + ' <span class="unit">/ 4.0</span>';
  const lvl = dmiLevel(kpi.avgDmi);
  document.getElementById('kpiDmiSub').innerHTML = 'เฉลี่ย 5 มิติ · <span style="color:'+lvl.color+'">'+lvl.name+'</span>';

  if(kpi.n===0){
    document.querySelectorAll('.chart-wrap, .barlist').forEach(el=>{
      el.innerHTML = '<div class="nodata">ไม่พบข้อมูลที่ตรงกับตัวกรองนี้<br>ลองปรับตัวกรองใหม่</div>';
    });
    Object.keys(charts).forEach(killChart);
    return;
  }

  renderRegion(rows);
  renderChannels(rows);
  renderC2x(rows);
  renderDmiHero(rows);
  renderOps(rows);
  renderProducts(rows);
  renderImpact(rows);
  renderDemo(rows);
}

/* ---- 01 Region ---- */
function renderRegion(){
  const data = computeRegionBreakdown();
  const sortedRev = [...data].sort((a,b)=>b.avgRev-a.avgRev);
  killChart('regionRev');
  charts.regionRev = new Chart(document.getElementById('chartRegionRev'), {
    type:'bar',
    data:{ labels: sortedRev.map(d=>d.region), datasets:[
      {label:'รวม', data: sortedRev.map(d=>d.avgRev), backgroundColor:C.gold, borderRadius:4, maxBarThickness:14},
      {label:'ออนไลน์', data: sortedRev.map(d=>d.avgOrev), backgroundColor:C.teal, borderRadius:4, maxBarThickness:14}
    ]},
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      layout:{padding:{right:46}},
      plugins:{
        legend:{position:'top', align:'end', labels:{boxWidth:10,boxHeight:10,padding:14, font:{family:baseFont()}}},
        tooltip:{ callbacks:{
          label:c=> c.dataset.label+': '+fmtNum(c.parsed.x)+' บาท',
          afterLabel:c=>{ const d=sortedRev[c.dataIndex]; return c.datasetIndex===0 ? ['จำนวนผู้ตอบ: '+fmtNum(d.count)+' ราย','DMI เฉลี่ย: '+d.avgDmi.toFixed(2)+' / 4.0'] : []; }
        }},
        datalabels:{ display:true, anchor:'end', align:'right', clamp:true, color:C.textMid, font:{family:"'IBM Plex Mono'",size:10.5,weight:500}, formatter:v=>fmtNum(v) }
      },
      scales:{ x:{grid:{color:C.grid}, ticks:{callback:v=>fmtNum(v), font:{family:baseFont()}}, suggestedMax: Math.max(...sortedRev.map(d=>d.avgRev),1)*1.18, title:{display:true,text:'บาท / เดือน', color:C.textDim, font:{size:10.5}}},
               y:{grid:{display:false}, ticks:{font:{size:11.5, family:baseFont()}, autoSkip:false}} }
    }
  });

  const sortedCnt = [...data].filter(d=>d.count>0).sort((a,b)=>b.count-a.count);
  const totalCnt = sortedCnt.reduce((a,d)=>a+d.count,0);
  killChart('regionCount');
  charts.regionCount = new Chart(document.getElementById('chartRegionCount'), {
    type:'doughnut',
    data:{ labels: sortedCnt.map(d=>d.region), datasets:[{ data: sortedCnt.map(d=>d.count), backgroundColor:[C.gold,C.teal,C.coral,C.violet,C.goldDim,C.tealDim,C.gray], borderColor:C.card, borderWidth:3 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{
        legend:{position:'right', labels:{boxWidth:10,boxHeight:10,padding:10, font:{size:10.5, family:baseFont()}}},
        tooltip:{callbacks:{label:c=> c.label+': '+fmtNum(c.parsed)+' ราย ('+pct(c.parsed,totalCnt).toFixed(1)+'%)'}},
        datalabels:{ display:true, color:'#0A0F1E', font:{family:"'IBM Plex Mono'",size:10,weight:600}, formatter:(v)=> pct(v,totalCnt).toFixed(1)+'%' }
      }
    }
  });

  const top = sortedRev[0], bottom = sortedRev[sortedRev.length-1];
  document.getElementById('regionDesc').textContent = (top? top.region+'มีรายได้เฉลี่ยต่อเดือนสูงสุด ('+fmtNum(top.avgRev)+' บาท) ':'') + (bottom? 'ขณะที่ '+bottom.region+'ต่ำสุด':'');
}

/* ---- 02 Channels ---- */
function renderChannels(rows){
  const online = computePlatformMix(rows, F.PLAT, F.PLAT_N, LOOKUPS.PLAT_NAMES).filter(d=>d.avg>0.3).sort((a,b)=>b.avg-a.avg);
  const offline = computePlatformMix(rows, F.OFFL, F.OFFL_N, LOOKUPS.OFFL_NAMES).sort((a,b)=>b.avg-a.avg);
  killChart('onlineMix'); killChart('offlineMix');
  const mixOpts=(arr,color,title)=>({
    type:'bar',
    data:{ labels: arr.map(d=>d.name), datasets:[{ data: arr.map(d=>d.avg), backgroundColor:color, borderRadius:5, maxBarThickness:22, categoryPercentage:0.75, barPercentage:0.85 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>c.parsed.x.toFixed(1)+'% ของรายได้'}}},
      scales:{ x:{grid:{color:C.grid}, ticks:{callback:v=>v+'%', font:{family:baseFont()}}, title:{display:true,text:title,color:C.textDim,font:{size:10.5}}},
               y:{grid:{display:false}, ticks:{font:{size:11, family:baseFont()}, autoSkip:false}} }
    }
  });
  charts.onlineMix = new Chart(document.getElementById('chartOnlineMix'), mixOpts(online, C.teal, '% ของรายได้ออนไลน์'));
  charts.offlineMix = new Chart(document.getElementById('chartOfflineMix'), mixOpts(offline, C.gold, '% ของรายได้ออฟไลน์'));
}

/* ---- 03 C2B/C2C/C2G ---- */
function renderC2x(rows){
  const c = computeC2x(rows);
  killChart('c2x'); killChart('c2xRev');
  charts.c2x = new Chart(document.getElementById('chartC2x'), {
    type:'doughnut',
    data:{ labels:['C2C (ผู้บริโภคทั่วไป)','C2B (ธุรกิจ)','C2G (หน่วยงานรัฐ)'], datasets:[{ data:[c.c2cPct, c.c2bPct, c.c2gPct], backgroundColor:[C.teal, C.gold, C.violet], borderColor:C.card, borderWidth:3 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'58%',
      plugins:{ legend:{position:'bottom', labels:{boxWidth:9,boxHeight:9,padding:10, font:{size:10.5, family:baseFont()}}},
        tooltip:{callbacks:{label:c=>c.label+': '+c.parsed.toFixed(1)+'%'}},
        datalabels:{ display:true, color:'#fff', font:{family:"'IBM Plex Mono'",size:11,weight:600}, formatter:v=>v.toFixed(1)+'%' }
      }
    }
  });
  charts.c2xRev = new Chart(document.getElementById('chartC2xRev'), {
    type:'bar',
    data:{ labels:['C2C','C2B','C2G'], datasets:[{ data:[c.c2cRev,c.c2bRev,c.c2gRev], backgroundColor:[C.teal,C.gold,C.violet], borderRadius:6, barThickness:40 }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{
        label:c=>fmtNum(c.parsed.y)+' บาท',
        afterLabel:c=>{ const ns=[c.c2cN,c.c2bN,c.c2gN]; return 'จำนวนผู้ตอบ: '+fmtNum([c.c2cN,c.c2bN,c.c2gN][c.dataIndex]||0)+' ราย'; }
      }}},
      scales:{ x:{grid:{display:false}, ticks:{font:{family:baseFont()}}}, y:{grid:{color:C.grid}, ticks:{callback:v=>fmtNum(v), font:{family:baseFont()}}, title:{display:true,text:'บาท / เดือน',color:C.textDim,font:{size:10.5}}} }
    }
  });
  document.getElementById('c2xDesc').textContent = 'ผู้ขายภาคครัวเรือนขายให้ผู้บริโภคทั่วไป (C2C) เป็นหลักที่ '+c.c2cPct.toFixed(1)+'% รองลงมาคือขายให้ธุรกิจ (C2B) '+c.c2bPct.toFixed(1)+'% และหน่วยงานรัฐ (C2G) '+c.c2gPct.toFixed(1)+'%';
}

/* ---- 04 DMI Hero ---- */
function renderDmiHero(rows){
  const dmiVals = rows.map(r=>r[F.DMI]).filter(v=>v>=0);
  const score = avg(dmiVals);
  const lv = dmiLevel(score);
  document.getElementById('gaugeScore').innerHTML = score.toFixed(2) + '<span class="of"> / 4.0</span>';
  document.getElementById('gaugeLevelLabel').textContent = lv.name;
  document.getElementById('gaugeLevelLabel').style.color = lv.color;

  killChart('gauge');
  charts.gauge = new Chart(document.getElementById('chartGauge'), {
    type:'doughnut',
    data:{ datasets:[{ data:[score, Math.max(4-score,0.001)], backgroundColor:[lv.color, 'rgba(20,33,61,0.08)'], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'78%', rotation:-90, circumference:180,
      plugins:{legend:{display:false}, tooltip:{enabled:false}} }
  });

  const dims = [
    {key:F.DMI_S, label:'กลยุทธ์'},
    {key:F.DMI_ST, label:'โครงสร้าง & ระบบ'},
    {key:F.DMI_P, label:'กระบวนงาน'},
    {key:F.DMI_PPL, label:'บุคลากร & วัฒนธรรม'},
    {key:F.DMI_C, label:'ลูกค้า'}
  ];
  const wrap = document.getElementById('dmiDims');
  wrap.innerHTML='';
  dims.forEach(d=>{
    const vals = rows.map(r=>r[d.key]).filter(v=>v>=0);
    const a = avg(vals);
    const dlv = dmiLevel(a);
    const row = document.createElement('div'); row.className='dmi-dim-row';
    row.innerHTML = `<div class="name">${d.label}</div><div class="bar-track"><div class="bar-fill" style="width:${(a/4*100).toFixed(0)}%; background:${dlv.color};"></div></div><div class="v" style="color:${dlv.color};">${a.toFixed(2)}</div>`;
    wrap.appendChild(row);
  });
}

/* ---- 05 Payment / Shipping / Barriers ---- */
function fillBarlist(id, arr, cls){
  const wrap = document.getElementById(id);
  wrap.innerHTML='';
  arr.forEach(d=>{
    const row = document.createElement('div'); row.className='barlist-row';
    row.innerHTML = `<div class="top"><span class="name">${d.name}</span><span class="pct">${d.pct.toFixed(1)}%</span></div><div class="track"><div class="fill ${cls}" style="width:${d.pct}%"></div></div>`;
    wrap.appendChild(row);
  });
}
function renderOps(rows){
  const pay = computeFlagPct(rows, F.PAY, F.PAY_N, LOOKUPS.PAY_NAMES).sort((a,b)=>b.pct-a.pct).filter(d=>d.pct>0).slice(0,8);
  const ship = computeFlagPct(rows, F.SHIP, F.SHIP_N, LOOKUPS.SHIP_NAMES).sort((a,b)=>b.pct-a.pct).filter(d=>d.pct>0).slice(0,8);
  const barr = computeFlagPct(rows, F.BARR, F.BARR_N, LOOKUPS.BARR_NAMES).sort((a,b)=>b.pct-a.pct).filter(d=>d.pct>0).slice(0,8);
  fillBarlist('listPay', pay, 'fill-teal');
  fillBarlist('listShip', ship, 'fill-gold');
  fillBarlist('listBarrier', barr, 'fill-coral');
}

/* ---- 06 Products ---- */
function renderProducts(rows){
  const cats = computeCategoryPct(rows).filter(d=>d.pct>0).slice(0,15);
  killChart('products');
  charts.products = new Chart(document.getElementById('chartProducts'), {
    type:'bar',
    data:{ labels: cats.map(d=>d.name), datasets:[{ data: cats.map(d=>d.pct), backgroundColor:C.violet, borderRadius:5, maxBarThickness:20, categoryPercentage:0.75, barPercentage:0.85 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>c.parsed.x.toFixed(1)+'% ของผู้ตอบ'}}},
      scales:{ x:{grid:{color:C.grid}, ticks:{callback:v=>v+'%', font:{family:baseFont()}}, title:{display:true,text:'% ของผู้ตอบแบบสำรวจในกลุ่มที่กรอง',color:C.textDim,font:{size:10.5}}},
               y:{grid:{display:false}, ticks:{font:{size:10.5, family:baseFont()}, autoSkip:false}} }
    }
  });
  if(cats.length) document.getElementById('productsDesc').textContent = '"'+cats[0].name+'" เป็นหมวดที่มีผู้ขายมากที่สุดในกลุ่มที่กรอง ('+cats[0].pct.toFixed(1)+'%)';
}

/* ---- 07 Impact: DMI x Revenue x Registration ---- */
function renderImpact(rows){
  renderLevelLegend('dmiLevelLegendRegion');
  renderLevelLegend('dmiLevelLegendBucket');

  const regionDmi = computeDmiByRegion().sort((a,b)=>b.avgDmi-a.avgDmi);
  killChart('dmiByRegion');
  charts.dmiByRegion = new Chart(document.getElementById('chartDmiByRegion'), {
    type:'bar',
    data:{ labels: regionDmi.map(d=>d.region), datasets:[{ data: regionDmi.map(d=>d.avgDmi), backgroundColor: regionDmi.map(d=>dmiLevel(d.avgDmi).color), borderRadius:5, maxBarThickness:20, categoryPercentage:0.75, barPercentage:0.85 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, layout:{padding:{right:34}},
      plugins:{ legend:{display:false},
        tooltip:{callbacks:{ label:c=>'DMI เฉลี่ย: '+c.parsed.x.toFixed(2)+' / 4.0 · '+dmiLevel(c.parsed.x).name, afterLabel:c=>'จำนวนผู้ตอบ: '+fmtNum(regionDmi[c.dataIndex].count)+' ราย' }},
        datalabels:{ display:true, anchor:'end', align:'right', clamp:true, color:C.textMid, font:{family:"'IBM Plex Mono'",size:10.5,weight:500}, formatter:v=>v.toFixed(2) }
      },
      scales:{ x:{grid:{color:C.grid}, max:4, title:{display:true,text:'คะแนน DMI (เต็ม 4.0)',color:C.textDim,font:{size:10.5}}}, y:{grid:{display:false}, ticks:{font:{size:11.5, family:baseFont()}, autoSkip:false}} }
    }
  });

  const buckets = computeDmiLevelVsRev(rows);
  killChart('dmiVsRev');
  charts.dmiVsRev = new Chart(document.getElementById('chartDmiVsRev'), {
    type:'bar',
    data:{ labels: buckets.map(b=>b.name), datasets:[{ data: buckets.map(b=>b.avgOrev), backgroundColor: buckets.map(b=>b.color), borderRadius:6, barThickness:32 }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false},
        tooltip:{callbacks:{ label:c=> c.parsed.y>0 ? 'รายได้ออนไลน์เฉลี่ย: '+fmtNum(c.parsed.y)+' บาท' : 'ยังไม่มีผู้ตอบในระดับนี้', afterLabel:c=>'จำนวนผู้ตอบ: '+fmtNum(buckets[c.dataIndex].n)+' ราย' }}
      },
      scales:{ x:{grid:{display:false}, ticks:{font:{size:10.5, family:baseFont()}}, title:{display:true,text:'ระดับ Digital Maturity',color:C.textDim,font:{size:10.5}}},
               y:{grid:{color:C.grid}, ticks:{callback:v=>fmtNum(v), font:{family:baseFont()}}, title:{display:true,text:'รายได้ออนไลน์ บาท / เดือน',color:C.textDim,font:{size:10.5}}} }
    }
  });

  const dmiXs=[], orevYs=[];
  rows.forEach(r=>{ if(r[F.DMI]>=0 && r[F.OREV]>=0){ dmiXs.push(r[F.DMI]); orevYs.push(r[F.OREV]); } });
  const r = corr(dmiXs, orevYs);
  document.getElementById('dmiCorrText').innerHTML = 'รายได้ออนไลน์เฉลี่ยแทบไม่เปลี่ยนตามระดับ Digital Maturity ในกลุ่มที่กรองนี้ (สัมประสิทธิ์สหสัมพันธ์ r ≈ '+r.toFixed(3)+', n='+dmiXs.length+') สะท้อนว่า DMI สะท้อน "ความพร้อมและแนวปฏิบัติด้านดิจิทัล" มากกว่าจะรับประกันยอดขายออนไลน์ที่สูงขึ้นในทันที';

  const rb = computeRegBreakdown();
  const yesLv = dmiLevel(rb.yesAvgDmi), noLv = dmiLevel(rb.noAvgDmi);
  document.getElementById('regYesTitle').textContent = 'จดทะเบียนแล้ว · '+rb.yesPct.toFixed(1)+'% ('+fmtNum(rb.yesCount)+' ราย)';
  document.getElementById('regNoTitle').textContent = 'ยังไม่จดทะเบียน · '+rb.noPct.toFixed(1)+'% ('+fmtNum(rb.noCount)+' ราย)';
  document.getElementById('regYesRev').innerHTML = fmtNum(rb.yesAvgOrev)+' <span style="font-size:12px;font-weight:400;color:var(--text-dim);">บาท</span>';
  document.getElementById('regNoRev').innerHTML = fmtNum(rb.noAvgOrev)+' <span style="font-size:12px;font-weight:400;color:var(--text-dim);">บาท</span>';
  document.getElementById('regYesDmi').innerHTML = rb.yesAvgDmi.toFixed(2)+' <span style="font-size:12px;font-weight:400;color:var(--text-dim);">/ 4.0 · '+yesLv.name+'</span>';
  document.getElementById('regYesDmi').style.color = yesLv.color;
  document.getElementById('regNoDmi').innerHTML = rb.noAvgDmi.toFixed(2)+' <span style="font-size:12px;font-weight:400;color:var(--text-dim);">/ 4.0 · '+noLv.name+'</span>';
  document.getElementById('regNoDmi').style.color = noLv.color;

  const diff = rb.yesAvgOrev - rb.noAvgOrev;
  const diffPct = rb.noAvgOrev>0 ? (diff/rb.noAvgOrev*100) : 0;
  const dmiDiff = rb.yesAvgDmi - rb.noAvgDmi;
  document.getElementById('regInsightText').innerHTML =
    '<b style="color:var(--text);">อ่านผลอย่างไร:</b> ในกลุ่มที่กรองนี้ ผู้จดทะเบียนมีรายได้ออนไลน์เฉลี่ย'+(diff>=0?'สูงกว่า':'ต่ำกว่า')+'ผู้ไม่จดทะเบียน '+Math.abs(diffPct).toFixed(1)+'% ('+fmtNum(rb.yesAvgOrev)+' เทียบกับ '+fmtNum(rb.noAvgOrev)+' บาท) และมี Digital Maturity ต่างกัน '+(dmiDiff>=0?'+':'')+dmiDiff.toFixed(2)+' คะแนน<br><br>'+
    '<b style="color:var(--text);">แนวทางส่งเสริมที่เป็นไปได้:</b> เน้นสิทธิประโยชน์อื่นนอกเหนือจากรายได้ระยะสั้น เช่น สินเชื่อดอกเบี้ยต่ำ/เข้าถึงแหล่งทุนสำหรับผู้จดทะเบียน, ลดขั้นตอนจดทะเบียนผ่านช่องทางออนไลน์แบบเบ็ดเสร็จ, ผูกกับ Badge ความน่าเชื่อถือบนแพลตฟอร์ม E-Marketplace, และให้อบรมด้าน Digital Maturity ควบคู่ไปกับการจดทะเบียน';

  document.getElementById('impactDesc').textContent = (regionDmi[0]? regionDmi[0].region+'มี Digital Maturity สูงสุดในกลุ่มนี้ ':'') + 'คะแนน DMI มีความสัมพันธ์กับรายได้ออนไลน์ต่ำมาก (r ≈ '+r.toFixed(2)+')';
}

/* ---- 08 Demographics ---- */
function renderDemo(rows){
  const genderCounts = computeGenderBreakdown(rows);
  const genderTotal = genderCounts[0]+genderCounts[1]+genderCounts[2];
  killChart('gender');
  charts.gender = new Chart(document.getElementById('chartGender'), {
    type:'pie',
    data:{ labels:['หญิง','ชาย','อื่น ๆ/ไม่ระบุ'], datasets:[{ data:[genderCounts[0],genderCounts[1],genderCounts[2]], backgroundColor:[C.coral,C.teal,C.gray], borderColor:C.card, borderWidth:3 }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{position:'bottom', labels:{boxWidth:9,boxHeight:9,padding:8, font:{size:10.5, family:baseFont()}}},
        tooltip:{callbacks:{label:c=>c.label+': '+fmtNum(c.parsed)+' ราย'}},
        datalabels:{ display:true, color:'#0A0F1E', font:{family:"'IBM Plex Mono'",size:11,weight:600}, formatter:(v)=> genderTotal>0 ? pct(v,genderTotal).toFixed(1)+'%' : '' }
      }
    }
  });

  const ub = computeUrbanBreakdown();
  killChart('urban');
  charts.urban = new Chart(document.getElementById('chartUrban'), {
    type:'pie',
    data:{ labels:['ในเขตเทศบาล','นอกเขตเทศบาล'], datasets:[{ data:[ub.inZone, ub.outZone], backgroundColor:[C.violet, C.gray], borderColor:C.card, borderWidth:3 }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{position:'bottom', labels:{boxWidth:9,boxHeight:9,padding:8, font:{size:10.5, family:baseFont()}}},
        tooltip:{callbacks:{label:c=>c.label+': '+fmtNum(c.parsed)+' ราย'}},
        datalabels:{ display:true, color:'#fff', font:{family:"'IBM Plex Mono'",size:11,weight:600}, formatter:(v)=> ub.total>0 ? pct(v,ub.total).toFixed(1)+'%' : '' }
      }
    }
  });

  const regCVals = rows.map(r=>r[F.REGC]).filter(v=>v===0||v===1);
  const regEVals = rows.map(r=>r[F.REGE]).filter(v=>v===0||v===1);
  const cPct = regCVals.length ? pct(regCVals.reduce((a,b)=>a+b,0), regCVals.length) : 0;
  const ePct = regEVals.length ? pct(regEVals.reduce((a,b)=>a+b,0), regEVals.length) : 0;
  document.getElementById('ringCommerceVal').textContent = cPct.toFixed(1)+'%';
  document.getElementById('ringEcomVal').textContent = ePct.toFixed(1)+'%';
  killChart('ringCommerce'); killChart('ringEcom');
  const ring=(id,val,color)=> new Chart(document.getElementById(id), {
    type:'doughnut',
    data:{ datasets:[{ data:[val, Math.max(100-val,0.001)], backgroundColor:[color,'rgba(20,33,61,0.08)'], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'74%', plugins:{legend:{display:false}, tooltip:{enabled:false}} }
  });
  charts.ringCommerce = ring('ringCommerce', cPct, C.teal);
  charts.ringEcom = ring('ringEcom', ePct, C.gold);

  const genData = computeGenBreakdown().filter(d=>d.count>0);
  killChart('gen');
  charts.gen = new Chart(document.getElementById('chartGen'), {
    type:'bar',
    data:{ labels: genData.map(d=>d.gen), datasets:[{ data: genData.map(d=>d.count), backgroundColor:C.gold, borderRadius:5, barThickness:34 }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>fmtNum(c.parsed.y)+' ราย'}}},
      scales:{ x:{grid:{display:false}, ticks:{font:{family:baseFont()}}}, y:{grid:{color:C.grid}, ticks:{font:{family:baseFont()}}, title:{display:true,text:'จำนวนผู้ตอบ (ราย)',color:C.textDim,font:{size:10}}} }
    }
  });

  const edu = computeEduIncome(rows, F.EDU, LOOKUPS.EDUS);
  killChart('edu');
  charts.edu = new Chart(document.getElementById('chartEdu'), {
    type:'bar',
    data:{ labels: edu.map(d=>d.name), datasets:[{ data: edu.map(d=>d.count), backgroundColor:C.teal, borderRadius:5, maxBarThickness:22, categoryPercentage:0.75, barPercentage:0.85 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>fmtNum(c.parsed.x)+' ราย'}}},
      scales:{ x:{grid:{color:C.grid}, ticks:{font:{family:baseFont()}}, title:{display:true,text:'จำนวนผู้ตอบ (ราย)',color:C.textDim,font:{size:10}}}, y:{grid:{display:false}, ticks:{font:{size:10.5, family:baseFont()}, autoSkip:false}} }
    }
  });

  const inc = computeEduIncome(rows, F.INCOME, LOOKUPS.INCOMES);
  killChart('income');
  charts.income = new Chart(document.getElementById('chartIncome'), {
    type:'bar',
    data:{ labels: inc.map(d=>d.name+' บ.'), datasets:[{ data: inc.map(d=>d.count), backgroundColor:C.gold, borderRadius:5, maxBarThickness:22, categoryPercentage:0.75, barPercentage:0.85 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>fmtNum(c.parsed.x)+' ราย'}}},
      scales:{ x:{grid:{color:C.grid}, ticks:{font:{family:baseFont()}}, title:{display:true,text:'จำนวนผู้ตอบ (ราย)',color:C.textDim,font:{size:10}}}, y:{grid:{display:false}, ticks:{font:{size:10.5, family:baseFont()}, autoSkip:false}} }
    }
  });
}

/* =========================================================
   INIT
   ========================================================= */
function populateSelect(id, options){
  const sel = document.getElementById(id);
  options.forEach((name, idx)=>{
    const opt = document.createElement('option');
    opt.value = idx; opt.textContent = name;
    sel.appendChild(opt);
  });
}

function bindFilters(){
  document.getElementById('fRegion').addEventListener('change', e=>{ state.region = parseInt(e.target.value); renderAll(); });
  document.getElementById('fUrban').addEventListener('change', e=>{ state.urban = parseInt(e.target.value); renderAll(); });
  document.getElementById('fGen').addEventListener('change', e=>{ state.gen = parseInt(e.target.value); renderAll(); });
  document.getElementById('fReg').addEventListener('change', e=>{ state.reg = parseInt(e.target.value); renderAll(); });
  document.getElementById('fReset').addEventListener('click', ()=>{
    state.region=-1; state.urban=-1; state.gen=-1; state.reg=-1;
    document.getElementById('fRegion').value=-1;
    document.getElementById('fUrban').value=-1;
    document.getElementById('fGen').value=-1;
    document.getElementById('fReg').value=-1;
    renderAll();
  });
}

export function initDashboard(){
  Chart.register(ChartDataLabels);
  Chart.defaults.font.family = baseFont();
  Chart.defaults.color = C.textMid;
  Chart.defaults.font.size = 11.5;
  Chart.defaults.plugins.datalabels = Chart.defaults.plugins.datalabels || {};
  Chart.defaults.plugins.datalabels.display = false;

  ROWS = DATA.records;
  LOOKUPS = DATA.lookups;

  document.getElementById('logoImg').src = 'data:image/png;base64,' + LOGO_B64;

  populateSelect('fRegion', LOOKUPS.REGIONS);
  populateSelect('fGen', LOOKUPS.GENS);
  renderLevelLegend('dmiLevelLegend');
  bindFilters();
  renderAll();
}
