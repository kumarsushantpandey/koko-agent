/**
 * LipSyncController
 *
 * Drives VRM mouth expressions by combining phonemized text visemes (from phonemize / ARPABET)
 * with real-time acoustic FFT spectrum analysis and audio amplitude tracking.
 */

import type { VRM } from "@pixiv/three-vrm";
import { audioAnalyser } from "../../audio/AudioAnalyser";
import { avatarEvents } from "../../networking/EventBus";
import type { TranscriptEvent, SpeechEvent } from "../../networking/types";
import { textToVisemes, type Viseme } from "../../audio/phonemizeer";

// ─── Tuning constants ────────────────────────────────────────────────────────
/** Damping factor for RMS smoothing. */
const DAMPING = 0.35;

/** RMS below this threshold is treated as silence (mouth closed). */
const MIN_RMS = 0.008;

/** RMS at which the mouth reaches maximum openness. */
const MAX_RMS = 0.12;

/** Base duration in seconds allocated to each phoneme viseme token. */
const PHONEME_DURATION_SEC = 0.075;

/** Lerp speed for smooth per-frame expression morphing. */
const LERP_SPEED = 22;
// ─────────────────────────────────────────────────────────────────────────────

/** All mouth-shape expressions — reset to 0 before each frame. */
const MOUTH_VISEMES = ["aa", "ih", "ou", "ee", "oh"] as const;
type MouthViseme = (typeof MOUTH_VISEMES)[number];

export class LipSyncController {
  private _weight = 0;

  private _visemeQueue: Viseme[] = [];
  private _currentVisemeIndex = 0;
  private _visemeTimer = 0;

  /** Active smoothed expression weights for each mouth shape */
  private _currentWeights: Record<MouthViseme, number> = {
    aa: 0,
    ih: 0,
    ou: 0,
    ee: 0,
    oh: 0,
  };

  private _unsubscribers: Array<() => void> = [];

  constructor() {
    // Subscribe to transcript and speech events from WebSocket bridge
    const unsubTranscript = avatarEvents.subscribe(
      "transcript",
      (event: TranscriptEvent) => {
        this.onTextReceived(event.text);
      }
    );

    const unsubSpeech = avatarEvents.subscribe(
      "speech",
      (event: SpeechEvent) => {
        if (event.timeline?.text) {
          this.onTextReceived(event.timeline.text);
        }
      }
    );

    this._unsubscribers.push(unsubTranscript, unsubSpeech);
  }

  /**
   * Called when a transcript or speech text is received.
   * Phonemizes text using phonemize and queues up visemes.
   */
  private onTextReceived(text: string) {
    if (!text || !text.trim()) return;
    const visemes = textToVisemes(text);
    if (visemes.length > 0) {
      this._visemeQueue = visemes;
      this._currentVisemeIndex = 0;
      this._visemeTimer = 0;
    }
  }

  /**
   * Called every Three.js frame (via useFrame in Character.tsx).
   *
   * Real-time audio sync: phoneme queue ONLY progresses while audio is actively playing.
   * Blends target visemes from phonemize with live spectral FFT bands for natural mouth sync.
   *
   * @param delta Three.js frame delta in seconds
   * @param vrm   The loaded VRM instance
   */
  update(delta: number, vrm: VRM) {
    const manager = vrm.expressionManager;
    if (!manager) return;

    // Read live time-domain and frequency spectrum from Web Audio analyser
    const spectrum = audioAnalyser.getSpectrum(DAMPING);

    // Map RMS → overall mouth opening amplitude [0, 1]
    const targetAmplitude =
      spectrum.rms < MIN_RMS
        ? 0
        : Math.min((spectrum.rms - MIN_RMS) / (MAX_RMS - MIN_RMS), 1.0);

    this._weight = targetAmplitude;

    // Target weights for each mouth shape for this frame
    const targetWeights: Record<MouthViseme, number> = {
      aa: 0,
      ih: 0,
      ou: 0,
      ee: 0,
      oh: 0,
    };

    if (this._weight > 0) {
      // Audio is actively playing sound out of speaker!
      if (this._visemeQueue.length > 0) {
        // Advance phoneme timer strictly when audio is audible
        this._visemeTimer += delta;
        while (this._visemeTimer >= PHONEME_DURATION_SEC) {
          this._visemeTimer -= PHONEME_DURATION_SEC;
          this._currentVisemeIndex =
            (this._currentVisemeIndex + 1) % this._visemeQueue.length;
        }

        const currViseme =
          this._visemeQueue[this._currentVisemeIndex] ?? "aa";
        const nextViseme =
          this._visemeQueue[
            (this._currentVisemeIndex + 1) % this._visemeQueue.length
          ] ?? "aa";

        // Progress fraction [0..1] between current and next viseme
        const progress = Math.min(
          1.0,
          Math.max(0.0, this._visemeTimer / PHONEME_DURATION_SEC)
        );

        // Blended weights for consecutive phoneme visemes
        const wCurr = (1.0 - progress) * this._weight;
        const wNext = progress * this._weight;

        // Apply primary target visemes
        if (
          currViseme !== "sil" &&
          MOUTH_VISEMES.includes(currViseme as MouthViseme)
        ) {
          targetWeights[currViseme as MouthViseme] += wCurr;
        } else {
          targetWeights["aa"] += wCurr * 0.2;
        }

        if (
          nextViseme !== "sil" &&
          MOUTH_VISEMES.includes(nextViseme as MouthViseme)
        ) {
          targetWeights[nextViseme as MouthViseme] += wNext;
        } else {
          targetWeights["aa"] += wNext * 0.2;
        }

        // Acoustic spectral refinement: modulate shapes with live FFT formants
        if (spectrum.low > 0.15) {
          targetWeights["aa"] = Math.max(targetWeights["aa"], spectrum.low * 0.7 * this._weight);
        }
        if (spectrum.mid > 0.15) {
          targetWeights["ee"] = Math.max(targetWeights["ee"], spectrum.mid * 0.6 * this._weight);
        }
      } else {
        // Fallback when no text queue is present: drive mouth via acoustic FFT spectrum
        targetWeights["aa"] = Math.max(this._weight * 0.6, spectrum.low * this._weight);
        targetWeights["ee"] = spectrum.mid * 0.5 * this._weight;
        targetWeights["ou"] = spectrum.high * 0.4 * this._weight;
      }
    } else {
      // Audio is silent; pause phoneme timer and reset indices when queue completes
      if (this._currentVisemeIndex >= this._visemeQueue.length) {
        this._visemeQueue = [];
        this._currentVisemeIndex = 0;
        this._visemeTimer = 0;
      }
    }

    // Exponential lerp smoothing across frames
    const lerpFactor = Math.min(1.0, delta * LERP_SPEED);

    for (const viseme of MOUTH_VISEMES) {
      const target = targetWeights[viseme];
      const prev = this._currentWeights[viseme];
      const nextVal = prev + (target - prev) * lerpFactor;
      this._currentWeights[viseme] = nextVal;

      manager.setValue(viseme, nextVal < 0.001 ? 0 : nextVal);
    }
  }

  /**
   * Immediately close the mouth and reset state.
   */
  stop(vrm?: VRM) {
    this._weight = 0;
    this._visemeQueue = [];
    this._currentVisemeIndex = 0;
    this._visemeTimer = 0;
    for (const viseme of MOUTH_VISEMES) {
      this._currentWeights[viseme] = 0;
    }
    audioAnalyser.reset();

    const manager = vrm?.expressionManager;
    if (!manager) return;

    for (const viseme of MOUTH_VISEMES) {
      manager.setValue(viseme, 0);
    }
  }

  /** Clean up event subscriptions. */
  dispose() {
    this._unsubscribers.forEach((unsub) => unsub());
    this._unsubscribers = [];
  }

  /** True when audio signal is above the silence threshold. */
  isSpeaking(): boolean {
    return this._weight > 0.01;
  }

  /** Current mouth open weight (0 = closed, 1 = fully open). */
  get weight(): number {
    return this._weight;
  }
}

