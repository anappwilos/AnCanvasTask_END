const fs = require('fs');

const fileES = 'src/i18n/locales/es.json';
const dataES = JSON.parse(fs.readFileSync(fileES, 'utf8'));
Object.assign(dataES.settings, {
  kanbanDesc: "Opciones de visualización de columnas y tarjetas del tablero",
  workspaceDesc: "Organización de paneles laterales y distribución del espacio",
  canvasDesc: "Comportamiento visual del lienzo y alineación interactiva",
  showSidebar: "Mostrar panel lateral de inicio",
  showSidebarDesc: "Mantener la barra de navegación abierta en desktop",
  kanbanDefaultGroupBy: "Agrupación predeterminada",
  kanbanDefaultGroupByDesc: "Cómo se distribuyen las columnas en el tablero",
  kanbanGroupByStatus: "Por Estados (Backlog, Todo, In Progress...)",
  kanbanGroupBySection: "Por Secciones de TASKS.md",
  kanbanShowTags: "Mostrar etiquetas (#tags)",
  kanbanShowTagsDesc: "Mostrar etiquetas en las tarjetas Kanban",
  kanbanShowSubtasks: "Mostrar progreso de subtareas",
  kanbanShowSubtasksDesc: "Indicador de checklist (ej. 2/4) en tarjetas",
  recentFiles: "Archivos Recientes",
  cloudPersistence: "Persistencia Visual en la Nube (Sanity)",
  cloudPersistenceDesc: "Guarda las coordenadas espaciales del canvas",
  reducedMotion: "Reducir animaciones (Reduced Motion)",
  reducedMotionDesc: "Minimiza o desactiva transiciones y efectos de movimiento",
  highContrast: "Modo de alto contraste",
  highContrastDesc: "Refuerza bordes y separadores de la interfaz",
  keyboardShortcuts: "Atajos de Teclado Principales",
  resetDefaultsWarning: "Tus tareas y archivos TASKS.md no se modificarán.",
  resetDefaultsConfirm: "¿Restablecer preferencias?",
  configure: "Configurar"
});
fs.writeFileSync(fileES, JSON.stringify(dataES, null, 2) + '\n');

const fileEN = 'src/i18n/locales/en.json';
const dataEN = JSON.parse(fs.readFileSync(fileEN, 'utf8'));
Object.assign(dataEN.settings, {
  kanbanDesc: "Board column and card visual options",
  workspaceDesc: "Side panel organization and layout",
  canvasDesc: "Canvas visual behavior and snapping",
  showSidebar: "Show sidebar on start",
  showSidebarDesc: "Keep navigation bar open on desktop",
  kanbanDefaultGroupBy: "Default grouping",
  kanbanDefaultGroupByDesc: "How columns are distributed on the board",
  kanbanGroupByStatus: "By Status (Backlog, Todo, In Progress...)",
  kanbanGroupBySection: "By TASKS.md Sections",
  kanbanShowTags: "Show tags (#tags)",
  kanbanShowTagsDesc: "Show tags on Kanban cards",
  kanbanShowSubtasks: "Show subtask progress",
  kanbanShowSubtasksDesc: "Checklist indicator (e.g. 2/4) on cards",
  recentFiles: "Recent Files",
  cloudPersistence: "Cloud Visual Persistence (Sanity)",
  cloudPersistenceDesc: "Saves canvas spatial coordinates",
  reducedMotion: "Reduced Motion",
  reducedMotionDesc: "Minimizes or disables transitions and motion effects",
  highContrast: "High contrast mode",
  highContrastDesc: "Reinforces borders and interface separators",
  keyboardShortcuts: "Main Keyboard Shortcuts",
  resetDefaultsWarning: "Your tasks and TASKS.md files will not be modified.",
  resetDefaultsConfirm: "Reset preferences?",
  configure: "Configure"
});
fs.writeFileSync(fileEN, JSON.stringify(dataEN, null, 2) + '\n');

const fileFR = 'src/i18n/locales/fr.json';
const dataFR = JSON.parse(fs.readFileSync(fileFR, 'utf8'));
Object.assign(dataFR.settings, {
  kanbanDesc: "Options d'affichage des colonnes et des cartes du tableau",
  workspaceDesc: "Organisation des panneaux latéraux et de l'espace",
  canvasDesc: "Comportement visuel du canevas et alignement interactif",
  showSidebar: "Afficher le panneau latéral au démarrage",
  showSidebarDesc: "Garder la barre de navigation ouverte sur bureau",
  kanbanDefaultGroupBy: "Regroupement par défaut",
  kanbanDefaultGroupByDesc: "Comment les colonnes sont réparties sur le tableau",
  kanbanGroupByStatus: "Par Statut (Backlog, Todo, In Progress...)",
  kanbanGroupBySection: "Par Sections de TASKS.md",
  kanbanShowTags: "Afficher les étiquettes (#tags)",
  kanbanShowTagsDesc: "Afficher les étiquettes sur les cartes Kanban",
  kanbanShowSubtasks: "Afficher la progression des sous-tâches",
  kanbanShowSubtasksDesc: "Indicateur de liste de contrôle (ex. 2/4) sur les cartes",
  recentFiles: "Fichiers Récents",
  cloudPersistence: "Persistance Visuelle Cloud (Sanity)",
  cloudPersistenceDesc: "Enregistre les coordonnées spatiales du canevas",
  reducedMotion: "Réduire les animations (Reduced Motion)",
  reducedMotionDesc: "Minimise ou désactive les transitions et les effets de mouvement",
  highContrast: "Mode contraste élevé",
  highContrastDesc: "Renforce les bordures et les séparateurs d'interface",
  keyboardShortcuts: "Raccourcis Clavier Principaux",
  resetDefaultsWarning: "Vos tâches et fichiers TASKS.md ne seront pas modifiés.",
  resetDefaultsConfirm: "Réinitialiser les préférences ?",
  configure: "Configurer"
});
fs.writeFileSync(fileFR, JSON.stringify(dataFR, null, 2) + '\n');

const filePT = 'src/i18n/locales/pt.json';
const dataPT = JSON.parse(fs.readFileSync(filePT, 'utf8'));
Object.assign(dataPT.settings, {
  kanbanDesc: "Opções de visualização de colunas e cartões do quadro",
  workspaceDesc: "Organização dos painéis laterais e distribuição do espaço",
  canvasDesc: "Comportamento visual do canvas e alinhamento interativo",
  showSidebar: "Mostrar painel lateral ao iniciar",
  showSidebarDesc: "Manter a barra de navegação aberta no desktop",
  kanbanDefaultGroupBy: "Agrupamento padrão",
  kanbanDefaultGroupByDesc: "Como as colunas são distribuídas no quadro",
  kanbanGroupByStatus: "Por Status (Backlog, Todo, In Progress...)",
  kanbanGroupBySection: "Por Seções do TASKS.md",
  kanbanShowTags: "Mostrar etiquetas (#tags)",
  kanbanShowTagsDesc: "Mostrar etiquetas nos cartões Kanban",
  kanbanShowSubtasks: "Mostrar progresso de subtarefas",
  kanbanShowSubtasksDesc: "Indicador de checklist (ex: 2/4) nos cartões",
  recentFiles: "Arquivos Recentes",
  cloudPersistence: "Persistência Visual na Nuvem (Sanity)",
  cloudPersistenceDesc: "Salva as coordenadas espaciais do canvas",
  reducedMotion: "Reduzir animações (Reduced Motion)",
  reducedMotionDesc: "Minimiza ou desativa transições e efeitos de movimento",
  highContrast: "Modo de alto contraste",
  highContrastDesc: "Reforça bordas e separadores da interface",
  keyboardShortcuts: "Principais Atalhos de Teclado",
  resetDefaultsWarning: "Suas tarefas e arquivos TASKS.md não serão modificados.",
  resetDefaultsConfirm: "Redefinir preferências?",
  configure: "Configurar"
});
fs.writeFileSync(filePT, JSON.stringify(dataPT, null, 2) + '\n');
