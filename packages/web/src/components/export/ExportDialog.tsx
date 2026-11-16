/**
 * Diálogo "Exportar PDF": elige la hoja, pide Alumno/Ejercicio/Hoja Nº/Fecha,
 * muestra la vista previa (la misma maqueta que el PDF) y descarga. Vive dentro
 * de la página (nunca alert/confirm); foco atrapado y Escape cierra.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { layoutTrace, safeFileName, type AsmLayout, type Header } from '../../pdf/layout';
import { layoutAssemblerHelvetica, renderAssemblerPdf, renderTracePdf } from '../../pdf/render';
import type { FileService } from '../../services/fileService';
import { defaultSession, useSession } from '../../state/store';
import { AsmSheet, TraceSheet } from './ExportPreview';
import './export.css';

type Kind = 'assembler' | 'registros';

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export interface ExportDialogProps {
  open: boolean;
  onClose(): void;
  fileService: FileService;
}

export function ExportDialog({ open, onClose, fileService }: ExportDialogProps) {
  if (!open) return null;
  return <Dialog onClose={onClose} fileService={fileService} />;
}

function Dialog({ onClose, fileService }: Omit<ExportDialogProps, 'open'>) {
  const asm = useSession((s) => s.asm);
  const traceForExport = useSession((s) => s.traceForExport);
  const [kind, setKind] = useState<Kind>('assembler');
  const [student, setStudent] = useState('');
  const [exercise, setExercise] = useState('');
  const [sheetText, setSheetText] = useState('1');
  const [date, setDate] = useState(today);
  const [page, setPage] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const [asmLayout, setAsmLayout] = useState<AsmLayout | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const studentRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const rows = useMemo(() => asm?.rows ?? [], [asm]);
  const trace = useMemo(() => traceForExport(), [traceForExport]);
  const tracePages = useMemo(() => layoutTrace(trace?.rows ?? []), [trace]);

  useEffect(() => studentRef.current?.focus(), []);
  useEffect(() => {
    let live = true;
    void layoutAssemblerHelvetica(rows).then((l) => live && setAsmLayout(l));
    return () => {
      live = false;
    };
  }, [rows]);

  const sheetValid = /^[1-9]\d*$/.test(sheetText.trim());
  const sheetStart = sheetValid ? Number(sheetText) : 1;
  const header: Header = { student, exercise, sheetStart, date };
  const pageCount = kind === 'assembler' ? (asmLayout?.pages.length ?? 1) : tracePages.length;
  const current = Math.min(page, pageCount - 1);

  const truncated = asmLayout?.truncated ?? [];
  const warnings: string[] = [];
  if (kind === 'assembler' && truncated.length > 0) {
    const n = truncated.length;
    const lines = truncated.map((t) => t.line).join(', ');
    warnings.push(
      `${n} ${plural(n, 'observación pasa', 'observaciones pasan')} de 80 caracteres y ${plural(n, 'se recorta', 'se recortan')}: ${plural(n, 'línea', 'líneas')} ${lines}`,
    );
  }
  if (kind === 'registros' && trace?.truncated) warnings.push('Se muestran las primeras 500 instrucciones');
  if (kind === 'registros' && trace?.error) {
    warnings.push(`La ejecución terminó con un error: ${trace.error}; la hoja incluye las instrucciones anteriores`);
  }

  const download = async () => {
    setBusy(true);
    setSaveError('');
    try {
      const r = kind === 'assembler' ? await renderAssemblerPdf(rows, header) : await renderTracePdf(trace?.rows ?? [], header);
      const name = safeFileName(exercise, kind);
      await fileService.saveBinary(name, r.bytes, 'application/pdf');
      defaultSession.setState({ status: { kind: 'info', text: `PDF guardado: ${name}` } });
    } catch {
      setSaveError('No se pudo guardar el PDF. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      const f = [...(root.current?.querySelectorAll<HTMLElement>('input, button, [tabindex="0"]') ?? [])].filter(
        (el) => !(el as HTMLButtonElement).disabled,
      );
      if (f.length === 0) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="export-scrim">
      <div
        ref={root}
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-t`}
        onKeyDown={onKey}
      >
        <header className="export-h">
          <h2 id={`${uid}-t`}>Exportar PDF</h2>
          <button type="button" className="btn icon" onClick={onClose} aria-label="Cerrar">
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>
        <div className="export-body">
          <form className="export-form" onSubmit={(e) => e.preventDefault()}>
            <fieldset>
              <legend className="caps">Hoja</legend>
              {(
                [
                  ['assembler', 'Plantilla Assembler'],
                  ['registros', 'Registros-Banderas-Memoria'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="radio">
                  <input
                    type="radio"
                    name={`${uid}-kind`}
                    checked={kind === k}
                    onChange={() => {
                      setKind(k);
                      setPage(0);
                    }}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="field">
              Alumno
              <input ref={studentRef} value={student} onChange={(e) => setStudent(e.target.value)} spellCheck={false} />
            </label>
            <label className="field">
              Ejercicio
              <input value={exercise} onChange={(e) => setExercise(e.target.value)} spellCheck={false} />
            </label>
            <label className="field">
              Hoja Nº inicial
              <input
                className="mono"
                value={sheetText}
                onChange={(e) => setSheetText(e.target.value)}
                aria-invalid={sheetValid ? undefined : true}
                aria-describedby={sheetValid ? undefined : `${uid}-sheet`}
                inputMode="numeric"
              />
            </label>
            {!sheetValid && (
              <p id={`${uid}-sheet`} className="field-error">
                Hoja Nº: ingresá un número entero desde 1
              </p>
            )}
            <label className="field">
              Fecha
              <input className="mono" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <div role="status" className="export-warn">
              {warnings.map((w) => (
                <p key={w}>
                  <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" /> {w}
                </p>
              ))}
            </div>
            {saveError && (
              <p role="alert" className="field-error">
                {saveError}
              </p>
            )}
          </form>
          <section className="export-preview" aria-label="Vista previa">
            <div className="export-pager">
              <button type="button" className="btn" onClick={() => setPage(current - 1)} disabled={current <= 0}>
                Anterior
              </button>
              <span>
                Hoja {current + 1} de {pageCount}
              </span>
              <button type="button" className="btn" onClick={() => setPage(current + 1)} disabled={current >= pageCount - 1}>
                Siguiente
              </button>
            </div>
            <div className="export-sheet-scroll" tabIndex={0} aria-label="Hoja en vista previa">
              {kind === 'assembler' ? (
                asmLayout && <AsmSheet page={asmLayout.pages[current]!} header={header} />
              ) : (
                <TraceSheet page={tracePages[current]!} header={header} />
              )}
            </div>
          </section>
        </div>
        <footer className="export-f">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn primary" onClick={() => void download()} disabled={!sheetValid || busy}>
            Descargar PDF
          </button>
        </footer>
      </div>
    </div>
  );
}
