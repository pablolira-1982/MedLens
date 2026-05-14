# 🩺 MedLens - Multimodal Medical AI Workstation

> **Privacy-First. Offline-Always. Powered by Gemma 4.**

MedLens is a premium clinical diagnostic assistant built for the **Gemma 4 Good Hackathon**. It leverages the power of local-first LLMs to provide rapid medical imaging analysis and clinical decision support without requiring an internet connection.

---

## 🌟 Key Innovations

- **Multimodal Vision Architecture**: Directly integrates clinical imaging (MRI, X-Ray) with technical diagnostic impressions using Gemma 4.
- **Hybrid Inference Engine**: Primary execution via **LiteRT-LM** (MediaPipe) for speed, with a hardened **Ollama** fallback for deep reasoning.
- **Medical Imaging Pipeline**: Real-time image normalization using **Sharp** to ensure diagnostic accuracy and reduce model hallucinations.
- **Privacy Protocol**: 100% offline. No data ever leaves the device. Automated session purging for HIPAA-compliant data handling concepts.
- **Cinematic UX**: A high-fidelity, accessibility-focused interface designed for high-pressure clinical environments.

---

## 🛠️ Tech Stack

- **AI Engine**: Gemma 4 (Google), LiteRT, Ollama.
- **Backend**: Node.js, Express, Socket.io (Real-time streaming).
- **Frontend**: React, TailwindCSS, Framer Motion (Animations).
- **Processing**: Sharp (Image normalization), Web Speech API (Voice-to-Text).
- **Database**: SQLite3 (Session persistence).

---

### 🚀 Quick Start (Local Installation)

### 1. Prerequisites
- **Node.js** (v18+)
- **Python** (v3.9+)
- **Ollama** (Running with `gemma4:e2b` or `medgemma-4b-it`)

### 2. Model Installation (CRITICAL FOR JUDGES)
For the system to function, you must place the fine-tuned Gemma 4 LiteRT model in the following directory:
- **Path**: `ai/models/gemma-4-e2b.litertlm`
- **Model Link**: [Insert your Kaggle Model Link Here]

### 3. Automatic Setup
We provide a single script to install all system dependencies (including FFmpeg for audio), setup the Python environment, and start the services.

First, clone the repository and navigate into the directory:
```bash
git clone https://github.com/pablolira-1982/MedLens.git
cd MedLens
chmod +x start.sh
./start.sh
```

### 4. Manual Startup
If you prefer manual control:
```bash
# In /server
npm install && npm install sharp
pm2 start src/index.js --name medlens-server

# In /client
npm install
npm run dev
```

---

## 📖 Documentation & Methodology

For a deep dive into our technical architecture, architectural choices, and the challenges we overcame, please refer to our **[Kaggle Writeup Guide](./FINAL_SUBMISSION_GUIDE.md)**.

---

## ⚖️ Disclaimer
*MedLens is an informational tool designed for educational and demonstration purposes. It is NOT a replacement for professional medical judgment. Always consult with a licensed physician for medical advice and diagnosis.*

---
**Built with ❤️ for the Gemma 4 Good Hackathon.**
