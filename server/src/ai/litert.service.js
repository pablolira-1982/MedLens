const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODEL_PATH = path.resolve(
  __dirname,
  '../../ai/models/gemma-4-e2b.litertlm'
);

const RUNNER_PATH = path.resolve(__dirname, './litert_runner.py');

class LiteRTService {
  async generateResponse(prompt, systemPrompt = '') {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(MODEL_PATH)) {
        reject(new Error(`LiteRT model not found: ${MODEL_PATH}`));
        return;
      }

      if (!fs.existsSync(RUNNER_PATH)) {
        reject(new Error(`LiteRT runner not found: ${RUNNER_PATH}`));
        return;
      }

      const fullPrompt = `${systemPrompt}

User: ${prompt}

Model:`;

      const venvPython = path.resolve(
        __dirname,
        '../../mediapipe_env/bin/python3'
      );

      const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python3';

      const child = spawn(pythonBin, [RUNNER_PATH, MODEL_PATH, fullPrompt], {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
      });

      let output = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start LiteRT runner: ${err.message}`));
      });

      child.on('close', (code) => {
        let parsed = null;

        try {
          parsed = JSON.parse(output.trim());
        } catch (err) {
          reject(
            new Error(
              [
                'Failed to parse LiteRT output.',
                `Exit code: ${code}`,
                `STDOUT: ${output}`,
                `STDERR: ${stderr}`,
              ].join('\n')
            )
          );
          return;
        }

        if (code !== 0 || parsed.error) {
          reject(
            new Error(
              [
                parsed.error || `LiteRT runner exited with code ${code}`,
                parsed.details ? `Details: ${parsed.details}` : '',
                parsed.traceback ? `Traceback:\n${parsed.traceback}` : '',
                parsed.api_info
                  ? `API Info:\n${JSON.stringify(parsed.api_info, null, 2)}`
                  : '',
                stderr ? `STDERR:\n${stderr}` : '',
              ]
                .filter(Boolean)
                .join('\n')
            )
          );
          return;
        }

        resolve(parsed.response);
      });
    });
  }
}

module.exports = new LiteRTService();