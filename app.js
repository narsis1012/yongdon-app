(function(){
  "use strict";
  const CATS=[["food","🍜","간식·밥"],["fun","🎮","놀기"],["shop","🛍️","쇼핑"],["move","🚌","교통"],["study","📚","공부"],["etc","💸","기타"]];
  const INCAT=["in","💰","받은 돈"];
  const catMap=Object.fromEntries(CATS.map(c=>[c[0],c]));
  const $=id=>document.getElementById(id);
  const won=n=>(Math.round(n)||0).toLocaleString("ko-KR")+"원";
  const pad=n=>String(n).padStart(2,"0");
  const todayStr=()=>{const d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());};
  const digits=s=>Number(String(s).replace(/[^0-9]/g,""))||0;
  const ym=(y,m)=>y+"-"+pad(m);
  const newId=()=>"e"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const nowIso=()=>new Date().toISOString();

  // ---------- 폰에 저장 ----------
  const K={entries:"yd2-entries",settings:"yd2-settings",queue:"yd2-queue",pw:"yd2-pw",hash:"yd2-pwhash",name:"yd2-name",api:"yd2-api",last:"yd2-last"};
  const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
            set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}},
            del(k){try{localStorage.removeItem(k);}catch(e){}}};
  let entries=ls.get(K.entries,[]), settings=ls.get(K.settings,{budget:0,start:""}), queue=ls.get(K.queue,[]);
  let myName=ls.get(K.name,""), lastSync=ls.get(K.last,""), API=ls.get(K.api,"")||(window.YD_API_URL||"").trim();
  let PW=null, syncing=false, syncErr="", editing=null, lockMode="";
  const save=()=>{ls.set(K.entries,entries);ls.set(K.settings,settings);ls.set(K.queue,queue);};
  const now=new Date(); let viewY=now.getFullYear(), viewM=now.getMonth()+1;

  async function localHash(pw){
    const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("yd-local:"+pw));
    return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
  }

  // ---------- 서버 ----------
  const ERR={wrongpw:"비밀번호가 맞지 않아요.",locked:"여러 번 틀려서 10분 동안 잠겼어요.",badpw:"비밀번호는 숫자 4~12자리로 정해 주세요.",nosetup:"서버 준비가 안 됐어요. Apps Script에서 setup을 실행해 주세요.",server:"서버에서 문제가 생겼어요."};
  async function post(req){
    if(!API)throw new Error("noapi");
    const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),25000);
    try{
      const r=await fetch(API,{method:"POST",body:JSON.stringify(req),redirect:"follow",signal:ctl.signal});
      if(!r.ok)throw new Error("http");
      return await r.json();
    }finally{clearTimeout(t);}
  }

  // ---------- 동기화 ----------
  function applyLocal(op){
    if(op.op==="upsert"){const i=entries.findIndex(e=>e.id===op.entry.id);if(i>=0)entries[i]=op.entry;else entries.push(op.entry);}
    else if(op.op==="delete"){entries=entries.filter(e=>e.id!==op.id);}
    else if(op.op==="settings"){settings={budget:op.budget,start:op.start};}
  }
  function change(op){applyLocal(op);queue.push(op);save();render();sync();}

  async function sync(){
    if(syncing||!PW||!API){pill();return;}
    if(!navigator.onLine){pill();return;}
    syncing=true;pill();
    const n=queue.length, ops=queue.slice(0,n);
    try{
      const r=await post({action:"sync",pw:PW,ops});
      if(!r||!r.ok){
        syncErr=(r&&ERR[r.code])||"동기화하지 못했어요.";
        if(r&&r.code==="wrongpw"){PW=null;ls.del(K.pw);showLock("enter","다른 사람이 비밀번호를 바꿨어요. 새 비밀번호를 입력해 주세요. 적어 둔 기록은 그대로 있어요.");}
        return;
      }
      syncErr="";
      queue.splice(0,n);
      settings=r.state.settings;entries=r.state.entries;
      for(const op of queue)applyLocal(op);
      lastSync=nowIso();ls.set(K.last,lastSync);save();render();
    }catch(e){syncErr="";}
    finally{syncing=false;pill();}
  }
  function pill(){
    const p=$("pill"),t=$("pillTxt");p.className="pill";
    if(!navigator.onLine){p.classList.add("off");t.textContent=queue.length?`오프라인 · 보낼 기록 ${queue.length}건`:"오프라인 · 폰에 저장 중";return;}
    if(syncErr){p.classList.add("err");t.textContent=syncErr;return;}
    if(syncing){p.classList.add("wait");t.textContent="동기화 중…";return;}
    if(queue.length){p.classList.add("wait");t.textContent=`보낼 기록 ${queue.length}건 · 눌러서 다시 시도`;return;}
    if(lastSync){const m=Math.round((Date.now()-new Date(lastSync))/60000);t.textContent="공유됨 · "+(m<1?"방금":m<60?m+"분 전":new Date(lastSync).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"numeric",minute:"2-digit"}));return;}
    t.textContent="아직 동기화 전";
  }
  $("pill").onclick=()=>sync();
  window.addEventListener("online",()=>{pill();sync();});
  window.addEventListener("offline",pill);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")sync();});
  setInterval(()=>{if(document.visibilityState==="visible")sync();else pill();},60000);

  // ---------- 화면 준비 ----------
  function chips(el,name){el.innerHTML=CATS.map((c,i)=>`<label><input type="radio" name="${name}" value="${c[0]}" ${i===0?"checked":""}><span>${c[1]} ${c[2]}</span></label>`).join("");}
  chips($("cats"),"cat");chips($("eCats"),"ecat");
  $("date").value=todayStr();
  function fmt(el){el.addEventListener("input",()=>{const n=digits(el.value);el.value=n?n.toLocaleString("ko-KR"):"";});}
  fmt($("amount"));fmt($("eAmount"));fmt($("sBudget"));
  const checked=n=>(document.querySelector(`input[name="${n}"]:checked`)||{}).value;
  function syncCats(k,el){el.style.display=checked(k)==="in"?"none":"";}
  document.querySelectorAll('input[name="kind"]').forEach(r=>r.addEventListener("change",()=>syncCats("kind",$("cats"))));
  document.querySelectorAll('input[name="ekind"]').forEach(r=>r.addEventListener("change",()=>syncCats("ekind",$("eCats"))));
  function note(msg,err){const n=$("note");n.textContent=msg||"";n.className="note"+(err?" err":"");}

  // ---------- 잠금 화면 ----------
  function showLock(mode,msg){
    lockMode=mode;$("lock").hidden=false;
    const show=(id,v)=>{$(id).hidden=!v;};
    const pin=mode==="enter"||mode==="create";
    show("apiIn",mode==="api");show("pinIn",pin);show("pinIn2",mode==="create");
    show("nameIn",pin&&!myName);show("remWrap",pin);show("pinBtn",pin||mode==="api");show("retryBtn",mode==="retry");show("apiReset",mode==="retry");
    $("pinBtn").textContent=mode==="create"?"비밀번호 만들고 시작하기":mode==="api"?"연결하기":"열기";
    $("lockMsg").textContent=msg||({create:"처음이에요! 함께 쓸 비밀번호(숫자 4~12자리)를 만들어 주세요.",enter:"비밀번호를 입력해 주세요.",api:"Apps Script 웹 앱 주소(…/exec)를 붙여넣어 주세요."}[mode]||"불러오는 중…");
    $("pinIn").value="";$("pinIn2").value="";
    if(pin)setTimeout(()=>$("pinIn").focus(),50);
  }
  function shake(){const b=$("lockForm");b.classList.remove("shake");void b.offsetWidth;b.classList.add("shake");}
  async function unlocked(p){
    PW=p;const n=$("nameIn").value.trim();if(n){myName=n;ls.set(K.name,n);}
    if($("remember").checked)ls.set(K.pw,p);else ls.del(K.pw);
    ls.set(K.hash,await localHash(p));
    $("lock").hidden=true;render();sync();
  }
  $("retryBtn").onclick=()=>start();
  $("apiReset").onclick=()=>{$("apiIn").value=API;showLock("api");};
  $("lockForm").addEventListener("submit",async ev=>{
    ev.preventDefault();
    if(lockMode==="api"){
      const u=$("apiIn").value.trim();
      if(!/^https:\/\/script\.google\.com\/.+\/exec$/.test(u)){$("lockMsg").textContent="주소는 https://script.google.com/ 으로 시작하고 /exec 로 끝나야 해요.";shake();return;}
      API=u;ls.set(K.api,u);start();return;
    }
    const p=$("pinIn").value.trim();
    if(!/^\d{4,12}$/.test(p)){$("lockMsg").textContent=ERR.badpw;shake();return;}
    $("pinBtn").disabled=true;
    try{
      if(lockMode==="create"){
        if(p!==$("pinIn2").value.trim()){$("lockMsg").textContent="두 비밀번호가 서로 달라요.";shake();return;}
        const r=await post({action:"createPw",newPw:p});
        if(!r.ok){if(r.code==="wrongpw")showLock("enter","이미 비밀번호가 있어요. 비밀번호를 입력해 주세요.");else $("lockMsg").textContent=ERR[r.code]||"다시 시도해 주세요.";shake();return;}
        await unlocked(p);return;
      }
      // 먼저 폰에 저장된 정보로 확인 (인터넷 없어도 열림)
      const h=ls.get(K.hash,"");
      if(h&&h===await localHash(p)){await unlocked(p);return;}
      // 처음이거나 비밀번호가 바뀐 경우 서버에 확인
      let r;
      try{r=await post({action:"sync",pw:p,ops:[]});}
      catch(e){$("lockMsg").textContent=h?"비밀번호가 맞지 않아요.":"처음에는 인터넷 연결이 필요해요. 연결 후 다시 시도해 주세요.";shake();return;}
      if(!r.ok){$("lockMsg").textContent=ERR[r.code]||"다시 시도해 주세요.";shake();return;}
      await unlocked(p);
    }finally{$("pinBtn").disabled=false;}
  });
  $("lockBtn").onclick=()=>{PW=null;ls.del(K.pw);showLock("enter");};

  // ---------- 계산과 화면 그리기 ----------
  function monthsBetween(a,b){if(!a||b<a)return 0;const[sy,sm]=a.split("-").map(Number),[ey,em]=b.split("-").map(Number);return (ey-sy)*12+(em-sm)+1;}
  function prevKey(k){let[y,m]=k.split("-").map(Number);m--;if(m<1){m=12;y--;}return ym(y,m);}
  function render(){
    const key=ym(viewY,viewM),cur=ym(now.getFullYear(),now.getMonth()+1);
    $("monthTitle").textContent=`${viewY}년 ${viewM}월`;
    let carry=monthsBetween(settings.start,prevKey(key))*(settings.budget||0);
    for(const e of entries)if((e.date||"").slice(0,7)<key)carry+=e.kind==="in"?e.amount:-e.amount;
    const inMonth=entries.filter(e=>(e.date||"").slice(0,7)===key);
    const allowance=(settings.start&&key>=settings.start)?(settings.budget||0):0;
    const got=inMonth.filter(e=>e.kind==="in").reduce((s,e)=>s+e.amount,0);
    const spent=inMonth.filter(e=>e.kind!=="in").reduce((s,e)=>s+e.amount,0);
    const remain=carry+allowance+got-spent;
    $("jarLbl").textContent=key===cur?"지금 남은 용돈 (누적)":key<cur?`${viewM}월 말에 남은 용돈`:`${viewM}월 예상 남은 용돈`;
    const big=$("remain");big.textContent=won(remain);big.classList.toggle("neg",remain<0);
    const rows=[["지난달까지 남은 돈",won(carry)],[`${viewM}월 용돈`,settings.budget?"+"+won(allowance):"⚙️에서 설정"]];
    if(got)rows.push(["따로 받은 돈","+"+won(got)]);
    rows.push(["쓴 돈","-"+won(spent)]);
    const calc=$("calc");calc.textContent="";
    for(const[a,b]of rows){const x=document.createElement("span");x.textContent=a;const y=document.createElement("span");y.textContent=b;calc.append(x,y);}
    const list=$("list");
    if(!inMonth.length){list.innerHTML=`<div class="empty">${viewM}월에는 아직 기록이 없어요.</div>`;return;}
    inMonth.sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.createdAt||"").localeCompare(a.createdAt||""));
    const pending=new Set(queue.filter(o=>o.op==="upsert").map(o=>o.entry.id));
    const groups={};for(const e of inMonth)(groups[e.date]=groups[e.date]||[]).push(e);
    list.textContent="";const wk=["일","월","화","수","목","금","토"];
    for(const d of Object.keys(groups)){
      const sec=document.createElement("section");sec.className="day";
      const dt=new Date(d+"T00:00:00");
      const h=document.createElement("h2");h.textContent=`${dt.getMonth()+1}월 ${dt.getDate()}일 (${wk[dt.getDay()]})`;sec.append(h);
      for(const e of groups[d]){
        const c=e.kind==="in"?INCAT:(catMap[e.cat]||catMap.etc);
        const row=document.createElement("button");row.type="button";row.className="item";
        const dot=document.createElement("div");dot.className="dot";dot.textContent=c[1];
        const mid=document.createElement("div");mid.className="mid";
        const m=document.createElement("div");m.className="memo";m.textContent=e.memo||c[2];
        const w=document.createElement("div");w.className="who";w.textContent=c[2]+(e.who?" · "+e.who:"")+(pending.has(e.id)?" · 보내기 대기":"");
        mid.append(m,w);
        const p=document.createElement("div");p.className="price "+e.kind;p.textContent=(e.kind==="in"?"+":"-")+won(e.amount);
        row.append(dot,mid,p);row.onclick=()=>openEdit(e);sec.append(row);
      }
      list.append(sec);
    }
  }
  $("prev").onclick=()=>{viewM--;if(viewM<1){viewM=12;viewY--;}render();};
  $("next").onclick=()=>{viewM++;if(viewM>12){viewM=1;viewY++;}render();};

  // ---------- 기록하기 ----------
  $("addForm").addEventListener("submit",ev=>{
    ev.preventDefault();
    const amount=digits($("amount").value);
    if(!amount){note("금액을 입력해 주세요.",true);$("amount").focus();return;}
    if(amount>100000000){note("금액이 너무 커요.",true);return;}
    const kind=checked("kind")||"out",date=$("date").value||todayStr(),t=nowIso();
    change({op:"upsert",entry:{id:newId(),kind,amount,cat:kind==="in"?"in":(checked("cat")||"etc"),memo:$("memo").value.trim().slice(0,40),date,who:myName,createdAt:t,updatedAt:t}});
    $("amount").value="";$("memo").value="";
    const[y,m]=date.split("-").map(Number);viewY=y;viewM=m;render();
    note((kind==="in"?"받은 돈 ":"쓴 돈 ")+won(amount)+" 기록했어요."+(navigator.onLine?"":" 인터넷이 연결되면 공유돼요."));
  });

  // ---------- 고치기 / 지우기 ----------
  const editDlg=$("editDlg");
  function openEdit(e){
    editing=e;
    document.querySelector(`input[name="ekind"][value="${e.kind}"]`).checked=true;
    (document.querySelector(`input[name="ecat"][value="${e.cat}"]`)||document.querySelector('input[name="ecat"][value="etc"]')).checked=true;
    syncCats("ekind",$("eCats"));
    $("eAmount").value=e.amount.toLocaleString("ko-KR");$("eMemo").value=e.memo||"";$("eDate").value=e.date||todayStr();
    editDlg.showModal();
  }
  $("eCancel").onclick=()=>editDlg.close();
  $("editForm").addEventListener("submit",ev=>{
    ev.preventDefault();if(!editing)return;
    const amount=digits($("eAmount").value);if(!amount||amount>100000000){$("eAmount").focus();return;}
    const kind=checked("ekind")||"out";
    change({op:"upsert",entry:{...editing,kind,amount,cat:kind==="in"?"in":(checked("ecat")||"etc"),memo:$("eMemo").value.trim().slice(0,40),date:$("eDate").value||editing.date,updatedAt:nowIso()}});
    editDlg.close();note("기록을 고쳤어요.");
  });
  $("eDel").onclick=()=>{
    if(!editing||!confirm(`'${editing.memo||"이 기록"}' ${won(editing.amount)}을(를) 지울까요?`))return;
    change({op:"delete",id:editing.id,at:nowIso()});editDlg.close();note("기록을 지웠어요.");
  };

  // ---------- 설정 ----------
  const setDlg=$("setDlg");
  $("setBtn").onclick=()=>{
    $("sBudget").value=settings.budget?settings.budget.toLocaleString("ko-KR"):"";
    $("sStart").value=settings.start||ym(now.getFullYear(),now.getMonth()+1);
    $("sName").value=myName;$("sApi").value=API;$("sPin").value="";$("sPin2").value="";$("sNote").textContent="";
    setDlg.showModal();
  };
  $("sCancel").onclick=()=>setDlg.close();
  $("setForm").addEventListener("submit",async ev=>{
    ev.preventDefault();
    const p1=$("sPin").value.trim(),p2=$("sPin2").value.trim(),api=$("sApi").value.trim();
    if(p1||p2){if(!/^\d{4,12}$/.test(p1)){$("sNote").textContent=ERR.badpw;return;}if(p1!==p2){$("sNote").textContent="두 비밀번호가 서로 달라요.";return;}}
    if(api&&!/^https:\/\/script\.google\.com\/.+\/exec$/.test(api)){$("sNote").textContent="서버 주소를 다시 확인해 주세요.";return;}
    if(p1){
      $("sSave").disabled=true;
      try{const r=await post({action:"changePw",pw:PW,newPw:p1});if(!r.ok){$("sNote").textContent=ERR[r.code]||"바꾸지 못했어요.";return;}}
      catch(e){$("sNote").textContent="비밀번호는 인터넷이 연결됐을 때만 바꿀 수 있어요.";return;}
      finally{$("sSave").disabled=false;}
      PW=p1;if(ls.get(K.pw,null))ls.set(K.pw,p1);ls.set(K.hash,await localHash(p1));
    }
    if(api&&api!==API){API=api;ls.set(K.api,api);}
    myName=$("sName").value.trim();if(myName)ls.set(K.name,myName);else ls.del(K.name);
    const b=digits($("sBudget").value),s=$("sStart").value||"";
    if(b!==(settings.budget||0)||s!==(settings.start||""))change({op:"settings",budget:b,start:s,at:nowIso()});
    setDlg.close();note(p1?"저장했어요. 함께 쓰는 사람에게 새 비밀번호를 알려 주세요.":"설정을 저장했어요.");
  });

  // ---------- 앱 설치 버튼 (안드로이드) ----------
  let deferred=null;
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferred=e;$("installBtn").hidden=false;});
  $("installBtn").onclick=async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;$("installBtn").hidden=true;};
  if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});

  // ---------- 시작 ----------
  async function start(){
    render();pill();
    if(!API){showLock("api");return;}
    const saved=ls.get(K.pw,null);
    if(saved){PW=saved;$("lock").hidden=true;render();sync();return;}
    if(ls.get(K.hash,"")){showLock("enter");return;}   // 전에 들어온 적 있음 → 오프라인에서도 열 수 있음
    showLock("loading");
    try{
      const s=await post({action:"status"});
      if(!s.ok){showLock("retry",ERR[s.code]||"서버를 확인해 주세요.");return;}
      showLock(s.hasPw?"enter":"create");
    }catch(e){showLock("retry","처음 한 번은 인터넷 연결이 필요해요. 연결을 확인하거나 서버 주소가 맞는지 확인해 주세요.");}
  }
  start();
})();
