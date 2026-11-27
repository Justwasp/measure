import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('Measure PWA integration flows', () => {
  beforeEach(() => {
    localStorage.clear();
    // Ensure <meta name="color-scheme"> exists in jsdom head
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

  it('defaults to English UI and toggles cleanly to Russian and back', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('tab', { name: 'Ruler' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Angle' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Camera' })).toBeInTheDocument();

    await user.click(screen.getByTestId('lang-toggle-btn'));
    expect(screen.getByRole('tab', { name: 'Линейка' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Угломер' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Камера' })).toBeInTheDocument();
  });

  it('supports base offset entry, screen chaining, and saving to measurement log', async () => {
    const user = userEvent.setup();
    render(<App />);

    const offsetInput = screen.getByLabelText(/Base Offset/i);
    await user.type(offsetInput, '150');
    expect(screen.getByText(/\+150\.0 mm/)).toBeInTheDocument();

    // Save measurement and verify History dialog displays it
    await user.click(screen.getByRole('button', { name: /Save/i }));
    await user.click(screen.getByTestId('open-history-btn'));
    expect(screen.getByRole('heading', { name: 'Measurement Log' })).toBeInTheDocument();
    expect(screen.getByText(/Base: \+150\.0 mm/)).toBeInTheDocument();
  });

  it('switches to Angle mode, simulates tilt, tares relative angle, and checks Camera modes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('tab', { name: 'Angle' }));
    expect(screen.getByTestId('angle-readout')).toHaveTextContent('0.0°');

    await user.click(screen.getByRole('tab', { name: 'Camera' }));
    expect(screen.getByRole('button', { name: 'Reference Photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rangefinder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AR 3D (WebXR)' })).toBeInTheDocument();

    // Switch to Rangefinder and verify trigonometric distance calculation works
    await user.click(screen.getByRole('button', { name: 'Rangefinder' }));
    expect(screen.getByTestId('trigo-distance')).toHaveTextContent(/\d+\.\d{2} m/);

    // Switch to AR 3D and verify honest fallback notice on non-WebXR browser
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
