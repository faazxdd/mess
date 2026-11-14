/* Mess Manager add-on: Member Exit & Final Settlement. Load AFTER the main script.
   Uses its own IndexedDB ('mess-exit') so the existing 'inv' data/structure is untouched. */
let EX=[],XR=null,XP=null,xdb;
const xo=indexedDB.open('mess-exit',1);
xo.onupgradeneeded=()=>xo.result.createObjectStore('ex',{keyPath:'id',autoIncrement:true});
const xs=m=>xdb.transaction('ex',m).objectStore('ex');
const xl=async()=>{EX=(await rq(xs('readonly').getAll())).sort((a,b)=>a.ts-b.ts);M.length=4;EX.filter(x=>x.type==='join').forEach(x=>M[x.member]=x.name);go()};
const ids=()=>M.map((_,i)=>i);
xo.onsuccess=()=>{xdb=xo.result;xl()};

/* ---- membership by date ---- */
const END='9999-99-99';
const rg=k=>{const r=[];EX.filter(x=>x.member===k).forEach(x=>{if(x.type==='join')r.push(['',x.date]);else if(x.type==='exit')r.push([x.date,END]);else if(r.length)r[r.length-1][1]=x.date});return r};
const on=(k,d)=>!rg(k).some(([a,b])=>d>a&&d<b);   // active on date d (exit date itself is still active)
const st=k=>{const r=rg(k).pop();return r&&r[1]===END?r:null};
const ld=k=>{const v=EX.filter(x=>x.member===k).pop();return v?v.date:''};

/* ---- calc: each invoice is split equally among members active on ITS date ---- */
const shs=l=>{const sh=Array(M.length).fill(0),g={};l.forEach(i=>{const a=ids().filter(k=>on(k,i.date));(g[a]=g[a]||{a,t:0}).t+=i.amt});Object.values(g).forEach(({a,t})=>{if(!a.length)return;const b=Math.floor(t/a.length),r=t%a.length;a.forEach((k,j)=>sh[k]+=b+(j<r?1:0))});return sh};
function calc(l){const n=M.length,p=Array(n).fill(0);l.forEach(i=>p[i.payer]+=i.amt);
const sh=shs(l),t=p.reduce((a,b)=>a+b,0),bal=p.map((x,i)=>x-sh[i]),d=[],c=[],tr=[];
/* a member with a saved final settlement is treated as paid up for the invoices inside that settlement period */
EX.filter(x=>x.type==='exit').forEach(x=>{const k=x.member,iv=l.filter(i=>i.payer===k||on(k,i.date)),S=iv.filter(i=>i.date>=(x.from||'0000-00-00')&&i.date<=x.date);if(!S.length)return;
const a=S.length===iv.length?bal[k]:S.reduce((s,i)=>s+(i.payer===k?i.amt:0),0)-shs(S)[k];let r=Math.abs(a);
bal.map((b,i)=>[i,b]).filter(([i,b])=>i!==k&&(a<0?b>0:b<0)).sort((u,v)=>Math.abs(v[1])-Math.abs(u[1])).forEach(([i,b])=>{const m=Math.min(r,Math.abs(b));bal[i]+=a<0?-m:m;r-=m});
bal[k]+=a<0?Math.abs(a)-r:-(Math.abs(a)-r)});
bal.forEach((x,i)=>x<0?d.push([i,-x]):x>0&&c.push([i,x]));
while(d.length&&c.length){d.sort((a,b)=>b[1]-a[1]);c.sort((a,b)=>b[1]-a[1]);const m=Math.min(d[0][1],c[0][1]);tr.push({from:d[0][0],to:c[0][0],amt:m});d[0][1]-=m;c[0][1]-=m;if(!d[0][1])d.shift();if(!c[0][1])c.shift()}
return{p,t,sh,bal,tr,n:l.length}}

/* ---- keep existing screens, fix "equal share" / member count ---- */
const avg=c=>{const a=c.sh.filter(x=>x>0);return a.length?a.reduce((x,y)=>x+y,0)/a.length:0};
const fx=(h,c)=>h.replace(/(qual share[^A]*?)AED [\d,.]+/g,(m,a)=>a+'AED '+f(avg(c))).replace('÷ 4','÷ active members');
const _d=dash,_s=set,_r=rep;
dash=()=>{const c=calc(inM(mon));return bkc()+fx(_d(),c).replace(/(Members<\/div><div class="v">)4/,'$1'+ids().filter(k=>on(k,mon+'-31')).length)+ins(c)+mcard()};
set=()=>fx(_s(),calc(inM(mon)));
rep=()=>fx(_r(),calc(inM(mon))).replace('<button style="width:100%;margin-bottom:8px" onclick="window.print()">','<button style="width:100%;margin-bottom:8px" onclick="shr()">📄 Share PDF invoice</button><button style="width:100%;margin-bottom:8px" onclick="window.print()">').replace('<div class="card np"><h3>Export',cats()+'<div class="card np"><h3>Export');
const wa=s=>navigator.share?navigator.share({text:s}).catch(()=>{}):location.href='https://wa.me/?text='+encodeURIComponent(s);
shr=()=>pdfOut(renderInv(monthDoc()),'Mess-Settlement-'+mon+'.pdf');

/* ---- Members card ---- */
const res=r=>r.fin>0?['GETS REFUND','pos']:r.fin<0?['NEEDS TO PAY','neg']:['SETTLED',''];
const mcard=()=>`<div class="card np"><h3>👥 Members</h3>${ids().map(k=>{const x=st(k);return `<div class="inv"><div class="row"><b>${M[k]}</b>${x?`<span class="neg">Left ${x[0]}</span>`:'<span class="pos">Active</span>'}</div><button class="${x?'alt':'del'}" style="width:100%;margin-top:8px" onclick="${x?'rst':'rem'}(${k})">${x?'Restore member':'Remove member'}</button></div>`}).join('')}<button class="big" style="margin:10px 0" onclick="amb()">➕ Add new member</button>${EX.filter(x=>x.type==='exit').reverse().map(x=>`<div class="inv" onclick="xv(${x.id})"><div class="row"><b>🧾 ${M[x.member]} · ${x.date}</b><b class="${res(x)[1]}">AED ${f(Math.abs(x.fin))}</b></div><div class="sm">${res(x)[0]}</div></div>`).join('')}<div class="sm" style="text-align:center;margin-top:10px">App v7</div></div>`;

/* ---- remove flow ---- */
function rem(k){const lx=EX.filter(x=>x.type==='exit'&&x.member===k).pop(),d=lx?new Date(Date.parse(lx.date+'T00:00:00Z')+864e5).toISOString().slice(0,10):(all.map(i=>i.date).sort()[0]||today());
$('#mc').innerHTML=`<h3>Remove ${M[k]}</h3><label>Last active date</label><input id="xd" type="date" value="${today()}"><label>Count expenses from</label><input id="xf" type="date" value="${d}"><label>Previous balance AED (+ owed by member, − credit/advance)</label><input id="xa" type="number" inputmode="decimal" step="0.01" value="0"><label>Notes (optional)</label><textarea id="xn" rows="2"></textarea><button class="big" onclick="xp(${k})">Calculate final settlement</button><button class="alt" style="width:100%;margin-top:10px" onclick="cm()">Cancel</button>`;$('#md').style.display='flex'}
function xp(k){const d=$('#xd').value,fr=$('#xf').value,a=Math.round(Number($('#xa').value||0)*100);
if(!d||!fr||fr>d)return alert('Enter a valid last active date and start date.');
if(d<ld(k)||!on(k,d))return alert('Date must be after the last exit/restore date.');
if(ids().filter(j=>on(j,d)).length<2)return alert('At least one member must stay active.');
const l=all.filter(i=>i.date>=fr&&i.date<=d),c=calc(l);
XP={member:k,date:d,from:fr,adj:a,notes:$('#xn').value.trim(),total:c.t,n:l.length,sh:c.sh,p:c.p,bal:c.bal,paid:c.p[k],share:c.sh[k],fin:c.p[k]-c.sh[k]-a,ids:l.map(i=>i.id)};
$('#mc').innerHTML=xr(XP)+`<button class="big" onclick="xsv()">Confirm &amp; save final settlement</button><button class="alt" style="width:100%;margin-top:10px" onclick="cm()">Cancel</button>`}
const xr=r=>{const[s,c]=res(r);return `<h3>Final settlement · ${M[r.member]}</h3><div class="sm">${r.from} → ${r.date} · ${r.n} invoices</div>
<div class="row inv"><span>Total mess expenses</span><b>AED ${f(r.total)}</b></div>
${ids().filter(i=>r.p[i]||r.sh[i]).map(i=>`<div class="row inv"><span>${M[i]} · paid ${f(r.p[i])}</span><span>share ${f(r.sh[i])}</span></div>`).join('')}
<div class="row inv"><span>${M[r.member]} actually paid</span><b>AED ${f(r.paid)}</b></div>
<div class="row inv"><span>${M[r.member]} share</span><b>AED ${f(r.share)}</b></div>
<div class="row inv"><span>Previous balance</span><b>AED ${f(r.adj)}</b></div>
<div class="sc ${r.fin<0?'neg2':'pos2'}"><div class="k">${s}</div><div class="v ${c}">AED ${f(Math.abs(r.fin))}</div></div>${r.notes?`<p class="sm">${e(r.notes)}</p>`:''}`};
async function xsv(){await rq(xs('readwrite').add({...XP,type:'exit',ts:Date.now()}));await xl();cm();xv(EX.filter(x=>x.type==='exit').pop().id)}
function xv(id){XR=EX.find(x=>x.id===id);$('#mc').innerHTML=xr(XR)+`<div class="grid"><button onclick="xpr()">🖨 Print</button><button onclick="xpdf()">📄 PDF Invoice</button></div><button class="alt" style="width:100%;margin-top:10px" onclick="cm()">Close</button>`;$('#md').style.display='flex'}
const xt=r=>`🧾 Final Settlement — ${M[r.member]}\nPeriod: ${r.from} to ${r.date} (${r.n} invoices)\nTotal mess expenses: AED ${f(r.total)}\n`+ids().filter(i=>r.p[i]||r.sh[i]).map(i=>`${M[i]}: paid AED ${f(r.p[i])} · share AED ${f(r.sh[i])}`).join('\n')+`\nPrevious balance: AED ${f(r.adj)}\n\n${M[r.member]} ${res(r)[0]}: AED ${f(Math.abs(r.fin))}`;
const xwa=()=>wa(xt(XR));
function xpr(){let p=$('#prt');if(!p){p=document.createElement('div');p.id='prt';document.body.append(p)}p.innerHTML=xr(XR);print()}
document.head.insertAdjacentHTML('beforeend','<style>#prt{display:none}@media print{body>*:not(#prt){display:none!important}#prt{display:block!important;color:#111;background:#fff;padding:16px}#prt *{color:#111!important;background:none!important}}</style>');

/* ---- restore (history is never deleted) ---- */
function rst(k){const x=st(k);$('#mc').innerHTML=`<h3>Restore ${M[k]}</h3><p class="sm">Left on ${x[0]}. All records are kept. They share only expenses dated from the restore date.</p><label>Active again from</label><input id="xrd" type="date" value="${today()}"><button class="big" onclick="rsv(${k})">Restore member</button><button class="alt" style="width:100%;margin-top:10px" onclick="cm()">Cancel</button>`;$('#md').style.display='flex'}
async function rsv(k){const d=$('#xrd').value,x=st(k);if(!d||d<=x[0])return alert('Restore date must be after the exit date.');await rq(xs('readwrite').add({type:'restore',member:k,date:d,ts:Date.now()}));await xl();cm();toast('Done ✓')}

/* ---- backup/restore also carries exit records ---- */
bk=async()=>{const o=[];for(const i of all){const x={...i};if(i.photo)x.photo=await rd(i.photo);o.push(x)}dl(new Blob([JSON.stringify({app:'mess-manager',v:1,data:o,ex:EX})],{type:'application/json'}),'mess-backup-'+today()+'.json');try{localStorage.setItem('lastBk',Date.now())}catch{}};
const _rs=rs;
rs=async f=>{if(!f)return;let j={},ok=0;try{j=JSON.parse(await f.text())}catch{}
const a=window.alert;window.alert=m=>{if(m==='Restored.')ok=1;a(m)};await _rs(f);window.alert=a;
if(ok)await new Promise((y,n)=>{const t=xdb.transaction('ex','readwrite'),s=t.objectStore('ex');s.clear();(j.ex||[]).forEach(x=>s.put(x));t.oncomplete=y;t.onerror=n}),await xl()};

/* ---- add new member (shares only expenses from joining date) ---- */
function amb(){$('#mc').innerHTML=`<h3>Add new member</h3><label>Name</label><input id="xnm" placeholder="e.g. RAFI"><label>Joining date</label><input id="xjd" type="date" value="${today()}"><p class="sm">They share only expenses dated from the joining date. Past invoices stay unchanged.</p><button class="big" onclick="asv()">Add member</button><button class="alt" style="width:100%;margin-top:10px" onclick="cm()">Cancel</button>`;$('#md').style.display='flex'}
async function asv(){const n=$('#xnm').value.trim().toUpperCase(),d=$('#xjd').value;
if(!n||!d)return alert('Enter a name and joining date.');
if(M.some(x=>x.toUpperCase()===n))return alert('That name already exists.');
if(M.length>=12)return alert('Maximum 12 members.');
await rq(xs('readwrite').add({type:'join',member:M.length,name:n,date:d,ts:Date.now()}));await xl();cm();toast('Done ✓')}

/* ---- insights, category report, backup reminder ---- */
const ins=c=>{const l=inM(mon);if(!l.length)return '';const d=new Date(+mon.slice(0,4),+mon.slice(5),0).getDate(),now=today(),dd=now.startsWith(mon)?+now.slice(8):d;
const pm=new Date(+mon.slice(0,4),+mon.slice(5)-2,1),pk=pm.getFullYear()+'-'+String(pm.getMonth()+1).padStart(2,'0'),pt=calc(inM(pk)).t;
const big=l.reduce((a,b)=>b.amt>a.amt?b:a),top=c.p.indexOf(Math.max(...c.p)),pc=pt?Math.round((c.t-pt)/pt*100):null;
return `<div class="card"><h3>✨ Insights</h3><div class="row inv"><span>Daily average</span><b>AED ${f(c.t/dd)}</b></div><div class="row inv"><span>Biggest invoice</span><b>AED ${f(big.amt)} · ${e(big.shop)}</b></div><div class="row inv"><span>Top spender</span><b>${M[top]}</b></div>${pc===null?'':`<div class="row inv"><span>vs last month</span><b class="${pc>0?'neg':'pos'}">${pc>0?'▲':'▼'} ${Math.abs(pc)}%</b></div>`}</div>`};
const cats=()=>{const m={};inM(mon).forEach(i=>{const k=i.cat||'Uncategorised';m[k]=(m[k]||0)+i.amt});const a=Object.entries(m).sort((x,y)=>y[1]-x[1]),mx=a[0]?a[0][1]:1;
return a.length?`<div class="card"><h3>By category</h3>${a.map(([k,v])=>`<div class="row"><b>${e(k)}</b><span>AED ${f(v)}</span></div><div class="bar"><i style="width:${v/mx*100}%"></i></div>`).join('')}</div>`:''};
const bkc=()=>{let t=0;try{t=+localStorage.getItem('lastBk')||0}catch{}const d=Math.floor((Date.now()-t)/864e5);
return all.length&&(!t||d>=14)?`<div class="card np" style="border-color:#FB7185"><div class="row"><div><b>Back up your data</b><div class="sm">${t?'Last backup '+d+' days ago':'No backup yet'}</div></div><button onclick="bk()">Backup</button></div></div>`:''};

/* ================= PDF invoices (no libraries, works offline) ================= */
const HW=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,...Array(10).fill(556),278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BW=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,...Array(10).fill(556),333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const fd=d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
function mkPdf(){const H=842,pg=[];let c='';
const wd=(s,b)=>{const T=b?BW:HW;let w=0;for(const ch of String(s)){w+=T[ch.charCodeAt(0)-32]||556}return w/1000};
const cl=s=>String(s??'').replace(/[–—]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[^\x20-\x7E\xA0-\xFF]/g,'?');
const rgb=h=>[1,3,5].map(i=>(parseInt(h.slice(i,i+2),16)/255).toFixed(3)).join(' ');
const P={wd,
rect(x,y,w,h,fill){c+=`${rgb(fill)} rg ${x} ${H-y-h} ${w} ${h} re f\n`},
line(x1,y1,x2,y2,col,lw=.6){c+=`${rgb(col)} RG ${lw} w ${x1} ${H-y1} m ${x2} ${H-y2} l S\n`},
text(s,x,y,sz=10,o={}){s=cl(s);const w=wd(s,o.b)*sz;if(o.al==='r')x-=w;c+=`BT /${o.b?'F2':'F1'} ${sz} Tf ${rgb(o.col||'#1F1533')} rg ${x.toFixed(2)} ${(H-y).toFixed(2)} Td (${s.replace(/[\\()]/g,'\\$&')}) Tj ET\n`},
fit(s,w,sz,b){s=cl(s);if(wd(s,b)*sz<=w)return s;while(s.length>1&&wd(s+'...',b)*sz>w)s=s.slice(0,-1);return s+'...'},
newPage(){pg.push(c);c=''},
finish(foot){pg.push(c);const n=pg.length,pages=pg.map((p,i)=>{c='';foot(i+1,n);return p+c});
let o='%PDF-1.4\n';const off=[0],ob=(i,x)=>{off[i]=o.length;o+=`${i} 0 obj\n${x}\nendobj\n`};
ob(1,'<< /Type /Catalog /Pages 2 0 R >>');ob(2,`<< /Type /Pages /Kids [${pages.map((_,i)=>`${6+2*i} 0 R`).join(' ')}] /Count ${n} >>`);
ob(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');ob(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
pages.forEach((p,i)=>{ob(5+2*i,`<< /Length ${p.length} >>\nstream\n${p}endstream`);ob(6+2*i,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${5+2*i} 0 R >>`)});
const N=5+2*n,x=o.length;o+=`xref\n0 ${N}\n0000000000 65535 f \n`+off.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${N} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
return new Blob([Uint8Array.from(o,ch=>ch.charCodeAt(0))],{type:'application/pdf'})}};
return P}
function renderInv(o){const P=mkPdf(),W=595,L=40,R=555,TX='#1F1533',MU='#6B5B8A';let y=0;
const head=first=>{if(first){P.rect(0,0,W,112,'#291447');P.rect(0,112,W,4,'#7138B8');
P.text('MESS MANAGER',L,52,22,{b:1,col:'#FFFFFF'});P.text('Shared household expense statement',L,70,9,{col:'#B99AFF'});
P.text(o.title,R,48,15,{b:1,col:'#FFFFFF',al:'r'});P.text('No. '+o.no,R,66,9,{col:'#EDE5FF',al:'r'});P.text('Issued '+fd(today()),R,80,9,{col:'#B99AFF',al:'r'});y=140}
else{P.rect(0,0,W,34,'#291447');P.text('MESS MANAGER',L,22,10,{b:1,col:'#FFFFFF'});P.text(o.title+'  |  '+o.no,R,22,8,{col:'#B99AFF',al:'r'});y=60}};
const need=h=>{if(y+h>792){P.newPage();head(0)}};
const cards=a=>{need(64);const n=a.length,g=10,w=(R-L-g*(n-1))/n;a.forEach(([k,v],i)=>{const x=L+i*(w+g),sz=P.wd(v,1)*12>w-18?9:12;P.rect(x,y,w,48,'#F3EEFB');P.rect(x,y,3,48,'#7138B8');P.text(k.toUpperCase(),x+11,y+17,7,{b:1,col:MU});P.text(P.fit(v,w-18,sz,1),x+11,y+36,sz,{b:1})});y+=64};
const banner=s=>{need(74);P.rect(L,y,R-L,54,s.col);P.text(s.k,L+18,y+22,8,{b:1,col:'#FFFFFF'});P.text(s.v,L+18,y+44,19,{b:1,col:'#FFFFFF'});P.text(s.r||'',R-18,y+44,11,{b:1,col:'#FFFFFF',al:'r'});y+=74};
const sec=t=>{need(44);P.text(t.toUpperCase(),L,y+10,9,{b:1,col:'#7138B8'});P.line(L,y+16,R,y+16,'#D8C2F8',.8);y+=30};
const note=s=>{const out=[];let ln='';String(s).split(' ').forEach(w=>{if(P.wd(ln+' '+w)*9>R-L){out.push(ln);ln=w}else ln=ln?ln+' '+w:w});out.push(ln);out.forEach(t=>{need(16);P.text(t,L,y+8,9,{col:MU});y+=14});y+=8};
const tbl=(cols,rows)=>{const tw=R-L,hd=()=>{P.rect(L,y,tw,22,'#291447');let x=L;cols.forEach(c=>{const w=c.w*tw;P.text(c.l,c.a==='r'?x+w-8:x+8,y+15,8,{b:1,col:'#FFFFFF',al:c.a});x+=w});y+=22};
need(70);hd();rows.forEach((r,i)=>{if(y+24>792){P.newPage();head(0);hd()}const tot=r.tot,cs=r.c||r;if(tot)P.rect(L,y,tw,24,'#EDE5FF');else if(i%2)P.rect(L,y,tw,22,'#F8F5FC');let x=L;
cols.forEach((c,j)=>{const w=c.w*tw,b=tot||c.b;P.text(P.fit(String(cs[j]??''),w-14,9,b),c.a==='r'?x+w-8:x+8,y+(tot?16:15),9,{b,col:(r.col&&r.col[j])||TX,al:c.a});x+=w});y+=tot?24:22});P.line(L,y,R,y,'#D8C2F8',.8);y+=20};
head(1);
o.s.forEach(s=>{if(s.t==='cards')cards(s.a);else if(s.t==='banner')banner(s);else if(s.t==='sec')sec(s.l);else if(s.t==='tbl')tbl(s.cols,s.rows);else if(s.t==='note')note(s.s)});
return P.finish((i,n)=>{P.line(L,806,R,806,'#D8C2F8',.6);P.text('Computer-generated statement  |  Mess Manager  |  '+fd(today()),L,822,8,{col:MU});P.text('Page '+i+' of '+n,R,822,8,{col:MU,al:'r'})})}
const AED=v=>'AED '+f(v),sgn=v=>(v<0?'- ':v>0?'+ ':'')+AED(Math.abs(v));
const itemTbl=it=>it.length?{t:'tbl',cols:[{l:'#',w:.05},{l:'Date',w:.14},{l:'Shop',w:.25},{l:'Invoice no.',w:.13},{l:'Category',w:.16},{l:'Paid by',w:.12},{l:'Amount (AED)',w:.15,a:'r'}],rows:[...it.map((i,n)=>[String(n+1),fd(i.date),i.shop,i.no||'-',i.cat||'-',M[i.payer],f(i.amt)]),{c:['','','','','','Total',f(it.reduce((a,i)=>a+i.amt,0))],tot:1}]}:{t:'note',s:'No invoices.'};
const byDate=l=>l.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
function monthDoc(){const l=inM(mon),c=calc(l),it=byDate(l),act=ids().filter(k=>on(k,mon+'-31')||c.p[k]||c.sh[k]);
const mn=new Date(mon+'-01T00:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'}),ex=EX.filter(x=>x.type==='exit'&&(x.from||x.date).slice(0,7)<=mon&&x.date.slice(0,7)>=mon);
return{title:'SETTLEMENT INVOICE',no:'MM-'+mon.replace('-',''),s:[
{t:'cards',a:[['Billing period',mn],['Invoices',String(c.n)],['Members',String(act.length)],['Currency','AED']]},
{t:'cards',a:[['Total expenses',AED(c.t)],['Average share',AED(avg(c))],['Largest invoice',it.length?AED(Math.max(...it.map(i=>i.amt))):'-']]},
{t:'sec',l:'Member summary'},
{t:'tbl',cols:[{l:'Member',w:.28,b:1},{l:'Paid',w:.2,a:'r'},{l:'Share',w:.2,a:'r'},{l:'Balance',w:.32,a:'r'}],rows:act.map(k=>({c:[M[k],AED(c.p[k]),AED(c.sh[k]),sgn(c.bal[k])+(c.bal[k]>0?'  receives':c.bal[k]<0?'  pays':'  settled')],col:[0,0,0,c.bal[k]>0?'#15803D':c.bal[k]<0?'#B91C1C':MU]}))},
{t:'sec',l:'Settlement - who pays whom'},
c.tr.length?{t:'tbl',cols:[{l:'From',w:.34,b:1},{l:'To',w:.34,b:1},{l:'Amount',w:.32,a:'r'}],rows:c.tr.map(x=>[M[x.from],M[x.to],AED(x.amt)])}:{t:'note',s:'All settled. No payments are due for this month.'},
...ex.map(x=>({t:'note',s:M[x.member]+' left on '+fd(x.date)+'; final settlement saved ('+res(x)[0]+' '+AED(Math.abs(x.fin))+').'})),
{t:'sec',l:'Itemised invoices'},itemTbl(it)]}}
function finalDoc(r){const k=r.member,lab=res(r)[0],it=byDate(all.filter(i=>(r.ids||[]).includes(i.id)));
return{title:'FINAL SETTLEMENT',no:'FS-'+r.date.replace(/-/g,'')+'-'+M[k].slice(0,3),s:[
{t:'cards',a:[['Member',M[k]],['Last active date',fd(r.date)],['Period',fd(r.from)+' - '+fd(r.date)]]},
{t:'banner',col:r.fin>0?'#16A34A':r.fin<0?'#DC2626':'#7138B8',k:'FINAL BALANCE',v:lab+'   '+AED(Math.abs(r.fin)),r:M[k]},
{t:'sec',l:'Calculation'},
{t:'tbl',cols:[{l:'Item',w:.62},{l:'Amount',w:.38,a:'r'}],rows:[['Total mess expenses in period ('+r.n+' invoices)',AED(r.total)],[M[k]+' actually paid',AED(r.paid)],[M[k]+' equal share',AED(r.share)],['Previous balance (+ owed / - credit)',sgn(r.adj)],{c:['Net settlement ('+lab+')',AED(Math.abs(r.fin))],tot:1}]},
{t:'sec',l:'Member breakdown for this period'},
{t:'tbl',cols:[{l:'Member',w:.28,b:1},{l:'Paid',w:.24,a:'r'},{l:'Share',w:.24,a:'r'},{l:'Difference',w:.24,a:'r'}],rows:ids().filter(i=>r.p[i]||r.sh[i]).map(i=>[M[i],AED(r.p[i]),AED(r.sh[i]),sgn(r.p[i]-r.sh[i])])},
r.notes?{t:'note',s:'Notes: '+r.notes}:{t:'note',s:'Only invoices dated within the period above are counted. Expenses after the last active date are not charged to '+M[k]+'.'},
{t:'sec',l:'Invoices included in this settlement'},itemTbl(it)]}}
async function pdfOut(b,n){const fl=new File([b],n,{type:'application/pdf'});try{if(navigator.canShare&&navigator.canShare({files:[fl]})){await navigator.share({files:[fl],title:n});return}}catch(x){if(x&&x.name==='AbortError')return}dl(b,n);toast('PDF downloaded')}
const xpdf=()=>pdfOut(renderInv(finalDoc(XR)),'Final-Settlement-'+M[XR.member]+'-'+XR.date+'.pdf');
