//! Operaciones de archivos sobre la carpeta de trabajo, con sandbox de rutas.
//!
//! La interfaz nunca manda rutas absolutas: todo es relativo a la carpeta abierta (con `/`).
//! `resolve` rechaza `..`, rutas absolutas, `\`, `:`, bytes nulos, nombres largos, extensiones
//! no permitidas y enlaces simbólicos cuyo destino real salga de la carpeta.

use serde::Serialize;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const NOT_ALLOWED: &str = "Ruta no permitida";
const MAX_READ: u64 = 2 * 1024 * 1024;
const MAX_DEPTH: usize = 6;
const MAX_ENTRIES: usize = 2000;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Ext {
    Asm,
    Pdf,
}

#[derive(Serialize, Debug, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Dir,
    File,
}

#[derive(Serialize, Debug)]
pub struct Node {
    pub name: String,
    pub path: String,
    pub kind: Kind,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<Node>,
}

fn io_err(e: io::Error) -> String {
    match e.kind() {
        io::ErrorKind::NotFound => "El archivo no existe".into(),
        io::ErrorKind::PermissionDenied => "Sin permiso para acceder al archivo".into(),
        io::ErrorKind::StorageFull => "No hay espacio en el disco".into(),
        io::ErrorKind::AlreadyExists => "El archivo ya existe".into(),
        _ => format!("No se pudo completar la operación ({})", e.kind()),
    }
}

fn parts(rel: &str) -> Result<Vec<&str>, String> {
    if rel.is_empty() || rel.contains(['\0', '\\', ':']) || rel.starts_with('/') {
        return Err(NOT_ALLOWED.into());
    }
    let v: Vec<&str> = rel.split('/').collect();
    if v.iter().any(|c| c.is_empty() || *c == "." || *c == "..") {
        return Err(NOT_ALLOWED.into());
    }
    if v.iter().any(|c| c.len() > 255) {
        return Err("Nombre demasiado largo".into());
    }
    Ok(v)
}

fn canonical_root(root: &Path) -> Result<PathBuf, String> {
    root.canonicalize().map_err(|_| "La carpeta no existe".to_string())
}

/// Ruta absoluta (bajo la carpeta) de `rel`, o el motivo del rechazo.
pub fn resolve(root: &Path, rel: &str, ext: Ext) -> Result<PathBuf, String> {
    let comps = parts(rel)?;
    let last = comps[comps.len() - 1];
    let want = if ext == Ext::Asm { "asm" } else { "pdf" };
    let ok = Path::new(last)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case(want))
        .unwrap_or(false);
    if !ok {
        return Err(format!("Solo se permiten archivos .{want}"));
    }
    let root_c = canonical_root(root)?;
    let mut target = root_c.clone();
    for c in &comps {
        target.push(c);
    }
    // El ancestro más cercano que ya existe (siguiendo enlaces) debe seguir dentro de la carpeta.
    let mut probe = target.clone();
    while fs::symlink_metadata(&probe).is_err() {
        probe = match probe.parent() {
            Some(p) => p.to_path_buf(),
            None => return Err(NOT_ALLOWED.into()),
        };
    }
    let real = probe.canonicalize().map_err(|_| NOT_ALLOWED.to_string())?;
    if !real.starts_with(&root_c) {
        return Err(NOT_ALLOWED.into());
    }
    Ok(target)
}

pub fn read_file(root: &Path, rel: &str) -> Result<String, String> {
    let p = resolve(root, rel, Ext::Asm)?;
    let meta = fs::metadata(&p).map_err(io_err)?;
    if !meta.is_file() {
        return Err("El archivo no existe".into());
    }
    if meta.len() > MAX_READ {
        return Err("El archivo es demasiado grande (máximo 2 MiB)".into());
    }
    let bytes = fs::read(&p).map_err(io_err)?;
    String::from_utf8(bytes).map_err(|_| "El archivo no es texto UTF-8".to_string())
}

pub fn write_file(root: &Path, rel: &str, text: &str) -> Result<(), String> {
    let p = resolve(root, rel, Ext::Asm)?;
    if !fs::metadata(&p).map(|m| m.is_file()).unwrap_or(false) {
        return Err("El archivo no existe".into());
    }
    if text.len() as u64 > MAX_READ {
        return Err("El archivo es demasiado grande (máximo 2 MiB)".into());
    }
    fs::write(&p, text).map_err(io_err)
}

pub fn create_file(root: &Path, rel: &str) -> Result<(), String> {
    let p = resolve(root, rel, Ext::Asm)?;
    if fs::symlink_metadata(&p).is_ok() {
        return Err("El archivo ya existe".into());
    }
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(io_err)?;
    }
    fs::OpenOptions::new().write(true).create_new(true).open(&p).map(|_| ()).map_err(io_err)
}

pub fn rename_path(root: &Path, from: &str, to: &str) -> Result<(), String> {
    let a = resolve(root, from, Ext::Asm)?;
    let b = resolve(root, to, Ext::Asm)?;
    if !fs::metadata(&a).map(|m| m.is_file()).unwrap_or(false) {
        return Err("El archivo no existe".into());
    }
    if fs::symlink_metadata(&b).is_ok() {
        return Err("El archivo ya existe".into());
    }
    if let Some(parent) = b.parent() {
        fs::create_dir_all(parent).map_err(io_err)?;
    }
    fs::rename(&a, &b).map_err(io_err)
}

pub fn delete_file(root: &Path, rel: &str) -> Result<(), String> {
    let p = resolve(root, rel, Ext::Asm)?;
    if !fs::metadata(&p).map(|m| m.is_file()).unwrap_or(false) {
        return Err("El archivo no existe".into());
    }
    fs::remove_file(&p).map_err(io_err)
}

/// Guarda un PDF en la carpeta; si el nombre existe agrega ` (2)`, ` (3)`… Devuelve el nombre final.
pub fn save_bytes(root: &Path, name: &str, bytes: &[u8]) -> Result<String, String> {
    if name.contains('/') {
        return Err(NOT_ALLOWED.into());
    }
    resolve(root, name, Ext::Pdf)?;
    let stem = &name[..name.len() - ".pdf".len()];
    let mut final_name = name.to_string();
    let mut n = 2;
    while fs::symlink_metadata(resolve(root, &final_name, Ext::Pdf)?).is_ok() {
        if n > 1000 {
            return Err("Demasiados archivos con el mismo nombre".into());
        }
        final_name = format!("{stem} ({n}).pdf");
        n += 1;
    }
    fs::write(resolve(root, &final_name, Ext::Pdf)?, bytes).map_err(io_err)?;
    Ok(final_name)
}

fn walk(dir: &Path, rel: &str, level: usize, count: &mut usize) -> Vec<Node> {
    let Ok(rd) = fs::read_dir(dir) else { return vec![] };
    let mut entries: Vec<_> = rd.filter_map(Result::ok).collect();
    entries.sort_by_key(|e| e.file_name().to_string_lossy().to_lowercase());
    let mut dirs = vec![];
    let mut files = vec![];
    for e in entries {
        let name = e.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let Ok(ft) = e.file_type() else { continue };
        if ft.is_symlink() {
            continue;
        }
        let path = if rel.is_empty() { name.clone() } else { format!("{rel}/{name}") };
        if ft.is_dir() {
            if level + 1 > MAX_DEPTH || *count >= MAX_ENTRIES {
                continue;
            }
            *count += 1; // reserva su lugar; se devuelve si queda vacía
            let reserved = *count;
            let children = walk(&e.path(), &path, level + 1, count);
            if children.is_empty() {
                *count = reserved - 1;
                continue;
            }
            dirs.push(Node { name, path, kind: Kind::Dir, children });
        } else if ft.is_file()
            && Path::new(&name).extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("asm")).unwrap_or(false)
        {
            if *count >= MAX_ENTRIES {
                continue;
            }
            *count += 1;
            files.push(Node { name, path, kind: Kind::File, children: vec![] });
        }
    }
    dirs.sort_by_key(|n| n.name.to_lowercase());
    files.sort_by_key(|n| n.name.to_lowercase());
    dirs.extend(files);
    dirs
}

/// Árbol de carpetas y archivos `.asm` (sin ocultos, sin enlaces, con tope de profundidad y de entradas).
pub fn list_tree(root: &Path) -> Result<Vec<Node>, String> {
    let r = canonical_root(root)?;
    if !r.is_dir() {
        return Err("La carpeta no existe".into());
    }
    let mut count = 0;
    Ok(walk(&r, "", 0, &mut count))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn s(e: Result<impl std::fmt::Debug, String>) -> String {
        e.unwrap_err()
    }

    #[test]
    fn resolve_acepta_rutas_validas() {
        let d = tempdir().unwrap();
        assert!(resolve(d.path(), "a.asm", Ext::Asm).is_ok());
        assert!(resolve(d.path(), "sub/a.asm", Ext::Asm).is_ok());
        assert!(resolve(d.path(), "SUB/A.ASM", Ext::Asm).is_ok());
    }

    #[test]
    fn resolve_rechaza_rutas_peligrosas() {
        let d = tempdir().unwrap();
        for bad in ["", "/etc/x.asm", "../x.asm", "a/../../x.asm", "C:\\x.asm", "a\\b.asm", "a\0.asm", "./a.asm", "a//b.asm", "a/", "C:x.asm"] {
            assert_eq!(s(resolve(d.path(), bad, Ext::Asm)), "Ruta no permitida", "{bad:?}");
        }
    }

    #[test]
    fn resolve_rechaza_extensiones_y_nombres_largos() {
        let d = tempdir().unwrap();
        assert_eq!(s(resolve(d.path(), "x.sh", Ext::Asm)), "Solo se permiten archivos .asm");
        assert_eq!(s(resolve(d.path(), "x", Ext::Asm)), "Solo se permiten archivos .asm");
        assert_eq!(s(resolve(d.path(), "x.asm", Ext::Pdf)), "Solo se permiten archivos .pdf");
        let largo = format!("{}.asm", "a".repeat(300));
        assert_eq!(s(resolve(d.path(), &largo, Ext::Asm)), "Nombre demasiado largo");
    }

    #[cfg(unix)]
    #[test]
    fn resolve_rechaza_enlaces_simbolicos_que_escapan() {
        let d = tempdir().unwrap();
        let fuera = tempdir().unwrap();
        std::os::unix::fs::symlink(fuera.path(), d.path().join("link")).unwrap();
        assert_eq!(s(resolve(d.path(), "link/x.asm", Ext::Asm)), "Ruta no permitida");
        fs::write(fuera.path().join("y.asm"), "NOP").unwrap();
        std::os::unix::fs::symlink(fuera.path().join("y.asm"), d.path().join("y.asm")).unwrap();
        assert_eq!(s(read_file(d.path(), "y.asm")), "Ruta no permitida");
    }

    #[test]
    fn crear_escribir_y_leer() {
        let d = tempdir().unwrap();
        create_file(d.path(), "p/n.asm").unwrap();
        assert_eq!(read_file(d.path(), "p/n.asm").unwrap(), "");
        assert_eq!(s(create_file(d.path(), "p/n.asm")), "El archivo ya existe");
        write_file(d.path(), "p/n.asm", "LDA 0040H ; A ← M[0040h] ñ").unwrap();
        assert_eq!(read_file(d.path(), "p/n.asm").unwrap(), "LDA 0040H ; A ← M[0040h] ñ");
        assert_eq!(s(write_file(d.path(), "no.asm", "x")), "El archivo no existe");
        assert_eq!(s(read_file(d.path(), "no.asm")), "El archivo no existe");
    }

    #[test]
    fn lectura_limites() {
        let d = tempdir().unwrap();
        fs::write(d.path().join("grande.asm"), vec![b'a'; 3 * 1024 * 1024]).unwrap();
        assert_eq!(s(read_file(d.path(), "grande.asm")), "El archivo es demasiado grande (máximo 2 MiB)");
        fs::write(d.path().join("bin.asm"), [0xffu8, 0xfe]).unwrap();
        assert_eq!(s(read_file(d.path(), "bin.asm")), "El archivo no es texto UTF-8");
        let texto = "a".repeat(3 * 1024 * 1024);
        fs::write(d.path().join("w.asm"), "").unwrap();
        assert_eq!(s(write_file(d.path(), "w.asm", &texto)), "El archivo es demasiado grande (máximo 2 MiB)");
    }

    #[test]
    fn renombrar_y_borrar() {
        let d = tempdir().unwrap();
        create_file(d.path(), "a.asm").unwrap();
        create_file(d.path(), "c.asm").unwrap();
        rename_path(d.path(), "a.asm", "b.asm").unwrap();
        assert!(!d.path().join("a.asm").exists() && d.path().join("b.asm").exists());
        assert_eq!(s(rename_path(d.path(), "b.asm", "c.asm")), "El archivo ya existe");
        assert_eq!(s(rename_path(d.path(), "zz.asm", "y.asm")), "El archivo no existe");
        rename_path(d.path(), "b.asm", "sub/b.asm").unwrap();
        assert!(d.path().join("sub/b.asm").exists());
        delete_file(d.path(), "sub/b.asm").unwrap();
        assert!(!d.path().join("sub/b.asm").exists());
        assert_eq!(s(delete_file(d.path(), "sub/b.asm")), "El archivo no existe");
        fs::write(d.path().join("n.txt"), "x").unwrap();
        assert_eq!(s(delete_file(d.path(), "n.txt")), "Solo se permiten archivos .asm");
    }

    #[test]
    fn arbol_orden_filtros_y_limites() {
        let d = tempdir().unwrap();
        let r = d.path();
        for f in ["b.asm", "A.asm", "notas.txt", "Zeta/z.asm", "alfa/x.asm", "alfa/sub/y.asm", "vacia/solo.txt", ".oculta/h.asm"] {
            let p = r.join(f);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(p, "NOP").unwrap();
        }
        let t = list_tree(r).unwrap();
        let nombres: Vec<_> = t.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(nombres, ["alfa", "Zeta", "A.asm", "b.asm"]);
        let alfa = &t[0];
        assert_eq!(alfa.path, "alfa");
        assert_eq!(alfa.children.iter().map(|n| n.path.as_str()).collect::<Vec<_>>(), ["alfa/sub", "alfa/x.asm"]);
        assert_eq!(alfa.children[0].children[0].path, "alfa/sub/y.asm");
    }

    #[test]
    fn arbol_profundidad_y_tope() {
        let d = tempdir().unwrap();
        let hondo = d.path().join("a/b/c/d/e/f/g");
        fs::create_dir_all(&hondo).unwrap();
        fs::write(hondo.join("x.asm"), "NOP").unwrap();
        fs::write(d.path().join("a/b/c/d/e/f/ok.asm"), "NOP").unwrap();
        let t = list_tree(d.path()).unwrap();
        fn cuenta(n: &[Node]) -> usize { n.iter().map(|x| 1 + cuenta(&x.children)).sum() }
        // a/b/c/d/e/f (6 niveles de carpetas) + ok.asm; la carpeta g (nivel 7) no se recorre.
        assert_eq!(cuenta(&t), 7);

        let m = tempdir().unwrap();
        for i in 0..2100 {
            fs::write(m.path().join(format!("f{i:04}.asm")), "").unwrap();
        }
        assert_eq!(list_tree(m.path()).unwrap().len(), 2000);
    }

    #[cfg(unix)]
    #[test]
    fn arbol_ignora_enlaces_simbolicos() {
        let d = tempdir().unwrap();
        let fuera = tempdir().unwrap();
        fs::write(fuera.path().join("y.asm"), "NOP").unwrap();
        std::os::unix::fs::symlink(fuera.path(), d.path().join("link")).unwrap();
        assert!(list_tree(d.path()).unwrap().is_empty());
    }

    #[test]
    fn guardar_pdf() {
        let d = tempdir().unwrap();
        assert_eq!(save_bytes(d.path(), "ej1-assembler.pdf", b"%PDF").unwrap(), "ej1-assembler.pdf");
        assert_eq!(fs::read(d.path().join("ej1-assembler.pdf")).unwrap(), b"%PDF");
        assert_eq!(save_bytes(d.path(), "ej1-assembler.pdf", b"2").unwrap(), "ej1-assembler (2).pdf");
        assert_eq!(save_bytes(d.path(), "ej1-assembler.pdf", b"3").unwrap(), "ej1-assembler (3).pdf");
        assert_eq!(s(save_bytes(d.path(), "../x.pdf", b"")), "Ruta no permitida");
        assert_eq!(s(save_bytes(d.path(), "a/x.pdf", b"")), "Ruta no permitida");
        assert_eq!(s(save_bytes(d.path(), "x.asm", b"")), "Solo se permiten archivos .pdf");
    }

    #[test]
    fn carpeta_inexistente_da_error_claro() {
        assert_eq!(s(list_tree(Path::new("/no/existe/seguro"))), "La carpeta no existe");
    }
}
