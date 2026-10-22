import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function render(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      output: 'html',
    });
  } catch (err) {
    console.error('[physx] KaTeX render failed:', err);
    // Show the raw source rather than pretending the formula rendered.
    return `<code>${tex.replace(/</g, '&lt;')}</code>`;
  }
}

/** Block or inline KaTeX formula. `tex` is developer-authored, never user input. */
export function MathTex({
  tex,
  display = false,
  className,
}: {
  tex: string;
  display?: boolean;
  className?: string;
}) {
  const html = useMemo(() => render(tex, display), [tex, display]);
  return (
    <span
      className={className}
      // Safe: katex output from a trusted, developer-authored TeX string.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Rich text with inline TeX segments, display TeX segments, plus bold and
 * italic markers — used by question prompts and worked-solution steps.
 */
export function RichText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const out: { kind: 'text' | 'tex' | 'texd' | 'b' | 'i'; value: string }[] = [];
    const pushText = (seg: string) => {
      // Handle **bold** then *italic* within plain segments.
      const boldSplit = seg.split(/\*\*([^*]+?)\*\*/g);
      boldSplit.forEach((b, bi) => {
        if (bi % 2 === 1) {
          out.push({ kind: 'b', value: b });
          return;
        }
        const italSplit = b.split(/\*([^*]+?)\*/g);
        italSplit.forEach((s, si) => {
          if (si % 2 === 1) out.push({ kind: 'i', value: s });
          else if (s.length > 0) out.push({ kind: 'text', value: s });
        });
      });
    };
    // Split on $$...$$ first, then single-$ segments within plain text.
    const displaySplit = text.split(/\$\$([\s\S]+?)\$\$/g);
    displaySplit.forEach((seg, i) => {
      if (i % 2 === 1) {
        out.push({ kind: 'texd', value: seg });
        return;
      }
      const inlineSplit = seg.split(/\$([^$]+?)\$/g);
      inlineSplit.forEach((s2, j) => {
        if (j % 2 === 1) out.push({ kind: 'tex', value: s2 });
        else if (s2.length > 0) pushText(s2);
      });
    });
    return out;
  }, [text]);

  return (
    <span>
      {parts.map((p, i) => {
        switch (p.kind) {
          case 'tex':
            return <MathTex key={i} tex={p.value} />;
          case 'texd':
            return (
              <span key={i} style={{ display: 'block', margin: '8px 0' }}>
                <MathTex tex={p.value} display />
              </span>
            );
          case 'b':
            return (
              <b key={i} style={{ color: 'var(--text)' }}>
                {p.value}
              </b>
            );
          case 'i':
            return <i key={i}>{p.value}</i>;
          default:
            return <span key={i}>{p.value}</span>;
        }
      })}
    </span>
  );
}
