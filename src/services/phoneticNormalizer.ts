/**
 * Phonetic Normalizer for Technical Android / Kotlin Interview Terminology
 *
 * Speech-to-Text engines (Deepgram, Whisper) often mistake programming
 * jargon for conversational English. This module normalizes ALL known
 * acoustic sound-alikes into exact technical terms.
 */

import { LanguageMode } from '../types';

interface PhoneticRule {
  pattern: RegExp;
  replacement: string;
}

const PHONETIC_RULES: PhoneticRule[] = [

  // ─── COROUTINES ────────────────────────────────────────────────────────────
  // Known Deepgram mishearings: kubernetes, proteins, philippines, cooperating,
  // core routines, corona teens, co routine, corporatines, crew team
  {
    pattern: /\b(kubernetes|proteins|protein|philippines|philippine|cooperating|cooperations|corporatines|core\s*routines?|co\s*routines?|crew\s*team|corona\s*teens?|co\s*rutin|coroutin|cooperouting|corp\s*routines?|pro\s*teens|pro\s*teen|filling\s*pines?|fill\s*a\s*pines?)\b/gi,
    replacement: 'coroutines',
  },
  {
    pattern: /\b(coroutine\s*scope|core\s*routine\s*scope|co\s*routine\s*scope|kubernetes\s*scope)\b/gi,
    replacement: 'coroutineScope',
  },
  {
    pattern: /\b(launch\s*co\s*routine|launch\s*coroutine)\b/gi,
    replacement: 'launch coroutine',
  },

  // ─── LATEINIT ──────────────────────────────────────────────────────────────
  {
    pattern: /\b(lit\s+in\s+it|late\s+in\s+it|lay\s+tonight|late\s+in\s+id|late\s+in\s+if|light\s+in\s+it|late\s+in\s+ed|late\s+init|latin\s+it|layton\s+it|later\s+nit|late\s+knit)\b/gi,
    replacement: 'lateinit',
  },
  {
    pattern: /\bwhat\s+is\s+(lit|late|layton?|latin)\s+in\s+it\b/gi,
    replacement: 'what is lateinit',
  },

  // ─── VAL vs VAR ────────────────────────────────────────────────────────────
  {
    pattern: /\bdifference\s+between\s+(where|val|well|while|vowl|wear|ware|wall)\s+(and|vs|versus|da)\s+(where|var|war|were|bar|wear|ware)\b/gi,
    replacement: 'difference between val and var',
  },
  {
    pattern: /\bwhere\s+(and|vs|versus|da)\s+where\b/gi,
    replacement: 'val vs var',
  },
  {
    pattern: /\b(while|well|fall|vowl|vowel|where|wear|ware|wall)\s+(and|vs|versus|da)\s+(war|were|bar|var|where|wear|ware)\b/gi,
    replacement: 'val vs var',
  },
  {
    pattern: /\bval\s+(and|vs|versus)\s+(war|were|bar|where|wear)\b/gi,
    replacement: 'val vs var',
  },

  // ─── BY LAZY / LAZY DELEGATION ─────────────────────────────────────────────
  {
    pattern: /\b(by\s+lacy|buy\s+lazy|by\s+lacey|bye\s+lazy|by\s+hazy|by\s+daisy)\b/gi,
    replacement: 'by lazy',
  },
  {
    pattern: /\b(lacy\s+delegation|lacey\s+delegation|lazy\s+delegate)\b/gi,
    replacement: 'lazy delegation',
  },

  // ─── CONST VAL ─────────────────────────────────────────────────────────────
  {
    pattern: /\b(cost\s+val|const\s+well|constant\s+val|const\s+wall|cons\s+val)\b/gi,
    replacement: 'const val',
  },

  // ─── COMPANION OBJECT ──────────────────────────────────────────────────────
  {
    pattern: /\b(companion\s+object|company\s+object|companion\s+objects?)\b/gi,
    replacement: 'companion object',
  },
  {
    pattern: /\b(company\s+object|compon\s+object|campaign\s+object)\b/gi,
    replacement: 'companion object',
  },

  // ─── DATA CLASS ────────────────────────────────────────────────────────────
  {
    pattern: /\b(data\s+glass|data\s+clause|database\s+class|dater\s+class)\b/gi,
    replacement: 'data class',
  },

  // ─── SEALED CLASS ──────────────────────────────────────────────────────────
  {
    pattern: /\b(shield\s+class|shielded\s+class|ceiled\s+class|sealed\s+glass|steel\s+class|seal\s+class|feel\s+class)\b/gi,
    replacement: 'sealed class',
  },

  // ─── EXTENSION FUNCTION ────────────────────────────────────────────────────
  {
    pattern: /\b(extension\s+function|extend\s+function|extending\s+function|extent\s+function)\b/gi,
    replacement: 'extension function',
  },
  {
    pattern: /\b(extension\s+functions)\b/gi,
    replacement: 'extension functions',
  },

  // ─── HIGHER ORDER FUNCTION ─────────────────────────────────────────────────
  {
    pattern: /\b(higher\s+order\s+function|higher\s+order\s+functions?|hire\s+order\s+function|hyper\s+order\s+function)\b/gi,
    replacement: 'higher order function',
  },

  // ─── NULL SAFETY / NULLABLE ────────────────────────────────────────────────
  {
    pattern: /\b(null\s+safety|null\s+save|null\s+savvy|no\s+safety)\b/gi,
    replacement: 'null safety',
  },
  {
    pattern: /\b(null\s+able|nullable|not\s+able)\b/gi,
    replacement: 'nullable',
  },

  // ─── SAFE CALL ─────────────────────────────────────────────────────────────
  {
    pattern: /\b(safe\s+call\s+operator|say\s+call|stake\s+call)\b/gi,
    replacement: 'safe call',
  },

  // ─── STATEFLOW ─────────────────────────────────────────────────────────────
  {
    pattern: /\b(stayed\s+flow|state\s+flow|steak\s+flow|stay\s+flow|station\s+flow)\b/gi,
    replacement: 'StateFlow',
  },

  // ─── SHAREDFLOW ────────────────────────────────────────────────────────────
  {
    pattern: /\b(shared\s+flow|share\s+flow|chair\s+flow|sheared\s+flow)\b/gi,
    replacement: 'SharedFlow',
  },

  // ─── VIEWMODEL ─────────────────────────────────────────────────────────────
  {
    pattern: /\b(view\s+modal\s+scope|view\s+model\s+scope)\b/gi,
    replacement: 'viewModelScope',
  },
  {
    pattern: /\b(view\s+modal|view\s+mold|view\s+module)\b/gi,
    replacement: 'ViewModel',
  },

  // ─── LIFECYCLE ─────────────────────────────────────────────────────────────
  {
    pattern: /\b(repeat\s+on\s+life\s+cycle|repeat\s+on\s+lifecycle)\b/gi,
    replacement: 'repeatOnLifecycle',
  },
  {
    pattern: /\b(life\s+cycle\s+scope|lifecycle\s+scope)\b/gi,
    replacement: 'lifecycleScope',
  },
  {
    pattern: /\b(life\s+cycle|life\s+circle)\b/gi,
    replacement: 'lifecycle',
  },

  // ─── REIFIED ───────────────────────────────────────────────────────────────
  {
    pattern: /\b(rarefied|re-ified|ray\s+ified|rayified|re\s+i\s+fied|refried|rife\s+ied)\b/gi,
    replacement: 'reified',
  },

  // ─── TYPEALIAS ─────────────────────────────────────────────────────────────
  {
    pattern: /\b(type\s+a\s+liars|type\s+a\s+lies|type\s+alias|type\s+aliasing|type\s+aliases)\b/gi,
    replacement: 'typealias',
  },

  // ─── ELVIS OPERATOR ────────────────────────────────────────────────────────
  {
    pattern: /\b(alvis|lvis|elvish|elvis)\s+operator\b/gi,
    replacement: 'Elvis operator',
  },

  // ─── SMART CAST ────────────────────────────────────────────────────────────
  {
    pattern: /\b(smart\s+caste|smart\s+casts|smart\s+cast)\b/gi,
    replacement: 'smart cast',
  },

  // ─── SUPERVISOR JOB / SCOPE ────────────────────────────────────────────────
  {
    pattern: /\b(super\s+visor\s+job|supervisor\s+job)\b/gi,
    replacement: 'SupervisorJob',
  },
  {
    pattern: /\b(super\s+visor\s+scope|supervisor\s+scope)\b/gi,
    replacement: 'supervisorScope',
  },

  // ─── WITHCONTEXT / RUNBLOCKING ─────────────────────────────────────────────
  {
    pattern: /\b(with\s+context)\b/gi,
    replacement: 'withContext',
  },
  {
    pattern: /\b(run\s+blocking)\b/gi,
    replacement: 'runBlocking',
  },

  // ─── ENSUREACTIVE ──────────────────────────────────────────────────────────
  {
    pattern: /\b(ensure\s+active|in\s+sure\s+active)\b/gi,
    replacement: 'ensureActive',
  },

  // ─── FLOW OPERATORS ────────────────────────────────────────────────────────
  {
    pattern: /\b(collect\s+latest|collect\s+late\s+test)\b/gi,
    replacement: 'collectLatest',
  },
  {
    pattern: /\b(flat\s+map|flet\s+map|flight\s+map)\b/gi,
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

  // ─── ARCHITECTURE / DI ────────────────────────────────────────────────────
  {
    pattern: /\b(coin\s+di|koin\s+di|coin\s+dependency|coin\s+injection)\b/gi,
    replacement: 'Koin DI',
  },
  {
    pattern: /\b(room\s+database|room\s+dv|room\s+db)\b/gi,
    replacement: 'Room DB',
  },
  {
    pattern: /\b(weak\s+reference|week\s+reference)\b/gi,
    replacement: 'WeakReference',
  },
  {
    pattern: /\b(live\s+data|life\s+data)\b/gi,
    replacement: 'LiveData',
  },
  {
    pattern: /\b(hilt\s+dependency|hilt\s+injection|hill\s+dependency)\b/gi,
    replacement: 'Hilt DI',
  },

  // ─── GARBAGE COLLECTOR ─────────────────────────────────────────────────────
  {
    pattern: /\b(garbage\s+collector|garbage\s+collection|garb\s+collector)\b/gi,
    replacement: 'garbage collector',
  },

  // ─── INLINE FUNCTION ──────────────────────────────────────────────────────
  {
    pattern: /\b(in\s+line\s+function|inline\s+functions?)\b/gi,
    replacement: 'inline function',
  },

  // ─── SUSPEND FUNCTION ──────────────────────────────────────────────────────
  {
    pattern: /\b(suspend\s+functions?|suspended\s+function)\b/gi,
    replacement: 'suspend function',
  },

  // ─── KOTLIN FLOW ───────────────────────────────────────────────────────────
  {
    pattern: /\b(cotton\s+flow|kotel\s+flow|kotlin\s+flo)\b/gi,
    replacement: 'Kotlin Flow',
  },

  // ─── OBJECT KEYWORD ────────────────────────────────────────────────────────
  {
    pattern: /\b(object\s+declaration|object\s+expression)\b/gi,
    replacement: 'object declaration',
  },

  // ─── JETPACK / JETPACK COMPOSE ─────────────────────────────────────────────
  {
    pattern: /\b(jet\s*pack\s+compose|jet-pack\s+compose|jet\s*packed\s+compose|jetpack\s+compose)\b/gi,
    replacement: 'Jetpack Compose',
  },
  {
    pattern: /\b(jet\s*pack|jet-pack|jet\s*packed)\b/gi,
    replacement: 'Jetpack',
  },

  // ─── HILT ──────────────────────────────────────────────────────────────────
  {
    pattern: /\b(hill\s+di|hill\s+dependency|built\s+di|built\s+dependency|hilt\s+dependency\s+injection)\b/gi,
    replacement: 'Hilt DI',
  },
  {
    pattern: /\b(hill\s+annotation|built\s+annotation|hilt\s+annotation)\b/gi,
    replacement: 'Hilt annotation',
  },

  // ─── KOIN ──────────────────────────────────────────────────────────────────
  {
    pattern: /\b(coin\s+dependency|coin\s+inject|quinn\s+di|kwan\s+di|coin\s+module|coin\s+single)\b/gi,
    replacement: 'Koin',
  },
  {
    pattern: /\b(coin\s+and|using\s+coin|with\s+coin)\b/gi,
    replacement: 'Koin',
  },

  // ─── RETROFIT ──────────────────────────────────────────────────────────────
  {
    pattern: /\b(retro\s*fit|retro\s+fit|retro-fit|retrofit\s+client|retrofi[tc])\b/gi,
    replacement: 'Retrofit',
  },

  // ─── MVVM ──────────────────────────────────────────────────────────────────
  {
    pattern: /\b(m\s*v\s*v\s*m|mvem|m-v-v-m|mvvm\s+pattern|mvvm\s+architecture)\b/gi,
    replacement: 'MVVM',
  },
  {
    pattern: /\b(model\s+view\s+view\s+model)\b/gi,
    replacement: 'MVVM',
  },

  // ─── MVI ───────────────────────────────────────────────────────────────────
  {
    pattern: /\b(m\s*v\s*i|m-v-i|mvi\s+pattern|mvi\s+architecture)\b/gi,
    replacement: 'MVI',
  },

  // ─── DATASTORE ─────────────────────────────────────────────────────────────
  {
    pattern: /\b(data\s+store\s+preferences|data\s+store|datastore\s+preference)\b/gi,
    replacement: 'DataStore',
  },

  // ─── WORKMANAGER ───────────────────────────────────────────────────────────
  {
    pattern: /\b(work\s+manager|worker\s+manager|work\s+managment)\b/gi,
    replacement: 'WorkManager',
  },

  // ─── PAGING 3 ──────────────────────────────────────────────────────────────
  {
    pattern: /\b(paging\s+3|paging\s+three|paging\s+library|page\s+ing\s+3)\b/gi,
    replacement: 'Paging 3',
  },

  // ─── NAVIGATION COMPONENT ──────────────────────────────────────────────────
  {
    pattern: /\b(navigation\s+component|navigation\s+graph|nav\s+graph|nav\s+host|nav\s+controller)\b/gi,
    replacement: 'Navigation Component',
  },

  // ─── SUSPEND / SUSPEND FUNCTION ────────────────────────────────────────────
  {
    pattern: /\b(suspended\s+func|suspending\s+function|a\s+suspend)\b/gi,
    replacement: 'suspend function',
  },

  // ─── CLEAN ARCHITECTURE ────────────────────────────────────────────────────
  {
    pattern: /\b(clean\s+architect|clean\s+architectures|clean\s+arch)\b/gi,
    replacement: 'Clean Architecture',
  },

  // ─── DEPENDENCY INJECTION ──────────────────────────────────────────────────
  {
    pattern: /\b(dependency\s+inject|d\s+i\s+pattern|di\s+framework|depend\s+injection)\b/gi,
    replacement: 'Dependency Injection',
  },

  // ─── KOTLIN FLOW ───────────────────────────────────────────────────────────
  {
    pattern: /\b(cotton\s+flow|kotel\s+flow|kotlin\s+flo|kotlin\s+flew)\b/gi,
    replacement: 'Kotlin Flow',
  },

  // ─── LAUNCH (coroutine) ────────────────────────────────────────────────────
  {
    pattern: /\b(lunge\s+coroutine|launch\s+a\s+coroutine|lunched\s+coroutine)\b/gi,
    replacement: 'launch coroutine',
  },

  // ─── ASYNC / AWAIT ─────────────────────────────────────────────────────────
  {
    pattern: /\b(a\s+weight|a\s+wait\s+keyword|async\s+await)\b/gi,
    replacement: 'await',
  },

  // ─── DEFERRED ──────────────────────────────────────────────────────────────
  {
    pattern: /\b(the\s+furred|the\s+ferd|de\s+furred)\b/gi,
    replacement: 'Deferred',
  },

  // ─── CHANNEL ───────────────────────────────────────────────────────────────
  {
    pattern: /\b(channel\s+coroutine|coroutine\s+channel)\b/gi,
    replacement: 'coroutine Channel',
  },

  // ─── NOINLINE / CROSSINLINE ───────────────────────────────────────────────
  {
    pattern: /\b(no\s+in\s+line|know\s+inline|no\s+inline)\b/gi,
    replacement: 'noinline',
  },
  {
    pattern: /\b(cross\s+in\s+line|across\s+inline|across\s+in\s+line|cross\s+inline)\b/gi,
    replacement: 'crossinline',
  },

  // ─── INFIX / TAILREC ────────────────────────────────────────────────────────
  {
    pattern: /\b(in\s+fix|in-fix|in\s+fixed|in\s+facts?)\s+functions?\b/gi,
    replacement: 'infix function',
  },
  {
    pattern: /\b(tail\s+rec|tail\s+wreck|tail\s+rack|tell\s+rec|tail\s+recursion|tailrec)\b/gi,
    replacement: 'tailrec',
  },

  // ─── DEFAULT & NAMED ARGUMENTS ──────────────────────────────────────────────
  {
    pattern: /\b(named?\s+arguments?|name\s+argument)\b/gi,
    replacement: 'named arguments',
  },
  {
    pattern: /\b(default\s+arguments?|defalt\s+arguments?)\b/gi,
    replacement: 'default arguments',
  },

  // ─── ANONYMOUS FUNCTION / LAMBDA ────────────────────────────────────────────
  {
    pattern: /\b(lamda|lamba|lemda)\b/gi,
    replacement: 'lambda',
  },
  {
    pattern: /\b(anonymous\s+func|anon\s+function)\b/gi,
    replacement: 'anonymous function',
  },

  // ─── KOTLIN OOP CONCEPTS ────────────────────────────────────────────────────
  {
    pattern: /\b(shield\s+interface|shielded\s+interface|ceiled\s+interface|seal\s+interface)\b/gi,
    replacement: 'sealed interface',
  },
  {
    pattern: /\b(abstract\s+glass|extract\s+class|obstruct\s+class)\b/gi,
    replacement: 'abstract class',
  },
  {
    pattern: /\b(multiple\s+in\s+heritance|multiple\s+in\s+heritage)\b/gi,
    replacement: 'multiple inheritance',
  },
  {
    pattern: /\b(open\s+key\s*word)\b/gi,
    replacement: 'open keyword',
  },
  {
    pattern: /\b(nest\s+class|nested\s+glass)\b/gi,
    replacement: 'nested class',
  },
  {
    pattern: /\b(in\s+her\s+class|in\s+or\s+class)\b/gi,
    replacement: 'inner class',
  },

  // ─── SCOPE FUNCTIONS ────────────────────────────────────────────────────────
  {
    pattern: /\b(soap\s+functions?|spoke\s+functions?|scoop\s+functions?)\b/gi,
    replacement: 'scope functions',
  },
  {
    pattern: /\b(a\s+play|a\s+ply)\s+function\b/gi,
    replacement: 'apply function',
  },
  {
    pattern: /\b(let\s+use\s+karne\s+ki\s+kya\s+necessity|why\s+use\s+let\s+here)\b/gi,
    replacement: 'why use let here',
  },
];

// ─── DEVANAGARI HINDI TO ROMAN HINGLISH DICTIONARY ───────────────────────────
const DEVANAGARI_PHRASES: [string, string][] = [
  // Multi-word technical concepts
  ['हायर ऑर्डर फंक्शन', 'higher-order function'],
  ['हायर आर्डर फंक्शन', 'higher-order function'],
  ['हायर ऑर्डर फ़ंक्शन', 'higher-order function'],
  ['सील्ड इंटरफ़ेस', 'sealed interface'],
  ['सील्ड इंटरफेस', 'sealed interface'],
  ['एब्सट्रैक्ट क्लास', 'abstract class'],
  ['नेस्टेड क्लास', 'nested class'],
  ['इनर क्लास', 'inner class'],
  ['डेटा क्लास', 'data class'],
  ['सील्ड क्लास', 'sealed class'],
  ['इनम क्लास', 'enum class'],
  ['एनम क्लास', 'enum class'],
  ['इनलाइन फंक्शन', 'inline function'],
  ['इनलाइन फ़ंक्शन', 'inline function'],
  ['एक्सटेंशन फंक्शन', 'extension function'],
  ['एक्सटेंशन फ़ंक्शन', 'extension function'],
  ['स्कोप फंक्शन्स', 'scope functions'],
  ['स्कोप फ़ंक्शंस', 'scope functions'],
  ['स्कोप फंक्शन', 'scope functions'],
  ['स्कोप फ़ंक्शन', 'scope functions'],
  ['जेटपैक कम्पोज़', 'Jetpack Compose'],
  ['जेटपैक कंपोज', 'Jetpack Compose'],
  ['व्यू मॉडल', 'ViewModel'],
  ['स्टेट फ्लो', 'StateFlow'],
  ['शेयर्ड फ्लो', 'SharedFlow'],
  ['रूम डेटाबेस', 'Room DB'],
  ['रूम डीबी', 'Room DB'],
  ['मेमोरी लीक', 'memory leak'],
  ['मल्टीपल इनहेरिटेंस', 'multiple inheritance'],
  ['सस्पेंड फंक्शन', 'suspend function'],
  ['सस्पेंड फ़ंक्शन', 'suspend function'],
  ['बाय लेज़ी', 'by lazy'],
  ['बाय लेजी', 'by lazy'],
  ['कॉन्स्ट वैल', 'const val'],
  ['कंपेनियन ऑब्जेक्ट', 'companion object'],
  ['स्मार्ट कास्ट', 'smart cast'],
  ['नल सेफ्टी', 'null safety'],
  ['नल सेफ़्टी', 'null safety'],
  ['कॉपी मेथड', 'copy method'],

  // Multi-word conversational phrases
  ['क्या होता है', 'kya hota hai'],
  ['क्या होती है', 'kya hota hai'],
  ['क्या होते हैं', 'kya hota hai'],
  ['कैसे काम करता है', 'kaise kaam karta hai'],
  ['कैसे काम करती है', 'kaise kaam karta hai'],
  ['कैसे काम करते हैं', 'kaise kaam karta hai'],
  ['कैसे वर्क करता है', 'kaise work karta hai'],
  ['कैसे वर्क करती है', 'kaise work karta hai'],
  ['अंतर क्या है', 'difference kya hai'],
  ['डिफ़रेंस क्या है', 'difference kya hai'],
  ['डिफरेंस क्या है', 'difference kya hai'],
  ['क्या अंतर है', 'kya difference hai'],
  ['क्या डिफ़रेंस है', 'kya difference hai'],
  ['क्या डिफरेंस है', 'kya difference hai'],
  ['क्यों यूज़ करते हैं', 'kyu use karte hain'],
  ['क्यों उपयोग करते हैं', 'kyu use karte hain'],
  ['कब यूज़ करोगे', 'kab use karoge'],
  ['कब यूज़ करते हैं', 'kab use karoge'],
  ['कैसे हैंडल करोगे', 'kaise handle karoge'],
  ['कैसे डिबग करोगे', 'kaise debug karoge'],
];

const DEVANAGARI_SINGLE_WORDS: [string, string][] = [
  // Technical single words
  ['कौरूटीन्स', 'coroutines'],
  ['कौरूटीन', 'coroutines'],
  ['कोरोटीन्स', 'coroutines'],
  ['कोरोटीन', 'coroutines'],
  ['कोरोटिन', 'coroutines'],
  ['कोरुटीन्स', 'coroutines'],
  ['लैम्ब्डा', 'lambda'],
  ['लैम्बडा', 'lambda'],
  ['रेट्रोफ़िट', 'Retrofit'],
  ['रेट्रोफिट', 'Retrofit'],
  ['डिस्पैचर्स', 'Dispatchers'],
  ['डिस्पैचर', 'Dispatcher'],
  ['वैल', 'val'],
  ['वैर', 'var'],
  ['लेटइनिट', 'lateinit'],
  ['लेटइनित', 'lateinit'],
  ['थ्रेड्स', 'threads'],
  ['थ्रेड', 'thread'],
  ['ऑब्जेक्ट', 'object'],
  ['क्लास', 'class'],
  ['फंक्शन', 'function'],
  ['फ़ंक्शन', 'function'],
  ['मेथड', 'method'],
  ['इंटरफ़ेस', 'interface'],
  ['इंटरफेस', 'interface'],
  ['लेट', 'let'],
  ['रन', 'run'],
  ['अप्लाई', 'apply'],
  ['ऑल्सो', 'also'],
  ['आल्सो', 'also'],
  ['विथ', 'with'],
  ['कॉपी', 'copy'],

  // Conversational single words
  ['क्या', 'kya'],
  ['कैसे', 'kaise'],
  ['और', 'aur'],
  ['यह', 'yeh'],
  ['ये', 'yeh'],
  ['वह', 'woh'],
  ['वो', 'woh'],
  ['में', 'mein'],
  ['से', 'se'],
  ['का', 'ka'],
  ['के', 'ke'],
  ['की', 'ki'],
  ['को', 'ko'],
  ['पर', 'par'],
  ['अगर', 'agar'],
  ['तो', 'toh'],
  ['भी', 'bhi'],
  ['है', 'hai'],
  ['हैं', 'hain'],
  ['था', 'tha'],
  ['थी', 'thi'],
  ['थे', 'the'],
  ['होता', 'hota'],
  ['होती', 'hoti'],
  ['होते', 'hote'],
  ['करना', 'karne'],
  ['करनी', 'karni'],
  ['करने', 'karne'],
  ['करता', 'karta'],
  ['करती', 'karti'],
  ['करते', 'karte'],
  ['सकता', 'sakta'],
  ['सकती', 'sakti'],
  ['सकते', 'sakte'],
  ['चाहिए', 'chahiye'],
  ['अंतर', 'difference'],
  ['डिफरेंस', 'difference'],
  ['डिफ़रेंस', 'difference'],
  ['उपयोग', 'use'],
  ['यूज़', 'use'],
  ['बताओ', 'batao'],
  ['बताइए', 'batao'],
  ['समझाओ', 'samjhao'],
  ['इंटरनली', 'internally'],
  ['काम', 'kaam'],
  ['वर्क', 'work'],
  ['पास', 'pass'],
  ['कॉल', 'call'],
];

const DEVANAGARI_VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah',
};

const DEVANAGARI_MATRAS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', 'ः': 'h',
  'ॅ': 'e', 'ॉ': 'o',
};

const DEVANAGARI_CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f',
};

/**
 * Fallback transliterator for any remaining Devanagari characters
 */
function transliterateRemainingDevanagari(text: string): string {
  let result = '';
  const len = text.length;
  for (let i = 0; i < len; i++) {
    const char = text[i];
    const next = i + 1 < len ? text[i + 1] : '';

    if (DEVANAGARI_VOWELS[char]) {
      result += DEVANAGARI_VOWELS[char];
    } else if (DEVANAGARI_CONSONANTS[char]) {
      const base = DEVANAGARI_CONSONANTS[char];
      if (next === '्') {
        // Halant suppresses implicit vowel
        result += base;
        i++; // skip halant
      } else if (DEVANAGARI_MATRAS[next]) {
        // Matra replaces implicit vowel
        result += base + DEVANAGARI_MATRAS[next];
        i++; // skip matra
      } else if (next >= '\u0900' && next <= '\u097F' && !/[\s.,?!:;]/.test(next) && i + 1 < len - 1) {
        result += base + 'a';
      } else {
        result += base;
      }
    } else if (DEVANAGARI_MATRAS[char]) {
      result += DEVANAGARI_MATRAS[char];
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Transliterates Devanagari Hindi text to natural Roman Hinglish
 */
export function transliterateDevanagariToHinglish(input: string): string {
  if (!/[\u0900-\u097F]/.test(input)) return input;

  let text = input;

  // 1. Multi-word phrases first
  for (const [phrase, repl] of DEVANAGARI_PHRASES) {
    if (text.includes(phrase)) {
      const re = new RegExp(`(^|[^\\u0900-\\u097F])${phrase}(?=[^\\u0900-\\u097F]|$)`, 'gu');
      text = text.replace(re, (_, p1) => p1 + repl);
    }
  }

  // 2. Single words
  for (const [word, repl] of DEVANAGARI_SINGLE_WORDS) {
    if (text.includes(word)) {
      const re = new RegExp(`(^|[^\\u0900-\\u097F])${word}(?=[^\\u0900-\\u097F]|$)`, 'gu');
      text = text.replace(re, (_, p1) => p1 + repl);
    }
  }

  // 3. Fallback character-by-character for any remaining Devanagari
  if (/[\u0900-\u097F]/.test(text)) {
    text = transliterateRemainingDevanagari(text);
  }

  return text;
}

// ─── ACOUSTIC MISHEARING CORRECTIONS FOR HINGLISH ────────────────────────────
const HINGLISH_ACOUSTIC_RULES: PhoneticRule[] = [
  {
    pattern: /\b(cat\s*hotel|care\s*hotel|car\s*hotel|kia\s*hotel)\b/gi,
    replacement: 'kya hota hai',
  },
  {
    pattern: /\bkia\s+hota\s+(hai|he)\b/gi,
    replacement: 'kya hota hai',
  },
  {
    pattern: /\bkya\s+hot\s+hai\b/gi,
    replacement: 'kya hota hai',
  },
  {
    pattern: /\bkya\s+hotay?\b/gi,
    replacement: 'kya hota',
  },
  {
    pattern: /\b(case\s*calm\s*karta|case\s*kam\s*karta|case\s*kaam\s*karta|kasa\s*kam\s*karta|kaise\s*kam\s*karta)\b/gi,
    replacement: 'kaise kaam karta',
  },
  {
    pattern: /\b(case\s*work\s*karta|kasa\s*work\s*karta)\b/gi,
    replacement: 'kaise work karta',
  },
  {
    pattern: /\b(case\s*kaam|case\s*kam|kasa\s*kam)\b/gi,
    replacement: 'kaise kaam',
  },
  {
    pattern: /\b(kya\s*hi\b|kia\s*hai\b|kya\s*he\b)/gi,
    replacement: 'kya hai',
  },
  {
    pattern: /\b(or\s+ya\s+kaise|aur\s+ya\s+kaise|or\s+ye\s+kaise|aur\s+ye\s+kaise)\b/gi,
    replacement: 'aur yeh kaise',
  },
  {
    pattern: /\b(val\s+and\s+war\s+me|val\s+aur\s+war\s+me|val\s+and\s+var\s+me|val\s+aur\s+var\s+me)\b/gi,
    replacement: 'val aur var mein',
  },
  {
    pattern: /\b(kya\s*dif+rence|kya\s*diference)\b/gi,
    replacement: 'kya difference',
  },
  {
    pattern: /\b(q\s+use\s+karte|kyu\s+use\s+krte|kyun\s+use\s+krte)\b/gi,
    replacement: 'kyu use karte',
  },
  {
    pattern: /\b(batau|batayiye|bataye)\b/gi,
    replacement: 'batao',
  },
  {
    pattern: /\b(samjao|samjho)\b/gi,
    replacement: 'samjhao',
  },
];

/**
 * Normalizes acoustic transcription defects, technical terms, and handles language modes:
 * - 'en': Pure English mode. Does NOT apply Hinglish acoustic rewrites (preserves pure English words).
 * - 'hi': Pure Hindi mode. Preserves Hindi words and normalizes embedded technical terms.
 * - 'hinglish': Bilingual mode. Applies transliteration and Hinglish acoustic corrections.
 */
export function normalizeTechnicalTranscript(rawText: string, lang: LanguageMode = 'en'): string {
  if (!rawText || rawText.trim().length === 0) return rawText;

  let text = rawText;

  // 1. English Mode: STRICTLY English.
  // Never turn English sounds into Hinglish phrases (e.g. "car hotel" should NEVER become "kya hota hai").
  if (lang === 'en') {
    for (const { pattern, replacement } of PHONETIC_RULES) {
      text = text.replace(pattern, replacement);
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  // 2. Hindi Mode: Keep Hindi speech clean.
  // Normalize technical programming terms (like coroutines, ViewModel, etc.)
  if (lang === 'hi') {
    for (const { pattern, replacement } of PHONETIC_RULES) {
      text = text.replace(pattern, replacement);
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  // 3. Hinglish Mode: Bilingual code-switching
  text = transliterateDevanagariToHinglish(text);

  for (const { pattern, replacement } of HINGLISH_ACOUSTIC_RULES) {
    text = text.replace(pattern, replacement);
  }

  for (const { pattern, replacement } of PHONETIC_RULES) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/\s+/g, ' ').trim();
}
