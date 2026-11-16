/** Documentación: índice por ámbito a la izquierda y la página actual (`#/documentacion/<id>`). */
import { DOCS, SCOPE_LABEL, getDoc, type DocScope } from './registry';
import { useSection } from '../lib/useSection';
import './docs.css';

const SCOPES: DocScope[] = ['catedra', 'fuera', 'legal'];

export function DocsPage({ compact = false }: { compact?: boolean } = {}) {
  const { rest, go } = useSection();
  const doc = getDoc(rest[0]);
  const { Component } = doc;

  const index = (
    <nav className="doc-index" aria-label="Documentación">
      {SCOPES.filter((sc) => DOCS.some((d) => d.scope === sc)).map((sc) => (
        <div key={sc}>
          <h2 className="caps">{SCOPE_LABEL[sc]}</h2>
          <ul>
            {DOCS.filter((d) => d.scope === sc).map((d) => (
              <li key={d.id}>
                <a
                  href={`#/documentacion/${d.id}`}
                  aria-current={d.id === doc.id ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    go('documentacion', d.id);
                  }}
                >
                  {d.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <section className={`page docs${compact ? ' compact' : ''}`} aria-label="Documentación">
      {index}
      <article className={`doc${doc.scope === 'fuera' ? ' fuera' : ''}`}>
        <p className="doc-scope">{SCOPE_LABEL[doc.scope]}</p>
        {doc.scope === 'fuera' && <span className="caps fuera-label">FUERA DE CÁTEDRA</span>}
        <h1>{doc.title}</h1>
        <Component />
      </article>
    </section>
  );
}
