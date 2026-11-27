import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('Measure PWA integration flows', () => {
  beforeEach(() => {
    localStorage.clear();
    let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'color-scheme';
      meta.content = 'light dark';
      document.head.appendChild(meta);
    } else {
      meta.content = 'light dark';
    }
  });

  it('defaults to English UI with 4 instrument tabs and toggles cleanly to Russian', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('tab', { name: 'Ruler' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Angle' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Photo' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Camera' })).toBeInTheDocument();

    await user.click(screen.getByTestId('lang-toggle-btn'));
    expect(screen.getByRole('tab', { name: 'Линейка' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Угломер' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Фото' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Камера' })).toBeInTheDocument();
  });

  it('supports base offset entry, screen chaining, and saving to measurement log', async () => {
    const user = userEvent.setup();
    render(<App />);

    const offsetInput = screen.getByLabelText(/Base Offset/i);
    await user.type(offsetInput, '150');
    expect(screen.getByText(/\+150\.0 mm/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save/i }));
    await user.click(screen.getByTestId('open-history-btn'));
    expect(screen.getByRole('heading', { name: 'Measurement Log' })).toBeInTheDocument();
    expect(screen.getByText(/Base: \+150\.0 mm/)).toBeInTheDocument();
  });

  it('measures car dimensions and 3D perspective wall dimensions in the Photo Studio tab', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('tab', { name: 'Photo' }));
    await user.click(screen.getByRole('button', { name: /Car Blueprint/i }));

    // Car blueprint demo: 660 mm wheel -> 4.52 m x 1.46 m overall box & 2.72 m wheelbase
    const list = screen.getByTestId('photo-measurements-list');
    expect(list).toHaveTextContent('4.52 m × 1.46 m');
    expect(list).toHaveTextContent('2.72 m');

    // Add an extra measurement line dynamically
    await user.click(screen.getByRole('button', { name: /^Line$/i }));
    expect(screen.getAllByLabelText('Measurement label')).toHaveLength(3);

    // Switch to 3D Perspective Wall demo (4-point homography)
    await user.click(screen.getByRole('button', { name: /3D Wall Demo/i }));
    expect(screen.getByTestId('photo-measurements-list')).toHaveTextContent('2.50 m');
    expect(screen.getByTestId('photo-measurements-list')).toHaveTextContent('2.70 m');
  });

  it('switches to Angle and Camera tabs and checks Rangefinder and AR 3D fallback', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('tab', { name: 'Angle' }));
    expect(screen.getByTestId('angle-readout')).toHaveTextContent('0.0°');

    await user.click(screen.getByRole('tab', { name: 'Camera' }));
    expect(screen.getByRole('button', { name: 'Rangefinder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AR 3D (WebXR)' })).toBeInTheDocument();
    expect(screen.getByTestId('trigo-distance')).toHaveTextContent(/\d+\.\d{2} m/);

    await user.click(screen.getByRole('button', { name: 'AR 3D (WebXR)' }));
    expect(screen.getByText(/WebXR immersive-ar is not supported/i)).toBeInTheDocument();
  });

  it('opens Calibration modal and allows selecting an exact device from catalog', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('open-calibration-btn'));
    expect(screen.getByRole('heading', { name: 'Display Calibration' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Device Catalog' }));
    await user.click(screen.getByText(/iPhone 16 Pro \/ 17 \/ 17 Pro/));

    expect(screen.getByTestId('open-calibration-btn')).toHaveTextContent('Calibrated');
  });

  it('toggles color scheme via meta[name="color-scheme"] override', async () => {
    const user = userEvent.setup();
    render(<App />);

    const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')!;
    expect(meta.content).toBe('light dark');

    await user.click(screen.getByTestId('theme-toggle-btn'));
    expect(meta.content).toBe('light');

    await user.click(screen.getByTestId('theme-toggle-btn'));
    expect(meta.content).toBe('light dark');
  });
});
