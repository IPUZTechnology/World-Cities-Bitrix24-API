# 🌍 World Cities — Bitrix24 Widget

Widget para Bitrix24 CRM que permite buscar y seleccionar ciudades del mundo en Deals y Leads, llenando automáticamente los campos de País y Región.

**Desarrollado por RIPUZ SAS**

---

## Arquitectura

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
│       ├── GET  /?DOMAIN=   → Settings page (LEFT_MENU)  │
│       ├── POST / PLACEMENT=CRM_DEAL_DETAIL_TAB → Widget │
│       ├── POST / PLACEMENT=CRM_LEAD_DETAIL_TAB → Widget │
│       ├── POST / AUTH_ID   → Install handler            │
│       ├── POST /config     → Guarda campos UF en KV     │
│       ├── GET  /fields     → Lista campos UF del Deal   │
│       └── GET  /rebind     → Re-registra placements     │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
┌──────────────────┐  ┌─────────────────────────────────┐
│  Cloudflare KV   │  │  Cloudflare Pages               │
│  TENANT_CONFIG   │  │  world-cities-bitrix24-api      │
│                  │  │  .pages.dev                     │
│  oauth:domain:*  │  │                                 │
│  oauth:tenant:*  │  │  ├── index.html (no usado)      │
│  fields:domain:* │  │  └── src/cities.json            │
│  tenant_domain:* │  │       45,786 ciudades           │
└──────────────────┘  │       JSON: ciudad/pais/region  │
                       └─────────────────────────────────┘
```

---

## Componentes

### 1. Cloudflare Worker (`src/install.js`)
El núcleo de la solución. Maneja todos los requests:

| Ruta | Método | Función |
|---|---|---|
| `/?DOMAIN=xxx` | GET | Muestra panel de configuración (LEFT_MENU) |
| `/` | POST + PLACEMENT=DEAL/LEAD | Sirve el widget en el Deal/Lead |
| `/` | POST + AUTH_ID | Instala la app y registra placements |
| `/config` | POST | Guarda config de campos UF en KV |
| `/fields` | GET | Lista campos UF del portal vía OAuth |
| `/rebind` | GET | Re-registra placements sin reinstalar |

### 2. Cloudflare Pages (`world-cities-bitrix24-api.pages.dev`)
Sirve únicamente el archivo `src/cities.json` con 45,786 ciudades del mundo.

> **Nota:** La `index.html` en Pages ya no se usa — el Worker maneja todo el HTML.
> La Page se puede mantener solo para servir el `cities.json`.

### 3. Cloudflare KV (`TENANT_CONFIG`)
Almacena la configuración por portal cliente:

```
oauth:domain:{domain}     → tokens OAuth del cliente
oauth:tenant:{tenant}     → tokens OAuth por tenant
tenant_domain:{domain}    → nombre del tenant
fields:{domain}           → IDs de campos UF configurados
fields:{domain}:deal      → IDs de campos UF para Deals
fields:{domain}:lead      → IDs de campos UF para Leads
```

### 4. Bitrix24 Vendor Portal
App registrada en el portal de partners de RIPUZ. Placements registrados:

| Placement | Función |
|---|---|
| `CRM_DEAL_DETAIL_TAB` | Pestaña "Destinos" en el Deal |
| `CRM_LEAD_DETAIL_TAB` | Pestaña "Destinos" en el Lead |
| `LEFT_MENU` | Menú "Destinos Config" en sidebar izquierdo |

---

## Flujo de instalación

```
1. RIPUZ abre el Vendor Portal → app World Cities → TEST
2. Selecciona el portal del cliente → instala
3. Bitrix24 hace POST al Worker con AUTH_ID + DOMAIN
4. Worker guarda OAuth en KV
5. Worker llama placement.bind para los 3 placements
6. Cliente ve "Destinos instalado correctamente"
7. Admin del cliente va al menú izquierdo → Destinos Config
8. Configura los 3 campos UF del Deal/Lead
9. Usuarios abren Deals → pestaña Destinos → buscan ciudades
```

---

## Flujo del widget en el Deal

```
Usuario abre Deal → clic en pestaña "Destinos"
        ↓
Worker recibe POST con PLACEMENT=CRM_DEAL_DETAIL_TAB + DOMAIN + ENTITY_ID
        ↓
Worker lee config de campos UF desde KV
        ↓
Worker sirve HTML del widget con los campos configurados
        ↓
Widget carga cities.json desde Cloudflare Pages (45k ciudades)
        ↓
Widget lee ciudades ya guardadas en el Deal (loadExisting)
        ↓
Usuario escribe ciudad → búsqueda local en el JSON (sin servidor)
        ↓
Selecciona ciudades → aparecen como tags [Ciudad, País ×]
        ↓
Clic "Guardar en Deal" → BX24.callMethod crm.deal.update
        ↓
Campos UF actualizados:
  Destinos:  [Paris, Verona, Athens]     (array, uno por ciudad)
  País:      [France, Italy, Greece]     (array, únicos)
  Región:    [EUROPA]                    (array, deduplicado)
```

---

## Base de datos de ciudades

- **Fuente:** Excel proporcionado por RIPUZ
- **Total:** 45,786 ciudades
- **Estructura:** `{ ciudad, pais, region }`
- **Regiones:** AFRICA, ASIA, BALCANES, BALTICOS, CARIBE, CENTRO AMERICA, EUROPA, MEDIO ORIENTE, NORTE AMERICA, OCEANIA, SUR AMERICA
- **Formato:** JSON minificado (~2.7 MB)
- **Búsqueda:** Local en el navegador, sin llamadas al servidor

---

## Configuración por cliente

Cada cliente requiere configurar 3 campos UF en su Bitrix24:

| Campo | Tipo Bitrix24 | Descripción |
|---|---|---|
| Destinos / Ciudades | String múltiple | Una ciudad por elemento |
| País | String múltiple | Países únicos de las ciudades |
| Región | String múltiple | Regiones únicas (deduplicadas) |

La configuración se guarda en KV bajo la clave `fields:{domain}`.

---

## Cloudflare Pages — ¿se puede borrar?

**No borrar** — la Page sirve el `src/cities.json` que el widget carga en el navegador. Sin la Page, el buscador no funciona.

Lo que sí puedes borrar o ignorar:
- `index.html` en la raíz de Pages (ya no se usa)

---

## wrangler.toml

```toml
name = "world-cities-bitrix24"
main = "src/install.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "TENANT_CONFIG"
id = "e77e6fca25f74becbf65cdd57a9ebff2"
```

---

## Para agregar un nuevo cliente

1. Vendor Portal → World Cities → TEST → seleccionar portal del cliente
2. Cliente instala → Worker guarda OAuth automáticamente
3. Admin del cliente → menú izquierdo → Destinos Config → configura campos UF
4. Listo — sin tocar código

---

## Costos

| Servicio | Costo |
|---|---|
| Cloudflare Worker | $0 (incluido en plan $5/mes) |
| Cloudflare Pages | $0 (incluido) |
| Cloudflare KV | $0 (incluido) |
| Bitrix24 Vendor Portal | $0 (sin moderación) |
| **Total por cliente nuevo** | **$0** |

---

*by RIPUZ SAS — Rafael Ipuz*
