const VIAC_GLOBAL_FUNDS=['UBS SMI','UBS SPI Extra','UBS Canada','UBS US - Pension Fund','UBS Pacific ex Japan','UBS Emerging Markets','UBS Europe ex CH','UBS Japan - Pension Fund'];
const VIAC_SWISS_FUNDS=['UBS SMI','UBS SPI Extra','UBS ETF SLI','UBS Canada','UBS US - Pension Fund','UBS Pacific ex Japan','UBS Emerging Markets','UBS Europe ex CH','UBS Japan - Pension Fund'];
const VIAC_MANAGED=['Portfolio Global 100','Portfolio Global 100 II','Portfolio Global Schweiz','Portfolio Schweiz','Portfolio Schweiz II'];
function reconcileViacSnapshot(snapshot){
 for(const balance of snapshot.positions.filter(p=>p.viacRole==='balance')){
  if(!Number.isFinite(balance.viacTotal)||balance.viacTotal<0)throw Error('Bitte einen gültigen VIAC-Portfoliowert ab 0.00 eingeben.');
  const funds=snapshot.positions.filter(p=>p.viacParentId===balance.id);
  if(funds.some(p=>!Number.isFinite(p.value)||p.value<0))throw Error('Fondsbeträge müssen mindestens 0.00 sein.');
  balance.value=0;
 }
 return snapshot;
}
function migrateViacFunds(d){
 if(d.viacFundsVersion>=1)return d;
 for(const snapshot of Object.values(d.months))for(const portfolio of VIAC_MANAGED){
  const existing=snapshot.positions.filter(p=>p.bank==='VIAC'&&p.portfolio===portfolio);if(!existing.length)continue;
  const total=existing.reduce((a,p)=>a+p.value,0),balance=existing.find(p=>p.name===portfolio)||{id:'viac-balance-'+portfolio,name:portfolio,bank:'VIAC',portfolio,kind:'Fonds / Mandat',asset:'Aktien',value:0,locked:true,country:'',sector:'',currency:'',alloc:{asset:{},sector:{},country:{},currency:{}}};
  if(!snapshot.positions.includes(balance))snapshot.positions.push(balance);
  balance.viacRole='balance';balance.viacTotal=total;balance.name='Noch nicht auf Fonds aufgeteilt';
  for(const p of existing.filter(p=>p!==balance)){p.viacRole='fund';p.viacParentId=balance.id;p.valuePending=!!p.valuePending}
  const list=portfolio.includes('Global 100')?VIAC_GLOBAL_FUNDS:VIAC_SWISS_FUNDS;
  list.forEach((name,i)=>{if(snapshot.positions.some(p=>p.viacParentId===balance.id&&p.name===name))return;snapshot.positions.push({id:balance.id+'-fund-'+i,name,bank:'VIAC',portfolio,kind:'Fonds / Mandat',asset:'Aktien',value:0,valuePending:true,locked:true,country:'',sector:'',currency:'',alloc:{asset:{},country:{},sector:{},currency:{}},viacRole:'fund',viacParentId:balance.id})});
 }
 d.viacFundsVersion=1;for(const snapshot of Object.values(d.months))reconcileViacSnapshot(snapshot);return d;
}
function portfolioCount(items){return items.length+' '+(items.length===1?'Position':'Positionen')}
function viacPortfolioControl(items){const parentId=items.find(p=>p.viacParentId)?.viacParentId;const balance=data.months[month].positions.find(p=>p.id===parentId&&p.viacRole==='balance');if(!balance)return '';const members=data.months[month].positions.filter(p=>p.viacParentId===balance.id),funds=members.filter(p=>p.viacRole==='fund'),cash=members.find(p=>p.viacRole==='cash'),recorded=funds.filter(p=>!p.valuePending).length,positionTotal=sum(members),difference=positionTotal-balance.viacTotal;return `<div class="viac-control"><label>Abgleichswert laut Depot CHF<input type="text" inputmode="decimal" data-viac-total="${esc(balance.id)}" value="${money(balance.viacTotal)}" aria-label="Abgleichswert CHF ${esc(balance.portfolio)}"></label><div><b>${recorded} / ${funds.length} Fonds erfasst · 3a-Konto: ${cash&&!cash.valuePending?'erfasst':'offen'}</b><p class="sub">Positionstotal inkl. 3a-Konto CHF: ${money(positionTotal)} · Differenz zum Abgleichswert CHF: ${money(difference)} ${Math.abs(difference)<=.050001?'· innerhalb Rundungstoleranz':''}</p><p class="sub">Fonds und echtes 3a-Konto zählen zum Vermögen. Der Abgleichswert wird nicht addiert. Rundungsdifferenzen bis 0.05 CHF werden separat ausgewiesen.</p><button type="button" class="primary" data-viac-save="${esc(balance.id)}">Positionen speichern</button> ${viacReportSummary(balance)}<p class="sub" data-viac-preview="${esc(balance.id)}"></p></div></div>`}
function updateViacTotal(id,value){const snapshot=structuredClone(data.months[month]),balance=snapshot.positions.find(p=>p.id===id&&p.viacRole==='balance');if(!balance)throw Error('VIAC-Portfolio nicht gefunden.');balance.viacTotal=value;reconcileViacSnapshot(snapshot);data.months[month]=snapshot}
function updateHoldingValue(id,value){const snapshot=structuredClone(data.months[month]),p=snapshot.positions.find(p=>p.id===id);if(!p)throw Error('Position nicht gefunden.');if(p.viacRole==='balance')throw Error('Den Restbetrag bitte über die Fonds und den Portfoliowert ändern.');p.value=value;if(['fund','cash'].includes(p.viacRole))p.valuePending=false;reconcileViacSnapshot(snapshot);data.months[month]=snapshot}
function upsertHolding(p){const snapshot=structuredClone(data.months[month]),index=snapshot.positions.findIndex(x=>x.id===p.id),old=snapshot.positions[index];if(old?.viacRole==='balance')throw Error('Den Restbetrag bitte über die Fonds und den Portfoliowert ändern.');if(['fund','cash'].includes(old?.viacRole)){
 if(p.bank!==old.bank||p.portfolio!==old.portfolio)throw Error('Die Zuordnung eines VIAC-Fonds zum Portfolio bitte beibehalten.');p.viacRole=old.viacRole;p.viacParentId=old.viacParentId;p.valuePending=false;p.locked=true;
 }else{const parent=snapshot.positions.find(x=>x.viacRole==='balance'&&x.bank===p.bank&&x.portfolio===p.portfolio);if(parent){p.viacRole='fund';p.viacParentId=parent.id;p.valuePending=false;p.locked=true}}
 if(index<0)snapshot.positions.push(p);else snapshot.positions[index]=p;reconcileViacSnapshot(snapshot);data.months[month]=snapshot;
}
function validateViac(d){for(const snapshot of Object.values(d.months)){
 const ids=new Set(snapshot.positions.map(p=>p.id));
 for(const p of snapshot.positions){if(p.viacRole!==undefined&&!['balance','fund','cash'].includes(p.viacRole))throw Error('Ungültige VIAC-Fondsstruktur.');if(['fund','cash'].includes(p.viacRole)){const parent=snapshot.positions.find(x=>x.id===p.viacParentId&&x.viacRole==='balance');if(!parent||parent.bank!==p.bank||parent.portfolio!==p.portfolio||p.bank!=='VIAC'||!ids.has(p.viacParentId)||p.value<0||typeof p.valuePending!=='boolean')throw Error('Ungültige VIAC-Fondsstruktur.')}if(p.viacRole==='balance'&&(p.bank!=='VIAC'||!Number.isFinite(p.viacTotal)||p.viacTotal<0))throw Error('Ungültiger VIAC-Portfoliowert.')}
 reconcileViacSnapshot(snapshot);
}return d}

function viacFormSnapshot(id){const snapshot=structuredClone(data.months[month]),balance=snapshot.positions.find(p=>p.id===id&&p.viacRole==='balance'),totalInput=[...document.querySelectorAll('[data-viac-total]')].find(el=>el.dataset.viacTotal===id);if(!balance||!totalInput)throw Error('VIAC-Portfolio nicht gefunden.');balance.viacTotal=parseAmount(totalInput.value);for(const fund of snapshot.positions.filter(p=>p.viacParentId===id)){const input=[...document.querySelectorAll('[data-value]')].find(el=>el.dataset.value===fund.id);if(!input)continue;if(!input.value.trim()){fund.value=0;fund.valuePending=true}else{fund.value=parseAmount(input.value);fund.valuePending=false}}reconcileViacSnapshot(snapshot);return snapshot}
function saveViacForm(id){data.months[month]=viacFormSnapshot(id);save();render()}
function previewViacForm(id){const output=[...document.querySelectorAll('[data-viac-preview]')].find(el=>el.dataset.viacPreview===id);if(!output)return;try{const snapshot=viacFormSnapshot(id),balance=snapshot.positions.find(p=>p.id===id);output.textContent=translateUI('Noch nicht gespeichert. Fonds-Total CHF: ')+money(sum(snapshot.positions.filter(p=>p.viacParentId===id)))+' · '+translateUI('Differenz zum Abgleichswert CHF: ')+money(sum(snapshot.positions.filter(p=>p.viacParentId===id))-balance.viacTotal);output.classList.remove('invalid')}catch(e){output.textContent=translateUI(e.message);output.classList.add('invalid')}}
function initViacInputs(){document.querySelector('#content').addEventListener('input',e=>{const id=e.target.dataset.viacTotal||positions().find(p=>p.id===e.target.dataset.value)?.viacParentId;if(id)previewViacForm(id)})}
