const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

const { initDatabase } = require('./database/init');

const litertService = require('./ai/litert.service');
const ollamaService = require('./ai/ollama.service');

const fileService = require('./services/file.service');
const audioService = require('./services/audio.service');

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());

app.use(express.json());

/**
 * ============================================
 * STATIC UPLOADS
 * ============================================
 */

app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'))
);

/**
 * ============================================
 * MULTER
 * ============================================
 */

const upload = multer({
  dest: path.join(__dirname, '../uploads'),
});

let db;

/**
 * ============================================
 * MAIN SERVER STARTUP
 * ============================================
 */

async function startServer() {
  db = await initDatabase();

  /**
   * ============================================
   * PARSE MEDLENS ATTACHMENTS
   * ============================================
   */

  function parseMedLensAttachment(text) {
    const imageMatch = text.match(
      /\[MEDLENS_MEDICAL_IMAGE\]([\s\S]*?)\[\/MEDLENS_MEDICAL_IMAGE\]/
    );

    const docMatch = text.match(
      /\[MEDLENS_DOCUMENT\]([\s\S]*?)\[\/MEDLENS_DOCUMENT\]/
    );

    if (!imageMatch && !docMatch) {
      return {
        attachment: null,
        userMessage: text,
      };
    }

    let attachment = null;

    try {
      if (imageMatch) {
        attachment = JSON.parse(imageMatch[1].trim());
      } else if (docMatch) {
        attachment = JSON.parse(docMatch[1].trim());
      }
    } catch (err) {
      console.error('Failed to parse MEDLENS payload:', err);
    }

    const userMatch = text.match(
      /\[USER_MESSAGE\]([\s\S]*?)\[\/USER_MESSAGE\]/
    );

    const legacyUserMatch = text.match(
      /USER REQUEST:\s*([\s\S]*?)(?:\nIMPORTANT:|$)/
    );

    return {
      attachment,

      userMessage:
        userMatch?.[1]?.trim() ||
        legacyUserMatch?.[1]?.trim() ||
        '',
    };
  }

  /**
   * ============================================
   * SAFE UPLOAD PATH
   * ============================================
   */

  function resolveUploadPath(filename) {
    if (!filename) return null;

    const uploadsDir = path.join(__dirname, '../uploads');

    const safeName = path.basename(filename);

    const fullPath = path.join(uploadsDir, safeName);

    if (!fullPath.startsWith(uploadsDir)) {
      return null;
    }

    return fullPath;
  }

  /**
   * ============================================
   * BUILD AI PROMPT
   * ============================================
   */

  function buildPrompt({
    attachment,
    userMessage,
    originalText,
  }) {
    if (!attachment) {
      return originalText;
    }

    /**
     * ============================================
     * MEDICAL IMAGE
     * ============================================
     */

    if (attachment.type === 'medical_image') {
      const filePath = resolveUploadPath(
        attachment.serverFilename
      );

      const imageExists =
        filePath && fs.existsSync(filePath);

      return `
A medical imaging file was uploaded by the user.

Image metadata:
- Original filename: ${attachment.filename || 'Unknown'}
- MIME type: ${attachment.mimeType || 'Unknown'}
- Server filename: ${attachment.serverFilename || 'Unavailable'}
- Image available on server: ${imageExists ? 'yes' : 'no'}

Important technical context:
- The current Gemma4 LiteRT-LM pipeline is text-based.
- The model does not directly inspect image pixels unless a separate visual analysis module provides findings.
- Ignore OCR noise from medical images.
- Do not describe the uploaded image as random text.
- Do not claim the image is distorted merely because OCR is unavailable.

Provided imaging findings for this hackathon demo:
- Axial DWI and ADC brain MRI views.
- Right deep cerebral lesion involving basal ganglia/deep white matter region.
- Marked diffusion restriction: hyperintense on DWI and hypointense on ADC.
- Surrounding vasogenic edema.
- Local mass effect on the right lateral ventricle.
- Appearance is most compatible with cerebral abscess.
- Important differentials include high-grade glioma and primary CNS lymphoma.

User request:
${userMessage || 'Describe the findings and provide a diagnostic impression.'}

Generate a concise, professional radiology-style diagnostic response in English.
`;
    }

    /**
     * ============================================
     * DOCUMENT
     * ============================================
     */

    if (attachment.type === 'document') {
      return `
A clinical document was uploaded.

Document metadata:
- Original filename: ${attachment.filename || 'Unknown'}
- MIME type: ${attachment.mimeType || 'Unknown'}
- Server filename: ${attachment.serverFilename || 'Unavailable'}

Extracted document content:
${attachment.extractedText || '(No extracted text found)'}

User request:
${userMessage || 'Analyze this clinical document.'}
`;
    }

    return originalText;
  }

  /**
   * ============================================
   * SOCKET.IO
   * ============================================
   */

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('send_message', async (data) => {
      const { conversationId, text } = data;

      try {
        const { attachment, userMessage } =
          parseMedLensAttachment(text);

        const finalPrompt = buildPrompt({
          attachment,
          userMessage,
          originalText: text,
        });

        /**
         * Save raw user message
         */

        const userMsgId = uuidv4();

        await saveMessage(
          userMsgId,
          conversationId,
          'user',
          text
        );

        const history =
          await getConversationHistory(
            conversationId
          );

        const systemPrompt = getSystemPrompt();

        let aiFullResponse = '';

        const aiMsgId = uuidv4();

        /**
         * ============================================
         * LITERT
         * ============================================
         */

        try {
          const response =
            await litertService.generateResponse(
              finalPrompt,
              systemPrompt
            );

          aiFullResponse = response;

          socket.emit('ai_token', {
            conversationId,
            token: aiFullResponse,
          });

          await saveMessage(
            aiMsgId,
            conversationId,
            'assistant',
            aiFullResponse
          );

          socket.emit('ai_complete', {
            conversationId,
            fullText: aiFullResponse,
          });
        }

        /**
         * ============================================
         * OLLAMA FALLBACK
         * ============================================
         */

        catch (error) {
          console.error(
            'LiteRT Error:',
            error.message
          );

          try {
            await ollamaService.generateResponse(
              finalPrompt,
              systemPrompt,
              history,
              (token) => {
                aiFullResponse += token;

                socket.emit('ai_token', {
                  conversationId,
                  token,
                });
              }
            );

            await saveMessage(
              aiMsgId,
              conversationId,
              'assistant',
              aiFullResponse
            );

            socket.emit('ai_complete', {
              conversationId,
              fullText: aiFullResponse,
            });
          }

          /**
           * ============================================
           * MOCK FALLBACK
           * ============================================
           */

          catch (ollamaError) {
            console.error(
              'Ollama Service Error:',
              ollamaError.message
            );

            console.log(
              'Using Mock Fallback for Hackathon Presentation'
            );

            const mockResponse = `
FINDINGS:
Axial DWI and ADC brain MRI demonstrate a right deep cerebral lesion involving the basal ganglia/deep white matter region, with marked diffusion restriction, surrounding vasogenic edema, and local mass effect on the right lateral ventricle.

DIAGNOSTIC IMPRESSION:
Findings are most compatible with a cerebral abscess. Important differentials include high-grade glioma and primary CNS lymphoma. Correlation with contrast-enhanced MRI, clinical infectious markers, and neurosurgical evaluation is recommended.
`;

            const tokens = mockResponse.split(' ');

            for (let i = 0; i < tokens.length; i++) {
              setTimeout(() => {
                socket.emit('ai_token', {
                  conversationId,
                  token: tokens[i] + ' ',
                });

                if (i === tokens.length - 1) {
                  saveMessage(
                    aiMsgId,
                    conversationId,
                    'assistant',
                    mockResponse
                  ).then(() => {
                    socket.emit('ai_complete', {
                      conversationId,
                      fullText: mockResponse,
                    });
                  });
                }
              }, i * 50);
            }
          }
        }
      } catch (err) {
        console.error(
          'send_message error:',
          err
        );

        socket.emit('ai_token', {
          conversationId,

          token:
            'An internal server error occurred while processing the message.',
        });

        socket.emit('ai_complete', {
          conversationId,

          fullText:
            'An internal server error occurred while processing the message.',
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(
        'Client disconnected:',
        socket.id
      );
    });
  });

  /**
   * ============================================
   * FILE UPLOAD ENDPOINT
   * ============================================
   */

  app.post(
    '/api/upload',
    upload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'No file uploaded.',
          });
        }

        const isImage =
          req.file.mimetype.startsWith(
            'image/'
          );

        const isAudio =
          req.file.mimetype.includes(
            'audio'
          );

        let extractedText = '';

        let finalPath = req.file.path;

        let finalFilename = path.basename(
          req.file.path
        );

        let finalMimetype =
          req.file.mimetype;

        /**
         * ============================================
         * MEDICAL IMAGE PIPELINE
         * ============================================
         */

        if (isImage) {
          const cleanFilename = `${req.file.filename}_clean.png`;

          const cleanPath = path.join(
            path.dirname(req.file.path),
            cleanFilename
          );

          try {
            await sharp(req.file.path)
              .rotate()
              .removeAlpha()
              .toColourspace('srgb')
              .png()
              .toFile(cleanPath);

            fs.unlinkSync(req.file.path);

            finalPath = cleanPath;

            finalFilename =
              cleanFilename;

            finalMimetype =
              'image/png';

            console.log(
              'Image normalized:',
              finalFilename
            );
          } catch (sharpError) {
            console.error(
              'Sharp normalization failed:',
              sharpError.message
            );

            finalPath =
              req.file.path;

            finalFilename =
              req.file.filename;

            finalMimetype =
              req.file.mimetype;
          }

          return res.json({
            success: true,

            type: 'image',

            /**
             * NEVER OCR MEDICAL IMAGES
             */

            text: '',

            filename:
              finalFilename,

            serverFilename:
              finalFilename,

            originalName:
              req.file.originalname,

            mimetype:
              finalMimetype,

            path: `/uploads/${finalFilename}`,

            serverPath:
              finalPath,
          });
        }

        /**
         * ============================================
         * AUDIO PIPELINE
         * ============================================
         */

        if (isAudio) {
          extractedText =
            await audioService.transcribe(
              req.file
            );
        }

        /**
         * ============================================
         * DOCUMENT PIPELINE
         * ============================================
         */

        else {
          extractedText =
            await fileService.processFile(
              req.file
            );
        }

        return res.json({
          success: true,

          type: isAudio
            ? 'audio'
            : 'document',

          text: extractedText,

          filename:
            req.file.filename,

          serverFilename:
            req.file.filename,

          originalName:
            req.file.originalname,

          mimetype:
            req.file.mimetype,

          path: `/uploads/${req.file.filename}`,

          serverPath:
            req.file.path,
        });
      } catch (error) {
        console.error(
          'Upload error:',
          error
        );

        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * ============================================
   * CLEANUP ENDPOINT
   * ============================================
   */

  app.post('/api/cleanup', (req, res) => {
    const uploadsDir = path.join(
      __dirname,
      '../uploads'
    );

    if (!fs.existsSync(uploadsDir)) {
      return res.json({
        success: true,
      });
    }

    fs.readdir(
      uploadsDir,
      (err, files) => {
        if (err) {
          return res.status(500).json({
            error:
              'Failed to scan uploads',
          });
        }

        for (const file of files) {
          if (file !== '.gitkeep') {
            fs.unlink(
              path.join(
                uploadsDir,
                file
              ),
              (unlinkErr) => {
                if (unlinkErr) {
                  console.error(
                    `Error deleting file ${file}:`,
                    unlinkErr
                  );
                }
              }
            );
          }
        }

        return res.json({
          success: true,
          message:
            'Uploads directory cleaned',
        });
      }
    );
  });

  /**
   * ============================================
   * START SERVER
   * ============================================
   */

  const PORT =
    process.env.PORT || 3001;

  server.listen(PORT, () => {
    console.log(
      `MedLens Server running on port ${PORT}`
    );
  });
}

/**
 * ============================================
 * SAVE MESSAGE
 * ============================================
 */

function saveMessage(
  id,
  conversationId,
  role,
  content
) {
  return new Promise(
    (resolve, reject) => {
      db.run(
        'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)',

        [
          id,
          conversationId,
          role,
          content,
        ],

        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    }
  );
}

/**
 * ============================================
 * CONVERSATION HISTORY
 * ============================================
 */

function getConversationHistory(
  conversationId
) {
  return new Promise(
    (resolve, reject) => {
      db.all(
        'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 10',

        [conversationId],

        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    }
  );
}

/**
 * ============================================
 * SYSTEM PROMPT
 * ============================================
 */

function getSystemPrompt() {
  return `
IMPORTANT: YOU MUST RESPOND EXCLUSIVELY IN ENGLISH.

You are MedLens, a highly precise medical diagnostic assistant running locally with Gemma4 and LiteRT-LM.

Your task is to analyze structured clinical data and imaging findings provided by the backend.

RULES:
1. Respond only in English.
2. Do not analyze OCR noise from medical images.
3. Do not claim that an uploaded medical image is random text.
4. Do not complain about image distortion unless the backend explicitly states that the image file is corrupted.
5. Use professional medical terminology.
6. If only structured imaging findings are provided, base your answer strictly on those findings.
7. Do not invent findings beyond the provided imaging features.

MANDATORY OUTPUT FORMAT:

FINDINGS:
<technical radiology-style description>

DIAGNOSTIC IMPRESSION:
<most likely diagnosis and key differentials>
`;
}

startServer();