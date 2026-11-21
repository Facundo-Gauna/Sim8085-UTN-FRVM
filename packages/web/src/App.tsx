/**
 * Pantalla "Simulador" (MASTER §8): barra lateral + columna principal con la
 * barra de herramientas, el aviso de la versión web, el área de trabajo
 * (editor ~60 % sobre "Ahora"; registros, banderas y memoria a la derecha),
 * el cajón inferior y la barra de estado. Por debajo de 900 px solo se muestra
 * el aviso para celulares.
 */
import { useEffect, useRef, useState } from 'react';
import { AArrowDown, AArrowUp, Columns2, Maximize2, PanelRightClose } from 'lucide-react';
import { Editor } from './editor/Editor';
import { Announcer } from './components/Announcer';
import { ConfirmDelete } from './components/workspace/ConfirmDelete';
import { FileTree } from './components/workspace/FileTree';
import { NameDialog } from './components/workspace/NameDialog';
import { baseOf, dirOf, normalizeName } from './components/workspace/names';
import { ExerciseBar } from './components/exercises/ExerciseBar';
import { ExercisesPage } from './components/exercises/ExercisesPage';
import { ToolboxPage } from './components/toolbox/ToolboxPage';
import { DocsPage } from './docs/DocsPage';
import { ExportDialog } from './components/export/ExportDialog';
import { Drawer } from './components/drawer/Drawer';
import { downloadActive, openFromDisk } from './components/FileTabs';
import { Flags } from './components/Flags';
import { Memory } from './components/Memory';
import { MobileNotice } from './components/MobileNotice';
import { Notice } from './components/Notice';
import { Now } from './components/Now';
import { PauseBanner } from './components/PauseBanner';
import { Rail } from './components/Rail';
import { Registers } from './components/Registers';
import { StatusBar } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';
import { FONT_MAX, FONT_MIN, useFontSize } from './lib/useFontSize';
import { useMediaQuery } from './lib/useMediaQuery';
import { useLayout, type Layout } from './lib/useLayout';
import { useSection, type Section } from './lib/useSection';
import { useRunner, type Speed } from './lib/useRunner';
import { useShortcuts } from './lib/useShortcuts';
import { hasUnsavedContent, installUnloadGuard } from './lib/unloadGuard';
import { webFileService, type FileService } from './services/fileService';
import { defaultSession, useSession } from './state/store';
import './App.css';

export const MOBILE_QUERY = '(max-width: 899px)';

/** Secciones ya construidas. */
const ENABLED: readonly Section[] = ['simulador', 'ejercicios', 'documentacion', 'toolbox'];

export function App({ fileService = webFileService }: { fileService?: FileService } = {}) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  return mobile ? (
    <>
      <MobileNotice />
      <DocsPage compact />
    </>
  ) : (
    <Shell fileService={fileService} />
  );
}

/** Barra lateral + la sección visible. El Simulador queda siempre montado (oculto) para no perder el editor ni la máquina. */
function Shell({ fileService }: { fileService: FileService }) {
  const { section, go } = useSection();
  return (
    <div className="app">
      <Rail section={section} onGo={(s) => go(s)} enabled={ENABLED} />
      <Simulator fileService={fileService} visible={section === 'simulador'} />
      {section === 'ejercicios' && <ExercisesPage />}
      {section === 'documentacion' && <DocsPage />}
      {section === 'toolbox' && <ToolboxPage />}
    </div>
  );
}

function Simulator({ fileService, visible }: { fileService: FileService; visible: boolean }) {
  const activeId = useSession((s) => s.activeId);
  const files = useSession((s) => s.files);
  const pausePrompt = useSession((s) => s.pausePrompt);
  const [speed, setSpeed] = useState<Speed>(3);
  const runner = useRunner(speed);
  const [fontSize, setFontSize] = useFontSize();
  const [layout, setLayout] = useLayout();
  const runRef = useRef<HTMLButtonElement>(null);
  const exportRef = useRef<HTMLButtonElement>(null);
  const [exporting, setExporting] = useState(false);

  // Carpeta de trabajo (solo escritorio): diálogos y panel.
  const ws = fileService.workspace;
  const workspace = useSession((s) => s.workspace);
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const [nameDialog, setNameDialog] = useState<
    null | { mode: 'new'; dir: string } | { mode: 'rename'; path: string } | { mode: 'saveAs' }
  >(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // beforeunload: avisa mientras haya archivos con contenido (lee siempre los últimos).
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => installUnloadGuard(() => hasUnsavedContent(filesRef.current)), []);

  const session = () => defaultSession.getState();
  const assemble = () => {
    runner.stop();
    session().assembleActive();
  };
  const toggleRun = () => (runner.running ? runner.stop() : runner.start());
  const step = () => {
    if (runner.running) return;
    const s = session();
    // Sin ensamblar (o con el código cambiado), el primer Paso solo ensambla: el alumno ve el
    // estado inicial y la próxima instrucción antes de ejecutar nada.
    if (!s.machine || s.stale) s.assembleActive();
    else s.step();
  };
  const back = () => {
    if (!runner.running) session().stepBack();
  };
  const reset = () => {
    runner.stop();
    session().reset();
  };

  /** Abre el cuadro de carpeta; true si quedó una carpeta abierta (la anterior o la nueva). */
  const ensureFolder = async (): Promise<boolean> => {
    if (!ws) return false;
    if (session().workspace) return true;
    return session().openFolder(ws);
  };
  const activeTab = () => session().files.find((f) => f.id === session().activeId);
  const saveCurrent = async () => {
    if (!ws) return downloadActive(fileService);
    if (!(await ensureFolder())) return;
    if (activeTab()?.path !== undefined) await session().saveActive(ws);
    else setNameDialog({ mode: 'saveAs' });
  };
  const saveAs = async () => {
    if (await ensureFolder()) setNameDialog({ mode: 'saveAs' });
  };

  useShortcuts({
    assemble,
    toggleRun,
    step,
    back,
    open: () => (ws ? void session().openFolder(ws) : openFromDisk(fileService)),
    save: () => void saveCurrent(),
    saveAs: ws ? () => void saveAs() : undefined,
    // Ctrl+Shift+F: alterna entre la disposición elegida y "solo editor".
    focus: () => setLayout(layout === 'foco' ? 'normal' : 'foco'),
  }, visible);

  /** Resultado de una operación de disco para el diálogo: '' si salió bien, si no el mensaje. */
  const result = (ok: boolean) => (ok ? '' : session().fileOpError || 'No se pudo completar la operación');
  const submitName = async (raw: string): Promise<string> => {
    if (!ws || !nameDialog) return '';
    const r = normalizeName(raw, { allowDirs: nameDialog.mode !== 'rename' });
    if (!r.ok) return r.error;
    if (nameDialog.mode === 'new') {
      return result(await session().createFile(ws, nameDialog.dir ? `${nameDialog.dir}/${r.name}` : r.name));
    }
    if (nameDialog.mode === 'rename') {
      const dir = dirOf(nameDialog.path);
      return result(await session().renameFile(ws, nameDialog.path, dir ? `${dir}/${r.name}` : r.name));
    }
    return result(await session().saveActive(ws, r.name));
  };

  const afterPause = (cont: boolean) => {
    if (cont) {
      session().continueAfterPause();
      runner.start();
    } else {
      // Primero el runner (si alguien la volvió a poner en marcha), después el store.
      runner.stop();
      session().stop();
    }
  };

  // Al cerrarse el aviso de pausa con el foco adentro, el foco vuelve a Ejecutar/Detener
  // (si se cerró porque el alumno editó el código, el foco se queda en el editor).
  const hadPause = useRef(false);
  useEffect(() => {
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (hadPause.current && !pausePrompt && lost) runRef.current?.focus();
    hadPause.current = pausePrompt;
  }, [pausePrompt]);

  // Al cerrar el diálogo de exportación el foco vuelve al botón que lo abrió.
  const wasExporting = useRef(false);
  useEffect(() => {
    if (wasExporting.current && !exporting) exportRef.current?.focus();
    wasExporting.current = exporting;
  }, [exporting]);

  return (
    <>
      <div className="main" hidden={!visible}>
        <Toolbar
          running={runner.running}
          onToggleRun={toggleRun}
          onAssemble={assemble}
          onStep={step}
          onBack={back}
          onReset={reset}
          speed={speed}
          onSpeed={setSpeed}
          runRef={runRef}
          fileService={fileService}
          onExport={() => setExporting(true)}
          exportRef={exportRef}
          onOpenFolder={ws ? () => void session().openFolder(ws) : undefined}
        />
        <Notice />
        <ExerciseBar />
        {pausePrompt && <PauseBanner onContinue={() => afterPause(true)} onStop={() => afterPause(false)} />}
        <main
          className={`work layout-${layout}${ws && workspace ? ` with-files${filesCollapsed ? ' files-collapsed' : ''}` : ''}`}
        >
          {ws && workspace && (
            <FileTree
              ws={ws}
              collapsed={filesCollapsed}
              onToggle={() => setFilesCollapsed((c) => !c)}
              onNew={(dir) => setNameDialog({ mode: 'new', dir })}
              onRename={(path) => setNameDialog({ mode: 'rename', path })}
              onDelete={setDeleting}
            />
          )}
          <div className="left">
            <section className="panel editor-panel" aria-label="Editor">
              <header className="panel-h">
                <span className="caps">
                  <b>00</b>Editor
                </span>
                <span className="editor-tools">
                  <span className="kbd-hint">Esc y luego Tab salen del editor</span>
                  <LayoutSwitch layout={layout} onChange={setLayout} />
                  <span className="font-size" role="group" aria-label="Tamaño de letra del editor">
                    <button
                      type="button"
                      aria-label="Achicar letra del editor"
                      title="Achicar letra"
                      disabled={fontSize <= FONT_MIN}
                      onClick={() => setFontSize(fontSize - 1)}
                    >
                      <AArrowDown size={16} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                    <output className="mono" aria-live="off">
                      {fontSize} px
                    </output>
                    <button
                      type="button"
                      aria-label="Agrandar letra del editor"
                      title="Agrandar letra"
                      disabled={fontSize >= FONT_MAX}
                      onClick={() => setFontSize(fontSize + 1)}
                    >
                      <AArrowUp size={16} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </span>
                </span>
              </header>
              <div className="editor-slot">
                <Editor fileId={activeId} fontSize={fontSize} />
              </div>
            </section>
            <Now />
          </div>
          <div className="right" hidden={layout === 'foco'}>
            <Registers />
            <Flags />
            <Memory />
          </div>
        </main>
        <Drawer initialCollapsed />
        <StatusBar />
      </div>
      <ExportDialog
        open={exporting}
        onClose={() => setExporting(false)}
        fileService={fileService}
      />
      {nameDialog && (
        <NameDialog
          title={nameDialog.mode === 'new' ? 'Nuevo archivo' : nameDialog.mode === 'rename' ? 'Renombrar archivo' : 'Guardar como'}
          initial={
            nameDialog.mode === 'new'
              ? nameDialog.dir
                ? `${nameDialog.dir}/`
                : ''
              : nameDialog.mode === 'rename'
                ? baseOf(nameDialog.path)
                : (activeTab()?.path ?? activeTab()?.name ?? '')
          }
          onSubmit={submitName}
          onClose={() => setNameDialog(null)}
        />
      )}
      {deleting && ws && (
        <ConfirmDelete
          name={baseOf(deleting)}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            void session().deleteFile(ws, deleting);
            setDeleting(null);
          }}
        />
      )}
      <Announcer />
    </>
  );
}

const LAYOUT_OPTIONS: Array<{ value: Layout; label: string; title: string; Icon: typeof Columns2 }> = [
  { value: 'normal', label: 'Equilibrado', title: 'Editor y estado de la máquina en partes parecidas', Icon: Columns2 },
  { value: 'amplio', label: 'Editor amplio', title: 'Más lugar para el editor; la columna derecha se angosta', Icon: PanelRightClose },
  { value: 'foco', label: 'Solo editor', title: 'Oculta registros, banderas y memoria (Ctrl+Shift+F)', Icon: Maximize2 },
];

/** Selector de disposición: cuánto lugar ocupa el editor. */
function LayoutSwitch({ layout, onChange }: { layout: Layout; onChange(l: Layout): void }) {
  return (
    <span className="layout-switch" role="radiogroup" aria-label="Tamaño del editor">
      {LAYOUT_OPTIONS.map(({ value, label, title, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={layout === value}
          aria-label={label}
          title={`${label}: ${title}`}
          onClick={() => onChange(value)}
        >
          <Icon size={15} strokeWidth={1.6} aria-hidden="true" />
        </button>
      ))}
    </span>
  );
}
