"""Interface commune pour les scripts Python — JSON stdin/stdout."""
import json
import sys


def read_input() -> dict:
    """Lit le JSON depuis stdin."""
    try:
        data = sys.stdin.read()
        if not data.strip():
            return {}
        return json.loads(data)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"JSON invalide en entrée: {e}"}), file=sys.stderr)
        sys.exit(1)


def write_output(data: dict) -> None:
    """Écrit le résultat JSON sur stdout."""
    print(json.dumps(data, ensure_ascii=False))


def report_progress(progress: float, message: str = "") -> None:
    """Envoie un message de progression intermédiaire sur stdout."""
    print(json.dumps({
        "progress": progress,
        "message": message,
    }, ensure_ascii=False), flush=True)
