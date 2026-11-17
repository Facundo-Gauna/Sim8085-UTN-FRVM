//! App de escritorio: comandos de Tauri para trabajar con una carpeta elegida por el usuario.
//! Todo acceso a disco pasa por `workspace` (sandbox de rutas); la interfaz solo manda rutas relativas.

pub mod workspace;

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use workspace::Node;

/// Carpeta abierta (None hasta que el usuario elige una).
#[derive(Default)]
pub struct AppState {
    root: Mutex<Option<PathBuf>>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct FolderInfo {
    pub name: String,
}

/// Solo el nombre de la carpeta: la ruta completa no se le muestra a la interfaz.
pub fn folder_name(p: &Path) -> String {
    // Último tramo no vacío, aceptando `/` y `\` (rutas de Windows vistas desde cualquier sistema).
    p.to_string_lossy()
        .rsplit(['/', '\\'])
        .find(|x| !x.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| "Carpeta".to_string())
}

pub fn require_root(root: &Option<PathBuf>) -> Result<&Path, String> {
    root.as_deref().ok_or_else(|| "Primero abrí una carpeta".to_string())
}

/// Nombre por defecto del cuadro "Guardar como": solo un `.pdf` simple, si no `programa.pdf`.
pub fn suggested_pdf_name(name: &str) -> String {
    let ok = !name.is_empty()
        && !name.contains(['/', '\\', ':', '\0'])
        && name != "."
        && !name.starts_with("..")
        && name.to_ascii_lowercase().ends_with(".pdf");
    if ok { name.to_string() } else { "programa.pdf".to_string() }
}

fn with_root<T>(state: &State<AppState>, f: impl FnOnce(&Path) -> Result<T, String>) -> Result<T, String> {
    let guard = state.root.lock().map_err(|_| "Error interno".to_string())?;
    f(require_root(&guard)?)
}

#[tauri::command]
async fn pick_folder(app: AppHandle, state: State<'_, AppState>) -> Result<Option<FolderInfo>, String> {
    // Cancelar el cuadro no cambia nada.
    let Some(picked) = app.dialog().file().blocking_pick_folder() else { return Ok(None) };
    let path = picked.into_path().map_err(|_| "No se pudo abrir la carpeta".to_string())?;
    let canonical = path.canonicalize().map_err(|_| "La carpeta no existe".to_string())?;
    let name = folder_name(&canonical);
    *state.root.lock().map_err(|_| "Error interno".to_string())? = Some(canonical);
    Ok(Some(FolderInfo { name }))
}

#[tauri::command]
fn current_folder(state: State<AppState>) -> Option<FolderInfo> {
    let guard = state.root.lock().ok()?;
    guard.as_deref().map(|p| FolderInfo { name: folder_name(p) })
}

#[tauri::command]
fn list_tree(state: State<AppState>) -> Result<Vec<Node>, String> {
    with_root(&state, workspace::list_tree)
}

#[tauri::command]
fn read_file(state: State<AppState>, path: String) -> Result<String, String> {
    with_root(&state, |r| workspace::read_file(r, &path))
}

#[tauri::command]
fn write_file(state: State<AppState>, path: String, text: String) -> Result<(), String> {
    with_root(&state, |r| workspace::write_file(r, &path, &text))
}

#[tauri::command]
fn create_file(state: State<AppState>, path: String) -> Result<(), String> {
    with_root(&state, |r| workspace::create_file(r, &path))
}

#[tauri::command]
fn rename_path(state: State<AppState>, from: String, to: String) -> Result<(), String> {
    with_root(&state, |r| workspace::rename_path(r, &from, &to))
}

#[tauri::command]
fn delete_file(state: State<AppState>, path: String) -> Result<(), String> {
    with_root(&state, |r| workspace::delete_file(r, &path))
}

/// Guarda un PDF: en la carpeta abierta, o con "Guardar como" si no hay. Devuelve el nombre final
/// (`""` si el usuario canceló el cuadro).
#[tauri::command]
async fn save_binary(app: AppHandle, state: State<'_, AppState>, name: String, bytes: Vec<u8>) -> Result<String, String> {
    let root = state.root.lock().map_err(|_| "Error interno".to_string())?.clone();
    if let Some(root) = root {
        return workspace::save_bytes(&root, &name, &bytes);
    }
    let Some(chosen) = app.dialog().file().add_filter("PDF", &["pdf"]).set_file_name(suggested_pdf_name(&name)).blocking_save_file() else {
        return Ok(String::new());
    };
    let path = chosen.into_path().map_err(|_| "No se pudo guardar el archivo".to_string())?;
    std::fs::write(&path, &bytes).map_err(|e| match e.kind() {
        std::io::ErrorKind::PermissionDenied => "Sin permiso para guardar en esa ubicación".to_string(),
        std::io::ErrorKind::StorageFull => "No hay espacio en el disco".to_string(),
        _ => "No se pudo guardar el archivo".to_string(),
    })?;
    Ok(path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or(name))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            current_folder,
            list_tree,
            read_file,
            write_file,
            create_file,
            rename_path,
            delete_file,
            save_binary
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

    #[test]
    fn folder_name_devuelve_solo_el_ultimo_componente() {
        assert_eq!(folder_name(Path::new("/home/ana/Mis Programas")), "Mis Programas");
        assert_eq!(folder_name(Path::new("C:\\Users\\ana\\asm")), "asm");
        assert_eq!(folder_name(Path::new("/")), "Carpeta");
    }

    #[test]
    fn require_root_pide_abrir_una_carpeta() {
        let none: Option<PathBuf> = None;
        assert_eq!(require_root(&none).unwrap_err(), "Primero abrí una carpeta");
        let some = Some(PathBuf::from("/tmp/x"));
        assert_eq!(require_root(&some).unwrap(), Path::new("/tmp/x"));
    }

    #[test]
    fn nombre_de_pdf_sugerido_se_sanea() {
        assert_eq!(suggested_pdf_name("ej1-assembler.pdf"), "ej1-assembler.pdf");
        assert_eq!(suggested_pdf_name("../../x.pdf"), "programa.pdf");
        assert_eq!(suggested_pdf_name("a/b.pdf"), "programa.pdf");
        assert_eq!(suggested_pdf_name("x.exe"), "programa.pdf");
        assert_eq!(suggested_pdf_name(""), "programa.pdf");
    }
}
