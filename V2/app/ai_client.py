"""
Centralized low-level Groq client.

All AI calls from extraction.py and summary.py go through
this module.

The frontend never receives the Groq API key.
"""

import json
import logging
import re
import httpx

from app.config import (
    GROQ_API_KEY,
    GROQ_API_URL,
    GROQ_MODEL,
    GROQ_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)


class AIUnavailableError(Exception):
    """
    Raised when the Groq API is unavailable or returns
    an unexpected response.
    """
    pass


def extract_clean_json_str(raw: str) -> str:
    """
    Strips markdown code fences (```json ... ```) or trims non-JSON preambles
    to extract the raw JSON object string.
    """
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end >= start:
        return text[start : end + 1]
    return text


def call_groq_json(
    system_prompt: str,
    user_content: str
) -> str:
    """
    Calls Groq Chat Completions and returns the generated
    response text.

    The system prompt contains trusted backend instructions.
    The user content remains a separate user message.
    """

    # -----------------------------------------------------
    # 1. Check API key
    # -----------------------------------------------------

    if not GROQ_API_KEY:
        raise AIUnavailableError(
            "GROQ_API_KEY is not configured."
        )

    # -----------------------------------------------------
    # 2. Authentication headers
    # -----------------------------------------------------

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    # -----------------------------------------------------
    # 3. Call Groq with Automatic Model Fallback & Grammar Retry
    # -----------------------------------------------------

    models_to_try = [GROQ_MODEL]
    for fallback in ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]:
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    response = None
    last_status_exc = None

    for candidate_model in models_to_try:
        payload = {
            "model": candidate_model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_content,
                },
            ],
            "temperature": 0.1,
            "max_tokens": 2500,
            "response_format": {
                "type": "json_object"
            },
        }

        try:
            with httpx.Client(timeout=GROQ_TIMEOUT_SECONDS) as client:
                resp = client.post(
                    GROQ_API_URL,
                    headers=headers,
                    json=payload,
                )

            # Check if Groq's grammar validator failed on strict JSON mode
            if resp.status_code == 400 and ("json_validate_failed" in resp.text or "validate JSON" in resp.text or "generate JSON" in resp.text):
                logger.warning(
                    f"Groq strict JSON validation failed on model {candidate_model}. Retrying unconstrained..."
                )
                unconstrained_payload = dict(payload)
                unconstrained_payload.pop("response_format", None)
                unconstrained_payload["messages"] = [
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": f"{user_content}\n\nIMPORTANT: Return ONLY valid JSON format matching the requested schema. Do NOT include markdown fences, comments, or conversational text.",
                    },
                ]
                with httpx.Client(timeout=GROQ_TIMEOUT_SECONDS) as client:
                    resp = client.post(
                        GROQ_API_URL,
                        headers=headers,
                        json=unconstrained_payload,
                    )

            # If this candidate model failed with a recoverable status, try the next candidate
            if resp.status_code in (400, 404, 413, 429, 500, 502, 503):
                last_status_exc = httpx.HTTPStatusError(
                    f"Groq candidate model {candidate_model} returned HTTP {resp.status_code}: {resp.text}",
                    request=resp.request,
                    response=resp,
                )
                continue

            resp.raise_for_status()
            response = resp
            break

        except httpx.TimeoutException as exc:
            last_status_exc = exc
            continue
        except httpx.HTTPStatusError as exc:
            last_status_exc = exc
            if exc.response.status_code in (400, 404, 413, 429, 500, 502, 503):
                continue
            raise AIUnavailableError(
                f"Groq API returned HTTP {exc.response.status_code}: {exc.response.text}"
            ) from exc
        except httpx.HTTPError as exc:
            last_status_exc = exc
            continue

    if response is None:
        if last_status_exc is not None:
            if isinstance(last_status_exc, httpx.HTTPStatusError):
                raise AIUnavailableError(
                    f"Groq API returned HTTP {last_status_exc.response.status_code}: {last_status_exc.response.text}"
                ) from last_status_exc
            raise AIUnavailableError(f"Groq request failed: {last_status_exc}") from last_status_exc
        raise AIUnavailableError("No available Groq model responded.")

    # -----------------------------------------------------
    # 4. Parse JSON response
    # -----------------------------------------------------

    try:
        data = response.json()
    except ValueError as exc:
        raise AIUnavailableError(
            "Groq returned invalid JSON."
        ) from exc

    # -----------------------------------------------------
    # 5. Extract generated text
    # -----------------------------------------------------

    try:
        content = (
            data["choices"][0]
                 ["message"]
                 ["content"]
        )

        if not content:
            raise ValueError(
                "Empty Groq response."
            )

        return extract_clean_json_str(content)

    except (
        KeyError,
        IndexError,
        TypeError,
        ValueError,
    ) as exc:
        raise AIUnavailableError(
            f"Unexpected Groq response shape: {data}"
        ) from exc