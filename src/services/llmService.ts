import { AIProvider, LanguageMode, TranscriptEntry } from '../types';
import { ANDROID_SYSTEM_PROMPT } from './androidKnowledge';

export const DEFAULT_SYSTEM_PROMPT = ANDROID_SYSTEM_PROMPT;

export interface StreamCallbacks {
  onToken: (token: string, accumulatedText: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export function isCodingQuestion(question: string): boolean {
  if (!question) return false;
  const lower = question.toLowerCase();

  if (lower.includes('[kotlin coding mode]')) return true;

  // 1. Classical DSA, algorithm, and coding problem keywords
  const dsaPatterns = [
    /\b(palindrome|ispalindrome|anagram|valid anagram|two sum|three sum|3sum|reverse string|reverse array|reverse words|reverse a (number|string|linked list))\b/i,
    /\b(binary search|quick sort|merge sort|bubble sort|insertion sort|selection sort|heap sort)\b/i,
    /\b(fibonacci|factorial|prime number|armstrong number|odd even|swap (two )?numbers)\b/i,
    /\b(linked list|doubly linked list|lru cache|lfu cache|trie|binary tree|bst|invert tree|level order)\b/i,
    /\b(debounce|throttle|throttlefirst|flatmap|switchmap|assequence|custom modifier|coroutine flow)\b/i,
    /\b(dfs|bfs|sliding window|two pointer|dynamic programming|backtracking|kadane|trapping rain water)\b/i,
    /\b(valid parentheses|merge intervals|longest substring|longest common prefix|climbing stairs|coin change)\b/i,
    /\b(leetcode|hackerrank|coderpad|code signal|geeksforgeeks)\b/i,
  ];

  for (const pattern of dsaPatterns) {
    if (pattern.test(lower)) return true;
  }

  // 2. Questions asking for code, program, or implementation
  if (
    /\b(program|programme|code|coding|implementation|script|snippet)\b/i.test(lower) &&
    /\b(write|create|give|generate|print|show|solve|banao|likho|dikhau|do|ka|ki|ke|in|for|of|to)\b/i.test(lower)
  ) {
    return true;
  }

  // 3. Phrasing like "write a program", "write code", "how to write", "implement a", "write an extension function"
  if (
    /\b(write (a )?(program|code|function|algorithm|solution)|implement (a )?(function|class|method|solution|algorithm)|create (a )?(program|function|code)|solve (this )?(problem|coding|challenge))\b/i.test(lower) ||
    /\b(write|create|implement|give|show)\s+(an?\s+)?(extension function|higher order function|sealed class|singleton|factory|custom view|operator)\b/i.test(lower)
  ) {
    return true;
  }

  // 4. Topic + program / code phrasing (e.g. "extension function program", "sealed class code", "palindrome code")
  if (/\b\w+\s+(program|code|programme|snippet)\b/i.test(lower)) {
    return true;
  }

  // 5. Hindi/Hinglish programming commands
  if (
    /\b(program banao|code likho|program likho|code banao|coding solve karo|program do|code do|kaise likhein|kaise banaye)\b/i.test(lower) ||
    /\b\w+\s+(ka|ki|ke)\s+(program|code)\b/i.test(lower)
  ) {
    return true;
  }

  // 6. Short keyword or topic like "palindrome", "fibonacci", "two sum"
  if (/^(palindrome|fibonacci|factorial|two sum|reverse string|valid anagram|lru cache|binary search)\s*(program|code|function)?$/i.test(lower.trim())) {
    return true;
  }

  return false;
}

function buildQuestionPrompt(question: string, language: LanguageMode = 'en'): string {
  const cleanQ = question.replace('[Kotlin Coding Mode]', '').trim();
  const isCoding = isCodingQuestion(question);

  if (isCoding) {
    return `[CRITICAL INSTRUCTION: STRICT KOTLIN CODING MODE — ZERO THEORETICAL ESSAYS]
Coding Task / Problem: "${cleanQ}"

STRICT COMPLIANCE RULES:
1. ❌ ZERO THEORETICAL DEFINITIONS:
   - DO NOT write a textbook definition or explain what the concept means (e.g. NEVER write "A palindrome is a string that reads the same forwards and backwards...").
   - Jump straight to optimal complexity and the working program.
2. ⏱️ OPTIMAL COMPLEXITY IN BOLD:
   - Start immediately on line 1 with: "**Optimal Time: O(...) | Space: O(...)**".
3. 💻 COMPLETE, FULLY RUNNABLE KOTLIN PROGRAM:
   - Output in a markdown \`\`\`kotlin ... \`\`\` block.
   - Provide clean, production-ready, idiomatic Kotlin (e.g. extension function: \`fun String.isPalindrome(): Boolean\` or optimal class/function).
   - ALWAYS INCLUDE a working \`fun main()\` that tests 3-4 diverse cases (including edge cases like empty string, case sensitivity, punctuation/special characters) and prints results!
   - Write clear, concise inline comments explaining tricky lines.
4. 🎯 ALGORITHM INTUITION & EDGE CASES:
   - In 2-3 crisp bullet points, explain:
     * Core algorithm logic (e.g. two pointers converging from both ends).
     * Handled edge cases (e.g. empty inputs, case insensitivity, non-alphanumeric filtering).
5. 🛡️ STRICTLY IDIOMATIC KOTLIN. Do not use Java or Python.`;
  }

  if (language === 'hi') {
    return `Interview question (asked in Hindi): "${cleanQ}"\n\nAccurately comprehend the Hindi interview question (understanding Hindi / Hinglish terms like 'क्या होता है', 'कैसे काम करता है', 'अंतर क्या है', etc.), and provide the complete structured senior interview answer in professional English following the exact framework so Sumit can answer the interviewer with 100% confidence.`;
  }
  if (language === 'hinglish') {
    return `Interview question (asked in Hinglish / Mixed Hindi-English): "${cleanQ}"\n\nAccurately comprehend the interview query intent, and provide the complete structured senior interview answer in professional English following the exact framework so Sumit can answer the interviewer with 100% confidence.`;
  }
  return `Interview question: "${cleanQ}"\n\nProvide the complete structured senior interview answer following the exact framework.`;
}

async function readWithTimeout<T>(promise: Promise<T>, timeoutMs = 25000): Promise<T> {
  let timer: any;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Stream stalled (no tokens for ${timeoutMs / 1000}s)`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export class LLMService {
  private activeAbortController: AbortController | null = null;

  /**
   * Stream answer generation based on conversation context and latest question
   */
  async streamAnswer(
    question: string,
    transcriptHistory: TranscriptEntry[],
    provider: AIProvider,
    apiKey: string,
    systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
    callbacks: StreamCallbacks,
    modelName?: string,
    fallbackGroqKey?: string,
    language: LanguageMode = 'en'
  ): Promise<void> {
    // Abort previous in-flight generation if a new question is triggered
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    this.activeAbortController = new AbortController();
    const signal = this.activeAbortController.signal;

    try {
      if (provider === 'groq') {
        try {
          await this.streamGroq(question, transcriptHistory, apiKey, systemPrompt, signal, callbacks, modelName, language);
        } catch (groqErr: any) {
          if (groqErr.name === 'AbortError') throw groqErr;
          if (fallbackGroqKey && fallbackGroqKey.trim() !== '') {
            console.warn('[LLMService] Groq error/rate-limit, falling back to Gemini:', groqErr.message);
            await this.streamGemini(question, transcriptHistory, fallbackGroqKey, systemPrompt, signal, callbacks, undefined, language);
          } else {
            throw groqErr;
          }
        }
      } else if (provider === 'gemini') {
        try {
          await this.streamGemini(question, transcriptHistory, apiKey, systemPrompt, signal, callbacks, modelName, language);
        } catch (geminiErr: any) {
          if (geminiErr.name === 'AbortError') throw geminiErr;
          if (fallbackGroqKey && fallbackGroqKey.trim() !== '') {
            console.warn('[LLMService] Gemini error/quota, switching to Groq fallback:', geminiErr.message);
            await this.streamGroq(question, transcriptHistory, fallbackGroqKey, systemPrompt, signal, callbacks, undefined, language);
          } else {
            throw geminiErr;
          }
        }
      } else {
        await this.streamOpenAI(question, transcriptHistory, apiKey, systemPrompt, signal, callbacks, language);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[LLMService] Stream aborted for new incoming query.');
        return;
      }
      console.error('[LLMService] Generation failed:', err);
      callbacks.onError(err);
    } finally {
      if (this.activeAbortController?.signal === signal) {
        this.activeAbortController = null;
      }
    }
  }

  /**
   * Screen Vision AI: Analyze captured screenshot (Meet chat, LeetCode problem, CoderPad)
   * and stream the extracted question + optimal answer.
   */
  async streamVisionAnswer(
    imageDataUrl: string,
    apiKey: string,
    systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
    callbacks: StreamCallbacks
  ): Promise<void> {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    this.activeAbortController = new AbortController();
    const signal = this.activeAbortController.signal;

    try {
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('Please configure a valid Gemini API Key in Settings to use Screen Vision.');
      }

      // Strip data:image/...;base64, prefix
      const match = imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      const mimeType = match ? match[1] : 'image/png';
      const base64Data = match ? match[2] : imageDataUrl;

      if (!base64Data || base64Data.trim().length < 50) {
        throw new Error('Screen capture image is empty or invalid. Please check your screen recording permissions.');
      }

      const promptText = `Carefully inspect this screen capture (which may contain a Google Meet / Zoom / Teams in-call chat message, LeetCode / HackerRank / CoderPad coding challenge, IDE code editor, or technical interview question).

PRIMARY DIRECTIVE:
1. DETECT THE QUESTION / TOPIC:
   - Identify the exact question, problem statement, chat message, or code task shown on screen.
   - State the detected problem title clearly in bold.

2. IF THIS IS A CODING / PROGRAMMING / ALGORITHM / LEETCODE PROBLEM OR ASKS TO WRITE CODE:
   ❌ STRICTLY FORBIDDEN: DO NOT just provide theoretical definitions or bullet point summaries! NEVER output a generic textbook definition of the topic.
   ✅ MANDATORY: YOU MUST PROVIDE THE ACTUAL, WORKING CODE SOLUTION IN KOTLIN!
   - State the optimal Time and Space Complexity in bold: "**Optimal Time: O(...) | Space: O(...)**".
   - Provide the COMPLETE, PRODUCTION-READY, RUNNABLE Kotlin code in a markdown \`\`\`kotlin ... \`\`\` block.
   - Include a working \`fun main()\` with 3-4 test cases (including edge cases) showing example input and expected output.
   - Explain the core algorithm intuition and edge cases in 2-3 crisp bullet points.

3. IF THIS IS A CONCEPTUAL / THEORETICAL / ARCHITECTURAL QUESTION (No code requested):
   - Provide the complete, structured senior interview answer following the framework (1 bold core sentence, production context, core mechanism, production example, key concepts).`;

      const requestBody = {
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: promptText,
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Data.trim(),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          topP: 0.8,
        },
      };

      const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash'];
      let response: Response | null = null;
      let lastError = '';

      for (const model of GEMINI_MODELS) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey.trim()}`;
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal,
          });

          if (res.ok) {
            response = res;
            break;
          } else if (res.status === 404) {
            lastError = await res.text();
            continue; // try next model in fallback list
          } else {
            const errorText = await res.text();
            throw new Error(`Gemini Vision error (${res.status}): ${errorText}`);
          }
        } catch (err: any) {
          if (err.name === 'AbortError') throw err;
          lastError = err.message;
        }
      }

      if (!response) {
        throw new Error(`All Gemini models failed. Last response: ${lastError}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Vision error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Gemini response returned empty stream body.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await readWithTimeout(reader.read());
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.substring(6);
            try {
              const data = JSON.parse(jsonStr);
              const parts = data.candidates?.[0]?.content?.parts || [];
              let textChunk = '';
              for (const part of parts) {
                if (part.text && !part.thought) {
                  textChunk += part.text;
                }
              }
              if (!textChunk && parts.length > 0 && parts[0]?.text) {
                textChunk = parts[0].text;
              }
              if (textChunk) {
                accumulatedText += textChunk;
                callbacks.onToken(textChunk, accumulatedText);
              }
            } catch (e) {}
          }
        }
      }

      callbacks.onComplete(accumulatedText);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[LLMService] Vision generation failed:', err);
      callbacks.onError(err);
    } finally {
      this.activeAbortController = null;
    }
  }

  /**
   * Abort any currently streaming AI response
   */
  abort(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  /**
   * Google Gemini 1.5 Flash streaming via direct REST Server-Sent Events (SSE)
   */
  private async streamGemini(
    question: string,
    history: TranscriptEntry[],
    apiKey: string,
    systemPrompt: string,
    signal: AbortSignal,
    callbacks: StreamCallbacks,
    modelName?: string,
    language: LanguageMode = 'en'
  ): Promise<void> {
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
      throw new Error('Please configure a valid Gemini API Key in Settings.');
    }

    // Build rolling context from recent conversation turns (last 2 only for speed)
    const recentHistory = history.slice(-2).map((h) => ({
      role: h.role === 'interviewer' ? 'user' : 'model',
      parts: [{ text: `[${h.role === 'interviewer' ? 'Interviewer' : 'Candidate'}]: ${h.text}` }],
    }));

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        ...recentHistory,
        {
          role: 'user',
          parts: [{ text: buildQuestionPrompt(question, language) }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: isCodingQuestion(question) ? 2048 : 1200,
        topP: 0.8,
      },
    };

    const fallbackModels = [
      'gemini-3.6-flash',
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
      'gemini-2.5-flash',
      'gemini-3.5-flash',
    ];
    const isGeminiModel = modelName && modelName.startsWith('gemini');
    const GEMINI_MODELS = isGeminiModel
      ? [modelName, ...fallbackModels.filter((m) => m !== modelName)]
      : fallbackModels;
    let response: Response | null = null;
    let lastError = '';

    for (const model of GEMINI_MODELS) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey.trim()}`;
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal,
        });

        if (res.ok) {
          response = res;
          break;
        } else {
          lastError = await res.text();
          console.warn(`[Gemini] Model ${model} returned HTTP ${res.status}, trying next fallback model...`);
          continue; // Try next model in fallback list on any HTTP status (404, 503, 429, etc.)
        }
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        lastError = err.message;
      }
    }

    if (!response) {
      throw new Error(`All Gemini models failed. Last response: ${lastError}`);
    }

    if (!response.body) {
      throw new Error('Gemini response returned empty stream body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await readWithTimeout(reader.read());
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.substring(6);
          try {
            const data = JSON.parse(jsonStr);
            const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (textChunk) {
              accumulatedText += textChunk;
              callbacks.onToken(textChunk, accumulatedText);
            }
          } catch (e) {
            // Partial JSON chunk, continue
          }
        }
      }
    }

    callbacks.onComplete(accumulatedText);
  }

  /**
   * Ultra-Fast Groq AI answer streaming via Chat Completions SSE (~500+ tokens/sec)
   */
  private async streamGroq(
    question: string,
    history: TranscriptEntry[],
    apiKey: string,
    systemPrompt: string,
    signal: AbortSignal,
    callbacks: StreamCallbacks,
    modelName?: string,
    language: LanguageMode = 'en'
  ): Promise<void> {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Please configure a valid Groq API Key.');
    }

    const recentHistory = history.slice(-2).map((h) => ({
      role: h.role === 'interviewer' ? ('user' as const) : ('assistant' as const),
      content: `[${h.role === 'interviewer' ? 'Interviewer' : 'Candidate'}]: ${h.text}`,
    }));

    const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    const defaultGroqModels = [
      'qwen/qwen3.8-27b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ];
    const isGroqModel = modelName && (modelName.includes('qwen') || modelName.includes('llama') || modelName.includes('gpt-oss'));
    const modelsToTry = isGroqModel
      ? [modelName, ...defaultGroqModels.filter((m) => m !== modelName)]
      : defaultGroqModels;

    let response: Response | null = null;
    let lastError = '';

    for (const model of modelsToTry) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...recentHistory,
              { role: 'user', content: buildQuestionPrompt(question, language) },
            ],
            stream: true,
            temperature: 0.1,
            max_tokens: isCodingQuestion(question) ? 2048 : 1200,
          }),
          signal,
        });

        if (res.ok) {
          response = res;
          break;
        } else {
          lastError = await res.text();
          console.warn(`[Groq] Model ${model} returned HTTP ${res.status}, trying next model...`);
          continue;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        lastError = err.message;
      }
    }

    if (!response || !response.body) {
      throw new Error(`Groq API error: ${lastError}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await readWithTimeout(reader.read());
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.substring(6);
          if (jsonStr === '[DONE]') break;
          try {
            const data = JSON.parse(jsonStr);
            const textChunk = data.choices?.[0]?.delta?.content || '';
            if (textChunk) {
              accumulatedText += textChunk;
              callbacks.onToken(textChunk, accumulatedText);
            }
          } catch (e) {
            // Partial JSON chunk
          }
        }
      }
    }

    callbacks.onComplete(accumulatedText);
  }

  /**
   * OpenAI GPT-4o-mini streaming via Chat Completions SSE
   */
  private async streamOpenAI(
    question: string,
    history: TranscriptEntry[],
    apiKey: string,
    systemPrompt: string,
    signal: AbortSignal,
    callbacks: StreamCallbacks,
    language: LanguageMode = 'en'
  ): Promise<void> {
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_openai_api_key')) {
      throw new Error('Please configure a valid OpenAI API Key in Settings.');
    }

    const recentHistory = history.slice(-2).map((h) => ({
      role: h.role === 'interviewer' ? ('user' as const) : ('assistant' as const),
      content: `[${h.role === 'interviewer' ? 'Interviewer' : 'Candidate'}]: ${h.text}`,
    }));

    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const isCoding = isCodingQuestion(question);
    const userPromptContent = isCoding
      ? buildQuestionPrompt(question, language)
      : `${buildQuestionPrompt(question, language)}\n\nRespond ONLY in bullet format starting with • . No intro text. No paragraphs.`;

    const requestBody = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
        { role: 'user', content: userPromptContent },
      ],
      stream: true,
      temperature: 0.1,
      max_tokens: isCoding ? 2048 : 800,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('OpenAI response returned empty stream body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await readWithTimeout(reader.read());
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.substring(6);
          if (jsonStr === '[DONE]') break;
          try {
            const data = JSON.parse(jsonStr);
            const textChunk = data.choices?.[0]?.delta?.content || '';
            if (textChunk) {
              accumulatedText += textChunk;
              callbacks.onToken(textChunk, accumulatedText);
            }
          } catch (e) {
            // Partial JSON chunk
          }
        }
      }
    }

    callbacks.onComplete(accumulatedText);
  }
}
