import { phonemize, toARPABET, toIPA } from "phonemize/all";

export type Viseme = "aa" | "ih" | "ou" | "ee" | "oh" | "sil";

/**
 * Maps a single ARPABET or IPA phoneme token to a VRM Viseme.
 */
export function phonemeToViseme(phoneme: string): Viseme {
  const p = phoneme.toUpperCase().replace(/[012]/g, "").trim();
  if (!p) return "sil";

  switch (p) {
    // Open vowel (father, caught, cut)
    case "AA":
    case "AO":
    case "AH":
    case "ER":
    case "AX":
    case "AXR":
      return "aa";

    // Front high vowel (bit, beat, year)
    case "IH":
    case "IY":
    case "Y":
      return "ih";

    // Rounded high vowel (boot, book, win)
    case "UW":
    case "UH":
    case "W":
      return "ou";

    // Front mid/low vowel (bet, bait, cat, bite)
    case "EH":
    case "EY":
    case "AE":
    case "AY":
      return "ee";

    // Rounded mid vowel (boat, boy, bout)
    case "OW":
    case "OY":
    case "AW":
      return "oh";

    // Bilabial consonants (closed lips)
    case "P":
    case "B":
    case "M":
    case "EM":
      return "sil";

    // Consonants with teeth/tongue neutral opening
    case "F":
    case "V":
    case "TH":
    case "DH":
    case "S":
    case "Z":
    case "SH":
    case "ZH":
    case "CH":
    case "JH":
    case "T":
    case "D":
    case "K":
    case "G":
    case "N":
    case "NG":
    case "L":
    case "R":
    case "HH":
    case "DX":
      return "ih";

    default:
      break;
  }

  // IPA fallback check (lowercase)
  const lower = phoneme.toLowerCase().replace(/[ˈˌ]/g, "").trim();
  if (!lower) return "sil";

  if (/[aɑɒʌä]/.test(lower)) return "aa";
  if (/[iɪjy]/.test(lower)) return "ih";
  if (/[uʊw]/.test(lower)) return "ou";
  if (/[eɛæ]/.test(lower)) return "ee";
  if (/[oɔ]/.test(lower)) return "oh";
  if (/[pbm]/.test(lower)) return "sil";

  return "sil";
}

/**
 * Converts text (multilingual) to an array of ARPABET phoneme tokens.
 */
export function textToPhonemes(text: string): string[] {
  if (!text || !text.trim()) return [];
  const arpabetStr = toARPABET(text);
  return arpabetStr
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Converts text directly into a sequence of VRM Visemes for lip sync.
 */
export function textToVisemes(text: string): Viseme[] {
  const phonemes = textToPhonemes(text);
  return phonemes.map(phonemeToViseme);
}

export { phonemize, toARPABET, toIPA };