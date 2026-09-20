import { AIProvider, TranscriptEntry } from '../types';
import { ANDROID_SYSTEM_PROMPT } from './androidKnowledge';

export const DEFAULT_SYSTEM_PROMPT = ANDROID_SYSTEM_PROMPT;

export interface StreamCallbacks {
  onToken: (token: string, accumulatedText: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
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
    modelName?: string
  ): Promise<void> {
    // Abort previous in-flight generation if a new question is triggered
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    this.activeAbortController = new AbortController();
    const signal = this.activeAbortController.signal;

    try {
      if (provider === 'gemini') {
        await this.streamGemini(question, transcriptHistory, apiKey, systemPrompt, signal, callbacks, modelName);
      } else {
        await this.streamOpenAI(question, transcriptHistory, apiKey, systemPrompt, signal, callbacks);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[LLMService] Stream aborted by user or new query.');
        return;
      }
      console.error('[LLMService] Generation failed:', err);
      callbacks.onError(err);
    } finally {
      this.activeAbortController = null;
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

      const requestBody = {
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Carefully inspect this screen capture (which may contain a Google Meet / Zoom in-call chat message, LeetCode / HackerRank / CoderPad coding problem, or architecture diagram).\\n\\n1. State the detected question or problem topic clearly.\\n2. Provide the optimal technical answer or solution formatted in 3-4 concise bullet points with bold technical keywords and optimal time/space complexity if applicable.',
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800,
          topP: 0.8,
        },
      };

      const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-flash-lite-latest'];
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
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\\n');
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
    modelName?: string
  ): Promise<void> {
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
      throw new Error('Please configure a valid Gemini API Key in Settings.');
    }

    // Build rolling context from recent conversation turns
    const recentHistory = history.slice(-6).map((h) => ({
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
          parts: [{ text: `Interviewer Question: "${question}"\n\nProvide the instant co-pilot response:` }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
        topP: 0.8,
      },
    };

    const fallbackModels = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-flash-lite-latest'];
    const GEMINI_MODELS = modelName
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
        } else if (res.status === 404) {
          lastError = await res.text();
          continue; // Try next model in fallback list
        } else {
          const errorText = await res.text();
          throw new Error(`Gemini API error (${res.status}): ${errorText}`);
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
      const { done, value } = await reader.read();
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
   * OpenAI GPT-4o-mini streaming via Chat Completions SSE
   */
  private async streamOpenAI(
    question: string,
    history: TranscriptEntry[],
    apiKey: string,
    systemPrompt: string,
    signal: AbortSignal,
    callbacks: StreamCallbacks
  ): Promise<void> {
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_openai_api_key')) {
      throw new Error('Please configure a valid OpenAI API Key in Settings.');
    }

    const recentHistory = history.slice(-6).map((h) => ({
      role: h.role === 'interviewer' ? ('user' as const) : ('assistant' as const),
      content: `[${h.role === 'interviewer' ? 'Interviewer' : 'Candidate'}]: ${h.text}`,
    }));

    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const requestBody = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
        { role: 'user', content: `Interviewer Question: "${question}"\n\nProvide the instant co-pilot response:` },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 500,
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
      const { done, value } = await reader.read();
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
