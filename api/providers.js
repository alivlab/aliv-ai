// ============================================================
// ALIV AI — model provider registry
// ------------------------------------------------------------
// Central place to add/remove/reorder free models. Nothing in
// chat.js is hardcoded beyond this file — add a new provider by
// adding an entry here and (if needed) a new branch in the
// `callProvider` switch in chat.js.
//
// Each entry:
//   provider : 'gemini' | 'groq' | 'openrouter'
//   model    : the model id that provider expects
//   label    : shown to the user under the reply
//   vision   : can this model read images/PDFs?
//   key      : env var name holding the API key
// ============================================================

export const MODEL_REGISTRY = {
  'gemini-2.0-flash': { provider: 'gemini', model: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', vision: true, key: 'GEMINI_API_KEY' },
  'gemini-1.5-flash': { provider: 'gemini', model: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', vision: true, key: 'GEMINI_API_KEY' },
  'groq-llama-70b': { provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', vision: false, key: 'GROQ_API_KEY' },
  'groq-llama-8b': { provider: 'groq', model: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', vision: false, key: 'GROQ_API_KEY' },
  'or-deepseek': { provider: 'openrouter', model: 'deepseek/deepseek-chat-v3.1:free', label: 'DeepSeek V3.1', vision: false, key: 'OPENROUTER_API_KEY' },
  'or-qwen': { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B', vision: false, key: 'OPENROUTER_API_KEY' },
  'or-llama-8b': { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B', vision: false, key: 'OPENROUTER_API_KEY' },
  'or-gemma-9b': { provider: 'openrouter', model: 'google/gemma-2-9b-it:free', label: 'Gemma 2 9B', vision: false, key: 'OPENROUTER_API_KEY' },
  'or-mistral-7b': { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B', vision: false, key: 'OPENROUTER_API_KEY' },
};

// Ordered fallback chains. The first model whose API key is
// configured AND responds successfully wins.
export const CHAINS = {
  // Balanced default — good quality, broad coverage.
  auto: ['groq-llama-70b', 'gemini-2.0-flash', 'or-deepseek', 'groq-llama-8b', 'or-qwen', 'or-llama-8b', 'or-gemma-9b', 'or-mistral-7b', 'gemini-1.5-flash'],

  // Smallest/fastest models first, then the rest as fallback.
  fast: ['groq-llama-8b', 'or-llama-8b', 'gemini-2.0-flash', 'groq-llama-70b', 'or-gemma-9b', 'or-mistral-7b', 'or-deepseek', 'or-qwen', 'gemini-1.5-flash'],

  // Largest/most capable models first, then the rest as fallback.
  quality: ['groq-llama-70b', 'gemini-2.0-flash', 'or-qwen', 'or-deepseek', 'gemini-1.5-flash', 'groq-llama-8b', 'or-llama-8b', 'or-gemma-9b', 'or-mistral-7b'],

  // Models that tend to perform best on code, then the rest as fallback.
  code: ['or-deepseek', 'groq-llama-70b', 'gemini-2.0-flash', 'or-qwen', 'groq-llama-8b', 'or-llama-8b', 'gemini-1.5-flash', 'or-gemma-9b', 'or-mistral-7b'],

  // Any model that can read images/PDFs (used automatically
  // whenever a file is attached, regardless of the chosen chain).
  vision: ['gemini-2.0-flash', 'gemini-1.5-flash'],
};

export const MODEL_CATEGORIES = [
  { id: 'auto', label: 'Otomatik', icon: '✨', description: 'En uygun modeli otomatik seçer' },
  { id: 'fast', label: 'Hızlı', icon: '⚡', description: 'En hızlı yanıt veren modeller' },
  { id: 'quality', label: 'Kalite', icon: '💎', description: 'En güçlü modeller, biraz daha yavaş' },
  { id: 'code', label: 'Kod', icon: '💻', description: 'Kod yazma ve hata ayıklama için' },
  { id: 'vision', label: 'Görsel Anlama', icon: '👁', description: 'Görsel/dosya okuyabilen modeller' },
  { id: 'image', label: 'Görsel Oluştur', icon: '🎨', description: 'Görsel oluştur veya düzenle' },
];

export const IMAGE_MODEL_INFO = { label: 'Görsel Oluşturma & Düzenleme', provider: 'Google Gemini' };
