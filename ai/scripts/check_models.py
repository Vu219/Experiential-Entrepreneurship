"""Deploy check: does the ENV model (LLM_PROVIDER + ANTHROPIC_MODEL / GOOGLE_MODEL) still answer?

Makes ONE minimal real generation per model (llm.probe_models) — listing models is not enough,
Google keeps gated models in ListModels while generateContent returns 404. Extra model ids of
the same provider can be passed as arguments (e.g. to vet a fallback before routing it).

    uv run python scripts/check_models.py                      # env model only
    uv run python scripts/check_models.py gemini-3.5-flash-lite  # + extra models

Exit code 1 when a model is gone (model_not_found) or the key is rejected (invalid_key);
temporary states (overloaded / rate limited / quota) only warn. DB-routed models (production,
AI_CONFIG_FROM_DB=true) are checked by the backend at startup and via "Kiểm tra model".
The API key is never printed.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src import errors  # noqa: E402
from src.llm import _env_spec, probe_models  # noqa: E402

FATAL = {errors.MODEL_NOT_FOUND, errors.INVALID_KEY}


def main(extra_models: list[str]) -> int:
    base = _env_spec()
    specs = [base] + [base.model_copy(update={"model": m}) for m in extra_models if m != base.model]
    failed = False
    for a in probe_models(specs):
        mark = "OK  " if a.outcome == "ok" else "FAIL" if a.outcome in FATAL else "WARN"
        status = f" HTTP {a.http_status}" if a.http_status else ""
        print(f"[{mark}] {a.provider}/{a.model}: {a.outcome}{status} ({a.latency_ms}ms)")
        failed |= a.outcome in FATAL
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
