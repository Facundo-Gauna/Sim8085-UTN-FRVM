/** Descargas de la app de escritorio por sistema, con tamaño y SHA-256; tolera un manifiesto ausente o parcial. */
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { isDesktop } from '../services/desktop';
import { formatSize, loadManifest, type DownloadOs, type DownloadsManifest } from './manifest';
import './downloads.css';

const SYSTEMS: { os: DownloadOs; name: string }[] = [
  { os: 'linux', name: 'Linux' },
  { os: 'windows', name: 'Windows' },
];

export function Downloads({ fetchFn }: { fetchFn?: typeof fetch } = {}) {
  const desktop = isDesktop();
  const [state, setState] = useState<{ loading: true } | { loading: false; manifest: DownloadsManifest | null }>({ loading: true });

  useEffect(() => {
    if (desktop) return;
    let live = true;
    void loadManifest(fetchFn).then((manifest) => live && setState({ loading: false, manifest }));
    return () => {
      live = false;
    };
  }, [desktop, fetchFn]);

  if (desktop) return <p className="dl-note">Ya estás usando la app de escritorio</p>;
  if (state.loading) return <p role="status" className="dl-note">Buscando instaladores…</p>;

  return (
    <div className="dl">
      {SYSTEMS.map(({ os, name }) => {
        const files = state.manifest?.files.filter((f) => f.os === os) ?? [];
        return (
          <div key={os} className="dl-card" role="group" aria-label={name}>
            <h3>{name}</h3>
            {files.length === 0 ? (
              <p className="dl-note">Todavía no hay instalador de {name}</p>
            ) : (
              <ul>
                {files.map((f) => (
                  <li key={f.file}>
                    <a className="btn primary" href={f.url} download={f.file}>
                      <Download size={16} strokeWidth={1.75} aria-hidden="true" />
                      Descargar {f.label}
                    </a>
                    <span className="dl-size">
                      {formatSize(f.size)} · versión {f.version}
                    </span>
                    <code className="dl-hash">SHA-256: {f.sha256}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
