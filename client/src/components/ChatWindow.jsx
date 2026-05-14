import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Image as ImageIcon,
  FileText,
  Mic,
  Paperclip,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Shield,
} from 'lucide-react';
import useChatStore from '../store/useChatStore';
import { motion, AnimatePresence } from 'framer-motion';

const quickActions = [
  {
    icon: ImageIcon,
    label: 'Analyze X-Ray',
    bg: 'bg-blue-500/10',
    hover: 'group-hover:bg-blue-500/20',
  },
  {
    icon: FileText,
    label: 'Blood Test Summary',
    bg: 'bg-purple-500/10',
    hover: 'group-hover:bg-purple-500/20',
  },
  {
    icon: Mic,
    label: 'Voice Symptoms',
    bg: 'bg-emerald-500/10',
    hover: 'group-hover:bg-emerald-500/20',
  },
  {
    icon: Shield,
    label: 'Privacy Protocol',
    bg: 'bg-slate-500/10',
    hover: 'group-hover:bg-slate-500/20',
  },
];

/**
 * Main ChatWindow component for displaying messages and handling user input.
 */
const ChatWindow = ({ onSendMessage }) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const {
    activeConversationId,
    messages,
    isStreaming,
    currentStreamingText,
  } = useChatStore();

  const activeMessages = messages[activeConversationId] || [];

  /**
   * Automatically scrolls the chat window to the bottom when new messages arrive.
   */
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages, currentStreamingText]);

  useEffect(() => {
    // Initialize Web Speech API for instant transcription
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (transcript) {
          setInputText((prev) => prev + (prev ? ' ' : '') + transcript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech Recognition Error:', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  /**
   * Starts the audio recognition.
   */
  const startRecording = () => {
    if (isRecording || !recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recognition:', err);
    }
  };

  /**
   * Stops the audio recognition.
   */
  const stopRecording = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsRecording(false);
  };

  /**
   * Handles file selection and uploads it to the backend for OCR processing.
   * @param {Event} e - The file input change event.
   */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    // Create a local preview URL for the UI
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

    try {
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setAttachedFile({ 
          name: file.name, 
          text: data.text || '(Image clinical data ready)', 
          preview: previewUrl,
          serverFilename: data.filename 
        });
      }
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      e.target.value = '';
      setIsUploading(false);
    }
  };

  /**
   * Formats and sends the message (including attachments) to the parent component.
   * @param {Event} e - The form submission event.
   */
  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    const trimmedText = inputText.trim();

    if ((trimmedText || attachedFile) && !isStreaming) {
      let finalMessage = trimmedText;
      
      if (attachedFile) {
        const isImage = attachedFile.preview !== null;
        const payload = {
          type: isImage ? 'medical_image' : 'document',
          filename: attachedFile.name,
          serverFilename: attachedFile.serverFilename,
          serverPath: `uploads/${attachedFile.serverFilename}`,
          previewUrl: attachedFile.preview || '',
          extractedText: attachedFile.text || ''
        };

        const tag = isImage ? 'MEDLENS_MEDICAL_IMAGE' : 'MEDLENS_DOCUMENT';
        
        finalMessage = `
[${tag}]
${JSON.stringify(payload, null, 2)}
[/${tag}]

USER REQUEST:
${trimmedText || (isImage ? 'Describe the findings and provide a clinical impression.' : 'Analyze this document.')}

IMPORTANT:
- Follow medical privacy protocols.
- Be precise and objective.
`;
      }

      onSendMessage(finalMessage);
      setInputText('');
      setAttachedFile(null);
    }
  };

  /**
   * Copies message text to the user's clipboard.
   * @param {string} text - Content to copy.
   * @param {string} id - Message ID for visual feedback.
   */
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  /**
   * Parses and renders message content, handling special attachment formatting.
   * @param {string} content - The raw message content.
   * @returns {JSX.Element} The rendered content.
   */
  const renderMessageContent = (content) => {
    // 1. Handle Medical Image Tags
    if (content.includes('[MEDLENS_MEDICAL_IMAGE]')) {
      try {
        const parts = content.split('[/MEDLENS_MEDICAL_IMAGE]');
        const jsonPart = parts[0].split('[MEDLENS_MEDICAL_IMAGE]')[1];
        const remainingPart = parts[1] || '';
        
        const payload = JSON.parse(jsonPart.trim());
        const userText = remainingPart.split('USER REQUEST:')[1]?.split('IMPORTANT:')[0]?.trim() || '';

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-white/10 p-3 rounded-xl border border-white/10">
              <div className="p-2 rounded-lg bg-medical-500/20 text-medical-400">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate text-white">{payload.filename}</div>
                <div className="text-[10px] text-white/50 uppercase tracking-widest font-medium">Diagnostic Imaging Active</div>
              </div>
            </div>

            {payload.previewUrl && (
              <div className="relative group/img rounded-xl overflow-hidden border border-white/10 bg-black/40">
                <img 
                  src={payload.previewUrl} 
                  alt="Medical Scan" 
                  className="max-h-[400px] w-full object-contain transition-transform duration-500 group-hover/img:scale-105 shadow-2xl" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity" />
              </div>
            )}
            
            {userText && (
              <div className="pt-2 text-white/90 border-t border-white/5 font-medium leading-relaxed">
                {userText}
              </div>
            )}
          </div>
        );
      } catch (err) {
        console.error('Render error:', err);
      }
    }

    // 2. Handle Document Tags
    if (content.includes('[MEDLENS_DOCUMENT]')) {
      try {
        const parts = content.split('[/MEDLENS_DOCUMENT]');
        const jsonPart = parts[0].split('[MEDLENS_DOCUMENT]')[1];
        const remainingPart = parts[1] || '';
        
        const payload = JSON.parse(jsonPart.trim());
        const userText = remainingPart.split('USER REQUEST:')[1]?.split('IMPORTANT:')[0]?.trim() || '';

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-white/10 p-3 rounded-xl border border-white/10">
              <div className="p-2 rounded-lg bg-medical-500/20 text-medical-400">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate text-white">{payload.filename}</div>
                <div className="text-[10px] text-white/50 uppercase tracking-widest font-medium">Clinical Document Data</div>
              </div>
            </div>
            
            {payload.extractedText && (
              <div className="bg-black/30 p-4 rounded-xl border border-white/5 font-mono text-[11px] text-emerald-400/90 leading-relaxed overflow-x-auto shadow-inner max-h-[200px]">
                {payload.extractedText}
              </div>
            )}

            {userText && (
              <div className="pt-2 text-white/90 border-t border-white/5 font-medium leading-relaxed">
                {userText}
              </div>
            )}
          </div>
        );
      } catch (err) {
        console.error('Render error:', err);
      }
    }

    return content;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 glass z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-sm text-slate-200">
            Gemma-4 Medical Vision Instance
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500 font-medium text-emerald-400/80">
            Multimodal Vision Active
          </span>

          <div className="w-px h-4 bg-white/10" />

          <button
            type="button"
            className="text-slate-400 hover:text-white transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {activeMessages.length === 0 && !isStreaming && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-medical-500/10 flex items-center justify-center border border-medical-500/20">
              <Shield className="w-10 h-10 text-medical-400" />
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-2">
                Welcome to MedLens
              </h2>

              <p className="text-slate-400 max-w-md">
                Your private medical assistant with Vision capability. Upload X-Rays or describe
                symptoms to start.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
              {quickActions.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    type="button"
                    className="glass-card p-4 rounded-2xl flex items-center gap-4 hover:bg-white/5 transition-all group"
                  >
                    <div
                      className={`p-3 rounded-xl ${item.bg} ${item.hover} transition-colors`}
                    >
                      <Icon className="w-5 h-5 text-white/70" />
                    </div>

                    <span className="font-medium text-sm text-slate-300">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {activeMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
            >
              <div
                className={`max-w-[80%] group relative ${msg.role === 'user'
                  ? 'bg-medical-600 text-white rounded-2xl rounded-tr-sm px-6 py-4 shadow-lg'
                  : 'glass-card rounded-2xl rounded-tl-sm px-6 py-4 border border-white/5 shadow-xl shadow-black/20'
                  }`}
              >
                <div className="prose prose-invert max-w-none text-[15px] leading-relaxed whitespace-pre-wrap">
                  {renderMessageContent(msg.content)}
                </div>

                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-4 pt-4 border-t border-white/5 mt-4">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="text-slate-400 hover:text-medical-400 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}

                      {copiedId === msg.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="max-w-[80%] glass-card rounded-2xl rounded-tl-sm px-6 py-4 border border-medical-500/20 shadow-lg shadow-medical-500/5">
                <div className="prose prose-invert max-w-none text-[15px] leading-relaxed whitespace-pre-wrap">
                  {!currentStreamingText ? (
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-medical-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-medical-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-medical-400 rounded-full animate-bounce" />
                      </div>
                      <span className="text-sm font-medium text-medical-400/80 animate-pulse tracking-wide">
                        MedLens is thinking...
                      </span>
                    </div>
                  ) : (
                    <>
                      {currentStreamingText}
                      <span className="inline-block w-1.5 h-4 ml-1 bg-medical-400 animate-pulse align-middle" />
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={chatEndRef} />
      </div>

      <footer className="p-8">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-medical-500/20 to-purple-500/20 rounded-3xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />

          <div className="relative glass-card rounded-2xl flex flex-col border border-white/10 group-focus-within:border-medical-500/50 transition-colors">
            {attachedFile && (
              <div className="px-6 py-3 border-b border-white/5 bg-medical-500/10 flex items-center justify-between rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-medical-400" />
                  <span className="text-sm text-slate-300 font-medium truncate max-w-[200px]">
                    {attachedFile.name}
                  </span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setAttachedFile(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isTranscribing ? "Transcribing voice..." : "Describe symptoms or upload medical data..."}
              disabled={isTranscribing}
              className={`w-full bg-transparent px-6 pt-4 pb-2 resize-none outline-none text-slate-200 placeholder:text-slate-500 min-h-[60px] max-h-[200px] ${isTranscribing ? 'opacity-50' : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  handleSubmit(e);
                }
              }}
            />

            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/png, image/jpeg, image/jpg, .pdf, .txt"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-medical-400 transition-all"
                  title="Upload Image (PNG, JPG)"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-purple-400 transition-all"
                  title="Upload PDF"
                >
                  <FileText className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-2.5 rounded-xl transition-all ${isRecording
                    ? 'bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                    : 'hover:bg-white/5 text-slate-400 hover:text-emerald-400'
                    }`}
                  title={isRecording ? "Stop Recording" : "Start Voice Recording"}
                >
                  <div className="relative">
                    <Mic className="w-5 h-5" />
                    {isRecording && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    )}
                  </div>
                </button>

                <div className="w-px h-6 bg-white/10 mx-2" />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all"
                  title="Attach File"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
              </div>

              <button
                type="submit"
                disabled={(!inputText.trim() && !attachedFile) || isStreaming}
                className={`p-3 rounded-xl transition-all duration-300 ${(inputText.trim() || attachedFile) && !isStreaming
                  ? 'bg-medical-500 text-white shadow-lg shadow-medical-500/20 scale-100'
                  : 'bg-white/5 text-slate-500 scale-95 opacity-50 cursor-not-allowed'
                  }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          <p className="text-[10px] text-center mt-3 text-slate-500 font-medium uppercase tracking-widest">
            MedLens can make mistakes. Check important info with a doctor.
          </p>
        </form>
      </footer>
    </div>
  );
};

export default ChatWindow;