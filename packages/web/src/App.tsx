/**
 * Pantalla "Simulador" (MASTER §8): barra lateral + columna principal con la
 * barra de herramientas, el aviso de la versión web, el área de trabajo
 * (editor ~60 % sobre "Ahora"; registros, banderas y memoria a la derecha),
 * el cajón inferior y la barra de estado. Por debajo de 900 px solo se muestra
 * el aviso para celulares.
 */
import { useEffect, useRef, useState } from 'react';
import { AArrowDown, AArrowUp } from 'lucide-react';
import { Editor } from './editor/Editor';
import { Announcer } from './components/Announcer';
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
import { useRunner, type Speed } from './lib/useRunner';
import { useShortcuts } from './lib/useShortcuts';
import { hasUnsavedContent, installUnloadGuard } from './lib/unloadGuard';
import { webFileService, type FileService } from './services/fileService';
import { defaultSession, useSession } from './state/store';
import './App.css';

export const MOBILE_QUERY = '(max-width: 899px)';

export function App({ fileService = webFileService }: { fileService?: FileService } = {}) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  return mobile ? <MobileNotice /> : <Simulator fileService={fileService} />;
}

function Simulator({ fileService }: { fileService: FileService }) {
  const activeId = useSession((s) => s.activeId);
  const files = useSession((s) => s.files);
  const pausePrompt = useSession((s) => s.pausePrompt);
  const [speed, setSpeed] = useState<Speed>(3);
  const runner = useRunner(speed);
  const [fontSize, setFontSize] = useFontSize();
  const runRef = useRef<HTMLButtonElement>(null);

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
    if (!runner.running) session().step();
  };
  const back = () => {
    if (!runner.running) session().stepBack();
  };
  const reset = () => {
    runner.stop();
    session().reset();
  };

  useShortcuts({
    assemble,
    toggleRun,
    step,
    back,
    open: () => openFromDisk(fileService),
    save: () => downloadActive(fileService),
  });

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

  return (
    <div className="app">
      <Rail />
      <div className="main">
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
        />
        <Notice />
        {pausePrompt && <PauseBanner onContinue={() => afterPause(true)} onStop={() => afterPause(false)} />}
        <main className="work">
          <div className="left">
            <section className="panel editor-panel" aria-label="Editor">
              <header className="panel-h">
                <span className="caps">
                  <b>00</b>Editor
                </span>
                <span className="editor-tools">
                  <span className="kbd-hint">Esc y luego Tab salen del editor</span>
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
          <div className="right">
            <Registers />
            <Flags />
            <Memory />
          </div>
        </main>
        <Drawer initialCollapsed />
        <StatusBar />
      </div>
      <Announcer />
    </div>
  );
}
