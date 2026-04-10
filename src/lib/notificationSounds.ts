/**
 * Notification sounds utility
 * Generates and plays notification sounds for different event types
 */

type EventType =
  | "run_started"
  | "run_completed"
  | "run_failed"
  | "step_pending"
  | "step_failed"
  | "schedule_triggered";

interface SoundConfig {
  frequency: number;
  duration: number;
  pattern: number[]; // Pattern of durations for beeps
}

const SOUND_CONFIGS: Record<EventType, SoundConfig> = {
  run_started: {
    frequency: 440, // A4
    duration: 200,
    pattern: [100, 50, 100], // 3 quick beeps
  },
  run_completed: {
    frequency: 523, // C5
    duration: 300,
    pattern: [150, 100, 150], // 3 medium beeps, ascending
  },
  run_failed: {
    frequency: 330, // E4
    duration: 400,
    pattern: [200, 100, 200, 100, 200], // 5 warning beeps
  },
  step_pending: {
    frequency: 440,
    duration: 150,
    pattern: [75, 50, 75],
  },
  step_failed: {
    frequency: 294, // D4
    duration: 300,
    pattern: [150, 75, 150],
  },
  schedule_triggered: {
    frequency: 587, // D5
    duration: 250,
    pattern: [125, 50, 125],
  },
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    const contextClass =
      typeof window !== "undefined"
        ? window.AudioContext || (window as any).webkitAudioContext
        : null;
    if (!contextClass) {
      throw new Error("Web Audio API not supported");
    }
    audioContext = new contextClass();
  }
  return audioContext;
}

function playTone(
  frequency: number,
  duration: number,
  volume: number = 0.3,
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = getAudioContext();

      // Resume audio context if needed (for user interaction requirement)
      if (ctx.state === "suspended") {
        ctx
          .resume()
          .then(() => playTone(frequency, duration, volume))
          .then(resolve);
        return;
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + duration / 1000,
      );

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration / 1000);

      setTimeout(resolve, duration);
    } catch (error) {
      console.warn("Failed to play tone:", error);
      resolve();
    }
  });
}

async function playPattern(
  frequencies: number[],
  pattern: number[],
  volume: number = 0.3,
): Promise<void> {
  for (let i = 0; i < pattern.length; i++) {
    const freq = frequencies[i % frequencies.length];
    await playTone(freq, pattern[i], volume);
    // Small gap between beeps
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export async function playNotificationSound(
  eventType: EventType,
  volume: number = 0.7,
): Promise<void> {
  if (typeof window === "undefined") return;

  const config = SOUND_CONFIGS[eventType];
  if (!config) {
    console.warn("Unknown event type:", eventType);
    return;
  }

  try {
    // Vary frequency slightly for different event types to create a richer sound
    const baseFreq = config.frequency;
    const frequencies = [baseFreq, baseFreq * 1.1, baseFreq * 0.9];

    await playPattern(frequencies, config.pattern, volume * 0.3); // Scale volume for Web Audio
  } catch (error) {
    console.warn("Failed to play notification sound:", error);
  }
}

/**
 * Call once on the first user interaction (click/keydown) to unlock the
 * AudioContext so that subsequent programmatic sounds (e.g. from WebSocket
 * notifications) are allowed by the browser.
 */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  } catch {
    // ignore — audio simply won't play
  }
}

export function isAudioSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    window.AudioContext ||
    (window as any).webkitAudioContext ||
    (navigator as any).mediaDevices
  );
}
