import { createClient } from "@supabase/supabase-js";

(function(){
      "use strict";
      var supabaseUrl=import.meta.env.VITE_SUPABASE_URL;
      var supabaseKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      var supabase=supabaseUrl&&supabaseKey?createClient(supabaseUrl,supabaseKey):null;
      var activeUserId=null,openToken=0,saveVersion=0,unsynced=false,syncQueue=Promise.resolve();
      var otpCooldownKey="mystic-blessings-otp-cooldown-until",otpCooldownUntil=0,otpSending=false,passwordSending=false;
      try{otpCooldownUntil=Math.min(Number(localStorage.getItem(otpCooldownKey))||0,Date.now()+300000);}catch(e){}
      var defaultEvent={eventDate:"",eventFormat:"In person",venue:"",tarotFormat:"Group reflection",ticketPrice:"",expectedGuests:"15",venueCost:"",materialsPerGuest:"",fixedCosts:"",desiredEarnings:""};
      var defaultTasks=[
        {id:"event-date",title:"Choose two dates and confirm the event format",due:"2026-10-31",priority:"high",category:"Christmas event",note:"Decide in person or online, and choose group or individual tarot.",done:false},
        {id:"event-venue",title:"Confirm venue or online platform for up to 25 guests",due:"2026-11-07",priority:"high",category:"Christmas event",note:"Check space, seating, sound bath setup, and accessibility.",done:false},
        {id:"event-price",title:"List costs and set the ticket price",due:"2026-11-07",priority:"high",category:"Christmas event",note:"Use a realistic minimum turnout, not a full 25 seats.",done:false},
        {id:"event-booking",title:"Set your WhatsApp and QR payment booking steps",due:"2026-11-07",priority:"high",category:"Christmas event",note:"Enquiry → details → QR → verify payment → confirm place.",done:false},
        {id:"event-launch",title:"Write announcement and open bookings",due:"2026-11-14",priority:"high",category:"Christmas event",note:"Include only confirmed date, venue, format, and price.",done:false},
        {id:"event-check",title:"Review paid places and answer open enquiries",due:"2026-11-28",priority:"medium",category:"Christmas event",note:"Check whether the event needs another round of promotion.",done:false},
        {id:"event-run",title:"Prepare scripts, materials, and sound setup",due:"2026-12-07",priority:"high",category:"Christmas event",note:"Meditation, tarot reflection, sound bath, and manifesting activity.",done:false},
        {id:"event-reminder",title:"Check guest list and prepare attendee reminder",due:"2026-12-10",priority:"high",category:"Christmas event",note:"Adjust this target when the event date is fixed.",done:false}
      ];
      var state=blankState();
      var currentView="overview";
      function cloneDefaults(){return defaultTasks.map(function(t){return Object.assign({},t);});}
      function blankState(){return{clients:[],tasks:cloneDefaults(),event:Object.assign({},defaultEvent)};}
      function syncLabel(message,error){var e=qs("#syncStatus");e.textContent=message;e.classList.toggle("error",!!error);qs("#retrySyncBtn").style.display=error?"inline-block":"none";}
      function persist(){
        if(!activeUserId)return;
        var userId=activeUserId,version=++saveVersion,payload=JSON.parse(JSON.stringify(state));
        unsynced=true;syncLabel("Saving…");
        syncQueue=syncQueue.catch(function(){}).then(async function(){
          if(activeUserId!==userId)return;
          var result=await supabase.from("workspaces").upsert({owner_id:userId,payload:payload,updated_at:new Date().toISOString()},{onConflict:"owner_id"});
          if(result.error)throw result.error;
          if(activeUserId===userId&&version===saveVersion){unsynced=false;syncLabel("Saved");}
        }).catch(function(){if(activeUserId===userId&&version===saveVersion){syncLabel("Save failed · retry",true);toast("Could not save. Your changes are still open; retry before leaving.");}});
      }
      function save(){render();persist();}
      function authMessage(message,error){var e=qs("#authMessage");e.textContent=message;e.classList.toggle("error",!!error);}
      function updateAuthButtons(){
        var linkButton=qs("#otpButton"),passwordButton=qs("#passwordSignInBtn"),seconds=Math.max(0,Math.ceil((otpCooldownUntil-Date.now())/1000));
        linkButton.disabled=otpSending||passwordSending||seconds>0;
        linkButton.textContent=otpSending?"Sending…":seconds>0?"Try email link again in "+seconds+"s":"Email me a sign-in link";
        passwordButton.disabled=passwordSending||otpSending;
        passwordButton.textContent=passwordSending?"Signing in…":"Sign in";
        clearTimeout(updateAuthButtons.timer);
        if(seconds>0)updateAuthButtons.timer=setTimeout(updateAuthButtons,1000);
      }
      function setOtpCooldown(seconds){
        otpCooldownUntil=Date.now()+seconds*1000;
        try{localStorage.setItem(otpCooldownKey,String(otpCooldownUntil));}catch(e){}
        updateAuthButtons();
      }
      function showGate(){qs("#app").hidden=true;qs("#authGate").hidden=false;authMessage("Enter your email and password to sign in.");}
      async function openSession(session){
        if(!session||!session.user){activeUserId=null;state=blankState();showGate();return;}
        var userId=session.user.id;
        if(activeUserId===userId&&!qs("#app").hidden)return;
        var token=++openToken;
        activeUserId=userId;qs("#app").hidden=true;qs("#authGate").hidden=false;authMessage("Loading your workspace…");
        var result=await supabase.from("workspaces").select("payload").eq("owner_id",userId).maybeSingle();
        if(token!==openToken||activeUserId!==userId)return;
        if(result.error){activeUserId=null;authMessage("Could not load your workspace. Refresh to try again.",true);return;}
        if(result.data){
          var data=result.data.payload;
          if(!data||!Array.isArray(data.clients)||!Array.isArray(data.tasks)){activeUserId=null;authMessage("Your saved data needs attention. Please contact support before editing.",true);return;}
          state={clients:data.clients,tasks:data.tasks,event:cleanEvent(data.event)};
        }else{
          state=blankState();
          var created=await supabase.from("workspaces").insert({owner_id:userId,payload:state});
          if(token!==openToken||activeUserId!==userId)return;
          if(created.error){activeUserId=null;authMessage("Could not set up your workspace. Refresh to try again.",true);return;}
        }
        hydrateEventForm();render();switchView(currentView);unsynced=false;syncLabel("Saved");
        qs("#authGate").hidden=true;qs("#app").hidden=false;
      }
      function qs(s){return document.querySelector(s);}
      function make(tag,cls,content){var e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e;}
      function action(label,cls,fn){var b=make("button","btn "+(cls||""),label);b.type="button";b.addEventListener("click",fn);return b;}
      function todayISO(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
      function dayDiff(iso){if(!iso)return Infinity;var t=new Date(todayISO()+"T12:00:00");var d=new Date(iso+"T12:00:00");return Math.round((d-t)/86400000);}
      function niceDate(iso){if(!iso)return "No date set";var d=new Date(iso+"T12:00:00");return isNaN(d)?"No date set":d.toLocaleDateString("en-MY",{day:"numeric",month:"short",year:"numeric"});}
      function ringgit(value){return "RM "+Number(value).toLocaleString("en-MY",{maximumFractionDigits:0});}
      function amount(value){var n=Number(value);return Number.isFinite(n)&&n>=0?n:0;}
      function cleanEvent(raw){var e=Object.assign({},defaultEvent),source=raw&&typeof raw==="object"?raw:{};Object.keys(e).forEach(function(k){if(source[k]!==undefined)e[k]=String(source[k]).slice(0,120);});if(!/^\d{4}-\d{2}-\d{2}$/.test(e.eventDate))e.eventDate="";if(!["In person","Online"].includes(e.eventFormat))e.eventFormat="In person";if(!["Group reflection","Individual mini readings"].includes(e.tarotFormat))e.tarotFormat="Group reflection";e.expectedGuests=String(Math.max(1,Math.min(25,Math.round(amount(e.expectedGuests)||15))));["ticketPrice","venueCost","materialsPerGuest","fixedCosts","desiredEarnings"].forEach(function(k){e[k]=e[k]===""?"":String(amount(e[k]));});return e;}
      function hydrateEventForm(){var f=qs("#eventDetailsForm");Object.keys(defaultEvent).forEach(function(key){if(f.elements[key])f.elements[key].value=state.event[key]===undefined?defaultEvent[key]:state.event[key];});calculatePrice();}
      function calculatePrice(){var f=qs("#eventDetailsForm"),guests=Math.max(1,Math.min(25,Math.round(amount(f.elements.expectedGuests.value)||15))),hasCosts=["venueCost","materialsPerGuest","fixedCosts"].some(function(k){return f.elements[k].value!=="";}),cost=amount(f.elements.venueCost.value)+amount(f.elements.fixedCosts.value)+amount(f.elements.materialsPerGuest.value)*guests,earnings=amount(f.elements.desiredEarnings.value),ticket=amount(f.elements.ticketPrice.value);qs("#estimatedCost").textContent=hasCosts?ringgit(Math.ceil(cost)):"Add costs";qs("#breakEven").textContent=hasCosts?ringgit(Math.ceil(cost/guests)):"Add costs";qs("#targetPrice").textContent=hasCosts?ringgit(Math.ceil((cost+earnings)/guests)):"Add costs";qs("#pricingNote").textContent=guests+" expected paid guests is a planning assumption; maximum capacity is 25. "+(ticket&&hasCosts?"At "+ringgit(ticket)+" per ticket, estimated remainder after entered costs is "+ringgit(Math.round(ticket*guests-cost))+". ":"")+"Include payment fees in fixed costs if applicable.";}
      function statusLabel(s){return({"new":"New enquiry","details-sent":"Details sent","awaiting-payment":"Awaiting payment","confirmed":"Confirmed","completed":"Completed"})[s]||"New enquiry";}
      function toast(message){var e=qs("#toast");e.textContent=message;e.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(function(){e.classList.remove("show");},3000);}
      function switchView(id){currentView=id;document.querySelectorAll(".view").forEach(function(e){e.classList.toggle("active",e.id===id);});document.querySelectorAll("[data-view]").forEach(function(e){e.classList.toggle("active",e.dataset.view===id);if(e.dataset.view===id)e.setAttribute("aria-current","page");else e.removeAttribute("aria-current");});window.scrollTo({top:0,behavior:"smooth"});}
      function priorities(){
        var items=[];
        state.clients.forEach(function(c){
          var due=dayDiff(c.followUp);
          if(c.status==="new")items.push({title:"Reply to "+c.name,detail:c.service+" · New WhatsApp enquiry",view:"clients",score:110});
          else if(c.status==="awaiting-payment")items.push({title:"Check payment for "+c.name,detail:"Confirm only when payment is verified",view:"clients",score:95});
          else if(c.status==="confirmed"&&dayDiff(c.sessionDate)>=0&&dayDiff(c.sessionDate)<=2)items.push({title:"Send "+c.name+" an appointment reminder",detail:"Session "+niceDate(c.sessionDate),view:"clients",score:90});
          if(due<=0&&c.status!=="new"&&c.status!=="awaiting-payment")items.push({title:"Follow up with "+c.name,detail:c.service+" · Follow-up due "+niceDate(c.followUp),view:"clients",score:85});
        });
        state.tasks.filter(function(t){return!t.done;}).forEach(function(t){var diff=dayDiff(t.due);items.push({title:t.title,detail:t.category+" · "+(diff<0?"Overdue "+niceDate(t.due):diff===0?"Due today":t.due?"Due "+niceDate(t.due):"No due date"),view:"events",score:(diff<0?85:diff<=7?75:35)+(t.priority==="high"?10:0)});});
        return items.sort(function(a,b){return b.score-a.score;});
      }
      function renderOverview(){
        qs("#todayLabel").textContent=new Date().toLocaleDateString("en-MY",{weekday:"long",day:"numeric",month:"long"});
        qs("#newCount").textContent=state.clients.filter(function(c){return c.status==="new";}).length;
        qs("#paymentCount").textContent=state.clients.filter(function(c){return c.status==="awaiting-payment";}).length;
        qs("#confirmedCount").textContent=state.clients.filter(function(c){return c.status==="confirmed";}).length;
        qs("#dueCount").textContent=state.tasks.filter(function(t){return!t.done&&dayDiff(t.due)<=7;}).length;
        var items=priorities(),first=items[0];
        qs("#focusTitle").textContent=first?first.title:"You’re clear for now";
        qs("#focusText").textContent=first?first.detail+" · Open it and take the next small step.":"Add a client enquiry or your next event task when it comes in.";
        qs("#focusButton").textContent=first?"Open "+(first.view==="clients"?"client desk":"tasks")+" →":"Open client desk →";
        qs("#focusButton").onclick=function(){switchView(first?first.view:"clients");};
        var list=qs("#priorityList");list.replaceChildren();
        if(!items.length){var empty=make("div","empty");empty.append(make("h3","","Nothing urgent right now."),make("p","","Enjoy the breathing room, Lynn."));list.append(empty);}
        items.slice(0,5).forEach(function(p){var row=make("div","item"),dot=make("span","dot"+(p.detail.indexOf("Overdue")>=0?" red":"")),body=make("div","item-body"),small=make("small","",p.detail);body.append(make("strong","",p.title),small);row.append(dot,body,action("Open","btn-small",function(){switchView(p.view);}));list.append(row);});
        var eventTasks=state.tasks.filter(function(t){return t.category==="Christmas event";}),complete=eventTasks.filter(function(t){return t.done;}).length;
        qs("#eventProgress").style.width=(eventTasks.length?Math.round(complete/eventTasks.length*100):0)+"%";
        qs("#eventProgressText").textContent=complete+" of "+eventTasks.length+" planning tasks complete";
        qs("#eventDateTag").textContent=state.event.eventDate?niceDate(state.event.eventDate):"Mid-Dec 2026";
        qs("#eventOverviewText").textContent="Tarot reflection · Meditation · Short sound bath · Manifesting\nUp to 25 guests · "+(state.event.ticketPrice?ringgit(state.event.ticketPrice):"Price to confirm")+" · "+(state.event.venue||"Venue to confirm");
      }
      function renderEventSummary(){var e=state.event;qs("#eventNotice").textContent="Christmas event: "+(e.eventDate?niceDate(e.eventDate):"mid-December 2026, exact date to confirm")+" · Maximum 25 guests · "+(e.ticketPrice?"Ticket "+ringgit(e.ticketPrice):"Ticket price to confirm")+" · "+(e.venue||"Venue or platform to confirm")+". Planning task dates are suggested targets.";}
      function clientMessage(c){
        var name=c.name,service=c.service.toLowerCase();
        if(c.status==="new")return "Hi "+name+"! Thanks for reaching out to Mystic Blessings. I’d be happy to talk about "+service+". What’s been on your mind, and what would you hope to get from a session? I’ll share the practical details once I know what fits you best. ✨";
        if(c.status==="details-sent")return "Hi "+name+"! Just checking in after the "+service+" details I sent. Is there anything you’d like me to clarify before you decide? No pressure — happy to help you work out what feels useful.";
        if(c.status==="awaiting-payment")return "Hi "+name+"! Just checking whether you had a chance to look at the payment details for your "+service+" session. Once I’ve checked the payment, I’ll confirm your booking. Let me know if you have any questions.";
        if(c.status==="confirmed")return "Hi "+name+"! A friendly reminder about your "+service+" session"+(c.sessionDate?" on "+niceDate(c.sessionDate):"")+". Let me know if there’s anything you’d like me to know beforehand. See you soon! ✨";
        return "Hi "+name+"! I hope you’ve been well since our "+service+" session. What’s one small, practical step you’ve taken from what we discussed? I’d love to hear how you’re doing.";
      }
      function renderClients(){
        var list=qs("#clientList");list.replaceChildren();
        qs("#clientSummary").textContent=state.clients.length?state.clients.length+" conversation"+(state.clients.length===1?"":"s")+" tracked.":"No clients added yet.";
        if(!state.clients.length){var empty=make("div","empty");empty.append(make("h3","","Your client desk is ready."),make("p","","Add your next WhatsApp enquiry and this space will help you keep it moving."));list.append(empty);return;}
        state.clients.slice().sort(function(a,b){return(b.created||"").localeCompare(a.created||"");}).forEach(function(c){
          var row=make("article","record"),left=make("div"),meta=make("div","meta"),title=make("h3","",c.name),info=make("p","",c.service+(c.sessionDate?" · Session "+niceDate(c.sessionDate):"")+(c.followUp?" · Follow up "+niceDate(c.followUp):""));
          var tag=make("span","tag"+(c.status==="awaiting-payment"?" warm":c.status==="new"?" rose":""),statusLabel(c.status));meta.append(tag);if(c.phone)meta.append(make("span","subtle",c.phone));left.append(meta,title,info);if(c.note)left.append(make("p","",c.note));
          var buttons=make("div","record-actions");
          buttons.append(action("Copy reply","btn-small",function(){copyText(clientMessage(c));}));
          var next=({"new":["Details sent","details-sent"],"details-sent":["QR sent","awaiting-payment"],"awaiting-payment":["Verify payment","confirmed"],"confirmed":["Session complete","completed"]})[c.status];
          if(next)buttons.append(action(next[0],"btn-small btn-primary",function(){
            if(c.status==="awaiting-payment"&&!confirm("Have you checked that "+c.name+"'s payment arrived? Confirm the booking only after verification."))return;
            c.status=next[1];save();toast(statusLabel(c.status)+".");
          }));
          buttons.append(action("Remove","btn-small btn-quiet",function(){if(confirm("Remove "+c.name+" from this tracker?")){state.clients=state.clients.filter(function(x){return x.id!==c.id;});save();toast("Client removed.");}}));
          row.append(left,buttons);list.append(row);
        });
      }
      function renderTasks(){
        var list=qs("#taskList");list.replaceChildren();
        var sorted=state.tasks.slice().sort(function(a,b){return Number(a.done)-Number(b.done)||(a.due||"9999").localeCompare(b.due||"9999")||({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority]);});
        var done=state.tasks.filter(function(t){return t.done;}).length;
        qs("#taskSummary").textContent=done+" of "+state.tasks.length+" complete.";
        if(!sorted.length){var empty=make("div","empty");empty.append(make("h3","","No tasks yet."),make("p","","Add one small next step for your event or business."));list.append(empty);return;}
        sorted.forEach(function(t){
          var row=make("article","record"+(t.done?" task-done":"")),check=make("input","check"),left=make("div"),meta=make("div","meta"),buttons=make("div","record-actions");
          check.type="checkbox";check.checked=!!t.done;check.setAttribute("aria-label","Mark "+t.title+" complete");check.addEventListener("change",function(){t.done=check.checked;save();});
          meta.append(make("span","tag"+(t.priority==="high"?" warm":""),t.category),make("span","subtle",t.due?"Due "+niceDate(t.due):"No due date"));
          left.append(meta,make("h3","",t.title));if(t.note)left.append(make("p","",t.note));
          buttons.append(action("Remove","btn-small btn-quiet",function(){if(confirm("Remove this task?")){state.tasks=state.tasks.filter(function(x){return x.id!==t.id;});save();toast("Task removed.");}}));
          row.append(check,left,buttons);list.append(row);
        });
      }
      var templates=[
        {title:"New enquiry",text:"Hi! Thanks for reaching out to Mystic Blessings. What’s been on your mind, and which service are you interested in — tarot reading, sound healing, or pet communication? I’ll help you find a good next step. ✨"},
        {title:"Booking details",text:"Hi! Here are the details for your session: [service], [date and time], [location or online link], [price]. If that works for you, I’ll send my payment QR through WhatsApp. I’ll confirm the booking after I’ve checked the payment."},
        {title:"Payment QR note",text:"Here’s the QR code for your [service] session. Please send me your payment confirmation and the name for the booking. I’ll check it and then confirm your place. [Attach your QR image before sending.]"},
        {title:"After-session check-in",text:"Hi! I hope you’ve had a little space to reflect since our session. What’s one practical step you’d like to take this week? It can be small — the point is to make it real. ✨"},
        {title:"Christmas event interest",kind:"event"}
      ];
      function eventInvite(){var e=state.event,when=e.eventDate?"on "+niceDate(e.eventDate):"in mid-December",where=e.venue?" at "+e.venue:"",price=e.ticketPrice?" Tickets are "+ringgit(e.ticketPrice)+".":" The ticket price is still being confirmed.";return "Hi! I’m planning a small Mystic Blessings Christmas gathering "+when+where+" with group tarot reflection, meditation, a short sound bath, and a manifesting activity. We’ll have up to 25 guests."+price+" Would you like me to send you the booking details? ✨";}
      function renderTemplates(){var grid=qs("#templateGrid");grid.replaceChildren();templates.forEach(function(t){var card=make("article","template-card"),message=t.kind==="event"?eventInvite():t.text;card.append(make("h3","",t.title),make("p","",message),action("Copy message","btn-small",function(){copyText(message);}));grid.append(card);});}
      function copyText(value){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(function(){toast("Copied. Personalize before sending.");}).catch(function(){copyFallback(value);});}else copyFallback(value);}
      function copyFallback(value){var area=make("textarea");area.value=value;area.style.position="fixed";area.style.left="-9999px";document.body.append(area);area.select();try{document.execCommand("copy");toast("Copied. Personalize before sending.");}catch(e){toast("Copy failed. Please select the text manually.");}area.remove();}
      function render(){renderOverview();renderEventSummary();renderClients();renderTasks();renderTemplates();}
      document.querySelectorAll("[data-view]").forEach(function(b){b.addEventListener("click",function(){switchView(b.dataset.view);});});
      document.querySelectorAll("[data-go]").forEach(function(b){b.addEventListener("click",function(){switchView(b.dataset.go);});});
      qs("#showClientForm").onclick=function(){qs("#clientForm").classList.add("open");qs("#clientForm [name=name]").focus();};
      qs("#cancelClientForm").onclick=function(){qs("#clientForm").reset();qs("#clientForm").classList.remove("open");};
      qs("#clientForm").addEventListener("submit",function(e){e.preventDefault();var f=new FormData(e.target),name=String(f.get("name")||"").trim();if(!name)return;state.clients.push({id:"client-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),name:name.slice(0,80),service:String(f.get("service")||"Other"),phone:String(f.get("phone")||"").trim().slice(0,30),sessionDate:String(f.get("sessionDate")||""),followUp:String(f.get("followUp")||""),note:String(f.get("note")||"").trim().slice(0,500),status:"new",created:new Date().toISOString()});e.target.reset();e.target.classList.remove("open");save();toast("Enquiry saved.");});
      qs("#showTaskForm").onclick=function(){qs("#taskForm").classList.add("open");qs("#taskForm [name=title]").focus();};
      qs("#cancelTaskForm").onclick=function(){qs("#taskForm").reset();qs("#taskForm").classList.remove("open");};
      qs("#taskForm").addEventListener("submit",function(e){e.preventDefault();var f=new FormData(e.target),title=String(f.get("title")||"").trim();if(!title)return;state.tasks.push({id:"task-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),title:title.slice(0,130),due:String(f.get("due")||""),priority:String(f.get("priority")||"medium"),category:String(f.get("category")||"Business operations"),note:String(f.get("note")||"").trim().slice(0,500),done:false});e.target.reset();e.target.classList.remove("open");save();toast("Task saved.");});
      qs("#eventDetailsForm").addEventListener("input",calculatePrice);
      qs("#eventDetailsForm").addEventListener("change",calculatePrice);
      qs("#eventDetailsForm").addEventListener("submit",function(e){
        e.preventDefault();
        var f=new FormData(e.target),next={};
        Object.keys(defaultEvent).forEach(function(key){next[key]=String(f.get(key)||"").trim();});
        next.expectedGuests=String(Math.max(1,Math.min(25,Math.round(amount(next.expectedGuests)||15))));
        next.venue=next.venue.slice(0,120);
        if(next.tarotFormat==="Individual mini readings")toast("For 25 guests, plan extra readers or a longer session.");
        state.event=next;
        save();
        toast("Christmas event details saved.");
      });
      qs("#exportBtn").onclick=function(){var blob=new Blob([JSON.stringify({app:"Mystic Blessings Command Centre",version:2,exportedAt:new Date().toISOString(),clients:state.clients,tasks:state.tasks,event:state.event},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=make("a");a.href=url;a.download="mystic-blessings-backup-"+todayISO()+".json";document.body.append(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);toast("Backup downloaded.");};
      qs("#importBtn").onclick=function(){qs("#importFile").click();};
      qs("#importFile").addEventListener("change",function(e){var file=e.target.files[0];if(!file)return;if(file.size>2000000){toast("That backup is too large.");e.target.value="";return;}file.text().then(function(content){var data=JSON.parse(content);if(!data||!Array.isArray(data.clients)||!Array.isArray(data.tasks))throw Error("Invalid backup");if(!confirm("Replace all current client, task, and event details with this backup?"))return;state={clients:data.clients.filter(function(c){return c&&typeof c.name==="string";}).map(function(c){return{id:String(c.id||"client-"+Math.random()),name:c.name.slice(0,80),service:String(c.service||"Other").slice(0,50),phone:String(c.phone||"").slice(0,30),sessionDate:String(c.sessionDate||"").slice(0,10),followUp:String(c.followUp||"").slice(0,10),note:String(c.note||"").slice(0,500),status:["new","details-sent","awaiting-payment","confirmed","completed"].includes(c.status)?c.status:"new",created:String(c.created||"")};}),tasks:data.tasks.filter(function(t){return t&&typeof t.title==="string";}).map(function(t){return{id:String(t.id||"task-"+Math.random()),title:t.title.slice(0,130),due:String(t.due||"").slice(0,10),priority:["high","medium","low"].includes(t.priority)?t.priority:"medium",category:String(t.category||"Business operations").slice(0,60),note:String(t.note||"").slice(0,500),done:!!t.done};}),event:cleanEvent(data.event)};hydrateEventForm();save();toast("Backup imported.");}).catch(function(){toast("Could not read that backup file.");}).finally(function(){e.target.value="";});});
      qs("#retrySyncBtn").onclick=persist;
      qs("#signOutBtn").onclick=async function(){if(unsynced&&!confirm("Your latest changes have not saved. Sign out anyway?"))return;var result=await supabase.auth.signOut();if(result.error)toast("Could not sign out. Please try again.");};
      qs("#authForm").addEventListener("submit",async function(e){
        e.preventDefault();
        if(!supabase||passwordSending||otpSending)return;
        var email=qs("#authEmail").value.trim(),password=qs("#authPassword").value;
        passwordSending=true;updateAuthButtons();authMessage("Signing in…");
        try{
          var result=await supabase.auth.signInWithPassword({email:email,password:password});
          if(result.error){
            authMessage(result.error.code==="invalid_credentials"?"Email or password did not match. If this user has no password yet, use the email link after the limit resets or set a password in Supabase.":result.error.message,true);
          }else{
            qs("#authPassword").value="";
            authMessage("Opening your workspace…");
          }
        }catch(e){authMessage("Could not reach Supabase. Check your connection and try again.",true);}
        passwordSending=false;updateAuthButtons();
      });
      qs("#otpButton").addEventListener("click",async function(e){
        e.preventDefault();
        if(!supabase||otpSending||passwordSending||Date.now()<otpCooldownUntil||!qs("#authEmail").reportValidity())return;
        var email=qs("#authEmail").value.trim();
        otpSending=true;updateAuthButtons();authMessage("Sending your link…");
        try{
          var result=await supabase.auth.signInWithOtp({email:email,options:{emailRedirectTo:window.location.origin}});
          if(result.error){
            var code=result.error.code||"",limited=result.error.status===429;
            if(limited)setOtpCooldown(code==="over_request_rate_limit"?300:60);
            authMessage(limited?"Supabase has paused sign-in requests. Check your inbox for an earlier link before trying again. If the email quota is exhausted, wait for it to reset or configure custom SMTP."+(code?" Error: "+code:" "):result.error.message,true);
          }else{
            setOtpCooldown(60);
            authMessage("Check your email for the sign-in link. Please use that link before requesting another.");
          }
        }catch(e){authMessage("Could not reach Supabase. Check your connection and try again.",true);}
        otpSending=false;updateAuthButtons();
      });
      window.addEventListener("beforeunload",function(e){if(unsynced){e.preventDefault();e.returnValue="";}});
      updateAuthButtons();
      if(!supabase){authMessage("This site is missing its Supabase configuration.",true);return;}
      supabase.auth.onAuthStateChange(function(event,session){
        if(event==="INITIAL_SESSION"||event==="SIGNED_IN")setTimeout(function(){openSession(session);},0);
        if(event==="SIGNED_OUT"){++openToken;activeUserId=null;unsynced=false;state=blankState();showGate();}
      });
    })();
