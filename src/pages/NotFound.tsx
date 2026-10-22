import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="panel" style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center' }}>
      <Compass size={34} style={{ color: 'var(--cyan)' }} />
      <h1 style={{ margin: '10px 0 6px' }}>Page not found</h1>
      <p className="prose">
        That route does not exist in PHYSX LAB. The address may be mistyped, or the page may have
        moved.
      </p>
      <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
        <Link to="/" className="btn primary">Back to dashboard</Link>
        <Link to="/library" className="btn ghost">Open the Physics Library</Link>
      </div>
    </div>
  );
}
