# WEB_GUIDELINES.md

> Estándar interno para diseñar, desarrollar y revisar interfaces web modernas.
> Inspirado en las recomendaciones de web.dev, Web Platform Baseline y Core Web Vitals.
>
> Objetivo: construir experiencias web **claras, accesibles, rápidas, seguras, adaptables y compatibles entre navegadores**.

---

## 1. Principios obligatorios

Toda nueva interfaz o modificación debe priorizar, en este orden práctico:

1. **Usabilidad** — la función debe entenderse y poder utilizarse sin fricción innecesaria.
2. **Accesibilidad** — la funcionalidad debe estar disponible mediante teclado y tecnologías de asistencia cuando corresponda.
3. **Rendimiento** — evitar trabajo, recursos y JavaScript innecesarios.
4. **Responsive design** — la interfaz debe adaptarse al espacio disponible, no a una lista rígida de dispositivos.
5. **Compatibilidad** — preferir capacidades interoperables de la plataforma web.
6. **Resiliencia** — contemplar carga, vacío, error, offline/degradación y datos inesperados.
7. **Seguridad y privacidad** — no confiar en el cliente y no exponer información sensible.
8. **Consistencia** — reutilizar patrones, tokens y componentes existentes antes de crear otros nuevos.

Una interfaz visualmente atractiva que falle en accesibilidad, rendimiento o interacción se considera incompleta.

---

## 2. HTML: semántica primero

Preferir elementos HTML nativos antes que recrear comportamiento mediante `div`, JavaScript o ARIA.

### Reglas

- Usar landmarks y estructura semántica: `header`, `nav`, `main`, `aside`, `footer`.
- Mantener una jerarquía lógica de encabezados.
- Para acciones usar `button`.
- Para navegación usar `a` con destino real.
- Asociar cada campo de formulario con su `label`.
- Usar tipos de `input` adecuados.
- Usar `fieldset` y `legend` cuando agrupen controles relacionados.
- Las tablas se reservan para datos tabulares.
- No crear botones o enlaces únicamente con `div` + `onclick`.
- No usar ARIA para sustituir un elemento HTML nativo que ya resuelva el caso.

### Regla para agentes

Antes de introducir ARIA, comprobar si existe una solución semántica nativa equivalente.

---

## 3. Accesibilidad

La accesibilidad forma parte de la definición de terminado, no es una mejora opcional posterior.

### Teclado

Toda acción interactiva debe poder realizarse sin ratón cuando sea razonable para el tipo de interfaz.

- Orden de tabulación lógico.
- Foco visible.
- No crear trampas de foco.
- Modales y overlays deben gestionar correctamente entrada y salida de foco.
- No depender exclusivamente de hover.
- Los componentes personalizados deben reproducir la interacción de teclado esperada para su patrón.

### Contenido visual

- Mantener contraste suficiente entre texto, iconos funcionales y fondo.
- No comunicar información únicamente mediante color.
- Las imágenes informativas necesitan alternativa textual adecuada.
- Las imágenes decorativas no deben añadir ruido a tecnologías de asistencia.
- Respetar preferencias del usuario cuando corresponda, por ejemplo `prefers-reduced-motion`.

### Formularios

- Labels visibles y comprensibles.
- Errores concretos: explicar qué ha ocurrido y cómo corregirlo.
- No depender únicamente de placeholder como etiqueta.
- Mantener los datos introducidos cuando un error sea recuperable.
- Asociar programáticamente mensajes de ayuda/error cuando sea necesario.

### Testing mínimo

Combinar:
- comprobaciones automáticas;
- navegación manual por teclado;
- inspección de foco;
- revisión básica con tecnología de asistencia cuando el componente sea crítico.

---

## 4. Responsive design

Diseñar para el **espacio disponible**.

### Reglas

- El layout debe ser fluido.
- Evitar anchos fijos innecesarios.
- Usar Flexbox y Grid para layout.
- Usar media queries cuando el diseño realmente necesite cambiar.
- Considerar container queries cuando un componente deba responder al tamaño de su contenedor.
- No asumir que móvil = touch ni escritorio = ratón.
- Controles táctiles deben disponer de espacio suficiente para interactuar con comodidad.
- Evitar overflow horizontal accidental.
- Contenido esencial no debe desaparecer simplemente por reducirse la pantalla.

### Breakpoints

No crear breakpoints basándose exclusivamente en modelos concretos de teléfono, tablet o monitor.

Crear un breakpoint cuando **el contenido o el componente deja de funcionar correctamente en el espacio disponible**.

---

## 5. CSS

Preferir capacidades nativas de CSS antes que JavaScript para cuestiones puramente visuales o de layout.

### Preferir

- Flexbox.
- Grid.
- `min()`, `max()` y `clamp()`.
- propiedades lógicas cuando faciliten internacionalización.
- custom properties para design tokens.
- container queries cuando aporten independencia al componente.
- media queries para preferencias del usuario.
- CSS moderno compatible con el objetivo Baseline definido por el proyecto.

### Evitar

- JavaScript para calcular layouts que CSS puede resolver.
- números mágicos repetidos.
- `!important` como mecanismo habitual.
- selectores excesivamente acoplados al DOM.
- animaciones que bloqueen interacción.
- transiciones globales indiscriminadas como `transition: all`.
- alturas rígidas para contenido dinámico salvo necesidad explícita.

---

## 6. Design tokens

Los valores visuales repetidos deben centralizarse.

Ejemplo:

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;

  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-size-lg: 1.25rem;
}
```

Centralizar, cuando sea aplicable:

- color;
- tipografía;
- spacing;
- radios;
- sombras;
- tamaños;
- motion;
- z-index/layers.

No duplicar valores arbitrarios si ya existe un token apropiado.

---

## 7. Componentes

Antes de crear un componente nuevo:

1. buscar uno existente;
2. comprobar si puede extenderse sin romper su responsabilidad;
3. comprobar si HTML/CSS nativo resuelve el problema;
4. solo entonces crear uno nuevo.

### Un buen componente debe

- tener una responsabilidad clara;
- funcionar en diferentes tamaños de contenedor;
- exponer estados explícitos;
- ser navegable correctamente;
- conservar semántica;
- evitar dependencias implícitas del contexto exterior;
- permitir composición cuando sea razonable.

### Estados mínimos

Según el componente, considerar explícitamente:

- default;
- hover;
- focus;
- active/pressed;
- disabled;
- loading;
- selected;
- empty;
- error;
- success.

No introducir estados visuales sin definir qué significan funcionalmente.

---

## 8. UX y feedback

Toda acción debe ofrecer una respuesta perceptible.

### Acciones rápidas

Mostrar cambios inmediatamente cuando no exista motivo para esperar.

### Acciones asíncronas

Indicar que están en curso y evitar activaciones repetidas accidentales.

### Operaciones destructivas

- Diferenciarlas claramente.
- Confirmar cuando la consecuencia sea difícil o imposible de revertir.
- Preferir undo cuando resulte viable y más usable que una confirmación previa.

### Errores

Un mensaje de error debe indicar:

1. qué ha fallado;
2. qué impacto tiene;
3. qué puede hacer el usuario a continuación.

Evitar mensajes genéricos como `Something went wrong` cuando exista información accionable.

---

## 9. Rendimiento

El rendimiento es parte de UX.

### Core Web Vitals

Objetivos recomendados para el percentil 75 de las visitas:

| Métrica | Objetivo |
|---|---:|
| LCP | ≤ 2.5 s |
| INP | ≤ 200 ms |
| CLS | ≤ 0.1 |

### Reglas

- Enviar el mínimo JavaScript necesario.
- Dividir código cuando produzca una mejora real.
- Lazy-load de contenido no crítico cuando corresponda.
- No aplicar lazy-load al recurso visual principal si perjudica LCP.
- Definir dimensiones/aspect ratio de medios para reducir layout shifts.
- Optimizar imágenes y seleccionar formatos adecuados.
- Evitar tareas largas en el main thread.
- Evitar renders y recalculados innecesarios.
- Virtualizar listas realmente grandes cuando sea necesario.
- No cargar librerías grandes para resolver problemas triviales.
- Cachear recursos de manera apropiada.
- Medir rendimiento real; no asumirlo.

### Medición

Usar una combinación de:

- datos de usuarios reales cuando estén disponibles;
- Chrome DevTools;
- Lighthouse;
- PageSpeed Insights;
- instrumentación propia para regresiones importantes.

Las métricas de laboratorio no sustituyen completamente los datos de campo.

---

## 10. Compatibilidad y Baseline

Antes de introducir una característica moderna de HTML, CSS o Web APIs, comprobar su estado de interoperabilidad.

### Política por defecto

Preferir **Baseline Widely available** para funcionalidad crítica.

Puede utilizarse **Baseline Newly available** cuando:

- la compatibilidad objetivo del proyecto lo permita;
- se haya comprobado explícitamente;
- exista fallback o progressive enhancement cuando sea necesario.

Una característica con disponibilidad limitada no debe convertirse silenciosamente en requisito crítico.

### Navegadores principales considerados por Baseline

- Chrome desktop y Android;
- Edge;
- Firefox desktop y Android;
- Safari macOS e iOS.

### Progressive enhancement

La funcionalidad base debe funcionar con la plataforma más ampliamente compatible razonable.

Las capacidades nuevas deben mejorar la experiencia sin romper innecesariamente la funcionalidad básica.

---

## 11. JavaScript

JavaScript debe aportar comportamiento, no sustituir capacidades declarativas disponibles en HTML/CSS sin una razón clara.

### Reglas

- Evitar trabajo innecesario durante startup.
- No bloquear el main thread con tareas largas.
- Dividir trabajo costoso cuando sea posible.
- Limpiar listeners, observers, timers y recursos cuando dejan de ser necesarios.
- Evitar dependencias globales implícitas.
- Mantener estados predecibles.
- Cancelar operaciones obsoletas cuando una acción posterior las sustituya.
- Gestionar errores de operaciones asíncronas.
- Evitar race conditions en navegación, búsquedas y peticiones.
- No duplicar en cliente lógica de seguridad que debe imponerse también en servidor.

---

## 12. Imágenes y multimedia

- Reservar espacio antes de cargar el recurso.
- Usar imágenes responsive cuando proceda.
- No descargar una imagen enorme para representarla diminuta.
- Lazy-load únicamente contenido no crítico.
- Comprimir recursos.
- Incluir alternativas accesibles.
- Vídeo/audio relevante debe contemplar alternativas como subtítulos/transcripción según el caso.
- Evitar autoplay molesto o inesperado.

---

## 13. Tipografía y contenido

- Priorizar legibilidad.
- Evitar bloques excesivamente anchos.
- Mantener jerarquía visual coherente.
- No usar tamaños de texto diminutos para esconder información secundaria.
- Las etiquetas deben describir acciones, no solamente iconos ambiguos.
- Mensajes, botones y estados deben utilizar terminología consistente.
- Evitar texto que dependa de la posición visual: “pulsa el botón de la derecha”.

---

## 14. Internacionalización

Aunque un proyecto empiece con un solo idioma, evitar decisiones que bloqueen futuras traducciones.

- No concatenar frases traducibles manualmente.
- Permitir expansión del texto.
- Evitar layouts dependientes de longitudes exactas.
- Preferir propiedades CSS lógicas cuando tengan sentido.
- Formatear fechas, números y monedas mediante APIs/locales adecuados.
- No asumir dirección de escritura cuando el producto pueda internacionalizarse.

---

## 15. Seguridad

El navegador es un entorno no confiable.

### Obligatorio

- HTTPS en producción.
- Validación y autorización en servidor.
- Escapar/sanitizar contenido según contexto.
- Evitar secretos en bundles frontend.
- No incluir claves privadas, tokens permanentes ni credenciales en el cliente.
- Reducir dependencias innecesarias.
- Mantener dependencias actualizadas.
- Aplicar políticas de seguridad como CSP cuando sean apropiadas.
- Revisar cualquier uso de HTML dinámico.
- Minimizar datos personales enviados o almacenados.

Nunca considerar una comprobación del frontend una barrera de seguridad.

---

## 16. Privacidad

Recolectar únicamente los datos necesarios para la función definida.

- No añadir analytics o tracking por defecto sin propósito.
- No registrar datos sensibles accidentalmente.
- Evitar enviar contenido privado a terceros sin necesidad y autorización.
- Establecer periodos de conservación cuando se almacenen datos personales.
- Hacer que los estados de consentimiento sean comprensibles cuando apliquen.

---

## 17. Dependencias

Antes de añadir una dependencia frontend:

1. comprobar si la plataforma web ya ofrece la capacidad;
2. valorar tamaño y coste de runtime;
3. comprobar mantenimiento;
4. revisar seguridad;
5. comprobar compatibilidad;
6. justificar por qué aporta valor superior a una implementación razonable nativa.

No añadir una librería completa para una única utilidad trivial.

---

## 18. Estados de aplicación obligatorios

Para pantallas que dependen de datos remotos o procesos asíncronos, revisar explícitamente:

- carga inicial;
- carga incremental;
- sin resultados;
- error recuperable;
- error no recuperable;
- conexión lenta;
- pérdida de conexión cuando sea relevante;
- datos parciales;
- permisos insuficientes;
- sesión expirada cuando aplique.

No diseñar únicamente el happy path.

---

## 19. Testing

Una modificación frontend relevante debe comprobar, según riesgo:

### Funcional
- camino principal;
- errores;
- estados vacíos;
- acciones repetidas;
- cancelación/navegación durante operaciones.

### Responsive
- viewport estrecho;
- intermedio;
- ancho;
- zoom/text scaling cuando sea relevante.

### Accesibilidad
- teclado;
- foco;
- semántica;
- contraste;
- nombre accesible de controles.

### Compatibilidad
- navegadores objetivo cuando se use una capacidad no trivial o reciente.

### Rendimiento
- regresiones importantes de bundle;
- LCP/CLS;
- tareas largas;
- listas/datasets grandes cuando formen parte del producto.

---

## 20. Criterio de terminado para UI

Una tarea de frontend no se considera terminada hasta verificar razonablemente:

- [ ] La función principal funciona.
- [ ] El diseño responde correctamente al espacio disponible.
- [ ] No existe overflow accidental.
- [ ] Es usable mediante teclado cuando aplica.
- [ ] El foco es visible.
- [ ] Los controles tienen nombre/label comprensible.
- [ ] Existen estados de loading/error/empty cuando son necesarios.
- [ ] No se introducen layout shifts evitables.
- [ ] No se añade JavaScript innecesario.
- [ ] Las nuevas APIs web cumplen la política Baseline del proyecto.
- [ ] No se exponen secretos ni datos sensibles.
- [ ] No se ha introducido una dependencia evitable.
- [ ] La solución reutiliza patrones existentes cuando es posible.
- [ ] Se han revisado las regresiones relevantes.

---

# Reglas específicas para agentes de IA / Codex

Estas reglas son instrucciones operativas para cualquier agente que modifique frontend.

## A. Antes de editar

1. Inspeccionar la arquitectura y componentes existentes.
2. Identificar estilos, tokens y convenciones ya utilizados.
3. Buscar componentes reutilizables.
4. Mantener la tecnología y patrones del proyecto salvo que el cambio requiera lo contrario.
5. No introducir un nuevo framework, librería de componentes o design system sin petición explícita.

## B. Durante la implementación

- Realizar el cambio mínimo coherente.
- Preservar comportamiento existente no relacionado.
- Preferir HTML/CSS nativo.
- Mantener accesibilidad.
- Mantener responsive design.
- Evitar hacks específicos para una resolución concreta.
- No esconder problemas mediante delays arbitrarios.
- No añadir dependencias sin necesidad demostrable.
- No cambiar estilos globales si el cambio puede aislarse.
- No duplicar componentes existentes.

## C. Al crear componentes

El agente debe comprobar:

1. ¿Existe HTML nativo para esto?
2. ¿Existe un componente interno equivalente?
3. ¿Puede resolverse con CSS en vez de JS?
4. ¿Funciona con teclado?
5. ¿Qué ocurre con texto largo?
6. ¿Qué ocurre en un viewport estrecho?
7. ¿Qué ocurre mientras carga?
8. ¿Qué ocurre si falla?
9. ¿Qué ocurre sin datos?
10. ¿La tecnología utilizada cumple el objetivo Baseline?

## D. Prohibido salvo justificación explícita

- `div` clickable sustituyendo a `button`.
- índices `z-index` arbitrariamente enormes.
- `!important` para luchar contra estilos sin investigar la causa.
- timeouts usados como sincronización.
- user-agent sniffing cuando feature detection sea viable.
- CSS específico de un dispositivo concreto.
- esconder errores de red.
- eliminar focus outlines sin reemplazo accesible.
- renderizar listas masivas sin considerar coste.
- instalar dependencias únicamente por comodidad.
- utilizar APIs web de disponibilidad limitada sin evaluar compatibilidad.

## E. Prioridad ante conflictos

Si una decisión visual entra en conflicto con accesibilidad, seguridad o una funcionalidad esencial, preservar primero la funcionalidad y resolver el diseño sin degradarlas.

---

# Política recomendada para este repositorio

Salvo que el proyecto defina otra cosa:

- **Compatibilidad crítica:** Baseline Widely available.
- **Mejoras progresivas:** Baseline Newly available aceptable con revisión.
- **Disponibilidad limitada:** requiere justificación/fallback.
- **Rendimiento:** objetivos Core Web Vitals oficiales.
- **Accesibilidad:** HTML semántico + navegación por teclado + pruebas automáticas y manuales según riesgo.
- **Layout:** responsive por contenido, no por modelo de dispositivo.
- **Dependencias:** native-first.
- **Arquitectura UI:** reutilización antes que duplicación.

---

# Referencias

Documentación principal utilizada para mantener estas reglas:

- web.dev — Responsive Design  
  https://web.dev/learn/design/

- web.dev — Learn Accessibility  
  https://web.dev/learn/accessibility/

- web.dev — Web Platform Baseline  
  https://web.dev/baseline

- web.dev — Baseline 2026  
  https://web.dev/baseline/2026

- web.dev — Web Vitals  
  https://web.dev/articles/vitals

---

## Mantenimiento

Este documento debe revisarse cuando cambien:

- el conjunto de Core Web Vitals;
- la política de compatibilidad del proyecto;
- el objetivo Baseline;
- los navegadores soportados;
- la arquitectura frontend;
- las reglas internas de accesibilidad, seguridad o privacidad.

Última revisión base: **septiembre de 2026**.
