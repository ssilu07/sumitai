import { normalizeTechnicalTranscript } from './phoneticNormalizer';

export interface SavedQA {
  id: string;
  category: string;
  question: string;
  matchPatterns: (string | RegExp)[];
  keywords: string[];
  bullets: string[];
}

export const KOTLIN_QA_BANK: SavedQA[] = [
  // ==========================================
  // 1. KOTLIN BASICS
  // ==========================================
  {
    id: 'kotlin-vs-java',
    category: 'Kotlin Basics',
    question: 'What are the main differences between Kotlin and Java?',
    matchPatterns: [
      /kotlin (and|vs|versus) java/i,
      /difference between kotlin and java/i,
      /why kotlin over java/i,
      /advantages of kotlin/i,
    ],
    keywords: ['Null Safety', 'Conciseness', 'Coroutines', 'Smart Cast', 'No Checked Exceptions'],
    bullets: [
      '**Null Safety**: Kotlin enforces nullability at compile-time (`String` vs `String?`), eliminating `NullPointerException` (NPE) crashes common in Java.',
      '**Conciseness & Boilerplate**: Replaces Java boilerplate with **data classes**, properties (getters/setters auto-generated), and type inference (`val`/`var`).',
      '**First-Class Concurrency**: Built-in **Coroutines** for asynchronous programming compared to heavy OS threads or RxJava in Java.',
      '**Modern OOP Features**: Offers **Extension functions**, **Smart casts** (no explicit casting after `is`), and removes forced checked exceptions.',
    ],
  },
  {
    id: 'val-vs-var',
    category: 'Kotlin Basics',
    question: 'What is the difference between val and var?',
    matchPatterns: [
      /val (and|vs|versus) var/i,
      /difference between val and var/i,
      /what is val/i,
      /what is var\b/i,
    ],
    keywords: ['val (Immutable reference)', 'var (Mutable reference)', 'Thread-safety'],
    bullets: [
      '**`val` (Value)**: Read-only reference (similar to `final` in Java). Cannot be reassigned once initialized.',
      '**`var` (Variable)**: Mutable reference. Can be reassigned to a new value of the same type at any time.',
      '**Reference vs State**: `val` only makes the reference immutable, not the object state itself (e.g. `val list = mutableListOf(1, 2)` allows adding items).',
      '**Best Practice**: Prefer `val` by default for immutability, predictability, and safer multithreading.',
    ],
  },
  {
    id: 'lateinit',
    category: 'Kotlin Basics',
    question: 'What is lateinit and when do you use it?',
    matchPatterns: [
      /lateinit/i,
      /lit in it/i,
      /late in it/i,
      /lay tonight/i,
      /late in id/i,
      /late initialization/i,
      /when to use lateinit/i,
      /isinitialized/i,
    ],
    keywords: ['lateinit', 'Non-null var', 'Dependency Injection', 'isInitialized'],
    bullets: [
      '**Definition**: Used on non-null `var` properties to postpone initialization to a later lifecycle stage without making the type nullable.',
      '**Compiler Contract**: Informs compiler the property will be initialized before first access; throws `UninitializedPropertyAccessException` if read prematurely.',
      '**Strict Restrictions**: Only works with mutable `var`, cannot be used on primitives (`Int`, `Boolean`), and cannot be nullable (`Type?`).',
      '**Common Use Cases**: Dagger/Hilt `@Inject` fields and Android lifecycle initialization (`ViewBinding` in `onCreate`). Use `::property.isInitialized` for safe checks.',
    ],
  },
  {
    id: 'lazy-delegation',
    category: 'Kotlin Basics',
    question: 'What is lazy delegation and how does it work?',
    matchPatterns: [
      /\blazy\b/i,
      /lazy delegation/i,
      /by lazy/i,
      /lateinit vs lazy/i,
    ],
    keywords: ['by lazy', 'Synchronized', 'Read-only val', 'Thread safety mode'],
    bullets: [
      '**Definition**: A property delegate (`by lazy { ... }`) that defers computation until the property is first accessed, then caches the result.',
      '**val Only**: Applies strictly to read-only `val` properties because the initialized value cannot be reassigned.',
      '**Thread-Safety Modes**: Default is `LazyThreadSafetyMode.SYNCHRONIZED` (thread-safe lock); can use `PUBLICATION` or `NONE` for single-thread optimization.',
      '**Use Case**: Heavy initializations (e.g. Database singletons, heavy cryptographic keys, regex compilation).',
    ],
  },
  {
    id: 'const-val-vs-val',
    category: 'Kotlin Basics',
    question: 'What is the difference between const val and val?',
    matchPatterns: [
      /const val (vs|versus|and) val/i,
      /const vs val/i,
      /compile-time constant/i,
    ],
    keywords: ['const val', 'Compile-time', 'Runtime evaluation', 'Primitives/String only'],
    bullets: [
      '**`const val`**: Compile-time constant. Value must be known at compile-time. Value is inlined directly into bytecode at call sites.',
      '**`val`**: Runtime constant / read-only property. Can be assigned the result of any runtime function or constructor.',
      '**Allowed Scope**: `const val` is allowed only at top-level or inside an `object` / `companion object`, restricted to primitives and `String`.',
      '**Bytecode Difference**: `const val` generates no getter method; `val` generates a backing field and getter.',
    ],
  },
  {
    id: 'object-keyword',
    category: 'Kotlin Basics',
    question: 'What is an object in Kotlin?',
    matchPatterns: [
      /object in kotlin/i,
      /object keyword/i,
      /singleton in kotlin/i,
    ],
    keywords: ['Singleton', 'Thread-safe', 'Anonymous Object', 'Companion Object'],
    bullets: [
      '**Singleton Declaration**: `object DataManager { ... }` creates a thread-safe, lazily initialized singleton out of the box without boilerplate.',
      '**Companion Object**: Placed inside a class to define factory methods or static-like members tied to the class.',
      '**Anonymous Object Expressions**: `object : CustomCallback { ... }` replaces Java anonymous inner classes for ad-hoc interface implementations.',
    ],
  },
  {
    id: 'companion-object',
    category: 'Kotlin Basics',
    question: 'What is a companion object in Kotlin?',
    matchPatterns: [
      /companion object/i,
      /static in kotlin/i,
      /alternative to static/i,
    ],
    keywords: ['companion object', '@JvmStatic', 'Factory Pattern', 'Class-level scope'],
    bullets: [
      '**Concept**: Kotlin has no `static` keyword; `companion object` defines members tied to the class rather than instances.',
      '**Actual Runtime Object**: Unlike Java static, it is a real object instance at runtime and can implement interfaces.',
      '**Java Interop**: Annotate methods with `@JvmStatic` or fields with `@JvmField` so Java callers can invoke them as genuine `public static` members.',
      '**Primary Use Case**: Factory methods (`newInstance()`, `create()`) and constants.',
    ],
  },
  {
    id: 'data-class',
    category: 'Kotlin Basics',
    question: 'What is a data class and what functions does it auto-generate?',
    matchPatterns: [
      /data class/i,
      /auto.*generated.*data class/i,
      /componentN/i,
    ],
    keywords: ['data class', 'equals/hashCode', 'copy()', 'componentN()', 'toString()'],
    bullets: [
      '**Definition**: Designed purely to hold data/state. Primary constructor must have at least one parameter marked `val` or `var`.',
      '**Auto-Generated Methods**: `equals()`, `hashCode()`, `toString()`, `copy()`, and `componentN()` (destructuring).',
      '**Immutability with `copy()`**: Enables creating a modified copy while keeping the original object immutable (`user.copy(age = 26)`).',
      '**Restrictions**: Cannot be `open`, `abstract`, `sealed`, or `inner`. Only primary constructor properties are included in generated methods.',
    ],
  },
  {
    id: 'structural-vs-referential-equality',
    category: 'Kotlin Basics',
    question: 'What is the difference between == and === in Kotlin?',
    matchPatterns: [
      /== (and|vs|versus) ===/i,
      /double equals vs triple equals/i,
      /structural vs referential equality/i,
    ],
    keywords: ['== (Structural)', '=== (Referential)', 'equals()', 'Memory Address'],
    bullets: [
      '**`==` (Structural Equality)**: Checks value equivalence. Internally translates to `a?.equals(b) ?: (b === null)`. Safe against nulls.',
      '**`===` (Referential Equality)**: Checks memory identity. Returns `true` only if both references point to the exact same object in heap memory.',
    ],
  },
  {
    id: 'any-unit-nothing',
    category: 'Kotlin Basics',
    question: 'What are Any, Unit, and Nothing in Kotlin?',
    matchPatterns: [
      /any.*unit.*nothing/i,
      /what is any/i,
      /what is unit/i,
      /what is nothing/i,
    ],
    keywords: ['Any (Root type)', 'Unit (void object)', 'Nothing (Never returns)'],
    bullets: [
      '**`Any`**: The root of the Kotlin class hierarchy (like `java.lang.Object`). Every non-nullable type inherits from `Any`.',
      '**`Unit`**: Equivalent to Java `void`, but is a real singleton object. Returned implicitly when a function has no meaningful return value.',
      '**`Nothing`**: Represents a value that never exists. The bottom type of all Kotlin types. Used for functions that never return normally (e.g. infinite loop or always throws an exception).',
    ],
  },
  {
    id: 'is-as-smart-cast',
    category: 'Kotlin Basics',
    question: 'What are is, as, and Smart Cast in Kotlin?',
    matchPatterns: [
      /\bis\b.*as operator/i,
      /smart cast/i,
      /safe cast/i,
      /as\? operator/i,
    ],
    keywords: ['is (instanceof)', 'as (Unsafe cast)', 'as? (Safe cast)', 'Smart Cast'],
    bullets: [
      '**`is` Operator**: Type check operator (equivalent to `instanceof` in Java).',
      '**Smart Cast**: Once checked with `is`, compiler automatically casts the variable inside that branch without explicit casting.',
      '**`as` vs `as?`**: `as` is an unsafe cast (`ClassCastException` on failure); `as?` is a safe cast that returns `null` if the cast fails.',
    ],
  },
  {
    id: 'typealias',
    category: 'Kotlin Basics',
    question: 'What is typealias in Kotlin?',
    matchPatterns: [
      /typealias/i,
    ],
    keywords: ['typealias', 'Readability', 'Function Types', 'Zero Runtime Overhead'],
    bullets: [
      '**Definition**: Provides an alternate readable name for an existing long or complex type signature.',
      '**Zero Overhead**: Does not create a new type; during compilation, all aliases are completely replaced with the underlying type.',
      '**Common Use Cases**: Function types (`typealias OnUserClick = (User, Int) -> Unit`) and nested generic collections.',
    ],
  },

  // ==========================================
  // 2. NULL SAFETY
  // ==========================================
  {
    id: 'null-safety-core',
    category: 'Null Safety',
    question: 'How does Kotlin achieve null safety?',
    matchPatterns: [
      /null safety/i,
      /how kotlin achieves null safety/i,
      /billion dollar mistake/i,
    ],
    keywords: ['Compile-time check', 'Non-nullable', 'Nullable T?', 'Zero Runtime Overhead'],
    bullets: [
      '**Type System Enforcement**: Kotlin divides types at compile time into Non-Nullable (`String`) and Nullable (`String?`).',
      '**Compile-Time Guarantees**: Prevents assigning `null` to non-nullable types and disallows direct method calls on nullable types without safe operators.',
      '**Eliminates NPEs**: Stops the "Billion Dollar Mistake" before code runs, ensuring zero runtime overhead.',
    ],
  },
  {
    id: 'safe-call-and-elvis',
    category: 'Null Safety',
    question: 'What are the Safe Call (?.) and Elvis (?:) operators?',
    matchPatterns: [
      /safe call/i,
      /elvis operator/i,
      /\?\..*\?:/i,
      /nested null check/i,
    ],
    keywords: ['?. (Safe call)', '?: (Elvis fallback)', 'Early Return', 'Null Propagation'],
    bullets: [
      '**Safe Call (`?.`)**: Executes the property/method only if the target is non-null. If null, short-circuits and returns `null` safely.',
      '**Elvis Operator (`?:`)**: Provides a default fallback value if the left expression evaluates to null: `val len = name?.length ?: 0`.',
      '**Early Return Idiom**: Frequently used for guard clauses: `val user = fetchUser() ?: return`.',
      '**Chaining**: Nested calls like `user?.profile?.address?.city` safely collapse deep Java `if != null` trees into one line.',
    ],
  },
  {
    id: 'double-bang-operator',
    category: 'Null Safety',
    question: 'Why is the !! operator dangerous?',
    matchPatterns: [
      /!! operator/i,
      /double bang/i,
      /not-null assertion/i,
    ],
    keywords: ['!! (Not-null assertion)', 'NPE Crash', 'Code Smell', 'Elvis Alternative'],
    bullets: [
      '**Definition**: Not-Null Assertion Operator. Forces the compiler to treat a nullable type as non-nullable.',
      '**Danger**: If the variable evaluates to `null` at runtime, it instantly throws a fatal `NullPointerException`.',
      '**Industry Rule**: Considered a code smell in production apps. Replace with `?.let {}`, Elvis fallback `?:`, or safe checks.',
    ],
  },
  {
    id: 'scope-functions',
    category: 'Null Safety',
    question: 'What is the difference between let, run, apply, also, and with?',
    matchPatterns: [
      /scope functions/i,
      /let.*run.*apply.*also.*with/i,
      /difference between let and apply/i,
      /when to use also/i,
    ],
    keywords: ['let (it, returns result)', 'apply (this, returns object)', 'also (it, returns object)', 'run (this, returns result)', 'with'],
    bullets: [
      '**`apply` (this, returns object)**: Best for object initialization & configuration (e.g. configuring `Intent`, `NotificationCompat.Builder`).',
      '**`let` (it, returns lambda result)**: Used with `?.let` for null checks and transforming data to another type.',
      '**`also` (it, returns object)**: Ideal for side-effects that do not alter the object (logging, debugging, validating).',
      '**`run` (this, returns lambda result)**: Object configuration plus computing and returning a result.',
      '**`with` (this, returns lambda result)**: Non-extension function for calling multiple methods on a non-null receiver object.',
    ],
  },

  // ==========================================
  // 3. FUNCTIONS & OOP
  // ==========================================
  {
    id: 'extension-functions',
    category: 'Functions & OOP',
    question: 'What is an extension function and how does it work internally?',
    matchPatterns: [
      /extension function/i,
      /how extension function works internally/i,
      /bytecode.*extension function/i,
    ],
    keywords: ['Extension Function', 'Static Method Bytecode', 'Receiver Type', 'Static Resolution'],
    bullets: [
      '**Definition**: Enables adding new functions to an existing third-party or framework class without modifying source code or subclassing.',
      '**Internal Bytecode**: Compiler generates a standard `public static final` Java method where the receiver instance is passed as the 1st parameter: `show(View $this$show)`.',
      '**Static Resolution**: Resolved statically at compile time based on the declared type, NOT dynamically via polymorphism.',
      '**Shadowing Rule**: If a member function and an extension function share the exact same signature, the **member function always wins**.',
    ],
  },
  {
    id: 'higher-order-lambda-reference',
    category: 'Functions & OOP',
    question: 'What is a higher-order function, lambda, and function reference?',
    matchPatterns: [
      /higher-order function/i,
      /higher order function/i,
      /function reference/i,
      /what is lambda/i,
    ],
    keywords: ['Higher-Order Function', 'Lambda Expression', 'Function Reference (::)'],
    bullets: [
      '**Higher-Order Function**: A function that takes another function as a parameter or returns a function.',
      '**Lambda**: An anonymous block of code treated as an expression: `{ a, b -> a + b }`.',
      '**Function Reference (`::`)**: Direct reference to an existing named function without lambda wrapping (e.g. `list.map(String::toInt)`).',
    ],
  },
  {
    id: 'inline-noinline-crossinline',
    category: 'Functions & OOP',
    question: 'What are inline, noinline, and crossinline functions?',
    matchPatterns: [
      /inline function/i,
      /noinline/i,
      /crossinline/i,
      /inline.*noinline.*crossinline/i,
    ],
    keywords: ['inline', 'noinline', 'crossinline', 'Non-local return', 'Heap Allocation'],
    bullets: [
      '**`inline`**: Compiler copies the function body and lambda code directly into the call-site, eliminating `Function` object heap allocation and virtual call overhead.',
      '**`noinline`**: In an inline function with multiple lambdas, marks specific lambdas to NOT be inlined (e.g. if storing it in a variable or passing it elsewhere).',
      '**`crossinline`**: Prevents non-local returns when a lambda inside an inline function must be executed from another execution context (e.g. inside a callback or runnable).',
    ],
  },
  {
    id: 'sealed-vs-enum',
    category: 'Functions & OOP',
    question: 'What is a sealed class and how does it compare to an enum?',
    matchPatterns: [
      /sealed class/i,
      /sealed interface/i,
      /enum vs sealed/i,
      /sealed class vs enum/i,
    ],
    keywords: ['Sealed Class', 'Enum', 'Exhaustive When', 'State Modeling', 'Multiple Instances'],
    bullets: [
      '**Sealed Class**: Represents a restricted class hierarchy where all direct subclasses are known at compile time, enabling exhaustive `when` expressions without `else`.',
      '**vs Enum**: Enums have a single static instance per constant with uniform state. Sealed class subclasses can have **multiple instances with custom parameters/state**.',
      '**Best Practice**: Use `sealed interface` for UI State (`Loading`, `Success(val data)`, `Error(val msg)`).',
    ],
  },

  // ==========================================
  // 4. COLLECTIONS
  // ==========================================
  {
    id: 'list-set-map',
    category: 'Collections',
    question: 'What are the differences between List, Set, and Map in Kotlin?',
    matchPatterns: [
      /list.*set.*map/i,
      /difference between list and set/i,
      /list vs mutablelist/i,
    ],
    keywords: ['List (Ordered, duplicates)', 'Set (Unique)', 'Map (Key-Value)', 'Read-Only vs Mutable'],
    bullets: [
      '**List**: Ordered collection with index-based access; duplicates allowed.',
      '**Set**: Unordered collection of strictly unique elements; duplicates rejected.',
      '**Map**: Key-Value pairs; keys are strictly unique, values can duplicate.',
      '**List vs MutableList**: `List` is read-only interface (covariance `out T`); `MutableList` allows modifications (`add()`, `remove()`).',
    ],
  },
  {
    id: 'collection-operators',
    category: 'Collections',
    question: 'What is the difference between map, flatMap, groupBy, and associateBy?',
    matchPatterns: [
      /map vs foreach/i,
      /flatmap/i,
      /groupby.*associateby/i,
      /mapnotnull/i,
      /first vs firstornull/i,
    ],
    keywords: ['map()', 'flatMap()', 'groupBy()', 'associateBy()', 'firstOrNull()'],
    bullets: [
      '**`map` vs `flatMap`**: `map` transforms item 1-to-1; `flatMap` transforms each item into an iterable and flattens them into a single 1D list.',
      '**`groupBy` vs `associateBy`**: `groupBy` produces `Map<Key, List<Value>>`; `associateBy` produces `Map<Key, Value>` (overwrites duplicates).',
      '**`first()` vs `firstOrNull()`**: `first()` throws `NoSuchElementException` if empty/not found; `firstOrNull()` safely returns `null`.',
    ],
  },
  {
    id: 'sequences-performance',
    category: 'Collections',
    question: 'What is a Sequence and how does it optimize a 10 Lakh (1M) items chain?',
    matchPatterns: [
      /sequence/i,
      /assequence/i,
      /list vs sequence/i,
      /10 lakh/i,
      /1 million users/i,
      /intermediate collection/i,
    ],
    keywords: ['Sequence', 'Lazy Evaluation', 'Zero Intermediate Allocations', 'Short-circuiting'],
    bullets: [
      '**Lazy vs Eager**: Standard `List` operations are eager—each step (`filter`, `map`) creates a brand-new intermediate `List` in heap memory.',
      '**Sequence Evaluation**: Evaluates lazily element-by-element (vertical pipeline); zero intermediate collection allocations.',
      '**10 Lakh (1M) Items Scenario**: For large datasets, use `.asSequence().filter { ... }.map { ... }.take(10).toList()` to prevent `OutOfMemoryError` and gain massive CPU/memory speedups.',
      '**When to Avoid**: For tiny lists (< 100 items), Sequence iterator overhead can be slightly slower than eager lists.',
    ],
  },

  // ==========================================
  // 5. COROUTINES
  // ==========================================
  {
    id: 'coroutine-basics-threads',
    category: 'Coroutines',
    question: 'What is a Coroutine and how does it differ from a Thread?',
    matchPatterns: [
      /what is a? coroutine/i,
      /thread (vs|versus|and) coroutine/i,
      /difference between thread and coroutine/i,
    ],
    keywords: ['Lightweight', 'Non-blocking suspension', 'User-space', 'Structured Concurrency'],
    bullets: [
      '**Lightweight**: Coroutines are user-space computations managed at library level; thousands can run concurrently on just a few OS threads without memory exhaustion.',
      '**Non-Blocking**: Suspending a coroutine frees the underlying thread to do other work; threads block the OS thread.',
      '**Memory Footprint**: A thread consumes ~1MB stack memory; a coroutine consumes only a few bytes on the heap.',
      '**Context Switching**: Coroutine resumption is a simple function return (state machine), avoiding heavy OS kernel CPU context switches.',
    ],
  },
  {
    id: 'launch-vs-async',
    category: 'Coroutines',
    question: 'What is the difference between launch and async?',
    matchPatterns: [
      /launch (vs|versus|and) async/i,
      /difference between launch and async/i,
      /what does launch return/i,
      /what does async return/i,
      /await\(\)/i,
    ],
    keywords: ['launch (Job)', 'async (Deferred<T>)', 'await()', 'Fire-and-forget'],
    bullets: [
      '**`launch`**: "Fire and forget" builder. Returns a **`Job`**. Does not return a computation result. Used for side-effects (logging, UI updates).',
      '**`async`**: Used when a **result is required**. Returns a **`Deferred<T>`** (a Job with a result).',
      '**`await()`**: Suspending function called on `Deferred<T>` to fetch the result. Propagates exceptions if the child fails.',
      '**Parallelism**: Use `async` to run multiple network calls in parallel: `val r1 = async { api1() }; val r2 = async { api2() }; awaitAll(r1, r2)`.',
    ],
  },
  {
    id: 'suspend-function-trap',
    category: 'Coroutines',
    question: 'What is a suspend function? Does it automatically run on a background thread?',
    matchPatterns: [
      /suspend function/i,
      /does suspend.*background thread/i,
      /automatically run on background/i,
      /continuation/i,
    ],
    keywords: ['suspend', 'NO background thread by default', 'CPS (Continuation Passing Style)', 'withContext'],
    bullets: [
      '**Definition**: A function that can pause and resume execution without blocking the caller thread. Internally uses **Continuation-Passing Style (CPS)**.',
      '🔥 **Interviewer Trap Answer**: **NO!** A suspend function does NOT automatically run on a background thread. It runs on whatever `CoroutineDispatcher` launched it.',
      '**How to make it background**: Must explicitly specify `withContext(Dispatchers.IO)` inside the function for background execution.',
    ],
  },
  {
    id: 'dispatchers',
    category: 'Coroutines',
    question: 'What are Dispatchers.Main, IO, and Default in Kotlin Coroutines?',
    matchPatterns: [
      /dispatchers/i,
      /dispatchers\.main/i,
      /io vs default/i,
      /withcontext/i,
    ],
    keywords: ['Dispatchers.Main', 'Dispatchers.IO', 'Dispatchers.Default', 'withContext'],
    bullets: [
      '**`Dispatchers.Main`**: Bound to Android UI Thread. For UI interactions, View updates, and lightweight operations.',
      '**`Dispatchers.IO`**: Optimized for blocking disk/network I/O (Retrofit, Room, File writing). Dynamic thread pool growing up to 64 threads.',
      '**`Dispatchers.Default`**: Optimized for CPU-intensive work (JSON parsing, sorting massive lists, image processing). Pool size equals CPU core count.',
      '**`withContext`**: Switches dispatcher safely for a block and returns result without spawning a new coroutine.',
    ],
  },
  {
    id: 'supervisor-job-and-scope',
    category: 'Coroutines',
    question: 'What is the difference between coroutineScope and supervisorScope / SupervisorJob?',
    matchPatterns: [
      /coroutinescope vs supervisorscope/i,
      /supervisorjob/i,
      /structured concurrency/i,
      /exception propagation/i,
    ],
    keywords: ['coroutineScope', 'supervisorScope', 'SupervisorJob', 'Failure Isolation'],
    bullets: [
      '**`coroutineScope`**: Standard scope where failure is bidirectional. If one child throws an unhandled exception, the entire scope and all sibling coroutines are cancelled.',
      '**`supervisorScope` / `SupervisorJob`**: Failure is unidirectional. If one child fails, it does **not** cancel sibling coroutines or the parent.',
      '**Android Real-World**: `viewModelScope` uses `SupervisorJob()` so one failing API call does not terminate other unrelated background tasks.',
    ],
  },
  {
    id: 'cancellation-and-ensure-active',
    category: 'Coroutines',
    question: 'How does Coroutine cancellation work? What is cooperative cancellation?',
    matchPatterns: [
      /coroutine cancellation/i,
      /cooperative cancellation/i,
      /ensureactive/i,
      /isactive/i,
    ],
    keywords: ['Cooperative Cancellation', 'CancellationException', 'ensureActive()', 'yield()'],
    bullets: [
      '**Cooperative Nature**: Cancellation is non-preemptive. Calling `job.cancel()` sets the state to `Cancelling`; code must cooperate to actually stop.',
      '**Suspending Points**: Built-in functions (`delay()`, `yield()`) automatically check for cancellation and throw `CancellationException`.',
      '**CPU Loops**: In tight CPU loops, manually call `ensureActive()` or check `isActive` on each iteration to abort promptly.',
      '**Clean up**: Use `try { ... } finally { withContext(NonCancellable) { ... } }` if close resources must run after cancellation.',
    ],
  },
  {
    id: 'exception-handling-coroutine',
    category: 'Coroutines',
    question: 'How do you handle exceptions in Coroutines and what is CoroutineExceptionHandler?',
    matchPatterns: [
      /coroutine exception handling/i,
      /coroutineexceptionhandler/i,
      /exception in async/i,
      /runblocking/i,
    ],
    keywords: ['CoroutineExceptionHandler', 'try-catch', 'runCatching', 'async exception at await'],
    bullets: [
      '**`CoroutineExceptionHandler`**: A global context element that catches uncaught root exceptions in **`launch`** blocks.',
      '**`async` Exception Trap**: Does NOT trigger `CoroutineExceptionHandler`; instead, the exception is encapsulated inside `Deferred` and thrown when calling `.await()`.',
      '**Why avoid `runBlocking` on Android**: It blocks the current thread entirely. On the Main Thread, it freezes the UI and triggers an **ANR (Application Not Responding)**.',
    ],
  },

  // ==========================================
  // 6. KOTLIN FLOW
  // ==========================================
  {
    id: 'flow-vs-livedata',
    category: 'Flow',
    question: 'What is Kotlin Flow and how does it differ from LiveData?',
    matchPatterns: [
      /flow vs livedata/i,
      /what is flow/i,
      /difference between flow and livedata/i,
    ],
    keywords: ['Kotlin Flow', 'LiveData', 'Cold Streams', 'Thread Flexibility (flowOn)'],
    bullets: [
      '**Flow**: Kotlin-native asynchronous cold data stream supporting rich functional operators (`flatMapLatest`, `debounce`, `combine`).',
      '**LiveData**: Android lifecycle-aware observable data holder restricted to UI thread emissions.',
      '**Threading**: LiveData only runs on Main thread; Flow allows easy thread switching with `.flowOn(Dispatchers.IO)`.',
      '**StateFlow Replacement**: `StateFlow` + `repeatOnLifecycle` is Google’s modern, platform-independent replacement for `LiveData`.',
    ],
  },
  {
    id: 'stateflow-vs-sharedflow',
    category: 'Flow',
    question: 'What is the difference between StateFlow and SharedFlow?',
    matchPatterns: [
      /stateflow vs sharedflow/i,
      /what is stateflow/i,
      /what is sharedflow/i,
      /cold vs hot flow/i,
    ],
    keywords: ['StateFlow (Current state, distinct)', 'SharedFlow (One-off events)', 'Hot Flow', 'replay buffer'],
    bullets: [
      '**`StateFlow`**: Hot stream representing UI **State**. Requires an initial value, holds a `.value` property, and drops duplicate consecutive values (`distinctUntilChanged`).',
      '**`SharedFlow`**: Hot stream representing **Events** (Toasts, Navigation, Snackbars). No initial value required, emits every event without deduplication.',
      '**Cold vs Hot**: Normal Flow is Cold (emits only when collected); StateFlow/SharedFlow are Hot (emit even without active collectors).',
    ],
  },
  {
    id: 'collect-operators-flow',
    category: 'Flow',
    question: 'What are collectLatest, debounce, combine, and zip in Flow?',
    matchPatterns: [
      /collect vs collectlatest/i,
      /collectlatest/i,
      /debounce/i,
      /distinctuntilchanged/i,
      /combine vs zip/i,
      /flatmaplatest/i,
    ],
    keywords: ['collectLatest (Cancels previous)', 'debounce (Search delay)', 'combine (Latest of both)', 'zip (1-to-1)'],
    bullets: [
      '**`collectLatest`**: Cancels ongoing processing if a new value arrives before previous work completes (essential for search queries).',
      '**`debounce(300ms)`**: Filters out rapid bursts (e.g. user typing in search field), emitting only after user pauses.',
      '**`combine` vs `zip`**: `zip` matches emissions 1-to-1; `combine` re-emits whenever *either* flow emits using the latest value of the other.',
      '**`flatMapLatest`**: Cancels previous inner flow whenever the outer flow emits a new key.',
    ],
  },
  {
    id: 'repeat-on-lifecycle',
    category: 'Flow',
    question: 'How do you collect Flow in a lifecycle-aware way with repeatOnLifecycle?',
    matchPatterns: [
      /repeatonlifecycle/i,
      /lifecycle-aware flow/i,
      /collect flow in fragment/i,
      /statein.*sharein/i,
    ],
    keywords: ['repeatOnLifecycle', 'Lifecycle.State.STARTED', 'Prevents Resource Waste', 'stateIn'],
    bullets: [
      '**Problem**: Collecting Flow with plain `lifecycleScope.launch` continues collecting in the background even when app is hidden, wasting battery/CPU.',
      '**`repeatOnLifecycle(STARTED)`**: Suspends and stops collecting when UI drops below `STARTED` (background), and automatically restarts when UI returns to foreground.',
      '**`stateIn(SharingStarted.WhileSubscribed(5000))`**: Keeps upstream flow active for 5s after UI rotation to prevent restarting network/DB queries during configuration changes.',
    ],
  },

  // ==========================================
  // 7. ANDROID SCENARIO QUESTIONS
  // ==========================================
  {
    id: 'viewmodel-api-repository-flow',
    category: 'Android Scenarios',
    question: 'How do you handle API calls, Repository pattern, and UI State with Sealed Interface?',
    matchPatterns: [
      /api call in viewmodel/i,
      /repository pattern/i,
      /uistate sealed interface/i,
      /loading.*success.*error/i,
    ],
    keywords: ['Sealed Interface UiState', 'Repository SSoT', 'MutableStateFlow', 'UDF (Unidirectional Data Flow)'],
    bullets: [
      '**Sealed Interface**: Define explicit states: `sealed interface UiState { data object Loading: UiState; data class Success(val data: List<T>): UiState; data class Error(val msg: String): UiState }`.',
      '**Repository**: Acts as Single Source of Truth; fetches from Retrofit on `Dispatchers.IO`, writes to Room cache, emits Result.',
      '**ViewModel**: Exposes immutable `StateFlow<UiState>` via `_uiState.asStateFlow()` triggered inside `viewModelScope.launch`.',
      '**UI Exhaustiveness**: Compose or Fragment collects state and handles all 3 branches in a clean `when (state)` block.',
    ],
  },
  {
    id: 'config-change-viewmodel-scope',
    category: 'Android Scenarios',
    question: 'How is data preserved across configuration changes and what happens to coroutines on Activity destroy?',
    matchPatterns: [
      /configuration change/i,
      /viewmodelscope lifecycle/i,
      /activity destroy.*coroutine/i,
      /fragment lifecycle coroutine/i,
    ],
    keywords: ['ViewModel retention', 'SavedStateHandle', 'viewModelScope onCleared', 'viewLifecycleOwner'],
    bullets: [
      '**Configuration Change**: ViewModel survives Activity recreation; coroutines in `viewModelScope` **continue running** uninterrupted.',
      '**Activity Destroy**: When Activity finishes permanently, `ViewModel.onCleared()` triggers and automatically cancels `viewModelScope`.',
      '**Process Death**: For low-memory process kills, use **`SavedStateHandle`** to persist critical IDs and query strings.',
      '**Fragments**: Always use `viewLifecycleOwner.lifecycleScope` to avoid leaks after `onDestroyView()`.',
    ],
  },
  {
    id: 'memory-leaks-context-weakreference',
    category: 'Android Scenarios',
    question: 'What causes memory leaks in Android/Kotlin and why is storing Context in a singleton dangerous?',
    matchPatterns: [
      /memory leak/i,
      /context in singleton/i,
      /weakreference/i,
      /prevent memory leak/i,
    ],
    keywords: ['Activity Context Leak', 'ApplicationContext', 'WeakReference', 'LeakCanary'],
    bullets: [
      '**Context in Singleton Trap**: Holding an `Activity Context` inside a Singleton prevents GC from reclaiming the entire Activity and view hierarchy on finish, causing a massive memory leak.',
      '**Fix**: Always pass `context.applicationContext` to singletons or dependency injection singletons.',
      '**WeakReference**: Allows Garbage Collector to reclaim referenced object during next GC pass if no strong references exist.',
      '**Best Practices**: Clear ViewBinding in `onDestroyView()`, cancel jobs, unregister broadcast listeners, and verify with LeakCanary.',
    ],
  },

  // ==========================================
  // 9. ADVANCED KOTLIN
  // ==========================================
  {
    id: 'delegated-properties-by-keyword',
    category: 'Advanced Kotlin',
    question: 'What are delegated properties and how does the "by" keyword work?',
    matchPatterns: [
      /delegated propert/i,
      /\bby keyword\b/i,
      /property delegation/i,
      /class delegation/i,
    ],
    keywords: ['Property Delegation', 'Class Delegation', 'getValue / setValue', 'by keyword'],
    bullets: [
      '**Property Delegation**: Delegates getter/setter logic to a separate handler providing `getValue()` and `setValue()` operators (`val p by Delegate()`).',
      '**Class Delegation**: Implements interface by delegating all methods to an existing instance: `class MyList<T>(inner: List<T>) : List<T> by inner` (zero-boilerplate Decorator Pattern).',
      '**Internal `by lazy`**: Creates a `SynchronizedLazyImpl` holding `_value`. On first access, executes lambda in synchronized lock and caches the result.',
    ],
  },
  {
    id: 'generics-variance-in-out',
    category: 'Advanced Kotlin',
    question: 'What is Variance in Kotlin Generics? What do in and out mean?',
    matchPatterns: [
      /variance/i,
      /in and out/i,
      /covariant.*contravariant/i,
      /list<out t>/i,
      /pecs/i,
    ],
    keywords: ['Declaration-site variance', 'out (Covariant - Producer)', 'in (Contravariant - Consumer)', 'PECS'],
    bullets: [
      '**`out` (Covariance)**: Produces items of type `T` (Read-only). Subtype relationship preserved (`List<Dog>` can be assigned to `List<Animal>`). Producer extends `T`.',
      '**`in` (Contravariance)**: Consumes items of type `T` (Write-only). Subtype relationship inverted (`Comparable<Animal>` can be assigned to `Comparable<Dog>`). Consumer super `T`.',
      '**`List<out T>`**: Kotlin `List` is strictly read-only, which makes it covariant by design.',
    ],
  },
  {
    id: 'reified-type-parameters',
    category: 'Advanced Kotlin',
    question: 'What is a reified type parameter and when do you use inline + reified?',
    matchPatterns: [
      /reified/i,
      /type erasure/i,
      /inline.*reified/i,
      /gson.*fromjson/i,
    ],
    keywords: ['reified', 'Type Erasure Bypass', 'inline function', 'T::class.java'],
    bullets: [
      '**Problem (Type Erasure)**: JVM erases generic type parameters at runtime, making `T::class.java` impossible in standard generic functions.',
      '**Solution (`reified`)**: Combined with `inline`, compiler injects exact class bytecode at the call site, allowing runtime access to `T::class.java`.',
      '**Use Case Example**: Clean JSON deserialization without passing `Class<T>` manually: `inline fun <reified T> Gson.fromJson(json: String): T = fromJson(json, T::class.java)`.',
    ],
  },
  {
    id: 'jvmstatic-jvmfield-interop',
    category: 'Advanced Kotlin',
    question: 'What do @JvmStatic and @JvmField do and how does Kotlin-Java interoperability work?',
    matchPatterns: [
      /jvmstatic/i,
      /jvmfield/i,
      /kotlin java interop/i,
    ],
    keywords: ['@JvmStatic', '@JvmField', 'JVM Bytecode', '100% Interoperable'],
    bullets: [
      '**`@JvmStatic`**: Generates genuine `public static` Java methods inside companion objects, allowing Java callers to use `Class.method()` directly.',
      '**`@JvmField`**: Instructs compiler to expose a property as a public field without generating getters/setters.',
      '**Bytecode Interop**: Both compile to standard JVM `.class` bytecode, ensuring seamless 100% two-way interoperability between Kotlin and Java.',
    ],
  },
];

/**
 * Normalizes query string for fuzzy and keyword matching
 */
function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?!.,;:()'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Searches the pre-saved Kotlin Q&A bank.
 * Returns match instantaneously (0ms) if question is recognized.
 */
export function findInstantAnswer(rawQuery: string): SavedQA | null {
  if (!rawQuery || rawQuery.trim().length < 3) return null;

  const phoneticCleaned = normalizeTechnicalTranscript(rawQuery);
  const normalizedRaw = normalizeQuery(rawQuery);
  const normalizedCleaned = normalizeQuery(phoneticCleaned);

  // 1. Check Regex / MatchPatterns first against raw, phoneticCleaned, and normalized forms
  for (const qa of KOTLIN_QA_BANK) {
    for (const pattern of qa.matchPatterns) {
      if (typeof pattern === 'string') {
        const lower = pattern.toLowerCase();
        if (normalizedCleaned.includes(lower) || normalizedRaw.includes(lower)) return qa;
      } else if (
        pattern.test(rawQuery) ||
        pattern.test(phoneticCleaned) ||
        pattern.test(normalizedCleaned) ||
        pattern.test(normalizedRaw)
      ) {
        return qa;
      }
    }
  }

  // 2. Keyword score matching for conversational variations
  let bestMatch: SavedQA | null = null;
  let highestScore = 0;

  for (const qa of KOTLIN_QA_BANK) {
    let score = 0;
    for (const keyword of qa.keywords) {
      const cleanKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanKeyword.length > 2 && (normalizedCleaned.includes(cleanKeyword) || normalizedRaw.includes(cleanKeyword))) {
        score += 2;
      }
    }
    if (score > highestScore && score >= 2) {
      highestScore = score;
      bestMatch = qa;
    }
  }

  return bestMatch;
}
