# Sanity Studio para AnTaskCanvas (`studio-test`)

Este directorio contiene el Sanity Studio oficial para el proyecto **`or19faat`** y dataset **`production`**.

## 🚀 Cómo ejecutarlo en tu ordenador local:

### 1. Entrar en la carpeta
```bash
cd studio-test
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar el servidor de desarrollo del Studio
```bash
npm run dev
```

El Studio se abrirá en **http://localhost:3333**.

### 4. Iniciar sesión en el Studio
En el navegador en `http://localhost:3333`, inicia sesión con la misma cuenta de Sanity (Google, GitHub o correo).

---

## 📋 Esquemas incluidos:
- **`task`**: Títulos, estados Kanban (`todo`, `in_progress`, `blocked`, `done`), prioridades (`P0`-`P3`), etiquetas `#`, subtareas checklist y dependencias `blockedBy`.
- **`canvasVisualState`**: Coordenadas espaciales `(x, y, w, h)` del lienzo infinito.
