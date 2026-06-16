import { MODEL_REGISTRY, CHAINS, MODEL_CATEGORIES, IMAGE_MODEL_INFO } from './providers.js';

// Static info endpoint — lets the frontend show "which models are
// active" and render the manual model-category selector, all
// derived from the single registry in providers.js.
export default function handler(req, res) {
  const models = CHAINS.auto.map((id) => {
    const m = MODEL_REGISTRY[id];
    return { label: m.label, provider: m.provider };
  });

  res.status(200).json({
    models,
    categories: MODEL_CATEGORIES,
    image: IMAGE_MODEL_INFO,
  });
}
