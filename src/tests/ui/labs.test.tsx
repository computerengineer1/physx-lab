import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsProvider } from '../../state/settings';
import { DataProvider } from '../../state/data';
import { ToastProvider } from '../../components/ui/primitives';
import FlatMirrorLab from '../../modules/image-formation/FlatMirrorLab';
import SphericalMirrorLab from '../../modules/image-formation/SphericalMirrorLab';

function renderWithProviders(ui: ReactNode) {
  return render(
    <SettingsProvider>
      <DataProvider>
        <ToastProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </ToastProvider>
      </DataProvider>
    </SettingsProvider>,
  );
}

function measureCard(label: string): HTMLElement {
  const el = screen.getByText(label).closest('.measure');
  if (!el) throw new Error(`measurement card not found for ${label}`);
  return el as HTMLElement;
}

describe('FlatMirrorLab (§36.1)', () => {
  it('computes dᵢ = −dₒ and updates when the object moves', () => {
    renderWithProviders(<FlatMirrorLab />);
    // Default dₒ = 1.20 m ⇒ dᵢ = −1.20 m, m = +1.
    expect(measureCard('Image distance dᵢ').textContent).toContain('-1.20');
    expect(measureCard('Magnification m').textContent).toContain('+1');
    expect(measureCard('Image type').textContent).toContain('virtual');

    const slider = screen.getByRole('slider', { name: /Object distance slider/ });
    fireEvent.change(slider, { target: { value: '2' } });
    expect(measureCard('Object distance dₒ').textContent).toContain('2.00');
    expect(measureCard('Image distance dᵢ').textContent).toContain('-2.00');
    // classification stays virtual/upright — derived, not hardcoded
    expect(measureCard('Orientation').textContent).toContain('upright');
  });

  it('image height follows object height with m = +1', () => {
    renderWithProviders(<FlatMirrorLab />);
    const slider = screen.getByRole('slider', { name: /Object height slider/ });
    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(measureCard('Image height hᵢ').textContent).toContain('0.80');
  });
});

describe('SphericalMirrorLab (§36.2)', () => {
  it('concave default: real inverted reduced image from the mirror equation', () => {
    renderWithProviders(<SphericalMirrorLab />);
    // f = R/2 = 0.30 m, dₒ = 1.00 m ⇒ dᵢ = f·dₒ/(dₒ−f) = 0.30/0.70 = 0.4286 m
    expect(measureCard('f = R/2 (signed)').textContent).toContain('0.30');
    expect(measureCard('Image distance dᵢ').textContent).toContain('0.429');
    // m = −dᵢ/dₒ = −0.4286
    expect(measureCard('Magnification m').textContent).toContain('-0.429');
    expect(measureCard('Nature').textContent).toContain('Real');
    expect(measureCard('Nature').textContent).toContain('inverted');
    expect(measureCard('Nature').textContent).toContain('reduced');
    expect(measureCard('Object zone').textContent).toContain('beyond C');
  });

  it('handles the singular case dₒ = f honestly (image at infinity, no NaN)', () => {
    renderWithProviders(<SphericalMirrorLab />);
    const slider = screen.getByRole('slider', { name: /Object distance slider/ });
    fireEvent.change(slider, { target: { value: '0.3' } });
    expect(measureCard('Image distance dᵢ').textContent).toContain('∞');
    expect(measureCard('Magnification m').textContent).toContain('∞');
    expect(screen.getByText(/Limiting case — object at the focal point/i)).toBeInTheDocument();
    // no NaN/Infinity leaking into any readout
    for (const card of document.querySelectorAll('.measure .m-value')) {
      expect(card.textContent).not.toMatch(/NaN|Infinity(?!\s*\(limit\))/);
      expect(card.textContent).not.toContain('undefined');
    }
  });

  it('inside F: virtual upright magnified (classification derived from values)', () => {
    renderWithProviders(<SphericalMirrorLab />);
    const slider = screen.getByRole('slider', { name: /Object distance slider/ });
    fireEvent.change(slider, { target: { value: '0.15' } });
    // dᵢ = 0.3·0.15/(0.15−0.3) = −0.30 m, m = +2
    expect(measureCard('Image distance dᵢ').textContent).toContain('-0.30');
    expect(measureCard('Magnification m').textContent).toContain('2.00');
    const nature = measureCard('Nature').textContent ?? '';
    expect(nature).toContain('Virtual');
    expect(nature).toContain('upright');
    expect(nature).toContain('magnified');
  });

  it('switching to convex yields virtual upright reduced images for any dₒ', () => {
    renderWithProviders(<SphericalMirrorLab />);
    fireEvent.click(screen.getByRole('button', { name: 'Convex (f < 0)' }));
    const typeCard = screen
      .getAllByText('Mirror type')
      .map((el) => el.closest('.measure'))
      .find(Boolean) as HTMLElement;
    expect(typeCard.textContent).toContain('convex');
    // f = −0.30, dₒ = 1.00 ⇒ dᵢ = (−0.3·1)/(1.3) = −0.2308, m = +0.2308
    expect(measureCard('f = R/2 (signed)').textContent).toContain('-0.30');
    expect(measureCard('Image distance dᵢ').textContent).toContain('-0.231');
    const nature = measureCard('Nature').textContent ?? '';
    expect(nature).toContain('Virtual');
    expect(nature).toContain('upright');
    expect(nature).toContain('reduced');
  });

  it('sign-convention documentation is visible in the model panel', () => {
    renderWithProviders(<SphericalMirrorLab />);
    const header = screen.getByRole('button', { name: /Physical model/ });
    fireEvent.click(header);
    // The accordion body is a sibling of the header inside .accordion.
    const accordion = header.closest('.accordion') as HTMLElement;
    expect(within(accordion).getByText(/real-is-positive/i)).toBeInTheDocument();
    expect(within(accordion).getByText(/Paraxial/i)).toBeInTheDocument();
  });
});
