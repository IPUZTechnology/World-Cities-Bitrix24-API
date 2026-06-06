// World Cities - Bitrix24 Widget Worker
// Patron basado en Convertalk install handler

const CITIES_URL = 'https://world-cities-bitrix24-api.pages.dev/src/cities.json';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event));
});

async function handleRequest(request, event) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Servir cities.json
  if (path.includes('cities.json')) {
    return fetch(CITIES_URL);
  }

  // ── INSTALL HANDLER ─────────────────────────────────────
  // Bitrix24 llama este endpoint con POST durante instalacion
  if (path === '/install' || path === '' || path === '/') {
    if (request.method === 'POST') {
      return handleInstall(request, event, url, corsHeaders);
    }
    // GET → servir pagina de bienvenida
    return new Response(renderWelcomePage(), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // ── WIDGET HANDLER ───────────────────────────────────────
  // Bitrix llama este endpoint cuando abre el placement en el Deal
  if (path === '/widget') {
    return handleWidget(request, url, corsHeaders);
  }

  // ── CONFIG HANDLER ───────────────────────────────────────
  if (path === '/config') {
    return handleConfig(request, url, corsHeaders);
  }

  return new Response('Not found', { status: 404 });
}

// ── INSTALL ──────────────────────────────────────────────
async function handleInstall(request, event, url, corsHeaders) {
  try {
    const fd = await request.formData();

    const domain = String(
      fd.get('DOMAIN') || fd.get('domain') ||
      url.searchParams.get('DOMAIN') || url.searchParams.get('domain') || ''
    ).trim().toLowerCase();

    const accessToken = String(
      fd.get('auth[access_token]') ||
      fd.get('access_token') ||
      fd.get('AUTH_ID') || ''
    ).trim();

    const refreshToken = String(
      fd.get('auth[refresh_token]') ||
      fd.get('refresh_token') ||
      fd.get('REFRESH_ID') || ''
    ).trim();

    const serverEndpoint = String(fd.get('server_endpoint') || fd.get('SERVER_ENDPOINT') || '').trim();

    // Derivar tenant del dominio (megatravel.bitrix24.co → megatravel)
    let tenant = '';
    const m = domain.match(/^([a-z0-9-]+)\.bitrix24\.[a-z]{2,}$/i);
    tenant = (m && m[1]) ? m[1].toLowerCase() : domain.toLowerCase();

    // Guardar OAuth en KV
    if (accessToken && TENANT_CONFIG) {
      const record = {
        storedAt: new Date().toISOString(),
        tenant,
        domain: domain || null,
        auth: {
          access_token: accessToken,
          refresh_token: refreshToken || null,
          domain: domain || null,
          server_endpoint: serverEndpoint || null,
        }
      };
      event.waitUntil(TENANT_CONFIG.put('oauth:tenant:' + tenant, JSON.stringify(record)));
      if (domain) {
        event.waitUntil(TENANT_CONFIG.put('oauth:domain:' + domain, JSON.stringify(record)));
        event.waitUntil(TENANT_CONFIG.put('tenant_domain:' + domain, tenant));
      }

      // Registrar placements via REST
      const origin = new URL(request.url).origin;
      const widgetUrl = origin + '/widget';
      const restBase = 'https://' + domain + '/rest/';

      event.waitUntil(bindPlacements(restBase, accessToken, widgetUrl));
    }

    // Responder con HTML de confirmacion (Bitrix lo muestra en popup)
    return new Response(renderInstallSuccess(tenant, domain), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (e) {
    return new Response(renderInstallError(String(e)), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

async function bindPlacements(restBase, accessToken, widgetUrl) {
  const placements = ['CRM_DEAL_DETAIL_TAB', 'CRM_LEAD_DETAIL_TAB'];
  for (const placement of placements) {
    try {
      await fetch(restBase + 'placement.bind.json?auth=' + encodeURIComponent(accessToken), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          PLACEMENT: placement,
          HANDLER: widgetUrl,
          TITLE: 'Destinos',
          DESCRIPTION: 'Buscar ciudades del mundo'
        })
      });
    } catch(e) {}
  }
}

// ── WIDGET ───────────────────────────────────────────────
async function handleWidget(request, url, corsHeaders) {
  const domain = String(
    url.searchParams.get('DOMAIN') ||
    url.searchParams.get('domain') || ''
  ).trim().toLowerCase();

  // Obtener config de campos UF desde KV
  let fieldCfg = { destinos: '', pais: '', region: '' };
  if (TENANT_CONFIG && domain) {
    const raw = await TENANT_CONFIG.get('fields:' + domain);
    if (raw) {
      try { fieldCfg = JSON.parse(raw); } catch(e) {}
    }
  }

  return new Response(renderWidget(fieldCfg, domain), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ── CONFIG SAVE ──────────────────────────────────────────
async function handleConfig(request, url, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  try {
    const body = await request.json();
    const domain = String(body.domain || '').trim().toLowerCase();
    if (!domain) return new Response(JSON.stringify({ ok: false, error: 'No domain' }), { status: 400 });

    if (TENANT_CONFIG) {
      await TENANT_CONFIG.put('fields:' + domain, JSON.stringify({
        destinos: body.destinos || '',
        pais: body.pais || '',
        region: body.region || ''
      }));
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch(e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}

// ── HTML TEMPLATES ───────────────────────────────────────
function renderInstallSuccess(tenant, domain) {
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<script src="//api.bitrix24.com/api/v1/"><\/script>' +
    '<style>body{font-family:Arial,sans-serif;padding:30px;text-align:center}' +
    '.ok{color:#2d9e5f;font-size:18px;font-weight:600}' +
    'p{color:#666;font-size:13px;margin-top:8px}</style></head><body>' +
    '<div class="ok">Destinos instalado correctamente</div>' +
    '<p>Portal: ' + domain + '</p>' +
    '<p>Abre un Deal y busca la pestana Destinos.</p>' +
    '<script>BX24.init(function(){ setTimeout(function(){ BX24.closeApplication(); }, 3000); });<\/script>' +
    '</body></html>';
}

function renderInstallError(err) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>' +
    '<p style="color:red">Error en instalacion: ' + err + '</p>' +
    '</body></html>';
}

function renderWelcomePage() {
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<style>body{font-family:Arial,sans-serif;padding:40px;text-align:center;color:#333}' +
    'h2{color:#5b6cf6}</style></head><body>' +
    '<h2>Destinos / World Cities</h2>' +
    '<p>Widget de busqueda de ciudades para Bitrix24</p>' +
    '<p style="color:#888;font-size:12px">by RIPUZ</p>' +
    '</body></html>';
}

function renderWidget(fieldCfg, domain) {
  const WORKER_URL = 'https://world-cities-bitrix24.ripuz.workers.dev';

  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<script src="//api.bitrix24.com/api/v1/"><\/script>' +
    '<style>' +
    '* { box-sizing: border-box; margin: 0; padding: 0; }' +
    'body { font-family: Arial, sans-serif; font-size: 14px; color: #333; background: #fff; padding: 12px; }' +
    '#loading { text-align: center; padding: 20px; color: #aaa; font-size: 13px; }' +
    '.srow { margin-bottom: 10px; }' +
    '.srow label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }' +
    '.srow input { width: 100%; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; }' +
    '.btn-blue { background: #5b6cf6; color: #fff; border: none; border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer; width: 100%; margin-top: 4px; }' +
    '.btn-blue:disabled { background: #bbb; cursor: not-allowed; }' +
    '.w-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }' +
    '.w-title { font-size: 13px; font-weight: 600; color: #444; }' +
    '.btn-cfg { background: none; border: none; cursor: pointer; color: #aaa; font-size: 13px; padding: 2px 4px; }' +
    '.sw { position: relative; margin-bottom: 4px; }' +
    '.sw input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; }' +
    '.sw input:focus { outline: none; border-color: #5b6cf6; }' +
    '#dropdown { display: none; position: absolute; z-index: 9999; background: #fff; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.1); max-height: 200px; overflow-y: auto; width: 100%; margin-top: 4px; }' +
    '.di { padding: 8px 12px; cursor: pointer; font-size: 13px; border-bottom: 1px solid #f0f0f0; }' +
    '.di:last-child { border-bottom: none; }' +
    '.di:hover { background: #f0f2ff; }' +
    '.dc { font-weight: 600; color: #333; }' +
    '.dm { font-size: 11px; color: #888; margin-top: 1px; }' +
    '.de { padding: 12px; text-align: center; color: #aaa; font-size: 12px; }' +
    '#tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; min-height: 4px; }' +
    '.tag { display: flex; align-items: center; gap: 5px; background: #eef0ff; border: 1px solid #c5caff; border-radius: 20px; padding: 4px 10px; font-size: 12px; color: #3a47c9; }' +
    '.tag span { max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
    '.tr { cursor: pointer; color: #8891e0; font-size: 14px; line-height: 1; }' +
    '.tr:hover { color: #e05555; }' +
    '#btn-apply { display: none; margin-top: 12px; width: 100%; padding: 9px; background: #5b6cf6; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }' +
    '#btn-apply:disabled { background: #bbb; cursor: not-allowed; }' +
    '#status-msg { margin-top: 8px; font-size: 12px; text-align: center; min-height: 16px; }' +
    '#cfg-panel { display: none; background: #f7f7f7; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 12px; }' +
    '.msg-ok { color: #2d9e5f; } .msg-err { color: #e05555; } .msg-info { color: #5b6cf6; }' +
    '</style></head><body>' +
    '<div id="loading">Iniciando...</div>' +
    '<div id="app" style="display:none"></div>' +
    '<script>' +
    'var CITIES_URL = "' + CITIES_URL + '";' +
    'var WORKER_URL = "' + WORKER_URL + '";' +
    'var FIELD_DESTINOS = "' + fieldCfg.destinos + '";' +
    'var FIELD_PAIS = "' + fieldCfg.pais + '";' +
    'var FIELD_REGION = "' + fieldCfg.region + '";' +
    'var DOMAIN = "' + domain + '";' +
    'var allCities=[], selected=[], dropIndex=-1, ENTITY_ID="", PLACEMENT="";' +

    'BX24.init(function() {' +
    '  var info = BX24.placement.info();' +
    '  PLACEMENT = info.placement || "";' +
    '  ENTITY_ID = (info.options && info.options.ID) ? String(info.options.ID) : "";' +
    '  if (!DOMAIN) DOMAIN = String(BX24.getDomain ? BX24.getDomain() : "");' +
    '  document.getElementById("loading").style.display = "none";' +
    '  document.getElementById("app").style.display = "block";' +
    '  renderApp();' +
    '});' +

    'function renderApp() {' +
    '  var app = document.getElementById("app");' +
    '  var cfgOk = FIELD_DESTINOS && FIELD_PAIS && FIELD_REGION;' +
    '  app.innerHTML =' +
    '    "<div class=\\"w-header\\"><span class=\\"w-title\\">Destinos</span>" +' +
    '    "<button class=\\"btn-cfg\\" onclick=\\"toggleCfg()\\">Config</button></div>" +' +
    '    "<div id=\\"cfg-panel\\">" +' +
    '    "<div class=\\"srow\\"><label>ID Campo Destinos/Ciudades</label><input type=\\"text\\" id=\\"f-destinos\\" value=\\"" + FIELD_DESTINOS + "\\" placeholder=\\"UF_CRM_XXXXXXXXXX\\"></div>" +' +
    '    "<div class=\\"srow\\"><label>ID Campo Pais</label><input type=\\"text\\" id=\\"f-pais\\" value=\\"" + FIELD_PAIS + "\\" placeholder=\\"UF_CRM_XXXXXXXXXX\\"></div>" +' +
    '    "<div class=\\"srow\\"><label>ID Campo Region</label><input type=\\"text\\" id=\\"f-region\\" value=\\"" + FIELD_REGION + "\\" placeholder=\\"UF_CRM_XXXXXXXXXX\\"></div>" +' +
    '    "<button class=\\"btn-blue\\" onclick=\\"saveCfg()\\">Guardar configuracion</button>" +' +
    '    "<div id=\\"cfg-status\\" style=\\"margin-top:8px;font-size:12px\\"></div></div>" +' +
    '    "<div class=\\"sw\\"><input type=\\"text\\" id=\\"search-input\\" placeholder=\\"Escribe una ciudad...\\" autocomplete=\\"off\\" oninput=\\"onSearch(this.value)\\" onkeydown=\\"onKeyDown(event)\\">" +' +
    '    "<div id=\\"dropdown\\"></div></div>" +' +
    '    "<div id=\\"tags\\"></div>" +' +
    '    "<button id=\\"btn-apply\\" onclick=\\"applyToDeal()\\">Guardar en Deal</button>" +' +
    '    "<div id=\\"status-msg\\"></div>";' +
    '  if (!cfgOk) {' +
    '    document.getElementById("cfg-panel").style.display = "block";' +
    '    setStatus("Configura los campos UF arriba.", "err");' +
    '  } else {' +
    '    loadCities();' +
    '    if (ENTITY_ID) loadExisting();' +
    '  }' +
    '}' +

    'function toggleCfg() {' +
    '  var p = document.getElementById("cfg-panel");' +
    '  p.style.display = p.style.display === "none" ? "block" : "none";' +
    '}' +

    'function saveCfg() {' +
    '  var d = FIELD_DESTINOS = document.getElementById("f-destinos").value.trim();' +
    '  var p = FIELD_PAIS = document.getElementById("f-pais").value.trim();' +
    '  var r = FIELD_REGION = document.getElementById("f-region").value.trim();' +
    '  if (!d || !p || !r) { alert("Completa los 3 campos."); return; }' +
    '  fetch(WORKER_URL + "/config", {' +
    '    method: "POST",' +
    '    headers: { "Content-Type": "application/json" },' +
    '    body: JSON.stringify({ domain: DOMAIN, destinos: d, pais: p, region: r })' +
    '  }).then(function(res){ return res.json(); })' +
    '  .then(function(j) {' +
    '    var el = document.getElementById("cfg-status");' +
    '    if (j.ok) {' +
    '      el.textContent = "Guardado correctamente";' +
    '      el.style.color = "#2d9e5f";' +
    '      document.getElementById("cfg-panel").style.display = "none";' +
    '      loadCities();' +
    '      if (ENTITY_ID) loadExisting();' +
    '    } else {' +
    '      el.textContent = "Error: " + (j.error || "");' +
    '      el.style.color = "#e05555";' +
    '    }' +
    '  });' +
    '}' +

    'function loadCities() {' +
    '  setStatus("Cargando ciudades...", "info");' +
    '  fetch(CITIES_URL).then(function(r){return r.json();})' +
    '  .then(function(data){ allCities=data; setStatus("",""); })' +
    '  .catch(function(){ setStatus("Error cargando ciudades.","err"); });' +
    '}' +

    'function loadExisting() {' +
    '  if (!FIELD_DESTINOS || !ENTITY_ID) return;' +
    '  var entity = PLACEMENT.indexOf("LEAD") >= 0 ? "crm.lead" : "crm.deal";' +
    '  BX24.callMethod(entity + ".get", { id: ENTITY_ID }, function(r) {' +
    '    if (r.error()) return;' +
    '    var data = r.data();' +
    '    var ciudadesStr = data[FIELD_DESTINOS] || "";' +
    '    var paisesStr = data[FIELD_PAIS] || "";' +
    '    var regionesStr = data[FIELD_REGION] || "";' +
    '    if (!ciudadesStr) return;' +
    '    var ciudades = ciudadesStr.split(", ");' +
    '    var paises = paisesStr.split(", ");' +
    '    var regiones = regionesStr.split(", ");' +
    '    selected = [];' +
    '    for (var i=0;i<ciudades.length;i++) {' +
    '      if (ciudades[i]) selected.push({ ciudad: ciudades[i], pais: paises[i]||"", region: regiones[i]||"" });' +
    '    }' +
    '    renderTags();' +
    '    if (selected.length) document.getElementById("btn-apply").style.display = "block";' +
    '  });' +
    '}' +

    'function onSearch(val) {' +
    '  dropIndex=-1;' +
    '  var q=val.trim().toLowerCase();' +
    '  if (q.length<2) { closeDropdown(); return; }' +
    '  var results=allCities.filter(function(c){return c.ciudad.toLowerCase().indexOf(q)===0;}).slice(0,50);' +
    '  var dd=document.getElementById("dropdown");' +
    '  if (!results.length) { dd.innerHTML="<div class=\\"de\\">Sin resultados</div>"; dd.style.display="block"; return; }' +
    '  var h="";' +
    '  for (var i=0;i<results.length;i++) {' +
    '    var idx=allCities.indexOf(results[i]);' +
    '    h+="<div class=\\"di\\" onmousedown=\\"pick("+idx+")\\">" +' +
    '      "<div class=\\"dc\\">"+hl(results[i].ciudad,q)+"</div>" +' +
    '      "<div class=\\"dm\\">"+results[i].pais+" - "+results[i].region+"</div></div>";' +
    '  }' +
    '  dd.innerHTML=h; dd.style.display="block";' +
    '}' +

    'function hl(city,q) {' +
    '  var i=city.toLowerCase().indexOf(q.toLowerCase());' +
    '  if (i<0) return city;' +
    '  return city.slice(0,i)+"<strong>"+city.slice(i,i+q.length)+"</strong>"+city.slice(i+q.length);' +
    '}' +

    'function closeDropdown() { var dd=document.getElementById("dropdown"); if(dd) dd.style.display="none"; }' +

    'function onKeyDown(e) {' +
    '  var items=document.querySelectorAll(".di");' +
    '  if (e.key==="ArrowDown") { dropIndex=Math.min(dropIndex+1,items.length-1); items.forEach(function(el,i){el.style.background=i===dropIndex?"#f0f2ff":"";});}' +
    '  else if (e.key==="ArrowUp") { dropIndex=Math.max(dropIndex-1,0); items.forEach(function(el,i){el.style.background=i===dropIndex?"#f0f2ff":"";});}' +
    '  else if (e.key==="Enter"&&dropIndex>=0) { items[dropIndex].dispatchEvent(new MouseEvent("mousedown")); }' +
    '  else if (e.key==="Escape") { closeDropdown(); }' +
    '}' +

    'function pick(idx) {' +
    '  var c=allCities[idx]; if (!c) return;' +
    '  closeDropdown();' +
    '  document.getElementById("search-input").value="";' +
    '  if(selected.find(function(s){return s.ciudad===c.ciudad&&s.pais===c.pais;})) return;' +
    '  selected.push({ciudad:c.ciudad,pais:c.pais,region:c.region});' +
    '  renderTags();' +
    '  document.getElementById("btn-apply").style.display="block";' +
    '}' +

    'function removeCity(i) {' +
    '  selected.splice(i,1); renderTags();' +
    '  if(!selected.length) document.getElementById("btn-apply").style.display="none";' +
    '}' +

    'function renderTags() {' +
    '  var h="";' +
    '  for(var i=0;i<selected.length;i++){' +
    '    h+="<div class=\\"tag\\"><span>"+selected[i].ciudad+"</span><span class=\\"tr\\" onclick=\\"removeCity("+i+")\\">x</span></div>";' +
    '  }' +
    '  document.getElementById("tags").innerHTML=h;' +
    '}' +

    'function applyToDeal() {' +
    '  if(!selected.length||!ENTITY_ID||!FIELD_DESTINOS) return;' +
    '  var btn=document.getElementById("btn-apply");' +
    '  btn.disabled=true; btn.textContent="Guardando...";' +
    '  var ciudades=[],paises=[],regiones=[];' +
    '  for(var i=0;i<selected.length;i++){' +
    '    ciudades.push(selected[i].ciudad);' +
    '    if(paises.indexOf(selected[i].pais)<0) paises.push(selected[i].pais);' +
    '    if(regiones.indexOf(selected[i].region)<0) regiones.push(selected[i].region);' +
    '  }' +
    '  var entity=PLACEMENT.indexOf("LEAD")>=0?"crm.lead":"crm.deal";' +
    '  var fields={};' +
    '  fields[FIELD_DESTINOS]=ciudades.join(", ");' +
    '  fields[FIELD_PAIS]=paises.join(", ");' +
    '  fields[FIELD_REGION]=regiones.join(", ");' +
    '  BX24.callMethod(entity+".update",{id:ENTITY_ID,fields:fields},function(result){' +
    '    if(result.error()){' +
    '      setStatus("Error: "+result.error(),"err");' +
    '      btn.disabled=false; btn.textContent="Guardar en Deal";' +
    '    } else {' +
    '      setStatus("Guardado correctamente","ok");' +
    '      btn.textContent="Guardado";' +
    '      setTimeout(function(){btn.textContent="Guardar en Deal";btn.disabled=false;},2500);' +
    '    }' +
    '  });' +
    '}' +

    'function setStatus(msg,type){' +
    '  var el=document.getElementById("status-msg");' +
    '  if(!el) return;' +
    '  el.textContent=msg;' +
    '  el.className=type==="ok"?"msg-ok":type==="err"?"msg-err":"msg-info";' +
    '}' +

    'document.addEventListener("click",function(e){' +
    '  if(!e.target.closest||!e.target.closest(".sw")) closeDropdown();' +
    '});' +
    '<\/script></body></html>';
}
