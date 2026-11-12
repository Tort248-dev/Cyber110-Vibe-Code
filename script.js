const sample={
 heroes:[
  {name:"Dynamo",icon:"✺",games:42,win:64,kda:"7.8 / 4.2 / 12.4"},
  {name:"Haze",icon:"◈",games:36,win:61,kda:"11.2 / 5.1 / 6.3"},
  {name:"Seven",icon:"ϟ",games:29,win:58,kda:"9.4 / 4.8 / 8.1"},
  {name:"Lady Geist",icon:"♧",games:24,win:54,kda:"8.6 / 5.6 / 7.2"},
  {name:"Wraith",icon:"◇",games:18,win:50,kda:"10.1 / 4.9 / 5.8"}
 ],
 matches:[
  ["W","Dynamo","8 / 3 / 14","32:14","Ranked","12 min ago"],
  ["W","Haze","13 / 5 / 7","28:51","Ranked","1 hour ago"],
  ["L","Seven","6 / 8 / 11","35:02","Ranked","3 hours ago"],
  ["W","Dynamo","9 / 4 / 16","31:45","Ranked","Yesterday"],
  ["W","Lady Geist","10 / 6 / 8","29:20","Ranked","Yesterday"],
  ["L","Wraith","7 / 9 / 5","33:18","Ranked","Yesterday"],
  ["W","Haze","15 / 3 / 6","26:41","Ranked","2 days ago"],
  ["W","Dynamo","5 / 2 / 18","30:06","Ranked","2 days ago"],
  ["L","Seven","8 / 10 / 9","38:15","Ranked","3 days ago"],
  ["W","Haze","12 / 4 / 8","27:33","Ranked","3 days ago"]
 ],
 winrate:[48,52,46,55,51,59,57,62,54,58,64,60,55,67,61,58,63,56,60,66,58,62,57,64,60,68,59,63,61,58],
 rank:[22,24,23,28,30,29,34,33,37,39,38,43,45,44,48,51,50,54,57,56,61,63,62,67,70,68,73,76,78,82]
};
let period=30,allMatches=false,sortWin=true,liveMatches=[],liveHeroes=[],rankHistory=[];
const API="https://api.deadlock-api.com/v1";
const $=id=>document.getElementById(id);
function setStatus(message,ok=false){$('connectionStatus').textContent=message;$('connectionStatus').style.color=ok?'var(--green)':'var(--muted)';}
function fmtDuration(seconds){if(!Number.isFinite(seconds))return '—';return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function first(obj,keys){for(const k of keys)if(obj?.[k]!=null)return obj[k];return null;}
function normalizeMatch(m){const stats=m.player_stats||m.stats||m;const kills=num(first(stats,['kills','kill'])),deaths=num(first(stats,['deaths','death'])),assists=num(first(stats,['assists','assist']));
 const won=first(m,['won','win','is_win']);const team=first(m,['player_team','team']);const winningTeam=first(m,['winning_team','winner_team']);
 let result=typeof won==='boolean'?won:(winningTeam!=null&&team!=null?String(winningTeam)===String(team):null);
 return {id:first(m,['match_id','matchId','id']),hero:first(m,['hero_name','hero','hero_id'])??'Unknown hero',kills,deaths,assists,duration:fmtDuration(num(first(m,['match_duration_s','duration_s','duration']))),time:first(m,['start_time','start_time_s','timestamp'])??null,result};}
function matchDate(v){if(v==null)return '—';let d=typeof v==='number'?new Date(v<1e12?v*1000:v):new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString();}
async function getJson(url){const res=await fetch(url,{headers:{Accept:'application/json'}});if(!res.ok)throw new Error(`API returned HTTP ${res.status} for ${new URL(url).pathname}`);return res.json();}
async function loadProfile(){const raw=$('playerId').value.trim();if(!raw){$('notice').innerHTML='<b>Enter your SteamID3/account ID.</b> You can find it in your Steam profile URL or use a Steam ID converter.';return;}
 const id=raw.replace(/^\s+|\s+$/g,'');if(!/^\d+$/.test(id)){ $('notice').textContent='Please enter a numeric Steam account ID (SteamID3/account ID), not a display name or vanity URL.';return;}
 setStatus('Connecting…');$('loadBtn').disabled=true;$('notice').textContent='Fetching public match history and player summary…';
 try{
  const history=await getJson(`${API}/players/${encodeURIComponent(id)}/match-history?limit=100`);
  const matches=Array.isArray(history)?history:(history.matches||history.data||[]);
  if(!Array.isArray(matches)||!matches.length)throw new Error('No public match history was returned. Check the ID and whether your stats are public.');
  liveMatches=matches.map(normalizeMatch);liveMatches.sort((a,b)=>num(b.time)-num(a.time));
  const name=`Steam ${id}`;
  $('playerName').textContent=name;$('playerSub').textContent=`Steam account ${id} · Deadlock API`;
  const known=liveMatches.filter(m=>m.result!==null);const wins=known.filter(m=>m.result).length;const losses=known.length-wins;
  $('winrate').textContent=known.length?`${(wins/known.length*100).toFixed(1)}%`:'N/A';$('matches').textContent=liveMatches.length;
  const totalK=liveMatches.reduce((s,m)=>s+m.kills,0),totalD=liveMatches.reduce((s,m)=>s+m.deaths,0),totalA=liveMatches.reduce((s,m)=>s+m.assists,0),count=liveMatches.length||1;
  $('kda').textContent=`${(totalK/count).toFixed(1)} / ${(totalD/count).toFixed(1)} / ${(totalA/count).toFixed(1)}`;
  let streak=0;for(const m of liveMatches){if(m.result===true)streak++;else break;}
  $('streak').textContent=streak?`${streak} W`:'—';$('winrateNote').textContent=`${wins} wins · ${losses} losses · ${known.length} matches with result data`;
  const rank=null;$('rankName').textContent='Not available';$('rankNote').textContent='Rank is not returned by match history';
  renderLive();setStatus('API connected',true);$('notice').innerHTML=`<b>Connected:</b> Live match history loaded for ${name}. Stats reflect the most recent ${liveMatches.length} matches returned by the API. Some fields may be unavailable depending on API response/privacy settings.`;
  // Rank history is unavailable from the match-history response.
 }catch(err){setStatus('Connection failed');$('notice').innerHTML=`<b>Could not load live stats:</b> ${String(err.message||err)}. Verify the numeric Steam account ID and check that your Deadlock profile is public. The API may also change endpoint schemas or limit requests.`;console.error(err);}
 finally{$('loadBtn').disabled=false;}}
function renderLive(){
 const known=liveMatches.filter(m=>m.result!==null);const wins=known.filter(m=>m.result).length;const recent=known.slice(0,10);$('recentRecord').textContent=`${recent.filter(m=>m.result).length}W · ${recent.filter(m=>!m.result).length}L`;
 $('formDots').innerHTML=liveMatches.slice(0,10).map((m,i)=>`<button title="Match ${i+1}: ${m.result===null?'Result unavailable':m.result?'Victory':'Defeat'}" style="width:34px;height:34px;padding:0;background:${m.result===true?'#123b32':m.result===false?'#401e2a':'#252d3b'};color:${m.result===true?'#50e3a4':m.result===false?'#ff6b83':'#9aa8c3'};font-weight:800">${m.result===true?'W':m.result===false?'L':'?'}</button>`).join('');
 $('matchesTable').innerHTML=(allMatches?liveMatches:liveMatches.slice(0,5)).map(m=>`<tr><td class="result ${m.result===true?'win':m.result===false?'loss':''}">${m.result===true?'VICTORY':m.result===false?'DEFEAT':'UNKNOWN'}</td><td><div class="hero-cell">${m.hero}</div></td><td class="kda">${m.kills} / ${m.deaths} / ${m.assists}</td><td>${m.duration}</td><td>Match</td><td>${matchDate(m.time)}</td></tr>`).join('');
 const byHero={};for(const m of liveMatches){const h=String(m.hero);if(!byHero[h])byHero[h]={name:h,icon:'✦',games:0,wins:0,k:0,d:0,a:0};const x=byHero[h];x.games++;if(m.result===true)x.wins++;x.k+=m.kills;x.d+=m.deaths;x.a+=m.assists;}
 liveHeroes=Object.values(byHero).map(h=>({...h,win:h.games?h.wins/h.games*100:0,kda:`${(h.k/h.games).toFixed(1)} / ${(h.d/h.games).toFixed(1)} / ${(h.a/h.games).toFixed(1)}`}));renderHeroes();
 const winSeries=liveMatches.slice(0,period).reverse().map((m,i,arr)=>{const from=Math.max(0,i-4),chunk=arr.slice(from,i+1).filter(x=>x.result!==null);return chunk.length?chunk.filter(x=>x.result).length/chunk.length*100:0;});
 svgLine('performanceChart',winSeries.length>1?winSeries:[0,0],'#a78bfa');
 const saved=(()=>{try{return JSON.parse(localStorage.getItem('deadlock-rank-history')||'[]')}catch(e){return []}})();rankHistory=saved;
 if(rankHistory.length>1){svgLine('rankChart',rankHistory.map(x=>x.rank),'#6da8ff');$('rankDelta').textContent='Saved snapshots';}else{$('rankChart').innerHTML='<text x="300" y="80" text-anchor="middle" fill="currentColor" opacity=".6" font-size="13">Rank history accumulates after repeated visits</text>';}
}
function svgLine(id,values,color,fill=true){
 const svg=document.getElementById(id),w=600,h=id==="rankChart"?160:220,p=24;
 const min=Math.min(...values)-5,max=Math.max(...values)+5;
 const pts=values.map((v,i)=>`${p+i*(w-2*p)/(values.length-1)},${h-p-(v-min)/(max-min)*(h-2*p)}`).join(" ");
 let grid="";
 for(let i=0;i<4;i++){let y=p+i*(h-2*p)/3;grid+=`<line x1="${p}" y1="${y}" x2="${w-p}" y2="${y}" stroke="currentColor" opacity=".09"/>`}
 svg.innerHTML=grid+(fill?`<polygon points="${p},${h-p} ${pts} ${w-p},${h-p}" fill="${color}" opacity=".10"/>`:"")+`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`+values.map((v,i)=>{if(i%Math.ceil(values.length/8))return "";let x=p+i*(w-2*p)/(values.length-1),y=h-p-(v-min)/(max-min)*(h-2*p);return `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`}).join("");
}
function renderHeroes(){
 let heroes=[...(liveHeroes.length?liveHeroes:sample.heroes)].sort((a,b)=>sortWin?b.win-a.win:b.games-a.games);
 document.getElementById("heroList").innerHTML=heroes.map(h=>`<div><div class="hero-row"><div class="hero-avatar">${h.icon}</div><div><div class="hero-name">${h.name}</div><div class="hero-meta">${h.games} matches · ${h.kda} K/D/A</div></div><div class="hero-stat">${h.win}%<small>win rate</small></div></div><div class="bar"><i style="width:${h.win}%"></i></div></div>`).join("");
}
function renderMatches(){
 if(liveMatches.length){renderLive();return;}
 let data=allMatches?sample.matches:sample.matches.slice(0,5);
 document.getElementById("matchesTable").innerHTML=data.map(m=>`<tr><td class="result ${m[0]==="W"?"win":"loss"}">${m[0]==="W"?"VICTORY":"DEFEAT"}</td><td><div class="hero-cell"><span class="hero-avatar" style="width:25px;height:25px;font-size:11px">${(sample.heroes.find(h=>h.name===m[1])||{icon:"✦"}).icon}</span>${m[1]}</div></td><td class="kda">${m[2]}</td><td>${m[3]}</td><td>${m[4]}</td><td>${m[5]}</td></tr>`).join("");
}
function renderForm(){
 const outcomes=["W","W","L","W","W","L","W","W","L","W"];
 document.getElementById("formDots").innerHTML=outcomes.map((o,i)=>`<button title="Match ${10-i}: ${o==="W"?"Victory":"Defeat"}" style="width:34px;height:34px;padding:0;background:${o==="W"?"#123b32":"#401e2a"};border-color:${o==="W"?"#23664f":"#733044"};color:${o==="W"?"#50e3a4":"#ff6b83"};font-weight:800">${o}</button>`).join("");
}
function render(){let vals=sample.winrate.slice(-period);svgLine("performanceChart",vals,"#a78bfa");svgLine("rankChart",sample.rank,"#6da8ff");renderHeroes();renderMatches();renderForm();}
document.querySelectorAll("[data-period]").forEach(b=>b.addEventListener("click",()=>{period=b.dataset.period==="all"?100:Number(b.dataset.period);document.querySelectorAll("[data-period]").forEach(x=>x.classList.toggle("active",x===b));liveMatches.length?renderLive():render()}));
document.getElementById("heroSort").onclick=()=>{sortWin=!sortWin;document.getElementById("heroSort").textContent=sortWin?"Sort: Win rate":"Sort: Matches";renderHeroes()};
document.getElementById("showAll").onclick=()=>{allMatches=!allMatches;document.getElementById("showAll").textContent=allMatches?"Show fewer matches ↑":"Show all matches ↓";renderMatches()};
document.getElementById("loadBtn").onclick=loadProfile;
document.getElementById("playerId").addEventListener("keydown",e=>{if(e.key==='Enter')loadProfile()});
render();
