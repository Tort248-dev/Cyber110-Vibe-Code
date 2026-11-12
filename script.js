// JavaScript makes the dashboard interactive. It fetches match data, calculates statistics, and updates HTML elements.
// SAMPLE DATA: example values used before a real profile is loaded, so the dashboard does not start completely empty.
// An object is a collection of named values. This object holds demonstration data for the page before real match history has loaded.
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
// PAGE STATE: variables that remember the selected chart period, table settings, and data loaded from the API.
// An API (Application Programming Interface) is a service that lets this page request information from another system.
// These variables store information that changes while the page is open. An array ([]) is an ordered list; the live arrays start empty until the API responds.
let period=30,allMatches=false,sortWin=true,liveMatches=[],liveHeroes=[],rankHistory=[];
// The API base address is kept in one place so it is easy to update if the service changes.
// This constant stores the API (Application Programming Interface) base URL. A URL is a web address; the functions below add the requested endpoint and account ID to it.
const API="https://api.deadlock-api.com/v1";
// HELPER FUNCTIONS: small reusable pieces of code used by several parts of the dashboard.
// The $ shortcut finds an HTML element by its unique id.
// This short helper avoids repeating document.getElementById. The document represents the webpage, and an element is one piece of its HTML.
const $=id=>document.getElementById(id);
// STATUS MESSAGE: changes the small connection label at the top of the page.
// A function is a reusable set of instructions. This one updates the connection message and uses a different color when the connection succeeds.
function setStatus(message,ok=false){$('connectionStatus').textContent=message;$('connectionStatus').style.color=ok?'var(--green)':'var(--muted)';}
// DURATION FORMATTER: changes a match length in seconds into minutes:seconds.
// Math.floor rounds a number down, and padStart adds a leading zero when needed (for example, 4 becomes 04).
function fmtDuration(seconds){if(!Number.isFinite(seconds))return '—';return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}
// NUMBER CONVERTER: safely turns a value into a number; invalid or missing values become zero.
// Number.isFinite checks that a value is a usable number rather than text such as NaN (Not a Number) or infinity.
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
// FIELD LOOKUP: checks several possible property names and returns the first one that has a value.
// This helper checks several possible field names because API versions may label the same information differently.
function first(obj,keys){for(const k of keys)if(obj?.[k]!=null)return obj[k];return null;}
// MATCH NORMALIZATION: API responses can use different field names. This converts each match into one consistent format.
// A boolean is a value that is either true or false; null here means the result could not be identified safely.
// The API sends each match as an object. This function reshapes its fields into the consistent names used by the rest of the dashboard.
// A property is a named piece of information stored inside an object.
function normalizeMatch(m){const kills=num(first(m,['player_kills','kills']));const deaths=num(first(m,['player_deaths','deaths']));const assists=num(first(m,['player_assists','assists']));
 const won=first(m,['won','win','is_win']);const team=first(m,['player_team','team']);const winningTeam=first(m,['winning_team','winner_team']);
 const outcome=first(m,['player_match_outcome','match_result']);
 // The Deadlock match-history outcome fields use 1 for a win and 2 for a loss. Other values are left unknown.
 // Team comparison is used only when the response explicitly includes both the player's team and the winning team.
 let result=typeof won==='boolean'?won:(winningTeam!=null&&team!=null?String(winningTeam)===String(team):(Number(outcome)===1?true:Number(outcome)===2?false:null));
 return {id:first(m,['match_id','matchId','id']),hero:`Hero ID ${m.hero_id ?? 'Unknown'}`,kills,deaths,assists,lastHits:num(m.last_hits),netWorth:num(m.net_worth),heroLevel:num(m.hero_level),duration:fmtDuration(num(first(m,['match_duration_s','duration_s','duration']))),time:first(m,['start_time','start_time_s','timestamp'])??null,result};}
// DATE FORMATTING: turns the API timestamp (the numeric date/time value) into a readable date.
// DATE FORMATTER: converts a Unix timestamp (seconds or milliseconds since Jan. 1, 1970) into a readable date.
// JavaScript Date objects represent calendar dates. This function accepts either a Unix timestamp or another date format and displays a readable date.
function matchDate(v){if(v==null)return '—';let d=typeof v==='number'?new Date(v<1e12?v*1000:v):new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString();}
// API REQUEST: fetch() asks the Deadlock service for data. async/await lets the page wait for the reply before continuing.
// JSON (JavaScript Object Notation) is a common text format for sending structured data. This function requests JSON and reports an error if the server response is unsuccessful.
async function getJson(url){const res=await fetch(url,{headers:{Accept:'application/json'}});if(!res.ok)throw new Error(`API returned HTTP ${res.status} for ${new URL(url).pathname}`);return res.json();}
// LOAD PROFILE: validates the entered account ID, requests match history, calculates the summary cards, and handles errors.
// This is the main loading process. It checks the account number, downloads match history, calculates the summary values, and updates the page.
// async marks a function that can wait for slow tasks; await pauses this function until a request has finished.
async function loadProfile(){const raw=$('playerId').value.trim();if(!raw){$('notice').innerHTML='<b>Enter your SteamID3/account ID.</b> You can find it in your Steam profile URL or use a Steam ID converter.';return;}
 const id=raw.replace(/^\s+|\s+$/g,'');if(!/^\d+$/.test(id)){ $('notice').textContent='Please enter a numeric Steam account ID (SteamID3/account ID), not a display name or vanity URL.';return;}
 setStatus('Connecting…');$('loadBtn').disabled=true;$('notice').textContent='Fetching public match history and player summary…';
 try{
  // encodeURIComponent safely prepares the account ID for use inside a web address. The limit asks the API for up to 100 recent matches.
  const history=await getJson(`${API}/players/${encodeURIComponent(id)}/match-history?limit=100`);
  const matches=Array.isArray(history)?history:Array.isArray(history.matches)?history.matches:Array.isArray(history.data)?history.data:Object.values(history);
  if(!Array.isArray(matches)||!matches.length)throw new Error('No public match history was returned. Check the ID and whether your stats are public.');
  liveMatches=matches.map(normalizeMatch);liveMatches.sort((a,b)=>num(b.time)-num(a.time));
  const name=`Steam ${id}`;
  $('playerName').textContent=name;$('playerSub').textContent=`Steam account ${id} · Deadlock API`;
  // filter creates a new list containing only matches whose result is known. Unknown results are excluded so they do not distort the win rate.
  const known=liveMatches.filter(m=>m.result!==null);const wins=known.filter(m=>m.result).length;const losses=known.length-wins;
  $('winrate').textContent=known.length?`${(wins/known.length*100).toFixed(1)}%`:'N/A';$('matches').textContent=liveMatches.length;
  const totalK=liveMatches.reduce((s,m)=>s+m.kills,0),totalD=liveMatches.reduce((s,m)=>s+m.deaths,0),totalA=liveMatches.reduce((s,m)=>s+m.assists,0),count=liveMatches.length||1;
  $('kda').textContent=`${(totalK/count).toFixed(1)} / ${(totalD/count).toFixed(1)} / ${(totalA/count).toFixed(1)}`;
  // Count consecutive wins starting with the newest match. If the newest result is unknown, a current streak cannot be confirmed.
  let streak=0;for(const m of liveMatches){if(m.result===true)streak++;else break;}
  $('streak').textContent=liveMatches.length&&liveMatches[0].result!==null?`${streak} W`:'—';$('winrateNote').textContent=`${wins} wins · ${losses} losses · ${known.length} matches with result data`;
  const rank=null;$('rankName').textContent='Not available';$('rankNote').textContent='Rank is not returned by match history';
  renderLive();setStatus('API connected',true);$('notice').innerHTML=`<b>Connected:</b> Live match history loaded for ${name}. Stats reflect the most recent ${liveMatches.length} matches returned by the API. Some fields may be unavailable depending on API response/privacy settings.`;
  // Rank history is unavailable from the match-history response.
 }catch(err){setStatus('Connection failed');$('notice').innerHTML=`<b>Could not load live stats:</b> ${String(err.message||err)}. Verify the numeric Steam account ID and check that your Deadlock profile is public. The API may also change endpoint schemas or limit requests.`;console.error(err);}
 finally{$('loadBtn').disabled=false;}}
// LIVE RENDERING: redraws the match table, recent-form dots, hero summaries, and performance graph from loaded matches.
// This function redraws all sections that depend on real match history, including recent form, the table, hero totals, and performance graph.
function renderLive(){
 const known=liveMatches.filter(m=>m.result!==null);const wins=known.filter(m=>m.result).length;const recent=known.slice(0,10);$('recentRecord').textContent=`${recent.filter(m=>m.result).length}W · ${recent.filter(m=>!m.result).length}L`;
 $('formDots').innerHTML=liveMatches.slice(0,10).map((m,i)=>`<button title="Match ${i+1}: ${m.result===null?'Result unavailable':m.result?'Victory':'Defeat'}" style="width:34px;height:34px;padding:0;background:${m.result===true?'#123b32':m.result===false?'#401e2a':'#252d3b'};color:${m.result===true?'#50e3a4':m.result===false?'#ff6b83':'#9aa8c3'};font-weight:800">${m.result===true?'W':m.result===false?'L':'?'}</button>`).join('');
 $('matchesTable').innerHTML=(allMatches?liveMatches:liveMatches.slice(0,5)).map(m=>`<tr><td class="result ${m.result===true?'win':m.result===false?'loss':''}">${m.result===true?'VICTORY':m.result===false?'DEFEAT':'UNKNOWN'}</td><td><div class="hero-cell">${m.hero}</div></td><td class="kda">${m.kills} / ${m.deaths} / ${m.assists}</td><td>${m.lastHits.toLocaleString()}</td><td>${m.netWorth.toLocaleString()}</td><td>${m.heroLevel || '—'}</td><td>${m.duration}</td><td>Match</td><td>${matchDate(m.time)}</td></tr>`).join('');
 // This object groups match totals by hero name so the dashboard can calculate a separate record for each hero.
 const byHero={};for(const m of liveMatches){const h=String(m.hero);if(!byHero[h])byHero[h]={name:h,icon:'✦',games:0,wins:0,k:0,d:0,a:0};const x=byHero[h];x.games++;if(m.result===true)x.wins++;x.k+=m.kills;x.d+=m.deaths;x.a+=m.assists;}
 liveHeroes=Object.values(byHero).map(h=>({...h,win:h.games?h.wins/h.games*100:0,kda:`${(h.k/h.games).toFixed(1)} / ${(h.d/h.games).toFixed(1)} / ${(h.a/h.games).toFixed(1)}`}));renderHeroes();
 // Build a cumulative win-rate line from oldest to newest. Unknown outcomes are skipped, not treated as losses.
 const chronological=liveMatches.slice(0,period).reverse().filter(m=>m.result!==null);
 let runningWins=0;const winSeries=chronological.map((m,i)=>{if(m.result)runningWins++;return runningWins/(i+1)*100;});
 if(winSeries.length>0){svgLine('performanceChart',winSeries,'#a78bfa');}
 else{$('performanceChart').innerHTML='<text x="300" y="110" text-anchor="middle" fill="currentColor" opacity=".6" font-size="13">Match outcomes are not available yet</text>';}
 const saved=(()=>{try{return JSON.parse(localStorage.getItem('deadlock-rank-history')||'[]')}catch(e){return []}})();rankHistory=saved;
 if(rankHistory.length>1){svgLine('rankChart',rankHistory.map(x=>x.rank),'#6da8ff');$('rankDelta').textContent='Saved snapshots';}else{$('rankChart').innerHTML='<text x="300" y="80" text-anchor="middle" fill="currentColor" opacity=".6" font-size="13">Rank history accumulates after repeated visits</text>';}
}
// SVG GRAPH DRAWING: creates the chart lines and grid using SVG (a format for drawing shapes in a webpage).
// This graph helper draws a line chart inside an SVG element. It converts each number into an x/y position, then draws grid lines, a filled area, and the line itself.
// Coordinates describe positions in the SVG drawing area; x is horizontal and y is vertical.
function svgLine(id,values,color,fill=true){
 const svg=document.getElementById(id),w=600,h=id==="rankChart"?160:220,p=24;
 // A single data point is duplicated so the chart has two horizontal coordinates to draw between.
 if(values.length===1){values=[values[0],values[0]];}
 // Add a little space above and below the data. A fallback range prevents division by zero when every value is equal.
 let min=Math.min(...values)-5,max=Math.max(...values)+5;if(max===min){max=min+10;}
 const pts=values.map((v,i)=>`${p+i*(w-2*p)/(values.length-1)},${h-p-(v-min)/(max-min)*(h-2*p)}`).join(" ");
 let grid="";
 for(let i=0;i<4;i++){let y=p+i*(h-2*p)/3;grid+=`<line x1="${p}" y1="${y}" x2="${w-p}" y2="${y}" stroke="currentColor" opacity=".09"/>`}
 svg.innerHTML=grid+(fill?`<polygon points="${p},${h-p} ${pts} ${w-p},${h-p}" fill="${color}" opacity=".10"/>`:"")+`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`+values.map((v,i)=>{if(i%Math.ceil(values.length/8))return "";let x=p+i*(w-2*p)/(values.length-1),y=h-p-(v-min)/(max-min)*(h-2*p);return `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`}).join("");
}
// HERO STATISTICS: groups matches by hero and displays each hero's games, average K/D/A, and win rate.
// This function chooses the live hero totals when available; otherwise it shows the demonstration heroes. It then sorts and displays the rows.
function renderHeroes(){
 let heroes=[...(liveHeroes.length?liveHeroes:sample.heroes)].sort((a,b)=>sortWin?b.win-a.win:b.games-a.games);
 document.getElementById("heroList").innerHTML=heroes.map(h=>`<div><div class="hero-row"><div class="hero-avatar">${h.icon}</div><div><div class="hero-name">${h.name}</div><div class="hero-meta">${h.games} matches · ${h.kda} K/D/A</div></div><div class="hero-stat">${h.win}%<small>win rate</small></div></div><div class="bar"><i style="width:${h.win}%"></i></div></div>`).join("");
}
// MATCH TABLE FALLBACK: displays sample matches until live match history has been loaded.
// Until real matches arrive, this function displays the example match list. Once live data exists, it hands control to the live renderer instead.
function renderMatches(){
 if(liveMatches.length){renderLive();return;}
 let data=allMatches?sample.matches:sample.matches.slice(0,5);
 document.getElementById("matchesTable").innerHTML=data.map(m=>`<tr><td class="result ${m[0]==="W"?"win":"loss"}">${m[0]==="W"?"VICTORY":"DEFEAT"}</td><td><div class="hero-cell"><span class="hero-avatar" style="width:25px;height:25px;font-size:11px">${(sample.heroes.find(h=>h.name===m[1])||{icon:"✦"}).icon}</span>${m[1]}</div></td><td class="kda">${m[2]}</td><td>${m[3]}</td><td>${m[4]}</td><td>${m[5]}</td></tr>`).join("");
}
// SAMPLE RECENT FORM: fills the recent-form panel with example outcomes before live data is loaded.
// This creates the sample W/L buttons shown in the recent-form panel before a real profile has loaded.
function renderForm(){
 const outcomes=["W","W","L","W","W","L","W","W","L","W"];
 document.getElementById("formDots").innerHTML=outcomes.map((o,i)=>`<button title="Match ${10-i}: ${o==="W"?"Victory":"Defeat"}" style="width:34px;height:34px;padding:0;background:${o==="W"?"#123b32":"#401e2a"};border-color:${o==="W"?"#23664f":"#733044"};color:${o==="W"?"#50e3a4":"#ff6b83"};font-weight:800">${o}</button>`).join("");
}
// INITIAL PAGE RENDER: draws the sample charts and lists when the page first opens.
// The initial render draws the sample graphs and lists so the dashboard has content while it waits for the user to load an account.
function render(){let vals=sample.winrate.slice(-period);svgLine("performanceChart",vals,"#a78bfa");svgLine("rankChart",sample.rank,"#6da8ff");renderHeroes();renderMatches();renderForm();}
// BUTTON EVENTS: connect clicks and Enter-key presses to the functions that update the page.
// An event listener is code that runs in response to an action such as a click or key press.
// querySelectorAll finds every matching HTML element. These listeners let the chart-period buttons switch between 30, 90, or all available matches.
document.querySelectorAll("[data-period]").forEach(b=>b.addEventListener("click",()=>{period=b.dataset.period==="all"?100:Number(b.dataset.period);document.querySelectorAll("[data-period]").forEach(x=>x.classList.toggle("active",x===b));liveMatches.length?renderLive():render()}));
// Clicking this button switches the hero list between sorting by win rate and sorting by number of matches.
document.getElementById("heroSort").onclick=()=>{sortWin=!sortWin;document.getElementById("heroSort").textContent=sortWin?"Sort: Win rate":"Sort: Matches";renderHeroes()};
// Clicking this button switches the match table between a short preview and the full fetched history.
document.getElementById("showAll").onclick=()=>{allMatches=!allMatches;document.getElementById("showAll").textContent=allMatches?"Show fewer matches ↑":"Show all matches ↓";renderMatches()};
// Connect the Load profile button to the main data-loading function.
document.getElementById("loadBtn").onclick=loadProfile;
// This event listener also loads the profile when the user presses Enter inside the account-number field.
document.getElementById("playerId").addEventListener("keydown",e=>{if(e.key==='Enter')loadProfile()});
render();
