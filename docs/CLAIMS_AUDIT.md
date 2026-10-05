# Auditoría de Claims — Sanity & GitHub Challenge

Este documento contiene la revisión técnica independiente de los claims del proyecto AnTaskCanvas, evaluados contra la base de código actual para garantizar honestidad técnica.

---

## 1. `TASKS.md` es la fuente de verdad del proyecto.
- **Estado**: `PARTIALLY CONFIRMED`
- **Archivos**: `markdownSync.ts`, `App.tsx`, `sanityService.ts`
- **Evidencia / Explicación**: `TASKS.md` es la fuente del contenido textual y las definiciones base, pero la metadata de agrupación, el layout visual del canvas y las relaciones entre repositorios existen fuera del Markdown (en el estado de Tldraw o en los esquemas de Sanity). 
- **Redacción alternativa segura**: "`TASKS.md` actúa como el formato de intercambio y contenido base interoperable, mientras que Sanity gestiona la metadata relacional y espacial."

## 2. La aplicación puede importar `TASKS.md`.
- **Estado**: `CONFIRMED`
- **Archivos**: `markdownSync.ts`, `App.tsx`
- **Evidencia / Explicación**: El flujo arranca inyectando texto Markdown, que la aplicación parsea en un AST (`scanTaskBlocks`) y refleja en estado.

## 3. La aplicación puede sanear / normalizar archivos `TASKS.md`.
- **Estado**: `CONFIRMED`
- **Archivos**: `markdownNormalizer.ts`
- **Evidencia / Explicación**: Se usan utilidades de `unified` y `remark-gfm` para estandarizar el formato, categorizando las diferencias en estructurales, eliminaciones o ajustes estéticos.

## 4. La aplicación puede visualizar tareas en Canvas.
- **Estado**: `CONFIRMED`
- **Archivos**: `App.tsx`, `TaskShapeUtil.tsx`
- **Evidencia / Explicación**: Utiliza `tldraw` para instanciar formas personalizadas (`task`, `task-group`) sobre un lienzo infinito navegable.

## 5. La aplicación puede visualizar tareas en Kanban.
- **Estado**: `CONFIRMED`
- **Archivos**: `KanbanBoard.tsx`
- **Evidencia / Explicación**: Existe un componente dinámico de tablero Kanban que categoriza las tareas por su atributo `status` o `sección`.

## 6. La aplicación puede editar tareas visualmente.
- **Estado**: `CONFIRMED`
- **Archivos**: `KanbanBoard.tsx`, `markdownSync.ts`
- **Evidencia / Explicación**: Arrastrar y soltar columnas de Kanban o editar directamente los campos visuales inyecta mutaciones como `updateTaskInMarkdown`.

## 7. La aplicación puede exportar de nuevo a Markdown.
- **Estado**: `CONFIRMED`
- **Archivos**: `App.tsx`, `markdownSync.ts`
- **Evidencia / Explicación**: Toda la interfaz reacciona generando y consolidando de vuelta un bloque de texto que obedece las reglas estrictas de GFM.

## 8. Sanity persiste borradores e ideas.
- **Estado**: `MISLEADING`
- **Archivos**: `sanityService.ts`, `sanity/schemas/canvasVisualState.ts`
- **Evidencia / Explicación**: Sanity almacena tareas firmes (`_type: 'task'`) y disposiciones espaciales (`canvasVisualState`). Si las "ideas" se refieren a trazos sueltos de Tldraw o notas que no son tareas, no está demostrado que el esquema almacene todos los trazos vectores genéricos de Tldraw.
- **Redacción alternativa segura**: "Sanity persiste el estado visual estructurado del proyecto, las tareas y la agrupación espacial de las tarjetas del Canvas."

## 9. Sanity conserva el estado entre sesiones.
- **Estado**: `CONFIRMED`
- **Archivos**: `sanityService.ts` (`loadCanvasVisualState`)
- **Evidencia / Explicación**: Al arrancar la aplicación, se intenta recuperar el estado desde Sanity Content Lake antes de retroceder al LocalStorage.

## 10. Sanity funciona como capa persistente del proyecto.
- **Estado**: `PARTIALLY CONFIRMED`
- **Archivos**: `sanityService.ts`, `workspaceService.ts`
- **Evidencia / Explicación**: Funciona como la capa remota primaria de persistencia para el modelo relacional/visual. Sin embargo, en la práctica actúa paralelamente a LocalStorage (fallback/offline-first).
- **Redacción alternativa segura**: "Sanity funciona como la capa de persistencia estructurada remota del proyecto, apoyándose en LocalStorage para garantizar operaciones offline."

## 11. GitHub actúa como historial versionado mediante commits.
- **Estado**: `CONFIRMED`
- **Archivos**: `GitHubSyncModal.tsx`
- **Evidencia / Explicación**: Se empujan cambios con `commitMessage` y un `hash`, manteniendo un log trazable sobre la plataforma Git.

## 12. Existe sincronización automática con GitHub.
- **Estado**: `NOT CONFIRMED`
- **Archivos**: `GitHubSyncModal.tsx`
- **Evidencia / Explicación**: No hay observadores silenciosos ni cron-jobs de fondo que empujen automáticamente al repositorio. El flujo exige al usuario confirmar y detallar un commit manualmente.
- **Redacción alternativa segura**: "La aplicación permite confirmar (commit) cambios hacia repositorios GitHub mediante una integración directa en la UI."

## 13. Existe autenticación GitHub.
- **Estado**: `MISLEADING`
- **Archivos**: `GitHubSyncModal.tsx`
- **Evidencia / Explicación**: "Autenticación GitHub" suele implicar OAuth (login social automático). La app usa un sistema más manual pidiendo explícitamente al usuario crear y pegar un Personal Access Token (PAT).
- **Redacción alternativa segura**: "El sistema se conecta a GitHub mediante el uso seguro de Personal Access Tokens (PAT)."

## 14. Existe importación directa desde repositorios GitHub.
- **Estado**: `CONFIRMED`
- **Archivos**: `GitHubSyncModal.tsx`
- **Evidencia / Explicación**: Utilizando el PAT, lee el contenido de archivos target para introducirlos en la aplicación.

## 15. Existe exportación directa hacia GitHub.
- **Estado**: `CONFIRMED`
- **Archivos**: `GitHubSyncModal.tsx`
- **Evidencia / Explicación**: La interfaz permite enviar el contenido editado de vuelta mediante la API de GitHub (`PUT /repos/.../contents`).

## 16. Existe sincronización en tiempo real con GitHub.
- **Estado**: `NOT CONFIRMED`
- **Archivos**: Ninguno
- **Evidencia / Explicación**: GitHub requiere pulls/pushes. No existen webhooks locales que empujen los cambios en vivo mientras el usuario teclea.
- **Redacción alternativa segura**: "Existe sincronización remota asíncrona hacia GitHub basada en commits controlados por el usuario."

## 17. Existe realtime con Sanity.
- **Estado**: `CONFIRMED`
- **Archivos**: `sanityService.ts` (`subscribeToSanityLiveChanges`)
- **Evidencia / Explicación**: La función `client.listen()` utiliza Server-Sent Events (SSE) para detectar e inyectar cambios remotos al instante de forma bidireccional en el frontend.

## 18. La app puede recuperar un proyecto tiempo después gracias a Sanity.
- **Estado**: `CONFIRMED`
- **Archivos**: `sanityService.ts` (`fetchSanityDocumentsList`)
- **Evidencia / Explicación**: Sanity almacena los esquemas de `workspace` remotamente de modo persistente.

## 19. La aplicación no depende exclusivamente de almacenamiento local.
- **Estado**: `CONFIRMED`
- **Archivos**: `sanityService.ts`, `GitHubSyncModal.tsx`
- **Evidencia / Explicación**: LocalStorage es usado para fallbacks y configuraciones, pero Sanity y GitHub funcionan como pilares de almacenamiento en la nube reales en el flujo.

## 20. La arquitectura separa contenido, visualización y versionado.
- **Estado**: `CONFIRMED`
- **Archivos**: `markdownSync.ts` (Contenido), `App.tsx` (Visualización/Tldraw), `GitHubSyncModal.tsx` (Versionado Git).
- **Evidencia / Explicación**: Existe una verdadera tri-separación arquitectónica: Contenido interoperable (texto plano/Markdown), Metadatos Visuales (Sanity/Tldraw) e Historial de Cambios (GitHub).

---

## Salida final para la Submission

### Podemos decir
- "AnTaskCanvas interpreta y parsea de forma segura el formato `TASKS.md`, manteniendo su estructura GFM a la vez que permite su importación y exportación de ida y vuelta."
- "Visualiza las tareas simultáneamente en un lienzo infinito (Canvas) y en un tablero Kanban, permitiendo la edición visual directa y reflejando los cambios de nuevo a texto."
- "Se integra con Sanity Content Lake, donde recupera y persiste de manera estructurada los espacios de trabajo (Workspaces) y sus posiciones visuales del lienzo."
- "Habilita la sincronización en tiempo real (Realtime) mediante la API de Sanity, inyectando cambios mutados a la aplicación local dinámicamente."
- "Se integra bidireccionalmente con GitHub a través de Tokens Personales (PAT), permitiendo importar datos y hacer commits manuales directos a ramas y repositorios."
- "Presenta una arquitectura resiliente que no depende exclusivamente del navegador (LocalStorage), apoyándose en la nube pero separando inteligentemente el contenido textual (MD), su ubicación visual (Sanity) y su trazabilidad (GitHub)."

### Podemos decir con matices
- **Sanity como persistencia y fuente de verdad:** "Sanity actúa como capa de persistencia remota para los esquemas estructurales y espaciales, cooperando con el formato `TASKS.md` que conserva la interoperabilidad del texto puro."
- **Flujo de Sanity para ideas:** "Sanity conserva el estado visual y la agrupación semántica que da forma a las tarjetas y tareas en el lienzo para poder ser recuperados en el futuro."

### No debemos decir todavía
- "Sincronización silenciosa, automática o en tiempo real con GitHub."
- "Flujo de autenticación sin fricción ('Login with GitHub' mediante OAuth)."
- "Persistencia de base de datos offline absoluta basada en IndexedDB."
- "Sanity persiste absolutamente cada trazo de dibujo o boceto a mano alzada."

### Visión futura
- Soporte para webhooks nativos o bots de GitHub que comuniquen pushes en tiempo real desde fuera hacia el tablero.
- Flujo de GitHub App OAuth (Auth0/NextAuth) para evitar el uso manual de tokens PAT.
- Workflows y Content Releases de Sanity para manejar flujos de aprobación antes de hacer push automático a GitHub.
