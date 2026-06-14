// Static list of models ALIV AI can use, shown to the user as
// informational badges. Keep this in sync with api/chat.js.
const MODELS = [
  { label: 'Gemini 2.0 Flash', provider: 'Google' },
  { label: 'Llama 3.3 70B', provider: 'Groq' },
  { label: 'Llama 3.1 8B', provider: 'Groq' },
  { label: 'DeepSeek V3.1', provider: 'OpenRouter' },
  { label: 'Qwen 2.5 72B', provider: 'OpenRouter' },
  { label: 'Gemma 2 9B', provider: 'OpenRouter' },
  { label: 'Mistral 7B', provider: 'OpenRouter' },
  { label: 'Gemini 1.5 Flash', provider: 'Google' },
];

export default function handler(req, res) {
  res.status(200).json({
    models: MODELS,
    image: { label: 'Görsel Oluşturma & Düzenleme', provider: 'Google Gemini' },
  });
}
