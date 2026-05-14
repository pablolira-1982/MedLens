import sys
import json
try:
    import whisper
except ImportError:
    whisper = None

'''
Note: This script requires 'openai-whisper' to be installed.
It provides a simple CLI to transcribe audio files.
'''

def transcribe_audio(file_path):
    if whisper is None:
        return {"error": "Whisper library not installed. Please run 'pip install openai-whisper'."}
    
    try:
        model = whisper.load_model("base")
        result = model.transcribe(file_path)
        return {"text": result["text"]}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python3 whisper_runner.py <file_path>"}))
        sys.exit(1)

    file_path = sys.argv[1]
    result = transcribe_audio(file_path)
    print(json.dumps(result))
