import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ParamSlider } from '../../components/controls/ParamSlider';
import { PlaybackToolbar } from '../../components/controls/PlaybackToolbar';
import { PresetBar } from '../../components/controls/PresetBar';
import { useSimClock } from '../../simulation/useSimClock';
import { Chart2D } from '../../components/charts/Chart2D';

function ToolbarHarness() {
  const handle = useSimClock();
  return <PlaybackToolbar handle={handle} scrubMax={10} />;
}

describe('ParamSlider', () => {
  it('slider and numeric input stay synchronized through onChange', () => {
    const onChange = vi.fn();
    render(
      <ParamSlider label="Mass" symbol="m" unit="kg" value={1} min={0} max={10} step={0.1} onChange={onChange} />,
    );
    const slider = screen.getByRole('slider', { name: /Mass slider/ });
    fireEvent.change(slider, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith(5);
    const num = screen.getByLabelText('Mass numeric value in kg');
    expect((num as HTMLInputElement).value).toBe('1.00'); // controlled by prop
  });

  it('rejects non-numeric input with an explanation and keeps the old value', () => {
    const onChange = vi.fn();
    render(
      <ParamSlider label="Mass" unit="kg" value={1} min={0} max={10} step={0.1} onChange={onChange} />,
    );
    const num = screen.getByLabelText('Mass numeric value in kg');
    fireEvent.focus(num);
    fireEvent.change(num, { target: { value: 'abc' } });
    fireEvent.blur(num);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter a finite number/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('clamps out-of-range input and tells the user', () => {
    const onChange = vi.fn();
    render(
      <ParamSlider label="Mass" unit="kg" value={1} min={0} max={10} step={0.1} onChange={onChange} />,
    );
    const num = screen.getByLabelText('Mass numeric value in kg');
    fireEvent.focus(num);
    fireEvent.change(num, { target: { value: '999' } });
    fireEvent.blur(num);
    expect(onChange).toHaveBeenCalledWith(10);
    expect(screen.getByText(/clamped to 10/i)).toBeInTheDocument();
  });

  it('never propagates NaN even when the input is emptied', () => {
    const onChange = vi.fn();
    render(<ParamSlider label="K" value={5} min={0} max={9} step={0.5} onChange={onChange} />);
    const num = screen.getByLabelText('K numeric value');
    fireEvent.focus(num);
    fireEvent.change(num, { target: { value: '' } });
    fireEvent.blur(num);
    expect(onChange).not.toHaveBeenCalled();
    for (const arg of onChange.mock.calls) expect(Number.isFinite(arg[0])).toBe(true);
  });
});

describe('PlaybackToolbar', () => {
  it('play/pause toggle updates accessible state', () => {
    render(<ToolbarHarness />);
    const play = screen.getByLabelText('Play simulation');
    fireEvent.click(play);
    expect(screen.getByLabelText('Pause simulation')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Pause simulation'));
    expect(screen.getByLabelText('Play simulation')).toBeInTheDocument();
  });

  it('reset and single-step buttons are real, working controls', () => {
    render(<ToolbarHarness />);
    fireEvent.click(screen.getByLabelText('Advance one step (1/30 second of simulation time)'));
    fireEvent.click(screen.getByLabelText('Reset simulation time to zero'));
    const readout = screen.getByRole('timer');
    expect(readout.textContent).toBe('0.00 s');
  });

  it('rate buttons announce their pressed state', () => {
    render(<ToolbarHarness />);
    const x2 = screen.getByTitle('Playback rate ×2');
    expect(x2).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(x2);
    expect(x2).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('PresetBar', () => {
  it('applies the full parameter object of a preset', () => {
    const onApply = vi.fn();
    const presets = [
      { id: 'a', label: 'Preset A', params: { m: 2, k: 5 } },
      { id: 'b', label: 'Preset B', params: { m: 7, k: 9 } },
    ];
    render(<PresetBar presets={presets} onApply={onApply} />);
    fireEvent.click(screen.getByText('Preset B'));
    expect(onApply).toHaveBeenCalledWith(presets[1]);
  });
});

describe('Chart2D', () => {
  it('renders a canvas with an accessible summary and survives empty data', () => {
    const { container } = render(
      <Chart2D
        title="Empty test"
        xLabel="x"
        yLabel="y"
        series={() => [{ name: 'none', color: '#fff', data: new Float64Array(0) }]}
        ariaSummary="Empty chart for testing."
      />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveAttribute('aria-label', 'Empty chart for testing.');
  });
});
