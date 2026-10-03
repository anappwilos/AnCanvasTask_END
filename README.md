# AnTaskCanvas

Organizador visual e interactivo de archivos `TASKS.md` para desarrolladores. Integra un lienzo infinito (`tldraw`), tablero Kanban por columnas y editor Markdown sincronizado en tiempo real.

---

## Características principales

- **Lienzo infinito & Kanban**: visualización bidireccional de tareas con arrastre, conexiones de dependencias (`blockedBy`), estados y prioridades (`P0`-`P3`).
- **Sincronización Markdown AST**: parseo y serialización determinista con prevención de pérdidas y normalización segura.
- **Workspaces & Git**: gestión de múltiples ramas y documentos `TASKS.md` por directorio (`frontend/`, `backend/`, `packages/ui/`).
- **Integración Sanity Studio**: persistencia bidireccional opcional con esquemas nativos y visor embebido.
- **Internacionalización moderna (i18n)**: arquitectura *compiler-first* basada en LinguiJS con extracción automática, IDs hash autogenerados y catálogos tipados.

---

## Requisitos previos

- Node.js >= 18
- npm >= 9

---

## Instalación y ejecución

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo en http://localhost:3000
npm run dev

# Compilar para producción
npm run build

# Validar tipos TypeScript
npm run lint
```

---

## Arquitectura de Internacionalización (i18n)

El proyecto utiliza un sistema compiler-first con LinguiJS. Los desarrolladores trabajan directamente con texto fuente legible (en español), sin definir claves semánticas manuales (`t("tasks.delete")`) ni editar diccionarios a mano.

### Flujo de trabajo

```text
Texto fuente legible en TSX/TS
  → Extracción automática (npm run i18n:extract)
  → ID determinista autogenerado (hash de 6 caracteres)
  → Catálogos generados (src/locales/{locale}/messages.json)
  → Traducción por locale
  → Compilación optimizada (npm run i18n:compile)
```

### Comandos i18n

| Comando | Descripción |
| :--- | :--- |
| `npm run i18n:extract` | Inspecciona el código fuente, genera IDs deterministas y actualiza los archivos `messages.json`. |
| `npm run i18n:compile` | Compila los catálogos en bundles JS optimizados para producción. |
| `npm run i18n:check` | Validación estricta de compilación (`lingui compile --strict`) apta para CI. |
| `npm run i18n` | Ejecuta extracción y compilación en un solo paso (`extract && compile`). |

### Guía para desarrolladores

#### 1. Texto de interfaz estático

```tsx
import { useLingui } from '@lingui/react';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

function MyComponent() {
  const { _ } = useLingui();

  return (
    <div>
      {/* Opción A: Macro en JSX */}
      <button title={_(msg`Guardar cambios`)}>
        <Trans>Guardar</Trans>
      </button>

      {/* Opción B: Helper directo */}
      <span>{_(msg`Eliminar tarea`)}</span>
    </div>
  );
}
```

#### 2. Variables e interpolación

```tsx
// Variables dentro de la cadena (el orden se adapta a cada idioma)
pushToast(_(msg`Rama "${branchName}" creada con éxito`));
```

#### 3. Pluralización ICU

```tsx
import { plural } from '@lingui/core/macro';

// Pluralización nativa ICU según el locale activo
const label = plural(count, {
  one: '# tarea seleccionada',
  other: '# tareas seleccionadas',
});
```

#### 4. Formatos regionales centralizados

Importar formateadores desde `src/i18n`:

```tsx
import { formatDate, formatTime, formatDateTime, formatTaskCount } from './i18n';

formatDate(date);              // Respeta el locale activo
formatTime(date);              // Respeta el locale activo
formatTaskCount(tasks.length); // "1 tarea" / "5 tareas"
```

### Idiomas configurados

- **Fuente / Fallback**: `es` (Español)
- **Locales iniciales**: `es`, `en` (English)
- **Extensibilidad**: soporte preparado para `fr`, `de`, `pt`, `it` en `src/i18n/index.ts` sin alterar componentes.

---

## Estructura del proyecto

```text
src/
├── components/       # Componentes de UI (Modales, Kanban, SplitEditor, etc.)
├── i18n/             # Inicialización de Lingui y formateadores regionales Intl
├── locales/          # Catálogos de mensajes generados (es, en)
├── services/         # Servicios de sincronización, workspaces y Sanity
├── shapes/           # Definición de formas de lienzo de tldraw (TaskCard, GroupCard)
├── utils/            # Parseo y serialización de Markdown AST (remark/unified)
├── App.tsx           # Contenedor raíz de la aplicación
└── main.tsx          # Punto de entrada y Error Boundary global
```
