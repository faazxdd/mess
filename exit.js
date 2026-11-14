/* Mess Manager add-on: Member Exit & Final Settlement. Load AFTER the main script.
   Uses its own IndexedDB ('mess-exit') so the existing 'inv' data/structure is untouched. */
let EX=[],XR=null,XP=null,xdb;
const xo=indexedDB.open('mess-exit',1);
xo.onupgradeneeded=()=>xo.result.createObjectStore('ex',{keyPath:'id',autoIncrement:true});
const xs=m=>xdb.transaction('ex',m).objectStore('ex');
const xl=async()=>{EX=(await rq(xs('readonly').getAll())).sort((a,b)=>a.ts-b.ts);go()};
xo.onsuccess=()=>{xdb=xo.result;xl()};

/* ---- membership by date ---- */
const END='9999-99-99';
const rg=k=>{const r=[];EX.filter(x=>x.member===k).forEach(x=>{if(x.type==='exit')r.push([x.date,END]);else if(r.length)r[r.length-1][1]=x.date});return r};
const on=(k,d)=>!rg(k).some(([a,b])=>d>a&&d<b);   // active on date d (exit date itself is still active)
const st=k=>{const r=rg(k).pop();return r&&r[1]===END?r:null};
const ld=k=>{const v=EX.filter(x=>x.member===k).pop();return v?v.date:''};

/* ---- calc: each invoice is split equally among members active on ITS date ---- */
function calc(l){const p=[0,0,0,0],sh=[0,0,0,0],g={};
l.forEach(i=>{p[i.payer]+=i.amt;const a=[0,1,2,3].filter(k=>on(k,i.date));(g[a]=g[a]||{a,t:0}).t+=i.amt});
Object.values(g).forEach(({a,t})=>{if(!a.length)return;const b=Math.floor(t/a.length),r=t%a.length;a.forEach((k,j)=>sh[k]+=b+(j<r?1:0))});
const t=p.reduce((a,b)=>a+b,0),bal=p.map((x,i)=>x-sh[i]),d=[],c=[],tr=[];
bal.forEach((x,i)=>x<0?d.push([i,-x]):x>0&&c.push([i,x]));
while(d.length&&c.length){d.sort((a,b)=>b[1]-a[1]);c.sort((a,b)=>b[1]-a[1]);const m=Math.min(d[0][1],c[0][1]);tr.push({from:d[0][0],to:c[0][0],amt:m});d[0][1]-=m;c[0][1]-=m;if(!d[0][1])d.shift();if(!c[0][1])c.shift()}
return{p,t,sh,bal,tr,n:l.length}}

/* ---- keep existing screens, fix "equal share" / member count ---- */
const avg=c=>{const a=c.sh.filter(x=>x>0);return a.length?a.reduce((x,y)=>x+y,0)/a.length:0};
const fx=(h,c)=>h.replace(/(qual share[^A]*?)AED [\d,.]+/g,(m,a)=>a+'AED '+f(avg(c))).replace('÷ 4','÷ active members');
const _d=dash,_s=set,_r=rep;
dash=()=>{const c=calc(inM(mon));return fx(_d(),c).replace(/(Members<\/div><div class="v">)4/,'$1'+[0,1,2,3].filter(k=>on(k,mon+'-31')).length)+mcard()};
set=()=>fx(_s(),calc(inM(mon)));
rep=()=>fx(_r(),calc(inM(mon)));
const wa=s=>navigator.share?navigator.share({text:s}).catch(()=>{}):location.href='https://wa.me/?text='+encodeURIComponent(s);
shr=()=>{const c=calc(inM(mon));let s=`🧾 Mess ${mon}\nTotal expenses: AED ${f(c.t)}\nEqual share: AED ${f(avg(c))}\n\n`;[0,1,2,3].forEach(i=>s+=`${M[i]}: Paid AED ${f(c.p[i])}\n`);s+='\n';c.tr.forEach(t=>s+=`${M[t.from]} ➡️ ${M[t.to]}: AED ${f(t.amt)}\n`);wa(s)};

/* ---- Members card ---- */
const res=r=>r.fin>0?['GETS REFUND','pos']:r.fin<0?['NEEDS TO PAY','neg']:['SETTLED',''];
const mcard=()=>`<div class="card np"><h3>👥 Members</h3>${[0,1,2,3].map(k=>{const x=st(k);return `<div class="inv"><div class="row"><b>${M[k]}</b>${x?`<span class="neg">Left ${x[0]}</span>`:'<span class="pos">Active</span>'}</div><button class="${x?'alt':'del'}" style="width:100%;margin-top:8px" onclick="${x?'rst':'rem'}(${k})">${x?'Restore member':'Remove member'}</button></div>`}).join('')}${EX.filter(x=>x.type==='exit').reverse().map(x=>`<div class="inv" onclick="xv(${x.id})"><div class="row"><b>🧾 ${M[x.member]} · ${x.date}</b><b class="${res(x)[1]}">AED ${f(Math.abs(x.fin))}</b></div><div class="sm">${res(x)[0]}</div></div>`).join('')}</div>`;

/* ---- remove flow ---- */
function rem(k){const d=all.map(i=>i.date).sort()[0]||today();
$('#mc').innerHTML=`<h3>Remove ${M[k]}</h3><label>Last active date</label><input id="xd" type="date" value="${today()}"><label>Count expenses from</label><input id="xf" type="date" value="${d}"><label>Previous balance AED (+ owed by member, − credit/advance)</label><input id="xa" type="number" inputmode="decimal" step="0.01" value="0"><label>Notes (optional)</label><textarea id="xn" rows="2"></textarea><button class="big" onclick="xp(${k})">Calculate final settlement</button><button class="alt" style="width:100%;margin-top:10px" onclick="cm()">Cancel</button>`;$('#md').style.display='flex'}
function xp(k){const d=$('#xd').value,fr=$('#xf').value,a=Math.round(Number($('#xa').value||0)*100);
if(!d||!fr||fr>d)return alert('Enter a valid last active date and start date.');
if(d<ld(k)||!on(k,d))return alert('Date must be after the last exit/restore date.');
if([0,1,2,3].filter(j=>on(j,d)).length<2)return alert('At least one member must stay active.');
const l=all.filter(i=>i.date>=fr&&i.date<=d),c=calc(l);
XP={member:k,date:d,from:fr,adj:a,notes:$('#xn').value.trim(),total:c.t,n:l.length,sh:c.sh,p:c.p,bal:c.bal,paid:c.p[k],share:c.sh[k],fin:c.p[k]-c.sh[k]-a,ids:l.map(i=>i.id)};
$('#mc').innerHTML=xr(XP)+`<button class="big" onclick="xsv()">Confirm &amp; save final settlement</button><button class="alt" style="width:100%;margin-top:10px" onclick="cm()">Cancel</button>`}
const xr=r=>{const[s,c]=res(r);return `<h3>Final settlement · ${M[r.member]}</h3><div class="sm">${r.from} → ${r.date} · ${r.n} invoices</div>
<div class="row inv"><span>Total mess expenses</span><b>AED ${f(r.total)}</b></div>
${[0,1,2,3].filter(i=>r.p[i]||r.sh[i]).map(i=>`<div class="row inv"><span>${M[i]} · paid ${f(r.p[i])}</span><span>share ${f(r.sh[i])}</span></div>`).join('')}
<div class="row inv"><span>${M[r.member]} actually paid</span><b>AED ${f(r.paid)}</b></div>
<div class="row inv"><span>${M[r.member]} share</span><b>AED ${f(r.share)}</b></div>
<div class="row inv"><span>Previous balance</span><b>AED ${f(r.adj)}</b></div>
<div class="sc ${r.fin<0?'neg2':'pos2'}"><div class="k">${s}</div><div class="v ${c}">AED ${f(Math.abs(r.fin))}</div></div>${r.notes?`<p class="sm">${e(r.notes)}</p>`:''}`};
async function xsv(){await rq(xs('readwrite').add({...XP,type:'exit',ts:Date.now()}));await xl();cm();xv(EX.filter(x=>x.type==='exit').pop().id)}
function xv(id){XR=EX.find(x=>x.id===id);$('#mc').innerHTML=xr(XR)+`<div class="grid"><button onclick="xpr()">🖨 Print</button><button onclick="xwa()">📤 WhatsApp</button></div><button class="alt" style="width:100%;margin-top:10px" onclick="cm()">Close</button>`;$('#md').style.display='flex'}
const xt=r=>`🧾 Final Settlement — ${M[r.member]}\nPeriod: ${r.from} to ${r.date} (${r.n} invoices)\nTotal mess expenses: AED ${f(r.total)}\n`+[0,1,2,3].filter(i=>r.p[i]||r.sh[i]).map(i=>`${M[i]}: paid AED ${f(r.p[i])} · share AED ${f(r.sh[i])}`).join('\n')+`\nPrevious balance: AED ${f(r.adj)}\n\n${M[r.member]} ${res(r)[0]}: AED ${f(Math.abs(r.fin))}`;
const xwa=()=>wa(xt(XR));
function xpr(){let p=$('#prt');if(!p){p=document.createElement('div');p.id='prt';document.body.append(p)}p.innerHTML=xr(XR);print()}
document.head.insertAdjacentHTML('beforeend','<style>#prt{display:none}@media print{body>*:not(#prt){display:none!important}#prt{display:block!important;color:#111;background:#fff;padding:16px}#prt *{color:#111!important;background:none!important}}</style>');

/* ---- restore (history is never deleted) ---- */
function rst(k){const x=st(k);$('#mc').innerHTML=`<h3>Restore ${M[k]}</h3><p class="sm">Left on ${x[0]}. All records are kept. They share only expenses dated from the restore date.</p><label>Active again from</label><input id="xrd" type="date" value="${today()}"><button class="big" onclick="rsv(${k})">Restore member</button><button class="alt" style="width:100%;margin-top:10px" onclick="cm()">Cancel</button>`;$('#md').style.display='flex'}
async function rsv(k){const d=$('#xrd').value,x=st(k);if(!d||d<=x[0])return alert('Restore date must be after the exit date.');await rq(xs('readwrite').add({type:'restore',member:k,date:d,ts:Date.now()}));await xl();cm()}

/* ---- backup/restore also carries exit records ---- */
bk=async()=>{const o=[];for(const i of all){const x={...i};if(i.photo)x.photo=await rd(i.photo);o.push(x)}dl(new Blob([JSON.stringify({app:'mess-manager',v:1,data:o,ex:EX})],{type:'application/json'}),'mess-backup-'+today()+'.json')};
const _rs=rs;
rs=async f=>{if(!f)return;let j={},ok=0;try{j=JSON.parse(await f.text())}catch{}
const a=window.alert;window.alert=m=>{if(m==='Restored.')ok=1;a(m)};await _rs(f);window.alert=a;
if(ok)await new Promise((y,n)=>{const t=xdb.transaction('ex','readwrite'),s=t.objectStore('ex');s.clear();(j.ex||[]).forEach(x=>s.put(x));t.oncomplete=y;t.onerror=n}),await xl()};
