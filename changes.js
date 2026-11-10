function previousCalendarMonth(m){const [y,n]=m.split('-').map(Number);return n===1?(y-1)+'-12':y+'-'+String(n-1).padStart(2,'0')}
function changeBreakdown(before,after,level='holding'){
 const entries=new Map();const add=(p,side)=>{const key=JSON.stringify([p.bank,p.portfolio||'',...(level==='holding'?[p.bank==='VIAC'&&p.viacRole==='fund'?historicFundKey(p.name):p.name]:[])]);if(!entries.has(key))entries.set(key,{name:p.name,bank:p.bank,portfolio:p.portfolio||'',before:0,after:0,hadBefore:false,hadAfter:false});const row=entries.get(key);if(side==='after'){row.name=p.name;row.afterIsin=p.isin||'';row.afterName=p.name}else{row.beforeIsin=p.isin||'';row.beforeName=p.name}row[side]+=p.value;row[side==='before'?'hadBefore':'hadAfter']=true};before.forEach(p=>add(p,'before'));after.forEach(p=>add(p,'after'));return [...entries.values()].map(r=>({...r,delta:r.after-r.before})).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta))
}
function portfolioFlowKey(bank,portfolio){return JSON.stringify([bank,portfolio||''])}
function monthlyFlowRows(current,prior){
 const holdings=snapshot=>(snapshot?.positions||[]).filter(p=>p.viacRole!=='balance');
 return changeBreakdown(holdings(prior),holdings(current),'portfolio').map(row=>({
  ...row,flow:current.portfolioFlows?.[portfolioFlowKey(row.bank,row.portfolio)]??null
 }));
}
function combinedFlow(rows){
 return rows.length&&rows.every(row=>row.flow!==null)?rows.reduce((total,row)=>total+row.flow,0):null;
}
function monthlyNetFlow(current,prior){
 return Object.keys(current.portfolioFlows||{}).length?combinedFlow(monthlyFlowRows(current,prior)):current.flow;
}
function flowPerformance(before,after,flow){
 const gain=flow===null?null:after-before-flow;
 const capital=flow===null?0:before+flow/2;
 return {gain,rate:gain!==null&&capital>0?gain/capital:null};
}
function flowMoney(value){return value===null?'—':money(value)}
function flowRate(value){return value===null?'—':pct(value)}
function monthlyFlowEditor(){
 const current=data.months[month],prior=data.months[previousCalendarMonth(month)],rows=monthlyFlowRows(current,prior);
 const banks=[...new Set(rows.map(row=>row.bank))].sort((a,b)=>a.localeCompare(b,'de-CH'));
 const groups=banks.map(bank=>{
  const items=rows.filter(row=>row.bank===bank).sort((a,b)=>a.portfolio.localeCompare(b.portfolio,'de-CH'));
  const total=combinedFlow(items);
  return `<details class="portfolio-fold"><summary><span>${esc(bank)}</span><strong>${total===null?'Noch offen':money(total)+' CHF'}</strong></summary><div class="tablewrap"><table><thead><tr><th>Portfolio</th><th class="num">Netto-Einzahlung CHF</th></tr></thead><tbody>${items.map(row=>`<tr><td>${esc(row.portfolio||'Direkte Anlagen')}</td><td class="num"><input type="text" inputmode="decimal" data-portfolio-flow name="${esc(portfolioFlowKey(row.bank,row.portfolio))}" value="${row.flow===null?'':money(row.flow)}" placeholder="Noch offen" aria-label="Netto-Einzahlung ${esc(bank+' / '+(row.portfolio||'Direkte Anlagen'))}"></td></tr>`).join('')}</tbody></table></div></details>`;
 }).join('');
 const savedTotal=rows.reduce((total,row)=>total+(row.flow??0),0);
 const openCount=rows.filter(row=>row.flow===null).length;
 const totalLabel=current.portfolioFlows===undefined&&openCount===rows.length?'—':money(savedTotal);
 return panel('Netto-Einzahlungen',`<p class="sub">Einzahlungen positiv, Auszahlungen negativ. Bei keinem Geldfluss 0.00 eingeben. Leere Felder bleiben offen. Interne Umbuchungen auf beiden Seiten erfassen.</p>${rows.length?`<form id="portfolioFlows">${groups}<p class="sub">Gesamttotal CHF · ${totalLabel}${openCount?' · Offene Portfolio-Eingaben: '+openCount:''}</p><button type="submit" class="primary">Netto-Einzahlungen speichern</button><p class="sub" role="status" id="portfolioFlowStatus"></p></form>`:'<p class="empty">Keine Positionen gefunden.</p>'}`);
}
function savePortfolioFlows(form){
 const snapshot=data.months[month];
 const next={...snapshot.portfolioFlows};
 for(const input of form.querySelectorAll('[data-portfolio-flow]')){
  const raw=input.value.trim();
  if(!raw){delete next[input.name];continue}
  const amount=parseAmount(raw);
  if(!Number.isFinite(amount)){
   input.closest('details').open=true;
   input.focus();
   throw Error('Bitte eine gültige Netto-Einzahlung eingeben.');
  }
  next[input.name]=amount;
 }
 snapshot.portfolioFlows=next;
}
function validPortfolioFlows(flows){
 if(!flows||typeof flows!=='object'||Array.isArray(flows))return false;
 return Object.entries(flows).every(([key,value])=>{
  if(!Number.isFinite(value))return false;
  try{const pair=JSON.parse(key);return Array.isArray(pair)&&pair.length===2&&pair.every(part=>typeof part==='string')&&portfolioFlowKey(...pair)===key}
  catch{return false}
 });
}
function flowComparisonTable(rows){
 return `<div class="tablewrap"><table class="changes-table"><thead><tr><th>Portfolio / Institut</th><th class="num">Bestandsveränderung CHF</th><th class="num">Netto-Einzahlung CHF</th><th class="num">Bereinigtes Ergebnis CHF</th><th class="num">Geschätzte Rendite</th></tr></thead><tbody>${rows.map(row=>{
  const result=flowPerformance(row.before,row.after,row.flow);
  return `<tr><td><b translate="no">${esc(row.portfolio||row.bank||'Direkte Anlagen')}</b>${row.portfolio&&row.bank?`<small>${esc(row.bank)}</small>`:''}</td><td class="num">${money(row.after-row.before)}</td><td class="num">${flowMoney(row.flow)}</td><td class="num">${flowMoney(result.gain)}</td><td class="num">${flowRate(result.rate)}</td></tr>`;
 }).join('')}</tbody></table></div>`;
}
function showMonthlyChanges(){const prev=previousCalendarMonth(month),current=data.months[month],prior=data.months[prev],dialog=document.querySelector('#changesDialog');if(!prior){dialog.innerHTML=`<h2>Veränderung zum Vormonat</h2><p>Für den direkten Kalendervormonat fehlen Positionsdaten. Ein Vergleich ist erst mit beiden Monatsbeständen möglich.</p><button type="button" data-close-changes>Schliessen</button>`;dialog.showModal();return}
 if(!snapshotHasCompleteViac(data,prev)||!snapshotHasCompleteViac(data,month)){dialog.innerHTML=`<h2>Monatsvergleich noch unvollständig</h2><p>Für einen verlässlichen Monatsvergleich müssen die Fonds- und Kontowerte beider Monate vollständig erfasst sein. Eine nachträgliche Ergänzung fehlender VIAC-Beträge ist keine Vermögensrendite.</p><p>${monthlabel(prev)} → ${monthlabel(month)}</p><button type="button" data-close-changes>Schliessen</button>`;dialog.showModal();return}
 const before=sum(prior.positions.filter(p=>p.viacRole!=='balance')),after=sum(current.positions.filter(p=>p.viacRole!=='balance')),delta=after-before,rows=changeBreakdown(prior.positions,current.positions),portfolios=changeBreakdown(prior.positions,current.positions,'portfolio'),signed=v=>(v>0?'+':'')+money(v),status=r=>r.hadBefore&&r.hadAfter?(r.beforeName!==r.afterName||r.beforeIsin!==r.afterIsin?'In beiden Monaten erfasst · Bezeichnung oder ISIN geändert':'In beiden Monaten erfasst'):r.hadAfter?'Nur im aktuellen Bestand':'Nur im Vormonat';
 const tableRows=(items,level)=>`<div class="tablewrap"><table class="changes-table"><thead><tr><th>${level==='holding'?'Position':'Portfolio / Institut'}</th><th class="num">Vormonat CHF</th><th class="num">Aktuell CHF</th><th class="num">Veränderung CHF</th><th class="num">Beitrag zur Gesamtänderung in Prozentpunkten</th></tr></thead><tbody>${items.map(r=>`<tr><td><b translate="no">${esc(level==='holding'?r.name:r.portfolio||'Direkte Anlagen')}</b><small>${esc(r.bank)}${level==='holding'?' / '+esc(r.portfolio||'Direkte Anlagen'):''}</small>${level==='holding'?`<small>${status(r)}</small>`:''}</td><td class="num">${money(r.before)}</td><td class="num">${money(r.after)}</td><td class="num change-${r.delta>=0?'up':'down'}">${signed(r.delta)}</td><td class="num">${before?money(r.delta/before*100):'—'}</td></tr>`).join('')}</tbody><tfoot><tr><th>Gesamt</th><th class="num">${money(before)}</th><th class="num">${money(after)}</th><th class="num">${signed(delta)}</th><th class="num">${before?money(delta/before*100):'—'}</th></tr></tfoot></table></div>`;
 const flowRows=monthlyFlowRows(current,prior);
 const instituteRows=[...new Set(flowRows.map(row=>row.bank))].map(bank=>{
  const items=flowRows.filter(row=>row.bank===bank);
  return {bank,before:items.reduce((total,row)=>total+row.before,0),after:items.reduce((total,row)=>total+row.after,0),flow:combinedFlow(items)};
 });
 const flow=monthlyNetFlow(current,prior);
 const {gain:adjustedChange,rate:estimatedReturn}=flowPerformance(before,after,flow);
 const unchanged=rows.filter(r=>Math.abs(r.delta)<.000001).length,changed=rows.filter(r=>Math.abs(r.delta)>=.000001),largest=changed[0];
 dialog.innerHTML=`<div class="panelhead"><div><h2>Was hat sich verändert?</h2><p class="sub">${monthlabel(prev)} → ${monthlabel(month)}</p></div><button type="button" data-close-changes>Schliessen</button></div><div class="cards change-cards"><div class="card"><span class="label">Vormonat CHF</span><div class="metric">${money(before)}</div></div><div class="card"><span class="label">Aktuell CHF</span><div class="metric">${money(after)}</div></div><div class="card"><span class="label">Geschätzte Monatsrendite</span><div class="metric">${estimatedReturn===null?'—':(estimatedReturn>0?'+':'')+pct(estimatedReturn)}</div></div><div class="card"><span class="label">Vermögensänderung inkl. Geldflüsse</span><div class="metric">${adjustedChange===null?'—':signed(adjustedChange)+' CHF'}</div><small>${flow===null?'Netto-Einzahlungen fehlen':'Netto-Einzahlung CHF · '+signed(flow)}</small></div><div class="card"><span class="label">Vermögensänderung exkl. Geldflüsse</span><div class="metric">${signed(delta)} CHF</div><small>${before?pct(delta/before):'—'} · gegenüber Vormonat</small></div></div><div class="warning">Diese Auswertung erklärt die Veränderung der erfassten Bestände. Sie trennt Kurs- und Währungseffekte, Käufe, Verkäufe, Ausschüttungen und Überträge nicht. Neue oder fehlende Einträge können auch durch Umbenennungen oder Erfassungslücken entstehen. Bei VIAC können nacherfasste Fondsbeträge die angezeigte Veränderung beeinflussen, wenn die verglichenen Monatsbestände noch unvollständig sind.</div>${largest?`<p><b>Grösster absoluter Treiber:</b> <span translate="no">${esc(largest.name)}</span> · ${signed(largest.delta)} CHF</p>`:'<p>Die erfassten Bestände sind unverändert.</p>'}<h3>Geldflüsse und Rendite</h3>${flowComparisonTable([{portfolio:'Gesamt',before,after,flow}])}<p class="sub">Bereinigtes Ergebnis = Bestandsveränderung minus Netto-Einzahlung. Die geschätzte Rendite teilt das Ergebnis durch das Anfangsvermögen plus die Hälfte der Netto-Einzahlung. Dabei wird die Monatsmitte als Zahlungszeitpunkt angenommen.</p><h3>Geldflüsse nach Institut</h3>${flowComparisonTable(instituteRows)}<h3>Geldflüsse nach Portfolio</h3>${flowComparisonTable(flowRows)}<h3>Veränderung nach Portfolio</h3>${tableRows(portfolios,'portfolio')}<h3>Veränderung nach Position</h3><p class="sub">Zuordnung nach Institut, Portfolio und Positionsname. Dokumentierte VIAC-Fondsnamenwechsel werden zusammengeführt. Gleichnamige Positionen desselben Portfolios werden zusammengefasst. Prozentpunkte beziehen sich auf das gesamte Vermögen des Vormonats; gerundete Werte können abweichen.</p>${changed.length?tableRows(changed,'holding'):'<p>Keine veränderten Positionen.</p>'}${unchanged?`<p class="sub">${unchanged} unveränderte Positionen ausgeblendet.</p>`:''}`;
 dialog.showModal();
}
function initMonthlyChanges(){const dialog=document.querySelector('#changesDialog');dialog.addEventListener('click',e=>{if(e.target.closest('[data-close-changes]'))dialog.close()})}
