# UNIVERSAL\_WEB\_DESIGN\_GUIDELINES.md

> Guía universal de diseño, UX e implementación para aplicaciones web profesionales.
>
> Diseñada para humanos y agentes de IA (Codex, Claude, Gemini, Cursor, etc.).
>
> Objetivo: producir interfaces \*\*sobrias, profesionales, legibles, eficientes, accesibles, rápidas y consistentes\*\*, evitando la estética genérica de aplicaciones generadas por IA.

\---

# 1\. Principio rector

La interfaz debe parecer un **producto profesional diseñado para trabajar durante horas**, no una landing page, una demo de IA, una startup promocional o una plantilla visual.

Prioridad:

1. Claridad
2. Legibilidad
3. Jerarquía
4. Densidad adecuada
5. Consistencia
6. Accesibilidad
7. Rendimiento
8. Personalidad visual controlada

La decoración nunca debe competir con el contenido.

\---

# 2\. Estética visual por defecto

Cuando no exista un diseño específico proporcionado por el proyecto, usar una estética:

* profesional;
* sobria;
* limpia;
* madura;
* funcional;
* orientada a trabajo prolongado;
* adecuada para aplicaciones de productividad;
* usable en sesiones largas;
* compatible con tema claro y oscuro;
* con contraste suficiente;
* con color reservado para significado y jerarquía.

La interfaz debe poder encajar en:

* herramientas internas;
* dashboards;
* software empresarial;
* editores;
* gestores;
* aplicaciones técnicas;
* sistemas administrativos;
* productos SaaS;
* aplicaciones educativas;
* herramientas de análisis;
* aplicaciones de escritorio web;
* software profesional.

No asumir una estética “startup” salvo petición expresa.

\---

# 3\. Prohibiciones visuales por defecto

No introducir automáticamente:

* glassmorphism;
* neomorphism;
* gradients llamativos;
* fondos aurora;
* blobs decorativos;
* glow excesivo;
* neón;
* paletas excesivamente vibrantes;
* tarjetas flotantes sin función;
* cards dentro de cards;
* bordes redondeados exagerados;
* sombras profundas;
* fondos con ruido decorativo;
* animaciones ornamentales;
* iconos gigantes;
* hero sections enormes;
* slogans de marketing;
* ilustraciones decorativas de startup;
* mockups flotantes;
* badges promocionales;
* efectos “AI”;
* estética cyberpunk;
* estética cripto;
* estética gamer;
* interfaces que parezcan una landing page cuando son una herramienta;
* dashboards construidos exclusivamente mediante mosaicos de cards.

Estas técnicas solo pueden utilizarse si:

1. el usuario las solicita;
2. ya forman parte del lenguaje visual existente;
3. existe una razón funcional clara.

\---

# 4\. Regla anti-“AI generated UI”

La ausencia de una especificación visual **NO autoriza al agente a inventar una estética decorativa**.

Cuando falte dirección visual:

```text
preferir:
sobrio → estructurado → funcional → legible

antes que:
llamativo → futurista → decorativo → promocional
```

No añadir elementos visuales únicamente para que la interfaz “parezca más diseñada”.

Cada elemento visible debe cumplir al menos una función:

* informar;
* agrupar;
* jerarquizar;
* permitir una acción;
* mostrar estado;
* facilitar orientación.

\---

# 5\. Jerarquía de decisiones de diseño

Ante cualquier decisión visual, seguir este orden:

1. Diseño existente del proyecto.
2. Capturas, Figma o mockups proporcionados.
3. Componentes existentes.
4. Tokens y estilos existentes.
5. Este documento.
6. Convenciones de la plataforma.
7. Solución visual neutra y funcional.

Nunca usar como referencia implícita:

* diseños populares de Dribbble;
* estética “AI SaaS”;
* tendencias decorativas;
* plantillas de landing pages;
* componentes visualmente llamativos sin necesidad.

\---

# 6\. Tema claro y oscuro

Toda interfaz debe diseñarse considerando ambos temas desde el principio cuando el producto los soporte.

## Tema claro

Debe evitar:

* blanco puro en grandes superficies si genera fatiga;
* contraste excesivamente duro;
* sombras innecesarias;
* demasiadas superficies diferenciadas.

Preferir:

* fondos neutros;
* superficies ligeramente diferenciadas;
* bordes sutiles;
* texto principal oscuro, no necesariamente negro absoluto.

## Tema oscuro

Debe evitar:

* negro absoluto como fondo general salvo necesidad;
* blanco puro para todo el texto;
* saturación elevada;
* contrastes agresivos;
* glow.

Preferir:

* fondos gris oscuro o casi negros;
* superficies diferenciadas mediante luminosidad;
* texto principal claro pero no blanco puro;
* colores de estado moderados;
* bordes suaves y visibles.

## Reglas

* Nunca invertir colores de forma mecánica.
* Revisar contraste en ambos temas.
* Los estados semánticos deben funcionar en ambos.
* Evitar colores que solo sean legibles en uno de los temas.
* Los componentes deben conservar jerarquía visual en ambos modos.

\---

# 7\. Sistema de color

El color debe ser **funcional antes que decorativo**.

Usar:

* neutrales para estructura;
* un color de acento principal;
* colores semánticos para estados.

Estados habituales:

* información;
* éxito;
* advertencia;
* error;
* selección;
* foco.

Evitar usar muchos colores simultáneamente.

Si un elemento puede entenderse perfectamente sin color, el color debe actuar como refuerzo, no como única señal.

\---

# 8\. Tipografía

La tipografía debe favorecer sesiones de lectura prolongadas.

Preferir tipografías:

* sans-serif;
* profesionales;
* neutras;
* altamente legibles;
* con buena diferenciación entre caracteres;
* adecuadas para UI;
* con pesos suficientes sin depender de demasiadas variantes.

Familias adecuadas:

* Inter;
* Roboto;
* IBM Plex Sans;
* Source Sans 3;
* Segoe UI;
* system-ui.

No introducir tipografías decorativas como fuente principal de interfaz.

\---

# 9\. CamelCase y nombres

Para nombres de entidades, módulos, recursos técnicos o elementos identificables, se puede utilizar CamelCase cuando forme parte del lenguaje del producto:

```text
ProjectManager
FileExplorer
ConflictResolver
PhotoSession
UserSettings
```

No convertir frases normales de UI a CamelCase.

Correcto:

```text
ConflictResolver
Archivos procesados
Última actualización
```

Incorrecto:

```text
ArchivosProcesados
UltimaActualizacion
GuardarCambiosAhora
```

CamelCase es apropiado para nombres técnicos, módulos, herramientas, productos, entidades o identificadores visibles cuando forman parte de la identidad. El texto normal de interfaz debe seguir lenguaje natural.

\---

# 10\. Escala tipográfica

Mantener una jerarquía contenida.

```text
12–13 px   metadata / captions
14 px      UI secundaria
15–16 px   texto principal
18–20 px   subtítulos
22–28 px   títulos de sección
28–36 px   títulos principales
```

Evitar titulares gigantes en aplicaciones internas, escalas tipo landing page, diferencias extremas de tamaño y texto excesivamente pequeño.

Para aplicaciones densas, priorizar **14–16 px** como rango principal.

\---

# 11\. Densidad

Una aplicación profesional no debe desperdiciar espacio.

Evitar interfaces donde:

* cada dato tenga su propia card;
* haya márgenes enormes;
* la información útil quede dispersa;
* haya mucho scroll por decisiones decorativas;
* la densidad sea artificialmente baja.

Orientación:

```text
Aplicación productiva / técnica  → media-alta / alta
Administración / gestión         → media
Aplicación de lectura            → media-baja
Marketing                        → fuera del alcance por defecto
```

\---

# 12\. Spacing

Usar una escala consistente:

```text
4
8
12
16
24
32
48
```

Evitar valores arbitrarios salvo necesidad real.

Los espacios pequeños deben crear relaciones. Los grandes deben separar contextos. No usar whitespace como decoración excesiva.

\---

# 13\. Bordes y radios

Los radios deben ser moderados.

```text
4–6 px   controles compactos
6–8 px   componentes
8–12 px  superficies principales
```

Evitar por defecto radios de 20, 24, 32 o 9999 px, excepto elementos naturalmente píldora como tags, chips, badges o toggles.

No redondear todos los elementos porque sí.

\---

# 14\. Sombras

Preferir:

```text
border + diferencia de superficie
```

antes que sombras.

Usar sombra solo cuando comunique elevación, overlay, menú flotante, modal, drag o separación temporal.

Evitar sombras decorativas permanentes en cada componente.

\---

# 15\. Cards

No convertir cada grupo de información en una card.

Una card debe existir porque representa:

* una entidad;
* una unidad independiente;
* un elemento seleccionable;
* un bloque con acciones propias;
* un elemento que puede reordenarse;
* una unidad visual claramente separable.

No usar card para cada métrica, label, grupo de texto o sección que podría ser simplemente un encabezado + contenido.

Preferir estructuras simples y planas cuando comuniquen mejor.

\---

# 16\. Layout

Preferir estructuras claras:

```text
Header
Sidebar
Main
Inspector
Footer / Status
```

O:

```text
Toolbar
Content
Details
```

La navegación debe permanecer estable. No mover controles principales según contenido salvo necesidad.

Priorizar alineación, ritmo, columnas, jerarquía y agrupación semántica.

\---

# 17\. Tablas y datos densos

Para aplicaciones profesionales con mucha información:

* usar tablas cuando los datos sean comparables;
* permitir orden;
* filtros;
* selección;
* columnas claras;
* densidad ajustable cuando tenga sentido;
* encabezados persistentes en tablas largas;
* truncado con acceso al contenido completo;
* jerarquía visual sutil.

No reemplazar automáticamente tablas por grids de cards.

\---

# 18\. Toolbars

Las acciones principales deben estar agrupadas de forma estable.

Una toolbar profesional debe:

* tener pocas acciones principales visibles;
* agrupar acciones secundarias;
* evitar iconos sin significado evidente;
* usar tooltip cuando el icono no sea universal;
* mantener orden consistente.

No usar botones enormes para acciones frecuentes.

\---

# 19\. Botones

Jerarquía recomendada:

```text
Primary
Secondary
Tertiary / Ghost
Destructive
```

No convertir todas las acciones en primary.

En una misma zona, normalmente debe existir **un único primary action dominante**.

Evitar botones gigantes, gradientes, glow, animaciones llamativas y pills enormes sin razón.

\---

# 20\. Iconografía

Preferir una única familia de iconos.

Debe mantener:

* trazo consistente;
* tamaño consistente;
* estilo sobrio;
* significado reconocible.

No mezclar filled, outline, 3D, emoji e ilustraciones sin sistema.

\---

# 21\. Animaciones

Las animaciones deben explicar cambios de estado, mantener contexto o mejorar continuidad.

```text
100–150 ms   microinteracción
150–250 ms   transición estándar
200–300 ms   overlays / paneles
```

Evitar por defecto bounce, springs exagerados, zoom dramático, glow animado, fondos en movimiento, particles, parallax, animaciones constantes y transiciones largas.

Respetar `prefers-reduced-motion`.

\---

# 22\. Marketing vs aplicación

Una aplicación no debe comportarse visualmente como una landing page.

Dentro del producto evitar:

* slogans;
* hero sections;
* claims;
* banners promocionales;
* copy aspiracional;
* CTAs gigantes;
* elementos puramente comerciales.

El producto debe mostrar función, estado, contexto, acción y datos.

\---

# 23\. Formularios

Los formularios deben ser predecibles.

Preferir:

```text
Label
\[ Input                       ]
Texto de ayuda
```

No depender del placeholder como label.

Mostrar validación, error, ayuda, disabled y loading cuando corresponda.

\---

# 24\. Feedback

Cada acción debe producir feedback proporcional.

* Inmediato → cambiar estado visible.
* Operación lenta → mostrar progreso o loading.
* Acción completada → confirmar solo cuando aporte valor.
* Error → explicar qué ocurrió, qué impacto tiene y qué puede hacerse.

No abusar de toast notifications. Si un cambio puede representarse directamente en la UI, preferir eso.

\---

# 25\. Estados vacíos

Los empty states deben ser útiles, no promocionales.

Correcto:

```text
No hay archivos.

Arrastra archivos aquí o utiliza “Añadir archivos”.
```

Evitar:

```text
✨ Empieza tu increíble viaje
Transforma tu productividad con IA
```

\---

# 26\. Accesibilidad

Toda UI debe:

* usar HTML semántico;
* soportar teclado;
* mantener foco visible;
* tener labels;
* mantener contraste;
* no depender únicamente de color;
* respetar preferencias del usuario;
* evitar trampas de foco.

ARIA debe complementar HTML, no sustituirlo innecesariamente.

\---

# 27\. Responsive

Diseñar por espacio disponible, no por dispositivos concretos.

Preferir Grid, Flexbox, container queries y media queries justificadas.

No asumir:

```text
desktop = mouse
mobile = touch
```

Una aplicación de escritorio debe degradar su layout de forma coherente en ventanas pequeñas.

\---

# 28\. Rendimiento visual

No añadir efectos visuales que introduzcan coste importante sin beneficio.

Evitar:

* blur masivo;
* filtros CSS caros;
* fondos animados;
* múltiples sombras;
* listeners por elemento innecesarios;
* animaciones continuas;
* render masivo de componentes invisibles.

La UI debe sentirse inmediata.

\---

# 29\. Estados de aplicación

Toda pantalla relevante debe contemplar:

* loading;
* empty;
* error;
* partial;
* disabled;
* offline cuando aplique;
* permisos insuficientes;
* operación en progreso;
* éxito;
* selección;
* datos obsoletos cuando corresponda.

No diseñar únicamente el happy path.

\---

# 30\. Design tokens universales

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  --font-ui: Inter, Roboto, "Segoe UI", system-ui, sans-serif;

  --font-xs: 12px;
  --font-sm: 13px;
  --font-md: 14px;
  --font-lg: 16px;
  --font-xl: 20px;
  --font-title: 24px;
}
```

El proyecto puede modificar valores, pero debe mantener coherencia.

\---

# 31\. Tema base conceptual

## Light

```text
Background     neutral very light
Surface        subtle contrast from background
Border         visible but quiet
Text primary   dark neutral
Text secondary medium neutral
Accent         restrained brand/action color
```

## Dark

```text
Background     near-black neutral
Surface        slightly lighter neutral
Border         low-contrast visible neutral
Text primary   soft white
Text secondary muted gray
Accent         restrained, slightly desaturated
```

Evitar colores RGB intensos en superficies grandes.

\---

# 32\. Componentes reutilizables

Crear componentes para comportamiento repetible, no únicamente por encapsular HTML.

Un componente debe tener responsabilidad clara, API clara, estados claros, comportamiento accesible, responsive y estilo consistente.

No crear abstracciones excesivas antes de que exista repetición real.

\---

# 33\. Regla native-first

Antes de añadir JavaScript o una dependencia, comprobar:

1. ¿HTML puede resolverlo?
2. ¿CSS puede resolverlo?
3. ¿Existe una Web API estándar?
4. ¿Existe ya una utilidad interna?

Después considerar una dependencia.

\---

# 34\. Baseline y compatibilidad

Para funcionalidad crítica:

* preferir Web Platform Baseline Widely Available.

Para mejoras:

* se puede usar Baseline Newly Available con fallback cuando resulte necesario.

No introducir APIs experimentales como dependencia esencial sin justificación.

\---

# 35\. Core Web Vitals

Objetivos recomendados:

```text
LCP <= 2.5 s
INP <= 200 ms
CLS <= 0.1
```

La estética nunca debe comprometer significativamente estas métricas.

\---

# 36\. Seguridad visual y funcional

Nunca:

* exponer secretos;
* confiar en validación cliente;
* renderizar HTML no confiable sin tratamiento;
* mostrar información sensible innecesaria;
* ocultar controles de seguridad mediante CSS;
* depender de elementos invisibles para autorización.

\---

# 37\. Reglas específicas para agentes de IA

Todo agente que modifique frontend debe seguir estas reglas.

## Antes de modificar

* leer componentes existentes;
* identificar patrones;
* identificar tokens;
* revisar layout;
* buscar reutilización;
* respetar estilo actual.

## Durante el cambio

* realizar el cambio mínimo coherente;
* no rediseñar áreas no solicitadas;
* no introducir estética propia;
* no añadir gradientes decorativos;
* no añadir glassmorphism;
* no añadir glow;
* no convertir contenido en cards automáticamente;
* no incrementar radios sin motivo;
* no añadir animaciones decorativas;
* no introducir librerías UI sin autorización;
* no cambiar tipografía global salvo petición;
* no convertir una aplicación en una landing page.

\---

# 38\. Preguntas obligatorias del agente al diseñar

Antes de crear UI, el agente debe responder internamente:

1. ¿Cuál es la función principal?
2. ¿Cuál es la información más importante?
3. ¿Qué acciones son realmente primarias?
4. ¿Qué puede eliminarse?
5. ¿La jerarquía se entiende sin color?
6. ¿Necesito realmente una card?
7. ¿Necesito realmente una sombra?
8. ¿Necesito realmente una animación?
9. ¿Necesito realmente JavaScript?
10. ¿Funcionará durante horas de uso?
11. ¿Funcionará en claro y oscuro?
12. ¿Funciona con teclado?
13. ¿Qué ocurre si los datos son largos?
14. ¿Qué ocurre sin datos?
15. ¿Qué ocurre si falla?

\---

# 39\. Definición de “profesional”

En este documento “profesional” significa:

* estable;
* predecible;
* legible;
* discreto;
* coherente;
* eficiente;
* con buena densidad;
* sin ruido decorativo;
* sin apariencia promocional;
* sin tendencia visual dominante;
* adecuado para trabajar durante largos periodos.

No significa aburrido, anticuado o sin personalidad.

La personalidad debe aparecer mediante tipografía, ritmo, acento, iconografía, microdetalles y estructura; no mediante decoración excesiva.

\---

# 40\. Ejemplo de transformación

## Evitar

```text
🌈 Gradient background

      Transform your workflow
   with the power of intelligent AI

┌──────────────┐   ┌──────────────┐
│    12.4K     │   │      87%     │
│   Amazing!   │   │   Growth     │
└──────────────┘   └──────────────┘

        \[ Get Started ✨ ]
```

## Preferir

```text
Projects

12 active      4 pending      86 completed

────────────────────────────────────

Recent activity

Project            Status        Updated
Apollo             Active        10:42
Atlas              Pending       Yesterday
Orion              Completed     27 Sep
```

La segunda interfaz comunica más con menos elementos.

\---

# 41\. Checklist visual

Antes de considerar terminada una pantalla:

* \[ ] No parece una landing page.
* \[ ] No utiliza estética “AI startup” por defecto.
* \[ ] No hay gradients decorativos innecesarios.
* \[ ] No hay glassmorphism.
* \[ ] No hay neomorphism.
* \[ ] No hay glow innecesario.
* \[ ] No hay animaciones ornamentales.
* \[ ] No existen cards innecesarias.
* \[ ] La densidad es adecuada.
* \[ ] La jerarquía se entiende rápidamente.
* \[ ] La tipografía es legible durante uso prolongado.
* \[ ] El color tiene función.
* \[ ] Los radios son moderados.
* \[ ] Las sombras tienen propósito.
* \[ ] Tema claro correcto.
* \[ ] Tema oscuro correcto.
* \[ ] Teclado correcto.
* \[ ] Foco visible.
* \[ ] Responsive correcto.
* \[ ] Estados de error/loading/empty considerados.
* \[ ] La pantalla funciona con contenido largo.
* \[ ] No se añadieron dependencias innecesarias.

\---

# 42\. Política por defecto

Si no hay especificaciones adicionales:

```text
Estética:       profesional / sobria / funcional
Tema:           light + dark
Tipografía:     sans-serif de UI de alta legibilidad
Color:          neutros + un acento moderado
Densidad:       media / media-alta
Radios:         4–8 px
Sombras:        mínimas
Animación:      100–250 ms, solo funcional
Cards:          solo cuando exista entidad o agrupación real
Layout:         estructurado y predecible
Compatibilidad: Baseline Widely Available
Accesibilidad:  obligatoria
Rendimiento:    Core Web Vitals
Dependencias:   native-first
```

\---

# 43\. Relación con el proyecto

Este documento define el comportamiento por defecto.

Un proyecto puede sobrescribirlo mediante:

```text
BRAND\_GUIDELINES.md
PRODUCT\_DESIGN.md
FIGMA
mockups
capturas
tokens propios
```

Las reglas específicas del proyecto tienen prioridad visual sobre esta guía, siempre que no degraden accesibilidad, seguridad o funcionalidad crítica.

\---

# 44\. Ubicación recomendada

En un repositorio donde estas reglas apliquen a todo el frontend:

```text
repo/
├─ AGENTS.md
├─ UNIVERSAL\_WEB\_DESIGN\_GUIDELINES.md
├─ README.md
└─ ...
```

En `AGENTS.md`, añadir una regla explícita:

```md
Antes de crear o modificar cualquier interfaz web, leer y cumplir
`UNIVERSAL\_WEB\_DESIGN\_GUIDELINES.md`.

En ausencia de una especificación visual específica del proyecto,
este documento define el comportamiento visual por defecto.
```

\---

# 45\. Referencias técnicas

* web.dev — https://web.dev/
* Learn Design — https://web.dev/learn/design/
* Learn Accessibility — https://web.dev/learn/accessibility/
* Web Platform Baseline — https://web.dev/baseline
* Core Web Vitals — https://web.dev/articles/vitals

\---

Última revisión base: septiembre de 2026.

