import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/tokens.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createDesktopFileService, isDesktop } from './services/desktop';
import { webFileService } from './services/fileService';

async function start() {
  // En la app de escritorio, `invoke` de Tauri; en la web no se importa nada de Tauri.
  const fileService = isDesktop()
    ? createDesktopFileService((await import('@tauri-apps/api/core')).invoke)
    : webFileService;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App fileService={fileService} />
    </StrictMode>,
  );
}
void start();
