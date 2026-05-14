const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const MODEL_NAME = 'amsaravi/medgemma-4b-it:q8';

/**
 * Service to handle communication with the local Ollama instance.
 */
class OllamaService {
  /**
   * Sends a prompt to Gemma-4 and returns a stream or full response.
   * @param {string} prompt - The user prompt.
   * @param {string} systemPrompt - The system instructions.
   * @param {Array} history - Previous message history for context.
   * @param {Function} onToken - Callback for streaming tokens.
   * @returns {Promise<string>} The full response content.
   */
  async generateResponse(prompt, systemPrompt, history = [], onToken = null, images = []) {
    try {
      const fullPrompt = this.formatPrompt(prompt, systemPrompt, history);

      const response = await axios({
        method: 'post',
        url: OLLAMA_URL,
        data: {
          model: MODEL_NAME,
          prompt: fullPrompt,
          stream: !!onToken,
          images: images, // Base64 encoded images
          options: {
            temperature: 0.2 // Lowered for diagnostic precision
          }
        },
        responseType: onToken ? 'stream' : 'json',
      });

      if (onToken) {
        return new Promise((resolve, reject) => {
          let fullText = '';
          response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const json = JSON.parse(line);
                if (json.response) {
                  fullText += json.response;
                  onToken(json.response);
                }
                if (json.done) {
                  resolve(fullText);
                }
              } catch (e) {
                console.error('Error parsing Ollama stream chunk', e);
              }
            }
          });
          response.data.on('error', reject);
        });
      } else {
        return response.data.response;
      }
    } catch (error) {
      console.error('Ollama Service Error:', error.message);
      throw new Error('Failed to connect to local AI engine. Ensure Ollama is running.');
    }
  }

  /**
   * Formats the prompt with system instructions and history.
   * @param {string} prompt 
   * @param {string} systemPrompt 
   * @param {Array} history 
   * @returns {string}
   */
  formatPrompt(prompt, systemPrompt, history) {
    let formatted = `<start_of_turn>system\n${systemPrompt}<end_of_turn>\n`;

    history.forEach(msg => {
      formatted += `<start_of_turn>${msg.role}\n${msg.content}<end_of_turn>\n`;
    });

    formatted += `<start_of_turn>user\n${prompt}<end_of_turn>\n<start_of_turn>model\n`;
    return formatted;
  }
}

module.exports = new OllamaService();
