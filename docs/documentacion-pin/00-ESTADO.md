# Estado de la Carpeta de Documentación — PataMatch (PIN 2026)

Checklist de trabajo interno del equipo. Se arma contra el documento oficial
**"Requisitos de la Carpeta de Documentación - PIN 2026"** (Mgter. Lic. Enzo Varela).
No es para entregar — es la lista de tareas para llegar al documento final en PDF.

**Actualizado: 22 de septiembre de 2026.**

## Novedad del 22 de septiembre

Se agregó el **carnet digital por animal del catálogo** con **cartel de estado de salud**
(disponible / con cuidados / en reposo / cirugía en camino). Ya quedó reflejado en 2.6
(RF-26) y en 2.11 (tabla `pet_carnets`, columnas `health_status` y `health_note` en `pets`).
Falta sumarlo al manual de usuario (2.13: cómo cargar el carnet desde el backoffice y cómo
verlo tocando la foto) y tomar una captura del modal del carnet para `docs/capturas/`.

También se amplió el **panel de gestión del refugio** (gráficos de actividad por mes,
estado de salud, solicitudes, especies, cobertura de carnets, donaciones por mes y
tránsitos activos) y se agregó la página **Refugios** (`#refugios`): mapa Leaflet con los
refugios registrados más los que devuelve Google Places / OpenStreetMap en la zona
(`GET /api/refugios` y `GET /api/refugios/externos`, ver 2.12 para la clave). Pendiente:
sumar RF-27 (directorio y mapa de refugios) en 2.6, describir el panel nuevo en 2.13 y
sumar Google Places / Nominatim como servicios externos en 2.9.

Se agregó `scripts/seed-demo.js`, que carga datos de demostración (refugios, mascotas con
carnet, perdidas, comunidad, chats, donaciones, tránsitos) y se puede limpiar sin tocar lo
real; ver 2.12. Con eso el catálogo pasó a cargarse de a tandas ("Ver más mascotas"), porque
antes solo mostraba las 20 más nuevas.

Como OpenStreetMap casi no tiene refugios cargados en Latinoamérica (1 en Córdoba, 0 en
Buenos Aires) y Overture Maps trae sobre todo criaderos y pet shops, se agregó el botón
**Sumá un refugio**: la comunidad carga los refugios chicos que no figuran en ningún mapa y
un admin los aprueba desde el panel de gestión (tabla `shelter_suggestions` en 2.11,
endpoints `/api/refugios/comunidad` en 2.12). Pendiente: describir el flujo en 2.13 (cómo
sugerir un refugio y cómo moderar) y sumarlo como requerimiento en 2.6.

## Cambio de contexto respecto de la revisión anterior

Entre el 5 de agosto y esta fecha se implementaron los módulos que estaban pendientes:
sistema de roles, asistente de IA, backoffice de gestión, voluntariado (hogares de
tránsito), donaciones y alertas automáticas por cercanía. **Los seis módulos exigidos por
la consigna están construidos y probados.** Varios apartados de esta carpeta describían
esas funciones como "planeadas" y quedaron actualizados.

| # | Apartado | Estado | Qué falta puntualmente |
|---|----------|--------|-------------------------|
| 2.1 | Portada | 🟡 Plantilla lista | Confirmar fecha de entrega y nombre exacto de la carrera |
| 2.2 | Índice | 🟡 Plantilla lista | Se completa al final, con número de página real |
| 2.3 | Resumen Ejecutivo | 🟡 Revisar | Actualizar: las alertas geolocalizadas ya existen, y hay que sumar voluntariado y donaciones al alcance |
| 2.4 | Problema y Oportunidad | 🟡 Parcial | Falta "Justificación del proyecto" e "Impacto esperado" como puntos explícitos |
| 2.5 | Modelo de Negocio (Canvas) | 🟢 **Completo** | Resuelto el bloque de Fuentes de Ingresos y definida la figura de asociación civil. Falta pasarlo al formato visual de 9 bloques y definir el nombre legal |
| 2.6 | Requerimientos del Sistema | 🟢 **Completo** | 25 requerimientos funcionales con estado verificado contra el código, casos de uso y no funcionales. Falta redactar la política de privacidad que se menciona |
| 2.7 | Diagramas del Sistema | 🟢 **Completo** | Los 5 diagramas escritos en Mermaid y validados. **Falta exportarlos como imagen** antes de armar el Word |
| 2.8 | Diseño y Prototipado UX/UI | 🟢 Redactado | Mockups de Google Stitch (8 pantallas) + capturas reales del sistema en `docs/capturas/`. Falta resolver el nombre "Kindred Paws" que aparece en el design system |
| 2.9 | Arquitectura Técnica | 🟡 Revisar | Sumar Gemini como servicio externo y las tablas nuevas |
| 2.10 | Implementación de IA | 🟢 **Completo** | Implementado, documentado y con ejemplo real de funcionamiento |
| 2.11 | Base de Datos | 🟡 Revisar | Faltan las tablas nuevas en el diccionario: `volunteers`, `foster_stays`, `volunteer_tasks`, `donations`, y las columnas agregadas a `users`, `pets`, `lost_pets` y `chats` |
| 2.12 | Manual Técnico | 🟡 Revisar | Sumar la variable `GEMINI_API_KEY` a la configuración |
| 2.13 | Manual de Usuario | 🟡 Parcial | Ya hay 10 capturas reales en `docs/capturas/`. Falta redactar los flujos de los módulos nuevos |
| 2.14 | Pruebas del Sistema | 🟢 **Completo** | 7 tandas ejecutadas con resultados y defectos corregidos. Faltan las pruebas de usabilidad con 3 usuarios reales |
| 2.15 | Conclusiones | 🔴 Falta | Debe ser reflexión genuina del equipo, no se puede pre-completar |
| 2.16 | Anexos | 🟡 Plantilla lista | Falta el video demostrativo y la selección final de código |

**Leyenda:** 🟢 redactado y usable · 🟡 hay avance, falta cerrar · 🔴 no existe

## Lo más urgente

1. **2.15 Conclusiones** — es el único apartado en rojo y lo tiene que escribir el equipo.
2. **Exportar los diagramas del 2.7 como imagen** — Mermaid no se renderiza en Word.
3. **Pruebas de usabilidad con 3 usuarios reales** — no se puede automatizar.
4. **Video demostrativo** para el 2.16.

## Regla de formato final (sección 3 del documento de requisitos)

Cuando junten todo en un solo PDF:
- Tamaño de hoja A4, tipografía Arial o Times New Roman 11-12pt, interlineado 1.5, márgenes 2.5cm.
- Extensión sugerida: 40 a 70 páginas sin contar anexos (mínimo 30).
- Los diagramas en Mermaid hay que exportarlos como imagen (png/svg) antes de pegarlos en
  el Word/PDF final — Mermaid no se ve en Word.

## Pendiente operativo

- **Rotar la clave de la API de Gemini** al cerrar el proyecto.
