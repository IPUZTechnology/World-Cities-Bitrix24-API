# 🌍 World Cities / Destinos — Bitrix24 Widget

Widget multi-tenant para Bitrix24 CRM que permite buscar y seleccionar ciudades del mundo en Deals y Leads, llenando automáticamente los campos de País y Región geográfica.

**RIPUZ SAS | Rafael Ipuz | IPUZTechnology | v2.0 — Junio 2026**

---

## Índice

1. [Descripción General](#1-descripción-general)
2. [Arquitectura](#2-arquitectura)
3. [Configuración Cloudflare](#3-configuración-cloudflare)
4. [Módulos y Funciones](#4-módulos-y-funciones)
5. [Rutas HTTP](#5-rutas-http)
6. [Widget HTML](#6-widget-html)
7. [Settings Page](#7-settings-page)
8. [Vendor Portal Bitrix24](#8-vendor-portal-bitrix24)
9. [Diagnóstico y Mantenimiento](#9-diagnóstico-y-mantenimiento)
10. [Historial de Bugs Resueltos](#10-historial-de-bugs-resueltos)

---

## 1. Descripción General

| Atributo | Valor |
|---|---|
| Nombre | World Cities / Destinos |
| Vendor Portal App ID | `app.6a241fec2d0266.47473897` |
| Worker URL | `world-cities-bitrix24.ripuz.workers.dev` |
| Pages URL | `world-cities-bitrix24-api.pages.dev` |
| Repositorio | `github.com/IPUZTechnology/World-Cities-Bitrix24-API` |
| Desarrollador | RIPUZ SAS — Rafael Ipuz |
| Versión | 2.0 — Junio 2026 |
| Multi-tenant | Sí — KV compartido `TENANT_CONFIG` |
| Costo por cliente nuevo | $0 adicional |

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│  Bitrix24 (cliente)                                     │
│  ├── Deal / Lead → pestaña "Destinos"                   │
│  │    └── Widget buscador de ciudades                   │
│  └── Menú izquierdo → "Destinos Config"                 │
│       └── Panel de configuración de campos UF           │
└────────────────────┬────────────────────────────────────┘
                     │ POST (placement) / GET (config)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Worker                                      │
│  world-cities-bitrix24.ripuz.workers.dev                │
│  └── src/install.js                                     │
│       ├── POST /install  → OAuth + bindPlacements       │
│       ├── GET/POST /app  → Settings page (LEFT_MENU)    │
│       ├── GET/POST /config → Settings page              │
│       ├── GET /fields    → Lista campos UF via OAuth    │
│       ├── GET /rebind    → Re-registra placements       │
│       ├── GET /unbindall → Elimina placements por ID    │
│       ├── GET /check     → Verifica placements en B24   │
│       ├── GET /refresh   → Debug refresh token          │
│       └── POST /        → Widget o settings según ctx   │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
┌──────────────────┐  ┌──────────────────────────────────┐
│  Cloudflare KV   │  │  Cloudflare Pages                │
│  TENANT_CONFIG   │  │  world-cities-bitrix24-api       │
│                  │  │  .pages.dev                      │
│  oauth:domain:*  │  │  └── src/cities.json             │
│  oauth:tenant:*  │  │       45,786 ciudades            │
│  fields:*        │  │       ~2.7 MB                    │
│  tenant_domain:* │  └──────────────────────────────────┘
└──────────────────┘
```

### 2.1 Componentes

| Componente | Tecnología | Función |
|---|---|---|
| Cloudflare Worker | JavaScript (src/install.js) | Backend: OAuth, placements, widget HTML |
| Cloudflare Pages | Archivos estáticos | Sirve cities.json con 45,786 ciudades |
| Cloudflare KV | TENANT_CONFIG | Tokens OAuth y config por cliente |
| Bitrix24 Vendor Portal | App OAuth | Registro y distribución a clientes |

### 2.2 Flujo de Instalación

```
1. RIPUZ: Vendor Portal → World Cities → TEST → portal cliente
2. Bitrix24 POST /install con AUTH_ID, REFRESH_ID, DOMAIN
3. Worker guarda OAuth en KV
4. Worker registra 3 placements via placement.bind (síncrono)
5. Worker responde con BX24.installFinish() ← crítico
6. Admin configura campos UF en Destinos Config
7. Usuarios usan el widget en Deals y Leads
```

### 2.3 Placements Registrados

| Placement | Handler URL | Función |
|---|---|---|
| `CRM_DEAL_DETAIL_TAB` | `WORKER_URL/` | Pestaña Destinos en el Deal |
| `CRM_LEAD_DETAIL_TAB` | `WORKER_URL/` | Pestaña Destinos en el Lead |
| `LEFT_MENU` | `WORKER_URL/app?DOMAIN={domain}` | Panel config en sidebar |

---

## 3. Configuración Cloudflare

### 3.1 wrangler.toml

```toml
name = "world-cities-bitrix24"
main = "src/install.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "TENANT_CONFIG"
id = "e77e6fca25f74becbf65cdd57a9ebff2"

[triggers]
crons = ["*/30 * * * *"]
```

### 3.2 Variables de Entorno (Secrets)

| Variable | Tipo | Descripción |
|---|---|---|
| `BITRIX_CLIENT_ID` | Secret | App ID del Vendor Portal |
| `CLIENT_SECRET` | Secret | Client Secret para refresh OAuth |

### 3.3 KV Namespace — TENANT_CONFIG

Compartido con Convertalk. Claves de World Cities:

| Clave | Contenido |
|---|---|
| `oauth:domain:{domain}` | OAuth completo del tenant |
| `oauth:tenant:{tenant}` | OAuth por tenant corto |
| `tenant_domain:{domain}` | Nombre del tenant |
| `fields:{domain}` | Config Deal (legacy) |
| `fields:{domain}:deal` | Config campos Deal |
| `fields:{domain}:lead` | Config campos Lead |

### 3.4 Cron Trigger

Refresca todos los tokens OAuth cada 30 minutos, antes de que expiren (`expires_in: 3600`). Previene `invalid_grant`.

```javascript
addEventListener('scheduled', event => {
  event.waitUntil(refreshAllTenants());
});
```

---

## 4. Módulos y Funciones

### Constantes globales

```javascript
const CITIES_URL = 'https://world-cities-bitrix24-api.pages.dev/src/cities.json';
const WORKER_URL = 'https://world-cities-bitrix24.ripuz.workers.dev';
```

### `refreshOAuth(domain, oauth)`
Refresca el access_token via `oauth.bitrix.info`. Actualiza KV con el nuevo token. Lee `BITRIX_CLIENT_ID` y `CLIENT_SECRET` del environment.

### `getOAuth(domain)`
Lee OAuth del KV. Solo llama `refreshOAuth()` si el token está a menos de 5 minutos de expirar (`storedAt + expires_in - 5min`). Evita consumir el refresh_token innecesariamente.

### `refreshAllTenants()`
Itera todos los tenants (`oauth:domain:*`) y refresca cada token. Ejecutado por el Cron Trigger cada 30 minutos.

### `handleInstall(request, event, url, corsHeaders, fd)`
Maneja el POST de instalación de Bitrix24:
- Extrae `AUTH_ID`, `REFRESH_ID`, `SERVER_ENDPOINT`, `DOMAIN`
- Guarda OAuth en KV: `oauth:tenant:`, `oauth:domain:`, `tenant_domain:`
- Llama `bindPlacements()` con `await` (síncrono — crítico)
- Responde con `renderInstallSuccess()` que incluye `BX24.installFinish()`

### `bindPlacements(domain, accessToken)`
Registra los 3 placements via `placement.bind.json`. Loguea `BIND_RESULT` por placement para debug.

### `loadSettingsConfig(domain)`
Lee config de campos UF desde KV. Retorna `{ destinos, pais, region, lead_destinos, lead_pais, lead_region }`.

### `handleConfigSave(request, corsHeaders)`
Guarda config de campos UF en KV via POST `/config`. Guarda en `fields:{domain}:{entity}` y en `fields:{domain}` (legacy para Deal).

---

## 5. Rutas HTTP

| Ruta | Método | Función | Auth |
|---|---|---|---|
| `/install` | POST | Install handler completo | Bitrix24 AUTH_ID |
| `/app` | GET/POST | Settings page (LEFT_MENU) | DOMAIN param |
| `/config` | GET | Settings page (navegador) | DOMAIN param |
| `/config` | POST | Guarda config UF en KV | JSON body |
| `/fields` | GET | Lista campos UF via OAuth | KV OAuth |
| `/rebind` | GET | Re-registra placements | KV OAuth |
| `/unbindall` | GET | Elimina placements por ID | KV OAuth |
| `/check` | GET | Verifica placements en B24 | KV OAuth |
| `/refresh` | GET | Debug refresh token | KV OAuth |
| `/` | POST+DEAL/LEAD | Sirve widget | Bitrix24 iframe |
| `/` | POST+DEFAULT | Settings o install | Bitrix24 iframe |
| `/` | GET+DOMAIN | Settings page | DOMAIN param |

### Lógica de routing POST / (orden crítico)

```
1. DEAL/LEAD placement → renderWidget()         ← PRIMERO
2. DEFAULT sin token válido → renderSettingsPage()
3. authToken + status F/L → handleInstall()
4. Fallback DEFAULT → renderSettingsPage()
```

> **Nota:** El orden es crítico. Bitrix24 envía `PLACEMENT=DEFAULT` con `status=F` tanto en instalación como al abrir el LEFT_MENU. La distinción se hace verificando si `authToken.length > 10 && (status === 'F' || status === 'L')`.

---

## 6. Widget HTML

Renderizado completamente en el Worker como HTML string. Usa `BX24` SDK.

### Inicialización
- `BX24.init()` obtiene `PLACEMENT`, `ENTITY_ID`, `DOMAIN`
- Carga `cities.json` desde Cloudflare Pages (una sola vez, ~2.7 MB)
- `loadExisting()` carga ciudades ya guardadas en el Deal

### Búsqueda
- Filtrado **local en el navegador** — sin llamadas al servidor
- `c.ciudad.toLowerCase().indexOf(q) === 0` — coincidencia desde el inicio
- Máximo 50 resultados con highlight del texto buscado
- Soporte teclado: flechas, Enter, Escape

### Selección múltiple
- Tags: `[Ciudad, País ×]` — distingue ciudades homónimas
- Detecta duplicados por `ciudad + pais`

### Guardado en Deal/Lead
- `BX24.callMethod("crm.deal.update")` o `crm.lead.update`
- `Destinos`: array con una ciudad por elemento
- `País`: array de países únicos (deduplicado)
- `Región`: array de regiones únicas (deduplicado)

### Base de datos de ciudades

| Atributo | Valor |
|---|---|
| Total | 45,786 ciudades |
| Estructura | `{ ciudad, pais, region }` |
| Formato | JSON minificado |
| Tamaño | ~2.7 MB |
| Regiones | AFRICA, ASIA, BALCANES, BALTICOS, CARIBE, CENTRO AMERICA, EUROPA, MEDIO ORIENTE, NORTE AMERICA, OCEANIA, SUR AMERICA |
| Idioma | Inglés (nombre original) |

---

## 7. Settings Page

Panel de administración en el menú izquierdo (Destinos Config).

- **Tabs Deal / Lead** — configuración independiente por entidad
- **Autocomplete campos UF** via `/fields` — selección, no escritura manual del ID
- Guarda via POST `/config` → KV `fields:{domain}:deal` y `fields:{domain}:lead`

### Campos requeridos en Bitrix24 (tipo: String múltiple)

| Campo | Descripción |
|---|---|
| Destinos / Ciudades | Una ciudad por elemento del array |
| País | Países únicos de las ciudades seleccionadas |
| Región | Regiones geográficas deduplicadas |

---

## 8. Vendor Portal Bitrix24

| Campo | Valor |
|---|---|
| Application ID | `app.6a241fec2d0266.47473897` |
| Application URL | `https://world-cities-bitrix24.ripuz.workers.dev/app` |
| Application installer URL | `https://world-cities-bitrix24.ripuz.workers.dev/install` |
| System areas | CRM, Application embedding, Custom fields, Custom fields settings |
| UI embedding areas | CRM_DEAL_DETAIL_TAB, CRM_LEAD_DETAIL_TAB, LEFT_MENU |
| Add widgets | ✓ |
| Menu item title | World Cities |

---

## 9. Diagnóstico y Mantenimiento

### Endpoints de diagnóstico

```bash
# Verificar token OAuth
GET /fields?domain=cliente.bitrix24.co&entity=deal

# Verificar placements registrados
GET /check?DOMAIN=cliente.bitrix24.co

# Debug refresh token
GET /refresh?domain=cliente.bitrix24.co

# Re-registrar placements sin reinstalar
GET /rebind?DOMAIN=cliente.bitrix24.co

# Eliminar todos los placements
GET /unbindall?DOMAIN=cliente.bitrix24.co
```

### Síntomas y soluciones

| Síntoma | Causa | Solución |
|---|---|---|
| Tab Destinos no aparece | Token expirado o placements no registrados | `/check` → `/unbindall` → reinstalar |
| `expired_token` en /fields | Token OAuth vencido (1 hora) | Reinstalar la app |
| `invalid_grant` en /refresh | Refresh token consumido o vencido | Reinstalar la app |
| Settings muestra "instalado" | isInstall evalúa antes que LEFT_MENU | Verificar orden routing |
| Widget en blanco | Config campos UF no configurada | Destinos Config → configurar campos |
| `APPLICATION_NOT_FOUND` | Placements huérfanos de app anterior | `/unbindall` → reinstalar |

### Para agregar un nuevo cliente

1. Vendor Portal → World Cities → **TEST** → seleccionar portal del cliente
2. Cliente instala → Worker guarda OAuth + registra placements automáticamente
3. Admin cliente → menú izquierdo → **Destinos Config** → configura 3 campos UF
4. Verificar: `/fields?domain=cliente.bitrix24.co&entity=deal`

---

## 10. Historial de Bugs Resueltos

| Bug | Causa | Fix |
|---|---|---|
| Tab no aparecía en Deal | `BX24.installFinish()` faltaba | Agregado en `renderInstallSuccess()` |
| Settings mostraba "instalado" | `isInstall` evaluaba antes que LEFT_MENU | Reordenado: DEAL/LEAD → LEFT_MENU → isInstall |
| Token expiraba cada hora | Refresh fallaba con `invalid_grant` | Cron cada 30min + refresh proactivo |
| `/app` daba 404 | Ruta no existía | Agregada ruta `/app` |
| `APPLICATION_NOT_FOUND` | Placements huérfanos | `/unbindall` por ID numérico |
| `bindPlacements` silencioso | `event.waitUntil()` no esperado | Cambiado a `await bindPlacements()` |
| `"already binded"` en rebind | Placements duplicados | Usar `/unbindall` antes de `/rebind` |

---

*RIPUZ SAS — world-cities-bitrix24.ripuz.workers.dev — Junio 2026*
