# Plan 6 — App de escritorio (Tauri) y descarga desde la web

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una app de escritorio para Linux y Windows (Tauri 2) que muestra la misma interfaz web y suma el trabajo con una carpeta (árbol de `.asm`, abrir, guardar, guardar como, crear, renombrar, borrar y PDF a la carpeta), y que **se puede descargar desde la web** del simulador.

**Architecture:** `packages/desktop` contiene el proyecto Tauri (`src-tauri`) cuyo front es `packages/web/dist`. Todo el acceso a disco vive en **comandos de Rust** sobre una carpeta elegida por el usuario: la interfaz nunca envía rutas absolutas, solo rutas relativas a esa carpeta, y Rust rechaza `..`, rutas absolutas, enlaces simbólicos que escapen y extensiones no permitidas. En la web, un `WorkspaceService` (interfaz) tiene la implementación de Tauri (`invoke`) y la interfaz se activa solo si existe una carpeta/servicio de escritorio. La descarga web se arma con un script que reúne los instaladores en `packages/web/public/downloads` y genera `manifest.json` (tamaño, SHA-256, versión); la página de instalación lo lee y muestra los botones por sistema.

**Tech Stack:** Tauri 2 (Rust, `tauri-plugin-dialog`), `@tauri-apps/api`, React 18/TypeScript/Zustand (existentes), Vitest. Sin otras dependencias de ejecución.

**Spec:** `docs/superpowers/specs/2026-11-15-simulador-8085-design.md` (§6.12 Escritorio, §8 "capa de archivos", §5 Restricciones: Linux y Windows, §6.8 "Los PDF se exportan a la carpeta"). Requisito adicional del usuario: la app de escritorio **es descargable desde la web**. Código existente: `FileService`, `Session`/`FileTab`, `FileTabs`, `ExportDialog`, página `instalacion` de la documentación (plan 5).

## Global Constraints

- Solo español; terminología del manual; sin telemetría, sin cuentas, sin red en la app de escritorio (CSP sin `connect-src` externos; ninguna llamada de red desde Rust).
- **Seguridad de rutas:** todos los comandos reciben rutas **relativas** con `/` como separador; Rust las resuelve contra la carpeta abierta y rechaza: vacías, absolutas, con `..` o con `\`/unidades (`C:`), con bytes nulos, nombres de más de 255 bytes, enlaces simbólicos cuyo destino real salga de la carpeta, y extensiones distintas de `.asm` (archivos de programa) o `.pdf` (solo en `save_binary`). Lectura máxima 2 MiB.
- Árbol: solo carpetas (que contengan `.asm` en algún nivel) y archivos `.asm`; se omiten nombres que empiezan con `.`; profundidad máxima 6; máximo 2000 entradas; orden: carpetas primero, luego archivos, alfabético sin distinguir mayúsculas.
- Borrar es definitivo (sin papelera): el botón pide confirmación **dentro de la página** (nunca `confirm()`), nombrando el archivo. Renombrar/crear sobre un nombre existente se rechaza con mensaje.
- Los PDF se guardan **en la carpeta abierta** (`save_binary`); sin carpeta abierta se usa el cuadro "Guardar como" del sistema. El nombre se sanea igual que en la web.
- El estado de "modificado" de una pestaña con archivo se calcula contra el texto guardado en disco; tras guardar baja a "sin cambios". Cerrar una pestaña modificada pide confirmación en la página (reutilizar el mecanismo existente).
- Atajos en escritorio: `Ctrl+O` abre carpeta, `Ctrl+S` guarda el archivo activo (si es nuevo, pide nombre: guardar como), `Ctrl+Shift+S` guardar como. En la web no cambian.
- Ventana: mínimo 1024×700, título "Sim8085", sin menú nativo, una sola instancia de ventana.
- Descargas web: `manifest.json` con `{ version, generated, files: [{ os: 'linux'|'windows', kind, label, file, url, size, sha256, version }] }`; la UI muestra tamaño y SHA-256; si falta el manifiesto, está corrupto o falta un sistema, dice "Todavía no hay instalador de <Sistema>" sin romper la página. Los binarios **no** se versionan en git.
- Colores/espaciado solo con tokens de `MASTER.md`; foco visible; todo con teclado; nada depende solo del color.

## Review Focus

1. **Rutas maliciosas o accidentales** (`../secreto.asm`, `/etc/passwd`, `C:\x.asm`, enlace simbólico a otra carpeta, nombre con bytes nulos, extensión `.sh`): ningún comando toca fuera de la carpeta ni extensiones no permitidas; cada rechazo trae mensaje en español. → Task 1.
2. **Cancelar el cuadro de carpeta, o abrir una carpeta vacía/sin permisos:** no cambia nada, no hay error ruidoso; el árbol vacío dice "No hay archivos .asm en esta carpeta". → Task 1, 3, 5.
3. **Guardar falla (disco lleno, permisos, archivo borrado por fuera):** se muestra el error junto al archivo, la pestaña sigue "modificada" y no se pierde el texto. → Task 4.
4. **Renombrar o borrar un archivo que está abierto en una pestaña:** la pestaña sigue al nuevo nombre o se cierra tras confirmar; nunca queda una pestaña apuntando a una ruta inexistente que se guarde en otro lado. → Task 4, 5.
5. **Descarga web con manifiesto faltante, corrupto o parcial** (solo Linux construido): la página muestra el estado de cada sistema, el SHA-256 y no lanza. → Task 7.

---

## Estructura de archivos

```
packages/desktop/package.json                       @sim8085/desktop (scripts tauri, test)            (T2)
packages/desktop/src-tauri/Cargo.toml, build.rs, tauri.conf.json, capabilities/default.json, icons/   (T2)
packages/desktop/src-tauri/src/main.rs, lib.rs      registro de comandos                              (T1, T2)
packages/desktop/src-tauri/src/workspace.rs         sandbox de rutas + operaciones + pruebas Rust     (T1)
packages/desktop/scripts/downloads.mjs, collect-downloads.mjs, downloads.test.mjs                     (T7)
packages/web/src/services/workspace.ts              interfaz WorkspaceService + implementación Tauri  (T3)
packages/web/src/services/desktop.ts                isDesktop, desktopFileService                     (T3)
packages/web/src/state/store.ts                     archivos con ruta: abrir/guardar/crear/renombrar/borrar (T4)
packages/web/src/components/workspace/              FileTree, NameDialog, ConfirmDelete, tests        (T5)
packages/web/src/downloads/                         manifiesto, <Downloads/>                          (T7)
packages/web/src/docs/pages/Instalacion.tsx         usa <Downloads/>                                  (T7)
vercel.json, .github/workflows/desktop.yml, .gitignore                                                 (T7, T8)
```

---

### Task 1: Backend de archivos con sandbox (Rust)

**Files:**
- Create: `packages/desktop/src-tauri/src/workspace.rs`
- Test: pruebas `#[cfg(test)]` dentro de `workspace.rs` (con `tempfile` como dev-dependency)

**Interfaces (Rust, funciones puras sobre `&Path` — sin Tauri, para probarlas con `cargo test`):**
```rust
pub struct Node { pub name: String, pub path: String, pub kind: Kind, pub children: Vec<Node> } // serde: kind "dir"|"file"; children omitido si vacío en archivos
pub fn resolve(root: &Path, rel: &str, ext: Ext) -> Result<PathBuf, String>;   // Ext::Asm | Ext::Pdf | Ext::Any(dir)
pub fn list_tree(root: &Path) -> Result<Vec<Node>, String>;
pub fn read_file(root: &Path, rel: &str) -> Result<String, String>;            // UTF-8 (lossy no: error "El archivo no es texto UTF-8"), máx 2 MiB
pub fn write_file(root: &Path, rel: &str, text: &str) -> Result<(), String>;   // el archivo debe existir salvo create
pub fn create_file(root: &Path, rel: &str) -> Result<(), String>;              // falla si existe; crea carpetas intermedias dentro de root
pub fn rename_path(root: &Path, from: &str, to: &str) -> Result<(), String>;   // falla si `to` existe
pub fn delete_file(root: &Path, rel: &str) -> Result<(), String>;              // solo archivos .asm
pub fn save_bytes(root: &Path, name: &str, bytes: &[u8]) -> Result<String, String>; // solo .pdf, nombre sin carpetas; devuelve el nombre final
```
Mensajes de error exactos (Spanish): `Ruta no permitida`, `Solo se permiten archivos .asm`, `Solo se permiten archivos .pdf`, `El archivo ya existe`, `El archivo no existe`, `El archivo no es texto UTF-8`, `El archivo es demasiado grande (máximo 2 MiB)`, `Nombre demasiado largo`.

- [ ] **Step 1: Write the failing tests** (carpetas temporales): `resolve` acepta `a.asm` y `sub/a.asm`; rechaza (`Ruta no permitida`) `""`, `"/etc/x.asm"`, `"../x.asm"`, `"a/../../x.asm"`, `"C:\\x.asm"`, `"a\\b.asm"`, `"a\0.asm"`, `"./a.asm"`; rechaza `x.sh` con `Solo se permiten archivos .asm`; nombre de 300 caracteres → `Nombre demasiado largo`; **enlace simbólico** `link -> /tmp/otra` y `link/x.asm` → `Ruta no permitida` (solo `#[cfg(unix)]`); `create_file("p/n.asm")` crea la carpeta `p` y el archivo vacío, y repetirlo da `El archivo ya existe`; `write_file` sobre inexistente → `El archivo no existe`, sobre existente reemplaza y `read_file` devuelve lo escrito (con acentos y `←`); archivo de 3 MiB → `El archivo es demasiado grande (máximo 2 MiB)`; archivo con bytes `0xFF` → `El archivo no es texto UTF-8`; `rename_path("a.asm","b.asm")` mueve, y a un destino existente da `El archivo ya existe`; `delete_file` borra y sobre `.txt` da `Solo se permiten archivos .asm`; `list_tree`: carpetas primero y orden sin distinguir mayúsculas, omite `.oculta/`, omite carpetas sin `.asm`, omite `.txt`, respeta profundidad 6 y tope 2000; `save_bytes(root,"ej1-assembler.pdf",..)` escribe y devuelve el nombre, con `"../x.pdf"` o `"x.asm"` se rechaza, y si existe agrega ` (2)`.
- [ ] **Step 2: Run** `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml workspace` — Expected: FAIL (el módulo no existe; el crate se crea en T2, por lo que este paso se ejecuta con `cargo init --lib` mínimo y se reemplaza en T2).
- [ ] **Step 3: Implement** el módulo. `resolve`: validar la cadena, separar en componentes, comprobar la extensión, `canonicalize` del **padre más cercano existente** y comprobar que empieza con `canonicalize(root)`.
- [ ] **Step 4: Run** `cargo test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(desktop): operaciones de archivos con sandbox de rutas`.

---

### Task 2: Proyecto Tauri y comandos

**Files:**
- Create: `packages/desktop/package.json`, `src-tauri/Cargo.toml`, `build.rs`, `tauri.conf.json`, `capabilities/default.json`, `src/main.rs`, `src/lib.rs`, `icons/*` (generados desde un SVG del chip 8085)
- Modify: `package.json` raíz (workspaces ya incluye `packages/*`), `.gitignore` (`packages/desktop/src-tauri/target`, `gen/`)

**Interfaces:**
- Produces comandos Tauri (todos devuelven `Result<_, String>`): `pick_folder() -> Option<FolderInfo>` (abre el cuadro del sistema; `FolderInfo { name }` con solo el nombre de la carpeta; guarda la ruta en un `State<Mutex<Option<PathBuf>>>`), `current_folder() -> Option<FolderInfo>`, `list_tree() -> Vec<Node>`, `read_file(path) -> String`, `write_file(path, text)`, `create_file(path)`, `rename_path(from, to)`, `delete_file(path)`, `save_binary(name, bytes: Vec<u8>) -> String` (con carpeta: `save_bytes`; sin carpeta: cuadro "Guardar como" y escribe donde el usuario elija). Sin carpeta abierta, los demás devuelven `Primero abrí una carpeta`.
- `tauri.conf.json`: `productName` "Sim8085", `identifier` `ar.edu.utn.sim8085`, `frontendDist` `../../web/dist`, `devUrl` `http://localhost:5173`, `beforeDevCommand` `npm run dev -w @sim8085/web`, `beforeBuildCommand` `npm run build -w @sim8085/web`, ventana 1280×800 con `minWidth` 1024 y `minHeight` 700, `app.security.csp` `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ipc: http://ipc.localhost`, bundles `deb`, `appimage`, `rpm` y `nsis`, `capabilities/default.json` solo con `core:default` y `dialog:allow-open|save` si hicieran falta (los diálogos se abren desde Rust: ninguna capacidad de `fs`).
- `package.json`: nombre `@sim8085/desktop`, scripts `dev` (`tauri dev`), `build` (`tauri build`), `test` (`node --test scripts`), devDependency `@tauri-apps/cli` ^2.

- [ ] **Step 1:** Crear el paquete, `Cargo.toml` (`tauri` 2, `tauri-plugin-dialog` 2, `serde`, `serde_json`; dev: `tempfile`) y mover `workspace.rs` ya probado; escribir `lib.rs` con los comandos y el `State`.
- [ ] **Step 2: Write the failing test:** una prueba Rust de integración sobre las funciones envoltorio puras (`fn folder_name(&Path) -> String` devuelve solo el último componente, nunca la ruta completa) y de `require_root(&Option<PathBuf>) -> Result<&Path, String>` con el mensaje `Primero abrí una carpeta`.
- [ ] **Step 3: Run** `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml` — Expected: FAIL luego PASS al implementarlas.
- [ ] **Step 4: Run** `npm run build -w @sim8085/web && cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml` — Expected: compila sin errores ni advertencias.
- [ ] **Step 5: Commit** `feat(desktop): proyecto Tauri con comandos de carpeta de trabajo`.

---

### Task 3: Servicios de la web para escritorio

**Files:**
- Create: `packages/web/src/services/workspace.ts`, `packages/web/src/services/desktop.ts`
- Modify: `packages/web/src/services/fileService.ts` (agregar `workspace?: WorkspaceService` a la interfaz), `packages/web/src/main.tsx`, `packages/web/package.json` (`@tauri-apps/api` ^2)
- Test: `packages/web/src/services/workspace.test.ts`

**Interfaces:**
- Produces:
```ts
export interface TreeNode { name: string; path: string; kind: 'dir' | 'file'; children?: TreeNode[] }
export interface WorkspaceService {
  pickFolder(): Promise<{ name: string } | null>;
  current(): Promise<{ name: string } | null>;
  tree(): Promise<TreeNode[]>;
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
  create(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}
export function createTauriWorkspace(invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>): WorkspaceService;
export function isDesktop(): boolean;                  // '__TAURI_INTERNALS__' in window
export function createDesktopFileService(invoke): FileService;   // saveBinary → 'save_binary'; saveFile/openFiles delegan a la web; canPickFolder true; workspace
export function errorText(e: unknown): string;         // string | {message} | Error → texto; nunca lanza
```
Mapeo de comandos: `pickFolder→pick_folder`, `current→current_folder`, `tree→list_tree`, `read→read_file {path}`, `write→write_file {path,text}`, `create→create_file {path}`, `rename→rename_path {from,to}`, `remove→delete_file {path}`, `saveBinary→save_binary {name, bytes: number[]}`.

- [ ] **Step 1: Write the failing tests** con un `invoke` falso: cada método llama al comando y a los argumentos exactos; `pickFolder` devuelve `null` si Rust devuelve `null`; un `invoke` que rechaza con string `Ruta no permitida` produce un rechazo con ese texto (`errorText`); `errorText(new Error('x'))` → `x`, `errorText({message:'y'})` → `y`, `errorText(42)` → `Error desconocido`; `isDesktop()` es `false` en jsdom y `true` si se define `window.__TAURI_INTERNALS__`; `saveBinary('a.pdf', Uint8Array[1,2], 'application/pdf')` invoca `save_binary` con `bytes: [1,2]`.
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- workspace` — Expected: FAIL.
- [ ] **Step 3: Implement** los servicios; en `main.tsx` elegir `isDesktop() ? createDesktopFileService(invoke) : webFileService` con `invoke` de `@tauri-apps/api/core` importado dinámicamente solo en escritorio.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` y `npm run build -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): servicios de carpeta de trabajo para la app de escritorio`.

---

### Task 4: Archivos con ruta en la sesión

**Files:**
- Modify: `packages/web/src/state/store.ts`, `packages/web/src/components/FileTabs.tsx` (indicador de modificado para archivos con ruta)
- Test: `packages/web/src/state/store.test.ts`

**Interfaces:**
- Consumes: `WorkspaceService` (T3).
- Produces en `FileTab`: `path?: string` (relativa a la carpeta) y `diskText?: string` (último texto leído/guardado); `Session`: `workspace: { name: string; tree: TreeNode[]; error: string } | null`; `fileOpError: string`; acciones (todas `async`, devuelven `boolean` de éxito y nunca lanzan): `openFolder(ws)`, `refreshTree(ws)`, `openWorkspaceFile(ws, path)` (si ya hay una pestaña con esa ruta, la activa), `saveActive(ws, as?: string)` (con ruta: `write`; sin ruta: `create` con `as` y luego `write`, la pestaña toma ruta y nombre), `createFile(ws, path)` (crea vacío y lo abre), `renameFile(ws, from, to)` (actualiza `path`/`name` de las pestañas abiertas), `deleteFile(ws, path)` (cierra la pestaña de ese archivo sin pedir guardado). Helper `isModified(tab): boolean` (con ruta: `text !== diskText`; sin ruta: regla existente de la web).
Reglas: tras cada operación de disco exitosa se refresca el árbol; un error deja `fileOpError` con `errorText(e)` y **no** cambia ni cierra nada; `openFolder` cancelado (`null`) no cambia el estado; cada operación limpia `fileOpError` al empezar.

- [ ] **Step 1: Write the failing tests** con un `WorkspaceService` falso en memoria (mapa ruta→texto): `openFolder` carga nombre y árbol, y con `pickFolder → null` el estado no cambia; `openWorkspaceFile('a.asm')` crea la pestaña con `path`, `name 'a.asm'`, `diskText` igual al texto, no modificada; abrirla dos veces no duplica; editar → `isModified` true; `saveActive` escribe y vuelve a `isModified` false; **fallo de escritura** (`write` rechaza `Disco lleno`) deja `fileOpError 'Disco lleno'`, la pestaña modificada y el texto intacto; guardar una pestaña sin ruta con `as: 'n.asm'` crea el archivo, le asigna ruta y nombre; con un nombre ya existente devuelve false y `El archivo ya existe` y no pisa; `renameFile` actualiza la pestaña abierta (`path` y `name`) y el árbol; renombrar a un existente falla sin cambiar la pestaña; `deleteFile` cierra la pestaña y refresca; borrar un archivo que no estaba abierto no toca las pestañas; un `ws` que lanza síncrono tampoco rompe (`fileOpError` con el mensaje).
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- store` — Expected: FAIL.
- [ ] **Step 3: Implement** estado y acciones.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): archivos de la carpeta de trabajo en la sesión`.

---

### Task 5: Interfaz de la carpeta de trabajo

**Files:**
- Create: `packages/web/src/components/workspace/FileTree.tsx`, `NameDialog.tsx`, `ConfirmDelete.tsx`, `workspace.css`, `workspace.test.tsx`
- Modify: `packages/web/src/components/Toolbar.tsx` (botón "Abrir carpeta", solo con `fileService.workspace`), `packages/web/src/App.tsx` (panel lateral, atajos de escritorio, diálogos), `packages/web/src/lib/useShortcuts.ts` (`Ctrl+Shift+S`)

**Interfaces:**
- Consumes: acciones de T4, `FileService.workspace`.
- Produces: `<FileTree />` (región `aria-label="Archivos"`, árbol `role="tree"` con `treeitem`/`group`, flechas arriba/abajo/izquierda/derecha, Enter abre, F2 renombra, Supr borra, menú con botones "Nuevo archivo", "Actualizar"); `<NameDialog title initial existing onSubmit onClose />` (valida: no vacío, sin `/ \ ..`, agrega `.asm` si falta, rechaza existentes con mensaje junto al campo, foco atrapado, Escape cierra); `<ConfirmDelete name onConfirm onClose />` ("¿Borrar «a.asm»? No se puede deshacer.").
Comportamiento: sin `fileService.workspace` nada de esto se monta (la web queda igual). Con la carpeta abierta, el panel aparece a la izquierda del editor con su nombre como encabezado; árbol vacío → `No hay archivos .asm en esta carpeta`; `fileOpError` se muestra en un `role="alert"` del panel. Atajos: `Ctrl+O` abre carpeta, `Ctrl+S` guarda (si la pestaña es nueva abre `NameDialog` "Guardar como"), `Ctrl+Shift+S` siempre abre "Guardar como".

- [ ] **Step 1: Write the failing tests** (App con un `fileService` falso con `workspace`): el botón "Abrir carpeta" existe solo con `workspace`; tras abrir, el árbol muestra carpetas y archivos con roles correctos, y Enter sobre un archivo lo abre en una pestaña; F2 abre `NameDialog` con el nombre actual y al confirmar renombra (la pestaña cambia de nombre); nombre existente → mensaje junto al campo y no cierra; Supr abre `ConfirmDelete` con el nombre y al confirmar borra y cierra la pestaña, y Escape cancela sin borrar; "Nuevo archivo" pide nombre, agrega `.asm` y abre el archivo; `Ctrl+S` en una pestaña con ruta guarda (verificar `write` llamado) y en una nueva abre "Guardar como"; `Ctrl+Shift+S` abre "Guardar como" siempre; carpeta vacía → mensaje; error de escritura → `role=alert` con el texto y la pestaña sigue modificada; **en la web (sin `workspace`) ni el botón, ni el panel, ni los atajos nuevos existen**.
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- workspace App` — Expected: FAIL.
- [ ] **Step 3: Implement** los componentes con tokens de `MASTER.md` y montarlos.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` y `npm run build -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): panel de archivos de la carpeta de trabajo`.

---

### Task 6: PDF a la carpeta en escritorio

**Files:**
- Modify: `packages/web/src/components/export/ExportDialog.tsx` (texto de confirmación según destino), `packages/web/src/services/desktop.ts`
- Test: `packages/web/src/components/export/export.test.tsx`, `packages/web/src/services/workspace.test.ts`

**Interfaces:** `FileService.saveBinary(name, bytes, mime): Promise<string | void>` — en escritorio devuelve el nombre final (puede llevar ` (2)`); el estado de la barra dice `PDF guardado: <nombre final>` y, si hay carpeta abierta, `PDF guardado en la carpeta: <nombre final>`.

- [ ] **Step 1: Write the failing tests:** con un `saveBinary` falso que devuelve `ej1-assembler (2).pdf`, la barra de estado dice `PDF guardado en la carpeta: ej1-assembler (2).pdf` cuando `session.workspace` existe, y `PDF guardado: ...` si no; si `saveBinary` devuelve `undefined` (web) mantiene el texto actual con el nombre calculado; la cancelación del cuadro "Guardar como" (Rust devuelve `''`) no muestra error ni mensaje de éxito.
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- export workspace` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): los PDF se guardan en la carpeta de trabajo`.

---

### Task 7: Descarga desde la web

**Files:**
- Create: `packages/desktop/scripts/downloads.mjs` (lógica pura), `packages/desktop/scripts/collect-downloads.mjs` (CLI), `packages/desktop/scripts/downloads.test.mjs`, `packages/web/src/downloads/manifest.ts`, `packages/web/src/downloads/Downloads.tsx`, `packages/web/src/downloads/downloads.test.tsx`, `vercel.json`
- Modify: `packages/web/src/docs/pages/Instalacion.tsx`, `packages/web/src/components/Notice.tsx`, `.gitignore` (`packages/web/public/downloads/`)

**Interfaces:**
- Produces (script): `classify(fileName): { os: 'linux'|'windows'; kind: 'appimage'|'deb'|'rpm'|'nsis'|'msi' } | null` (`.AppImage`, `.deb`, `.rpm`, `-setup.exe`, `.msi`; el resto `null`); `buildManifest({ files: {name, size, sha256}[], version, baseUrl, now }): DownloadsManifest`; CLI `node collect-downloads.mjs [--bundles <dir>] [--out <dir>] [--base-url <url>] [--version x.y.z]` que recorre `bundle/` de Tauri, copia los instaladores a `--out` (por defecto `packages/web/public/downloads`), calcula SHA-256 y escribe `manifest.json`; sin instaladores escribe un manifiesto con `files: []` y sale con código 0 avisando por stderr.
- Produces (web): `export interface DownloadEntry { os; kind; label; file; url; size; sha256; version }`, `export interface DownloadsManifest { version; generated; files: DownloadEntry[] }`; `export function parseManifest(json: unknown): DownloadsManifest | null` (valida forma y descarta entradas inválidas o con `url` que no sea relativa o `https:`); `export async function loadManifest(fetchFn?: typeof fetch): Promise<DownloadsManifest | null>` (`fetch(`${BASE_URL}downloads/manifest.json`)`; 404/red/JSON roto → `null`); `<Downloads />`: tarjetas "Linux" y "Windows"; cada instalador con botón `Descargar <label>` (`<a href download>`), tamaño legible (`98 MB`) y `SHA-256` en `<code>`; sistema sin instaladores → `Todavía no hay instalador de Linux` / `de Windows`; manifiesto ausente → ambos mensajes; en la app de escritorio (`isDesktop()`) muestra `Ya estás usando la app de escritorio` en su lugar.
- `Notice` (solo web, sin `workspace`) agrega el enlace `Descargá la app de escritorio` a `#/documentacion/instalacion`.
- `vercel.json`: `{ "buildCommand": "npm run build -w @sim8085/web", "outputDirectory": "packages/web/dist", "installCommand": "npm install", "headers": [{ "source": "/downloads/(.*)", "headers": [{ "key": "Content-Disposition", "value": "attachment" }, { "key": "Cache-Control", "value": "public, max-age=3600" }] }] }`.

- [ ] **Step 1: Write the failing tests:** script — `classify('Sim8085_0.1.0_amd64.AppImage')` → linux/appimage, `'…_x64-setup.exe'` → windows/nsis, `'…_x64_en-US.msi'` → windows/msi, `'Sim8085_0.1.0_amd64.deb'`, `'x.sig'`/`'x.tar.gz'` → `null`; `buildManifest` ordena (Linux primero, luego Windows), arma `url = baseUrl + file`, `label` legible (`Linux · AppImage`, `Windows · instalador`), y es determinista dado `now`; el CLI sobre una carpeta temporal con dos archivos falsos copia ambos, escribe SHA-256 correcto (calculado en el test con `crypto`) y no copia `.sig`; sin instaladores deja `files: []`. Web — `parseManifest` rechaza `null`, `{}`, `files` no arreglo, entradas con `url: 'javascript:alert(1)'` o `http://` y conserva las válidas; `loadManifest` con `fetch` que rechaza, con 404 y con JSON roto devuelve `null`; `<Downloads />` con solo Linux muestra el botón de Linux con tamaño y hash y `Todavía no hay instalador de Windows`; con `null` muestra ambos mensajes; con `window.__TAURI_INTERNALS__` muestra `Ya estás usando la app de escritorio`; `Notice` muestra el enlace en la web; la página `instalacion` incluye `<Downloads />`.
- [ ] **Step 2: Run** `node --test packages/desktop/scripts` y `npm test -w @sim8085/web -- downloads Notice docs` — Expected: FAIL.
- [ ] **Step 3: Implement** script, CLI, tipos, componente, `vercel.json`, `.gitignore`, y actualizar el texto de `Instalacion.tsx` (qué hace cada formato: `AppImage` se marca como ejecutable y se abre; `.deb`/`.rpm` se instalan con el gestor del sistema; en Windows se ejecuta el instalador y, si SmartScreen avisa porque el instalador no está firmado, «Más información → Ejecutar de todos modos»).
- [ ] **Step 4: Run** ambos conjuntos de pruebas y `npm run build -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat: descarga de la app de escritorio desde la web`.

---

### Task 8: Compilación, publicación y cierre

**Files:**
- Create: `.github/workflows/desktop.yml`
- Modify: `docs/superpowers/plans/…` (ledger), `design-system/MASTER.md` si se agregó algún patrón

- [ ] **Step 1:** `npm run build -w @sim8085/desktop` en esta máquina (Linux): debe producir al menos el `.deb`/`AppImage`/`rpm` que las herramientas locales permitan; `node packages/desktop/scripts/collect-downloads.mjs` y comprobar que `packages/web/public/downloads/manifest.json` los lista con SHA-256 verificado con `sha256sum`. Lo que no se pueda construir aquí (Windows) se anota en el ledger como **no verificado**.
- [ ] **Step 2:** Escribir `.github/workflows/desktop.yml` (matriz `ubuntu-22.04` y `windows-latest`; `actions/checkout`, `actions/setup-node`, `dtolnay/rust-toolchain@stable`, instalación de `libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev patchelf` en Linux, `npm ci`, `npm run build -w @sim8085/desktop`, `node packages/desktop/scripts/collect-downloads.mjs --out dist-downloads`, `actions/upload-artifact`). Marcar en el ledger que **no se ejecutó** (el repositorio no tiene remoto).
- [ ] **Step 3:** Con el navegador disponible, abrir la app compilada (o `tauri dev`) y revisar: abrir carpeta, árbol, guardar, renombrar, borrar, PDF a la carpeta; si no hay entorno gráfico o extensión, anotarlo en el ledger.
- [ ] **Step 4:** `cargo test`, `node --test packages/desktop/scripts`, `npm test -w @sim8085/core`, `npm test -w @sim8085/web`, `npx tsc -p packages/web --noEmit` y `npm run build -w @sim8085/web` en verde. Commit `chore(desktop): publicación y revisión`.

---

## Self-review (hecho)

- **Spec §6.12 Escritorio:** abrir una carpeta, árbol de `.asm`, pestañas, guardar/guardar como/crear/renombrar/borrar, PDF a la carpeta (T1–T6). **§8:** el acceso a archivos va detrás de una capa (interfaz `WorkspaceService`/`FileService`; Rust como única implementación de disco) (T1, T3). **§5:** Linux y Windows (T2 bundles, T8 CI). **Requisito del usuario:** descarga desde la web con manifiesto, tamaño y SHA-256, Vercel y sin binarios en git (T7).
- **No cubierto aquí a propósito:** firma de código y actualizaciones automáticas (requieren certificados y un servidor de actualizaciones: fuera del alcance del spec); instalador de macOS (el spec pide solo Linux y Windows).
- **Consistencia de tipos:** `TreeNode`/`WorkspaceService` (T3) los consumen T4 y T5; `FileService.saveBinary` devuelve `Promise<string | void>` (T6) y es compatible con la implementación web de T… del plan 3; los nombres de comandos Rust de T2 son los mismos que usa `createTauriWorkspace` en T3.
- **Proporción:** el plan da firmas, valores y pruebas; los cuerpos los escribe quien implementa.
