#!/bin/bash

# ==================================================
# MedLens Startup & Installation Script
# Gemma4 + LiteRT-LM + Whisper + PM2
# ==================================================

set -e

echo "--------------------------------------------------"
echo " Setting up MedLens - Offline Medical AI Assistant"
echo "--------------------------------------------------"

# ==================================================
# 1. Environment Config
# ==================================================

PROJECT_DIR=$(pwd)

mkdir -p "$PROJECT_DIR/models"
mkdir -p "$PROJECT_DIR/server/uploads"
mkdir -p "$PROJECT_DIR/ai/models"

# ==================================================
# 2. Install System Dependencies
# ==================================================

echo "[1/7] Installing system dependencies..."

APT_CMD="apt"
if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
        APT_CMD="sudo apt"
    else
        echo "WARN: sem permissao para usar sudo; pulando instalacao de dependencias do sistema."
        echo "Instale manualmente: python3-pip python3-venv libgl1-mesa-glx curl build-essential ffmpeg"
        APT_CMD=""
    fi
fi

if [ -n "$APT_CMD" ]; then
    $APT_CMD update
    $APT_CMD install -y \
        python3-pip \
        python3-venv \
        libgl1-mesa-glx \
        curl \
        build-essential \
        ffmpeg
fi

# ==================================================
# 3. Install Server Dependencies
# ==================================================

echo "[2/7] Installing backend dependencies..."

cd "$PROJECT_DIR/server"

npm install
npm install sharp

# ==================================================
# 4. Setup Python Virtual Environment
# ==================================================

echo "[3/7] Setting up Python AI environment..."

if [ ! -d "mediapipe_env" ]; then
    python3 -m venv mediapipe_env
fi

source mediapipe_env/bin/activate

echo "Upgrading pip..."

pip install --upgrade pip

echo "Installing AI dependencies..."

# LiteRT-LM runtime
pip install litert-lm

# Whisper Speech-to-Text
pip install openai-whisper

# Optional utilities
pip install numpy

deactivate

# ==================================================
# 5. Validate LiteRT Model
# ==================================================

echo "[4/7] Validating Gemma4 LiteRT model..."

MODEL_PATH="$PROJECT_DIR/server/ai/models/gemma-4-e2b.litertlm"
if [ ! -f "$MODEL_PATH" ] && [ -f "$PROJECT_DIR/ai/models/gemma-4-e2b.litertlm" ]; then
    MODEL_PATH="$PROJECT_DIR/ai/models/gemma-4-e2b.litertlm"
fi
RUNNER_PATH="$PROJECT_DIR/server/src/ai/litert_runner.py"

if [ ! -f "$MODEL_PATH" ]; then
    echo ""
    echo "ERROR: LiteRT model not found:"
    echo "$MODEL_PATH"
    echo ""
    exit 1
fi

if [ ! -f "$RUNNER_PATH" ]; then
    echo ""
    echo "ERROR: LiteRT runner not found:"
    echo "$RUNNER_PATH"
    echo ""
    exit 1
fi

echo "LiteRT model found."
echo "Testing Gemma4 inference..."

TEST_OUTPUT=$(
    ./mediapipe_env/bin/python3 \
    "$RUNNER_PATH" \
    "$MODEL_PATH" \
    "Hello, reply only with OK" || true
)

echo "$TEST_OUTPUT"

if echo "$TEST_OUTPUT" | grep -q '"success": true'; then
    echo "LiteRT-LM inference test passed."
else
    echo ""
    echo "WARNING:"
    echo "LiteRT-LM test did not return success=true."
    echo "Check output above."
    echo ""
fi

# ==================================================
# 6. Install Frontend Dependencies
# ==================================================

echo "[5/7] Installing frontend dependencies..."

cd "$PROJECT_DIR/client"

npm install

# ==================================================
# 7. Start Services via PM2
# ==================================================

echo "[6/7] Starting services..."

cd "$PROJECT_DIR"

# Cleanup previous PM2 processes
pm2 delete medlens-server medlens-client ollama 2>/dev/null || true

# ==================================================
# Optional Ollama Fallback
# ==================================================

if command -v ollama &> /dev/null
then
    echo "Ollama detected."

    if ! curl -s http://localhost:11434/api/tags > /dev/null
    then
        echo "Starting Ollama..."
        pm2 start "ollama serve" --name ollama
        sleep 8
    fi

    echo "Optional fallback model:"
    echo "amsaravi/medgemma-4b-it:q8"

else
    echo "Ollama not installed (optional fallback disabled)."
fi

# ==================================================
# Start Backend
# ==================================================

echo "Starting backend..."

pm2 start server/src/index.js \
    --name medlens-server

# ==================================================
# Start Frontend
# ==================================================

echo "Starting frontend..."

pm2 start "cd client && npm run dev" \
    --name medlens-client

# ==================================================
# Done
# ==================================================

echo ""
echo "--------------------------------------------------"
echo " SUCCESS: MedLens is now running!"
echo "--------------------------------------------------"
echo ""
echo "Frontend:"
echo "http://localhost:3000"
echo ""
echo "Backend API:"
echo "http://localhost:3001"
echo ""
echo "PM2 Status:"
echo "pm2 list"
echo ""
echo "Logs:"
echo "pm2 logs medlens-server"
echo ""
echo "LiteRT Test:"
echo "cd server && ./mediapipe_env/bin/python3 ./src/ai/litert_runner.py ./ai/models/gemma-4-e2b.litertlm \"Olá\""
echo ""
echo "--------------------------------------------------"
