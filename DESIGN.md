# DESIGN.md

## 1. Objetivo

Sistema visual de AnAppWiLos para el organizador de `TASKS.md`.

La interfaz debe inspirarse en el lenguaje visual moderno de Google y Material Design 3:

- limpia
- funcional
- ligera
- profesional
- fácil de escanear
- consistente
- centrada en productividad

No copiar interfaces concretas de productos Google.

---

## 2. Principios

1. Priorizar contenido sobre decoración.
2. Mantener alta densidad de información sin saturar.
3. Usar jerarquía visual clara.
4. Reducir elementos visuales innecesarios.
5. Todas las acciones deben tener estados hover, focus, active y disabled.
6. Mantener consistencia entre todas las vistas.
7. No introducir estilos nuevos si ya existe un componente equivalente.
8. El diseño debe funcionar correctamente en escritorio y adaptarse a móvil.

---

## 3. Estructura principal

```text
┌─────────────────────────────────────────────┐
│ Top App Bar                                 │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │          Workspace               │
│          │                                  │
│          │                                  │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

### Top App Bar

Contiene únicamente acciones globales:

- nombre/proyecto actual
- búsqueda
- cambio de vista
- acciones globales
- menú de usuario/configuración

Debe mantenerse visualmente ligera.

### Sidebar

Usar navegación lateral compacta.

Puede contener:

- proyectos
- archivos `TASKS.md`
- vistas
- filtros
- etiquetas
- configuración

Debe poder colapsarse.

### Workspace

Es la zona protagonista.

Debe ocupar el máximo espacio disponible.

Aquí aparecen:

- tablero
- canvas
- tareas
- grupos
- relaciones
- detalles

---

## 4. Color

Usar tokens semánticos, nunca colores arbitrarios directamente en componentes.

```css
--primary
--on-primary

--primary-container
--on-primary-container

--secondary
--on-secondary

--surface
--surface-container
--surface-container-high

--on-surface
--on-surface-variant

--outline
--outline-variant

--error
--on-error
```

Soportar:

```text
Light theme
Dark theme
```

No utilizar colores intensos en grandes superficies.

El color primario debe reservarse principalmente para:

- selección
- acciones principales
- estados activos
- indicadores importantes

---

## 5. Tipografía

Preferencia:

```text
Roboto
Arial
sans-serif
```

Jerarquía aproximada:

```text
Display     32px
Headline    24px
Title       18px
Body        14-16px
Label       12-14px
Metadata    12px
```

Evitar exceso de pesos tipográficos.

Usar principalmente:

```text
400 regular
500 medium
600 semibold
```

---

## 6. Espaciado

Usar escala consistente basada en 4 px.

```text
4
8
12
16
20
24
32
40
48
```

Valores preferidos:

```text
gap pequeño       8px
gap normal       12px
padding control  12px
padding card     16px
secciones        24px
grandes bloques  32px
```

No introducir valores arbitrarios salvo necesidad justificada.

---

## 7. Bordes

Estética suave tipo Material moderno.

```text
small     8px
medium   12px
large    16px
XL       24px
pill     999px
```

Cards:

```text
12-16px
```

Botones:

```text
20-24px o pill
```

---

## 8. Elevación

Evitar sombras fuertes.

Priorizar:

1. diferencia de superficie
2. borde
3. elevación ligera

Las sombras solo deben comunicar jerarquía o elementos flotantes.

---

## 9. Tareas

Una tarea es la unidad visual principal.

Ejemplo:

```text
┌──────────────────────────────┐
│ Implementar importación   ⋮  │
│                              │
│ Añadir lectura de TASKS.md   │
│                              │
│ Frontend    Alta             │
│                              │
│ ✓ 3/5             #TASK-012  │
└──────────────────────────────┘
```

Debe permitir mostrar:

- título
- descripción corta
- estado
- prioridad
- etiquetas
- progreso
- identificador
- dependencias
- subtareas

No mostrar información inexistente.

---

## 10. Estados

Estados principales:

```text
Backlog
Todo
In Progress
Blocked
Review
Done
```

El color nunca debe ser el único mecanismo para diferenciarlos.

Combinar:

```text
texto + icono + color
```

---

## 11. Prioridades

```text
Low
Medium
High
Critical
```

Representarlas discretamente mediante:

- chip
- icono
- indicador lateral

Evitar llenar toda la tarjeta con el color de prioridad.

---

## 12. Chips

Usarlos para:

- etiquetas
- filtros
- estado
- prioridad
- categorías

Características:

```text
compactos
redondeados
texto corto
fáciles de escanear
```

Evitar demasiados chips simultáneamente.

---

## 13. Botones

Jerarquía:

### Primary

Acción principal de la pantalla.

### Secondary

Acciones importantes secundarias.

### Text / Icon

Acciones frecuentes o de menor importancia.

Nunca mostrar varias acciones visualmente dominantes simultáneamente.

---

## 14. Canvas

El Canvas debe sentirse como un espacio de trabajo, no como una página web tradicional.

Debe soportar:

- desplazamiento
- zoom
- selección múltiple
- drag & drop
- agrupación
- conexiones
- menú contextual

Los elementos seleccionados deben tener un indicador claro.

---

## 15. Kanban

Columnas:

```text
Backlog
Todo
In Progress
Review
Done
```

Cada columna debe mostrar:

```text
nombre
contador
acciones
tareas
```

Permitir drag & drop entre columnas.

No usar columnas excesivamente anchas.

---

## 16. Panel de detalles

Al seleccionar una tarea, abrir preferentemente un panel lateral.

```text
Workspace                  Details
────────────────────────┬──────────
                        │ TASK-012
                        │
                        │ título
                        │ descripción
                        │ estado
                        │ prioridad
                        │ etiquetas
                        │ dependencias
                        │ subtareas
                        │
                        │ historial
```

Evitar cambiar completamente de pantalla para editar una tarea.

---

## 17. Interacciones

Duración recomendada:

```text
100-250 ms
```

Las animaciones deben comunicar:

- aparición
- desplazamiento
- expansión
- selección
- cambio de estado

Nunca añadir animaciones puramente decorativas que ralenticen el trabajo.

---

## 18. Iconos

Preferencia:

```text
Material Symbols
```

Mantener una única familia de iconos en toda la aplicación.

Tamaños habituales:

```text
18px
20px
24px
```

---

## 19. Accesibilidad

Objetivos mínimos:

- navegación completa mediante teclado
- focus visible
- contraste adecuado
- labels accesibles
- áreas táctiles suficientes
- no depender exclusivamente del color
- respetar `prefers-reduced-motion`

---

## 20. Responsive

### Desktop

Sidebar + Workspace + panel opcional.

### Tablet

Sidebar colapsable + Workspace.

### Mobile

Navegación compacta.

Una tarea o panel principal por vez.

No intentar reproducir el canvas de escritorio completo si perjudica la usabilidad.

---

## 21. Densidad

El producto es una herramienta de productividad.

Priorizar una densidad:

```text
compacta pero respirable
```

No convertir cada elemento en una card grande.

La información secundaria debe ocupar menos espacio que la información operativa.

---

## 22. Reglas para agentes IA

Al modificar la interfaz:

1. Leer este archivo antes de realizar cambios visuales.
2. Mantener la funcionalidad existente.
3. No modificar lógica de negocio por razones estéticas.
4. Reutilizar componentes existentes.
5. Reutilizar tokens existentes.
6. No introducir colores arbitrarios.
7. No introducir nuevos radios o espaciados sin necesidad.
8. No duplicar componentes equivalentes.
9. Mantener Light/Dark.
10. Mantener responsive.
11. Mantener accesibilidad.
12. Evitar dependencias nuevas si CSS/componentes existentes son suficientes.

Antes de crear un componente nuevo:

```text
¿Existe ya uno equivalente?
        │
        ├─ Sí → reutilizar/extender
        │
        └─ No → crear componente reutilizable
```

---

## 23. Regla fundamental

Cuando exista conflicto entre:

```text
estética
vs.
claridad
vs.
funcionalidad
```

priorizar:

```text
funcionalidad
→ claridad
→ estética
```

El objetivo no es que la aplicación "parezca Google".

El objetivo es aplicar un sistema visual coherente inspirado en los principios de Material Design a una herramienta profesional de gestión visual de `TASKS.md`.