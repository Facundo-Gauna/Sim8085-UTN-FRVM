/**
 * Barra de herramientas: pestañas de archivo, dirección de inicio, Ensamblar,
 * Ejecutar/Detener, Paso, Atrás, Reiniciar y velocidad.
 *
 * Una sola acción primaria naranja (MASTER §2.2): Ensamblar mientras no hay un
 * ensamblado al día; Reiniciar con el programa detenido en HLT; si no,
 * Ejecutar (o Detener mientras corre).
 */
import { useEffect, useId, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from 'react';
import { FileDown, FolderOpen, Hammer, Play, RotateCcw, Square, StepBack, StepForward, WandSparkles } from 'lucide-react';
import { fmt16, parseAddress } from '../lib/format';
import { SPEED_TEXT, type Speed } from '../lib/useRunner';
import { useSession } from '../state/store';
import type { FileService } from '../services/fileService';
import { FileTabs } from './FileTabs';
import './Toolbar.css';

export interface ToolbarProps {
  running: boolean;
  onToggleRun(): void;
  onAssemble(): void;
  onStep(): void;
  onBack(): void;
  onReset(): void;
  speed: Speed;
  onSpeed(s: Speed): void;
  runRef: RefObject<HTMLButtonElement>;
  fileService: FileService;
  onExport(): void;
  /** Solo en la app de escritorio: abre el cuadro de carpeta. */
  onOpenFolder?(): void;
  exportRef: RefObject<HTMLButtonElement>;
}

function StartField() {
  const startAddress = useSession((s) => s.startAddress);
  const setStartAddress = useSession((s) => s.setStartAddress);
  const shown = fmt16(startAddress, 'hex');
  const [draft, setDraft] = useState(shown);
  const [invalid, setInvalid] = useState(false);
  const id = useId();

  useEffect(() => {
    setDraft(shown);
    setInvalid(false);
  }, [shown]);

  const apply = () => {
    if (draft.trim() === shown) {
      setInvalid(false);
      return;
    }
    // El store valida y pone el mensaje de error; acá solo se marca el campo.
    const parsed = parseAddress(draft);
    setStartAddress(draft);
    setInvalid(!parsed.ok);
    if (parsed.ok) setDraft(fmt16(parsed.value, 'hex'));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      apply();
    } else if (e.key === 'Escape') {
      setDraft(shown);
      setInvalid(false);
    }
  };

  return (
    <div className="tb-field" data-invalid={invalid || undefined}>
      <label htmlFor={id} className="caps">
        Inicio
      </label>
      <input
        id={id}
        className="mono"
        value={draft}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={invalid}
        title="Dirección de inicio del programa (Enter aplica)"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={apply}
        onKeyDown={onKey}
      />
    </div>
  );
}

export function Toolbar(p: ToolbarProps) {
  const machine = useSession((s) => s.machine);
  const stale = useSession((s) => s.stale);
  useSession((s) => s.version); // halted y canBack viven en la máquina mutable
  const autofill = useSession((s) => s.autofillObservations);
  const speedId = useId();

  const live = machine !== null && !stale;
  const canRun = live && !machine.cpu.halted;
  const canStep = live && !p.running;
  const canBack = canStep && machine.canBack;
  const primary: 'assemble' | 'run' | 'reset' = !live ? 'assemble' : machine.cpu.halted && !p.running ? 'reset' : 'run';

  const onSpeed = (e: ChangeEvent<HTMLInputElement>) => p.onSpeed(Number(e.target.value) as Speed);

  return (
    <header className="toolbar" aria-label="Barra de herramientas">
      <FileTabs fileService={p.fileService} />
      {p.onOpenFolder && (
        <button
          type="button"
          className="btn"
          onClick={p.onOpenFolder}
          aria-keyshortcuts="Control+O Meta+O"
          title="Abrir una carpeta de trabajo (Ctrl+O)"
        >
          <FolderOpen size={16} strokeWidth={1.75} aria-hidden="true" />
          Abrir carpeta
        </button>
      )}
      <StartField />
      <button
        type="button"
        className={`btn${primary === 'assemble' ? ' primary' : ''}`}
        onClick={p.onAssemble}
        aria-keyshortcuts="F5"
        title="Ensamblar (F5)"
      >
        <Hammer size={16} strokeWidth={1.75} aria-hidden="true" />
        Ensamblar
      </button>
      <div className="tb-group transport" role="group" aria-label="Ejecución">
        <button
          ref={p.runRef}
          type="button"
          className={`btn run${primary === 'run' ? ' primary' : ''}`}
          onClick={p.onToggleRun}
          disabled={!p.running && !canRun}
          aria-keyshortcuts="F8"
          title={p.running ? 'Detener (F8)' : 'Ejecutar (F8)'}
        >
          {p.running ? (
            <Square size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Play size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
          {p.running ? 'Detener' : 'Ejecutar'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={p.onStep}
          disabled={!canStep}
          aria-keyshortcuts="F10"
          title="Paso (F10)"
        >
          <StepForward size={16} strokeWidth={1.75} aria-hidden="true" />
          Paso
        </button>
        <button
          type="button"
          className="btn"
          onClick={p.onBack}
          disabled={!canBack}
          aria-keyshortcuts="Shift+F10"
          title="Atrás (Shift+F10)"
        >
          <StepBack size={16} strokeWidth={1.75} aria-hidden="true" />
          Atrás
        </button>
        <button
          type="button"
          className={`btn icon${primary === 'reset' ? ' primary' : ''}`}
          onClick={p.onReset}
          disabled={!live}
          aria-label="Reiniciar"
          title="Reiniciar: vuelve al inicio del programa"
        >
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <div className="tb-speed">
        <label htmlFor={speedId}>Velocidad</label>
        <input
          id={speedId}
          type="range"
          min={1}
          max={5}
          step={1}
          value={p.speed}
          aria-valuetext={SPEED_TEXT[p.speed]}
          title={`Velocidad: ${SPEED_TEXT[p.speed]}`}
          onChange={onSpeed}
        />
      </div>
      <div className="tb-group delivery" role="group" aria-label="Entrega">
        <button
          type="button"
          className="btn"
          aria-label="Autocompletar observaciones"
          onClick={() => void autofill()}
          disabled={!live}
          title={live ? 'Escribe una observación en las líneas sin comentario' : 'Ensamblá primero (F5) para autocompletar observaciones'}
        >
          <WandSparkles size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="lbl-long">Autocompletar observaciones</span>
          <span className="lbl-short" aria-hidden="true">Observaciones</span>
        </button>
        <button
          ref={p.exportRef}
          type="button"
          className="btn"
          aria-label="Exportar PDF"
          onClick={p.onExport}
          disabled={!live}
          title={live ? 'Exportar las hojas de entrega a PDF' : 'Ensamblá primero (F5) para exportar a PDF'}
        >
          <FileDown size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="lbl-long">Exportar PDF</span>
          <span className="lbl-short" aria-hidden="true">PDF</span>
        </button>
      </div>
    </header>
  );
}
