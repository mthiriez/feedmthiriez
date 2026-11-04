(function(){
 'use strict';
 var CFG = window.FEED_CONFIG || {};
 var HAS_REMOTE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
 var LS_KEY = 'feed.interactions.v1';
 var LS_SESSION = 'feed.session.v1';
 var state = { items:[], inter:{}, hidden: hiddenRead(), read: readRead(), sig: sigRead(), unreadOnly: true, sort:'pertinence', filter:'Toutes', q:'', favOnly:false, session:null, source:'local', limit:60 };

 function $(s){ return document.querySelector(s); }
 function decodeEnt(s){
  return String(s==null?'':s)
   .replace(/&#x([0-9a-fA-F]+);/g, function(m,h){ var n=parseInt(h,16); return (n>0 && n<=0x10FFFF) ? String.fromCodePoint(n) : m; })
   .replace(/&#(\d+);/g, function(m,d){ var n=parseInt(d,10); return (n>0 && n<=0x10FFFF) ? String.fromCodePoint(n) : m; })
   .replace(/&(amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|ldquo|rdquo|hellip|mdash|ndash|euro|deg|laquo|raquo|eacute|egrave|agrave|ccedil);/g, function(m,n){
     var t={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'\u2019',lsquo:'\u2018',ldquo:'\u201c',rdquo:'\u201d',hellip:'\u2026',mdash:'\u2014',ndash:'\u2013',euro:'\u20ac',deg:'\u00b0',laquo:'\u00ab',raquo:'\u00bb',eacute:'\u00e9',egrave:'\u00e8',agrave:'\u00e0',ccedil:'\u00e7'};
     return t[n] || m;
   });
 }
 function esc(s){ return decodeEnt(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

 /* ---------- stockage ---------- */
 function localRead(){ try { return JSON.parse(localStorage.getItem(LS_KEY)||'{}'); } catch(e){ return {}; } }
 function localWrite(o){ try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch(e){} }
 var LS_HIDDEN = 'feed.hidden.v1';
 var LS_READ = 'feed.read.v1';
 function readRead(){ try { return JSON.parse(localStorage.getItem(LS_READ)||'{}'); } catch(e){ return {}; } }
 function readWrite(o){ try { localStorage.setItem(LS_READ, JSON.stringify(o)); } catch(e){} }
 function hiddenRead(){ try { return JSON.parse(localStorage.getItem(LS_HIDDEN)||'{}'); } catch(e){ return {}; } }
 function hiddenWrite(o){ try { localStorage.setItem(LS_HIDDEN, JSON.stringify(o)); } catch(e){} }
 var LS_SIG = 'feed.sig.v1';
 function sigRead(){ try { return JSON.parse(localStorage.getItem('feed.sig.v1')||'{}'); } catch(e){ return {}; } }
 function sigWrite(o){ try { localStorage.setItem('feed.sig.v1', JSON.stringify(o)); } catch(e){} }
 function sigRec(url, patch){
  if (!url) return;
  var s = state.sig[url] || { o:0, t:0, q:0, s:0, last:0 };
  for (var k in patch){ if (k==='o'||k==='t'||k==='q'||k==='s') s[k] += patch[k]; else s[k] = patch[k]; }
  s.last = Date.now(); state.sig[url] = s; sigWrite(state.sig);
 }
 function impValue(url){
  var s = state.sig[url]; if (!s) return 0;
  var v = 0;
  if (s.o > 0){
   v += 0.45;
   var avg = s.t / Math.max(1, s.o);
   if (avg >= 20000) v += 0.45; else if (avg >= 8000) v += 0.2;
   v -= 0.4 * Math.min(1, (s.q||0) / Math.max(1, s.o));
  } else if ((s.s||0) >= 1){
   v -= 0.18;
  }
  return Math.max(-1, Math.min(1, v));
 }
 function ouvrir(url){ if (!url) return; state._open = { url:url, at:Date.now() }; sigRec(url, { o:1 }); }
 function finLecture(){
  var o = state._open; if (!o) return;
  state._open = null;
  var ms = Date.now() - o.at; if (ms < 300) return;
  sigRec(o.url, { t: ms, q: (ms < 4000 ? 1 : 0) });
 }
 function observerApercu(list){
  if (!('IntersectionObserver' in window) || !list) return;
  if (state._io) state._io.disconnect();
  state._io = new IntersectionObserver(function(entries){
   entries.forEach(function(en){
    var li = en.target, u = li.getAttribute('data-url');
    if (!u) return;
    if (en.isIntersecting){
     if (li._t) return;
     li._t = setTimeout(function(){
      li._t = null;
      var rec = state.sig[u];
      if (rec && (rec.o || rec.s)) return;
      sigRec(u, { s:1 });
     }, 1500);
    } else if (li._t){ clearTimeout(li._t); li._t = null; }
   });
  }, { threshold: 0.55 });
  Array.prototype.forEach.call(list.querySelectorAll('li.item'), function(li){ state._io.observe(li); });
 }
 function gestes(){
  var o=0, lng=0, q=0, seen=0;
  for (var u in state.sig){
   var v = state.sig[u] || {};
   o += v.o||0;
   if (v.o && (v.t / (v.o||1)) >= 20000) lng++;
   q += v.q||0;
   if (!v.o && v.s) seen++;
  }
  return { o:o, long:lng, q:q, s:seen };
 }

 function sessionRead(){ try { return JSON.parse(localStorage.getItem(LS_SESSION)||'null'); } catch(e){ return null; } }
 function sessionWrite(s){ try { s ? localStorage.setItem(LS_SESSION, JSON.stringify(s)) : localStorage.removeItem(LS_SESSION); } catch(e){} }

 function api(path, opts){
  opts = opts || {};
  var h = { 'apikey': CFG.supabaseAnonKey, 'Content-Type':'application/json' };
  if (state.session && state.session.access_token) h['Authorization'] = 'Bearer ' + state.session.access_token;
  if (opts.headers) for (var k in opts.headers) h[k]=opts.headers[k];
  return fetch(CFG.supabaseUrl.replace(/\/$/,'') + path, { method: opts.method||'GET', headers:h, body: opts.body }).then(function(r){
   if (!r.ok) return r.text().then(function(t){ var err = new Error('HTTP '+r.status+' '+t.slice(0,120)); err.status = r.status; throw err; });
   return r.status===204 ? null : r.json().catch(function(){ return null; });
  });
 }

 function parseHash(){
  var h = location.hash || '';
  if (h.indexOf('access_token=') === -1) return null;
  var p = {}; h.replace(/^#/,'').split('&').forEach(function(kv){ var a=kv.split('='); p[a[0]]=decodeURIComponent((a[1]||'').replace(/\+/g,' ')); });
  return p.access_token ? p : null;
 }

 function refreshIfNeeded(){
   if (!state.session || !state.session.refresh_token) return Promise.resolve();
   // un autre onglet a peut-être déjà renouvelé le jeton : on reprend le sien avant d'appeler
   var _st = sessionRead();
   if (_st && _st.refresh_token && state.session && _st.refresh_token !== state.session.refresh_token) { state.session = _st; }
   if (state.session.expires_at && state.session.expires_at - 60000 > Date.now()) return Promise.resolve();
   if (refreshIfNeeded._inflight) return refreshIfNeeded._inflight;
   refreshIfNeeded._inflight = api('/auth/v1/token?grant_type=refresh_token', { method:'POST', body: JSON.stringify({ refresh_token: state.session.refresh_token }) })
    .then(function(d){
      if (!d || !d.access_token) return null;
      state.session.access_token = d.access_token;
      state.session.refresh_token = d.refresh_token || state.session.refresh_token;
      state.session.expires_at = Date.now() + (parseInt(d.expires_in||'3600',10)*1000);
      if (d.user && d.user.id) state.session.user = { id:d.user.id, email:d.user.email };
      sessionWrite(state.session);
      return d;
    })
    .catch(function(e){
      // Jeton vraiment invalide : on repart de zéro. Panne réseau ou serveur : on garde la session pour réessayer plus tard.
      if (e && (e.status === 400 || e.status === 401)) { var _cur = sessionRead(); if (!_cur || _cur.refresh_token === state.session.refresh_token) { state.session = null; sessionWrite(null); } else { state.session = _cur; } }
      else if (window.console) console.warn('refresh différé :', e && e.message);
      return null;
    })
    .then(function(d){ refreshIfNeeded._inflight = null; return d; });
   return refreshIfNeeded._inflight;
  }

  function loadSession(){
  var p = parseHash();
  if (p) {
   state.session = { access_token:p.access_token, refresh_token:p.refresh_token||'', expires_at: Date.now()+ (parseInt(p.expires_in||'3600',10)*1000) };
   sessionWrite(state.session);
   history.replaceState(null,'',location.pathname+location.search);
  } else { state.session = sessionRead(); }
  if (!HAS_REMOTE || !state.session) return Promise.resolve();
  return refreshIfNeeded().then(function(){
   if (!state.session || !state.session.access_token) return null;
   if (state.session.user && state.session.user.id) return null;
   return api('/auth/v1/user').then(function(u){
     if (u && u.id) { state.session.user = { id:u.id, email:u.email }; sessionWrite(state.session); }
   }).catch(function(e){ console.warn('user lookup failed', e.message); });
  });
 }

 function loadInteractions(){
  var local = localRead();
  state.inter = local || {};
  if (!HAS_REMOTE || !state.session) { state.source = 'local'; return Promise.resolve(); }
  state.source = 'remote';
  return api('/rest/v1/' + (CFG.table||'interactions') + '?select=url,vote,favorite,rank,updated_at', { headers:{ 'Accept':'application/json' } })
   .then(function(rows){ (rows||[]).forEach(function(r){ state.inter[r.url] = mergeInter(state.inter[r.url], { vote:r.vote||0, fav:!!r.favorite, rank:r.rank||0, ts:Date.parse(r.updated_at)||Date.now() }); }); localWrite(state.inter); })
   .catch(function(e){ state.source='local'; console.warn('sync read failed', e.message); });
 }

 function mergeInter(a,b){ a=a||{}; for (var k in b){ if (b[k]!==undefined) a[k]=b[k]; } return a; }

 function saveInteraction(url, patch){
  var cur = state.inter[url] || {};
  var next = mergeInter(cur, patch); next.ts = Date.now();
  state.inter[url] = next; localWrite(state.inter);
  if (!HAS_REMOTE || !state.session || !state.session.access_token) return Promise.resolve();
  var uid = state.session.user && state.session.user.id;
  if (!uid) return Promise.resolve();
  var body = [{ user_id: uid, url:url, vote: next.vote||0, favorite: !!next.fav, rank: next.rank||0 }];
  return api('/rest/v1/' + (CFG.table||'interactions') + '?on_conflict=user_id,url', {
   method:'POST', body: JSON.stringify(body),
   headers:{ 'Prefer':'resolution=merge-duplicates,return=minimal' }
  }).catch(function(e){ console.warn('sync write failed', e.message); });
 }

 /* ---------- moteur ---------- */
 var DIMS = [
  { k:'theme', w:1.00 },
  { k:'sous_theme', w:0.90 },
  { k:'secteur', w:0.70 },
  { k:'nature', w:0.55 },
  { k:'utilite', w:0.50 },
  { k:'profondeur', w:0.30 },
  { k:'nouveaute', w:0.30 },
  { k:'source', w:0.55 }
 ];

 function bucket(n){ n = Number(n)||0; return n<=2 ? 'bas' : (n>=4 ? 'haut' : 'moyen'); }

 function features(it){
  var a = it.attrs || {};
  return [
   { k:'theme', v: it.rubrique || 'Autre', w:1.00 },
   { k:'sous_theme', v: (a.sous_theme||'non classé').toLowerCase(), w:0.90 },
   { k:'secteur', v: (a.secteur||'non classé').toLowerCase(), w:0.70 },
   { k:'nature', v: a.nature || 'actualité', w:0.55 },
   { k:'utilite', v: bucket(a.utilite), w:0.50 },
   { k:'profondeur', v: bucket(a.profondeur), w:0.30 },
   { k:'nouveaute', v: bucket(a.nouveaute), w:0.30 },
   { k:'source', v: it.source || '', w:0.55 }
  ];
 }

 function learn(){
  var c = {};
  for (var url in state.inter){
   var r = state.inter[url]; if (!r || !r.vote) continue;
   var it = byUrl[url]; if (!it) continue;
   features(it).forEach(function(f){
    var key = f.k + '|' + f.v; var o = c[key] || (c[key] = { u:0, d:0, k:f.k, v:f.v });
    if (r.vote > 0) o.u++; else o.d++;
   });
  }
  for (var su in state.sig){
   var si = state.sig[su]; if (!si) continue;
   var siIt = byUrl[su]; if (!siIt) continue;
   var xi = state.inter[su]; if (xi && xi.vote) continue;
   var vi = impValue(su); if (!vi) continue;
   var wi = Math.abs(vi) * 0.55;
   features(siIt).forEach(function(f){
    var key = f.k + '|' + f.v; var o = c[key] || (c[key] = { u:0, d:0, k:f.k, v:f.v });
    if (vi > 0) o.u += wi; else o.d += wi;
   });
  }
  return c;
 }

 function affinity(it, counts){
  var num = 0, den = 0, parts = [];
  features(it).forEach(function(f){
   var o = counts[f.k + '|' + f.v];
   var s = 0;
   if (o) { var p = (o.u + 1) / (o.u + o.d + 2); s = (p - 0.5) * 2 * Math.min(1, (o.u + o.d) / 3); }
   num += f.w * s; den += f.w;
   if (o && o.u + o.d >= 1) parts.push({ k:f.k, v:f.v, s:f.w * s, n:o.u + o.d, up:o.u });
  });
  return { score: den ? num/den : 0, parts: parts };
 }

 function quality(it){
  var a = it.attrs || {};
  var q = 0.30*((a.utilite||3)/5) + 0.25*((a.qualite_source||3)/5) + 0.20*((a.nouveaute||3)/5) + 0.15*((a.profondeur||3)/5);
  var n = a.nature || 'actualité';
  q += 0.10 * ((n==='étude'||n==='analyse'||n==='interview'||n==='retour d\'expérience') ? 1 : 0.6);
  return Math.max(0, Math.min(1, q));
 }

 function recency(it){
  var h = (Date.now() - Date.parse(it.iso)) / 3600000;
  if (!isFinite(h)) return 0.3;
  return Math.exp(-Math.max(0,h) / 60);
 }

 var byUrl = {};

 function scored(){
  var counts = learn();
  return state.items.map(function(it){
   var aff = affinity(it, counts);
   var sc = 0.55*((aff.score+1)/2) + 0.25*quality(it) + 0.20*recency(it);
   return { it: it, aff: aff.score, q: quality(it), s: sc, parts: aff.parts };
  });
 }

 function reason(o){
  var pos = o.parts.filter(function(p){ return p.s > 0.02; }).sort(function(a,b){ return b.s-a.s; }).slice(0,2);
  if (!pos.length) return '';
  return 'pour vous : ' + pos.map(function(p){ return pretty(p.k) + ' ' + p.v; }).join(' · ');
 }
 function pretty(k){ return ({theme:'thème', sous_theme:'sujet', secteur:'secteur', nature:'format', utilite:'utilité', profondeur:'profondeur', nouveaute:'nouveauté', source:'source'})[k] || k; }

 /* ---------- rendu ---------- */
 function rubriques(){
  var s = {}; state.items.forEach(function(i){ if (i.rubrique) s[i.rubrique]=1; });
  return ['Toutes'].concat(Object.keys(s).sort(function(a,b){ return a.localeCompare(b,'fr'); }));
 }

 function matches(it){
  if (state.filter !== 'Toutes' && it.rubrique !== state.filter) return false;
  if (state.favOnly && !(state.inter[it.url] && state.inter[it.url].fav)) return false;
  if (state.q){
   var q = state.q.toLowerCase();
   var hay = (it.titre + ' ' + it.resume + ' ' + it.source + ' ' + it.rubrique + ' ' + ((it.attrs&&it.attrs.sous_theme)||'')).toLowerCase();
   if (hay.indexOf(q) === -1) return false;
  }
  return true;
 }

 function renderFilters(){
  var n = $('#filters');
  n.innerHTML = rubriques().map(function(r){
   return '<button class="chip" data-r="'+esc(r)+'" aria-pressed="'+(r===state.filter)+'">'+esc(r)+'</button>';
  }).join('');
  Array.prototype.forEach.call(n.querySelectorAll('button'), function(b){ b.onclick=function(){ state.filter=b.getAttribute('data-r'); renderFilters(); render(); }; });
 }

 function hhmm(iso){ try { return new Date(iso).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}).replace(':','h'); } catch(e){ return ''; } }
 function dayLabel(d){ try { return new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}); } catch(e){ return d; } }

 
 var PAYS = {
  'lemonde.fr':'FR','francetvinfo.fr':'FR','usine-digitale.fr':'FR','themedialeader.com':'FR','mindmedia.fr':'FR',
  'numerama.com':'FR','journaldunet.com':'FR','viuz.com':'FR','larevuedudigital.com':'FR','automobile-propre.com':'FR',
  'avere-france.org':'FR','revolution-energetique.com':'FR','cnil.fr':'FR',
  'exchangewire.com':'GB','retailgazette.co.uk':'GB','marketingweek.com':'GB','sifted.eu':'GB',
  'retaildive.com':'US','marketingdive.com':'US','grocerydive.com':'US','digiday.com':'US','modernretail.co':'US',
  'adexchanger.com':'US','supermarketnews.com':'US','techcrunch.com':'US','theverge.com':'US','wired.com':'US',
  'electrek.co':'US','chargedevs.com':'US','insideevs.com':'US',
  'retaildetail.eu':'BE','tech.eu':'BE','iabeurope.eu':'EU','ecommercenews.eu':'EU','eu-startups.com':'EU'
 };
 var PAYS_NOM = { FR:'France', GB:'Royaume-Uni', US:'États-Unis', BE:'Belgique', EU:'Union européenne' };
 function paysOf(src){
  var d = String(src||'').toLowerCase().replace(/^www\./,'');
  if (PAYS[d]) return PAYS[d];
  for (var k in PAYS){ if (d.indexOf(k) !== -1) return PAYS[k]; }
  return '';
 }
 function drapeau(code){
  if (!code || code.length !== 2) return '';
  var up = code.toUpperCase();
  return String.fromCodePoint(0x1F1E6 + up.charCodeAt(0) - 65, 0x1F1E6 + up.charCodeAt(1) - 65);
 }
 function flagHtml(src){
  var c = paysOf(src); if (!c) return '';
  return '<span class="fl" title="'+(PAYS_NOM[c]||c)+'">'+drapeau(c)+'</span> ';
 }

 function itemHtml(o, showDay){
  var it = o.it, r = state.inter[it.url] || {};
  var cls = 'item' + (r.vote>0?' voted-up':'') + (r.vote<0?' voted-down':'');
  var pct = Math.round(o.s*100);
  var why = o.explore ? 'découverte · sujet peu exploré' : reason(o);
  return '<li class="'+cls+'" data-url="'+esc(it.url)+'">'
   + '<div class="meta"><span class="rub">'+esc(it.rubrique||'')+'</span><span>'+esc(hhmm(it.iso))+'</span><span>'+flagHtml(it.source)+esc(it.source||'')+'</span><span class="score" title="Affinité '+(o.aff>0?'+':'')+Math.round(o.aff*100)+' · qualité '+Math.round(o.q*100)+'"><b>'+pct+'</b></span></div>'
   + '<p class="h3"><a href="'+esc(it.url)+'" target="_blank" rel="noopener">'+esc(it.titre)+'</a></p>'
   + (it.resume?'<p class="res">'+esc(it.resume)+'</p>':'')
   + (why?'<p class="why">'+esc(why)+'</p>':'')
   + '<div class="acts">'
   + '<button class="act '+((r.vote<0)?'on-down':'')+'" data-vote="-1" title="Pas intéressant">👎</button>'
   + '<button class="act '+((r.fav)?'on-fav':'')+'" data-vote="fav" title="Garder pour plus tard">★</button>'
   + '<a class="act open" href="'+esc(it.url)+'" target="_blank" rel="noopener">ouvrir ↗</a>'
   + '</div></li>';
 }

 function themeVotes(){
  var t = {};
  for (var url in state.inter){ var r=state.inter[url]; if (!r || !r.vote) continue; var it=byUrl[url]; if (!it) continue; t[it.rubrique]=(t[it.rubrique]||0)+1; }
  return t;
 }

 function withDiscovery(rows){
  var tv = themeVotes();
  var pool = rows.filter(function(o){ return (tv[o.it.rubrique]||0) <= 1; });
  if (!pool.length) return rows;
  var out = [], pi = 0, used = {};
  rows.forEach(function(o,i){
   out.push(o);
   if ((i+1) % 5 === 0 && pi < pool.length){
    var cand = pool[pi++];
    if (!used[cand.it.url]){ used[cand.it.url]=1; cand.explore = true; }
   }
  });
  return out;
 }
 function render(){
  var list = $('#list');
  var sig = state.sort+'|'+state.filter+'|'+state.q+'|'+(state.favOnly?1:0);
  if (state._sig !== sig){ state._sig = sig; state.limit = 60; }
  var rows = scored().filter(function(o){ return matches(o.it) && !state.hidden[o.it.url] && (!state.unreadOnly || !state.read[o.it.url]); });
  if (state.sort === 'date') rows.sort(function(a,b){ return Date.parse(b.it.iso)-Date.parse(a.it.iso); });
  else if (state.sort === 'source') rows.sort(function(a,b){ return (a.it.source||'').localeCompare(b.it.source||'') || (Date.parse(b.it.iso)-Date.parse(a.it.iso)); });
  else { rows.sort(function(a,b){ return b.s-a.s; }); rows = withDiscovery(rows); }
  updateUnreadBadge();
  if (!rows.length){
   list.innerHTML = (state.unreadOnly && state.items.length)
     ? '<p class="empty">Tout est lu.</p><button class="btn" id="seeAll">Voir tous les articles</button>'
     : '<p class="empty">Aucun article.</p>';
   var sa = $('#seeAll'); if (sa) sa.onclick = function(){ state.unreadOnly = false; var b=$('#unreadBtn'); if(b) b.setAttribute('aria-pressed','false'); render(); };
   return;
  }
  var total = rows.length;
  rows = rows.slice(0, state.limit);
  var html='', lastDay='';
  rows.forEach(function(o){
   var d = (o.it.iso||'').slice(0,10);
   if (state.sort === 'date' && d !== lastDay){ html += '<div class="day">'+esc(dayLabel(d))+'</div>'; lastDay=d; }
   html += itemHtml(o);
  });
  list.innerHTML = '<ul class="items">'+html+'</ul>' +
   (total > state.limit ? '<button class="btn" id="more">Afficher plus ('+(total - state.limit)+' restants)</button>' : '') +
   '<p class="hint">'+total+' article'+(total>1?'s':'')+' au total</p>';
  observerApercu(list);
  var more = $('#more');
  if (more) more.onclick = function(){ state.limit += 60; render(); };
  Array.prototype.forEach.call(list.querySelectorAll('button[data-vote]'), function(b){
   b.onclick = function(ev){
    ev.preventDefault(); ev.stopPropagation();
    var li = b.closest('li'); var url = li.getAttribute('data-url');
    var v = b.getAttribute('data-vote');
    var cur = state.inter[url] || {};
    if (v === 'fav') saveInteraction(url, { fav: !cur.fav });
    else { var nv = (cur.vote === parseInt(v,10)) ? 0 : parseInt(v,10);
      var rank = 0;
      scored().sort(function(a,b){return b.s-a.s;}).forEach(function(o,i){ if (o.it.url===url) rank=i+1; });
      saveInteraction(url, { vote: nv, rank: rank || cur.rank || 0 }); }
    render();
   };
  });
 }

 
 /* ---------- balayage : écarter un article ---------- */
 var SW = { el:null, x0:0, y0:0, dx:0, active:false };
 var lastSwipe = 0;

 function ecarter(url, li){
  if (!url) return;
  state.hidden[url] = 1; hiddenWrite(state.hidden);
  var cur = state.inter[url] || {};
  var rank = 0;
  scored().sort(function(a,b){ return b.s-a.s; }).forEach(function(o,i){ if (o.it.url===url) rank=i+1; });
  saveInteraction(url, { vote:-1, rank: rank || cur.rank || 0 });
  lastSwipe = Date.now();
  if (li){
    li.classList.add('removing');
    setTimeout(function(){ render(); }, 180);
  } else { render(); }
 }

 function bindSwipe(){
  var list = $('#list'); if (!list) return;
  list.addEventListener('touchstart', function(e){
   if (e.touches.length !== 1) return;
   var t = e.target; var li = t && t.closest ? t.closest('li.item') : null;
   if (!li) return;
   SW.el = li; SW.x0 = e.touches[0].clientX; SW.y0 = e.touches[0].clientY; SW.dx = 0; SW.active = false;
  }, { passive:true });
  list.addEventListener('touchmove', function(e){
   if (!SW.el || e.touches.length !== 1) return;
   var dx = e.touches[0].clientX - SW.x0;
   var dy = e.touches[0].clientY - SW.y0;
   if (!SW.active){
    if (Math.abs(dy) > Math.abs(dx) + 4){ SW.el = null; return; }
    if (dx < 12) return;
    SW.active = true; SW.el.classList.add('swiping');
   }
   SW.dx = Math.min(dx, 150);
   SW.el.style.transform = 'translateX(' + SW.dx + 'px)';
   SW.el.style.opacity = String(Math.max(0.3, 1 - SW.dx / 240));
  }, { passive:true });
  list.addEventListener('touchend', function(){
   var li = SW.el; if (!li) return;
   var dx = SW.dx, url = li.getAttribute('data-url');
   li.classList.remove('swiping'); li.style.transform = ''; li.style.opacity = '';
   SW.el = null; SW.dx = 0; SW.active = false;
   if (dx > 90) ecarter(url, li);
  });
  list.addEventListener('click', function(e){
   if (Date.now() - lastSwipe < 400){ e.preventDefault(); e.stopPropagation(); return; }
   var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
   if (a) { var uo = a.getAttribute('href'); marquerLu(uo); ouvrir(uo); }
  }, true);
 }

function compterNonLus(){
  var n = 0;
  state.items.forEach(function(it){ if (!state.read[it.url] && !state.hidden[it.url]) n++; });
  return n;
 }
 function updateUnreadBadge(){
  var b = $('#unreadBtn'); if (!b) return;
  var n = compterNonLus();
  b.textContent = n ? ('Non lus ' + n) : 'Non lus';
  b.setAttribute('aria-pressed', String(state.unreadOnly));
 }
 function marquerLu(url){
  if (!url || state.read[url]) return;
  state.read[url] = Date.now(); readWrite(state.read); updateUnreadBadge();
 }

 /* ---------- profil et stats ---------- */
 function stats(){
  var votes=0, ups=0, favs=0, top10=0, top10up=0;
  for (var url in state.inter){
   var r = state.inter[url]; if (!r) continue;
   if (r.fav) favs++;
   if (r.vote){ votes++; if (r.vote>0) ups++; if (r.rank && r.rank<=10){ top10++; if (r.vote>0) top10up++; } }
  }
  return { votes:votes, ups:ups, favs:favs, top10:top10, top10up:top10up };
 }

 function topList(counts, dim, n){
  var arr=[];
  for (var k in counts){ var o=counts[k]; if (o.k!==dim) continue; var t=o.u+o.d; if (!t) continue; var p=(o.u+1)/(t+2); arr.push({v:o.v,p:p,n:t,u:o.u}); }
  arr.sort(function(a,b){ return (b.p-0.5)*Math.min(b.n,6) - (a.p-0.5)*Math.min(a.n,6); });
  return arr.slice(0,n);
 }

 function openPanel(){
  var s = stats(); var counts = learn();
  var parts=[];
  parts.push('<button class="close" id="closeSheet">×</button>');
  parts.push('<h2>Profil affinitaire</h2>');
  parts.push('<p class="hint">'+(HAS_REMOTE ? (state.session ? 'Synchronisé · '+esc((state.session.user&&state.session.user.email)||'compte connecté') : 'Non connecté · votes enregistrés sur cet appareil') : 'Mode local · votes enregistrés sur cet appareil')+'</p>');
  var g = gestes();
  parts.push('<div class="kpi"><div><b>'+g.o+'</b><span>articles ouverts</span></div><div><b>'+g.long+'</b><span>lus longuement</span></div><div><b>'+g.q+'</b><span>quittés en moins de 4 s</span></div><div><b>'+g.s+'</b><span>aperçus sans ouvrir</span></div></div>');
  parts.push('<p class="hint">'+(s.votes?('Vous avez voté sur '+s.votes+' article'+(s.votes>1?'s':'')+', dont '+s.favs+' gardé'+(s.favs>1?'s':'')+'.'):'Aucun vote explicite pour l\'instant : le classement repose entièrement sur vos gestes et sur la qualité de source.')+'</p>');
  ['theme','sous_theme','secteur','nature','source'].forEach(function(dim){
   var arr = topList(counts, dim, 6); if (!arr.length) return;
   parts.push('<h3>'+esc(pretty(dim))+'</h3>');
   arr.forEach(function(o){
    var w = Math.round(Math.abs(o.p-0.5)*220);
    parts.push('<div class="row"><span><i class="bar-l'+(o.p<0.5?' neg':'')+'" style="width:'+w+'px"></i>'+esc(o.v)+'</span><span class="v">'+Math.round(o.p*100)+'% · '+o.n+' vote'+(o.n>1?'s':'')+'</span></div>');
   });
  });
  if (!s.votes) parts.push('<p class="hint">Aucun vote pour l\'instant : le classement reste chronologique et la qualité de source fait la différence.</p>');
  parts.push('<h3>Compte</h3>');
  if (HAS_REMOTE){
   if (state.session) parts.push('<button class="btn" id="signout">Se déconnecter</button>');
   else parts.push('<input id="email" type="email" placeholder="votre@email"><button class="btn primary" id="signin">Recevoir le code</button><p class="hint">Un code à 6 chiffres arrive par email, dans le même message que le lien. Saisissez-le ici : la session reste ensuite ouverte dans ce navigateur.</p><input id="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="code à 6 chiffres"><button class="btn" id="verify">Valider le code</button>');
  } else {
   parts.push('<p class="hint">La synchronisation entre appareils sera active dès que Supabase sera configuré (URL et clé publique dans config.js). D\'ici là, les votes restent sur cet appareil.</p>');
  }
  var nh = Object.keys(state.hidden||{}).length;
   if (nh) parts.push('<h3>Articles écartés</h3><button class="btn" id="unhide">Réafficher '+nh+' article'+(nh>1?'s':'')+'</button>');
   parts.push('<h3>Réinitialiser</h3>');
  parts.push('<button class="btn" id="resetVotes">Effacer mes votes</button>');
  $('#sheet').innerHTML = parts.join('');
  $('#panel').classList.add('open');
  $('#closeSheet').onclick = closePanel;
  var sv = $('#signout'); if (sv) sv.onclick = function(){ state.session=null; sessionWrite(null); closePanel(); boot(); };
  var si = $('#signin'); if (si) si.onclick = function(){ signIn($('#email').value); };
   var uh = $('#unhide'); if (uh) uh.onclick = function(){ state.hidden={}; hiddenWrite({}); closePanel(); render(); };
   var vf = $('#verify'); if (vf) vf.onclick = function(){ verifyCode($('#email').value, $('#code').value); };
  $('#resetVotes').onclick = function(){ if (!confirm('Effacer tous les votes et favoris ?')) return; state.inter={}; localWrite({}); state.hidden={}; hiddenWrite({}); state.sig={}; sigWrite({}); if (HAS_REMOTE && state.session) api('/rest/v1/'+(CFG.table||'interactions')+'?url=not.is.null',{method:'DELETE'}).catch(function(){}); closePanel(); render(); };
 }
 function closePanel(){ $('#panel').classList.remove('open'); }

 function signIn(email){
   if (!email) return;
   var back = location.origin + location.pathname;
   api('/auth/v1/otp?redirect_to=' + encodeURIComponent(back), { method:'POST', body: JSON.stringify({ email:email, create_user:true }) })
    .then(function(){ alert('Code envoyé à '+email+'. Il figure dans le même message que le lien de connexion.'); })
    .catch(function(e){ alert('Envoi impossible : '+e.message); });
  }

  function verifyCode(email, code){
   if (!email || !code) { alert('Renseignez votre email puis le code reçu.'); return; }
   api('/auth/v1/verify', { method:'POST', body: JSON.stringify({ type:'email', email:email, token:String(code).trim() }) })
    .then(function(d){
      if (!d || !d.access_token) throw new Error('code refusé');
      state.session = { access_token:d.access_token, refresh_token:d.refresh_token||'', expires_at: Date.now() + (parseInt(d.expires_in||'3600',10)*1000), user: d.user ? { id:d.user.id, email:d.user.email } : null };
      sessionWrite(state.session);
      var st = $('#status'); if (st) st.textContent = 'Connexion…';
      closePanel();
      boot();
    })
    .catch(function(e){ alert('Code refusé : '+e.message); });
  }

  function boot(){ bindSwipe();
  loadSession().then(function(){ return loadInteractions(); }).then(function(){
   if (state.source==='remote'){ var st=$('#status'); st.textContent='Synchronisé entre vos appareils'; }
   render();
  });
 }

 fetch('editions.json',{cache:'no-store'}).then(function(r){ return r.json(); }).then(function(d){
  state.items = (d.items||[]).slice();
  state.items.forEach(function(i){ byUrl[i.url]=i; });
  var foot = $('#foot');
   if (foot) {
     var stamp = (d.meta && (d.meta.updated || d.meta.updated_at)) ? new Date(d.meta.updated || d.meta.updated_at) : null;
     state.items.forEach(function(i){ var t = Date.parse(i.iso); if (!isNaN(t) && (!stamp || isNaN(stamp.getTime()) || t > stamp.getTime())) stamp = new Date(t); });
     var when = '';
     if (stamp && !isNaN(stamp.getTime())) {
       var dd = String(stamp.getDate()).padStart(2,'0'), mo = String(stamp.getMonth()+1).padStart(2,'0');
       var hh = String(stamp.getHours()).padStart(2,'0'), mi = String(stamp.getMinutes()).padStart(2,'0');
       when = ' \u00b7 mis \u00e0 jour le '+dd+'/'+mo+' \u00e0 '+hh+':'+mi;
     }
     foot.textContent = state.items.length + ' articles \u00b7 ' + ((d.meta&&d.meta.sources_count)||'') + ' sources' + when;
   }
  renderFilters();
  boot();
 }).catch(function(){ $('#list').innerHTML='<p class="empty">Données indisponibles.</p>'; });

 $('#sort').onchange = function(e){ state.sort = e.target.value; render(); };
 $('#q').oninput = function(e){ state.q = e.target.value.trim(); render(); };
 $('#profileBtn').onclick = openPanel;
 $('#unreadBtn').onclick = function(e){ state.unreadOnly = !state.unreadOnly; e.currentTarget.setAttribute('aria-pressed', String(state.unreadOnly)); render(); };
 $('#favBtn').onclick = function(e){ state.favOnly = !state.favOnly; e.currentTarget.setAttribute('aria-pressed', String(state.favOnly)); render(); };
 $('#panel').onclick = function(e){ if (e.target.id==='panel') closePanel(); };
 document.addEventListener('visibilitychange', function(){ if (!document.hidden){ finLecture(); if (state.unreadOnly) render(); } });
 window.addEventListener('pagehide', finLecture);
 document.addEventListener('keydown', function(e){ if (e.key==='Escape') closePanel(); });
})();