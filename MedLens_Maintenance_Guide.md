# 🛠️ MedLens - Technical Maintenance Guide

This guide explains where to find and modify the core configurations of MedLens.

---

## 1. AI Logic & Precision (Temperature & Prompts)

### **AI Behavior (System Prompt)**
Controls how the IA speaks, the language, and the mandatory medical format.
- **File:** `server/src/index.js`
- **Function:** `getSystemPrompt()`
- **Goal:** Change instructions, medical rules, or output structure.

### **Precision & Temperature (Ollama Fallback)**
Adjusts how "creative" or "deterministic" the AI is.
- **File:** `server/src/ai/ollama.service.js`
- **Location:** Inside the `axios.post` call.
- **Value:** `temperature: 0.1` (Higher = more creative, Lower = more precise).

### **LiteRT Model Path**
Where the high-performance local model is located.
- **File:** `server/src/ai/litert.service.js`
- **Variable:** `MODEL_PATH`

---

## 2. Frontend & User Interface (UI/UX)

### **Typing Effect (Typewriter)**
Controls the speed and rhythm of the response animation.
- **File:** `client/src/App.jsx`
- **Hook:** `useEffect` (search for `typingInterval`)
- **Value:** `20` (milliseconds between each character).

### **Chat Visuals & Animations**
Colors, gradients, and layout structure.
- **File:** `client/src/index.css`
- **Key Classes:** `medical-gradient`, `glass-card`, `glass`.

### **Attachment Rendering**
Controls how images and OCR data are displayed in the chat.
- **File:** `client/src/components/ChatWindow.jsx`
- **Function:** `renderMessageContent()`

### **Voice Recording (Speech to Text)**
Settings for the browser-based transcription (Web Speech API).
- **File:** `client/src/components/ChatWindow.jsx`
- **Location:** `recognitionRef.current.lang = 'en-US'` (Change to 'pt-BR' if needed).

---

## 3. Infrastructure & Automation

### **Startup Script**
Controls the installation of dependencies (FFmpeg, Python, Node).
- **File:** `start.sh`
- **Sections:** System Dependencies, Python Venv, PM2 Start.

### **Database (SQLite)**
Where messages and conversations are persisted.
- **File:** `server/src/database/init.js`
- **File Path:** `server/conversations.db` (Auto-generated).

### **File Upload Handling**
Where temporary files are stored and processed.
- **File:** `server/src/services/file.service.js`
- **Logic:** OCR via Tesseract and PDF parsing.

---

## 4. Key Terminal Commands

| Action | Command |
| :--- | :--- |
| **Check Logs** | `pm2 logs medlens-server` |
| **Restart All** | `pm2 restart all` |
| **Stop All** | `pm2 stop all` |
| **Model Test** | `./mediapipe_env/bin/python3 ./server/src/ai/litert_runner.py ...` |

---
*Created for MedLens Hackathon - 2026*
