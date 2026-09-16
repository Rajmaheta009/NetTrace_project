"""
Centralized low-level Groq client.

All AI calls from extraction.py and summary.py go through
this module.

The frontend never receives the Groq API key.
"""

import httpx

from app.config import (
    GROQ_API_KEY,
    GROQ_API_URL,
    GROQ_MODEL,
    GROQ_TIMEOUT_SECONDS,
)


class AIUnavailableError(Exception):
    """
    Raised when the Groq API is unavailable or returns
    an unexpected response.
    """
    pass


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
    # 2. Request body
    # -----------------------------------------------------

    payload = {
        "model": GROQ_MODEL,

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

        # Lower temperature = more deterministic extraction
        "temperature": 0.1,

        # Ask Groq to return valid JSON
        "response_format": {
            "type": "json_object"
        },
    }

    # -----------------------------------------------------
    # 3. Authentication headers
    # -----------------------------------------------------

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    # -----------------------------------------------------
    # 4. Call Groq with Automatic Model Fallback
    # -----------------------------------------------------

    models_to_try = [GROQ_MODEL]
    for fallback in ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]:
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    response = None
    last_status_exc = None

    for candidate_model in models_to_try:
        payload["model"] = candidate_model
        try:
            with httpx.Client(timeout=GROQ_TIMEOUT_SECONDS) as client:
                resp = client.post(
                    GROQ_API_URL,
                    headers=headers,
                    json=payload,
                )
            if resp.status_code == 404:
                # Try next candidate model
                continue
            resp.raise_for_status()
            response = resp
            break
        except httpx.TimeoutException as exc:
            raise AIUnavailableError("Groq request timed out.") from exc
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                last_status_exc = exc
                continue
            raise AIUnavailableError(
                f"Groq API returned HTTP {exc.response.status_code}: {exc.response.text}"
            ) from exc
        except httpx.HTTPError as exc:
            raise AIUnavailableError(f"Groq request failed: {exc}") from exc

    if response is None:
        if last_status_exc is not None:
            raise AIUnavailableError(
                f"Groq API returned HTTP {last_status_exc.response.status_code}: {last_status_exc.response.text}"
            ) from last_status_exc
        raise AIUnavailableError("No available Groq model responded.")


    # -----------------------------------------------------
    # 8. Parse JSON response
    # -----------------------------------------------------

    try:

        data = response.json()

    except ValueError as exc:

        raise AIUnavailableError(
            "Groq returned invalid JSON."
        ) from exc

    # -----------------------------------------------------
    # 9. Extract generated text
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

        return content

    except (
        KeyError,
        IndexError,
        TypeError,
        ValueError,
    ) as exc:

        raise AIUnavailableError(
            f"Unexpected Groq response shape: {data}"
        ) from exc