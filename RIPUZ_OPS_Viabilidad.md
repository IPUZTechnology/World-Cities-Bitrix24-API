# 🌐 RIPUZ OPS Platform
## Documento de Viabilidad para Mesa Directiva
### Benchmarking · Modelo Financiero · Estrategia de Producto

**Fecha:** Junio 2026  
**Autor:** RIPUZ SAS — Rafael Ipuz  
**Propósito:** Evaluación de viabilidad para aprobación ejecutiva  
**Clasificación:** Confidencial

---

## Resumen Ejecutivo

RIPUZ OPS Platform es una plataforma SaaS multi-tenant que unifica el monitoreo de aplicaciones, canales de comunicación, sensores IoT, dispositivos IP, geolocalización y análisis de video con IA, en un centro de operaciones embebido en Bitrix24.

**La oportunidad:** Ningún competidor actual combina Apps SaaS + Canales + IoT + Video AI + CRM (Bitrix24) + WhatsApp proactivo en un solo producto asequible para LATAM.

**La ventaja de RIPUZ:** Ya tiene la infraestructura (Cloudflare), los clientes (Bitrix24), los canales (Convertalk/WhatsApp) y el conocimiento técnico. El costo de construcción es mínimo. El margen potencial es alto.

---

## 1. Tamaño del Mercado

### Mercado IoT en Agricultura (foco inicial)

El mercado global de IoT en agricultura fue valorado en USD 17.78 mil millones en 2025 y se proyecta crecer a USD 41.29 mil millones en 2035, con un CAGR de 8.79%.

El segmento de servicios es el de mayor crecimiento proyectado, con un CAGR de 13.1% entre 2025 y 2030, impulsado por la necesidad de soluciones integradas de instalación, mantenimiento y analítica de datos.

**¿Por qué es relevante para RIPUZ?** El segmento de servicios — no el hardware — es exactamente donde RIPUZ compite: plataforma SaaS de monitoreo, analítica y gestión, sin fabricar sensores.

### Mercado de Monitoreo y Observabilidad (competidores directos)

Datadog lidera el mercado de observabilidad con aproximadamente 40-44% de cuota de búsqueda, seguido por Zabbix con 25-30%. New Relic ha perdido terreno, bajando al 10%, mientras que Dynatrace se mantiene en 15-17%.

**Hueco del mercado:** Ninguno de los líderes atiende a PYMEs de LATAM con integración nativa a Bitrix24, WhatsApp y IoT agrícola. Ese es el espacio de RIPUZ.

---

## 2. Benchmarking de Competidores

### 2.1 Competidores directos en monitoreo

| Plataforma | Modelo | Precio base | IoT | Canales | Bitrix24 | WhatsApp | LATAM |
|---|---|---|---|---|---|---|---|
| **Datadog** | SaaS | ~$15/host/mes | ❌ | ❌ | ❌ | ❌ | Caro |
| **Zabbix** | Open source | Gratis (infra propia) | Parcial | ❌ | ❌ | ❌ | Complejo |
| **Grafana Cloud** | SaaS/OSS | $49/mes | Parcial | ❌ | ❌ | ❌ | Complejo |
| **New Relic** | SaaS | $49/mes 100GB | ❌ | ❌ | ❌ | ❌ | Caro |
| **PagerDuty** | SaaS | $21/user/mes | ❌ | Parcial | ❌ | ❌ | Caro |
| **PRTG** | On-premise | $2,149/año | Parcial | ❌ | ❌ | ❌ | No |
| **RIPUZ OPS** | SaaS | $49/mes | ✅ | ✅ | ✅ | ✅ | Sí |

### 2.2 Análisis por criterio

#### Lo que los competidores hacen bien
- **Datadog:** Integración masiva (+1000 herramientas), APM robusto, escala enterprise
- **Zabbix:** Gratis, monitoreo de red/SNMP maduro, comunidad grande
- **Grafana:** Visualización flexible, dashboards poderosos, open source

#### Lo que ninguno hace
- Integración nativa con **Bitrix24 CRM**
- **WhatsApp proactivo** al contacto del cliente cuando hay alerta
- **IoT agrícola** con mapas de cultivo y control de riego
- **Video AI** con análisis de comportamiento
- **Llamadas automáticas por IA** cuando se detecta alerta crítica
- **Precio asequible para LATAM** con soporte en español
- **Sin necesidad de DevOps** para instalación

#### ¿Dónde NO debe meterse RIPUZ?
- **APM / Application Performance Monitoring profundo:** Datadog y New Relic tienen años de ventaja en trazas y profiling de código. No competir ahí.
- **SIEM / Seguridad cibernética:** Splunk y Elastic dominan. No es el foco.
- **Kubernetes / Cloud-native monitoring:** Prometheus + Grafana son el estándar. No competir directamente.
- **Enterprise Fortune 500:** Presupuestos de 6 cifras, ciclos de venta de 18 meses. No es el segmento.

---

## 3. Los 7 Módulos

*(actualizado con módulo de Video AI)*

| # | Módulo | Descripción | Vertical principal |
|---|---|---|---|
| 1 | **App Monitor** | OAuth, placements, uptime apps Bitrix24 | Todos |
| 2 | **Channel Monitor** | WhatsApp, VoIP, email, webchat | Todos |
| 3 | **IoT Sensor** | Temperatura, humedad, presión, flujo | Agro, Manufactura |
| 4 | **Device Monitor** | Routers, cámaras IP, PBX, robots, PLC | Telco, Manufactura |
| 5 | **Geo Tracker** | Mapa 2D/3D, geocercas, GPS activos | Agro, Vigilancia |
| 6 | **Video AI** | Análisis de video IA, detección patrones, comportamiento | Vigilancia, Agro, Manufactura |
| 7 | **IA Proactiva** | Alertas automáticas, llamadas VoIP, análisis predictivo | Todos |

### Módulo 6 — VIDEO AI (nuevo)

Integración con plataformas de gestión de video (VMS) y cámaras IP para análisis con IA:

**Funcionalidades:**
- Detección de personas, vehículos, animales en zonas definidas
- Análisis de comportamiento: permanencia, intrusión, conteo
- Reconocimiento de placas vehiculares
- Detección de EPP (cascos, chalecos) en fábricas
- Análisis de cultivos por imagen: salud de planta, madurez
- Búsqueda de eventos en grabaciones por hora/zona/tipo
- Heatmap de movimiento y actividad
- Alertas automáticas cuando IA detecta evento relevante

**Integraciones posibles:**
- Milestone XProtect, Genetec (VMS enterprise)
- Hikvision, Dahua (cámaras IP)
- AWS Rekognition, Google Vision AI (IA en la nube)
- OpenCV (IA propia, costo $0)

**Modelo de dato:** El video NO se almacena en RIPUZ — solo los metadatos y eventos detectados. Así se evita el costo masivo de almacenamiento de video.

---

## 4. Modelo de Planes (revisado)

Los planes se estructuran **por capacidad**, no por vertical. Las verticales son casos de uso, no restricciones.

### 4.1 Planes Base

| Plan | Precio/mes | Servicios monitoreados | Usuarios | Canales | Retención datos |
|---|---|---|---|---|---|
| **Essential** | $39 | Hasta 10 | 2 | 1 canal | 7 días |
| **Professional** | $99 | Hasta 30 | 5 | 3 canales | 30 días |
| **Business** | $199 | Hasta 100 | 15 | Ilimitado | 90 días |
| **Enterprise** | $399 | Ilimitado | Ilimitado | Ilimitado | 1 año |

*"Servicio monitoreado" = 1 app, 1 sensor, 1 dispositivo, 1 canal o 1 cámara.*

### 4.2 Módulos Add-on (se activan sobre cualquier plan)

| Módulo | Precio/mes | Descripción |
|---|---|---|
| IoT Sensor Pack | +$49 | Hasta 50 sensores MQTT/LoRaWAN |
| Geo Tracker | +$39 | Mapa 2D + GPS hasta 20 activos |
| Mapa 3D / Agro | +$79 | Vista 3D + área de influencia + parcelas |
| Video AI | +$99 | Hasta 5 cámaras con análisis IA |
| IA Proactiva | +$69 | Llamadas automáticas + WhatsApp IA |
| Portal Cliente | +$49 | Vista personalizada por cliente final |
| Dispositivo Custom | $250 | Integración one-time por dispositivo |

### 4.3 Ejemplos de configuración por cliente

**Cliente agro-tech básico:**
```
Professional ($99) + IoT Sensor Pack ($49) + Geo Tracker ($39)
= $187/mes por cliente
```

**Cliente agro-tech completo:**
```
Business ($199) + IoT ($49) + Mapa 3D ($79) + Video AI ($99) + IA Proactiva ($69)
= $495/mes por cliente
```

**Cliente telco/vigilancia:**
```
Business ($199) + Video AI ($99) + IA Proactiva ($69)
= $367/mes por cliente
```

**Cliente SaaS/Bitrix24 básico:**
```
Essential ($39)
= $39/mes por cliente
```

---

## 5. Modelo Financiero

### 5.1 Costos de Infraestructura Mensual (Cloudflare)

| Componente | Tier | Costo/mes |
|---|---|---|
| Cloudflare Workers | Paid ($5/mes base) | $5 |
| Cloudflare KV | 1B ops/mes incluidas | $0 |
| Cloudflare D1 (histórico) | 5M rows incluidas | $0–$10 |
| Cloudflare Queues | 1M msgs/mes incluidas | $0 |
| Cloudflare R2 (almacenamiento) | 10GB incluidos, $0.015/GB extra | $0–$15 |
| MQTT Broker (HiveMQ Cloud) | Plan free hasta 100 conexiones | $0–$49 |
| Video AI (OpenCV self-hosted) | Workers con CPU | $10–$30 |
| **Total infraestructura** | | **$15–$109/mes** |

*Escenario conservador con 10 clientes: ~$50/mes en infra total.*  
*Escenario 50 clientes: ~$150/mes en infra total.*

### 5.2 Proyección de Ingresos y Margen

**Escenario Año 1 — Conservador (10 clientes)**

| Clientes | Plan promedio | Ingreso bruto/mes | Costo infra | Margen bruto |
|---|---|---|---|---|
| 5 clientes Essential | $39 | $195 | $50 | $145 (74%) |
| 3 clientes Professional | $99 + $49 IoT | $444 | incl. | $394 (89%) |
| 2 clientes Business completo | $199 + $217 addons | $832 | incl. | $782 (94%) |
| **Total Año 1** | | **$1,471/mes** | **$50** | **$1,421 (97%)** |

**Escenario Año 2 — Moderado (35 clientes)**

| Métrica | Valor |
|---|---|
| Ingreso bruto mensual | ~$8,500/mes |
| Costo infraestructura | ~$150/mes |
| Margen bruto | ~98% |
| Ingreso anual | ~$102,000 |

**Escenario Año 3 — Optimista (80 clientes)**

| Métrica | Valor |
|---|---|
| Ingreso bruto mensual | ~$22,000/mes |
| Costo infraestructura | ~$350/mes |
| Margen bruto | ~98% |
| Ingreso anual | ~$264,000 |

> **Nota:** El margen es altísimo porque la infraestructura es Cloudflare (costo marginal casi $0 por cliente adicional). El costo real es el tiempo de desarrollo y soporte.

### 5.3 Costo de Desarrollo (estimado)

| Fase | Duración | Costo estimado (horas RIPUZ) |
|---|---|---|
| Fase 1 — QCC + App Monitor | 3 semanas | ~60h |
| Fase 2 — IoT + Channel | 6 semanas | ~120h |
| Fase 3 — Geo + Mapas | 6 semanas | ~120h |
| Fase 4 — Video AI | 8 semanas | ~160h |
| Fase 5 — IA Proactiva + Voz | 8 semanas | ~160h |
| **Total** | **~8 meses** | **~620h** |

*A $50 USD/hora (tarifa interna RIPUZ): ~$31,000 de inversión en desarrollo.*  
*Break-even con 35 clientes moderados: ~12-18 meses.*

---

## 6. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Complejidad técnica del Video AI | Media | Alto | Usar APIs de terceros (AWS Rekognition) en lugar de IA propia |
| Conectividad IoT en zonas rurales | Alta | Alto | Soporte LoRaWAN + modo offline con sync posterior |
| Competidor grande entra al mercado LATAM | Media | Alto | Velocidad de go-to-market + especialización en Bitrix24 |
| Cliente no renueva | Media | Medio | Contrato anual con descuento + onboarding incluido |
| Costo MQTT escala | Baja | Medio | HiveMQ tiene plan gratuito; migrar a self-hosted si escala |
| Regulaciones de datos en agro | Baja | Medio | Datos procesados en Cloudflare (CDN LATAM) sin salir de región |

---

## 7. Lo que RIPUZ NO debe hacer

Con base en el benchmarking:

| No hacer | Razón |
|---|---|
| Competir en APM de código | Datadog/New Relic tienen 10 años de ventaja |
| Construir hardware IoT propio | No es el modelo de negocio; integrar sensores existentes |
| Almacenar video en RIPUZ | Costo masivo de almacenamiento; solo metadatos y eventos |
| Apuntar a Fortune 500 | Ciclos de venta de 18 meses, licitaciones, precios $$$$ |
| Construir todo a la vez | Fase 1 primero, validar con clientes reales antes de invertir en Fase 4-5 |
| Entrar a SIEM/Ciberseguridad | Splunk y Elastic son el estándar; no es el diferencial de RIPUZ |

---

## 8. Diferencial Competitivo de RIPUZ

**El único producto del mercado que combina:**

1. **Bitrix24 nativo** — embebido como app en el CRM que el cliente ya usa
2. **WhatsApp proactivo** — alerta al contacto antes de que llame al soporte
3. **IA que llama** — no solo notifica, llama por voz al contacto cuando es crítico
4. **IoT + Apps + Canales + Video** — todo en un solo tablero
5. **Asequible para LATAM** — desde $39/mes vs $200+ de competidores
6. **Sin DevOps** — instalación en minutos, no días
7. **Mesa de ayuda integrada** — chat en vivo, historial, escalamiento desde el mismo tablero

---

## 9. Recomendación para Mesa Directiva

### ✅ Aprobación recomendada con las siguientes condiciones:

1. **Arrancar con Fase 1 únicamente** — QCC interno de RIPUZ (World Cities + Convertalk). Inversión mínima, validación rápida.

2. **Identificar 2-3 clientes piloto** antes de iniciar Fase 2 (IoT):
   - Un cliente agro-tech con sensores existentes
   - Un cliente de telecomunicaciones con dispositivos IP
   - Un cliente de vigilancia con cámaras IP

3. **No invertir en Fase 4 (Video AI) ni Fase 5 (IA Voz)** hasta tener al menos 15 clientes en producción y flujo de caja positivo.

4. **Nombre comercial:** Decidir entre VITRIS OPS, RIPUZ Monitor, NexOps antes del primer cliente externo.

5. **Precio validación:** Ofrecer Fase 1 a $0/mes a los primeros 3 clientes piloto a cambio de feedback y caso de estudio.

---

## 10. Próximos Pasos Inmediatos

| Acción | Responsable | Plazo |
|---|---|---|
| Aprobar viabilidad en mesa directiva | Dirección RIPUZ | Esta semana |
| Seleccionar nombre comercial | Marketing + Dirección | 1 semana |
| Iniciar Fase 1 — QCC Interno | Rafael Ipuz | Inmediato |
| Identificar cliente piloto agro-tech | Comercial RIPUZ | 2 semanas |
| Documento de propuesta para piloto | Rafael Ipuz | 3 semanas |

---

*RIPUZ SAS — Documento Confidencial — Junio 2026*  
*"Un solo lugar para ver todo lo que importa — y actuar desde ahí."*
