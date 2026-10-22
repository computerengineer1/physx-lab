import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../../App';

/**
 * Application-level smoke tests (jsdom stand-in for browser checks):
 * startup, navigation to every module, main controls present, 404 handling
 * and "no unexpected console errors" during normal use.
 *
 * Note: full browser-level E2E (Playwright) is not available in this
 * sandbox — see README “Testing” for what these tests cover instead.
 */

const consoleErrors: string[] = [];

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    consoleErrors.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  consoleErrors.length = 0;
});

function expectNoUnexpectedErrors() {
  const unexpected = consoleErrors.filter(
    (e) =>
      !e.includes('Not implemented') && // jsdom gaps (e.g. canvas) are expected & handled
      !e.includes('ReactDOMTestUtils') &&
      !e.includes('act('),
  );
  expect(unexpected).toEqual([]);
}

beforeEach(() => {
  window.location.hash = '#/';
});

async function goto(hash: string) {
  window.location.hash = hash;
  // HashRouter listens to hashchange; give React a tick to process it.
  await new Promise((r) => setTimeout(r, 30));
}

describe('application routes', () => {
  it('boots to the dashboard with brand, hero and module cards', async () => {
    render(<App />);
    expect(await screen.findByText('PHYSX LAB', { selector: '.brand-name' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Course modules/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Oscillatory Motion/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Enter the laboratory/i })).toBeInTheDocument();
    expectNoUnexpectedErrors();
  }, 20000);

  it('navigates to the physics library and lists all syllabus sections', async () => {
    render(<App />);
    await screen.findByText('PHYSX LAB', { selector: '.brand-name' });
    fireEvent.click(screen.getByRole('link', { name: /Physics Library/ }));
    expect(await screen.findByText('All syllabus topics')).toBeInTheDocument();
    // every syllabus section referenced in the course data is reachable
    for (const ref of ['§15.1', '§15.4', '§16.3', '§18.2', '§18.4', '§35.8', '§36.2']) {
      expect(screen.getByText(ref)).toBeInTheDocument();
    }
    // 18.3 is NOT in the syllabus and must not appear anywhere
    expect(screen.queryByText('§18.3')).toBeNull();
    expectNoUnexpectedErrors();
  }, 20000);

  it('loads the spring–mass lab with working fallback, controls and measurements', async () => {
    render(<App />);
    await screen.findByText('PHYSX LAB', { selector: '.brand-name' });
    await goto('#/oscillatory-motion/spring');
    // jsdom has no WebGL ⇒ the honest fallback + full 2D controls must render
    expect(await screen.findByText(/3D graphics are not available/i, undefined, { timeout: 20000 })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /Mass slider/ })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /Spring constant slider/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Play simulation')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument();
    // live measurement from the model: T = 2π√(0.5/20) ≈ 0.993 s
    const card = screen.getByText('Period T').closest('.measure') as HTMLElement;
    expect(card.textContent).toContain('0.993');
    // changing k to 80 ⇒ T = 2π√(0.5/80) ≈ 0.497 s — the number must follow the model
    fireEvent.change(screen.getByRole('slider', { name: /Spring constant slider/ }), {
      target: { value: '80' },
    });
    expect(card.textContent).toContain('0.497');
    expectNoUnexpectedErrors();
  }, 30000);

  it('loads the travelling-wave lab and derives v = fλ', async () => {
    render(<App />);
    await screen.findByText('PHYSX LAB', { selector: '.brand-name' });
    await goto('#/wave-motion/travelling');
    expect(await screen.findByRole('slider', { name: /Frequency slider/ }, { timeout: 20000 })).toBeInTheDocument();
    // defaults: f = 0.8 Hz, λ = 2 m ⇒ v = 1.6 m/s
    const vCard = screen.getByText(/Speed v = fλ/).closest('.measure') as HTMLElement;
    expect(vCard.textContent).toContain('1.60');
    expectNoUnexpectedErrors();
  }, 30000);

  it('loads interference, optics and mirror modules', async () => {
    render(<App />);
    await screen.findByText('PHYSX LAB', { selector: '.brand-name' });

    await goto('#/interference/superposition');
    expect(await screen.findByRole('slider', { name: /Amplitude A₁ slider/ }, { timeout: 20000 })).toBeInTheDocument();

    await goto('#/ray-optics/refraction');
    expect(await screen.findByRole('slider', { name: /Angle of incidence slider/ }, { timeout: 20000 })).toBeInTheDocument();
    // default air→glass 40°: θ₂ = asin(sin40°/1.5) ≈ 25.37°
    const t2 = screen.getByText('θ₂ (from normal)').closest('.measure') as HTMLElement;
    expect(t2.textContent).toContain('25.37');

    await goto('#/image-formation/spherical');
    expect(await screen.findByRole('slider', { name: /Object distance slider/ }, { timeout: 20000 })).toBeInTheDocument();
    expectNoUnexpectedErrors();
  }, 40000);

  it('math toolkit, formulas, experiments, revision and settings pages work', async () => {
    render(<App />);
    await screen.findByText('PHYSX LAB', { selector: '.brand-name' });

    await goto('#/math-review');
    expect(await screen.findByText('Math Toolkit', undefined, { timeout: 20000 })).toBeInTheDocument();

    await goto('#/formulas');
    expect(await screen.findByRole('heading', { name: 'Formula reference' }, { timeout: 20000 })).toBeInTheDocument();
    expect(screen.getByText(/Snell/i)).toBeInTheDocument();

    await goto('#/experiments');
    expect(await screen.findByRole('heading', { name: 'My experiments' }, { timeout: 20000 })).toBeInTheDocument();

    await goto('#/revision');
    expect(await screen.findByRole('heading', { name: 'Revision centre' }, { timeout: 20000 })).toBeInTheDocument();
    for (const clo of ['CLO-1', 'CLO-2', 'CLO-3', 'CLO-4', 'CLO-5']) {
      expect(screen.getAllByText(clo).length).toBeGreaterThan(0);
    }

    await goto('#/settings');
    expect(await screen.findByRole('heading', { name: 'Settings' }, { timeout: 20000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear all local data/i })).toBeInTheDocument();
    expectNoUnexpectedErrors();
  }, 40000);

  it('shows a real 404 page for unknown routes', async () => {
    render(<App />);
    await screen.findByText('PHYSX LAB', { selector: '.brand-name' });
    await goto('#/this-route-does-not-exist');
    expect(await screen.findByText('Page not found', undefined, { timeout: 20000 })).toBeInTheDocument();
    expectNoUnexpectedErrors();
  }, 20000);
});
