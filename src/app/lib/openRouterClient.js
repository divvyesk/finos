import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const FALLBACK_MODELS = [
  'google/gemini-2.5-flash',
  'meta-llama/llama-3.1-8b-instruct',
  'google/gemini-2.5-pro',
  'anthropic/claude-3-haiku'
];

/**
 * Maps direct Gemini SDK model names to OpenRouter model slugs.
 */
function mapModel(modelName) {
  if (modelName === 'gemini-2.5-flash') {
    return 'google/gemini-2.5-flash';
  }
  if (modelName === 'gemini-1.5-flash') {
    return 'google/gemini-1.5-flash';
  }
  // Default fallback or pass-through
  return modelName || 'google/gemini-2.5-flash';
}

/**
 * Executes a standard chat completion request using a specific model.
 */
async function executeRequestWithModel({ model, messages, maxTokens, config, apiKey }) {
  const requestBody = {
    model,
    messages,
    max_tokens: maxTokens
  };

  // Handle parameters from config
  if (config.temperature !== undefined) {
    requestBody.temperature = config.temperature;
  }

  // Handle JSON output mode & schemas
  if (config.responseMimeType === 'application/json') {
    if (config.responseSchema) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'structured_data',
          strict: false,
          schema: config.responseSchema
        }
      };
    } else {
      requestBody.response_format = {
        type: 'json_object'
      };
    }
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/divvyesk/finance',
      'X-OpenRouter-Title': 'FinOS Personal Finance'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices && data.choices[0];
  if (!choice || !choice.message) {
    throw new Error('Response did not contain message content.');
  }

  return choice.message.content || '';
}

/**
 * Standard utility to strip markdown code blocks from a JSON response string.
 */
function cleanJSONText(text) {
  let clean = text.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  }
  return clean;
}

/**
 * Centralized function to call the OpenRouter API with automatic fallbacks.
 * Mimics the output of direct Gemini SDK response format: { text: string }
 */
export async function callOpenRouter({ model, contents, config = {} }) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not defined in the environment variables.');
  }

  // Normalize contents/messages to standard OpenAI chat completions format
  let messages = [];
  if (typeof contents === 'string') {
    messages = [{ role: 'user', content: contents }];
  } else if (Array.isArray(contents)) {
    messages = contents.map(item => {
      let content = '';
      if (typeof item === 'string') {
        content = item;
      } else if (item.parts && Array.isArray(item.parts)) {
        content = item.parts.map(p => {
          if (typeof p === 'string') return p;
          return p.text || '';
        }).join('\n');
      } else if (item.content) {
        content = item.content;
      } else if (item.text) {
        content = item.text;
      }
      return {
        role: item.role === 'model' ? 'assistant' : (item.role || 'user'),
        content: content
      };
    });
  } else if (contents && typeof contents === 'object') {
    // Single object message
    messages = [{
      role: contents.role === 'model' ? 'assistant' : (contents.role || 'user'),
      content: contents.text || contents.content || ''
    }];
  }

  const primaryModel = mapModel(model);
  const maxTokens = config.maxOutputTokens !== undefined ? config.maxOutputTokens : 1024;

  // Try the primary model first
  try {
    let text = await executeRequestWithModel({
      model: primaryModel,
      messages,
      maxTokens,
      config,
      apiKey
    });
    if (config.responseMimeType === 'application/json') {
      text = cleanJSONText(text);
    }
    return { text };
  } catch (primaryError) {
    console.warn(`Primary model ${primaryModel} failed. Attempting automatic fallback... Error details:`, primaryError.message);

    // Filter out primary model from fallbacks list to avoid duplicate attempts
    const fallbacksToTry = FALLBACK_MODELS.filter(m => m !== primaryModel);
    
    // Loop through fallback models in order
    const errors = [primaryError];
    for (const fallbackModel of fallbacksToTry) {
      try {
        console.warn(`Retrying request with fallback model: ${fallbackModel}`);
        let text = await executeRequestWithModel({
          model: fallbackModel,
          messages,
          maxTokens,
          config,
          apiKey
        });
        if (config.responseMimeType === 'application/json') {
          text = cleanJSONText(text);
        }
        console.log(`Fallback to ${fallbackModel} succeeded!`);
        return { text };
      } catch (fallbackError) {
        console.error(`Fallback model ${fallbackModel} failed:`, fallbackError.message);
        errors.push(fallbackError);
      }
    }

    // If we reach here, all options failed
    const errorSummaries = errors.map((e, idx) => `[Attempt ${idx + 1}]: ${e.message}`).join('; ');
    throw new Error(`All OpenRouter models failed to respond. Errors: ${errorSummaries}`);
  }
}
