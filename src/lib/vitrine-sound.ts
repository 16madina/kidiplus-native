import { useEffect, useState } from "react";

/** TikTok-style: start muted, first tap/swipe unlocks sound for the session. */
let soundOn = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getVitrineSoundOn(): boolean {
  return soundOn;
}

export function setVitrineSoundOn(on: boolean) {
  soundOn = on;
  notify();
}

export function unlockVitrineSound() {
  if (soundOn) return;
  setVitrineSoundOn(true);
}

/** Returns [muted, toggleMuted]. */
export function useVitrineSound(): [boolean, () => void] {
  const [on, setOn] = useState(soundOn);
  useEffect(() => {
    const h = () => setOn(soundOn);
    listeners.add(h);
    return () => {
      listeners.delete(h);
    };
  }, []);
  return [!on, () => setVitrineSoundOn(!soundOn)];
}
