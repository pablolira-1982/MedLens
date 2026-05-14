# MedLens: Bridging the Gap in Local Medical AI
## A Local-First, Multimodal Diagnostic Workstation Powered by Gemma 4

### 1. The Vision & Problem Statement
In many parts of the world, access to rapid medical diagnostic support is hindered by two main barriers: **connectivity** and **privacy**. Remote clinics often lack the high-speed internet required for cloud-based AI, and hospitals are rightfully hesitant to send sensitive patient images (X-rays, MRIs) to external servers.

**MedLens** was built to solve this. It is an offline-first clinical workstation that brings the power of **Gemma 4** to the edge. By running entirely locally, MedLens ensures that high-fidelity medical analysis is available anywhere—from a remote village to a secure city hospital—without ever compromising patient data.

---

### 2. Technical Architecture: The Hybrid Edge Strategy
MedLens utilizes a sophisticated hybrid inference strategy to ensure reliability and speed:

*   **Primary Engine: LiteRT-LM (Gemma 4 E2B/E4B):** Optimized for low-latency, pixel-perfect inference on edge hardware. We use a custom MediaPipe integration to run Gemma 4 locally, providing instant diagnostic impressions.
*   **Intelligent Fallback: Ollama (Gemma 4b-it):** If the primary engine encounters complex multimodal tasks or requires deeper reasoning, the system automatically routes the request to an Ollama-managed instance (temperature 0.2) to maintain grounded, professional medical logic.
*   **Image Pre-processing Pipeline:** We implemented a **Sharp-based normalization layer** that standardizes medical imaging (sRGB conversion, alpha removal, and rotation correction). This ensures that Gemma 4 receives "clean" visual data, drastically reducing hallucinations regarding image quality or distortion.

---

### 3. Key Technical Pillars

#### **A. Multimodal Clinical Context**
MedLens doesn't just "read" images; it integrates them into a clinical narrative. Our backend parses structured metadata from scans and pairs it with user-provided symptoms, creating a rich diagnostic context that Gemma 4 uses to generate radiology-standard FINDINGS and IMPRESSIONS.

#### **B. Accessibility: Native Voice-to-Text**
Recognizing that medical professionals are often on the move, we integrated the **Web Speech API** for hands-free clinical notes. This allows doctors to dictate symptoms directly into the workstation, which MedLens then cross-references with uploaded imaging.

#### **C. Privacy-First Protocol**
*   **Zero-Cloud Footprint:** 100% of the data remains on the local machine.
*   **Session-Based Purge:** Integrated `/api/cleanup` protocols ensure that temporary medical files are wiped as soon as a new consultation begins, preventing data accumulation on the workstation.

---

### 4. Implementation Details (Gemma 4 for Good)
We prioritized the **Health & Sciences** and **LiteRT** tracks. 
*   **Model Optimization:** Our system is tuned for technical English medical responses, enforcing a strict output format that prioritizes clarity and precision over conversational fluff.
*   **Grounded Outputs:** By using system prompts that explicitly prohibit comments on "image quality" unless the file is truly corrupt, we've created a tool that remains focused on clinical findings, even when faced with noisy OCR data.

---

### 5. Why MedLens Wins
MedLens is more than just a chatbot; it is a **functional prototype of the future of clinical tools**. It demonstrates that with Gemma 4, we no longer need to choose between AI power and data sovereignty. We can have both, at the edge, saving lives where the internet doesn't reach.

---

### **Technical Setup for Judges**
*   **Models:** Gemma 4 (LiteRT) / Gemma 4b-it (Ollama fallback)
*   **Backend:** Node.js / Express / Socket.io
*   **Processing:** Sharp (Imaging) / Whisper (Audio Fallback)
*   **Interface:** React + TailwindCSS (Premium Cinematic Dark Mode)
