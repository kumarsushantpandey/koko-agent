/**
 * SubtitleOverlay
 *
 * Clean Anime Subtitle Component for Koko AI.
 *
 * Architecture:
 * - Powered by SpeechQueue: each speech segment delivers a 2-line dialogue unit and its audio.
 * - Shows exactly 2 lines at a time.
 * - Words brighten word-by-word while that audio is playing.
 * - The 2 lines STAY on screen until that audio is completely finished.
 * - Only when that audio finishes do the next 2 lines appear and play.
 * - No background box, no speaker tag.
 * - Pure anime typography with crisp dark stroke borders.
 */

import { useEffect, useRef, useState } from "react";
import { speechQueue } from "../audio/SpeechQueue";
import type { SpeechSegmentEvent } from "../networking/types";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Time in ms to hold the final lines on screen after all speech ends before fading out. */
const HOLD_AFTER_SPEECH_END_MS = 1500;

/** Duration of the smooth fade-out animation. */
const FADEOUT_MS = 450;

// ─── Helper: Clean subtitle text (strips bracketed tags like [annoyed] and markdown asterisks) ──

function cleanSubtitleText(text: string): string {
  if (!text) return "";
  // Strip any bracketed emotion/action tags, e.g. [annoyed], [happy], [sigh]
  let cleaned = text.replace(/\[[a-zA-Z_\-]+\]/g, "");
  // Strip markdown formatting like *emphasis* -> emphasis, and rogue asterisks
  cleaned = cleaned.replace(/\*+([^*]+)\*+/g, "$1").replace(/\*/g, "");
  return cleaned.trim();
}

// ─── Helper: Format text into at most 2 visual lines ──────────────────────────

function formatTwoLines(text: string): { line1: string[]; line2: string[]; allWords: string[] } {
  const cleaned = cleanSubtitleText(text);
  const allWords = cleaned.split(/\s+/).filter(Boolean);
  if (allWords.length === 0) {
    return { line1: [], line2: [], allWords: [] };
  }

  // If short (<= 8 words), keep on 1 line
  if (allWords.length <= 8) {
    return { line1: allWords, line2: [], allWords };
  }

  // Find best split point near the middle (preferring punctuation breaks)
  const mid = Math.ceil(allWords.length / 2);
  let splitAt = mid;

  for (let i = mid - 2; i <= mid + 2; i++) {
    if (i > 0 && i < allWords.length && /[,.!?]$/.test(allWords[i - 1])) {
      splitAt = i;
      break;
    }
  }

  return {
    line1: allWords.slice(0, splitAt),
    line2: allWords.slice(splitAt),
    allWords,
  };
}

interface SubtitleOverlayProps {
  raised?: boolean;
  enabled?: boolean;
}

export default function SubtitleOverlay({
  raised = false,
  enabled = true,
}: SubtitleOverlayProps) {

  const [line1, setLine1] = useState<string[]>([]);
  const [line2, setLine2] = useState<string[]>([]);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [opacity, setOpacity] = useState(0);

  const totalWordsRef = useRef(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 1. When a new 2-line audio segment begins:
    const unsubStart = speechQueue.onSegmentStart((segment: SpeechSegmentEvent) => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      const formatted = formatTwoLines(segment.text);
      totalWordsRef.current = formatted.allWords.length;
      setLine1(formatted.line1);
      setLine2(formatted.line2);
      setActiveWordIndex(-1);
      setOpacity(1); // 2 lines appear on screen immediately
    });

    // 2. While audio is playing, brighten word-by-word proportional to audio progress:
    const unsubProgress = speechQueue.onSegmentProgress((currentTime, duration) => {
      const prog = Math.min(1, Math.max(0, currentTime / (duration || 1)));
      const count = totalWordsRef.current;
      if (count > 0) {
        const idx = Math.min(count - 1, Math.floor(prog * count));
        setActiveWordIndex(idx);
      }
    });

    // 3. When this segment's audio finishes:
    const unsubEnd = speechQueue.onSegmentEnd(() => {
      // Mark all words in this segment as bright
      setActiveWordIndex(9999);
      // The 2 lines STAY on screen until next segment starts (or allEnd fires)
    });

    // 4. When all speech segments have concluded:
    const unsubAllEnd = speechQueue.onAllSegmentsEnd(() => {
      setActiveWordIndex(9999);

      // Hold on screen, then fade out
      holdTimerRef.current = setTimeout(() => {
        setOpacity(0);
        holdTimerRef.current = setTimeout(() => {
          setLine1([]);
          setLine2([]);
          totalWordsRef.current = 0;
          setActiveWordIndex(-1);
        }, FADEOUT_MS);
      }, HOLD_AFTER_SPEECH_END_MS);
    });

    return () => {
      unsubStart();
      unsubProgress();
      unsubEnd();
      unsubAllEnd();
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  // Don't render if disabled via setting or completely faded and empty
  if (!enabled || (opacity === 0 && line1.length === 0)) {
    return null;
  }

  return (
    <div
      className="anime-subtitle-overlay"
      style={{
        ...styles.container,
        bottom: raised ? "16%" : "8%",
        opacity,
        transition: `opacity ${FADEOUT_MS}ms ease, bottom 0.25s ease`,
      }}
    >
      <div style={styles.textWrapper}>
        {/* Line 1 */}
        {line1.length > 0 && (
          <div style={styles.line}>
            {line1.map((word, idx) => {
              const wordGlobalIdx = idx;
              const isPast = wordGlobalIdx < activeWordIndex;
              const isCurrent = wordGlobalIdx === activeWordIndex;

              let wordStyle = styles.wordUpcoming;
              if (isCurrent) {
                wordStyle = styles.wordActive;
              } else if (isPast) {
                wordStyle = styles.wordSpoken;
              }

              return (
                <span
                  key={`l1-${idx}-${word}`}
                  className={`anime-word ${isCurrent ? "word-speaking" : ""}`}
                  style={{ ...styles.wordBase, ...wordStyle }}
                >
                  {word}{" "}
                </span>
              );
            })}
          </div>
        )}

        {/* Line 2 */}
        {line2.length > 0 && (
          <div style={styles.line}>
            {line2.map((word, idx) => {
              const wordGlobalIdx = line1.length + idx;
              const isPast = wordGlobalIdx < activeWordIndex;
              const isCurrent = wordGlobalIdx === activeWordIndex;

              let wordStyle = styles.wordUpcoming;
              if (isCurrent) {
                wordStyle = styles.wordActive;
              } else if (isPast) {
                wordStyle = styles.wordSpoken;
              }

              return (
                <span
                  key={`l2-${idx}-${word}`}
                  className={`anime-word ${isCurrent ? "word-speaking" : ""}`}
                  style={{ ...styles.wordBase, ...wordStyle }}
                >
                  {word}{" "}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <style>{cssText}</style>
    </div>
  );
}

// ─── Styles & Anime Typography ────────────────────────────────────────────────

const cssText = `
@import url('https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;800;900&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap');

@keyframes anime-speak-pulse {
  0%, 100% {
    text-shadow:
      0 0 10px rgba(255, 61, 139, 0.95),
      0 0 22px rgba(255, 61, 139, 0.8),
      0 0 35px rgba(255, 30, 110, 0.5),
      -2px -2px 0 #0c0211,
       2px -2px 0 #0c0211,
      -2px  2px 0 #0c0211,
       2px  2px 0 #0c0211;
    transform: scale(1.05);
  }
  50% {
    text-shadow:
      0 0 14px rgba(255, 95, 160, 1),
      0 0 28px rgba(255, 61, 139, 0.95),
      0 0 45px rgba(255, 30, 110, 0.7),
      -2px -2px 0 #0c0211,
       2px -2px 0 #0c0211,
      -2px  2px 0 #0c0211,
       2px  2px 0 #0c0211;
    transform: scale(1.08);
  }
}

.anime-word.word-speaking {
  display: inline-block;
  animation: anime-speak-pulse 0.75s ease-in-out infinite;
}
`;

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    bottom: "8%",
    left: "4%",
    right: "4%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 100,
    textAlign: "center",
  },

  textWrapper: {
    maxWidth: "92vw",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  line: {
    fontFamily:
      "'Zen Kaku Gothic New', 'M PLUS Rounded 1c', 'Hiragino Kaku Gothic Pro', sans-serif",
    fontSize: "clamp(1.35rem, 3.2vw, 2.1rem)",
    fontWeight: 900,
    lineHeight: 1.55,
    letterSpacing: "0.03em",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    textAlign: "center",
    WebkitTextStroke: "1.8px #0c0211",
  },

  wordBase: {
    display: "inline",
    transition: "color 0.1s ease, text-shadow 0.1s ease",
  },

  // Upcoming: soft readable white with anime border
  wordUpcoming: {
    color: "rgba(255, 255, 255, 0.65)",
    textShadow: `
      -2px -2px 0 #0c0211,
       2px -2px 0 #0c0211,
      -2px  2px 0 #0c0211,
       2px  2px 0 #0c0211,
       0 3px 6px rgba(0, 0, 0, 0.85)
    `,
  },

  // Spoken: pure bright white with anime border
  wordSpoken: {
    color: "#ffffff",
    textShadow: `
      -2px -2px 0 #0c0211,
       2px -2px 0 #0c0211,
      -2px  2px 0 #0c0211,
       2px  2px 0 #0c0211,
       0 0 8px rgba(255, 180, 220, 0.5),
       0 3px 6px rgba(0, 0, 0, 0.85)
    `,
  },

  // Active: radiant hot-pink with glowing anime aura
  wordActive: {
    color: "#ff3d8b",
  },
};
