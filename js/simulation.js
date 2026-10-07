"use strict";

/* ------------------------------------------------------------------ */
/* STATE                                                              */
/* ------------------------------------------------------------------ */
var VIS = [
  ["patientSafety","Patient Safety"],
  ["processControl","Process Control"],
  ["financialHealth","Financial Health"],
  ["staffTrust","Staff Trust"],
  ["surgeonBuyin","Surgeon Buy-in"],
  ["accreditation","Accreditation Standing"],
  ["insurerTrust","Insurer Trust"],
  ["reputation","Reputation"]
];

var START_BUDGET = 70;
var state, decisionIndex, chosen, firedEvents, histLog, instructor=false, playerName="", uneaseIdx=0;

function freshState(){
  return {
    patientSafety:55, processControl:50, financialHealth:62, staffTrust:52,
    surgeonBuyin:58, accreditation:60, insurerTrust:56, reputation:64,
    trueRisk:64,        // the REAL infection risk (hidden; higher = worse)
    qualityDebt:38,     // hidden risk piling up from shortcuts (higher = worse)
    reportedRate:1.9,   // the infection number the board is shown (%)
    copq:0,             // running Cost of Poor Quality (Rs lakh)
    budget:START_BUDGET // one-off improvement capital (points)
  };
}

/* A light tooltip helper for plain-English definitions of any jargon. */
function term(word,def){ return '<span class="term" title="'+def+'">'+word+'</span>'; }

var UNEASE = [
  "Off the record: your quality lead lingers after the meeting, looking unconvinced.",
  "A senior nurse mentions, half-joking, that the numbers feel a little too clean.",
  "The wards seem quieter about infections than the data in front of you would suggest.",
  "Something about how good the dashboard looks doesn’t quite sit right with you."
];

/* ------------------------------------------------------------------ */
/* CONTENT — one scenario, plain-English, with costs + consequences    */
/* ------------------------------------------------------------------ */
var DECISIONS = [
 {id:"register", title:"Recording an Infection",
  context:"A nurse has spotted the early signs of an infection in a patient's surgical wound, eleven days after a routine knee-replacement operation. To officially log it as a "+term("surgical-site infection","An infection at the place where an operation was performed — the hospital's headline quality measure.")+" — the hospital's headline quality number — the rules say the operating surgeon must countersign, and he won't be on the ward for another forty minutes. The nurse's last three warnings were quietly downgraded to 'not an infection.' How should suspected infections be recorded?",
  options:[
   {lbl:"Let nurses log a suspected infection instantly", tag:"build", cost:12,
    det:"Drop the surgeon sign-off requirement. Any nurse can record a suspected infection in real time; the surgeon reviews it afterwards.",
    v:{processControl:10,patientSafety:8,staffTrust:8,surgeonBuyin:-6}, h:{trueRisk:-8,qualityDebt:-6,reportedRate:0.6,copq:3},
    result:"Nurses start logging wounds the same morning. A few cases the old process would have buried now appear — uncomfortable on paper, but finally honest.",
    teaches:"You cannot manage a problem a sign-off lets you hide. Honest counting makes the reported number rise before it falls."},
   {lbl:"Keep the surgeon's sign-off; review weekly", tag:"optics", cost:0,
    det:"Only a surgeon can confirm an infection 'counts'; flagged wounds are reviewed once a week.",
    v:{financialHealth:2,surgeonBuyin:6,reputation:3}, h:{trueRisk:9,qualityDebt:10,reportedRate:-0.3},
    result:"The weekly review stays tidy and the surgeons are content. A couple of this week's wounds never make it onto the register.",
    teaches:"Whoever controls the count controls the story. When under-reporting is the easy path, the number drifts away from reality."},
   {lbl:"Let the lab trigger the record automatically", tag:"build", cost:25,
    det:"Whenever a lab test on a wound finds bacteria, the system opens an infection record on its own — no sign-off needed.",
    v:{processControl:14,patientSafety:10,accreditation:6,financialHealth:-6,surgeonBuyin:-4}, h:{trueRisk:-14,qualityDebt:-10,reportedRate:0.9,copq:8},
    result:"The lab system now opens a record on its own. It costs to wire up, but nothing quietly disappears anymore.",
    teaches:"Mistake-proofing: tie detection to an objective signal the system cannot quietly ignore."}
  ]},

 {id:"turnover", title:"A Crowded Operating Schedule",
  context:"Your surgeons do 14 to 18 knee replacements a month and the operating-theatre list is full. The quickest way to fit in more operations is to shorten the gap between them — but that gap is exactly when the theatre is cleaned and sterilised. As the operations chief, you set the rule.",
  options:[
   {lbl:"Speed up between operations to fit more in", tag:"optics", cost:0,
    det:"Trim the gap between cases so more procedures fit each day. Revenue and surgeon goodwill go up.",
    v:{financialHealth:10,surgeonBuyin:8,processControl:-8,patientSafety:-6}, h:{trueRisk:12,qualityDebt:12},
    result:"Two extra operations fit into the day and revenue ticks up. The cleaning crew is visibly rushed between cases.",
    teaches:"Schedule pressure turns into infection risk when cleaning time is the thing quietly cut."},
   {lbl:"Protect full cleaning time, even if it means fewer cases", tag:"build", cost:5,
    det:"Keep the proper cleaning window, accepting fewer operations per day.",
    v:{processControl:12,patientSafety:10,financialHealth:-8,surgeonBuyin:-6}, h:{trueRisk:-12,qualityDebt:-8},
    result:"The list runs shorter and a few cases slip to next week. The theatre is genuinely clean between patients.",
    teaches:"Paying to do the process properly is far cheaper than paying for the infection it prevents."},
   {lbl:"Build another operating theatre", tag:"build", cost:30,
    det:"Invest in extra capacity so volume and cleaning standards can both be met.",
    v:{financialHealth:-12,processControl:6,patientSafety:4,surgeonBuyin:6}, h:{trueRisk:-6,qualityDebt:-4,copq:10},
    result:"Approval for a new theatre goes through — a big cheque, but the squeeze eases without cutting corners.",
    teaches:"Spending on capacity helps — but it does not, by itself, fix the incentives that created the squeeze."}
  ]},

 {id:"abx", title:"The Timing of Preventive Antibiotics",
  context:"There is clear evidence that a preventive dose of antibiotics, given in the hour before surgery starts, sharply cuts infection risk. When the list runs late, that timing slips. How do you keep it on track?",
  options:[
   {lbl:"Add it to the pre-surgery checklist and have pharmacy track the timing", tag:"build", cost:10,
    det:"A checklist item before every operation, with the pharmacy logging and auditing when the dose was actually given.",
    v:{processControl:12,patientSafety:8,staffTrust:4}, h:{trueRisk:-10,qualityDebt:-6,copq:2},
    result:"Pharmacy starts timing every dose. Compliance is visible for the first time, and the late-running gaps get caught.",
    teaches:"A cheap, checkable early-warning measure (timing) prevents an expensive late one (infection)."},
   {lbl:"Leave the timing to each surgeon's judgement", tag:"optics", cost:0,
    det:"Trust experienced surgeons to manage it case by case; add no extra process.",
    v:{surgeonBuyin:8,financialHealth:1}, h:{trueRisk:9,qualityDebt:7},
    result:"No new process, and the surgeons appreciate it. On late days, the dose timing quietly drifts.",
    teaches:"Discretion with no measurement is how a reliable routine quietly decays."},
   {lbl:"Run a one-off training session and call it handled", tag:"wait", cost:3,
    det:"Hold a teaching session on timing and consider the matter closed.",
    v:{staffTrust:3,processControl:3}, h:{trueRisk:2,qualityDebt:3},
    result:"Everyone nods through the session. Within weeks, habits are back to where they started.",
    teaches:"Training with no follow-up measurement feels like action but rarely changes behaviour."}
  ]},

 {id:"cssd", title:"Missing Sterilisation Records",
  context:"An internal check finds that the records proving surgical instruments were properly sterilised are missing for several recent days. Your "+term("accreditation","An independent quality inspection that hospitals must pass to keep their official quality rating and insurer contracts.")+" inspection — the independent quality audit you must pass — is coming up soon.",
  options:[
   {lbl:"Invest in equipment that tracks and tests every sterilisation cycle", tag:"build", cost:25,
    det:"Put in systems that record each instrument load and test that every cycle actually worked.",
    v:{processControl:12,patientSafety:8,accreditation:8,financialHealth:-8}, h:{trueRisk:-12,qualityDebt:-10,copq:12},
    result:"Every sterilisation cycle is now logged and tested. The capital outlay stings, but the gap is closed for good.",
    teaches:"Proving the process worked — with objective evidence, not assurances — is the heart of quality control."},
   {lbl:"Recreate the missing records before the inspectors arrive", tag:"optics", cost:0,
    det:"Reconstruct the paperwork so the file looks complete for the audit.",
    v:{accreditation:10,reputation:4}, h:{trueRisk:10,qualityDebt:18},
    result:"The file looks complete for the inspectors. Three staff now know the records were written after the fact.",
    teaches:"Faked records are the most expensive shortcut of all: dishonesty compounds and is eventually discovered."},
   {lbl:"Outsource sterilisation to a certified specialist", tag:"build", cost:12,
    det:"Hand sterilisation to an outside firm with its own certification and tracking.",
    v:{financialHealth:-6,processControl:6,accreditation:4}, h:{trueRisk:-6,qualityDebt:-4,copq:6},
    result:"A certified vendor takes over sterilisation. It costs to set up, and some control moves off-site.",
    teaches:"You can pass some risk to a vendor, but you cannot outsource responsibility for the outcome."}
  ]},

 {id:"surveillance", title:"Finding the Infections You Don't See",
  context:"Most surgical infections appear after the patient has gone home, so they never show up in your hospital's own figures. How hard should you look for them?",
  options:[
   {lbl:"Follow up with every surgical patient for 30 days", tag:"build", cost:15,
    det:"Contact each patient by phone and an online portal for a month to catch infections that appear at home.",
    v:{patientSafety:10,processControl:8,financialHealth:-4}, h:{trueRisk:-12,qualityDebt:-8,reportedRate:1.1,copq:5},
    result:"Calls and the portal start catching infections that show up at home. The reported rate rises — because you're finally seeing them.",
    teaches:"Looking properly makes the true rate visible. The reported number climbs because you are finally seeing reality."},
   {lbl:"Count only patients who return to your own hospital", tag:"optics", cost:0,
    det:"Keep the current method; the dashboard stays comfortable.",
    v:{financialHealth:2,reputation:3}, h:{trueRisk:8,qualityDebt:9,reportedRate:-0.4},
    result:"Nothing changes and the dashboard stays calm. The infections that present at home stay invisible to you.",
    teaches:"Not looking flatters the numbers by design: 'we didn't see it' gets mistaken for 'it didn't happen'."},
   {lbl:"Use insurers' records to spot infections treated elsewhere", tag:"build", cost:10,
    det:"Work with insurers' claims data to find infections your patients had treated at other hospitals.",
    v:{insurerTrust:12,processControl:6,financialHealth:-3}, h:{trueRisk:-8,qualityDebt:-6,reportedRate:0.7},
    result:"The insurer shares data and a clearer picture emerges, at modest cost and some goodwill earned.",
    teaches:"Sharing the search with the people who pay the bills turns a potential opponent into a quality partner."}
  ]},

 {id:"cfo", title:"The Finance Chief's Question",
  context:"Finance has added up the cost of this one infection: a longer stay, expensive antibiotics, a likely second operation. Under the "+term("cashless-insurance","A system where the insurer pays the hospital directly, so the patient does not pay upfront — and the hospital can pass complication costs to the insurer.")+" system, most of it can simply be billed to the insurer. The finance chief asks how to treat money spent on prevention.",
  options:[
   {lbl:"Show that prevention is cheaper than failure", tag:"build", cost:3,
    det:"Add up the full "+term("Cost of Poor Quality","The total cost of getting it wrong: extra treatment, lost beds, and damage to reputation and relationships.")+" — treatment, lost beds, reputation — and present prevention as an investment that pays back.",
    v:{financialHealth:4,processControl:6,staffTrust:4}, h:{trueRisk:-6,qualityDebt:-6,copq:2},
    result:"The CFO sees prevention as an investment for the first time. A small modelling effort, a big shift in framing.",
    teaches:"Costing the failure properly reframes prevention as an investment, not an expense — the core argument of the case."},
   {lbl:"Bill the infection's cost to the insurer and move on", tag:"optics", cost:0,
    det:"Treat the complication as just another billable item; this quarter looks fine.",
    v:{financialHealth:12,surgeonBuyin:4}, h:{trueRisk:10,qualityDebt:12},
    result:"The complication is billed and the quarter looks fine. Nothing about the underlying problem has changed.",
    teaches:"When someone else pays for your mistakes, the normal pressure to fix them disappears. That is why the problem persists."},
   {lbl:"Quietly fund some fixes out of profit, off the books", tag:"wait", cost:5,
    det:"Pay for a few improvements informally, with no visible budget or business case.",
    v:{financialHealth:-4,processControl:4}, h:{trueRisk:-4,qualityDebt:-2},
    result:"A little money trickles to improvements, with no budget line to defend it — or to protect it when times tighten.",
    teaches:"Unfunded, invisible quality work is the first thing cut the moment money gets tight."}
  ]},

 {id:"insurer", title:"The Insurer Comes Asking",
  context:"A big insurer's claims team, crunching its own data, queries this patient's bill and hints it has spotted a pattern across your hospital. A large share of your business depends on staying in that insurer's network.",
  options:[
   {lbl:"Be upfront; offer a deal that rewards fewer complications", tag:"build", cost:8,
    det:"Share your real data and propose a contract that pays you better when complication rates fall.",
    v:{insurerTrust:14,reputation:6,financialHealth:-4}, h:{trueRisk:-6,qualityDebt:-6,copq:4},
    result:"You table your real data and propose a value deal. The insurer is wary but interested; trust grows.",
    teaches:"Telling the truth first turns an audit threat into a better contract."},
   {lbl:"Dispute the query and defend the bill", tag:"optics", cost:0,
    det:"Push back on the question and protect this quarter's income.",
    v:{financialHealth:6,insurerTrust:-12}, h:{trueRisk:6,qualityDebt:8},
    result:"You win the argument on this bill. The insurer's analytics team makes a quiet note about your hospital.",
    teaches:"Defending appearances against a data-rich partner damages the relationship your business actually runs on."},
   {lbl:"Agree one all-in price covering the operation and any complications", tag:"build", cost:12,
    det:"Negotiate a single bundled price for the whole episode, so complications come out of your margin, not the insurer's.",
    v:{insurerTrust:10,processControl:6,financialHealth:-2}, h:{trueRisk:-8,qualityDebt:-6},
    result:"A bundled-price pilot is agreed. Complications now eat into your margin — which sharpens everyone's focus.",
    teaches:"A single all-in price makes complications your cost — which finally lines up the incentive to prevent them."}
  ]},

 {id:"nabh", title:"The Accreditation Inspection",
  context:"The quality inspectors have arrived. Now that you are counting infections honestly, your real rate is higher than the polished figure you used to publish. What do you put in front of them?",
  options:[
   {lbl:"Show the real, higher numbers and your plan to fix them", tag:"build", cost:5,
    det:"Present the honest trend and the concrete steps already under way.",
    v:{accreditation:6,reputation:4,staffTrust:6}, h:{trueRisk:-6,qualityDebt:-8,reportedRate:0.5},
    result:"You show the honest trend and your plan. The inspectors respond to candour better than you feared.",
    teaches:"Good inspectors increasingly trust a believable improvement story more than suspiciously perfect numbers."},
   {lbl:"Show the old, flattering figure and keep the visit smooth", tag:"optics", cost:0,
    det:"Lead with the comfortable historical number and avoid awkward questions.",
    v:{accreditation:12,reputation:6}, h:{trueRisk:6,qualityDebt:12,reportedRate:-0.3},
    result:"The visit goes smoothly on the old number. The gap between the file and the wards just got wider.",
    teaches:"A clean certificate over a messy process is just a shortcut with an official stamp on it."},
   {lbl:"Invite extra inspection focused on infection control", tag:"build", cost:10,
    det:"Ask the inspectors to look harder at your weakest area.",
    v:{accreditation:4,processControl:6,financialHealth:-3}, h:{trueRisk:-6,qualityDebt:-4,copq:4},
    result:"You invite a hard look at infection control. It costs time and nerve, and it reads as genuine.",
    teaches:"Inviting scrutiny of your weakest point is costly but is a credible sign you mean it."}
  ]},

 {id:"surgeon", title:"Managing a Star Surgeon",
  context:"Where you have data, it points to one high-volume surgeon accounting for an outsized share of complications. He is also a major source of revenue and resists oversight. How do you manage surgeon performance?",
  options:[
   {lbl:"Publish each surgeon's results, fairly adjusted for case difficulty", tag:"build", cost:12,
    det:"Make individual results visible and peer-reviewed, adjusted for how complex each surgeon's cases are.",
    v:{processControl:10,patientSafety:8,surgeonBuyin:-10,staffTrust:6}, h:{trueRisk:-12,qualityDebt:-8},
    result:"Individual results go up on the board. One star surgeon is furious; the data starts to move.",
    teaches:"Naming individual results is the strongest lever on outcomes — and the hardest one politically."},
   {lbl:"Shield your star surgeons; report only hospital-wide totals", tag:"optics", cost:0,
    det:"Publish only the overall figure so no individual is singled out.",
    v:{surgeonBuyin:12,reputation:2}, h:{trueRisk:10,qualityDebt:10},
    result:"Only hospital-wide numbers are published. The outlier stays comfortably hidden in the average.",
    teaches:"Lumping everyone together hides the outlier — and protecting the volume protects the source of the risk."},
   {lbl:"Tie part of pay to complication results", tag:"build", cost:10,
    det:"Link some of each surgeon's pay to their complication record, adjusted for case difficulty.",
    v:{surgeonBuyin:-4,processControl:8,financialHealth:-2}, h:{trueRisk:-10,qualityDebt:-8},
    result:"Part of pay now tracks complications. Grumbling at first, then quietly better behaviour.",
    teaches:"Paying for outcomes changes behaviour — adjust for case difficulty so no one games it by dodging hard cases."}
  ]},

 {id:"board", title:"Your Recommendation to the Board",
  context:"You have two weeks to write a single recommendation for the board. The patient's daughter is already gaining attention online. What do you recommend?",
  options:[
   {lbl:"Count honestly, invest step by step, and push the whole industry to change", tag:"build", cost:15,
    det:"Be honest about the numbers now, fund prevention in stages, and lobby insurers, inspectors and regulators to change the rules for everyone.",
    v:{patientSafety:8,processControl:8,accreditation:6,insurerTrust:6,reputation:4}, h:{trueRisk:-12,qualityDebt:-12},
    result:"Your recommendation lands: count honestly, invest in stages, and push the industry to move together.",
    teaches:"Fix your own honesty now, and push for industry-wide rules so doing the right thing is not a competitive penalty."},
   {lbl:"Manage the public image and keep the reported number low", tag:"optics", cost:3,
    det:"Invest in PR and the hospital's story, and hold the comfortable number steady.",
    v:{reputation:10,financialHealth:4}, h:{trueRisk:10,qualityDebt:14},
    result:"The board likes the clean narrative and the steady number. The underlying risk is still sitting there.",
    teaches:"Managing the story without managing the risk leaves you one bad event away from being exposed."},
   {lbl:"Wait for the regulator to force everyone to change at once", tag:"wait", cost:0,
    det:"Hold position until the rules force the whole industry to move together.",
    v:{financialHealth:2}, h:{trueRisk:4,qualityDebt:6},
    result:"The board agrees to hold for the regulator. Nothing changes, and the clock keeps running.",
    teaches:"Moving first has a real cost — but waiting hands your fate to the next bad event."}
  ]}
];

/* Triggered events: the hidden risk you built up suddenly comes due. */
var EVENTS = [
 {id:"sentinel",
  when:function(s){return s.qualityDebt>=70;},
  title:"It All Comes to Light",
  body:"Three serious infections surface within a fortnight — including this patient's, now confirmed. What was being kept quiet on the wards is suddenly a medical, financial and public problem all at once. The reported number jumps as reality forces its way onto the dashboard.",
  apply:{reputation:-15,insurerTrust:-12,accreditation:-10,patientSafety:-8,reportedRate:1.2,copq:45,qualityDebt:-25,trueRisk:-5},
  teaches:"Hidden risk does not disappear — it piles up silently and then all comes due at once, at a moment you do not get to choose."},
 {id:"viral",
  when:function(s){return s.trueRisk>=66 && s.reputation>=70;},
  title:"The Story Goes Viral",
  body:"The patient's daughter posts her father's experience — alongside the hospital's glossy public infection figures. It is shared tens of thousands of times. The gap between the brand and the bedside is now the story.",
  apply:{reputation:-18,insurerTrust:-8,staffTrust:-4,copq:15},
  teaches:"A reputation built on a number you cannot defend is fragile — it collapses the moment an outsider holds the real one up beside it."},
 {id:"audit",
  when:function(s){return s.reportedRate<1.4 && s.trueRisk>=60;},
  title:"The Insurer's Data Doesn't Add Up",
  body:"An insurer's analytics team notices that your reported infection rate is suspiciously low next to how often your patients are readmitted and given antibiotics. They open a billing review.",
  apply:{insurerTrust:-16,financialHealth:-10,reputation:-6,reportedRate:0.8,copq:30},
  teaches:"The people who pay eventually notice. A reported number that drifts too far from the real data is itself a warning sign to them."}
];

/* ------------------------------------------------------------------ */
/* HELPERS                                                            */
/* ------------------------------------------------------------------ */
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function applyDelta(d){
  for(var k in d){ if(!d.hasOwnProperty(k)) continue; state[k]=(state[k]||0)+d[k]; }
  for(var i=0;i<VIS.length;i++){var key=VIS[i][0];state[key]=clamp(state[key],0,100);}
  state.trueRisk=clamp(state.trueRisk,0,100);
  state.qualityDebt=clamp(state.qualityDebt,0,100);
  state.reportedRate=clamp(state.reportedRate,0,12);
  state.copq=Math.max(0,state.copq);
}
function el(id){return document.getElementById(id);}
function setTxt(id,val){ var e=el(id); if(e){ e.textContent=val; } }
function raf(fn){ if(typeof requestAnimationFrame==='function'){ requestAnimationFrame(fn); } else { setTimeout(fn,16); } }
function recordHistory(){ histLog.push({reported:state.reportedRate, trueRisk:state.trueRisk}); }

/* Concrete, defensible readouts derived from the model state. */
function per1000(pct){ return Math.round(pct*10); }                         // a % rate -> count per 1,000 patients
function uncountedPer1000(s){ return Math.max(0, Math.round((trueRatePct(s)-s.reportedRate)*10)); } // measurement gap
function latentBand(s){ var q=s.qualityDebt; if(q>=65) return {t:'High',c:'var(--bad)'}; if(q>=40) return {t:'Building',c:'var(--optics)'}; return {t:'Low',c:'var(--good)'}; }

/* ------------------------------------------------------------------ */
/* PERSISTENT DASHBOARD (built once, updated in place so bars animate) */
/* ------------------------------------------------------------------ */
function buildDashboard(){
  var h='<div class="panel">'+
     '<div class="budget"><div class="row"><span class="cap">Improvement budget</span><b><span id="val_budget">0</span> / '+START_BUDGET+'</b></div>'+
       '<div class="bar"><i id="bar_budget" style="background:var(--accent2)"></i></div>'+
       '<div class="cap" style="margin-top:6px;text-transform:none;color:#473f36">One-off capital for fixes. You can’t afford everything — spend it where it matters.</div></div>'+
     '<h3>The Board’s Dashboard <span class="pill">what everyone sees</span></h3>';
  for(var i=0;i<VIS.length;i++){
    var k=VIS[i][0], name=VIS[i][1];
    h+='<div class="metric"><div class="row"><span>'+name+'</span><b id="val_'+k+'">0</b></div>'+
       '<div class="bar"><i id="bar_'+k+'"></i></div></div>';
  }
  h+='<div class="metric" style="margin-top:12px"><div class="row"><span>Reported infection rate</span><b id="val_reportedRate">0%</b></div>'+
     '<div class="small">The number shown to the board, insurers and inspectors.</div></div></div>';
  h+='<div class="panel hidden-panel"><h3>Hidden Reality</h3>'+
     '<p class="note-hidden">Hidden from students during play — this is the truth that sat beneath the optics.</p>'+
     '<div class="metric"><div class="row"><span>True infection rate</span><b id="val_trueRate">0%</b></div>'+
       '<div class="bar"><i id="bar_trueRate" style="background:var(--warn)"></i></div>'+
       '<div class="small" style="color:var(--warn)">the real rate, against the reported number above</div></div>'+
     '<div class="metric" style="margin-top:10px"><div class="row"><span>Infections going uncounted</span><b id="val_uncounted">0</b></div>'+
       '<div class="small" style="color:var(--warn)">per 1,000 surgical patients — the gap the board never sees</div></div>'+
     '<div class="metric" style="margin-top:10px"><div class="row"><span>Latent risk of a crisis</span><b id="val_latent">Low</b></div>'+
       '<div class="small" style="color:var(--warn)">shortcuts quietly building toward a sentinel event</div></div>'+
     '<div class="metric" style="margin-top:10px"><div class="row"><span>Avoidable cost so far</span><b id="val_copq">₹0L</b></div></div>'+
     '</div>';
  var side=el("side"); if(side){ side.innerHTML=h; }
  raf(function(){ updateDashboard(); });
}
function updateDashboard(){
  for(var i=0;i<VIS.length;i++){
    var k=VIS[i][0], val=Math.round(state[k]);
    var col = val>=66?'var(--good)':(val<=33?'var(--bad)':'var(--accent2)');
    var bar=el('bar_'+k); if(bar){ bar.style.width=val+'%'; bar.style.background=col; }
    setTxt('val_'+k, val);
  }
  setTxt('val_reportedRate', state.reportedRate.toFixed(1)+'% (≈'+per1000(state.reportedRate)+' / 1,000)');
  var tr=trueRatePct(state);
  setTxt('val_trueRate', tr.toFixed(1)+'% (≈'+per1000(tr)+' / 1,000)');
  var btr=el('bar_trueRate'); if(btr){ btr.style.width=Math.round(tr/12*100)+'%'; }
  setTxt('val_uncounted', '≈'+uncountedPer1000(state)+' / 1,000');
  var lb=latentBand(state), le=el('val_latent'); if(le){ le.textContent=lb.t; le.style.color=lb.c; }
  setTxt('val_copq', '₹'+Math.round(state.copq)+'L');
  setTxt('val_budget', Math.round(state.budget));
  var bb=el('bar_budget'); if(bb){ bb.style.width=Math.round(100*state.budget/START_BUDGET)+'%'; }
}

/* Swap the main column and animate the new content in. Content is set
   immediately (no exit timer that could leave the panel hidden). */
function swapMain(html){
  var m=el("main"); if(!m){ return; }
  m.classList.remove('anim-in');
  m.classList.remove('anim-out');
  m.innerHTML=html;
  void m.offsetWidth;       // force reflow so the entrance animation restarts
  m.classList.add('anim-in');
}

/* ------------------------------------------------------------------ */
/* SCREENS                                                            */
/* ------------------------------------------------------------------ */
function renderIntro(){
  if(document.body.classList && document.body.classList.remove){ document.body.classList.remove('reveal-end'); }
  var h='<div class="panel intro">'+
   '<h2>You are the Chief Operating Officer of a private hospital</h2>'+
   '<p>Pinnacle Hospitals is a mid-sized, stock-market-listed private hospital chain. Its reputation rests on doing a high volume of operations, holding an official quality rating, and being in the networks of most major insurers. This morning, a nurse has flagged an infection that the system would quietly prefer not to count.</p>'+
   '<div class="role"><strong>Over the next ten decisions</strong> you will run the hospital through the situations the case describes — from recording that first infection to writing your recommendation to the board. Each time, you choose between what makes the hospital <em>look</em> good and what actually makes it <em>safer</em>. They are often not the same choice.</div>'+
   '<div class="glossary"><b>No medical knowledge needed.</b> Hover the underlined words for plain-English definitions. Two ideas drive everything: the hospital reports an <b>infection rate</b> everyone can see, and it carries a <b>true risk</b> no one can see — the game is about the distance between them. You also have a limited <b>improvement budget</b> for one-off fixes: you cannot afford to repair everything, so you must decide where it matters most.</div>'+
   '<p class="small">There is no perfect score and no way to win every measure at once. A good outcome comes from spending a tight budget on the choices that genuinely lower risk. Allow ten to fifteen minutes.</p>'+
   '<div class="field"><label>Your name or team name (optional, used in the closing memo):<br><input id="nameInput" maxlength="42" placeholder="e.g., Group 4"></label></div>'+
   '<button class="btn" onclick="startGame()">Start the simulation</button>'+
   '<div class="facu"><h3>For the instructor</h3>'+
     '<p class="small">Instructor view (toggle, top-right) reveals a second “Hidden Reality” panel during play — the true infection rate, how many infections are going uncounted per 1,000 surgeries, the latent risk of a crisis, and the avoidable cost — plus the concept each option teaches and its effect on those numbers. The budget forces prioritisation (the case’s constrained-administrator objective): students cannot simply pick every high-quality option. Run it live with the class voting at each step, or mark up a student’s play afterwards. The payoff is the end chart, where the reported rate they protected diverges from the true rate they were actually carrying.</p></div>'+
   '</div>';
  el("app").innerHTML='<div class="layout"><div>'+sideHelpHTML()+'</div><div class="main">'+h+'</div></div>';
}

function sideHelpHTML(){
  return '<div class="panel"><h3>The two numbers that matter</h3>'+
    '<p class="small" style="font-size:13px;color:#473f36">Every choice moves the visible dashboard the board sees. Some choices also move things no one can see: the hospital’s <em>true</em> infection rate and how many infections quietly go uncounted.</p>'+
    '<p class="small" style="font-size:13px;color:#473f36">You can make the dashboard look excellent while making the hospital more dangerous. This simulation — like the case — is about the distance between how things look and how they really are.</p></div>';
}

function startGame(){
  var inp=el("nameInput"); if(inp) playerName=(inp.value||"").trim();
  state=freshState(); decisionIndex=0; chosen=[]; firedEvents=[]; histLog=[]; uneaseIdx=0;
  recordHistory();
  if(document.body.classList && document.body.classList.remove){ document.body.classList.remove('reveal-end'); }
  el("app").innerHTML='<div class="layout"><div id="side"></div><div class="main" id="main"></div></div>';
  buildDashboard();
  renderDecision();
}

function renderDecision(){
  var d=DECISIONS[decisionIndex];
  var main='<div class="progress">Decision '+(decisionIndex+1)+' of '+DECISIONS.length+' &nbsp;·&nbsp; Budget left: '+Math.round(state.budget)+'</div>'+
    '<h2>'+d.title+'</h2><p class="context">'+d.context+'</p>';
  for(var i=0;i<d.options.length;i++){
    var o=d.options[i];
    var afford = o.cost<=state.budget;
    var costTxt = o.cost>0 ? ('<span class="cost">spend '+o.cost+'</span>') : '<span class="cost free">no cost</span>';
    main+='<div class="opt'+(afford?'':' disabled')+'" style="animation-delay:'+(i*0.07).toFixed(2)+'s"'+(afford?(' onclick="choose('+i+')"'):'')+'>'+
      '<div class="lbl">'+costTxt+o.lbl+'<span class="tag '+o.tag+'">'+tagName(o.tag)+'</span></div>'+
      '<div class="det">'+o.det+'</div>'+
      '<div class="nb">Not enough budget — this needs '+o.cost+', you have '+Math.round(state.budget)+'.</div>'+
      '<div class="teaches"><strong>Teaches:</strong> '+o.teaches+'</div>'+
      '<div class="fx">'+fxText(o)+'</div>'+
    '</div>';
  }
  updateDashboard();
  swapMain(main);
}

function tagName(t){return t==="build"?"builds real quality":t==="optics"?"protects appearances":t==="wait"?"defers":"reactive";}
function fxText(o){
  function fmt(obj,labels){var parts=[];for(var k in obj){if(!obj.hasOwnProperty(k))continue;var v=obj[k];parts.push((labels[k]||k)+" "+(v>0?"+":"")+v);}return parts.join(", ");}
  var visL={patientSafety:"safety",processControl:"process",financialHealth:"finance",staffTrust:"staff",surgeonBuyin:"surgeons",accreditation:"accred",insurerTrust:"insurer",reputation:"reputation"};
  var hidL={trueRisk:"TRUE risk",qualityDebt:"hidden risk",reportedRate:"reported %",copq:"COPQ ₹L"};
  return "<strong>Cost:</strong> "+o.cost+" &nbsp;|&nbsp; <strong>Visible:</strong> "+(fmt(o.v,visL)||"—")+" &nbsp;|&nbsp; <strong>Hidden:</strong> "+(fmt(o.h,hidL)||"—");
}

function choose(i){
  var d=DECISIONS[decisionIndex];
  var o=d.options[i];
  if(o.cost>state.budget){ return; }
  state.budget-=o.cost;
  applyDelta(o.v); applyDelta(o.h);
  chosen.push({id:d.id,tag:o.tag,lbl:o.lbl,teaches:o.teaches});
  recordHistory();
  updateDashboard();
  renderConsequence(o);
}

function movedHTML(o){
  var visL={patientSafety:"Patient safety",processControl:"Process control",financialHealth:"Finance",staffTrust:"Staff trust",surgeonBuyin:"Surgeon buy-in",accreditation:"Accreditation",insurerTrust:"Insurer trust",reputation:"Reputation"};
  var parts=[];
  for(var k in o.v){ if(!o.v.hasOwnProperty(k)) continue; var v=o.v[k];
    parts.push('<span class="'+(v>0?'up':'down')+'">'+(v>0?'▲':'▼')+' '+(visL[k]||k)+'</span>'); }
  if(o.cost>0){ parts.unshift('<span class="down">−'+o.cost+' budget</span>'); }
  return parts.length? '<div class="moved">What moved: '+parts.join(' &nbsp; ')+'</div>' : '';
}

function renderConsequence(o){
  var unease='';
  if(!instructor && (state.qualityDebt>=50 || state.trueRisk>=72)){
    unease='<div class="unease">'+UNEASE[uneaseIdx % UNEASE.length]+'</div>'; uneaseIdx++;
  }
  var main='<div class="panel consequence">'+
    '<div class="progress" style="color:var(--accent2)">What happened</div>'+
    '<p class="context">'+o.result+'</p>'+
    movedHTML(o)+
    unease+
    '<button class="btn alt" onclick="afterConsequence()">Continue</button>'+
    '</div>';
  swapMain(main);
}

function afterConsequence(){
  var triggered=null;
  for(var e=0;e<EVENTS.length;e++){
    var ev=EVENTS[e];
    if(firedEvents.indexOf(ev.id)===-1 && ev.when(state)){ triggered=ev; firedEvents.push(ev.id); break; }
  }
  if(triggered){ renderEvent(triggered); return; }
  advance();
}

function advance(){
  decisionIndex++;
  if(decisionIndex>=DECISIONS.length){ renderResults(); }
  else { renderDecision(); }
}

function renderEvent(ev){
  applyDelta(ev.apply);
  recordHistory();
  updateDashboard();
  var main='<div class="panel event">'+
    '<div class="progress" style="color:var(--warn)">The reckoning</div>'+
    '<h2>'+ev.title+'</h2>'+
    '<p class="context">'+ev.body+'</p>'+
    '<div class="opt" style="cursor:default;animation-delay:.05s"><div class="teaches" style="display:block"><strong>Teaches:</strong> '+ev.teaches+'</div></div>'+
    '<button class="btn" onclick="advance()">Continue</button>'+
    '</div>';
  swapMain(main);
}

/* ------------------------------------------------------------------ */
/* RESULTS                                                            */
/* ------------------------------------------------------------------ */
function computeScore(){
  var stake=(state.financialHealth+state.staffTrust+state.surgeonBuyin+state.accreditation+state.insurerTrust+state.reputation)/6;
  var raw = 0.30*state.patientSafety + 0.20*state.processControl + 0.25*(100-state.trueRisk) + 0.15*(100-state.qualityDebt) + 0.10*stake;
  var penalty = Math.min(20, state.copq/10);
  return Math.round(clamp(raw-penalty,0,100));
}
function countTag(t){var n=0;for(var i=0;i<chosen.length;i++)if(chosen[i].tag===t)n++;return n;}
function archetype(){
  var t={build:0,optics:0,wait:0};
  for(var i=0;i<chosen.length;i++){ t[chosen[i].tag]=(t[chosen[i].tag]||0)+1; }
  if(firedEvents.length>=2) return ["Firefighter","You spent the back half of the case putting out fires that earlier shortcuts had started. Reactive quality is the most expensive kind."];
  if(t.build>=6 && state.trueRisk<45 && state.qualityDebt<40) return ["System Builder","You spent your limited budget where it mattered and paid for prevention early. The dashboard wobbled, but the hospital is genuinely safer."];
  if(t.optics>=4 || (state.reputation>=68 && state.trueRisk>=58)) return ["Optics Manager","You kept the board comfortable, but the gap between the reported number and the true risk is large. This is the cautionary path the case is built to expose."];
  if(t.wait>=3) return ["Waiter","You waited for the system to change around you. Little broke, but little improved, and the underlying risk is still there."];
  return ["Balanced Reformer","You traded across competing pressures and made real, if uneven, progress on the underlying risk."];
}

/* Estimated true infection rate (%), so it is directly comparable to the
   reported rate. The 0-100 risk index maps onto a 0-12% rate scale. */
function trueRatePct(s){ return clamp(s.trueRisk*0.12, 0, 12); }

/* Inline SVG line chart: reported rate (teal) vs estimated true rate (red),
   both as percentages on one shared axis. */
function chartSVG(){
  var n=histLog.length; if(n<2) return "";
  var W=600,H=240,padL=54,padR=72,padT=18,padB=34;
  var xw=W-padL-padR, yh=H-padT-padB;
  var MAX=12; // infection-rate axis, in percent
  function X(i){ return padL + xw*(i/(n-1)); }
  function Y(v){ return padT + yh*(1-clamp(v,0,MAX)/MAX); }
  var tp=[], rp=[];
  for(var i=0;i<n;i++){
    tp.push(X(i).toFixed(1)+','+Y(trueRatePct(histLog[i])).toFixed(1));
    rp.push(X(i).toFixed(1)+','+Y(histLog[i].reported).toFixed(1));
  }
  var grid='';
  for(var g=0;g<=MAX;g+=3){
    var y=padT+yh*(1-g/MAX);
    grid+='<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+y.toFixed(1)+'" stroke="#ece5d8" stroke-width="1"/>';
    grid+='<text x="'+(padL-8)+'" y="'+(y+3.5).toFixed(1)+'" font-family="Arial" font-size="10" fill="#6b6258" text-anchor="end">'+g+'%</text>';
  }
  var endR=histLog[n-1].reported, endT=trueRatePct(histLog[n-1]);
  var svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="Reported infection rate versus estimated true infection rate over the ten decisions, both shown as percentages">'+
    grid+
    '<line x1="'+padL+'" y1="'+padT+'" x2="'+padL+'" y2="'+(padT+yh)+'" stroke="#bcae99" stroke-width="1"/>'+
    '<line x1="'+padL+'" y1="'+(padT+yh)+'" x2="'+(W-padR)+'" y2="'+(padT+yh)+'" stroke="#bcae99" stroke-width="1"/>'+
    '<polyline class="chart-line" fill="none" stroke="var(--accent2)" stroke-width="3" stroke-linejoin="round" points="'+rp.join(' ')+'"/>'+
    '<polyline class="chart-line" fill="none" stroke="var(--warn)" stroke-width="3" stroke-linejoin="round" stroke-dasharray="6 4" points="'+tp.join(' ')+'"/>'+
    '<circle cx="'+X(n-1).toFixed(1)+'" cy="'+Y(endR).toFixed(1)+'" r="4" fill="var(--accent2)"/>'+
    '<circle cx="'+X(n-1).toFixed(1)+'" cy="'+Y(endT).toFixed(1)+'" r="4" fill="var(--warn)"/>'+
    '<text x="'+(W-padR+6)+'" y="'+(Y(endR)+4).toFixed(1)+'" font-family="Arial" font-size="11" fill="var(--accent2)">'+endR.toFixed(1)+'%</text>'+
    '<text x="'+(W-padR+6)+'" y="'+(Y(endT)+4).toFixed(1)+'" font-family="Arial" font-size="11" fill="var(--warn)">'+endT.toFixed(1)+'%</text>'+
    '<text x="'+padL+'" y="'+(H-8)+'" font-family="Arial" font-size="10" fill="#6b6258">first decision</text>'+
    '<text x="'+(W-padR)+'" y="'+(H-8)+'" font-family="Arial" font-size="10" fill="#6b6258" text-anchor="end">board recommendation</text>'+
    '</svg>';
  return svg;
}

function renderResults(){
  var score=computeScore();
  var arc=archetype();
  var who=playerName?playerName:"The Office of the COO";
  var spent=START_BUDGET-Math.round(state.budget);

  var chart='<div class="chartbox"><h3 style="margin-bottom:8px">How it looked vs. how it really was</h3>'+
    chartSVG()+
    '<div style="margin-top:6px"><span class="lg"><i style="background:var(--accent2)"></i>Reported infection rate (the board saw)</span>'+
      '<span class="lg"><i style="background:var(--warn)"></i>Estimated true infection rate (hidden)</span></div>'+
    '<div class="cap">Both lines are infection rates, shown as percentages. During play, students saw only the teal line — the rate the hospital reported. The red line is the estimated true rate it was actually carrying. The distance between them is the lesson of the case; good play closes the gap.</div></div>';

  var reveal='<div class="reveal">'+
    '<div class="card2"><div class="small">What the board saw</div><div class="num">'+state.reportedRate.toFixed(1)+'%</div><div class="small">reported rate (≈'+per1000(state.reportedRate)+' per 1,000 surgeries)</div></div>'+
    '<div class="card2"><div class="small">What was actually true</div><div class="num">'+trueRatePct(state).toFixed(1)+'%</div><div class="small">true rate (≈'+per1000(trueRatePct(state))+' per 1,000 surgeries)</div></div>'+
    '<div class="card2 gap"><div class="small">Went uncounted</div><div class="num">≈'+uncountedPer1000(state)+'</div><div class="small">infections per 1,000 surgeries the board never recorded</div></div>'+
    '<div class="card2"><div class="small">Cost of Poor Quality</div><div class="num">₹'+Math.round(state.copq)+'L</div><div class="small">avoidable cost this cycle</div></div>'+
  '</div>';

  var seen={},debrief='';
  for(var i=0;i<chosen.length;i++){var c=chosen[i];if(seen[c.teaches])continue;seen[c.teaches]=1;
    debrief+='<li><strong>'+DECISIONS[i].title+':</strong> '+c.teaches+'</li>';}

  var main='<div class="panel">'+
      '<div class="progress">Debrief</div>'+
      '<h2>The reckoning: how it looked vs. how it really was</h2>'+
      '<p class="context">This is the heart of <em>The Infected Margin</em>. The board was managing the number on the left. The hospital was actually carrying the risk on the right. The failure here was built into the system — not the fault of any one person.</p>'+
      chart+
      reveal+
      '<div class="big"><div class="stat"><b>'+score+'</b><span>Quality score / 100</span></div>'+
        '<div class="stat"><b>'+firedEvents.length+'</b><span>crises triggered</span></div>'+
        '<div class="stat"><b>'+countTag('build')+'</b><span>build-quality choices</span></div>'+
        '<div class="stat"><b>'+spent+'/'+START_BUDGET+'</b><span>budget spent</span></div></div>'+
      '<div class="archetype"><strong>Your archetype: '+arc[0]+'</strong></div>'+
      '<p>'+arc[1]+'</p>'+
    '</div>'+
    '<div class="panel"><h3>Recommendation memo to the board</h3>'+boardMemo(score,arc,who)+
       '<button class="btn alt no-print" onclick="window.print()">Print / Save as PDF</button> '+
       '<button class="btn no-print" onclick="renderIntro()">Play again</button></div>'+
    '<div class="panel"><h3>What this taught — the ideas behind your choices</h3><ul class="debrief">'+debrief+'</ul></div>'+
    facultyDebrief(score,arc,spent);

  if(document.body.classList && document.body.classList.add){ document.body.classList.add('reveal-end'); }
  updateDashboard();
  swapMain(main);
}

function boardMemo(score,arc,who){
  var risky = state.trueRisk>=55, debt = state.qualityDebt>=55, honest = state.reportedRate>=1.8;
  var lines=[
    "To: The Board of Pinnacle Hospitals Ltd.",
    "From: "+who+", Office of the Chief Operating Officer",
    "Re: Surgical infections — recommendation following this case"
  ];
  var body="";
  body += honest
    ? "We have started counting our infections honestly. Our reported rate has risen to "+state.reportedRate.toFixed(1)+"% — not because the hospital became less safe, but because we stopped looking away. "
    : "Our reported rate stands at "+state.reportedRate.toFixed(1)+"%. ";
  body += risky
    ? "The board should know our real exposure is still high: the underlying risk is not yet under control"+(debt?", and we are carrying a large amount of hidden risk that will surface if it stays unfunded. ":". ")
    : "The underlying risk has been reduced substantially through the decisions taken this cycle. ";
  body += (arc[0]==="System Builder")
    ? "I recommend we keep funding prevention as an investment, hold to honest measurement, and press insurers, inspectors and the regulator to change the rules for the whole industry, so that doing the right thing is not a competitive penalty."
    : (arc[0]==="Optics Manager")
    ? "I must caution the board that our public position is stronger than our clinical reality, and recommend we close that gap before an outside event closes it for us."
    : (arc[0]==="Firefighter")
    ? "Recent events have shown the cost of putting prevention off. I recommend we move decisively from crisis response to systematic infection control."
    : "I recommend a phased programme of honest measurement and targeted prevention, sequenced to protect both patients and the institution.";
  body += " Cost of Poor Quality recognised this cycle: about ₹"+Math.round(state.copq)+" lakh.";
  var out='<div class="memo">';
  for(var i=0;i<lines.length;i++){ out+='<div>'+lines[i]+'</div>'; }
  out+='<p style="margin-top:10px">'+body+'</p></div>';
  return out;
}

function facultyDebrief(score,arc,spent){
  return '<div class="facu"><h3>Facilitation guide (instructor view)</h3>'+
    '<p class="small">Tie the student’s play back to the teaching-note learning objectives:</p>'+
    '<ul class="kvs">'+
      '<li><strong>Cost of Poor Quality (LO1).</strong> Where did COPQ build up, and who paid for it — the hospital, the insurer, or the patient? Link to why the normal pressure to fix quality is missing here.</li>'+
      '<li><strong>Principal-agent (LO2).</strong> Where did the recording, surgeon-governance and finance choices let the person doing the work control the count? Why are self-reporting and occasional audits not enough?</li>'+
      '<li><strong>Process control points (LO3).</strong> Map the recording, scheduling, antibiotic-timing, sterilisation and follow-up decisions onto the steps where an infection can be prevented or missed.</li>'+
      '<li><strong>Constrained prioritisation (LO4).</strong> This player spent '+spent+' of '+START_BUDGET+' budget. Which fixes did they buy, which did they skip, and was that the highest-leverage use of limited capital?</li>'+
      '<li><strong>Global models &amp; convergence (LO5–6).</strong> Did the final recommendation reach for honest measurement plus industry-wide change, or lean on appearances?</li>'+
    '</ul>'+
    '<p class="small"><strong>Opening question for the room:</strong> “Who here made the reported number look good — and what did it cost them when the truth came out?” Then put two end-charts side by side: an appearance-led run and a build-led run.</p>'+
    '<p class="small">This run: '+score+'/100, archetype “'+arc[0]+'”, '+firedEvents.length+' crisis event(s), budget spent '+spent+'/'+START_BUDGET+'. Reported rate '+state.reportedRate.toFixed(1)+'% vs estimated true rate '+trueRatePct(state).toFixed(1)+'% (risk index '+Math.round(state.trueRisk)+').</p>'+
  '</div>';
}

/* ------------------------------------------------------------------ */
/* INSTRUCTOR TOGGLE                                                  */
/* ------------------------------------------------------------------ */
/* ---- instructor password gate ---------------------------------------
   The password is not stored in this file; only a hash of it is.
   To change it: open this page, open the browser console, run
       qupHash('your new password')
   and paste the 16-character result into INSTRUCTOR_HASH below.
   Passwords are compared case-insensitively and trimmed of spaces.

   Note this is a client-side gate. It stops a student casually flipping
   the toggle; it is not a security control, since anyone who reads the
   page source can see how it works. If stronger separation is needed,
   distribute a separate instructor build with the teaching note.
--------------------------------------------------------------------- */
var INSTRUCTOR_HASH = "967660cd01daa900";   /* default: see TN 7.5 */
var instructorUnlocked = false;

function qupHash(s){
  s=String(s).trim().toLowerCase();
  var t="qup:om-hc-2025-04:"+s, h1=0x811c9dc5, h2=0x01000193, i, c, r;
  for(i=0;i<t.length;i++){
    c=t.charCodeAt(i);
    h1^=c; h1=(h1*16777619)>>>0;
    h2=((h2^c)*2246822519)>>>0; h2=((h2<<13)|(h2>>>19))>>>0;
  }
  for(r=0;r<512;r++){
    h1=((h1^(h2+r))*16777619)>>>0;
    h2=((h2^(h1+r))*2246822519)>>>0;
  }
  return ("00000000"+h1.toString(16)).slice(-8)+("00000000"+h2.toString(16)).slice(-8);
}

function applyInstructor(on){
  instructor=!!on;
  document.body.classList.toggle('instructor',instructor);
  var b=el("instrToggle");
  if(b){ b.textContent="Instructor view: "+(instructor?"on":"off"); b.classList.toggle('on',instructor); }
}

function openLock(){
  var m=el("lockMask"), p=el("lockPass"), e=el("lockErr");
  if(!m) return;
  if(p){ p.value=""; }
  if(e){ e.className="lockerr"; }
  m.className="lockmask show";
  if(p){ setTimeout(function(){ p.focus(); },30); }
}
function closeLock(){
  var m=el("lockMask"); if(m){ m.className="lockmask"; }
}
function submitLock(){
  var p=el("lockPass"), e=el("lockErr");
  var val=p?p.value:"";
  if(qupHash(val)===INSTRUCTOR_HASH){
    instructorUnlocked=true;
    try{ if(window.sessionStorage){ sessionStorage.setItem("qup_instr","1"); } }catch(err){}
    closeLock();
    applyInstructor(true);
  } else {
    if(e){ e.className="lockerr show"; }
    if(p){ p.value=""; p.focus(); }
  }
}

function toggleInstructor(){
  if(instructor){ applyInstructor(false); return; }      /* switching off never asks */
  if(instructorUnlocked){ applyInstructor(true); return; } /* already unlocked this session */
  openLock();
}

/* restore unlock within the same browser session */
try{
  if(window.sessionStorage && sessionStorage.getItem("qup_instr")==="1"){ instructorUnlocked=true; }
}catch(err){}

/* Enter submits, Escape closes, while the dialog is open */
document.addEventListener('keydown',function(e){
  var m=el("lockMask");
  if(!m || m.className.indexOf('show')<0) return;
  if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); submitLock(); }
  else if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeLock(); }
},true);

/* keyboard: 1/2/3 to choose, Enter to continue */
document.addEventListener('keydown',function(e){
  var lk=el("lockMask");
  if(lk && lk.className.indexOf('show')>=0) return;   /* dialog has focus */
  var m=el("main"); if(!m) return;
  if(e.key==='1'||e.key==='2'||e.key==='3'){
    var opts=m.querySelectorAll('.opt[onclick]');
    var idx=parseInt(e.key,10)-1;
    if(opts[idx]){ opts[idx].click(); }
  } else if(e.key==='Enter'){
    var btn=m.querySelector('.btn.alt, .btn');
    if(btn){ btn.click(); }
  }
});

/* boot */
renderIntro();
