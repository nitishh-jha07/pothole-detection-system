// frontend/src/lib/audioAlert.ts
// Native Web Audio API synthesizer for safety alerts - no external audio files or dependencies

let audioCtx: AudioContext | null = null;
let isAudioEnabled: boolean = false;

/**
 * Check if audio alerts are currently enabled.
 */
export function getAudioEnabled(): boolean {
  return isAudioEnabled;
}

/**
 * Enable or disable audio alerts. Must be called from a user gesture (click/toggle)
 * to unlock browser autoplay permissions.
 */
export function setAudioEnabled(enabled: boolean): boolean {
  isAudioEnabled = enabled;
  if (enabled && !audioCtx) {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    } catch (e) {
      console.warn("Web Audio API not supported or blocked in this browser:", e);
    }
  }
  if (enabled && audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch((err) => {
      console.warn("AudioContext resume failed:", err);
    });
  }
  return isAudioEnabled;
}

/**
 * Play an alert chime synthesised on the fly.
 * Severe: two urgent high beeps (880Hz -> 784Hz)
 * Moderate: gentle double chime (659Hz -> 523Hz)
 * Minor: single subtle notification chime (587Hz)
 */
export function playSafetyAlertChime(severity: "Severe" | "Moderate" | "Minor"): void {
  if (!isAudioEnabled || !audioCtx) {
    return;
  }

  try {
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;

    if (severity === "Severe") {
      // Urgent double beep
      playTone(880, now, 0.12, 0.25);
      playTone(784, now + 0.16, 0.18, 0.25);
    } else if (severity === "Moderate") {
      // Moderate warning chime
      playTone(659.25, now, 0.15, 0.18);
      playTone(523.25, now + 0.18, 0.2, 0.18);
    } else {
      // Minor advisory chime
      playTone(587.33, now, 0.2, 0.12);
    }
  } catch (err) {
    // Non-blocking: never let audio errors crash the app
    console.warn("Audio playback suppressed by browser policy:", err);
  }
}

function playTone(freq: number, startTime: number, duration: number, peakVolume: number): void {
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);

  // Smooth attack & release to avoid click/pop
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakVolume, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}
