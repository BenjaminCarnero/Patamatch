# Estado de la Carpeta de Documentación — PataMatch (PIN 2026)

Checklist de trabajo interno del equipo. Se arma contra el documento oficial
**"Requisitos de la Carpeta de Documentación - PIN 2026"** (Mgter. Lic. Enzo Varela).
No es para entregar — es la lista de tareas para llegar al documento final en PDF.

Actualizado: 18 de agosto de 2026 (en esta fecha se revisó únicamente la fila 2.10 — el
resto del cuadro sigue reflejando el estado del 5 de agosto).

| # | Apartado | Estado | Qué falta puntualmente |
|---|----------|--------|-------------------------|
| 2.1 | Portada | 🟡 Plantilla lista | Confirmar fecha de entrega y nombre exacto de la carrera |
| 2.2 | Índice | 🟡 Plantilla lista | Se completa al final, con número de página real |
| 2.3 | Resumen Ejecutivo | 🟢 Redactado | Revisar: menciona "alertas activas" como si ya existieran — hay que ajustar el tiempo verbal hasta que estén construidas, y sumar comunidad/historias/carnet si se mantienen en el alcance |
| 2.4 | Problema y Oportunidad | 🟡 Parcial | Falta "Justificación del proyecto" e "Impacto esperado" como puntos explícitos |
| 2.5 | Modelo de Negocio (Canvas) | 🔴 Falta | No existe en ningún documento compartido. Es 100% trabajo del equipo — no lo puedo completar por ustedes |
| 2.6 | Requerimientos del Sistema | 🟡 Parcial | Funcionales: listado inicial armado. No funcionales: borrador para validar. Faltan casos de uso en formato estándar (actor/precondición/flujo/postcondición) |
| 2.7 | Diagramas del Sistema | 🟡 Parcial | DER y Arquitectura: borrador en Mermaid listo para pulir. Casos de Uso, Clases y Secuencia (mín. 2): no existen — hay que dibujarlos |
| 2.8 | Diseño y Prototipado UX/UI | 🟢 Redactado | Mockups de alta fidelidad + código HTML hechos con Google Stitch (8 pantallas), justificación de diseño sacada del sistema de diseño real. Solo falta resolver el nombre "Kindred Paws" que aparece en el design system en vez de "PataMatch" |
| 2.9 | Arquitectura Técnica | 🟢 Redactado | Sacado directo del código real. Revisar y ajustar si cambia el proveedor de IA |
| 2.10 | Implementación de IA | 🔴 Falta (código) / 🟡 Diseño cerrado | **Sigue 0% construido.** El 18/8/2026 se cerraron alcance y proveedor: dos funcionalidades (autocompletar ficha desde foto + cuestionario guiado de adopción) con **Google Gemini**, SDK `@google/genai`. El documento tiene el diseño, los trade-offs y un checklist de implementación. Falta: cuenta/cuota, elegir modelo, codear, probar y capturar evidencia |
| 2.11 | Base de Datos | 🟢 Redactado | Diccionario de datos completo, sacado del esquema real (`backend/db/database.js`) |
| 2.12 | Manual Técnico | 🟢 Redactado | Instalación y configuración reales. Falta sección de mantenimiento si cambian de proveedor de IA/hosting |
| 2.13 | Manual de Usuario | 🟡 Parcial | Flujos reales descriptos. Faltan capturas de pantalla reales del sistema desplegado |
| 2.14 | Pruebas del Sistema | 🟡 Parcial | Casos de prueba armados 1 a 1 contra las historias de usuario. Faltan: ejecutarlos, capturar evidencia, y sumar pruebas de usabilidad con 3 usuarios reales |
| 2.15 | Conclusiones | 🔴 Falta | Debe ser reflexión genuina del equipo, no se puede pre-completar |
| 2.16 | Anexos | 🟡 Plantilla lista | Falta video demostrativo y selección final de código relevante |

**Leyenda:** 🟢 redactado y usable · 🟡 hay avance, falta cerrar · 🔴 no existe, hay que arrancar de cero

## Regla de formato final (sección 3 del documento de requisitos)

Cuando junten todo en un solo PDF:
- Tamaño de hoja A4, tipografía Arial o Times New Roman 11-12pt, interlineado 1.5, márgenes 2.5cm.
- Extensión sugerida: 40 a 70 páginas sin contar anexos (mínimo 30).
- Los diagramas en Mermaid de este borrador hay que exportarlos como imagen (png/svg) antes de pegarlos en el Word/PDF final — Mermaid no se ve en Word.
