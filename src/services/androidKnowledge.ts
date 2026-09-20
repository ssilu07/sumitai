export interface CandidateProfile {
  name: string;
  title: string;
  totalExperience: string;
  summary: string;
  skills: {
    languages: string[];
    uiFrameworks: string[];
    architecture: string[];
    concurrency: string[];
    storageNetworking: string[];
    toolsTesting: string[];
  };
  experience: Array<{
    role: string;
    company: string;
    period: string;
    highlights: string[];
  }>;
  projects: Array<{
    name: string;
    tech: string;
    description: string;
    bulletPoints: string[];
  }>;
}

export const CANDIDATE_PROFILE: CandidateProfile = {
  name: 'Sumit Singh',
  title: 'Senior Software Engineer — Android Developer',
  totalExperience: '5 Years',
  summary:
    'Android developer with 5 years of production experience building, architecting, and shipping high-performance mobile apps in Kotlin and Jetpack Compose. Experienced across MVVM, Clean Architecture, Coroutines, Flow, Koin DI, offline-first architectures, Room DB, Retrofit, and Play Store releases (apps with 100k+ downloads).',
  skills: {
    languages: ['Kotlin (Expert)', 'Java', 'Dart'],
    uiFrameworks: [
      'Jetpack Compose (Declarative UI, State Hoisting, Recomposition Optimization, Custom Modifiers)',
      'Modern Android UI Design & Material Design 3',
      'XML Layouts, ViewBinding, ConstraintLayout, Custom Views',
    ],
    architecture: [
      'Clean Architecture (Domain, Data, UI Layers)',
      'MVVM (Model-View-ViewModel)',
      'MVI & Unidirectional Data Flow (UDF)',
      'Dependency Injection with Koin (also familiar with Hilt / Dagger)',
    ],
    concurrency: [
      'Kotlin Coroutines (Structured Concurrency, Dispatchers, Exception Handling)',
      'Kotlin Flow (StateFlow, SharedFlow, Cold vs Hot Streams, Operators)',
      'LifecycleScope & ViewModelScope',
    ],
    storageNetworking: [
      'Room Database (Entities, DAOs, Migrations, TypeConverters)',
      'Retrofit 2 & OkHttp (Interceptors, Caching, Token Refresh)',
      'DataStore Preferences & SQLite',
      'Firebase Cloud Firestore, Auth & Cloud Messaging (FCM)',
    ],
    toolsTesting: [
      'Android Studio Profiler (Memory Leaks, CPU, Layout Inspector)',
      'Unit Testing (JUnit, Mockk, Turbine for Flow)',
      'Git, Postman, Google Play Console deployment, ProGuard/R8',
    ],
  },
  experience: [
    {
      role: 'Senior Software Engineer — Android Developer',
      company: 'Define Labs',
      period: 'Jan 2024 – Aug 2026',
      highlights: [
        'Architected and developed production mobile applications using Kotlin and Jetpack Compose.',
        'Built modern UI features using Jetpack Compose and Kotlin, accelerating development velocity.',
        'Engineered custom reusable UI components in Jetpack Compose to optimize layout measure passes and eliminate frame drops.',
        'Designed offline-first storage and sync mechanisms using Room DB and in-app navigation.',
      ],
    },
    {
      role: 'Software Engineer — Android Developer',
      company: 'GlobalLogic (A Hitachi Group Company)',
      period: 'Dec 2021 – Oct 2023',
      highlights: [
        'Developed production mobile applications utilizing Kotlin, Jetpack Compose, and MVVM architecture.',
        'Profiled and optimized application rendering and memory usage, driving a 15% increase in user engagement.',
        'Integrated RESTful APIs, JSON parsing, and third-party libraries.',
        'Implemented full accessibility standards (TalkBack, dynamic scaling) across diverse Android devices.',
      ],
    },
  ],
  projects: [],
};

/**
 * Technical domain keywords for Deepgram Nova-2 speech recognition boosting.
 * Deepgram accepts 'keyword:boost' where boost is an integer (1 to 5).
 */
export const ANDROID_STT_KEYWORDS = [
  'lateinit:2',
  'Kotlin:3',
  'Coroutines:3',
  'StateFlow:3',
  'SharedFlow:3',
  'Jetpack Compose:3',
  'Compose:3',
  'Recomposition:3',
  'ViewModel:3',
  'Koin:3',
  'Hilt:3',
  'Dagger:2',
  'Retrofit:3',
  'Room DB:3',
  'LiveData:2',
  'SupervisorJob:2',
  'Dispatchers:2',
  'Clean Architecture:3',
  'MVVM:3',
  'reified:2',
  'typealias:2',
  'asSequence:2',
  'repeatOnLifecycle:2',
  'viewModelScope:2',
  'withContext:2',
  'runBlocking:2',
];

/**
 * Senior Android Developer System Prompt tailored to Sumit Singh's 5 YOE profile
 */
export const ANDROID_SYSTEM_PROMPT = `Act as an expert real-time technical interview co-pilot for Sumit Singh, a Senior Android Developer with 5 years of professional experience.

CANDIDATE BACKGROUND:
- Name: Sumit Singh | 5 Years Experience as Senior Android Developer
- Companies: Define Labs, GlobalLogic (Hitachi Group - optimized apps for 15% user engagement boost)
- Core Technical Stack: Android SDK, Kotlin, Jetpack Compose, MVVM, Clean Architecture, Kotlin Coroutines, Flow (StateFlow/SharedFlow), Dependency Injection (Koin / Hilt), Room DB, Retrofit, OkHttp.

INTERVIEW GUIDANCE RULES:
1. Provide concise, high-impact bullet points (maximum 3 to 4 bullets). The candidate must be able to glance at them and speak naturally.
2. Bold key technical keywords, architectural patterns, state constructs, and trade-offs (e.g., **StateFlow**, **Recomposition**, **UDF**, **LaunchedEffect**, **Koin**).
3. If asked about experience, past work, or behavioral questions (e.g., "Tell me about yourself", "Tell me about a challenging problem", "Why did you choose Compose over XML?"):
   - Answer directly from Sumit's perspective highlighting 5 years of production Android experience with scalable Clean Architecture, high-performance Jetpack Compose UI, offline-first Room databases, and robust Coroutine/Flow concurrency.
4. If asked Android / Kotlin / Jetpack Compose technical questions:
   - Answer at a SENIOR (5 YOE) level:
   - **Jetpack Compose**: Highlight State Hoisting, Recomposition lifecycle, remember vs rememberSaveable, side-effects (LaunchedEffect, DisposableEffect, SideEffect), derivedStateOf, performance optimization (Stable/Immutable, item keys in LazyColumn).
   - **Kotlin Coroutines & Flow**: Explain Structured Concurrency, Dispatchers (IO vs Default vs Main), exception handling (SupervisorJob, CoroutineExceptionHandler), StateFlow vs SharedFlow vs LiveData.
   - **Architecture & DI**: Detail Clean Architecture layers (UI, Domain Use Cases, Data Repositories), Unidirectional Data Flow (UDF), and Koin/Hilt dependency injection.
   - **Storage & Networking**: Explain Room DB migrations, TypeConverters, Retrofit interceptors, OkHttp caching, and offline-first synchronization.
5. Avoid ANY introductory conversational filler (no "Sure!", "Here is an answer", "As an Android engineer..."). Begin directly with the technical bullets.`;
