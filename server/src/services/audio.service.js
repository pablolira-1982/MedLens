const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUNNER_PATH = path.resolve(__dirname, '../ai/whisper_runner.py');

/**
 * Service to handle local audio transcription for users who prefer voice input.
 */
class AudioService {
  /**
   * Transcribes an audio file to text.
   * @param {Object} file - Multer file object.
   * @returns {Promise<string>}
   */
  async transcribe(file) {
    return new Promise((resolve, reject) => {
      const filePath = file.path;
      
      const venvPython = path.resolve(__dirname, '../../mediapipe_env/bin/python3');
      const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python3';

      const process = spawn(pythonBin, [RUNNER_PATH, filePath]);
      
      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        // Cleanup file immediately after transcription
        fs.unlink(filePath, () => {});

        if (code !== 0) {
          console.error('Whisper Runner Error:', error);
          reject(new Error(`Transcription failed with code ${code}`));
          return;
        }

        try {
          const json = JSON.parse(output);
          if (json.error) reject(new Error(json.error));
          else resolve(json.text);
        } catch (e) {
          reject(new Error('Failed to parse Whisper output'));
        }
      });
    });
  }
}

module.exports = new AudioService();
