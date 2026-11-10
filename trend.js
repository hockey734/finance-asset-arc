let trendRange='all';
function roundChartStep(rough){
 const magnitude=10**Math.floor(Math.log10(Math.max(1,rough)));
 return [1,2,5,10].map(n=>n*magnitude).find(n=>n>=rough);
}
function chartCHF(value){return money(value).split('.')[0]}

function trendRows(d,selectedMonth,range){
 const byMonth=new Map();
 for(const h of [...d.history].sort((a,b)=>a.date.localeCompare(b.date)))byMonth.set(h.date.slice(0,7),{month:h.date.slice(0,7),value:h.value,source:'history'});
 for(const [m,snapshot] of Object.entries(d.months))byMonth.set(m,{month:m,value:snapshot.positions.filter(p=>p.viacRole!=='balance').reduce((a,p)=>a+p.value,0),source:'positions'});
 const serial=m=>{const[y,b]=m.split('-').map(Number);return y*12+b};
 let cutoff=-Infinity;
 if(range==='ytd')cutoff=serial(selectedMonth.slice(0,4)+'-01');
 else if(range!=='all')cutoff=serial(selectedMonth)-Number(range)+1;
 return [...byMonth.values()].filter(r=>r.month<=selectedMonth&&serial(r.month)>=cutoff).sort((a,b)=>a.month.localeCompare(b.month));
}
function trend({includeFlows=false}={}){
 const rows=trendRows(data,month,trendRange);
 const controls=`<div class="trend-controls"><div class="trend-key"><span><i></i> Historie</span><span><i></i> Monatsbestände</span>${includeFlows?'<span class="trend-key-flow"><i></i> Netto-Geldflüsse</span><span class="trend-key-performance"><i></i> Performance in CHF</span>':''}</div><label>Zeitraum<select data-trend-range aria-label="Zeitraum der Vermögensentwicklung">${[['1','1 Monat'],['3','3 Monate'],['6','6 Monate'],['ytd','YTD (year-to-date)'],['12','1 Jahr'],['36','3 Jahre'],['60','5 Jahre'],['all','All']].map(([v,l])=>`<option value="${v}" ${trendRange===v?'selected':''}>${l}</option>`).join('')}</select></label></div>`;
 if(!rows.length)return controls+'<p class="empty">Keine Werte in diesem Zeitraum vorhanden.</p>';
 const low=Math.min(...rows.map(r=>r.value)),high=Math.max(...rows.map(r=>r.value)),padding=Math.max((high-low)*.12,Math.abs(high)*.025,1);
 const step=roundChartStep((high-low+2*padding)/4);
 const min=Math.floor((low-padding)/step)*step,max=Math.ceil((high+padding)/step)*step;
 const x0=112,x1=794,y0=40,y1=258;
 const serial=m=>{const[y,b]=m.split('-').map(Number);return y*12+b};
 const first=serial(rows[0].month),last=serial(rows.at(-1).month);
 const yAt=v=>y1-(v-min)/(max-min)*(y1-y0);
 const points=rows.map((r,i)=>({...r,x:last===first?(x0+x1)/2:x0+(serial(r.month)-first)/(last-first)*(x1-x0),y:yAt(r.value),change:i?r.value-rows[i-1].value:null}));
 if(includeFlows){
  for(const point of points){
   const snapshot=data.months[point.month];
   point.flow=null;
   point.performance=null;
   if(!snapshot)continue;
   const prior=data.months[previousCalendarMonth(point.month)];
   const rows=monthlyFlowRows(snapshot,prior);
   const entered=rows.filter(row=>row.flow!==null);
   point.flow=entered.length?combinedFlow(entered):monthlyNetFlow(snapshot,prior);
   point.flowPartial=entered.length>0&&entered.length<rows.length;
   const priorMonth=previousCalendarMonth(point.month);
   if(prior&&snapshotHasCompleteViac(data,priorMonth)&&snapshotHasCompleteViac(data,point.month)){
    const before=sum(prior.positions.filter(position=>position.viacRole!=='balance'));
    point.performance=flowPerformance(before,point.value,monthlyNetFlow(snapshot,prior)).gain;
   }
  }
 }
 const flowBottom=y1+148;
 const chartHeight=includeFlows?flowBottom+70:330;
 const axisY=includeFlows?flowBottom+26:284;
 const flowLayer=includeFlows?trendFlowLayer(points,x0,x1,y1+52,flowBottom,last-first):'';
 const path=ps=>ps.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');
 const observed=points.filter(p=>p.source==='positions'),historic=points.filter(p=>p.source==='history'),id='trend-fill-'+page;
 const ticks=[];for(const p of points.slice(0,-1))if((!ticks.length||p.x-ticks.at(-1).x>=104)&&points.at(-1).x-p.x>=104)ticks.push(p);ticks.push(points.at(-1));
 let grid='';for(let v=min;v<=max+step*.001;v+=step)grid+=`<line class="trend-gridline" x1="${x0}" x2="${x1}" y1="${yAt(v)}" y2="${yAt(v)}"/><text x="${x0-12}" y="${yAt(v)+4}" text-anchor="end">${chartCHF(v)}</text>`;
 const lines=points.slice(1).map((p,i)=>`<path class="trend-line ${p.source==='history'||points[i].source==='history'?'trend-historic':''}" d="${path([points[i],p])}"/>`).join('');
 return controls+`<div class="trend-chart"><svg viewBox="0 0 820 ${chartHeight}" data-trend-chart data-points="${esc(JSON.stringify(points))}" role="group" aria-label="${includeFlows?'Vermögensentwicklung und monatliche Netto-Geldflüsse in CHF':'Vermögensentwicklung in CHF nach Monat'}"><defs><linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%"><stop stop-color="var(--trend-blue)" stop-opacity=".22"/><stop offset="1" stop-color="var(--trend-blue)" stop-opacity=".015"/></linearGradient></defs><g class="trend-axis">${grid}<path class="trend-baseline" d="M${x0} ${y0}V${y1}H${x1}"/><text x="${x0}" y="23" class="axis-title">Vermögen in CHF</text><text x="${(x0+x1)/2}" y="${axisY+32}" text-anchor="middle" class="axis-title">Zeitraum</text>${ticks.map(p=>`<text x="${p.x}" y="${axisY}" text-anchor="middle">${p.month.slice(5)}.${p.month.slice(0,4)}</text>`).join('')}</g>${observed.length>1?`<path d="${path(observed)} L${observed.at(-1).x} ${y1} L${observed[0].x} ${y1}Z" fill="url(#${id})"/>`:''}${lines}${points.map((p,i)=>`<circle class="trend-point ${p.source==='history'?'trend-history-point':''}" cx="${p.x}" cy="${p.y}" r="${i===points.length-1?5:2.5}" tabindex="0" data-trend-index="${i}" aria-label="${esc(monthlabel(p.month))}: ${money(p.value)} CHF"/>`).join('')}${flowLayer}<line class="trend-guide" data-trend-guide x1="0" x2="0" y1="${y0}" y2="${includeFlows?flowBottom:y1}" visibility="hidden"/><circle class="trend-marker" data-trend-marker r="6" visibility="hidden"/></svg><div class="trend-tooltip" role="status" hidden></div></div><p class="sub trend-caption">${monthlabel(points[0].month)} bis ${monthlabel(points.at(-1).month)}. ${historic.length&&observed.length?'Bei Überschneidungen gelten die Monatsbestände. ':''}${observed.some(r=>!snapshotHasCompleteViac(data,r.month))?'Einige Monatsbestände sind unvollständig. ':''}Verlauf inkl. Ein- und Auszahlungen; keine Renditeberechnung.</p>`;
}
function showTrendPoint(svg,index){
 const p=JSON.parse(svg.dataset.points)[index];if(!p)return;
 const guide=svg.querySelector('[data-trend-guide]'),marker=svg.querySelector('[data-trend-marker]');
 guide.setAttribute('x1',p.x);guide.setAttribute('x2',p.x);guide.setAttribute('visibility','visible');
 marker.setAttribute('cx',p.x);marker.setAttribute('cy',p.y);marker.setAttribute('visibility','visible');
 const tip=svg.parentElement.querySelector('.trend-tooltip');
 tip.innerHTML=`<strong>${esc(monthlabel(p.month))} · ${p.source==='history'?'Historie':'Monatsbestände'}</strong><b>${money(p.value)} CHF</b><small>${p.change===null?'Erster sichtbarer Monat':'Änderung zum vorherigen sichtbaren Monat: '+money(p.change)+' CHF'}</small>${p.flow===undefined?'':`<small>Netto-Geldflüsse in CHF · ${p.flow===null?'Noch offen':money(p.flow)+(p.flowPartial?' · Teilbetrag':'')}</small><small>Performance in CHF · ${p.performance===null?'Noch offen':money(p.performance)}</small>`}`;
 tip.hidden=false;tip.style.left=Math.max(0,Math.min(svg.clientWidth-tip.offsetWidth,p.x/820*svg.clientWidth+12))+'px';tip.style.top=Math.max(0,p.y/svg.viewBox.baseVal.height*svg.clientHeight-tip.offsetHeight-10)+'px';
}
function hideTrend(svg){svg.querySelector('[data-trend-guide]')?.setAttribute('visibility','hidden');svg.querySelector('[data-trend-marker]')?.setAttribute('visibility','hidden');const tip=svg.parentElement.querySelector('.trend-tooltip');if(tip)tip.hidden=true}
function attachTrendEvents(container){container.addEventListener('pointermove',e=>{const svg=e.target.closest('[data-trend-chart]');if(!svg)return;const rect=svg.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*820,points=JSON.parse(svg.dataset.points);let nearest=0;points.forEach((p,i)=>{if(Math.abs(p.x-x)<Math.abs(points[nearest].x-x))nearest=i});showTrendPoint(svg,nearest)});container.addEventListener('pointerout',e=>{const svg=e.target.closest('[data-trend-chart]');if(svg&&!svg.contains(e.relatedTarget))hideTrend(svg)});container.addEventListener('focusin',e=>{if(e.target.hasAttribute('data-trend-index'))showTrendPoint(e.target.closest('svg'),Number(e.target.dataset.trendIndex))});container.addEventListener('focusout',e=>{const svg=e.target.closest('[data-trend-chart]');if(svg)hideTrend(svg)})}

function trendFlowLayer(points,left,right,top,bottom,monthSpan){
 const values=points.flatMap(point=>[point.flow,point.performance]).filter(value=>value!==null);
 const heading=`<text x="${left}" y="${top-24}" class="axis-title">Geldflüsse und Performance in CHF</text>`;
 if(!values.length)return `<g class="trend-axis">${heading}<text x="${left}" y="${top+24}">Für diesen Zeitraum sind noch keine Netto-Einzahlungen erfasst.</text></g>`;
 const extent=roundChartStep(Math.max(...values.map(Math.abs)));
 const zero=(top+bottom)/2;
 const width=Math.min(22,(right-left)/Math.max(1,monthSpan)*.36);
 const y=value=>zero-value/extent*(bottom-top)/2;
 const grid=[extent,0,-extent].map(value=>`<line class="trend-gridline" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left-12}" y="${y(value)+4}" text-anchor="end">${chartCHF(value)}</text>`).join('');
 const bars=points.map(point=>{
  const flowClass=point.flow<0?'flow-out':'';
  const partialClass=point.flowPartial?'flow-partial':'';
  return [
   [point.flow,point.x-width-0.5,`${flowClass} ${partialClass}`],
   [point.performance,point.x+0.5,'flow-performance']
  ].filter(([value])=>value!==null).map(([value,x,style])=>`<rect class="flow-bar ${style}" x="${x}" y="${Math.min(zero,y(value))}" width="${width}" height="${Math.max(2,Math.abs(zero-y(value)))}" rx="2" aria-hidden="true"/>`).join('');
 }).join('');
 return `<g class="trend-axis">${heading}${grid}</g>${bars}`;
}
