"""
llm_client.py — Unified LLM caller cho CV/JD analyzer.

Ưu tiên:
  1. Cloud LLM (Groq / Gemini / OpenAI) — nếu LLM_API_KEY được set trong env
  2. Ollama local — fallback giữ nguyên backward compat

Env vars (dùng chung với backend Node.js):
  LLM_BASE_URL  e.g. https://api.groq.com/openai/v1
  LLM_API_KEY   e.g. gsk_...
  LLM_MODEL     e.g. llama-3.3-70b-versatile

Nếu không set env → tự động dùng Ollama tại localhost:11434.
"""

from __future__ import annotations
import os
import json
import re
import time
import httpx

# ── Ollama defaults (dùng khi không có cloud env vars) ──────────────────────
_OLLAMA_URL           = "http://localhost:11434/api/generate"
_OLLAMA_DEFAULT_MODEL = "mistral:7b"


def _use_cloud() -> bool:
    """True nếu LLM_API_KEY được set → dùng cloud LLM."""
    return bool(os.environ.get("LLM_API_KEY", "").strip())


def _cloud_cfg() -> dict:
    return {
        "base_url": os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/"),
        "api_key":  os.environ.get("LLM_API_KEY", ""),
        "model":    os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile"),
    }


def call_llm(
    system_prompt: str,
    user_prompt:   str,
    max_tokens:    int   = 1200,
    temperature:   float = 0.15,
    timeout:       int   = 120,
    ollama_model:  str   = None,
) -> str:
    """
    Gọi LLM — tự chọn cloud hay Ollama dựa theo env.

    Args:
        system_prompt: System instruction cho LLM
        user_prompt:   Nội dung câu hỏi / data cần xử lý
        max_tokens:    Giới hạn token đầu ra
        temperature:   Độ random (0.0 = deterministic, 1.0 = creative)
        timeout:       Timeout giây
        ollama_model:  Override model name khi dùng Ollama (bỏ qua trong cloud mode)

    Returns:
        Plain text response từ LLM (thường là JSON string)

    Raises:
        ConnectionError: Không kết nối được LLM endpoint
        TimeoutError:    LLM không phản hồi kịp thời
        RuntimeError:    Lỗi HTTP khác
    """
    if _use_cloud():
        return _call_cloud(system_prompt, user_prompt, max_tokens, temperature, timeout)
    else:
        return _call_ollama(system_prompt, user_prompt, max_tokens, temperature, timeout, ollama_model)


def _call_cloud(
    system_prompt: str,
    user_prompt:   str,
    max_tokens:    int,
    temperature:   float,
    timeout:       int,
) -> str:
    cfg = _cloud_cfg()
    url = f"{cfg['base_url']}/chat/completions"

    headers = {
        "Authorization": f"Bearer {cfg['api_key']}",
        "Content-Type":  "application/json",
    }

    payload = {
        "model":       cfg["model"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        "temperature":     temperature,
        "max_tokens":      max_tokens,
        "response_format": {"type": "json_object"},
    }

    # gemini-2.5-flash mặc định bật "thinking" và tính chung vào max_tokens — với JSON
    # output dài (nhiều bullet/skill), thinking có thể ngốn hết budget trước khi model
    # kịp xuất JSON, khiến response bị cắt cụt (finish_reason="length", content rỗng/hỏng).
    # Tắt hẳn thinking cho Gemini để completion luôn dùng trọn max_tokens.
    if _detect_provider(cfg["base_url"]) == "Google Gemini":
        payload["reasoning_effort"] = "none"

    _RETRY_DELAYS = [5, 15, 30]  # giây chờ sau lần 429 thứ 1, 2, 3

    for attempt, delay in enumerate([0] + _RETRY_DELAYS):
        if delay:
            print(f"  [llm] 429 — chờ {delay}s rồi retry (lần {attempt})...")
            time.sleep(delay)
        try:
            r = httpx.post(url, json=payload, headers=headers, timeout=timeout)

            # Một số model không hỗ trợ response_format → retry không có nó
            if r.status_code == 400 and "response_format" in r.text:
                payload_plain = {k: v for k, v in payload.items() if k != "response_format"}
                r = httpx.post(url, json=payload_plain, headers=headers, timeout=timeout)

            if r.status_code == 413:
                raise RuntimeError(
                    "Payload quá lớn cho Groq API (413). "
                    "CV hoặc JD có quá nhiều nội dung — hệ thống đã tự giới hạn nhưng "
                    "file này vẫn vượt ngưỡng. Thử upload file CV/JD ngắn hơn (< 3 trang)."
                )

            if r.status_code in (429, 503):
                if attempt < len(_RETRY_DELAYS):
                    continue
                raise RuntimeError("Gemini đang quá tải (503). Vui lòng thử lại sau ít phút.")

            if r.status_code in (401, 403):
                provider = _detect_provider(cfg["base_url"])
                raise RuntimeError(
                    f"API key {provider} không hợp lệ hoặc đã hết hạn (HTTP {r.status_code}). "
                    "Vào Google AI Studio (aistudio.google.com) → tạo key mới → "
                    "cập nhật LLM_API_KEY trong cv_jd_matching/.env."
                )

            r.raise_for_status()
            content = r.json()["choices"][0]["message"].get("content") or ""
            return content

        except httpx.ConnectError:
            raise ConnectionError(
                f"Không kết nối được LLM endpoint: {url}\n"
                "Kiểm tra LLM_BASE_URL trong .env hoặc biến môi trường."
            )
        except httpx.TimeoutException:
            raise TimeoutError(f"Cloud LLM timeout sau {timeout}s.")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Cloud LLM HTTP {e.response.status_code}: {e}")
        except RuntimeError:
            raise
        except Exception as e:
            raise RuntimeError(f"Cloud LLM error: {e}")

    raise RuntimeError("RATE_LIMIT_429")


def _call_ollama(
    system_prompt: str,
    user_prompt:   str,
    max_tokens:    int,
    temperature:   float,
    timeout:       int,
    model:         str = None,
) -> str:
    payload = {
        "model":  model or _OLLAMA_DEFAULT_MODEL,
        "prompt": f"{system_prompt}\n\n{user_prompt}",
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p":       0.9,
            "num_predict": max_tokens,
        },
    }

    try:
        r = httpx.post(_OLLAMA_URL, json=payload, timeout=timeout)
        r.raise_for_status()
        return r.json()["response"]

    except httpx.ConnectError:
        raise ConnectionError(
            "Không kết nối được Ollama tại localhost:11434.\n"
            "→ Cách 1: Mở Ollama app hoặc chạy 'ollama serve'\n"
            "→ Cách 2: Set LLM_API_KEY + LLM_BASE_URL + LLM_MODEL để dùng Groq/Gemini"
        )
    except httpx.TimeoutException:
        raise TimeoutError(
            f"Ollama không phản hồi sau {timeout}s.\n"
            "Model có thể đang load lần đầu — thử lại sau 30s."
        )


def extract_json(raw: str, fallback: dict) -> dict:
    """
    Parse JSON từ LLM output. Robust với markdown fences và text thừa.
    Trả về fallback dict (kèm _parse_error=True) nếu thất bại hoàn toàn.
    """
    # Strip markdown code fences nếu có
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()

    # Thử parse thẳng
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Tìm JSON block đầu tiên bằng regex
    m = re.search(r'\{[\s\S]*\}', cleaned)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass

    return {**fallback, "_parse_error": True}


def check_llm_health() -> dict:
    """
    Health check thống nhất — trả về thông tin provider đang dùng.
    Gọi từ FastAPI /health/ollama (giữ tên endpoint cho backward compat).
    """
    if _use_cloud():
        cfg = _cloud_cfg()
        # Mask API key
        masked_key = (cfg["api_key"][:8] + "...") if len(cfg["api_key"]) > 8 else "***"
        return {
            "mode":      "cloud",
            "provider":  _detect_provider(cfg["base_url"]),
            "base_url":  cfg["base_url"],
            "model":     cfg["model"],
            "api_key":   masked_key,
            "running":   True,
        }
    else:
        # Ollama mode
        try:
            r = httpx.get("http://localhost:11434/api/tags", timeout=5)
            models = [m["name"] for m in r.json().get("models", [])]
            return {
                "mode":             "ollama",
                "running":          True,
                "model_available":  any(_OLLAMA_DEFAULT_MODEL in m for m in models),
                "available_models": models,
            }
        except Exception as e:
            return {
                "mode":    "ollama",
                "running": False,
                "error":   str(e),
                "hint":    "Set LLM_API_KEY env var để dùng Groq/Gemini thay Ollama",
            }


def _detect_provider(base_url: str) -> str:
    """Detect tên provider từ URL để hiển thị thân thiện."""
    url = base_url.lower()
    if "groq"   in url: return "Groq"
    if "gemini" in url or "googleapis" in url: return "Google Gemini"
    if "openai" in url: return "OpenAI"
    if "openrouter" in url: return "OpenRouter"
    if "deepseek" in url: return "DeepSeek"
    if "anthropic" in url: return "Anthropic"
    return "Custom"
