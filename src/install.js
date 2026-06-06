addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  const baseHeaders = {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseHeaders });
  }

  if (url.pathname.includes('cities.json')) {
    return fetch('https://world-cities-bitrix24-api.pages.dev/src/cities.json');
  }

  const CITIES_URL = 'https://world-cities-bitrix24-api.pages.dev/src/cities.json';
  const HANDLER = 'https://world-cities-bitrix24.ripuz.workers.dev';

  const js = `
var CITIES_URL = "${CITIES_URL}";
var HANDLER = "${HANDLER}";
var allCities=[], selected=[], dropIndex=-1, cfg={}, ENTITY_ID="", PLACEMENT="";

BX24.init(function() {
  var info = BX24.placement.info();
  PLACEMENT = info.placement || "";
  ENTITY_ID = (info.options && info.options.ID) ? String(info.options.ID) : "";
  document.getElementById("loading").style.display = "none";
  document.getElementById("app").style.display = "block";

  var stored = localStorage.getItem("destinos_cfg");
  if (stored) { try { cfg = JSON.parse(stored); } catch(e) { cfg={}; } }

  // Si es LEFT_MENU → mostrar config de la app
  if (PLACEMENT === "LEFT_MENU" || PLACEMENT === "") {
    showConfigPanel(); return;
  }

  // Si es Deal o Lead → mostrar widget
  showWidget();
  if (cfg.destinos && ENTITY_ID) loadExistingCities();
});

// ── CONFIG PANEL (LEFT_MENU) ─────────────────────────────
function showConfigPanel() {
  var app = document.getElementById("app");
  app.innerHTML =
    '<div style="padding:20px">' +
    '<h3 style="font-size:15px;font-weight:600;margin-bottom:16px">Configuracion Destinos</h3>' +
    '<div class="srow"><label>ID Campo Destinos/Ciudades</label><input type="text" id="cfg-destinos" placeholder="UF_CRM_XXXXXXXXXX"></div>' +
    '<div class="srow"><label>ID Campo Pais</label><input type="text" id="cfg-pais" placeholder="UF_CRM_XXXXXXXXXX"></div>' +
    '<div class="srow"><label>ID Campo Region</label><input type="text" id="cfg-region" placeholder="UF_CRM_XXXXXXXXXX"></div>' +
    '<button class="btn-blue" onclick="saveConfig()">Guardar configuracion</button>' +
    '<div id="cfg-status" style="margin-top:8px;font-size:12px"></div>' +
    '</div>';
  document.getElementById("cfg-destinos").value = cfg.destinos || "";
  document.getElementById("cfg-pais").value = cfg.pais || "";
  document.getElementById("cfg-region").value = cfg.region || "";
}

function saveConfig() {
  cfg = {
    destinos: document.getElementById("cfg-destinos").value.trim(),
    pais: document.getElementById("cfg-pais").value.trim(),
    region: document.getElementById("cfg-region").value.trim()
  };
  if (!cfg.destinos || !cfg.pais || !cfg.region) { alert("Completa los tres campos."); return; }
  localStorage.setItem("destinos_cfg", JSON.stringify(cfg));
  var el = document.getElementById("cfg-status");
  el.textContent = "Configuracion guardada correctamente";
  el.style.color = "#2d9e5f";
}

// ── WIDGET (Deal/Lead) ───────────────────────────────────
function showWidget() {
  var app = document.getElementById("app");
  app.innerHTML =
    '<div class="w-header"><span class="w-title">Destinos</span></div>' +
    '<div class="sw"><span class="si">Buscar</span>' +
    '<input type="text" id="search-input" placeholder="Escribe una ciudad..." autocomplete="off" oninput="onSearch(this.value)" onkeydown="onKeyDown(event)">' +
    '<div id="dropdown"></div></div>' +
    '<div id="tags"></div>' +
    '<button id="btn-apply" onclick="applyToDeal()">Guardar en Deal</button>' +
    '<div id="status-msg"></div>';

  if (!cfg.destinos) {
    app.innerHTML += '<div style="font-size:11px;color:#e05555;margin-top:8px">Widget no configurado. Ve al menu Destinos para configurar.</div>';
  } else {
    loadCities();
  }
}

// ── LOAD EXISTING CITIES FROM DEAL ───────────────────────
function loadExistingCities() {
  BX24.callMethod("crm.deal.get", { id: ENTITY_ID }, function(result) {
    if (result.error()) return;
    var data = result.data();
    var ciudadesStr = data[cfg.destinos] || "";
    var paisesStr   = data[cfg.pais]     || "";
    var regionesStr = data[cfg.region]   || "";
    if (!ciudadesStr) return;
    var ciudades = ciudadesStr.split(", ");
    var paises   = paisesStr.split(", ");
    var regiones = regionesStr.split(", ");
    selected = [];
    for (var i=0; i<ciudades.length; i++) {
      if (ciudades[i]) selected.push({
        ciudad: ciudades[i],
        pais:   paises[i]   || "",
        region: regiones[i] || ""
      });
    }
    renderTags();
    if (selected.length) document.getElementById("btn-apply").style.display = "block";
  });
}

// ── CITIES ───────────────────────────────────────────────
function loadCities() {
  setStatus("Cargando ciudades...", "info");
  fetch(CITIES_URL)
    .then(function(r){return r.json();})
    .then(function(data){
      allCities=data;
      setStatus("","");
      if (cfg.destinos && ENTITY_ID) loadExistingCities();
    })
    .catch(function(){setStatus("Error cargando ciudades.","err");});
}

// ── SEARCH ───────────────────────────────────────────────
function onSearch(val) {
  dropIndex=-1;
  var q=val.trim().toLowerCase();
  if (q.length<2) { closeDropdown(); return; }
  var results=allCities.filter(function(c){return c.ciudad.toLowerCase().indexOf(q)===0;}).slice(0,50);
  showDropdown(results,q);
}

function showDropdown(results,q) {
  var dd=document.getElementById("dropdown");
  if (!results.length) { dd.innerHTML='<div class="de">Sin resultados</div>'; dd.style.display="block"; return; }
  var h="";
  for (var i=0;i<results.length;i++) {
    var idx=allCities.indexOf(results[i]);
    h+='<div class="di" onmousedown="selectByIdx('+idx+')">'+
      '<div class="dc">'+highlight(results[i].ciudad,q)+'</div>'+
      '<div class="dm">'+results[i].pais+' - '+results[i].region+'</div></div>';
  }
  dd.innerHTML=h; dd.style.display="block";
}

function highlight(city,q) {
  var i=city.toLowerCase().indexOf(q.toLowerCase());
  if (i<0) return city;
  return city.slice(0,i)+"<strong>"+city.slice(i,i+q.length)+"</strong>"+city.slice(i+q.length);
}

function closeDropdown() { var dd=document.getElementById("dropdown"); if(dd) dd.style.display="none"; }

function onKeyDown(e) {
  var items=document.querySelectorAll(".di");
  if (e.key==="ArrowDown") { dropIndex=Math.min(dropIndex+1,items.length-1); highlightItem(items); }
  else if (e.key==="ArrowUp") { dropIndex=Math.max(dropIndex-1,0); highlightItem(items); }
  else if (e.key==="Enter"&&dropIndex>=0) { items[dropIndex].dispatchEvent(new MouseEvent("mousedown")); }
  else if (e.key==="Escape") { closeDropdown(); }
}

function highlightItem(items) {
  items.forEach(function(el,i){el.style.background=i===dropIndex?"#f0f2ff":"";});
  if(items[dropIndex]) items[dropIndex].scrollIntoView({block:"nearest"});
}

function selectByIdx(idx) {
  var c=allCities[idx]; if (!c) return;
  closeDropdown();
  document.getElementById("search-input").value="";
  if(selected.find(function(s){return s.ciudad===c.ciudad&&s.pais===c.pais;})) return;
  selected.push({ciudad:c.ciudad,pais:c.pais,region:c.region});
  renderTags();
  document.getElementById("btn-apply").style.display="block";
}

function removeCity(i) {
  selected.splice(i,1); renderTags();
  if(!selected.length) document.getElementById("btn-apply").style.display="none";
}

function renderTags() {
  var h="";
  for(var i=0;i<selected.length;i++){
    h+='<div class="tag"><span>'+selected[i].ciudad+'</span>'+
      '<span class="tr" onclick="removeCity('+i+')">x</span></div>';
  }
  document.getElementById("tags").innerHTML=h;
}

// ── APPLY TO DEAL ────────────────────────────────────────
function applyToDeal() {
  if(!selected.length||!ENTITY_ID||!cfg.destinos) return;
  var btn=document.getElementById("btn-apply");
  btn.disabled=true; btn.textContent="Guardando...";
  var ciudades=[],paises=[],regiones=[];
  for(var i=0;i<selected.length;i++){
    ciudades.push(selected[i].ciudad);
    if(paises.indexOf(selected[i].pais)<0) paises.push(selected[i].pais);
    if(regiones.indexOf(selected[i].region)<0) regiones.push(selected[i].region);
  }
  var entity=PLACEMENT.indexOf("LEAD")>=0?"crm.lead":"crm.deal";
  var fields={};
  fields[cfg.destinos]=ciudades.join(", ");
  fields[cfg.pais]=paises.join(", ");
  fields[cfg.region]=regiones.join(", ");
  BX24.callMethod(entity+".update",{id:ENTITY_ID,fields:fields},function(result){
    if(result.error()){
      setStatus("Error: "+result.error(),"err");
      btn.disabled=false; btn.textContent="Guardar en Deal";
    } else {
      setStatus("Guardado correctamente","ok");
      btn.textContent="Guardado";
      setTimeout(function(){btn.textContent="Guardar en Deal";btn.disabled=false;},2500);
    }
  });
}

// ── SETUP INSTALL ────────────────────────────────────────
function showSetupPanel() {
  document.getElementById("app").innerHTML =
    '<div style="text-align:center;padding:20px">' +
    '<h3>Destinos / World Cities</h3>' +
    '<p style="font-size:12px;color:#888;margin:8px 0 20px">Registra el widget en Deals y Leads</p>' +
    '<button class="btn-blue" onclick="installPlacements()">Instalar widget en Deals y Leads</button>' +
    '<div id="install-status" style="margin-top:8px;font-size:12px"></div></div>';
}

function installPlacements() {
  var btn=document.querySelector(".btn-blue");
  btn.disabled=true;
  var el=document.getElementById("install-status");
  el.textContent="Registrando..."; el.style.color="#5b6cf6";
  BX24.callMethod("placement.bind",{PLACEMENT:"CRM_DEAL_DETAIL_BLOCK",HANDLER:HANDLER,TITLE:"Destinos"},function(r1){
    BX24.callMethod("placement.bind",{PLACEMENT:"CRM_LEAD_DETAIL_BLOCK",HANDLER:HANDLER,TITLE:"Destinos"},function(r2){
      el.textContent="Listo. Abre un Deal."; el.style.color="#2d9e5f";
      btn.textContent="Instalado";
    });
  });
}

function setStatus(msg,type){
  var el=document.getElementById("status-msg");
  if(!el) return;
  el.textContent=msg;
  el.style.color=type==="ok"?"#2d9e5f":type==="err"?"#e05555":"#5b6cf6";
}

document.addEventListener("click",function(e){
  if(!e.target.closest||!e.target.closest(".sw")) closeDropdown();
});
`;

  const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 14px; color: #333; background: #fff; padding: 12px; }
#loading { text-align: center; padding: 20px; color: #aaa; font-size: 13px; }
.srow { margin-bottom: 10px; }
.srow label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }
.srow input { width: 100%; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; }
.btn-blue { background: #5b6cf6; color: #fff; border: none; border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer; width: 100%; }
.btn-blue:disabled { background: #bbb; cursor: not-allowed; }
.w-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.w-title { font-size: 13px; font-weight: 600; color: #444; }
.sw { position: relative; }
.sw input { width: 100%; padding: 8px 12px 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; }
.sw input:focus { outline: none; border-color: #5b6cf6; }
.si { display: none; }
#dropdown { display: none; position: absolute; z-index: 9999; background: #fff; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.1); max-height: 200px; overflow-y: auto; width: 100%; margin-top: 4px; }
.di { padding: 8px 12px; cursor: pointer; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
.di:last-child { border-bottom: none; }
.di:hover { background: #f0f2ff; }
.dc { font-weight: 600; color: #333; }
.dm { font-size: 11px; color: #888; margin-top: 1px; }
.de { padding: 12px; text-align: center; color: #aaa; font-size: 12px; }
#tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; min-height: 4px; }
.tag { display: flex; align-items: center; gap: 5px; background: #eef0ff; border: 1px solid #c5caff; border-radius: 20px; padding: 4px 10px; font-size: 12px; color: #3a47c9; }
.tag span { max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr { cursor: pointer; color: #8891e0; font-size: 14px; line-height: 1; }
.tr:hover { color: #e05555; }
#btn-apply { display: none; margin-top: 12px; width: 100%; padding: 9px; background: #5b6cf6; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
#btn-apply:disabled { background: #bbb; cursor: not-allowed; }
#status-msg { margin-top: 8px; font-size: 12px; text-align: center; min-height: 16px; }
`;

  const html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>Destinos - RIPUZ</title>' +
    '<script src="//api.bitrix24.com/api/v1/"><\/script>' +
    '<style>' + css + '<\/style><\/head><body>' +
    '<div id="loading">Iniciando...</div>' +
    '<div id="app" style="display:none"><\/div>' +
    '<script>' + js + '<\/script>' +
    '<\/body><\/html>';

  return new Response(html, { status: 200, headers: baseHeaders });
}
