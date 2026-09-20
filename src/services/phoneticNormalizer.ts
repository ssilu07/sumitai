/**
 * Phonetic Normalizer for Technical Android / Kotlin Interview Terminology
 *
 * Speech-to-Text engines (Deepgram, Whisper, Google Speech) often mistake programming
 * jargon for conversational English (e.g., "lateinit" -> "lit in it", "late in it", "lay tonight").
 * This module normalizes acoustic sound-alikes into their exact technical terms.
 */

interface PhoneticRule {
  pattern: RegExp;
  replacement: string;
}

const PHONETIC_RULES: PhoneticRule[] = [
  // 1. lateinit & late initialization
  {
    pattern: /\b(lit\s+in\s+it|late\s+in\s+it|lay\s+tonight|late\s+in\s+id|late\s+in\s+if|light\s+in\s+it|late\s+in\s+ed|late\s+init)\b/gi,
    replacement: 'lateinit',
  },
  {
    pattern: /\bwhat\s+is\s+(lit|late)\s+in\s+it\b/gi,
    replacement: 'what is lateinit',
  },

  // 2. val vs var — handles "where and where", "where da where", etc.
  {
    // "difference between where and where" / "difference between val and var"
    pattern: /\bdifference\s+between\s+(where|val|well|while|vowl)\s+(and|vs|versus|da)\s+(where|var|war|were|bar)\b/gi,
    replacement: 'difference between val and var',
  },
  {
    // "where and where" / "where vs where" / "where da where" standalone
    pattern: /\bwhere\s+(and|vs|versus|da)\s+where\b/gi,
    replacement: 'val vs var',
  },
  {
    // "where and val" / "val and where" / "well and war" etc
    pattern: /\b(while|well|fall|vowl|vowel|where)\s+(and|vs|versus|da)\s+(war|were|bar|var|where)\b/gi,
    replacement: 'val vs var',
  },
  {
    pattern: /\bval\s+(and|vs|versus)\s+(war|were|bar|where)\b/gi,
    replacement: 'val vs var',
  },

  // 3. by lazy / lazy delegation
  {
    pattern: /\b(by\s+lacy|buy\s+lazy|by\s+lacey|bye\s+lazy)\b/gi,
    replacement: 'by lazy',
  },
  {
    pattern: /\b(lacy\s+delegation|lacey\s+delegation)\b/gi,
    replacement: 'lazy delegation',
  },

  // 4. const val
  {
    pattern: /\b(cost\s+val|const\s+well|constant\s+val)\b/gi,
    replacement: 'const val',
  },

  // 5. coroutines & coroutine scope
  {
    pattern: /\b(core\s+routine|co\s+routine|crew\s+team|coroutine\s+scope|core\s+routine\s+scope)\b/gi,
    replacement: 'coroutine',
  },

  // 6. StateFlow & SharedFlow
  {
    pattern: /\b(stayed\s+flow|state\s+flow|steak\s+flow)\b/gi,
    replacement: 'StateFlow',
  },
  {
    pattern: /\b(shared\s+flow|share\s+flow)\b/gi,
    replacement: 'SharedFlow',
  },

  // 7. ViewModel & viewModelScope
  {
    pattern: /\b(view\s+modal\s+scope|view\s+model\s+scope)\b/gi,
    replacement: 'viewModelScope',
  },
  {
    pattern: /\b(view\s+modal)\b/gi,
    replacement: 'ViewModel',
  },

  // 8. Lifecycle & repeatOnLifecycle
  {
    pattern: /\b(repeat\s+on\s+life\s+cycle|repeat\s+on\s+lifecycle)\b/gi,
    replacement: 'repeatOnLifecycle',
  },
  {
    pattern: /\b(life\s+cycle\s+scope|lifecycle\s+scope)\b/gi,
    replacement: 'lifecycleScope',
  },

  // 9. reified & type erasure
  {
    pattern: /\b(rarefied|re-ified|ray\s+ified|rayified|re\s+i\s+fied)\b/gi,
    replacement: 'reified',
  },
  {
    pattern: /\b(type\s+a\s+liars|type\s+a\s+lies|type\s+alias|type\s+aliasing)\b/gi,
    replacement: 'typealias',
  },

  // 10. Operators: Elvis, Safe call, Smart cast
  {
    pattern: /\b(alvis|elvis|lvis|elvish)\s+operator\b/gi,
    replacement: 'Elvis operator',
  },
  {
    pattern: /\b(smart\s+caste|smart\s+casts)\b/gi,
    replacement: 'smart cast',
  },

  // 11. Concurrency: SupervisorJob, withContext, runBlocking, ensureActive
  {
    pattern: /\b(super\s+visor\s+job|supervisor\s+job)\b/gi,
    replacement: 'SupervisorJob',
  },
  {
    pattern: /\b(super\s+visor\s+scope|supervisor\s+scope)\b/gi,
    replacement: 'supervisorScope',
  },
  {
    pattern: /\b(with\s+context)\b/gi,
    replacement: 'withContext',
  },
  {
    pattern: /\b(run\s+blocking)\b/gi,
    replacement: 'runBlocking',
  },
  {
    pattern: /\b(ensure\s+active|is\s+active)\b/gi,
    replacement: 'ensureActive',
  },

  // 12. Flow / Collection operators: collectLatest, flatMap, debounce, asSequence
  {
    pattern: /\b(collect\s+latest)\b/gi,
    replacement: 'collectLatest',
  },
  {
    pattern: /\b(flat\s+map)\b/gi,
    replacement: 'flatMap',
  },
  {
    pattern: /\b(map\s+not\s+null)\b/gi,
    replacement: 'mapNotNull',
  },
  {
    pattern: /\b(distinct\s+until\s+changed)\b/gi,
    replacement: 'distinctUntilChanged',
  },
  {
    pattern: /\b(as\s+sequence|assequence)\b/gi,
    replacement: 'asSequence',
  },

  // 13. Classes: sealed class, data class
  {
    pattern: /\b(shield\s+class|shielded\s+class|ceiled\s+class|sealed\s+glass)\b/gi,
    replacement: 'sealed class',
  },

  // 14. Architecture / DI: Koin, Room DB, Retrofit, LiveData
  {
    pattern: /\b(coin\s+di|koin\s+di|coin\s+dependency)\b/gi,
    replacement: 'Koin DI',
  },
  {
    pattern: /\b(room\s+database|room\s+dv)\b/gi,
    replacement: 'Room DB',
  },
  {
    pattern: /\b(weak\s+reference)\b/gi,
    replacement: 'WeakReference',
  },
  {
    pattern: /\b(live\s+data)\b/gi,
    replacement: 'LiveData',
  },
];

/**
 * Normalizes acoustic transcription defects into clean, accurate technical terms
 */
export function normalizeTechnicalTranscript(rawText: string): string {
  if (!rawText || rawText.trim().length === 0) return rawText;

  let text = rawText;
  for (const { pattern, replacement } of PHONETIC_RULES) {
    text = text.replace(pattern, replacement);
  }

  return text;
}
