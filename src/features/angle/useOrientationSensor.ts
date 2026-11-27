import { useCallback, useEffect, useRef, useState } from 'react';
import { smoothAngleDeg, type OrientationSample } from '../../core/angle/angleMath';

export type SensorPermissionState = 'idle' | 'granted' | 'denied' | 'unsupported';

interface DeviceOrientationEventWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export function needsIosOrientationPermission(): boolean {
  if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
    return false;
  }
  return (
    typeof (DeviceOrientationEvent as unknown as DeviceOrientationEventWithPermission)
      .requestPermission === 'function'
  );
}

export function useOrientationSensor(paused = false) {
  const [sample, setSample] = useState<OrientationSample>({ alpha: 0, beta: 0, gamma: 0 });
  const [hasLiveReading, setHasLiveReading] = useState(false);
  const [simulatorEnabled, setSimulatorEnabled] = useState(false);
  const [permission, setPermission] = useState<SensorPermissionState>(() => {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
      return 'unsupported';
    }
    return needsIosOrientationPermission() ? 'idle' : 'granted';
  });

  const smoothRef = useRef<OrientationSample>({ alpha: 0, beta: 0, gamma: 0 });
  const initializedRef = useRef(false);

  const requestPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent === 'undefined') {
      setPermission('unsupported');
      return;
    }
    const ctor = DeviceOrientationEvent as unknown as DeviceOrientationEventWithPermission;
    if (typeof ctor.requestPermission === 'function') {
      try {
        const state = await ctor.requestPermission();
        setPermission(state === 'granted' ? 'granted' : 'denied');
      } catch {
        setPermission('denied');
      }
    } else {
      setPermission('granted');
    }
  }, []);

  useEffect(() => {
    if (permission !== 'granted' || simulatorEnabled || paused) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null && e.gamma === null && e.alpha === null) return;
      const raw: OrientationSample = {
        alpha: e.alpha ?? 0,
        beta: e.beta ?? 0,
        gamma: e.gamma ?? 0,
      };

      if (!initializedRef.current) {
        smoothRef.current = raw;
        initializedRef.current = true;
      } else {
        smoothRef.current = {
          alpha: smoothAngleDeg(smoothRef.current.alpha, raw.alpha, 0.25),
          beta: smoothAngleDeg(smoothRef.current.beta, raw.beta, 0.22),
          gamma: smoothAngleDeg(smoothRef.current.gamma, raw.gamma, 0.22),
        };
      }
      setHasLiveReading(true);
      setSample({ ...smoothRef.current });
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [permission, simulatorEnabled, paused]);

  const setSimulatedSample = useCallback((next: Partial<OrientationSample>) => {
    setSimulatorEnabled(true);
    setSample((prev) => ({
      alpha: next.alpha ?? prev.alpha,
      beta: next.beta ?? prev.beta,
      gamma: next.gamma ?? prev.gamma,
    }));
  }, []);

  return {
    sample,
    hasLiveReading,
    permission,
    needsPermissionPrompt: needsIosOrientationPermission() && permission === 'idle',
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : true,
    simulatorEnabled,
    setSimulatorEnabled,
    setSimulatedSample,
    requestPermission,
  };
}
