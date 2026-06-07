import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, set, update, remove, onValue, query, limitToLast, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig={apiKey:"AIzaSyBHVjtKQv1tZ8sV9MKOYSr05Y8rXxv-tLQ",authDomain:"berlands-sjakk.firebaseapp.com",databaseURL:"https://berlands-sjakk-default-rtdb.europe-west1.firebasedatabase.app",projectId:"berlands-sjakk",storageBucket:"berlands-sjakk.firebasestorage.app",messagingSenderId:"884597270594",appId:"1:884597270594:web:0284119adb9ceacc7ba5db"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
const $=id=>document.getElementById(id);
let me=null,users={},games={},chat={},admins={},search="";

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function show(id){["loading","noAccess","adminApp"].forEach(x=>$(x)?.classList.add("hidden"));$(id)?.classList.remove("hidden")}
function status(t){$("statusMsg").textContent=t}
function isAdmin(uid){return admins?.[uid]===true || users?.[uid]?.role==="admin" || users?.[uid]?.admin===true}
function name(uid){const u=users?.[uid]||{};return u.name||u.email||uid||"Ukjent"}

$("homeBtn").onclick=()=>location.href="./home.html";
$("playBtn").onclick=()=>location.href="./play.html";
$("logoutBtn").onclick=async()=>{await signOut(auth);location.href="./index.html"};
$("copyUidBtn").onclick=async()=>{await navigator.clipboard.writeText(me?.uid||"");$("copyUidBtn").textContent="Kopiert!"};
$("searchUsers").oninput=e=>{search=e.target.value.trim().toLowerCase();renderUsers()};

document.querySelectorAll("[data-panel]").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===btn.dataset.panel));
    document.querySelectorAll(".menu button").forEach(b=>b.classList.toggle("active",b===btn));
  };
});

async function checkAdmin(user){
  const [a,u]=await Promise.all([get(ref(db,"admins/"+user.uid)),get(ref(db,"users/"+user.uid))]);
  const profile=u.val()||{};
  return a.val()===true || profile.role==="admin" || profile.admin===true;
}

function listen(){
  onValue(ref(db,"admins"),s=>{admins=s.val()||{};renderAdmins();renderUsers()},e=>status("Kan ikke lese admins: "+e.code));
  onValue(ref(db,"users"),s=>{users=s.val()||{};renderUsers();renderAdmins();overview()},e=>status("Kan ikke lese brukere: "+e.code));
  onValue(ref(db,"games"),s=>{games=s.val()||{};renderGames();overview()},e=>status("Kan ikke lese partier: "+e.code));
  onValue(query(ref(db,"loungeChat"),limitToLast(75)),s=>{chat=s.val()||{};renderChat();overview()},e=>status("Kan ikke lese chat: "+e.code));
}

function overview(){
  const gs=Object.values(games||{});
  $("usersCount").textContent=Object.keys(users||{}).length;
  $("gamesCount").textContent=gs.length;
  $("activeGamesCount").textContent=gs.filter(g=>["active","playing","waiting","invited"].includes(String(g?.status||"").toLowerCase())).length;
  $("chatCount").textContent=Object.keys(chat||{}).length;
}

function role(uid,u){
  if(isAdmin(uid))return '<span class="badge">Admin</span>';
  if(u?.banned)return '<span class="badge red">Utestengt</span>';
  return '<span class="badge green">Spiller</span>';
}

function renderUsers(){
  const tb=$("usersTable"); if(!tb)return;
  let rows=Object.entries(users||{}).filter(([uid,u])=>{
    if(!search)return true;
    return `${uid} ${u?.name||""} ${u?.email||""}`.toLowerCase().includes(search);
  }).sort((a,b)=>(b[1]?.elo||800)-(a[1]?.elo||800));
  if(!rows.length){tb.innerHTML='<tr><td colspan="5">Ingen brukere funnet.</td></tr>';return}
  tb.innerHTML=rows.map(([uid,u])=>`
    <tr>
      <td><strong>${esc(u?.name||"Sjakkspiller")}</strong><div class="muted">${esc(u?.email||uid)}</div><div class="muted">UID: ${esc(uid)}</div></td>
      <td><input class="eloInput" type="number" value="${esc(u?.elo??800)}" data-elo="${esc(uid)}"><button data-act="elo" data-uid="${esc(uid)}">Lagre</button></td>
      <td>V: ${esc(u?.wins??0)}<br>T: ${esc(u?.losses??0)}<br>R: ${esc(u?.draws??0)}</td>
      <td>${role(uid,u)}</td>
      <td><div class="actions">
        <button data-act="${isAdmin(uid)?"removeAdmin":"makeAdmin"}" data-uid="${esc(uid)}">${isAdmin(uid)?"Fjern admin":"Gjør admin"}</button>
        <button class="${u?.banned?"":"danger"}" data-act="${u?.banned?"unban":"ban"}" data-uid="${esc(uid)}">${u?.banned?"Opphev ban":"Utesteng"}</button>
        <button data-act="reset" data-uid="${esc(uid)}">Nullstill</button>
      </div></td>
    </tr>`).join("");
  tb.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>userAction(b.dataset.act,b.dataset.uid));
}

async function userAction(act,uid){
  try{
    if(act==="elo"){
      const input=document.querySelector(`[data-elo="${CSS.escape(uid)}"]`);
      await update(ref(db,"users/"+uid),{elo:Math.round(Number(input.value)||800),lastAdminEdit:serverTimestamp()});
      return status("Elo lagret.");
    }
    if(act==="makeAdmin"){await set(ref(db,"admins/"+uid),true);await update(ref(db,"users/"+uid),{role:"admin"});return status("Admin lagt til.")}
    if(act==="removeAdmin"){
      if(uid===me.uid)return status("Du kan ikke fjerne deg selv.");
      await remove(ref(db,"admins/"+uid));await update(ref(db,"users/"+uid),{role:"player"});return status("Admin fjernet.");
    }
    if(act==="ban"){await update(ref(db,"users/"+uid),{banned:true});return status("Bruker utestengt.")}
    if(act==="unban"){await update(ref(db,"users/"+uid),{banned:false});return status("Utestenging fjernet.")}
    if(act==="reset"){await update(ref(db,"users/"+uid),{elo:800,wins:0,losses:0,draws:0});return status("Stats nullstilt.")}
  }catch(e){status("Feil: "+e.code)}
}

function renderGames(){
  const tb=$("gamesTable"); if(!tb)return;
  const rows=Object.entries(games||{}).reverse();
  if(!rows.length){tb.innerHTML='<tr><td colspan="5">Ingen partier.</td></tr>';return}
  tb.innerHTML=rows.map(([room,g])=>`
    <tr>
      <td><strong>${esc(room)}</strong><div class="muted">${esc(g?.roomCode||g?.code||"")}</div></td>
      <td>${esc(g?.status||"ukjent")}</td><td>${esc(g?.whiteName||name(g?.whiteUid)||"Venter")}</td><td>${esc(g?.blackName||name(g?.blackUid)||"Venter")}</td>
      <td><div class="actions"><button data-gact="finish" data-room="${esc(room)}">Avslutt</button><button class="danger" data-gact="delete" data-room="${esc(room)}">Slett</button></div></td>
    </tr>`).join("");
  tb.querySelectorAll("[data-gact]").forEach(b=>b.onclick=()=>gameAction(b.dataset.gact,b.dataset.room));
}

async function gameAction(act,room){
  try{
    if(act==="finish"){await update(ref(db,"games/"+room),{status:"finished",result:"Avsluttet av admin.",lastClockTs:null,updatedAt:serverTimestamp()});return status("Parti avsluttet.")}
    if(act==="delete"&&confirm("Slette dette partiet/rommet?")){await remove(ref(db,"games/"+room));return status("Parti slettet.")}
  }catch(e){status("Feil: "+e.code)}
}

function renderChat(){
  const list=$("chatList"); if(!list)return;
  const rows=Object.entries(chat||{}).reverse();
  if(!rows.length){list.innerHTML='<div class="row"><span>Ingen meldinger.</span></div>';return}
  list.innerHTML=rows.map(([id,m])=>`<div class="row"><div><strong>${esc(m?.name||name(m?.uid)||"Sjakkspiller")}</strong><span>${esc(m?.text||"")}</span><div class="muted">ID: ${esc(id)}</div></div><button class="danger" data-delchat="${esc(id)}">Slett</button></div>`).join("");
  list.querySelectorAll("[data-delchat]").forEach(b=>b.onclick=async()=>{try{await remove(ref(db,"loungeChat/"+b.dataset.delchat));status("Melding slettet.")}catch(e){status("Feil: "+e.code)}})
}

function renderAdmins(){
  const list=$("adminsList"); if(!list)return;
  const rows=Object.entries(admins||{}).filter(([,v])=>v===true);
  if(!rows.length){list.innerHTML='<div class="row"><span>Ingen admins registrert.</span></div>';return}
  list.innerHTML=rows.map(([uid])=>`<div class="row"><div><strong>${esc(name(uid))}</strong><span>${esc(uid)}</span></div><span class="badge">Admin</span></div>`).join("");
}

onAuthStateChanged(auth,async user=>{
  if(!user){location.href="./index.html";return}
  me=user;
  $("myUid").textContent=user.uid;
  $("setupText").textContent=`admins/${user.uid} = true`;
  try{
    if(!(await checkAdmin(user))){show("noAccess");return}
    show("adminApp");listen();
  }catch(e){show("noAccess");$("setupText").textContent="Kunne ikke sjekke admin: "+e.code}
});
