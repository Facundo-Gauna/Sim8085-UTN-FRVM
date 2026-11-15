export function hasUnsavedContent(files: { text: string }[]): boolean {
  return files.some((f) => f.text.trim() !== '');
}

export function installUnloadGuard(hasContent: () => boolean): () => void {
  const handler = (event: BeforeUnloadEvent): void => {
    if (!hasContent()) return;
    event.preventDefault();
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}
