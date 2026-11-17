/**
 * Panel "Archivos" de la carpeta de trabajo (escritorio): árbol accesible (role=tree) con
 * flechas, Enter (abrir / plegar), F2 (renombrar) y Supr (borrar).
 */
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronRight, FilePlus, FileText, Folder, PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react';
import type { TreeNode, WorkspaceService } from '../../services/workspace';
import { defaultSession, useSession } from '../../state/store';
import './workspace.css';

export interface FileTreeProps {
  ws: WorkspaceService;
  collapsed: boolean;
  onToggle(): void;
  onNew(dir: string): void;
  onRename(path: string): void;
  onDelete(path: string): void;
}

interface Flat {
  node: TreeNode;
  parent: string | null;
}

export function FileTree({ ws, collapsed, onToggle, onNew, onRename, onDelete }: FileTreeProps) {
  const workspace = useSession((s) => s.workspace);
  const error = useSession((s) => s.fileOpError);
  const activePath = useSession((s) => s.files.find((f) => f.id === s.activeId)?.path);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const [selectedDir, setSelectedDir] = useState('');
  const refs = useRef(new Map<string, HTMLLIElement>());

  const tree = workspace?.tree ?? [];
  const flat = useMemo(() => {
    const out: Flat[] = [];
    const walk = (nodes: TreeNode[], parent: string | null) => {
      for (const n of nodes) {
        out.push({ node: n, parent });
        if (n.kind === 'dir' && !folded.has(n.path)) walk(n.children ?? [], n.path);
      }
    };
    walk(tree, null);
    return out;
  }, [tree, folded]);

  if (!workspace) return null;
  const session = () => defaultSession.getState();
  const current = focus && flat.some((f) => f.node.path === focus) ? focus : (flat[0]?.node.path ?? null);

  const moveTo = (path: string | undefined) => {
    if (!path) return;
    setFocus(path);
    refs.current.get(path)?.focus();
  };
  const toggle = (path: string, open?: boolean) =>
    setFolded((prev) => {
      const next = new Set(prev);
      const shouldOpen = open ?? next.has(path);
      if (shouldOpen) next.delete(path);
      else next.add(path);
      return next;
    });
  const activate = (n: TreeNode) => {
    if (n.kind === 'dir') {
      setSelectedDir(n.path);
      toggle(n.path);
    } else {
      void session().openWorkspaceFile(ws, n.path);
    }
  };

  const onKey = (e: KeyboardEvent, n: TreeNode) => {
    const i = flat.findIndex((f) => f.node.path === n.path);
    const open = n.kind === 'dir' && !folded.has(n.path);
    let handled = true;
    switch (e.key) {
      case 'ArrowDown':
        moveTo(flat[i + 1]?.node.path);
        break;
      case 'ArrowUp':
        moveTo(flat[i - 1]?.node.path);
        break;
      case 'Home':
        moveTo(flat[0]?.node.path);
        break;
      case 'End':
        moveTo(flat[flat.length - 1]?.node.path);
        break;
      case 'ArrowRight':
        if (n.kind === 'dir') {
          if (!open) toggle(n.path, true);
          else moveTo(flat[i + 1]?.parent === n.path ? flat[i + 1]?.node.path : undefined);
        }
        break;
      case 'ArrowLeft':
        if (open) toggle(n.path, false);
        else moveTo(flat[i]?.parent ?? undefined);
        break;
      case 'Enter':
      case ' ':
        activate(n);
        break;
      case 'F2':
        if (n.kind === 'file') onRename(n.path);
        break;
      case 'Delete':
        if (n.kind === 'file') onDelete(n.path);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation(); // el evento sube por los <li> anidados
    }
  };

  const render = (nodes: TreeNode[], depth: number): JSX.Element => (
    <ul role={depth === 0 ? 'tree' : 'group'} aria-label={depth === 0 ? 'Archivos de la carpeta' : undefined} className="ws-tree">
      {nodes.map((n) => {
        const isDir = n.kind === 'dir';
        const open = isDir && !folded.has(n.path);
        return (
          <li
            key={n.path}
            ref={(el) => void (el ? refs.current.set(n.path, el) : refs.current.delete(n.path))}
            role="treeitem"
            aria-label={n.name}
            aria-expanded={isDir ? open : undefined}
            aria-current={!isDir && n.path === activePath ? 'true' : undefined}
            tabIndex={n.path === current ? 0 : -1}
            className="ws-item"
            onKeyDown={(e) => onKey(e, n)}
            onFocus={(e) => e.target === e.currentTarget && setFocus(n.path)}
            onClick={(e) => {
              e.stopPropagation();
              setFocus(n.path);
              activate(n);
            }}
          >
            <span className="ws-row" style={{ paddingLeft: depth * 12 }}>
              {isDir ? (
                <>
                  {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                  <Folder size={14} aria-hidden="true" />
                </>
              ) : (
                <FileText size={14} aria-hidden="true" className="ws-file-icon" />
              )}
              <span>{n.name}</span>
            </span>
            {isDir && open && n.children && n.children.length > 0 && render(n.children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className={`panel ws-panel${collapsed ? ' collapsed' : ''}`} aria-label="Archivos">
      <header className="panel-h ws-head">
        {!collapsed && <span className="caps">{workspace.name}</span>}
        <span className="ws-tools">
          {!collapsed && (
            <>
              <button type="button" className="btn icon" aria-label="Nuevo archivo" title="Nuevo archivo" onClick={() => onNew(selectedDir)}>
                <FilePlus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button type="button" className="btn icon" aria-label="Actualizar" title="Actualizar la lista" onClick={() => void session().refreshTree(ws)}>
                <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </>
          )}
          <button
            type="button"
            className="btn icon"
            aria-label={collapsed ? 'Mostrar archivos' : 'Ocultar archivos'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Mostrar archivos' : 'Ocultar archivos'}
            onClick={onToggle}
          >
            {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
          </button>
        </span>
      </header>
      {!collapsed && (
        <div className="ws-body">
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          {tree.length === 0 ? <p className="ws-empty">No hay archivos .asm en esta carpeta</p> : render(tree, 0)}
        </div>
      )}
    </section>
  );
}
