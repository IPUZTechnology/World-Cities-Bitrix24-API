# 🛡️ RIPUZ Monitor — Arquitectura del Sistema
## Tablero de Monitoreo Multi-tenant para Herramientas RIPUZ SAS

**Versión:** 1.0 — Propuesta de Diseño  
**Fecha:** Junio 2026  
**Autor:** RIPUZ SAS — Rafael Ipuz

---

## 1. Visión General

RIPUZ Monitor es un sistema de monitoreo interno que permite a RIPUZ SAS verificar en tiempo real el estado de todas las herramientas instaladas en los portales cliente. Se visualiza como un **tablero embebido en el Bitrix24 de RIPUZ** y se actualiza automáticamente cada hora via Cron Trigger.

### Principios de diseño

- **Sin tickets** — solo estado visual
- **Sin agentes externos** — todo en Cloudflare
- **Cero costo adicional** — usa infraestructura existente
- **Multi-herramienta** — World Cities, Convertalk, y futuras apps
- **Multi-tenant** — todos los clientes en una sola vista

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│  Bitrix24 RIPUZ                                         │
│  ripuz.bitrix24.com                                     │
│  └── LEFT_MENU → "RIPUZ Monitor"                       │
│       └── iframe → ripuz-monitor.workers.dev/dashboard  │
└────────────────────┬────────────────────────────────────┘
                     │ GET /dashboard
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Worker                                      │
│  ripuz-monitor.workers.dev                              │
│  └── src/monitor.js                                     │
│       ├── GET /dashboard  → HTML tablero visual         │
│       ├── GET /api/status → JSON estado todos tenants   │
│       └── Cron cada hora  → healthCheckAllTenants()     │
└────────────────────┬────────────────────────────────────┘
                     │ Lee/escribe resultados
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare KV — MONITOR_RESULTS                        │
│                                                         │
│  status:{tool}:{domain}  → { status, lastOk,           │
│                              lastFail, latency, msg }   │
│  tenants:{tool}          → [ lista de dominios ]        │
└─────────────────────────────────────────────────────────┘
                     │ Health checks
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Workers de cada herramienta                            │
│  ├── world-cities-bitrix24.ripuz.workers.dev/health    │
│  ├── convertalk-ai-crm.ripuz.workers.dev/health        │
│  └── {futura-app}.ripuz.workers.dev/health             │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Componentes

### 3.1 ripuz-monitor Worker

Worker independiente dedicado al monitoreo.

| Archivo | Función |
|---|---|
| `src/monitor.js` | Worker principal |
| `wrangler.toml` | Config + Cron cada hora |

**Endpoints:**

| Ruta | Método | Función |
|---|---|---|
| `/dashboard` | GET | Tablero HTML visual |
| `/api/status` | GET | JSON con estado de todos los tenants |
| `/api/check` | GET | Fuerza un check inmediato |

### 3.2 KV — MONITOR_RESULTS

KV propio, separado de TENANT_CONFIG.

```
status:world-cities:megatravel.bitrix24.co  → { status, lastOk, lastFail, latency, message }
status:convertalk:megatravel.bitrix24.co    → { ... }
tenants:world-cities                         → ["megatravel.bitrix24.co", "otro.bitrix24.co"]
tenants:convertalk                           → ["megatravel.bitrix24.co"]
```

### 3.3 Endpoint /health en cada Worker

Cada herramienta expone un endpoint `/health?domain=X` que el monitor llama:

**World Cities `/health`:**
```json
{
  "ok": true,
  "tool": "world-cities",
  "domain": "megatravel.bitrix24.co",
  "checks": {
    "oauth_token": "ok",
    "placements": "ok",
    "cities_json": "ok",
    "token_expires_in_min": 47
  }
}
```

**Convertalk `/health`:**
```json
{
  "ok": true,
  "tool": "convertalk",
  "domain": "megatravel.bitrix24.co",
  "checks": {
    "oauth_token": "ok",
    "openlines": "ok",
    "webhook": "ok"
  }
}
```

---

## 4. Tablero Visual

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│  🛡️ RIPUZ Monitor          Última actualización: 14:32  │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  RESUMEN                                                │
│  🟢 12 servicios OK   🔴 1 caído   🟡 0 advertencias   │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  WORLD CITIES                              🟢 11/12 OK  │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Cliente              Estado  Último OK  Latencia │   │
│  │ megatravel.b24.co    🟢 OK   hace 23m   142ms   │   │
│  │ otrocliente.b24.co   🔴 DOWN hace 2d    —       │   │
│  │ tercero.b24.co       🟢 OK   hace 23m   98ms    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  CONVERTALK                                🟢 5/5 OK    │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Cliente              Estado  Último OK  Latencia │   │
│  │ megatravel.b24.co    🟢 OK   hace 23m   89ms    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Estados

| Indicador | Estado | Condición |
|---|---|---|
| 🟢 OK | Operacional | Health check exitoso |
| 🔴 DOWN | Caído | Health check falló |
| 🟡 WARN | Advertencia | Token expira en < 10 min |
| ⚪ UNKNOWN | Sin datos | Nunca chequeado |

---

## 5. Cron Trigger — Health Check Automático

```
Cada hora → healthCheckAllTenants()
  ├── Lee tenants:world-cities → [dominios]
  │    └── Para cada dominio:
  │         GET world-cities.../health?domain=X
  │         Guarda resultado en KV
  │
  └── Lee tenants:convertalk → [dominios]
       └── Para cada dominio:
            GET convertalk.../health?domain=X
            Guarda resultado en KV
```

---

## 6. Instalación en Bitrix24 RIPUZ

El tablero se instala como **app local** en el Bitrix24 de RIPUZ:

```
ripuz.bitrix24.com
→ Aplicaciones → Desarrollador → Nueva app local
→ Handler: https://ripuz-monitor.workers.dev/dashboard
→ Placement: LEFT_MENU
→ Título: RIPUZ Monitor
```

No requiere OAuth ni Vendor Portal — es solo para uso interno de RIPUZ.

---

## 7. Herramientas Soportadas (Roadmap)

| Herramienta | Estado | Health Check |
|---|---|---|
| World Cities | ✅ Listo para integrar | `/fields?domain=X` |
| Convertalk AI | 🔜 Pendiente endpoint /health | TBD |
| RIBOT WhatsApp | 🔜 Futuro | TBD |
| Multinet | 🔜 Futuro | TBD |

---

## 8. Stack Tecnológico

| Componente | Tecnología | Costo |
|---|---|---|
| Monitor Worker | Cloudflare Workers JS | $0 |
| KV Storage | Cloudflare KV | $0 |
| Cron Trigger | Cloudflare Cron | $0 |
| Dashboard | HTML/CSS embebido en Worker | $0 |
| Bitrix24 app | App local RIPUZ | $0 |
| **Total** | | **$0** |

---

## 9. Fases de Implementación

### Fase 1 — MVP (1-2 días)
- Worker `ripuz-monitor` con dashboard HTML
- Health check para World Cities
- Cron cada hora
- App local en Bitrix24 RIPUZ

### Fase 2 — Convertalk (1 día)
- Endpoint `/health` en Worker de Convertalk
- Integración en el dashboard

### Fase 3 — Alertas (1 día)
- Notificación en Bitrix24 RIPUZ cuando un servicio cae
- Via webhook a chat interno o actividad en CRM

### Fase 4 — Más herramientas
- RIBOT, Multinet, y futuras apps

---

## 10. Próximos Pasos

1. ✅ Aprobar arquitectura
2. Agregar endpoint `/health` a World Cities Worker
3. Crear KV `MONITOR_RESULTS` en Cloudflare
4. Crear Worker `ripuz-monitor` con dashboard y cron
5. Instalar app local en ripuz.bitrix24.com
6. Probar con Megatravel como primer cliente

---

*RIPUZ SAS — Sistema de Monitoreo Interno — Junio 2026*
