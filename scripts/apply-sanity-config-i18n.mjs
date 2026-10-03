import fs from 'fs';
import path from 'path';

const file = path.resolve('src/components/SanityConfigModal.tsx');
let content = fs.readFileSync(file, 'utf-8');

const replacements = [
  // Toasts and error messages
  ["message: 'Error inesperado durante la verificación'", "message: i18n._(msg`Error inesperado durante la verificación`)"],
  ["onShowToast('Error al verificar conexión con Sanity', 'error');", "onShowToast(i18n._(msg`Error al verificar conexión con Sanity`), 'error');"],
  ["onShowToast('Configura primero el Project ID y Dataset', 'warning');", "onShowToast(i18n._(msg`Configura primero el Project ID y Dataset`), 'warning');"],
  ["onShowToast('Se requiere un API Token con permisos de Editor para escribir datos', 'warning');", "onShowToast(i18n._(msg`Se requiere un API Token con permisos de Editor para escribir datos`), 'warning');"],
  ["onShowToast(`Tarea de prueba escrita con éxito en ${res.dataset}`, 'success');", "onShowToast(i18n._(msg`Tarea de prueba escrita con éxito en ${res.dataset}`), 'success');"],
  ["message: 'Error al ejecutar prueba de escritura'", "message: i18n._(msg`Error al ejecutar prueba de escritura`)"],
  ["onShowToast('Fallo al escribir en Sanity', 'error');", "onShowToast(i18n._(msg`Fallo al escribir en Sanity`), 'error');"],
  ["onShowToast('Error al eliminar documento de prueba', 'error');", "onShowToast(i18n._(msg`Error al eliminar documento de prueba`), 'error');"],
  ["onShowToast('Configuración de Sanity guardada y aplicada', 'success');", "onShowToast(i18n._(msg`Configuración de Sanity guardada y aplicada`), 'success');"],
  ["onShowToast('Conexión con Sanity eliminada. Operando en modo local.', 'info');", "onShowToast(i18n._(msg`Conexión con Sanity eliminada. Operando en modo local.`), 'info');"],
  ["onShowToast('Origen copiado al portapapeles', 'info');", "onShowToast(i18n._(msg`Origen copiado al portapapeles`), 'info');"],
  ["onShowToast('Código de Schema copiado al portapapeles', 'info');", "onShowToast(i18n._(msg`Código de Schema copiado al portapapeles`), 'info');"],
  ["onShowToast('Se requiere API Token con rol Editor para guardar en Sanity', 'warning');", "onShowToast(i18n._(msg`Se requiere API Token con rol Editor para guardar en Sanity`), 'warning');"],

  // Header & Navigation
  ['Integración & Persistencia Sanity', '{i18n._(msg`Integración & Persistencia Sanity`)}'],
  ["aria-label=\"Cerrar modal\"", 'aria-label={i18n._(msg`Cerrar modal`)}'],
  ["{ id: 'config' as ModalTab, label: 'Configuración & Conexión', icon: 'settings' }", "{ id: 'config' as ModalTab, label: i18n._(msg`Configuración & Conexión`), icon: 'settings' }"],
  ["{ id: 'write-test' as ModalTab, label: 'Verificar Escritura en Vivo', icon: 'edit_note' }", "{ id: 'write-test' as ModalTab, label: i18n._(msg`Verificar Escritura en Vivo`), icon: 'edit_note' }"],
  ["{ id: 'schemas' as ModalTab, label: 'Esquemas (Schemas)', icon: 'schema' }", "{ id: 'schemas' as ModalTab, label: i18n._(msg`Esquemas (Schemas)`), icon: 'schema' }"],

  // Tab 1: Config
  ['<strong className="text-[var(--on-surface)] font-medium">Single Source of Truth: </strong>', '<strong className="text-[var(--on-surface)] font-medium">{i18n._(msg`Single Source of Truth:`)} </strong>'],
  ['Tu archivo <code className="font-mono text-sky-300">TASKS.md</code> define el contenido y dependencias. Sanity almacena la posición espacial <code className="font-mono text-slate-300">(x, y, w, h)</code> y documentos de tareas.', '{i18n._(msg`Tu archivo`)} <code className="font-mono text-sky-300">TASKS.md</code> {i18n._(msg`define el contenido y dependencias. Sanity almacena la posición espacial`)} <code className="font-mono text-slate-300">(x, y, w, h)</code> {i18n._(msg`y documentos de tareas.`)}'],
  ['<span>Project ID <span className="text-rose-400">*</span></span>', '<span>{i18n._(msg`Project ID`)} <span className="text-rose-400">*</span></span>'],
  ['placeholder="ej. a1b2c3d4"', 'placeholder={i18n._(msg`ej. a1b2c3d4`)}'],
  ['<span>Dataset <span className="text-rose-400">*</span></span>', '<span>{i18n._(msg`Dataset`)} <span className="text-rose-400">*</span></span>'],
  ['<span>API Token <span className="text-[10px] text-[var(--on-surface-variant)] font-normal">(Requerido para escribir en producción)</span></span>', '<span>{i18n._(msg`API Token`)} <span className="text-[10px] text-[var(--on-surface-variant)] font-normal">{i18n._(msg`(Requerido para escribir en producción)`)}</span></span>'],
  ["<span>{showToken ? 'Ocultar' : 'Mostrar'}</span>", '<span>{showToken ? i18n._(msg`Ocultar`) : i18n._(msg`Mostrar`)}</span>'],
  ['Crea un token con rol <code className="font-mono text-slate-300">Editor</code> en <span className="font-mono">manage.sanity.io &gt; API &gt; Tokens</span>.', '{i18n._(msg`Crea un token con rol`)} <code className="font-mono text-slate-300">Editor</code> {i18n._(msg`en`)} <span className="font-mono">manage.sanity.io &gt; API &gt; Tokens</span>.'],
  ['<span className="font-medium text-[var(--on-surface)] text-xs">Comprobación de conectividad</span>', '<span className="font-medium text-[var(--on-surface)] text-xs">{i18n._(msg`Comprobación de conectividad`)}</span>'],
  ['<span>Verificando...</span>', '<span>{i18n._(msg`Verificando...`)}</span>'],
  ['<span>Probar conexión</span>', '<span>{i18n._(msg`Probar conexión`)}</span>'],
  ['<span className="text-slate-300 truncate">Origen CORS de la app:</span>', '<span className="text-slate-300 truncate">{i18n._(msg`Origen CORS de la app:`)}</span>'],
  ['title="Copiar origen para añadir a Sanity CORS"', 'title={i18n._(msg`Copiar origen para añadir a Sanity CORS`)}'],
  ["<span>{copiedOrigin ? '¡Copiado!' : 'Copiar URL de Origen'}</span>", '<span>{copiedOrigin ? i18n._(msg`¡Copiado!`) : i18n._(msg`Copiar URL de Origen`)}</span>'],

  // Tab 2: Write test
  ['Prueba de Escritura en Sanity Dataset ({dataset})', '{i18n._(msg`Prueba de Escritura en Sanity Dataset (${dataset})`)}'],
  ['Esta acción enviará una mutación real de tipo <strong className="text-[var(--on-surface)]">task</strong> a tu dataset de Sanity y comprobará inmediatamente la lectura del documento creado (Read-After-Write).', '{i18n._(msg`Esta acción enviará una mutación real de tipo`)} <strong className="text-[var(--on-surface)]">task</strong> {i18n._(msg`a tu dataset de Sanity y comprobará inmediatamente la lectura del documento creado (Read-After-Write).`)}'],
  ['<span>Escribiendo en {dataset}...</span>', '<span>{i18n._(msg`Escribiendo en ${dataset}...`)}</span>'],
  ['<span>Crear y verificar primer Task en "{dataset}"</span>', '<span>{i18n._(msg`Crear y verificar primer Task en "${dataset}"`)}</span>'],
  ['<span>Actualizar lista</span>', '<span>{i18n._(msg`Actualizar lista`)}</span>'],
  ['<span>Sincronización Automática Bidireccional</span>', '<span>{i18n._(msg`Sincronización Automática Bidireccional`)}</span>'],
  ['Auto-Sync Activo', '{i18n._(msg`Auto-Sync Activo`)}'],
  ['Todas las tareas que crees, edites, marques como completadas o muevas en el canvas/kanban se sincronizan automáticamente en tu dataset <strong className="text-sky-300 font-mono">"{dataset}"</strong> de Sanity con <code className="font-mono text-sky-200">_type: \'task\'</code>.', '{i18n._(msg`Todas las tareas que crees, edites, marques como completadas o muevas en el canvas/kanban se sincronizan automáticamente en tu dataset`)} <strong className="text-sky-300 font-mono">"{dataset}"</strong> {i18n._(msg`de Sanity con`)} <code className="font-mono text-sky-200">_type: \'task\'</code>.'],
  ['<span>Sincronizando todas las tareas a Sanity...</span>', '<span>{i18n._(msg`Sincronizando todas las tareas a Sanity...`)}</span>'],
  ['<span>Sincronizar todas las tareas actuales a Sanity ahora</span>', '<span>{i18n._(msg`Sincronizar todas las tareas actuales a Sanity ahora`)}</span>'],
  ['<span>Payload persistido en Sanity:</span>', '<span>{i18n._(msg`Payload persistido en Sanity:`)}</span>'],
  ["<span>{isDeletingTestDoc ? 'Eliminando...' : 'Eliminar documento de prueba'}</span>", '<span>{isDeletingTestDoc ? i18n._(msg`Eliminando...`) : i18n._(msg`Eliminar documento de prueba`)}</span>'],
  ['Documentos existentes en Sanity ({remoteDocs.length})', '{i18n._(msg`Documentos existentes en Sanity (${remoteDocs.length})`)}'],
  ["{isLoadingDocs ? 'Cargando documentos de Sanity...' : 'No se han listado documentos aún. Pulsa \"Actualizar lista\" o crea el primer task.'}", "{isLoadingDocs ? i18n._(msg`Cargando documentos de Sanity...`) : i18n._(msg`No se han listado documentos aún. Pulsa \"Actualizar lista\" o crea el primer task.`)}"],
  ['_id: {doc._id} · tipo: {doc._type}', '_id: {doc._id} · {i18n._(msg`tipo:`)} {doc._type}'],

  // Tab 3: Schemas
  ['Archivos de esquema listos para incluir en tu proyecto de <strong className="text-[var(--on-surface)]">Sanity Studio</strong> (<code className="font-mono text-sky-300">src/sanity/schemas/</code>).', '{i18n._(msg`Archivos de esquema listos para incluir en tu proyecto de`)} <strong className="text-[var(--on-surface)]">Sanity Studio</strong> (<code className="font-mono text-sky-300">src/sanity/schemas/</code>).'],
  ["{ id: 'task' as const, label: 'task.ts (Documento de Tarea)' }", "{ id: 'task' as const, label: i18n._(msg`task.ts (Documento de Tarea)`) }"],
  ["{ id: 'canvasVisualState' as const, label: 'canvasVisualState.ts (Canvas)' }", "{ id: 'canvasVisualState' as const, label: i18n._(msg`canvasVisualState.ts (Canvas)`) }"],
  ["<span>{copiedSchema ? '¡Copiado!' : 'Copiar código'}</span>", '<span>{copiedSchema ? i18n._(msg`¡Copiado!`) : i18n._(msg`Copiar código`)}</span>'],

  // Modal Footer
  ['Desconectar\n              </button>', '{i18n._(msg`Desconectar`)}\n              </button>'],
  ['Cerrar\n            </button>', '{i18n._(msg`Cerrar`)}\n            </button>'],
  ['Guardar y sincronizar\n            </button>', '{i18n._(msg`Guardar y sincronizar`)}\n            </button>'],
];

let replacedCount = 0;
for (const [target, repl] of replacements) {
  if (content.includes(target)) {
    content = content.replace(target, repl);
    replacedCount++;
  } else {
    console.warn(`Target not found: ${target.slice(0, 40)}...`);
  }
}

fs.writeFileSync(file, content, 'utf-8');
console.log(`Replaced ${replacedCount} / ${replacements.length} items in ${file}`);
