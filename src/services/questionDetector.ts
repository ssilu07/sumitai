import { LanguageMode } from '../types';

const FILLER_PHRASES = new Set([
  'yeah',
  'yes',
  'yep',
  'nope',
  'no',
  'ok',
  'okay',
  'sure',
  'right',
  'got it',
  'i see',
  'hmm',
  'cool',
  'thanks',
  'thank you',
  'hello',
  'hi',
  'hey',
  'bye',
  'goodbye',
  'sounds good',
  'alright',
  'uh',
  'um',
  'ah',
  'makes sense',
  'make sense',
  'got it thanks',
  'perfect',
  'great',
  'awesome',
  'carry on',
  'go ahead',
  'continue',
  'exactly',
  'fair enough',
  'understood',
  'no problem',
  'sounds great',
  'nice',
  'good',
  'very good',
  'okay got it',
  'ok got it',
  'yeah okay',
  'yes okay',
  'sure thing',
  'thank you so much',
]);

const ENGLISH_QUESTION_STARTERS = [
  'what',
  'why',
  'how',
  'when',
  'where',
  'who',
  'which',
  'whom',
  'whose',
  'can you',
  'could you',
  'would you',
  'will you',
  'tell me',
  'explain',
  'describe',
  'walk me',
  'elaborate',
  'give me an example',
  'difference between',
  'compare',
  'contrast',
  'pros and cons',
  'tradeoffs',
  'is there',
  'are there',
  'do you know',
  'have you',
  'did you',
  'design',
  'implement',
  'write a',
  'solve',
  'create a',
  'how to',
  'what is',
  'what are',
  'how do',
  'how does',
  'why do',
  'why does',
  'vs',
  'versus',
  'difference',
  // Android & Kotlin Core Concepts
  'stateflow',
  'sharedflow',
  'recomposition',
  'coroutines',
  'jetpack compose',
  'koin',
  'hilt',
  'dagger',
  'clean architecture',
  'mvvm',
  'mvi',
  'room database',
  'launchedeffect',
  'remembersaveable',
  'viewmodel',
  'lifecycle',
  'flow',
  'livedata',
  'retrofit',
  'workmanager',
  'broadcastreceiver',
  'service',
  'intent',
  'activity',
  'fragment',
  'modifier',
  'side effect',
  'disposableeffect',
  'coroutine scope',
  'dispatchers',
  'ktor',
  'unit test',
  'compose navigation',
  'navigation component',
  'paging 3',
  'data binding',
  'view binding',
];

const HINDI_QUESTION_STARTERS = [
  'kya',
  'kaise',
  'kyu',
  'kyun',
  'batao',
  'bataiye',
  'explain karo',
  'samjhao',
  'kaunsa',
  'difference kya',
  'karna hai',
  'use kiya',
  'kya hota',
  'kaise kaam',
  'kab use',
  'kaise use',
  'kaise work',
  'kya hai',
  'kya difference',
  'क्या',
  'कैसे',
  'क्यों',
  'बताओ',
  'बताइए',
  'समझाओ',
  'अंतर',
  'डिफरेंस',
];

function getQuestionStarters(lang: LanguageMode = 'en'): string[] {
  if (lang === 'en') {
    return ENGLISH_QUESTION_STARTERS;
  }
  return [...ENGLISH_QUESTION_STARTERS, ...HINDI_QUESTION_STARTERS];
}

/**
 * Checks whether an utterance has substantive content (not merely conversational filler).
 */
export function isSubstantiveTurn(text: string): boolean {
  if (!text) return false;
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim();

  if (cleaned.length < 4) return false;
  if (FILLER_PHRASES.has(cleaned)) return false;

  return true;
}

/**
 * Detects if an utterance is explicitly phrased as a question (strict mode for candidate speech).
 */
export function isExplicitQuestion(text: string, lang: LanguageMode = 'en'): boolean {
  if (!text || text.trim().length < 4) return false;
  const trimmed = text.trim().toLowerCase();

  if (trimmed.includes('?')) return true;

  const starters = getQuestionStarters(lang);
  for (const starter of starters) {
    if (trimmed.startsWith(starter) || trimmed.includes(` ${starter} `)) {
      return true;
    }
  }

  return false;
}

/**
 * Detects if an utterance is phrased as a question, technical prompt, or problem statement.
 */
export function isQuestionOrPrompt(text: string, lang: LanguageMode = 'en'): boolean {
  if (!isSubstantiveTurn(text)) return false;

  const trimmed = text.trim().toLowerCase();

  // 1. Explicit question mark
  if (trimmed.includes('?')) return true;

  // 2. Starts with or includes any common interview question or prompt phrase
  const starters = getQuestionStarters(lang);
  for (const starter of starters) {
    if (trimmed.startsWith(starter) || trimmed.includes(` ${starter} `)) {
      return true;
    }
  }

  // 3. Substantive query length (> 20 characters) that is not a casual comment
  if (
    trimmed.length >= 20 &&
    !trimmed.startsWith('i think') &&
    !trimmed.startsWith('in my opinion') &&
    !trimmed.startsWith('i worked on') &&
    !trimmed.startsWith('so basically')
  ) {
    return true;
  }

  return false;
}

/**
 * Extracts clean technical question intent from conversational speech
 * (e.g. "Hello Sumit what is Kotlin explain ahdbh etc" -> "what is Kotlin explain")
 */
export function extractCoreQuestion(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText.trim();

  // Strip conversational greeting prefixes like "hello sumit", "hey sumit", "hi", "so basically"
  cleaned = cleaned.replace(/^(hello|hi|hey|ok|okay|so|yes|yeah|sure)\s+(sumit|candidate|there)?\s*,?\s*/i, '');
  cleaned = cleaned.replace(/^(can you|could you|would you|please|tell me|tell us)\s+/i, '');

  // Strip trailing vocal filler, slips or mumbling (e.g. "ahdbh", "etc", "um", "uh")
  cleaned = cleaned.replace(/\s+(ahdbh|adhb|etc|um+|uh+|er+|ah+|blah blah|so on)\b.*$/i, '');
  cleaned = cleaned.replace(/\s+[a-z]{1,2}$/i, ''); // strip single hanging letters at end

  return cleaned.trim() || rawText.trim();
}

/**
 * Fast check if incoming speech chunk contains strong technical interview question intent
 */
export function hasLiveQuestionIntent(text: string, lang: LanguageMode = 'en'): boolean {
  if (!text || text.trim().length < 8) return false;
  const lower = text.toLowerCase();

  if (lower.includes('?')) return true;

  const starters = getQuestionStarters(lang);
  for (const starter of starters) {
    if (lower.startsWith(starter) || lower.includes(` ${starter} `) || lower.includes(` ${starter}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Stitches together the complete question from recent consecutive speech utterances.
 * Prevents fragmented speech from triggering answers on disconnected trailing pieces.
 */
export function getFullQuestion(
  role: 'interviewer' | 'candidate' | 'system',
  latestTurnText: string,
  transcripts: Array<{ role: string; text: string; timestamp: number }>
): string {
  const now = Date.now();
  const consecutiveTexts: string[] = [];

  // Traverse transcripts backward to gather recent utterances from the same speaker (last 9 seconds)
  for (let i = transcripts.length - 1; i >= 0; i--) {
    const entry = transcripts[i];
    // Stop if the other speaker spoke a substantive statement
    if (entry.role !== role) {
      if (isSubstantiveTurn(entry.text)) {
        break;
      }
      continue;
    }
    // Stop if older than 9 seconds
    if (now - entry.timestamp > 9000) {
      break;
    }
    const t = entry.text.trim();
    if (t.length > 0) {
      consecutiveTexts.unshift(t);
    }
  }

  let full = consecutiveTexts.join(' ').trim();
  const latestTrimmed = (latestTurnText || '').trim();

  if (latestTrimmed) {
    if (!full) {
      full = latestTrimmed;
    } else if (!full.toLowerCase().includes(latestTrimmed.toLowerCase())) {
      full = `${full} ${latestTrimmed}`.trim();
    }
  }

  // Remove duplicate adjacent phrases caused by streaming STT stutter (e.g. "what is what is" -> "what is")
  const cleaned = full.replace(/\b([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+\1\b/gi, '$1');
  return extractCoreQuestion(cleaned || full);
}
