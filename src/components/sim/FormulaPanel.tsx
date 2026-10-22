import type { ReactNode } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { MathTex } from '../math/MathTex';
import { useAppData } from '../../state/data';

export interface DisplayedFormula {
  /** Registry id enables bookmarking (see education/formulas.ts). */
  id?: string;
  tex: string;
  caption?: ReactNode;
  variables?: { sym: string; name: string; unit: string }[];
  /** Live substitution line, e.g. "T = 2π√(0.5/20) = 0.993 s". */
  substitutedTex?: string;
}

export function FormulaCard({ f }: { f: DisplayedFormula }) {
  const { isBookmarked, toggleBookmark } = useAppData();
  const bookmarked = f.id ? isBookmarked(f.id) : false;
  return (
    <div className="eq-block">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <MathTex tex={f.tex} display />
        </div>
        {f.id && (
          <button
            type="button"
            className="btn ghost sm icon-only"
            aria-label={bookmarked ? `Remove ${f.id} from bookmarked formulas` : 'Bookmark this formula'}
            aria-pressed={bookmarked}
            title={bookmarked ? 'Bookmarked' : 'Bookmark formula'}
            onClick={() => toggleBookmark(f.id as string)}
          >
            {bookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          </button>
        )}
      </div>
      {f.variables && f.variables.length > 0 && (
        <div className="eq-vars">
          {f.variables.map((v) => (
            <div key={v.sym + v.name} style={{ display: 'contents' }}>
              <span className="v-sym">
                <MathTex tex={v.sym} />
              </span>
              <span className="v-name">{v.name}</span>
              <span className="v-unit">{v.unit}</span>
            </div>
          ))}
        </div>
      )}
      {f.substitutedTex && (
        <div className="eq-substituted">
          <MathTex tex={f.substitutedTex} />
        </div>
      )}
      {f.caption && <div className="eq-caption">{f.caption}</div>}
    </div>
  );
}

export function FormulaPanel({ items }: { items: DisplayedFormula[] }) {
  return (
    <div>
      {items.map((f, i) => (
        <FormulaCard key={f.id ?? i} f={f} />
      ))}
    </div>
  );
}
