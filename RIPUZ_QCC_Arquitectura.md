# 🛡️ RIPUZ QCC — Quality Control Center
## Centro de Control de Calidad — Arquitectura v1.0

**Fecha:** Junio 2026  
**Autor:** RIPUZ SAS — Rafael Ipuz  
**Clasificación:** Documento interno — Confidencial

---

## 1. Visión del Producto

RIPUZ QCC es el **centro de control de calidad proactivo** de RIPUZ SAS. Permite al equipo de mesa de ayuda monitorear en tiempo real el estado de todas las herramientas instaladas en cada cliente, anticiparse a los problemas antes de que el cliente los reporte, y actuar directamente desde el tablero enviando notificaciones por WhatsApp al contacto responsable del cliente.

### Filosofía

> **"Llama tú primero. No esperes que el cliente llame."**

---

## 2. Herramientas Monitoreadas

| Herramienta | Estado | Descripción |
|---|---|---|
| World Cities / Destinos | ✅ Fase 1 | Widget ciudades en Deals y Leads |
| Convertalk AI Autopilot | ✅ Fase 1 | IA WhatsApp → Bitrix24 CRM |
| Convertalk Bot | 🔜 Fase 2 | Bot WhatsApp multicanal |
| AI Marketing Explorer | 🔜 Fase 2 | Explorador de campañas IA |
| IA Bot Creators | 🔜 Fase 3 | Creador de bots personalizados |
| *(futuras apps)* | 🔜 — | Se agregan sin rediseñar |

---

## 3. Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│  Bitrix24 RIPUZ — ripuz.bitrix24.com                        │
│  └── LEFT_MENU → "QCC — Control Center"                     │
│       └── iframe → ripuz-qcc.workers.dev/dashboard          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Worker — ripuz-qcc.workers.dev                  │
│  src/qcc.js                                                 │
│                                                             │
│  GET  /dashboard          → Tablero HTML visual             │
│  GET  /api/status         → JSON estado global              │
│  GET  /api/check/:tool/:domain → Check manual inmediato     │
│  POST /api/notify         → Envía WhatsApp al cliente       │
│  POST /api/acknowledge    → Marca alerta como vista         │
│  Cron cada 30 min         → healthCheckAll()                │
└──────────┬───────────────────────────┬──────────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────┐      ┌────────────────────────────────────┐
│  Cloudflare KV   │      │  Workers de cada herramienta       │
│  QCC_DATA        │      │                                    │
│                  │      │  /health?domain=X                  │
│  status:*        │      │  ├── world-cities.ripuz.workers.dev│
│  clients:*       │      │  ├── convertalk-ai.ripuz.workers   │
│  alerts:*        │      │  ├── convertalk-bot.ripuz.workers  │
│  contacts:*      │      │  └── {nueva-app}.ripuz.workers     │
└──────────────────┘      └────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│  Convertalk / WhatsApp API                                  │
│  → Mensaje al contacto del cliente                          │
│  "Hola [Nombre], detectamos que [herramienta] presenta      │
│   una alerta en su portal. Nuestro equipo está revisando.   │
│   ¿Podemos contactarle?"                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Modelo de Datos — KV QCC_DATA

### Clientes registrados
```
clients:{domain}  →  {
  domain:       "megatravel.bitrix24.co",
  name:         "Megatravel",
  contact:      "Oscar Chuquillanqui",
  whatsapp:     "+5712345678",
  email:        "oscar@megatravel.com",
  tools:        ["world-cities", "convertalk-ai"],
  tier:         "premium",
  since:        "2025-01-15"
}
```

### Estado por herramienta y cliente
```
status:{tool}:{domain}  →  {
  status:       "ok" | "down" | "warn" | "unknown",
  lastOk:       "2026-06-26T14:30:00Z",
  lastFail:     null,
  latency_ms:   142,
  message:      "Token válido, placements activos",
  checks: {
    oauth_token:    "ok",
    placements:     "ok",
    token_expires:  47
  }
}
```

### Alertas activas
```
alerts:{tool}:{domain}  →  {
  created_at:     "2026-06-26T10:00:00Z",
  tool:           "world-cities",
  domain:         "megatravel.bitrix24.co",
  severity:       "critical" | "warning",
  message:        "Token expirado — placements inactivos",
  acknowledged:   false,
  notified_at:    null,
  notified_by:    null
}
```

---

## 5. Tablero Visual — QCC Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  🛡️ RIPUZ Quality Control Center         ⟳ hace 12 min      │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  RESUMEN GLOBAL                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 🟢 18   │  │ 🔴  2   │  │ 🟡  1   │  │ 👥 8    │        │
│  │ OK      │  │ DOWN    │  │ WARN    │  │ Clientes│        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│  🔴 ALERTAS ACTIVAS                                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ⏱ hace 2h  WORLD CITIES  megatravel.bitrix24.co       │  │
│  │ Token expirado — Tab Destinos inactivo                 │  │
│  │ Contacto: Oscar Chuquillanqui  +571234567              │  │
│  │ [📱 WhatsApp] [✓ Acknowledger] [🔧 Ver detalle]       │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ ⏱ hace 4h  CONVERTALK AI  otro.bitrix24.co            │  │
│  │ OAuth token inválido — Bot no responde                 │  │
│  │ Contacto: María García  +5798765432                    │  │
│  │ [📱 WhatsApp] [✓ Acknowledge] [🔧 Ver detalle]        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│  ESTADO POR HERRAMIENTA                                      │
│                                                              │
│  🌍 WORLD CITIES                        7/8 OK  🔴 1 DOWN   │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Cliente          Estado  Último OK   Latencia  Acción│    │
│  │ megatravel       🔴 DOWN hace 2h     —        [📱]   │    │
│  │ ovoSanti         🟢 OK   hace 12m   98ms      [📱]   │    │
│  │ alquilando       🟢 OK   hace 12m   134ms     [📱]   │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  🤖 CONVERTALK AI AUTOPILOT             4/5 OK  🔴 1 DOWN   │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Cliente          Estado  Último OK   Latencia  Acción│    │
│  │ megatravel       🟢 OK   hace 12m   89ms       [📱]  │    │
│  │ otro             🔴 DOWN hace 4h     —          [📱]  │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Flujo de Notificación WhatsApp

Cuando el agente de mesa de ayuda hace clic en **[📱 WhatsApp]**:

```
1. QCC Worker recibe POST /api/notify
2. Lee contacto del cliente desde KV: clients:{domain}
3. Llama API de Convertalk/WhatsApp con mensaje template:

   "Hola {Nombre}, soy {Agente} del equipo RIPUZ.
    Detectamos una alerta en {Herramienta} en su portal
    Bitrix24 ({domain}).
    Estamos revisando la situación y le contactamos
    para coordinar el soporte. ¿Es buen momento?"

4. Registra en KV: alerts:{tool}:{domain}.notified_at
5. Actualiza el tablero: ícono 📱 → ✓ Notificado
```

### Templates de mensaje por tipo de alerta

| Alerta | Mensaje |
|---|---|
| Token expirado | "Detectamos que {herramienta} requiere reactivación en su portal." |
| Placements caídos | "El widget {herramienta} no está disponible en sus Deals." |
| Bot sin respuesta | "El bot de WhatsApp no está respondiendo desde hace {tiempo}." |
| OAuth inválido | "La integración con Bitrix24 requiere reautorización." |

---

## 7. Endpoint /health por Herramienta

Cada Worker de RIPUZ expone este endpoint estándar:

```
GET /health?domain={domain}

Respuesta:
{
  "ok": true | false,
  "tool": "world-cities",
  "domain": "megatravel.bitrix24.co",
  "version": "2.0",
  "checks": {
    "oauth_token": "ok" | "expired" | "missing",
    "token_expires_in_min": 47,
    "placements": "ok" | "missing",
    "service": "ok" | "down"
  },
  "latency_ms": 142,
  "timestamp": "2026-06-26T14:30:00Z"
}
```

---

## 8. Cron — Health Check Automático

```
Cada 30 minutos → healthCheckAll()

Para cada tool en ["world-cities", "convertalk-ai", ...]:
  Para cada domain en clients con esa tool:
    GET {tool-worker}/health?domain={domain}
    
    Si ok → actualizar status en KV, limpiar alerta si existía
    Si down → crear/actualizar alerta en KV
    Si token_expires_in_min < 10 → crear alerta WARN
```

---

## 9. Instalación en Bitrix24 RIPUZ

App local — solo para uso interno:

```
ripuz.bitrix24.com
→ Aplicaciones → Desarrollador → Nueva app local
→ Handler: https://ripuz-qcc.workers.dev/dashboard
→ Placement: LEFT_MENU
→ Título: QCC Control Center
→ No requiere OAuth externo
```

---

## 10. Stack Tecnológico

| Componente | Tecnología | Costo |
|---|---|---|
| QCC Worker | Cloudflare Workers JS | $0 |
| KV Storage | Cloudflare KV (QCC_DATA) | $0 |
| Cron Trigger | Cloudflare Cron cada 30min | $0 |
| Dashboard | HTML/CSS/JS en Worker | $0 |
| WhatsApp | Via Convertalk API existente | $0 |
| Bitrix24 app | App local ripuz.bitrix24.com | $0 |
| **Total infraestructura** | | **$0** |

---

## 11. Fases de Implementación

### Fase 1 — MVP (3-4 días)
- [ ] Worker `ripuz-qcc` con dashboard básico
- [ ] KV `QCC_DATA` con modelo de datos
- [ ] Endpoint `/health` en World Cities
- [ ] Cron cada 30 min
- [ ] Tablero con resumen + tabla por herramienta
- [ ] App local en ripuz.bitrix24.com

### Fase 2 — Notificaciones (2 días)
- [ ] Botón WhatsApp en alertas
- [ ] Templates de mensaje por tipo de alerta
- [ ] Registro de notificaciones en KV
- [ ] Acknowledge de alertas

### Fase 3 — Convertalk (2 días)
- [ ] Endpoint `/health` en Convertalk AI Autopilot
- [ ] Endpoint `/health` en Convertalk Bot
- [ ] Integración en dashboard

### Fase 4 — Gestión de clientes (1 día)
- [ ] CRUD de clientes con contacto y WhatsApp
- [ ] Asignación de herramientas por cliente
- [ ] Historial de alertas

### Fase 5 — Nuevas herramientas
- [ ] AI Marketing Explorer
- [ ] IA Bot Creators
- [ ] Cualquier app futura — solo agregar `/health`

---

## 12. Valor para RIPUZ

| Beneficio | Impacto |
|---|---|
| Proactividad | Llamas tú antes de que el cliente reporte |
| Reducción de churn | Cliente percibe soporte premium |
| Mesa de ayuda eficiente | Un solo tablero para todos los clientes |
| Escalabilidad | Nueva herramienta = agregar `/health` |
| Diferenciador comercial | "Monitoreamos tu servicio 24/7" |
| Costo | $0 adicional en infraestructura |

---

## 13. Próximos Pasos

1. ✅ Aprobar arquitectura
2. Definir lista completa de clientes y contactos WhatsApp
3. Crear KV `QCC_DATA` en Cloudflare
4. Agregar `/health` a World Cities (1-2 horas)
5. Construir Worker `ripuz-qcc` MVP
6. Instalar en ripuz.bitrix24.com y probar

---

*RIPUZ SAS — Quality Control Center — Junio 2026*
