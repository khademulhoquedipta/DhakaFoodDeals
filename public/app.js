// DealBite Dhaka — Frontend App (API-driven)
var API = '';
var sessionId = localStorage.getItem('db-session') || (function(){var s=Math.random().toString(36).slice(2);localStorage.setItem('db-session',s);return s})();

// ─── API Helper ───
function api(path, opts) {
  return fetch(API + path, Object.assign({headers:{'Content-Type':'application/json'}}, opts))
    .then(function(r){return r.json()});
}

// ─── Toast ───
function toast(msg) {
  var t = document.getElementById('toast');
  var m = document.getElementById('toastMsg');
  if(!t||!m) return;
  m.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){t.classList.remove('show')},2500);
}

// ─── Theme ───
var themeBtn = document.getElementById('themeBtn');
function setTheme(th) {
  document.documentElement.setAttribute('data-theme', th);
  localStorage.setItem('db-theme', th);
}
if(themeBtn) themeBtn.onclick = function(){
  setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');
};
var saved = localStorage.getItem('db-theme');
if(saved) setTheme(saved);

// ─── Nav scroll ───
var nav = document.getElementById('nav');
window.addEventListener('scroll', function(){
  var s = window.scrollY;
  if(nav) nav.classList.toggle('scrolled', s > 40);
  var tt = document.getElementById('totop');
  if(tt) tt.classList.toggle('show', s > 400);
  // Active link
  document.querySelectorAll('section[id]').forEach(function(sec){
    var top = sec.offsetTop - 120;
    if(s >= top && s < top + sec.offsetHeight) {
      document.querySelectorAll('.nav-link').forEach(function(l){l.classList.remove('active')});
      var a = document.querySelector('.nav-link[data-section="'+sec.id+'"]');
      if(a) a.classList.add('active');
    }
  });
}, {passive:true});

// Back to top
var totop = document.getElementById('totop');
if(totop) totop.onclick = function(){window.scrollTo({top:0,behavior:'smooth'})};

// Hamburger
var ham = document.getElementById('hamburger');
var nl = document.getElementById('navLinks');
if(ham) ham.onclick = function(){nl.classList.toggle('open');ham.classList.toggle('active')};
if(nl) nl.querySelectorAll('.nav-link').forEach(function(l){
  l.onclick = function(){nl.classList.remove('open');if(ham)ham.classList.remove('active')};
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(function(a){
  a.addEventListener('click',function(e){e.preventDefault();var t=document.querySelector(this.getAttribute('href'));if(t)t.scrollIntoView({behavior:'smooth'})});
});

// ─── Counter Animation ───
function animateCounters() {
  document.querySelectorAll('.metric-num[data-target]').forEach(function(el){
    var target = parseInt(el.getAttribute('data-target'));
    var dur = 1800, start = performance.now();
    function upd(now){
      var p = Math.min((now-start)/dur,1);
      var e = 1-Math.pow(1-p,3);
      el.textContent = Math.round(target*e);
      if(p<1) requestAnimationFrame(upd);
    }
    requestAnimationFrame(upd);
  });
}

// ─── Intersection Observer ───
var obs = new IntersectionObserver(function(entries){
  entries.forEach(function(en){
    if(en.isIntersecting){
      en.target.classList.add('visible');
      if(en.target.id==='hero') setTimeout(animateCounters,400);
      if(en.target.id==='platforms') setTimeout(function(){
        document.querySelectorAll('.bar-fill').forEach(function(b){b.style.width=b.dataset.w});
      },300);
      obs.unobserve(en.target);
    }
  });
},{threshold:.1});
document.querySelectorAll('section').forEach(function(s){obs.observe(s)});

// ─── Load Platforms ───
function loadPlatforms() {
  api('/api/platforms').then(function(res){
    if(!res.success) return;
    var grid = document.getElementById('platformGrid');
    grid.innerHTML = '';
    res.data.forEach(function(p){
      var isBest = p.slug === 'pathao';
      var strengths = (p.strengths||[]).map(function(s){return '<li>'+s+'</li>'}).join('');
      var weaks = (p.weaknesses||[]).map(function(w){return '<li>'+w+'</li>'}).join('');
      var pct = (p.rating/10*100)+'%';
      var card = document.createElement('div');
      card.className = 'plat-card' + (isBest?' best':'');
      card.style.animation = 'fadeUp .5s ease both';
      card.innerHTML =
        (isBest?'<div class="best-tag">⭐ Best Value</div>':'')+
        '<div class="plat-head"><div class="plat-icon">'+p.icon+'</div><h3>'+p.name+'</h3><span class="plat-tag">'+p.tag+'</span></div>'+
        '<div class="plat-body">'+
          '<div class="fee-row"><span class="fee-label">Delivery Fee</span><span class="fee-val'+(p.slug==='foodi'?' good':'')+'">৳'+p.delivery_fee_min+' – ৳'+p.delivery_fee_max+'</span></div>'+
          '<div class="fee-row"><span class="fee-label">Surge Max</span><span class="fee-val'+(p.surge_max>100?' bad':'')+'">Up to ৳'+p.surge_max+'</span></div>'+
          '<div class="fee-row"><span class="fee-label">Service Fee</span><span class="fee-val">৳'+p.service_fee_min+' – ৳'+p.service_fee_max+'</span></div>'+
          '<div class="fee-row"><span class="fee-label">Min Order</span><span class="fee-val">৳'+p.min_order_min+' – ৳'+p.min_order_max+'</span></div>'+
          '<div class="fee-row"><span class="fee-label">Free Delivery</span><span class="fee-val good">'+p.free_delivery_info+'</span></div>'+
          '<div class="plat-list pros"><h4>✅ Strengths</h4><ul>'+strengths+'</ul></div>'+
          '<div class="plat-list cons"><h4>⚠️ Watch Out</h4><ul>'+weaks+'</ul></div>'+
        '</div>'+
        '<div class="plat-foot"><div class="bar-track"><div class="bar-fill" data-w="'+pct+'" style="width:0"></div></div><span>'+p.rating+'/10</span></div>';
      grid.appendChild(card);
    });
  });
}

// ─── Load Deals ───
var dealFilter = 'all', dealPlatform = 'all', dealSearch = '';
function loadDeals() {
  var q = '/api/deals?type='+dealFilter+'&platform='+dealPlatform;
  if(dealSearch) q += '&search='+encodeURIComponent(dealSearch);
  api(q).then(function(res){
    if(!res.success) return;
    var grid = document.getElementById('dealsGrid');
    var count = document.getElementById('dealsCount');
    grid.innerHTML = '';
    if(res.data.length===0){
      grid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><h4>No deals found</h4><p>Try a different filter or search term.</p></div>';
      count.textContent='';
      return;
    }
    count.textContent = res.total + ' deal'+(res.total>1?'s':'')+' found';
    res.data.forEach(function(d, i){
      var card = document.createElement('div');
      card.className = 'deal-card';
      card.style.animationDelay = (i*0.06)+'s';
      card.style.borderTopColor = d.platform_color;
      card.innerHTML =
        '<div class="deal-top"><span class="deal-type '+d.type+'">'+(d.type==='bogo'?'BOGO':d.type==='flat'?'FLAT OFF':d.type==='freedelivery'?'FREE DELIVERY':'COMBO')+'</span><span class="deal-plat">'+d.platform_icon+' '+d.platform_name+'</span></div>'+
        '<div class="deal-title">'+d.title+'</div>'+
        '<p class="deal-desc">'+d.description+'</p>'+
        '<div class="deal-bottom"><span class="deal-save">'+d.savings+'</span><span class="deal-exp">⏰ '+d.expires+'</span></div>'+
        '<div class="deal-votes">'+
          '<button class="vote-btn" data-id="'+d.id+'" data-type="up" onclick="voteDeal('+d.id+',\'up\',this)">▲</button>'+
          '<span class="vote-count" id="dv-'+d.id+'">'+d.votes+'</span>'+
          '<button class="vote-btn" data-id="'+d.id+'" data-type="down" onclick="voteDeal('+d.id+',\'down\',this)">▼</button>'+
        '</div>';
      grid.appendChild(card);
    });
  });
}

function voteDeal(id, type, btn) {
  api('/api/deals/'+id+'/vote',{method:'POST',body:JSON.stringify({vote_type:type,session_id:sessionId})})
  .then(function(res){
    if(res.success){
      var el = document.getElementById('dv-'+id);
      if(el) el.textContent = res.votes;
      toast(type==='up'?'👍 Upvoted!':'👎 Downvoted');
    }
  });
}

// Deal filter events
document.getElementById('dealFilters').addEventListener('click',function(e){
  var chip = e.target.closest('.chip[data-filter]');
  if(!chip) return;
  this.querySelectorAll('.chip').forEach(function(c){c.classList.remove('active')});
  chip.classList.add('active');
  dealFilter = chip.dataset.filter;
  loadDeals();
});

// Platform filter for deals
document.querySelectorAll('.chip[data-platform]').forEach(function(c){
  c.addEventListener('click',function(){
    document.querySelectorAll('.chip[data-platform]').forEach(function(b){b.classList.remove('active')});
    c.classList.add('active');
    dealPlatform = c.dataset.platform;
    loadDeals();
  });
});

// Search
var searchTimeout;
var searchInput = document.getElementById('dealSearch');
if(searchInput) searchInput.addEventListener('input',function(){
  clearTimeout(searchTimeout);
  var val = this.value;
  searchTimeout = setTimeout(function(){dealSearch=val;loadDeals()},350);
});

// ─── Load Promos ───
var promoFilter = 'all';
function loadPromos() {
  var q = '/api/promos';
  if(promoFilter!=='all') q += '?platform='+promoFilter;
  api(q).then(function(res){
    if(!res.success) return;
    var grid = document.getElementById('promoGrid');
    grid.innerHTML = '';
    res.data.forEach(function(p, i){
      var card = document.createElement('div');
      card.className = 'promo-card';
      card.style.animationDelay = (i*0.06)+'s';
      card.innerHTML =
        '<div class="promo-badge" style="background:linear-gradient(135deg,'+p.platform_color+','+p.platform_color+'88)">'+p.platform_icon+'</div>'+
        '<div class="promo-info"><div class="promo-code">'+p.code+'</div><div class="promo-detail">'+p.description+(p.max_discount?' (max ৳'+p.max_discount+')':'')+(p.min_order?'. Min ৳'+p.min_order:'')+'</div><div class="promo-valid">'+p.validity+(p.usage_limit?' • '+p.usage_limit:'')+'</div></div>'+
        '<div class="promo-right"><button class="copy-btn" data-code="'+p.code+'" data-id="'+p.id+'">Copy</button><span class="copy-count">'+p.times_copied+' copies</span></div>';
      grid.appendChild(card);
    });
  });
}

// Copy promo
document.addEventListener('click',function(e){
  var btn = e.target.closest('.copy-btn');
  if(!btn) return;
  var code = btn.dataset.code;
  var id = btn.dataset.id;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(code).then(function(){doCopied(btn,code,id)});
  } else {
    var ta=document.createElement('textarea');ta.value=code;ta.style.cssText='position:fixed;opacity:0';
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    doCopied(btn,code,id);
  }
});
function doCopied(btn,code,id){
  toast('"'+code+'" copied to clipboard!');
  btn.textContent='Copied!';btn.style.background='rgba(34,197,94,.15)';btn.style.color='#22c55e';btn.style.borderColor='#22c55e';
  api('/api/promos/'+id+'/copy',{method:'POST'});
  setTimeout(function(){btn.textContent='Copy';btn.style.background='';btn.style.color='';btn.style.borderColor=''},2000);
}

// Promo filters
document.getElementById('promoFilters').addEventListener('click',function(e){
  var chip = e.target.closest('.chip[data-pf]');
  if(!chip) return;
  this.querySelectorAll('.chip').forEach(function(c){c.classList.remove('active')});
  chip.classList.add('active');
  promoFilter = chip.dataset.pf;
  loadPromos();
});

// ─── Calculator ───
var calcFood = document.getElementById('calcFood');
var customField = document.getElementById('customField');
if(calcFood) calcFood.onchange = function(){
  customField.style.display = this.value==='custom'?'block':'none';
};

document.getElementById('calcBtn').onclick = function(){
  var sel = calcFood;
  var price = sel.value==='custom' ? parseInt(document.getElementById('calcCustom').value)||0 : parseInt(sel.value);
  var name = sel.options[sel.selectedIndex].dataset.name || 'Custom';
  if(price<=0){toast('Enter a valid price');return}
  var qty = parseInt(document.getElementById('calcQty').value)||1;
  var dist = document.getElementById('calcDist').value;
  var promo = document.getElementById('calcPromo').value;
  var peak = document.getElementById('calcPeak').checked;

  api('/api/calculator/compare',{
    method:'POST',
    body:JSON.stringify({food_item:name,food_price:price,quantity:qty,distance:dist,promo_code:promo,is_peak:peak})
  }).then(function(res){
    if(!res.success){toast(res.error||'Error');return}
    var container = document.getElementById('calcResults');
    var cheapest = res.data[0].total;
    container.innerHTML = '<h3 class="panel-title" style="margin-bottom:16px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Results</h3>';

    res.data.forEach(function(r,i){
      var isWin = r.total === cheapest;
      var diff = r.total - cheapest;
      var div = document.createElement('div');
      div.className = 'result-item'+(isWin?' winner':'');
      div.style.animationDelay = (i*0.12)+'s';
      var h = '<div class="result-head"><span class="result-name">'+r.platform_icon+' '+r.platform_name+' <span class="result-badge">CHEAPEST</span></span><span class="result-total">৳'+r.total+'</span></div>';
      h += '<div class="result-row"><span>Food ('+name+' × '+qty+')</span><span>৳'+r.food_total+'</span></div>';
      h += '<div class="result-row"><span>Delivery</span><span>৳'+r.delivery_fee+'</span></div>';
      if(r.surge_extra>0) h += '<div class="result-row"><span>⚡ Surge</span><span style="color:var(--red)">+৳'+r.surge_extra+'</span></div>';
      h += '<div class="result-row"><span>Service Fee</span><span>৳'+r.service_fee+'</span></div>';
      if(r.discount>0) h += '<div class="result-row"><span>🎟️ '+r.discount_label+'</span><span style="color:var(--green)">-৳'+r.discount+'</span></div>';
      if(isWin) h += '<div class="result-note" style="color:var(--green)">✅ Best price!</div>';
      else if(diff>0) h += '<div class="result-note" style="color:var(--red)">⬆ ৳'+diff+' more</div>';
      div.innerHTML = h;
      container.appendChild(div);
    });

    var sum = document.createElement('div');
    sum.style.cssText='text-align:center;padding:14px;font-size:.85rem;color:var(--text2)';
    var maxDiff = res.data[res.data.length-1].total - cheapest;
    sum.innerHTML='💡 <strong style="color:var(--green)">'+res.data[0].platform_name+'</strong> saves you up to <strong style="color:var(--green)">৳'+maxDiff+'</strong> on this order.';
    container.appendChild(sum);

    if(window.innerWidth<1024) container.scrollIntoView({behavior:'smooth'});
  });
};

// ─── Report Form ───
document.getElementById('reportForm').addEventListener('submit',function(e){
  e.preventDefault();
  var data = {
    reporter_name: document.getElementById('repName').value,
    reporter_email: document.getElementById('repEmail').value,
    platform_slug: document.getElementById('repPlatform').value,
    deal_type: document.getElementById('repType').value,
    title: document.getElementById('repTitle').value,
    description: document.getElementById('repDesc').value,
    promo_code: document.getElementById('repCode').value,
    area: document.getElementById('repArea').value
  };
  api('/api/deals/report',{method:'POST',body:JSON.stringify(data)}).then(function(res){
    if(res.success){
      toast('✅ Deal reported! We\'ll verify it soon.');
      document.getElementById('reportForm').reset();
    } else {
      toast('❌ '+res.error);
    }
  });
});

// ─── Stats ───
function loadStats() {
  api('/api/stats').then(function(res){
    if(!res.success) return;
    var d = res.data;
    var el = document.getElementById('footerStats');
    if(el) el.innerHTML = d.totalDeals+' active deals<br>'+d.totalPromos+' promo codes<br>'+d.totalComparisons+' comparisons made';
    // Update hero metrics
    var m1 = document.querySelector('.metric-num[data-target]');
    if(m1) m1.setAttribute('data-target', d.totalDeals);
    var metrics = document.querySelectorAll('.metric-num[data-target]');
    if(metrics[1]) metrics[1].setAttribute('data-target', d.totalPromos);
  });
}

// ─── Init ───
document.addEventListener('DOMContentLoaded',function(){
  loadPlatforms();
  loadDeals();
  loadPromos();
  loadStats();
  if(window.scrollY<100) setTimeout(animateCounters,600);
});
