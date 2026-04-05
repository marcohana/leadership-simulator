import{useState,useEffect,useRef,useCallback}from"react";

// ═══ DATA ═══
const NAMES=["Camille","Dominique","Claude","Alix","Sacha","Morgan","Andréa","Noa","Alex","Sam","Eden"];
const MALE_VOICES=["Enceladus","Charon","Fenrir","Orus","Puck","Iapetus"];
const FEMALE_VOICES=["Aoede","Kore","Leda","Callirrhoe","Despina","Erinome"];
const P={
M1:{l:"M1 – Compétence faible, Motivation haute",s:"S1",sn:"Diriger",b:`Tu es nouveau. Tu ne parles PAS technique. Tu exprimes enthousiasme et inquiétude: "par quoi je commence?","je suis perdu". Besoin qu'on te prenne par la main. 1-2 phrases courtes max.`},
M2:{l:"M2 – Compétence en développement, Motivation fluctuante",s:"S2",sn:"Coacher",b:`Tu as quelques repères mais tu doutes. Tu proposes puis doutes: "je pensais faire ça, mais bon...". Alternes énergie et doute. Pas de jargon. 1-2 phrases max.`},
M3:{l:"M3 – Compétence haute, Motivation basse",s:"S3",sn:"Soutenir",b:`Tu sais faire mais plus envie. Réponses sèches: "oui oui","je sais". Si le manager donne des instructions basiques, agacé. S'il reconnaît ta valeur, tu t'ouvres. 1-2 phrases max.`},
M4:{l:"M4 – Compétence haute, Motivation haute",s:"S4",sn:"Déléguer",b:`Enthousiaste avec des propositions. Tu veux le feu vert: "j'ai réfléchi","je gère". Si on te micro-manage, agacé. 1-2 phrases max.`}};
const SIT=["Un fournisseur annonce une grosse augmentation de prix. Il faut trouver une solution.","On lance un produit et il faut trouver des fournisseurs dans un nouveau pays.","Un audit a trouvé des problèmes dans la validation des commandes.","La direction demande -10% sur les coûts sans baisser la qualité.","Un fournisseur clé est en difficulté financière et risque de ne plus livrer.","On change de logiciel et le module achats doit être prêt en 1 mois.","Désaccord avec l'équipe qualité sur le choix des fournisseurs.","Mettre en place des achats responsables avec les fournisseurs."];
const TT={M1:"Acheteur junior, 2 mois",M2:"Acheteur, 1 an",M3:"Acheteur senior, 8 ans",M4:"Resp. achats, 12 ans"};

function gen(){
  const name=NAMES[Math.random()*NAMES.length|0];
  const mk=["M1","M2","M3","M4"],mat=mk[Math.random()*4|0];
  const sit=SIT[Math.random()*SIT.length|0];
  const isMale=Math.random()>0.5;
  const voice=isMale?MALE_VOICES[Math.random()*MALE_VOICES.length|0]:FEMALE_VOICES[Math.random()*FEMALE_VOICES.length|0];
  return{name,mat,sit,p:P[mat],title:TT[mat],voice,isMale};
}

function sysPr(s){return`Tu es ${s.name}, ${s.title}, département achats.\nPROFIL SECRET: ${s.mat} (${s.p.l})\nCOMPORTEMENT: ${s.p.b}\nSITUATION: ${s.sit}\nRÈGLES: Ne révèle JAMAIS ton profil. Parle naturellement. Réponses TRÈS COURTES: 1-2 phrases max, comme une vraie conversation au bureau. INTERDIT: jargon, technique, acronymes. Parle de ton vécu et émotions. Réagis au style du manager. Ne mentionne jamais simulation/leadership/Hersey. Premier message: présente-toi et la situation en 2-3 phrases simples.`}

function debPr(s,ms){const c=ms.map(m=>`${m.role==="user"?"MANAGER":s.name.toUpperCase()}: ${m.content}`).join("\n"),mc=ms.filter(m=>m.role==="user").length;
return`Expert leadership situationnel Hersey & Blanchard.\nINFOS: ${s.name}, ${s.title}, ${s.mat} (${s.p.l}), Style idéal: ${s.p.s} – ${s.p.sn}\nSituation: ${s.sit}\nCONVERSATION (${mc} msgs manager):\n${c}\n\nRéponds UNIQUEMENT JSON valide. Pas de texte/backticks. Structure:\n{"noteGlobale":12,"styleDetecte":"S2","styleNomDetecte":"Coacher","styleIdeal":"${s.p.s}","styleNomIdeal":"${s.p.sn}","maturityReveal":"${s.mat}","maturityExplication":"...","analyseGenerale":"...","pointsForts":["..."],"pointsAmelioration":["..."],"exemplesDialogueBons":[{"citation":"...","pourquoi":"..."}],"exemplesDialogueMauvais":[{"citation":"...","pourquoi":"..."}],"exemplesIdeal":[{"situation":"...","aurait_du_dire":"..."}],"conseilFinal":"..."}\nBARÈME: Style inadapté=2-8. Adjacent=8-13. Bon+maladresses=13-16. Parfait=16-20. MALUS -3/-5 si <4 msgs. MALUS si 0 questions. 15+ RARE. Impose sans écouter=max 10. SÉVÈRE.`}

// ═══ API CALLS ═══
async function apiChat(sys,ms,mt=250,model="claude-haiku-4-5-20251001"){
  const b={model,max_tokens:mt,system:sys,messages:ms.map(m=>({role:m.role,content:m.content}))};
  for(let i=0;i<3;i++){try{
    const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});
    if(!r.ok)throw new Error("API "+r.status);
    const d=await r.json(),t=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
    if(!t)throw new Error("Empty");return t;
  }catch(e){if(i===2)throw e;await new Promise(r=>setTimeout(r,2000))}}
}

// Simple TTS call + Web Audio playback
let audioCtx=null;

// Audio context - pre-warmed on first interaction
let audioCtx=null;
function warmAudio(){if(!audioCtx){audioCtx=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume()}}

async function apiTTSStream(text,voiceName,onEnd){
  try{
    warmAudio();
    const r=await fetch("/api/tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,voiceName})});
    if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"TTS erreur "+r.status)}
    const d=await r.json();
    if(!d.audio) throw new Error("Pas d'audio reçu");

    // Decode base64 PCM L16 24kHz mono
    const raw=atob(d.audio);
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);

    // Convert to Int16 then Float32
    const view=new DataView(bytes.buffer);
    const samples=bytes.length/2;
    const float32=new Float32Array(samples);
    for(let i=0;i<samples;i++) float32[i]=view.getInt16(i*2,true)/32768;

    // Play with Web Audio API
    if(audioCtx.state==="suspended") await audioCtx.resume();

    const buffer=audioCtx.createBuffer(1,float32.length,24000);
    buffer.getChannelData(0).set(float32);
    const source=audioCtx.createBufferSource();
    source.buffer=buffer;
    source.connect(audioCtx.destination);
    source.onended=()=>onEnd?.();
    source.start();
  }catch(e){
    console.error("TTS error:",e);
    onEnd?.();
    throw e;
  }
}

function stopAudio(){
  if(audioCtx){try{audioCtx.close()}catch(e){}audioCtx=null}
}

function jp(r){try{return JSON.parse(r)}catch(e){}let c=r.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();try{return JSON.parse(c)}catch(e){}let d=0,s=-1;for(let i=0;i<c.length;i++){if(c[i]==="{"){if(s===-1)s=i;d++}if(c[i]==="}"){d--;if(d===0&&s!==-1){try{return JSON.parse(c.slice(s,i+1))}catch(e){s=-1}}}}throw new Error("JSON fail")}

// ═══ THEME ═══
const T={bg:"#0C0E13",sf:"#151820",cd:"#1B1F2B",bd:"rgba(255,255,255,0.06)",ac:"#D4A853",ad:"rgba(212,168,83,0.15)",ag:"rgba(212,168,83,0.25)",tx:"#E2E0DC",mt:"#7A7B82",gn:"#4CAF7D",rd:"#CF5C5C",or:"#D4943A",ft:"'Outfit',sans-serif",mn:"'JetBrains Mono',monospace"};
const CSS=`@keyframes fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes pu{0%,100%{opacity:.3}50%{opacity:1}}@keyframes mp{0%{box-shadow:0 0 0 0 rgba(212,168,83,.5)}70%{box-shadow:0 0 0 20px rgba(212,168,83,0)}100%{box-shadow:0 0 0 0 rgba(212,168,83,0)}}@keyframes sw{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}`;
const FL=<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet"/>;

// ═══ MAIN ═══
export default function App(){
const[scr,setScr]=useState("intro"),[sc,setSc]=useState(null),[ms,setMs]=useState([]),[inp,setInp]=useState(""),[ld,setLd]=useState(false),[db,setDb]=useState(null),[dl,setDl]=useState(false),[err,setErr]=useState(null);
const[voiceIn,setVoiceIn]=useState(false),[voiceOut,setVoiceOut]=useState(false);
const[rec,setRec]=useState(false),[spk,setSpk]=useState(false),[tr,setTr]=useState(""),[micOk,setMicOk]=useState(null),[micW,setMicW]=useState("");
const eR=useRef(null),iR=useRef(null),sR=useRef(""),rR=useRef(null),scRef=useRef(null);

useEffect(()=>{
document.addEventListener("click",warmAudio,{once:true});document.addEventListener("touchstart",warmAudio,{once:true});
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setMicOk(false);return}
if(navigator.mediaDevices?.getUserMedia){navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());setMicOk(true)}).catch(()=>setMicOk(false))}else setMicOk(true)},[]);
useEffect(()=>{eR.current?.scrollIntoView({behavior:"smooth"})},[ms,ld]);

const speakGemini=useCallback(async(text)=>{
  if(!voiceOut||!scRef.current)return;
  setSpk(true);
  try{await apiTTSStream(text,scRef.current.voice,()=>setSpk(false))}
  catch(e){console.error("TTS error:",e);setSpk(false)}
},[voiceOut]);

const startMic=useCallback(()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setMicW("Vocal non disponible.");setVoiceIn(false);return}
stopAudio();const r=new SR();r.lang="fr-FR";r.continuous=true;r.interimResults=true;
r.onstart=()=>{setRec(true);setTr("");setMicW("")};
r.onresult=e=>{let f="",n="";for(let i=0;i<e.results.length;i++){if(e.results[i].isFinal)f+=e.results[i][0].transcript+" ";else n+=e.results[i][0].transcript}setTr((f+n).trim())};
r.onend=()=>setRec(false);
r.onerror=e=>{setRec(false);if(e.error==="not-allowed"||e.error==="service-not-allowed"){setMicOk(false);setMicW("Micro bloqué.");setVoiceIn(false)}else if(e.error!=="no-speech"&&e.error!=="aborted")setMicW("Erreur: "+e.error)};
rR.current=r;try{r.start()}catch(e){setMicW("Micro indisponible.");setVoiceIn(false)}},[]);
const stopMic=useCallback(()=>{rR.current?.stop()},[]);

const send=useCallback(async(text)=>{const t=(text||inp).trim();if(!t||ld)return;setInp("");setTr("");
const nm=[...ms,{role:"user",content:t}];setMs(nm);setLd(true);setErr(null);
try{let am=nm.filter(m=>!m.hidden).map(m=>({role:m.role,content:m.content}));if(am[0]?.role==="assistant")am=[{role:"user",content:"(début)"},...am];
const r=await apiChat(sR.current,am,250);setMs(p=>[...p,{role:"assistant",content:r}]);
if(voiceOut){setSpk(true);try{await apiTTSStream(r,scRef.current?.voice,()=>setSpk(false))}catch(e){console.error("TTS:",e);setSpk(false);setErr("Voix indisponible: "+e.message)}}}
catch(e){setErr("Erreur de connexion.")}
setLd(false);if(!voiceIn)setTimeout(()=>iR.current?.focus(),150)},[inp,ms,ld,voiceOut,voiceIn]);

useEffect(()=>{if(!rec&&tr.trim()&&voiceIn)send(tr.trim())},[rec]);

const start=useCallback(async()=>{const s=gen();setSc(s);scRef.current=s;setMs([]);setInp("");setErr(null);setDb(null);setTr("");setScr("chat");setLd(true);
const sp=sysPr(s);sR.current=sp;
try{const r=await apiChat(sp,[{role:"user",content:"Bonjour, vous vouliez me voir ?"}],300);
setMs([{role:"user",content:"Bonjour, vous vouliez me voir ?",hidden:true},{role:"assistant",content:r}]);
if(voiceOut){setSpk(true);try{await apiTTSStream(r,s.voice,()=>setSpk(false))}catch(e){console.error("TTS:",e);setSpk(false);setErr("Voix indisponible: "+e.message)}}}
catch(e){setErr("Erreur de connexion.")}
setLd(false);if(!voiceIn)setTimeout(()=>iR.current?.focus(),150)},[voiceOut,voiceIn]);

const doDeb=useCallback(async()=>{stopAudio();setDl(true);setErr(null);setScr("debrief");
try{const v=ms.filter(m=>!m.hidden),raw=await apiChat("Expert leadership. Réponds UNIQUEMENT JSON valide. Commence par { termine par }.",[{role:"user",content:debPr(sc,v)}],3000,"claude-sonnet-4-20250514");setDb(jp(raw))}catch(e){console.error(e);setErr("Analyse échouée.")}setDl(false)},[ms,sc]);

const vc=ms.filter(m=>m.role==="user"&&!m.hidden).length;
const B=({children,primary,disabled,onClick})=><button onClick={onClick} disabled={disabled} style={{background:primary?`linear-gradient(135deg,${T.ac},#B8892E)`:T.sf,color:primary?"#0C0E13":T.mt,border:primary?"none":`1px solid ${T.bd}`,borderRadius:12,padding:"16px 40px",fontSize:16,fontWeight:700,cursor:disabled?"not-allowed":"pointer",fontFamily:T.ft,opacity:disabled?.5:1}}>{children}</button>;
const Tog=({on,onToggle,label,disabled})=><button onClick={()=>{if(!disabled)onToggle(!on)}} style={{display:"flex",alignItems:"center",gap:8,background:on?T.ad:T.cd,border:`1px solid ${on?T.ac+"55":T.bd}`,borderRadius:8,padding:"6px 12px",cursor:disabled?"not-allowed":"pointer",fontFamily:T.ft,fontSize:12,color:on?T.ac:T.mt,opacity:disabled?.4:1}}><div style={{width:28,height:16,borderRadius:8,background:on?T.ac:"rgba(255,255,255,0.15)",position:"relative",transition:"all .2s"}}><div style={{width:12,height:12,borderRadius:6,background:on?"#0C0E13":"#888",position:"absolute",top:2,left:on?14:2,transition:"all .2s"}}/></div>{label}</button>;

// ═══ INTRO ═══
if(scr==="intro")return(
<div style={{minHeight:"100vh",background:T.bg,fontFamily:T.ft}}>{FL}
<div style={{maxWidth:720,margin:"0 auto",padding:"50px 24px"}}>
<div style={{textAlign:"center"}}><span style={{display:"inline-block",fontSize:11,fontWeight:700,letterSpacing:2.5,textTransform:"uppercase",color:T.ac,background:T.ad,border:`1px solid ${T.ag}`,borderRadius:99,padding:"7px 22px",marginBottom:32}}>Simulation Interactive</span></div>
<h1 style={{fontFamily:T.mn,fontWeight:800,textAlign:"center",fontSize:"clamp(26px,5vw,42px)",lineHeight:1.15,color:T.tx,margin:"0 0 20px"}}>Leadership<br/><span style={{color:T.ac}}>Situationnel</span></h1>
<p style={{textAlign:"center",color:T.mt,fontSize:16,lineHeight:1.7,maxWidth:540,margin:"0 auto 40px"}}>Entraînez-vous à adapter votre style de management selon le modèle <strong style={{color:T.tx}}>Hersey & Blanchard</strong>. Vous incarnez un manager face à un collaborateur dont vous devez identifier le profil.</p>

<div style={{background:T.sf,borderRadius:16,padding:28,border:`1px solid ${T.bd}`,marginBottom:24}}>
<h3 style={{fontFamily:T.mn,fontSize:13,fontWeight:700,color:T.ac,margin:"0 0 8px",letterSpacing:1}}>LE MODÈLE HERSEY & BLANCHARD</h3>
<p style={{fontSize:14,color:T.mt,lineHeight:1.6,margin:"0 0 16px"}}>Chaque collaborateur a un <strong style={{color:T.tx}}>niveau de maturité</strong> défini par deux axes : sa <strong style={{color:T.tx}}>compétence</strong> (sait-il faire ?) et sa <strong style={{color:T.tx}}>motivation</strong> (veut-il faire ?). Le manager efficace adapte son style en fonction de ce profil.</p>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
{[{m:"M1",t:"Débutant enthousiaste",d:"Ne sait pas faire mais veut apprendre. Pose des questions, cherche des instructions.",c:T.rd},
{m:"M2",t:"Apprenti découragé",d:"Commence à savoir mais doute de lui. Alterne entre motivation et découragement.",c:T.or},
{m:"M3",t:"Expert désengagé",d:"Sait très bien faire mais n'a plus la motivation. Blasé, fait le minimum.",c:T.gn},
{m:"M4",t:"Expert autonome",d:"Compétent et motivé. Arrive avec des solutions, veut de l'autonomie.",c:"#5B9BD5"}].map(x=>
<div key={x.m} style={{background:`${x.c}0A`,border:`1px solid ${x.c}25`,borderRadius:10,padding:"12px 14px"}}>
<div style={{fontFamily:T.mn,fontSize:12,fontWeight:700,color:x.c,marginBottom:4}}>{x.m} — {x.t}</div>
<div style={{fontSize:12,color:T.mt,lineHeight:1.5}}>{x.d}</div></div>)}</div>
<h4 style={{fontFamily:T.mn,fontSize:12,fontWeight:700,color:T.ac,margin:"0 0 8px"}}>QUEL STYLE ADOPTER ?</h4>
<p style={{fontSize:13,color:T.mt,lineHeight:1.6,margin:"0 0 14px"}}>Le style du manager doit correspondre au profil du collaborateur :</p>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
{[{s:"S1 – Diriger → M1",d:"Donner des instructions claires, étape par étape. Superviser de près.",c:T.rd},
{s:"S2 – Coacher → M2",d:"Guider ET encourager. Expliquer le pourquoi, valoriser les progrès.",c:T.or},
{s:"S3 – Soutenir → M3",d:"Écouter, reconnaître la valeur, comprendre les frustrations. Remotiver.",c:T.gn},
{s:"S4 – Déléguer → M4",d:"Faire confiance, donner de l'autonomie. Rester disponible sans micro-manager.",c:"#5B9BD5"}].map(x=>
<div key={x.s} style={{background:`${x.c}0A`,border:`1px solid ${x.c}25`,borderRadius:10,padding:"12px 14px"}}>
<div style={{fontFamily:T.mn,fontSize:12,fontWeight:700,color:x.c,marginBottom:4}}>{x.s}</div>
<div style={{fontSize:12,color:T.mt,lineHeight:1.5}}>{x.d}</div></div>)}</div></div>

<div style={{background:T.sf,borderRadius:16,padding:24,border:`1px solid ${T.bd}`,marginBottom:24}}>
<h3 style={{fontFamily:T.mn,fontSize:13,fontWeight:700,color:T.ac,margin:"0 0 12px",letterSpacing:1}}>COMMENT ÇA MARCHE</h3>
{["Un collaborateur vous présente un problème. Son profil (M1, M2, M3 ou M4) est caché.","Conversez librement : posez des questions, donnez des consignes, écoutez, motivez...","Observez ses réactions pour deviner son profil et adapter votre style.","Quand vous le souhaitez, terminez pour recevoir votre débrief détaillé noté sur 20."].map((t,i)=>
<div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
<span style={{fontFamily:T.mn,fontSize:12,fontWeight:700,color:T.ac,background:T.ad,borderRadius:6,padding:"2px 8px",flexShrink:0}}>{i+1}</span>
<span style={{fontSize:14,color:T.mt,lineHeight:1.6}}>{t}</span></div>)}</div>

<div style={{background:T.sf,borderRadius:16,padding:24,border:`1px solid ${T.bd}`,marginBottom:40}}>
<h3 style={{fontFamily:T.mn,fontSize:13,fontWeight:700,color:T.ac,margin:"0 0 16px",letterSpacing:1}}>OPTIONS VOCALES</h3>
<div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
<div><Tog on={voiceIn} onToggle={v=>{if(v&&micOk===false){setMicW("Micro non disponible. Utilisez Chrome.");return}setVoiceIn(v);setMicW("")}} label="🎙️ Vous parlez au micro" disabled={micOk===false}/>
<div style={{fontSize:11,color:T.mt,marginTop:6,marginLeft:4}}>Au lieu de taper vos messages</div></div>
<div><Tog on={voiceOut} onToggle={setVoiceOut} label="🔊 Le collaborateur parle"/>
<div style={{fontSize:11,color:T.mt,marginTop:6,marginLeft:4}}>Voix réaliste</div></div>
</div>
{micW&&<div style={{marginTop:12,background:`${T.or}18`,border:`1px solid ${T.or}44`,borderRadius:10,padding:"10px 14px",fontSize:13,color:T.or}}>⚠️ {micW}</div>}</div>

<div style={{textAlign:"center"}}><B primary onClick={start}>Lancer la simulation</B></div>
</div></div>);

// ═══ CHAT ═══
if(scr==="chat"){const cS=!voiceIn&&inp.trim()&&!ld,sM=voiceIn&&!ld&&!spk;return(
<div style={{minHeight:"100vh",background:T.bg,fontFamily:T.ft,display:"flex",flexDirection:"column",height:"100vh"}}>{FL}<style>{CSS}</style>
<div style={{background:T.sf,borderBottom:`1px solid ${T.bd}`,padding:"14px 20px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
<button onClick={()=>{stopAudio();setScr("intro")}} style={{background:"none",border:"none",color:T.mt,cursor:"pointer",fontSize:20,padding:4}}>←</button>
<div style={{width:42,height:42,borderRadius:10,background:T.ad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontFamily:T.mn,fontWeight:700,color:T.ac}}>{sc?.name?.[0]}</div>
<div style={{flex:1}}><div style={{fontWeight:600,fontSize:15,color:T.tx}}>{sc?.name}</div>
<div style={{fontSize:12,color:T.mt}}>Achats{spk?<span style={{color:T.ac}}> · Parle...</span>:rec?<span style={{color:T.rd}}> · Écoute...</span>:""}</div></div>
<div style={{display:"flex",gap:6}}>
<Tog on={voiceIn} onToggle={v=>{if(v&&micOk===false){setMicW("Micro bloqué.");return}setVoiceIn(v);setMicW("")}} label="🎙️" disabled={micOk===false}/>
<Tog on={voiceOut} onToggle={v=>{if(!v)stopAudio();setVoiceOut(v)}} label="🔊"/>
</div>
<button onClick={doDeb} disabled={vc<1||ld} style={{background:vc<1?"rgba(255,255,255,0.04)":`linear-gradient(135deg,${T.ac},#B8892E)`,color:vc<1?T.mt:"#0C0E13",border:"none",borderRadius:10,padding:"10px 16px",fontSize:12,fontWeight:700,cursor:vc<1?"not-allowed":"pointer",fontFamily:T.ft,opacity:vc<1?.5:1,whiteSpace:"nowrap"}}>Fin & Debriefing</button></div>
<div style={{background:T.ad,borderBottom:`1px solid ${T.ag}`,padding:"10px 20px",fontSize:13,color:T.mt,lineHeight:1.5,flexShrink:0}}><strong style={{color:T.ac}}>Situation:</strong> {sc?.sit}</div>
{err&&<div style={{background:`${T.rd}22`,color:T.rd,padding:"10px 20px",fontSize:13,flexShrink:0}}>{err}<button onClick={()=>setErr(null)} style={{background:"none",border:"none",color:T.rd,textDecoration:"underline",cursor:"pointer",fontSize:13,marginLeft:8}}>×</button></div>}
{micW&&<div style={{background:`${T.or}18`,borderBottom:`1px solid ${T.or}33`,padding:"10px 20px",fontSize:13,color:T.or,flexShrink:0}}>⚠️ {micW}<button onClick={()=>setMicW("")} style={{background:"none",border:"none",color:T.or,textDecoration:"underline",cursor:"pointer",fontSize:13,marginLeft:8}}>OK</button></div>}
<div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:14}}>
{ms.filter(m=>!m.hidden).map((m,i)=><div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",animation:"fu .35s ease both"}}>
{m.role==="assistant"&&<div style={{width:32,height:32,borderRadius:8,background:T.ad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:T.mn,fontWeight:700,color:T.ac,marginRight:10,flexShrink:0,marginTop:4}}>{sc?.name?.[0]}</div>}
<div style={{maxWidth:"75%",padding:"13px 18px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.role==="user"?T.cd:T.sf,border:`1px solid ${m.role==="user"?T.ag:T.bd}`,fontSize:14,lineHeight:1.65,color:T.tx}}>{m.content}</div></div>)}
{ld&&<div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:8,background:T.ad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:T.mn,fontWeight:700,color:T.ac}}>{sc?.name?.[0]}</div>
<div style={{background:T.sf,border:`1px solid ${T.bd}`,borderRadius:"16px 16px 16px 4px",padding:"13px 22px",color:T.mt}}><span style={{animation:"pu 1.5s infinite"}}>●</span><span style={{animation:"pu 1.5s infinite .3s"}}> ●</span><span style={{animation:"pu 1.5s infinite .6s"}}> ●</span></div></div>}
<div ref={eR}/></div>
<div style={{background:T.sf,borderTop:`1px solid ${T.bd}`,padding:"14px 20px",flexShrink:0}}>
{voiceIn?<div style={{textAlign:"center"}}>
{(rec||tr)&&<div style={{background:T.cd,borderRadius:10,padding:"10px 16px",marginBottom:14,fontSize:14,color:rec?T.mt:T.tx,fontStyle:rec?"italic":"normal",minHeight:20}}>{tr||"En écoute..."}</div>}
{spk&&<div style={{marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:4,height:32}}>
{[0,1,2,3,4].map(i=><div key={i} style={{width:4,height:24,borderRadius:2,background:T.ac,animation:`sw .8s ease-in-out ${i*.12}s infinite`}}/>)}
<span style={{marginLeft:10,fontSize:13,color:T.ac}}>{sc?.name} parle...</span></div>}
{sM&&<button onMouseDown={startMic} onMouseUp={stopMic} onTouchStart={e=>{e.preventDefault();startMic()}} onTouchEnd={e=>{e.preventDefault();stopMic()}} style={{width:72,height:72,borderRadius:"50%",border:"none",background:rec?`linear-gradient(135deg,${T.rd},#A03030)`:`linear-gradient(135deg,${T.ac},#B8892E)`,color:rec?"#fff":"#0C0E13",fontSize:28,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",animation:rec?"mp 1.5s infinite":"none",boxShadow:rec?`0 0 30px ${T.rd}44`:`0 4px 24px ${T.ag}`}}>{rec?"⏹":"🎙️"}</button>}
<div style={{fontSize:11,color:T.mt,marginTop:12}}>{spk?"Attendez la réponse...":rec?"Relâchez pour envoyer":"Maintenez pour parler"}</div></div>
:<div style={{display:"flex",gap:10}}>
<input ref={iR} value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Votre message..." disabled={ld} style={{flex:1,background:T.cd,border:`1px solid ${T.bd}`,borderRadius:12,padding:"14px 18px",color:T.tx,fontSize:14,fontFamily:T.ft,outline:"none"}} onFocus={e=>e.target.style.borderColor=T.ac+"66"} onBlur={e=>e.target.style.borderColor=T.bd}/>
<button onClick={()=>send()} disabled={!cS} style={{background:cS?`linear-gradient(135deg,${T.ac},#B8892E)`:"rgba(255,255,255,0.04)",color:cS?"#0C0E13":T.mt,border:"none",borderRadius:12,padding:"0 24px",fontSize:18,fontWeight:700,cursor:cS?"pointer":"not-allowed",fontFamily:T.ft}}>↑</button></div>}
<div style={{fontSize:11,color:T.mt,marginTop:8,textAlign:"center"}}>{vc} msg{vc!==1?"s":""}{vc>0&&vc<4&&" · Échangez davantage"}</div></div></div>)}

// ═══ DEBRIEF ═══
if(scr==="debrief"){
if(dl)return(<div style={{minHeight:"100vh",background:T.bg,fontFamily:T.ft,display:"flex",alignItems:"center",justifyContent:"center"}}>{FL}<style>{CSS}</style><div style={{textAlign:"center"}}><div style={{fontSize:42,marginBottom:20,animation:"pu 1.5s infinite"}}>📊</div><div style={{color:T.mt,fontSize:16}}>Analyse en cours...</div></div></div>);
if(!db)return(<div style={{minHeight:"100vh",background:T.bg,fontFamily:T.ft,display:"flex",alignItems:"center",justifyContent:"center"}}>{FL}<div style={{textAlign:"center",maxWidth:400,padding:"0 20px"}}><div style={{fontSize:42,marginBottom:20}}>⚠️</div><div style={{color:T.tx,fontSize:18,fontWeight:600,marginBottom:12}}>Analyse échouée</div><div style={{color:T.mt,fontSize:14,marginBottom:24}}>{err||"Erreur."}</div><div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}><B primary onClick={doDeb}>Réessayer</B><B onClick={()=>{setErr(null);setScr("chat")}}>Retour</B></div></div></div>);
const nt=db.noteGlobale||0,nc=nt>=14?T.gn:nt>=10?T.or:T.rd,ma=db.styleDetecte===db.styleIdeal;
const Sec=({title,color,children})=><div style={{background:T.sf,borderRadius:14,padding:20,border:`1px solid ${T.bd}`,marginBottom:12}}><h4 style={{fontFamily:T.mn,fontSize:12,fontWeight:700,color,margin:"0 0 14px"}}>{title}</h4>{children}</div>;
const Q=({items,color})=>(items||[]).length>0?items.map((x,i)=><div key={i} style={{marginBottom:14}}><div style={{background:T.cd,borderRadius:10,padding:"10px 14px",borderLeft:`3px solid ${color}`,fontSize:13,color:T.tx,lineHeight:1.5,fontStyle:"italic"}}>« {x.citation} »</div><div style={{fontSize:12,color,marginTop:6,paddingLeft:14}}>→ {x.pourquoi}</div></div>):null;
return(
<div style={{minHeight:"100vh",background:T.bg,fontFamily:T.ft}}>{FL}
<div style={{maxWidth:700,margin:"0 auto",padding:"40px 20px"}}>
<div style={{textAlign:"center",marginBottom:40}}>
<span style={{display:"inline-block",fontSize:11,fontWeight:700,letterSpacing:2.5,textTransform:"uppercase",color:T.ac,background:T.ad,border:`1px solid ${T.ag}`,borderRadius:99,padding:"6px 20px",marginBottom:24}}>Debriefing</span>
<div style={{fontSize:72,fontFamily:T.mn,fontWeight:800,color:nc,lineHeight:1,textShadow:`0 0 40px ${nc}44`}}>{nt}<span style={{fontSize:28,color:T.mt}}>/20</span></div>
<div style={{fontSize:15,color:T.mt,marginTop:10,maxWidth:560,margin:"10px auto 0",lineHeight:1.6}}>{db.analyseGenerale}</div></div>
<div style={{background:T.sf,borderRadius:16,padding:24,border:`1px solid ${T.ag}`,marginBottom:20}}>
<h3 style={{fontFamily:T.mn,fontSize:13,fontWeight:700,color:T.ac,margin:"0 0 14px",letterSpacing:1}}>PROFIL RÉVÉLÉ</h3>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
<div style={{background:T.cd,borderRadius:10,padding:16}}><div style={{fontSize:11,color:T.mt,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Collaborateur</div><div style={{fontSize:15,fontWeight:600,color:T.tx}}>{sc?.name}</div><div style={{fontSize:13,color:T.mt}}>{sc?.title}</div></div>
<div style={{background:T.cd,borderRadius:10,padding:16}}><div style={{fontSize:11,color:T.mt,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Maturité</div><div style={{fontSize:22,fontFamily:T.mn,fontWeight:700,color:T.ac}}>{db.maturityReveal}</div></div></div>
<div style={{marginTop:14,fontSize:14,color:T.mt,lineHeight:1.6}}>{db.maturityExplication}</div></div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
<div style={{background:T.sf,borderRadius:14,padding:20,border:`1px solid ${ma?T.gn+"44":T.rd+"44"}`}}><div style={{fontSize:11,color:T.mt,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Votre style</div><div style={{fontFamily:T.mn,fontSize:18,fontWeight:700,color:ma?T.gn:T.rd}}>{db.styleDetecte}</div><div style={{fontSize:13,color:T.mt}}>{db.styleNomDetecte}</div></div>
<div style={{background:T.sf,borderRadius:14,padding:20,border:`1px solid ${T.gn}44`}}><div style={{fontSize:11,color:T.mt,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Style idéal</div><div style={{fontFamily:T.mn,fontSize:18,fontWeight:700,color:T.gn}}>{db.styleIdeal}</div><div style={{fontSize:13,color:T.mt}}>{db.styleNomIdeal}</div></div></div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
<Sec title="✓ POINTS FORTS" color={T.gn}>{(db.pointsForts||[]).map((p,i)=><div key={i} style={{fontSize:13,color:T.mt,lineHeight:1.5,marginBottom:8,paddingLeft:12,borderLeft:`2px solid ${T.gn}33`}}>{p}</div>)}</Sec>
<Sec title="✗ À AMÉLIORER" color={T.rd}>{(db.pointsAmelioration||[]).map((p,i)=><div key={i} style={{fontSize:13,color:T.mt,lineHeight:1.5,marginBottom:8,paddingLeft:12,borderLeft:`2px solid ${T.rd}33`}}>{p}</div>)}</Sec></div>
{(db.exemplesDialogueBons||[]).length>0&&<Sec title="💬 BONNES RÉPLIQUES" color={T.gn}><Q items={db.exemplesDialogueBons} color={T.gn}/></Sec>}
{(db.exemplesDialogueMauvais||[]).length>0&&<Sec title="⚠️ À REVOIR" color={T.rd}><Q items={db.exemplesDialogueMauvais} color={T.rd}/></Sec>}
{(db.exemplesIdeal||[]).length>0&&<div style={{background:T.ad,borderRadius:14,padding:20,border:`1px solid ${T.ag}`,marginBottom:20}}>
<h4 style={{fontFamily:T.mn,fontSize:12,fontWeight:700,color:T.ac,margin:"0 0 14px"}}>💡 CE QU'IL AURAIT FALLU DIRE</h4>
{db.exemplesIdeal.map((x,i)=><div key={i} style={{marginBottom:14}}>
<div style={{fontSize:12,color:T.mt,marginBottom:4}}>{x.situation}</div>
<div style={{background:T.sf,borderRadius:10,padding:"10px 14px",borderLeft:`3px solid ${T.ac}`,fontSize:13,color:T.tx,lineHeight:1.5}}>« {x.aurait_du_dire} »</div></div>)}</div>}
<div style={{background:T.sf,borderRadius:14,padding:24,border:`1px solid ${T.bd}`,marginBottom:32,textAlign:"center"}}>
<div style={{fontSize:28,marginBottom:10}}>🎯</div><div style={{fontSize:15,color:T.tx,lineHeight:1.7,fontWeight:500}}>{db.conseilFinal}</div></div>
<div style={{textAlign:"center",display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
<B primary onClick={()=>{setDb(null);start()}}>Nouveau scénario</B>
<B onClick={()=>{setDb(null);setScr("intro")}}>Accueil</B></div></div></div>)}
return null}
