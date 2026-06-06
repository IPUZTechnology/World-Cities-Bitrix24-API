addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Instalando Destinos...</title>
<script src="//api.bitrix24.com/api/v1/"><\/script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .wrap { text-align: center; padding: 40px; }
  .icon { font-size: 48px; margin-bottom: 16px; }
  .title { font-size: 18px; font-weight: 600; color: #333; margin-bottom: 8px; }
  .sub { font-size: 13px; color: #888; margin-bottom: 24px; }
  .status { font-size: 13px; color: #5b6cf6; }
  .status.ok { color: #2d9e5f; }
  .status.err { color: #e05555; }
</style>
</head>
<body>
<div class="wrap">
  <div class="icon">🌍</div>
  <div class="title">Destinos / World Cities</div>
  <div class="sub">Configurando widget en Deals y Leads...</div>
  <div class="status" id="status">Iniciando...</div>
</div>
<script>
  var HANDLER = 'https://world-cities-bitrix24-api.pages.dev/';

  function setStatus(msg, type) {
    var el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status' + (type ? ' ' + type : '');
  }

  BX24.init(function() {
    setStatus('Registrando widget en Deal...');

    BX24.callMethod('placement.bind', {
      PLACEMENT: 'CRM_DEAL_DETAIL_TAB',
      HANDLER: HANDLER,
      TITLE: 'Destinos'
    }, function(r1) {
      console.log('Deal:', r1.error ? r1.error() : 'ok');
      setStatus('Registrando widget en Lead...');

      BX24.callMethod('placement.bind', {
        PLACEMENT: 'CRM_LEAD_DETAIL_TAB',
        HANDLER: HANDLER,
        TITLE: 'Destinos'
      }, function(r2) {
        console.log('Lead:', r2.error ? r2.error() : 'ok');
        setStatus('✓ Instalación completada. Abre un Deal o Lead.', 'ok');
        setTimeout(function() {
          BX24.closeApplication();
        }, 3000);
      });
    });
  });
<\/script>
</body>
</html>`;

  return new Response(html, { status: 200, headers });
}
