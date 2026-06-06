addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseHeaders });
  }

  // Redirige cities.json a Pages
  if (url.pathname.includes('cities.json')) {
    return fetch('https://world-cities-bitrix24-api.pages.dev/src/cities.json');
  }

  const CITIES_URL = 'https://world-cities-bitrix24-api.pages.dev/src/cities.json';
  const HANDLER    = 'https://world-cities-bitrix24.ripuz.workers.dev';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Destinos - RIPUZ</title>
<script src="//api.bitrix24.com/api/v1/"><\/script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 14px; color: #333; background: #fff; padding: 12px; }
  #loading { text-align: center; padding: 20px; color: #aaa; font-size: 13px; }
  #setup-panel { text-align: center; padding: 20px 12px; }
  #setup-panel h3 { font-size: 15px; font-weight: 600; color: #333; margin-bottom: 8px; }
  #setup-panel p { font-size: 12px; color: #888; margin-bottom: 20px; }
  .btn-primary { background: #5b6cf6; color: #fff; border: none; border-radius: 8px; padding: 10px 24px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; margin-bottom: 8px; }
  .btn-primary:hover { background: #4a5ae0; }
  .btn-primary:disabled { background: #bbb; cursor: not-allowed; }
  #install-status { font-size: 12px; margin-top: 8px; min-height: 16px; }
  #settings-panel { display: none; background: #f7f7f7; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  #settings-panel h3 { font-size: 12px; color: #777; margin-bottom: 12px; text-transform: uppercase; letter-spacing: .5px; }
  .setting-row { margin-bottom: 10px; }
  .setting-row label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }
  .setting-row input { width: 100%; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; }
  .setting-row input:focus { outline: none; border-color: #5b6cf6; }
  .btn-save { background: #5b6cf6; color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font-size: 13px; cursor: pointer; margin-top: 4px; }
  .btn-cancel { background: none; border: none; color: #999; font-size: 12px; cursor: pointer; margin-left: 10px; }
  .widget-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .widget-title { font-size: 13px; font-weight: 600; color: #444; }
  .btn-gear { background: none; border: none; cursor: pointer; color: #aaa; font-size: 15px; padding: 2px 4px; }
  .btn-gear:hover { color: #5b6cf6; }
  .search-wrap { position: relative; }
  .search-wrap input { width: 100%; padding: 8px 12px 8px 34px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; }
  .search-wrap input:focus { outline: none; border-color: #5b6cf6; box-shadow: 0 0 0 2px rgba(91,108,246,.12); }
  .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #bbb; font-size: 13px; pointer-events: none; }
  #dropdown { display: none; position: absolute; z-index: 9999; background: #fff; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.1); max-height: 200px; overflow-y: auto; width: 100%; margin-top: 4px; }
  .drop-item { padding: 8px 12px; cursor: pointer; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  .drop-item:last-child { border-bottom: none; }
  .drop-item:hover, .drop-item.active { background: #f0f2ff; }
  .drop-city { font-weight: 600; color: #333; }
  .drop-meta { font-size: 11px; color: #888; margin-top: 1px; }
  .drop-empty { padding: 12px; text-align: center; color: #aaa; font-size: 12px; }
  #tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; min-height: 4px; }
  .tag { display: flex; align-items: center; gap: 5px; background: #eef0ff; border: 1px solid #c5caff; border-radius: 20px; padding: 4px 10px; font-size: 12px; color: #3a47c9; }
  .tag span { max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tag-remove { cursor: pointer; color: #8891e0; font-size: 14px; line-height: 1; }
  .tag-remove:hover { color: #e05555; }
  #btn-apply { display: none; margin-top: 12px; width: 100%; padding: 9px; background: #5b6cf6; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
  #btn-apply:hover { background: #4a5ae0; }
  #btn-apply:disabled { background: #bbb; cursor: not-allowed; }
  #status-msg { margin-top: 8px; font-size: 12px; text-align: center; min-height: 16px; }
  #not-configured { text-align: center; padding: 20px 10px; color: #aaa; font-size: 12px; }
  #not-configured button { margin-top: 8px; background: none; border: 1px solid #ddd; border-radius: 6px; padding: 6px 14px; font-size: 12px; cursor: pointer; color: #666; }
  .msg-ok { color: #2d9e5f; } .msg-err { color: #e05555; } .msg-info { color: #5b6cf6; }
</style>
</head>
<body>
<div id="loading">Iniciando...</div>
<div id="app" style="display:none"></div>
<script>
  var CITIES_URL = '${CITIES_URL}';
  var HANDLER    = '${HANDLER}';
  var allCities=[], selected=[], dropIndex=-1, cfg={}, ENTITY_ID='', PLACEMENT='';

  BX24.init(function() {
    var info  = BX24.placement.info();
    PLACEMENT = info.placement || '';
    ENTITY_ID = (info.options && info.options.ID) ? String(info.options.ID) : '';
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display     = 'block';

    if (PLACEMENT !== 'CRM_DEAL_DETAIL_TAB' && PLACEMENT !== 'CRM_LEAD_DETAIL_TAB') {
      showSetupPanel(); return;
    }
    BX24.appOption.get('destinos_cfg', function(val) {
      if (val) { try { cfg = JSON.parse(val); } catch(e) { cfg={}; } }
      showWidget();
    });
  });

  function showSetupPanel() {
    document.getElementById('app').innerHTML =
      '<div id="setup-panel">' +
      '<h3>🌍 Destinos / World Cities</h3>' +
      '<p>Registra el widget en Deals y Leads de este portal.</p>' +
      '<button class="btn-primary" onclick="installPlacements()">Instalar widget en Deals y Leads</button>' +
      '<div id="install-status"></div></div>';
  }

  function installPlacements() {
    var btn = document.querySelector('.btn-primary');
    btn.disabled = true;
    setInstallStatus('Registrando en Deals...', 'info');
    BX24.callMethod('placement.bind', {PLACEMENT:'CRM_DEAL_DETAIL_TAB', HANDLER:HANDLER, TITLE:'Destinos'}, function(r1) {
      setInstallStatus('Registrando en Leads...', 'info');
      BX24.callMethod('placement.bind', {PLACEMENT:'CRM_LEAD_DETAIL_TAB', HANDLER:HANDLER, TITLE:'Destinos'}, function(r2) {
        setInstallStatus('✓ Listo. Abre un Deal y busca la pestaña Destinos.', 'ok');
        btn.textContent = '✓ Instalado';
      });
    });
  }

  function setInstallStatus(msg, type) {
    var el = document.getElementById('install-status');
    if (el) { el.textContent=msg; el.className=type==='ok'?'msg-ok':type==='err'?'msg-err':'msg-info'; }
  }

  function showWidget() {
    document.getElementById('app').innerHTML =
      '<div class="widget-header"><span class="widget-title">🌍 Destinos</span>' +
      '<button class="btn-gear" onclick="toggleSettings()">⚙️</button></div>' +
      '<div id="settings-panel"><h3>Configuración</h3>' +
      '<div class="setting-row"><label>ID Campo País</label><input type="text" id="cfg-pais" placeholder="UF_CRM_XXXXXXXXXX"></div>' +
      '<div class="setting-row"><label>ID Campo Región</label><input type="text" id="cfg-region" placeholder="UF_CRM_XXXXXXXXXX"></div>' +
      '<button class="btn-save" onclick="saveConfig()">Guardar</button>' +
      '<button class="btn-cancel" onclick="toggleSettings()">Cancelar</button></div>' +
      '<div id="not-configured"><div>Widget no configurado aún</div>' +
      '<button onclick="toggleSettings()">⚙️ Configurar ahora</button></div>' +
      '<div id="search-section" style="display:none">' +
      '<div class="search-wrap"><span class="search-icon">🔍</span>' +
      '<input type="text" id="search-input" placeholder="Escribe una ciudad..." autocomplete="off" oninput="onSearch(this.value)" onkeydown="onKeyDown(event)">' +
      '<div id="dropdown"></div></div>' +
      '<div id="tags"></div>' +
      '<button id="btn-apply" onclick="applyToDeal()">Guardar en Deal</button>' +
      '<div id="status-msg"></div></div>';

    document.getElementById('cfg-pais').value   = cfg.pais   || '';
    document.getElementById('cfg-region').value = cfg.region || '';
    if (cfg.pais && cfg.region) {
      document.getElementById('not-configured').style.display = 'none';
      document.getElementById('search-section').style.display = 'block';
      loadCities();
    }
  }

  function toggleSettings() {
    var p=document.getElementById('settings-panel');
    p.style.display = p.style.display==='none' ? 'block' : 'none';
  }

  function saveConfig() {
    cfg = { pais: document.getElementById('cfg-pais').value.trim(), region: document.getElementById('cfg-region').value.trim() };
    if (!cfg.pais || !cfg.region) { alert('Completa los dos campos.'); return; }
    BX24.appOption.set('destinos_cfg', JSON.stringify(cfg), function() {
      toggleSettings();
      document.getElementById('not-configured').style.display = 'none';
      document.getElementById('search-section').style.display = 'block';
      if (!allCities.length) loadCities();
      setStatus('Configuración guardada ✓', 'ok');
    });
  }

  function loadCities() {
    setStatus('Cargando ciudades...', 'info');
    fetch(CITIES_URL)
      .then(function(r){return r.json();})
      .then(function(data){allCities=data; setStatus('','');})
      .catch(function(){setStatus('Error cargando ciudades.','err');});
  }

  function onSearch(val) {
    dropIndex=-1;
    var q=val.trim().toLowerCase();
    if (q.length<2) { closeDropdown(); return; }
    var results=allCities.filter(function(c){return c.ciudad.toLowerCase().indexOf(q)===0;}).slice(0,50);
    showDropdown(results,val.trim());
  }

  function showDropdown(results,q) {
    var dd=document.getElementById('dropdown');
    if (!results.length) { dd.innerHTML='<div class="drop-empty">Sin resultados</div>'; dd.style.display='block'; return; }
    dd.innerHTML=results.map(function(c,i){
      return '<div class="drop-item" onmousedown="selectCity(\''+esc(c.ciudad)+'\',\''+esc(c.pais)+'\',\''+esc(c.region)+'\')">' +
        '<div class="drop-city">'+highlight(c.ciudad,q)+'</div>' +
        '<div class="drop-meta">'+c.pais+' · '+c.region+'</div></div>';
    }).join('');
    dd.style.display='block';
  }

  function highlight(city,q) {
    var i=city.toLowerCase().indexOf(q.toLowerCase());
    if (i<0) return city;
    return city.slice(0,i)+'<strong>'+city.slice(i,i+q.length)+'</strong>'+city.slice(i+q.length);
  }

  function closeDropdown() { var dd=document.getElementById('dropdown'); if(dd) dd.style.display='none'; }

  function onKeyDown(e) {
    var items=document.querySelectorAll('.drop-item');
    if (e.key==='ArrowDown') { dropIndex=Math.min(dropIndex+1,items.length-1); highlightItem(items); }
    else if (e.key==='ArrowUp') { dropIndex=Math.max(dropIndex-1,0); highlightItem(items); }
    else if (e.key==='Enter' && dropIndex>=0) { items[dropIndex].dispatchEvent(new MouseEvent('mousedown')); }
    else if (e.key==='Escape') { closeDropdown(); }
  }

  function highlightItem(items) {
    items.forEach(function(el,i){el.classList.toggle('active',i===dropIndex);});
    if(items[dropIndex]) items[dropIndex].scrollIntoView({block:'nearest'});
  }

  function esc(s){return (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}

  function selectByIdx(idx) {
    var c = allCities[idx];
    if (c) selectCity(c.ciudad, c.pais, c.region);
  }

  function selectCity(ciudad,pais,region) {
    closeDropdown();
    document.getElementById('search-input').value='';
    if(selected.find(function(s){return s.ciudad===ciudad&&s.pais===pais;})) return;
    selected.push({ciudad:ciudad,pais:pais,region:region});
    renderTags();
    document.getElementById('btn-apply').style.display='block';
  }

  function removeCity(i) {
    selected.splice(i,1); renderTags();
    if(!selected.length) document.getElementById('btn-apply').style.display='none';
  }

  function renderTags() {
    document.getElementById('tags').innerHTML=selected.map(function(s,i){
      return '<div class="tag"><span title="'+s.ciudad+', '+s.pais+'">'+s.ciudad+'</span>' +
        '<span class="tag-remove" onclick="removeCity('+i+')">×</span></div>';
    }).join('');
  }

  function applyToDeal() {
    if(!selected.length||!ENTITY_ID) return;
    var btn=document.getElementById('btn-apply');
    btn.disabled=true; btn.textContent='Guardando...';
    var paises=unique(selected.map(function(s){return s.pais;})).join(', ');
    var regiones=unique(selected.map(function(s){return s.region;})).join(', ');
    var entity=PLACEMENT.indexOf('LEAD')>=0?'crm.lead':'crm.deal';
    var fields={}; fields[cfg.pais]=paises; fields[cfg.region]=regiones;
    BX24.callMethod(entity+'.update',{id:ENTITY_ID,fields:fields},function(result){
      if(result.error()){
        setStatus('Error: '+result.error(),'err');
        btn.disabled=false; btn.textContent='Guardar en Deal';
      } else {
        setStatus('✓ Guardado correctamente','ok');
        btn.textContent='✓ Guardado';
        setTimeout(function(){btn.textContent='Guardar en Deal';btn.disabled=false;},2500);
      }
    });
  }

  function unique(arr){return arr.filter(function(v,i,a){return a.indexOf(v)===i;});}

  function setStatus(msg,type){
    var el=document.getElementById('status-msg');
    if(!el) return;
    el.textContent=msg;
    el.className=type==='ok'?'msg-ok':type==='err'?'msg-err':'msg-info';
  }

  document.addEventListener('click',function(e){
    if(!e.target.closest||!e.target.closest('.search-wrap')) closeDropdown();
  });
<\/script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' }
  });
}
