const CITIES_URL = 'https://world-cities-bitrix24-api.pages.dev/src/cities.json';
const WORKER_URL = 'https://world-cities-bitrix24.ripuz.workers.dev';

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

  if (path.includes('cities.json')) {
    return fetch(CITIES_URL);
  }

  // ── REBIND (re-registrar placements sin reinstalar) ──────
  if (path === '/rebind' && request.method === 'GET') {
    const domain = String(url.searchParams.get('DOMAIN') || url.searchParams.get('domain') || '').trim().toLowerCase();
    if (!domain) return new Response('Falta DOMAIN', { status: 400 });
    let oauth = null;
    if (typeof TENANT_CONFIG !== 'undefined') {
      const raw = await TENANT_CONFIG.get('oauth:domain:' + domain).catch(() => null);
      if (raw) { try { oauth = JSON.parse(raw); } catch(e) {} }
    }
    if (!oauth?.auth?.access_token) return new Response('OAuth no encontrado para ' + domain, { status: 404 });
    await bindPlacements(domain, oauth.auth.access_token);
    return new Response('Placements re-registrados para ' + domain, { status: 200, headers: corsHeaders });
  }

  // ── CONFIG SAVE API ──────────────────────────────────────
  if (path === '/config' && request.method === 'POST') {
    return handleConfigSave(request, corsHeaders);
  }

  // ── FIELDS API — devuelve campos UF_ con labels reales ───
  // GET /fields?domain=megatravel.bitrix24.co
  if (path === '/fields' && request.method === 'GET') {
    const domain = String(url.searchParams.get('domain') || url.searchParams.get('DOMAIN') || '').trim().toLowerCase();
    if (!domain) return new Response(JSON.stringify({ ok: false, error: 'Falta domain' }), { status: 400, headers: corsHeaders });

    let oauth = null;
    if (typeof TENANT_CONFIG !== 'undefined') {
      const raw = await TENANT_CONFIG.get('oauth:domain:' + domain).catch(() => null);
      if (raw) { try { oauth = JSON.parse(raw); } catch(e) {} }
    }
    if (!oauth?.auth?.access_token) {
      return new Response(JSON.stringify({ ok: false, error: 'OAuth no encontrado para ' + domain }), { status: 404, headers: corsHeaders });
    }

    const accessToken = oauth.auth.access_token;
    const restBase = 'https://' + domain + '/rest/';

    try {
      // Llamar crm.userfield.list con OAuth del Worker (tiene permisos completos)
      const r = await fetch(restBase + 'crm.userfield.list.json?auth=' + encodeURIComponent(accessToken), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: { FIELD_NAME: 'ASC' }, filter: { ENTITY_ID: 'CRM_DEAL' } })
      });
      const data = await r.json();
      const items = data?.result || [];

      const fields = items.map(f => {
        const lbl = f.EDIT_FORM_LABEL || f.LIST_COLUMN_LABEL || {};
        const label = typeof lbl === 'object'
          ? (lbl['es'] || lbl['en'] || lbl[Object.keys(lbl)[0]] || f.FIELD_NAME)
          : String(lbl || f.FIELD_NAME);
        return { id: f.FIELD_NAME, label: label.trim() || f.FIELD_NAME };
      });

      return new Response(JSON.stringify({ ok: true, fields }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch(e) {
      return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: corsHeaders });
    }
  }

  // ── MAIN HANDLER (install + widget) ─────────────────────
  if (path === '' || path === '/' || path === '/install') {
    if (request.method === 'POST') {
      const fdPeek = await request.clone().formData().catch(() => null);
      // Bitrix24 puede enviar PLACEMENT en querystring o en body
      const placementQS = String(url.searchParams.get('PLACEMENT') || url.searchParams.get('placement') || '').trim();
      const placementBody = fdPeek ? String(fdPeek.get('PLACEMENT') || fdPeek.get('placement') || '').trim() : '';
      const placement = placementQS || placementBody;
      const domainQS = String(url.searchParams.get('DOMAIN') || url.searchParams.get('domain') || '').trim().toLowerCase();
      const domainBody = fdPeek ? String(fdPeek.get('DOMAIN') || fdPeek.get('domain') || '').trim().toLowerCase() : '';
      const domain = domainBody || domainQS;

      // DEBUG - mostrar placement recibido
      // Bitrix manda PLACEMENT=DEFAULT cuando abre desde LEFT_MENU
      // En ese caso el DOMAIN viene en querystring desde el handler registrado con ?DOMAIN=
      const isLeftMenu = placement === 'DEFAULT' || placement === 'LEFT_MENU' || 
                         placement.toLowerCase().includes('left') || placement.toLowerCase().includes('menu');
      if (isLeftMenu) {
        let fieldCfg = { destinos: '', pais: '', region: '' };
        if (typeof TENANT_CONFIG !== 'undefined' && domain) {
          const raw = await TENANT_CONFIG.get('fields:' + domain).catch(() => null);
          if (raw) { try { fieldCfg = JSON.parse(raw); } catch(e) {} }
        }
        return new Response(renderSettingsPage(fieldCfg, domain), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // Deal/Lead → widget
      if (placement && (placement.includes('DEAL') || placement.includes('LEAD'))) {
        let fieldCfg = { destinos: '', pais: '', region: '' };
        if (typeof TENANT_CONFIG !== 'undefined' && domain) {
          const raw = await TENANT_CONFIG.get('fields:' + domain).catch(() => null);
          if (raw) { try { fieldCfg = JSON.parse(raw); } catch(e) {} }
        }
        return new Response(renderWidget(fieldCfg, domain, placement), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // Si es DEFAULT sin AUTH_ID válido → es apertura desde LEFT_MENU, no instalación
      const authId = fdPeek ? String(fdPeek.get('AUTH_ID') || '').trim() : '';
      const isInstall = authId && authId.length > 10;

      // Instalación real — solo si trae AUTH_ID válido
      if (isInstall) return handleInstall(request, event, url, corsHeaders, fdPeek);
    }

    // GET con DOMAIN → LEFT_MENU o app abierta → settings
    const getDomain = String(url.searchParams.get('DOMAIN') || url.searchParams.get('domain') || '').trim().toLowerCase();
    if (getDomain) {
      let fieldCfg = { destinos: '', pais: '', region: '' };
      if (typeof TENANT_CONFIG !== 'undefined') {
        const raw = await TENANT_CONFIG.get('fields:' + getDomain).catch(() => null);
        if (raw) { try { fieldCfg = JSON.parse(raw); } catch(e) {} }
      }
      return new Response(renderSettingsPage(fieldCfg, getDomain), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    return new Response(renderWelcomePage(), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  return new Response('Not found', { status: 404 });
}

// ── INSTALL ──────────────────────────────────────────────
async function handleInstall(request, event, url, corsHeaders, fd) {
  try {
    if (!fd) fd = await request.formData().catch(() => null);
    if (!fd) return new Response(renderWelcomePage(), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });

    const domain = String(fd.get('DOMAIN') || fd.get('domain') || url.searchParams.get('DOMAIN') || '').trim().toLowerCase();
    const accessToken = String(fd.get('auth[access_token]') || fd.get('access_token') || fd.get('AUTH_ID') || '').trim();
    const refreshToken = String(fd.get('auth[refresh_token]') || fd.get('refresh_token') || fd.get('REFRESH_ID') || '').trim();
    const serverEndpoint = String(fd.get('server_endpoint') || fd.get('SERVER_ENDPOINT') || '').trim();

    const m = domain.match(/^([a-z0-9-]+)\.bitrix24\.[a-z]{2,}$/i);
    const tenant = (m && m[1]) ? m[1].toLowerCase() : domain.toLowerCase();

    if (accessToken && typeof TENANT_CONFIG !== 'undefined') {
      const record = {
        storedAt: new Date().toISOString(),
        tenant, domain: domain || null,
        auth: { access_token: accessToken, refresh_token: refreshToken || null, domain: domain || null, server_endpoint: serverEndpoint || null }
      };
      event.waitUntil(TENANT_CONFIG.put('oauth:tenant:' + tenant, JSON.stringify(record)));
      if (domain) {
        event.waitUntil(TENANT_CONFIG.put('oauth:domain:' + domain, JSON.stringify(record)));
        event.waitUntil(TENANT_CONFIG.put('tenant_domain:' + domain, tenant));
      }
      event.waitUntil(bindPlacements(domain, accessToken));
    }

    return new Response(renderInstallSuccess(tenant, domain), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch(e) {
    return new Response('<h3>Error: ' + String(e) + '</h3>', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function bindPlacements(domain, accessToken) {
  const restBase = 'https://' + domain + '/rest/';
  const placements = [
    { placement: 'CRM_DEAL_DETAIL_TAB', title: 'Destinos', handler: WORKER_URL },
    { placement: 'CRM_LEAD_DETAIL_TAB', title: 'Destinos', handler: WORKER_URL },
    // LEFT_MENU necesita DOMAIN en la URL para que el GET lo detecte correctamente
    { placement: 'LEFT_MENU', title: 'Destinos Config', handler: WORKER_URL + '?DOMAIN=' + encodeURIComponent(domain) }
  ];
  for (const p of placements) {
    try {
      await fetch(restBase + 'placement.bind.json?auth=' + encodeURIComponent(accessToken), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ PLACEMENT: p.placement, HANDLER: p.handler, TITLE: p.title })
      });
    } catch(e) {}
  }
}

// ── CONFIG SAVE ──────────────────────────────────────────
async function handleConfigSave(request, corsHeaders) {
  try {
    const body = await request.json();
    const domain = String(body.domain || '').trim().toLowerCase();
    if (!domain) return new Response(JSON.stringify({ ok: false, error: 'No domain' }), { status: 400, headers: corsHeaders });
    if (typeof TENANT_CONFIG !== 'undefined') {
      await TENANT_CONFIG.put('fields:' + domain, JSON.stringify({
        destinos: body.destinos || '',
        pais: body.pais || '',
        region: body.region || ''
      }));
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: corsHeaders });
  }
}

// ── SETTINGS PAGE (LEFT_MENU) ────────────────────────────
function renderSettingsPage(fieldCfg, domain) {
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<script src="//api.bitrix24.com/api/v1/"><\/script>' +
    '<style>' +
    '* { box-sizing: border-box; margin: 0; padding: 0; }' +
    'body { font-family: Arial, sans-serif; font-size: 14px; color: #333; background: #fff; }' +
    '.hero { width: 100%; height: 180px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #533483 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; position: relative; overflow: hidden; }' +
    '.hero-circles { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }' +
    '.hero-circle { position: absolute; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1); }' +
    '.hero-title { color: #fff; font-size: 22px; font-weight: 700; letter-spacing: 2px; z-index: 1; }' +
    '.hero-sub { color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 6px; z-index: 1; letter-spacing: 1px; }' +
    '.hero-icon { font-size: 36px; margin-bottom: 8px; z-index: 1; }' +
    '.content { padding: 24px; }' +
    'h3 { font-size: 14px; font-weight: 600; color: #555; margin-bottom: 16px; text-transform: uppercase; letter-spacing: .5px; }' +
    '.srow { margin-bottom: 14px; }' +
    '.srow label { display: block; font-size: 12px; color: #666; margin-bottom: 5px; font-weight: 500; }' +
    '.srow input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; font-family: monospace; }' +
    '.srow input:focus { outline: none; border-color: #5b6cf6; box-shadow: 0 0 0 2px rgba(91,108,246,.12); }' +
    '.btn-save { background: linear-gradient(135deg, #5b6cf6, #7c3aed); color: #fff; border: none; border-radius: 8px; padding: 12px 20px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; margin-top: 8px; }' +
    '.btn-save:hover { opacity: 0.9; }' +
    '.btn-save:disabled { background: #bbb; cursor: not-allowed; }' +
    '#cfg-status { margin-top: 12px; font-size: 13px; text-align: center; min-height: 20px; padding: 8px; border-radius: 6px; }' +
    '.msg-ok { color: #2d9e5f; background: #f0faf5; }' +
    '.msg-err { color: #e05555; background: #fff5f5; }' +
    '.divider { height: 1px; background: #f0f0f0; margin: 20px 0; }' +
    '.hint { font-size: 11px; color: #aaa; margin-top: 4px; }' +
    '</style></head><body>' +

    '<div class="hero">' +
    '<div class="hero-circles">' +
    '<div class="hero-circle" style="width:200px;height:200px;top:-50px;right:-50px"></div>' +
    '<div class="hero-circle" style="width:120px;height:120px;bottom:-30px;left:30px"></div>' +
    '<div class="hero-circle" style="width:80px;height:80px;top:20px;left:60px"></div>' +
    '</div>' +
    '<div class="hero-icon">🌍</div>' +
    '<div class="hero-title">DESTINOS</div>' +
    '<div class="hero-sub">World Cities · RIPUZ</div>' +
    '</div>' +

    '<div class="content">' +
    '<h3>Configuración de campos</h3>' +
    '<div class="srow">' +
    '<label>ID Campo Destinos / Ciudades</label>' +
    '<input type="text" id="f-destinos" value="' + (fieldCfg.destinos||'') + '" placeholder="UF_CRM_XXXXXXXXXX">' +
    '<div class="hint">Campo tipo string múltiple en el Deal</div>' +
    '</div>' +
    '<div class="srow">' +
    '<label>ID Campo País</label>' +
    '<input type="text" id="f-pais" value="' + (fieldCfg.pais||'') + '" placeholder="UF_CRM_XXXXXXXXXX">' +
    '<div class="hint">Campo tipo string múltiple en el Deal</div>' +
    '</div>' +
    '<div class="srow">' +
    '<label>ID Campo Región</label>' +
    '<input type="text" id="f-region" value="' + (fieldCfg.region||'') + '" placeholder="UF_CRM_XXXXXXXXXX">' +
    '<div class="hint">Campo tipo string múltiple en el Deal</div>' +
    '</div>' +
    '<button class="btn-save" onclick="saveConfig()" id="btn-save">Guardar configuración</button>' +
    '<div id="cfg-status"></div>' +
    '</div>' +

    '<script>' +
    'var WORKER_URL = "' + WORKER_URL + '";' +
    'var FIELD_DESTINOS = "' + (fieldCfg.destinos||'') + '";' +
    'var FIELD_PAIS = "' + (fieldCfg.pais||'') + '";' +
    'var FIELD_REGION = "' + (fieldCfg.region||'') + '";' +
    'var DOMAIN = "' + domain + '";' +
    'BX24.init(function() {' +
    '  if (!DOMAIN) DOMAIN = String(BX24.getDomain ? BX24.getDomain() : "");' +
    '  loadFields();' +
    '});' +
    'setTimeout(function() {' +
    '  if (document.querySelector("select#f-destinos")) return;' +
    '  try { if (!DOMAIN && BX24.getDomain) DOMAIN = String(BX24.getDomain()); } catch(e) {}' +
    '  loadFields();' +
    '}, 1500);' +
    'function loadFields() {' +
    '  if (!DOMAIN) { console.warn("No DOMAIN"); return; }' +
    '  fetch(WORKER_URL + "/fields?domain=" + encodeURIComponent(DOMAIN))' +
    '  .then(function(r){ return r.json(); })' +
    '  .then(function(data) {' +
    '    if (!data.ok || !data.fields) { console.error("fields error", data); return; }' +
    '    var ufFields = data.fields;' +
    '    ufFields.sort(function(a,b){ return a.label.localeCompare(b.label); });' +
    '    fillDropdown("f-destinos", ufFields, FIELD_DESTINOS);' +
    '    fillDropdown("f-pais", ufFields, FIELD_PAIS);' +
    '    fillDropdown("f-region", ufFields, FIELD_REGION);' +
    '  })' +
    '  .catch(function(e){ console.error("loadFields fetch error", e); });' +
    '}' +
    'function fillDropdown(id, fields, currentVal) {' +
    '  var el = document.getElementById(id);' +
    '  if (!el) return;' +
    '  var sel = document.createElement("select");' +
    '  sel.id = id;' +
    '  sel.style.cssText = "width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;background:#fff";' +
    '  var opt0 = document.createElement("option");' +
    '  opt0.value = ""; opt0.textContent = "-- Selecciona un campo --";' +
    '  sel.appendChild(opt0);' +
    '  for (var i=0;i<fields.length;i++) {' +
    '    var opt = document.createElement("option");' +
    '    opt.value = fields[i].id;' +
    '    opt.textContent = (fields[i].label || fields[i].title || fields[i].id) + " (" + fields[i].id + ")";' +
    '    if (fields[i].id === currentVal) opt.selected = true;' +
    '    sel.appendChild(opt);' +
    '  }' +
    '  el.parentNode.replaceChild(sel, el);' +
    '}' +
    'function saveConfig() {' +
    '  var d = document.getElementById("f-destinos").value.trim();' +
    '  var p = document.getElementById("f-pais").value.trim();' +
    '  var r = document.getElementById("f-region").value.trim();' +
    '  if (!d || !p || !r) { showStatus("Completa los 3 campos.", "err"); return; }' +
    '  var btn = document.getElementById("btn-save");' +
    '  btn.disabled = true; btn.textContent = "Guardando...";' +
    '  fetch(WORKER_URL + "/config", {' +
    '    method: "POST",' +
    '    headers: { "Content-Type": "application/json" },' +
    '    body: JSON.stringify({ domain: DOMAIN, destinos: d, pais: p, region: r })' +
    '  }).then(function(res){ return res.json(); })' +
    '  .then(function(j) {' +
    '    btn.disabled = false; btn.textContent = "Guardar configuración";' +
    '    if (j.ok) { showStatus("✓ Configuración guardada correctamente", "ok"); }' +
    '    else { showStatus("Error: " + (j.error||""), "err"); }' +
    '  }).catch(function(e) {' +
    '    btn.disabled = false; btn.textContent = "Guardar configuración";' +
    '    showStatus("Error de conexión", "err");' +
    '  });' +
    '}' +
    'function showStatus(msg, type) {' +
    '  var el = document.getElementById("cfg-status");' +
    '  el.textContent = msg;' +
    '  el.className = type === "ok" ? "msg-ok" : "msg-err";' +
    '}' +
    '<\/script></body></html>';
}

// ── WIDGET (Deal/Lead tab) ───────────────────────────────
function renderWidget(fieldCfg, domain, placement) {
  placement = placement || '';
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<script src="//api.bitrix24.com/api/v1/"><\/script>' +
    '<style>' +
    '* { box-sizing: border-box; margin: 0; padding: 0; }' +
    'body { font-family: Arial, sans-serif; font-size: 14px; color: #333; background: #fff; padding: 12px; }' +
    '#loading { text-align: center; padding: 20px; color: #aaa; font-size: 13px; }' +
    '.sw { position: relative; margin-bottom: 4px; }' +
    '.sw input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; }' +
    '.sw input:focus { outline: none; border-color: #5b6cf6; box-shadow: 0 0 0 2px rgba(91,108,246,.12); }' +
    '#dropdown { display: none; position: absolute; z-index: 9999; background: #fff; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.1); max-height: 200px; overflow-y: auto; width: 100%; margin-top: 4px; }' +
    '.di { padding: 8px 12px; cursor: pointer; font-size: 13px; border-bottom: 1px solid #f0f0f0; }' +
    '.di:last-child { border-bottom: none; }' +
    '.di:hover { background: #f0f2ff; }' +
    '.dc { font-weight: 600; color: #333; }' +
    '.dm { font-size: 11px; color: #888; margin-top: 1px; }' +
    '.de { padding: 12px; text-align: center; color: #aaa; font-size: 12px; }' +
    '#tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; min-height: 4px; }' +
    '.tag { display: flex; align-items: center; gap: 5px; background: #eef0ff; border: 1px solid #c5caff; border-radius: 20px; padding: 4px 10px; font-size: 12px; color: #3a47c9; }' +
    '.tag span { max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
    '.tr { cursor: pointer; color: #8891e0; font-size: 14px; line-height: 1; margin-left: 2px; }' +
    '.tr:hover { color: #e05555; }' +
    '#btn-apply { display: none; margin-top: 12px; width: 100%; padding: 10px; background: linear-gradient(135deg, #5b6cf6, #7c3aed); color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }' +
    '#btn-apply:disabled { background: #bbb; cursor: not-allowed; }' +
    '#status-msg { margin-top: 8px; font-size: 12px; text-align: center; min-height: 16px; }' +
    '.no-cfg { font-size: 12px; color: #e05555; margin-top: 8px; text-align: center; }' +
    '.msg-ok { color: #2d9e5f; } .msg-err { color: #e05555; } .msg-info { color: #5b6cf6; }' +
    '</style></head><body>' +
    '<div id="loading">Iniciando...</div>' +
    '<div id="app" style="display:none"></div>' +
    '<script>' +
    'var CITIES_URL = "' + CITIES_URL + '";' +
    'var WORKER_URL = "' + WORKER_URL + '";' +
    'var FIELD_DESTINOS = "' + (fieldCfg.destinos||'') + '";' +
    'var FIELD_PAIS = "' + (fieldCfg.pais||'') + '";' +
    'var FIELD_REGION = "' + (fieldCfg.region||'') + '";' +
    'var FIELD_DESTINOS = "' + (fieldCfg.destinos||'') + '";' +
    'var FIELD_PAIS = "' + (fieldCfg.pais||'') + '";' +
    'var FIELD_REGION = "' + (fieldCfg.region||'') + '";' +
    'var DOMAIN = "' + domain + '";' +
    'var allCities=[], selected=[], dropIndex=-1, ENTITY_ID="", PLACEMENT="' + placement + '";' +

    'BX24.init(function() {' +
    '  var info = BX24.placement.info();' +
    '  PLACEMENT = info.placement || PLACEMENT;' +
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
    '    "<div class=\\"sw\\"><input type=\\"text\\" id=\\"search-input\\" placeholder=\\"Escribe una ciudad...\\" autocomplete=\\"off\\" oninput=\\"onSearch(this.value)\\" onkeydown=\\"onKeyDown(event)\\">" +' +
    '    "<div id=\\"dropdown\\"></div></div>" +' +
    '    "<div id=\\"tags\\"></div>" +' +
    '    "<button id=\\"btn-apply\\" onclick=\\"applyToDeal()\\">Guardar en Deal</button>" +' +
    '    "<div id=\\"status-msg\\"></div>";' +
    '  if (!cfgOk) {' +
    '    app.innerHTML += "<div class=\\"no-cfg\\">Widget no configurado. Ve a Destinos Config en el menu izquierdo.</div>";' +
    '  } else {' +
    '    loadCities();' +
    '    if (ENTITY_ID) loadExisting();' +
    '  }' +
    '}' +

    'function loadCities() {' +
    '  fetch(CITIES_URL).then(function(r){return r.json();})' +
    '  .then(function(data){ allCities=data; })' +
    '  .catch(function(){ setStatus("Error cargando ciudades.","err"); });' +
    '}' +

    'function loadExisting() {' +
    '  if (!FIELD_DESTINOS || !ENTITY_ID) return;' +
    '  var entity = PLACEMENT.indexOf("LEAD") >= 0 ? "crm.lead" : "crm.deal";' +
    '  BX24.callMethod(entity + ".get", { id: ENTITY_ID }, function(r) {' +
    '    if (r.error()) return;' +
    '    var data = r.data();' +
    '    var ciudadesArr = data[FIELD_DESTINOS] || [];' +
    '    var paisesArr = data[FIELD_PAIS] || [];' +
    '    var regionesArr = data[FIELD_REGION] || [];' +
    '    if (!ciudadesArr.length) return;' +
    '    selected = [];' +
    '    for (var i=0;i<ciudadesArr.length;i++) {' +
    '      if (ciudadesArr[i]) selected.push({ ciudad: ciudadesArr[i], pais: paisesArr[i]||"", region: regionesArr[i]||"" });' +
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
    '      "<div class=\\"dm\\">"+results[i].pais+" · "+results[i].region+"</div></div>";' +
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
    '    h+="<div class=\\"tag\\"><span>"+selected[i].ciudad+", "+selected[i].pais+"</span><span class=\\"tr\\" onclick=\\"removeCity("+i+")\\">×</span></div>";' +
    '  }' +
    '  document.getElementById("tags").innerHTML=h;' +
    '}' +

    'function applyToDeal() {' +
    '  if(!selected.length||!ENTITY_ID||!FIELD_DESTINOS) return;' +
    '  var btn=document.getElementById("btn-apply");' +
    '  btn.disabled=true; btn.textContent="Guardando...";' +
    '  var ciudades=[], paisesUniq=[], regionesUniq=[];' +
    '  for(var i=0;i<selected.length;i++){' +
    '    ciudades.push(selected[i].ciudad);' +
    '    if(paisesUniq.indexOf(selected[i].pais)<0) paisesUniq.push(selected[i].pais);' +
    '    if(regionesUniq.indexOf(selected[i].region)<0) regionesUniq.push(selected[i].region);' +
    '  }' +
    '  var entity=PLACEMENT.indexOf("LEAD")>=0?"crm.lead":"crm.deal";' +
    '  var fields={};' +
    '  fields[FIELD_DESTINOS]=ciudades;' +
    '  fields[FIELD_PAIS]=paisesUniq;' +
    '  fields[FIELD_REGION]=regionesUniq;' +
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

// ── STATIC PAGES ─────────────────────────────────────────
function renderInstallSuccess(tenant, domain) {
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<script src="//api.bitrix24.com/api/v1/"><\/script>' +
    '<style>body{font-family:Arial,sans-serif;padding:30px;text-align:center}' +
    '.ok{color:#2d9e5f;font-size:18px;font-weight:600;margin-bottom:8px}' +
    'p{color:#666;font-size:13px;margin-top:6px}</style></head><body>' +
    '<div class="ok">✓ Destinos instalado correctamente</div>' +
    '<p>Portal: ' + domain + '</p>' +
    '<p>Abre un Deal → pestaña Destinos</p>' +
    '<p>Configura los campos en el menu izquierdo → Destinos Config</p>' +
    '<script>BX24.init(function(){ setTimeout(function(){ BX24.closeApplication(); }, 4000); });<\/script>' +
    '</body></html>';
}

function renderWelcomePage() {
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<style>body{font-family:Arial,sans-serif;padding:40px;text-align:center;color:#333}' +
    'h2{color:#5b6cf6}p{color:#888;font-size:13px;margin-top:8px}</style></head><body>' +
    '<h2>🌍 Destinos / World Cities</h2>' +
    '<p>Widget de busqueda de ciudades para Bitrix24</p>' +
    '<p style="font-size:11px;margin-top:16px">by RIPUZ</p>' +
    '</body></html>';
}
