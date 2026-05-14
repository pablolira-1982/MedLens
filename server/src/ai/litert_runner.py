import sys
import json
import traceback


def json_print(payload):
    print(json.dumps(payload, ensure_ascii=False))


def extract_text(response):
    """
Extracts text from the LiteRT-LM response.
Compatible with different response formats returned by the Engine.
"""

    # Already a string
    if isinstance(response, str):
        return response

    # Caso venha como dict estruturado
    if isinstance(response, dict):
        content = response.get("content", [])

        if isinstance(content, list):
            texts = []

            for item in content:
                if (
                    isinstance(item, dict)
                    and item.get("type") == "text"
                ):
                    texts.append(item.get("text", ""))

            return "\n".join(texts).strip()

        return str(content)

    # Fallback genérico
    return str(response)


def run_inference(model_path, prompt):
    try:
        import litert_lm

        # Reduz logs internos se disponível
        if hasattr(litert_lm, "set_min_log_severity"):
            litert_lm.set_min_log_severity(
                litert_lm.LogSeverity.ERROR
            )

        # Inicializa Engine LiteRT
        with litert_lm.Engine(model_path) as engine:

            # Cria conversa
            with engine.create_conversation() as conversation:

                # Envia prompt
                response = conversation.send_message(prompt)

                # Extrai texto final
                text = extract_text(response)

        return {
            "success": True,
            "response": text,
            "backend": "litert_lm"
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


if __name__ == "__main__":

    if len(sys.argv) < 3:
        json_print({
            "success": False,
            "error": (
                "Usage: python3 litert_runner.py "
                "<model_path> <prompt>"
            )
        })
        sys.exit(1)

    model_path = sys.argv[1]
    prompt = sys.argv[2]

    result = run_inference(model_path, prompt)

    json_print(result)

    if not result.get("success"):
        sys.exit(1)