"""
Criminal Network Analysis - Configuration

API keys are read from environment variables only.
"""

import os

from dotenv import load_dotenv

# Load .env
load_dotenv()


# =========================================================
# GROQ CONFIGURATION
# =========================================================

GROQ_API_KEY = os.environ.get(
    "GROQ_API_KEY",
    ""
)

GROQ_MODEL = os.environ.get(
    "GROQ_MODEL",
    "openai/gpt-oss-120b"
)

GROQ_API_URL = os.environ.get(
    "GROQ_API_URL",
    "https://api.groq.com/openai/v1/chat/completions"
)

GROQ_TIMEOUT_SECONDS = float(
    os.environ.get(
        "GROQ_TIMEOUT_SECONDS",
        "30"
    )
)

# Upload size limit: 15 MB max (DoS protection)
MAX_UPLOAD_BYTES = int(
    os.environ.get(
        "MAX_UPLOAD_BYTES",
        str(15 * 1024 * 1024)
    )
)


# =========================================================
# PATTERN DETECTION THRESHOLDS
# =========================================================

BROKER_BETWEENNESS_PERCENTILE = float(
    os.environ.get(
        "BROKER_BETWEENNESS_PERCENTILE",
        "0.80"
    )
)

DENSE_SUBGROUP_MIN_SIZE = int(
    os.environ.get(
        "DENSE_SUBGROUP_MIN_SIZE",
        "3"
    )
)

DENSE_SUBGROUP_DENSITY_THRESHOLD = float(
    os.environ.get(
        "DENSE_SUBGROUP_DENSITY_THRESHOLD",
        "0.6"
    )
)

REPEATED_COOCCURRENCE_MIN_EVENTS = int(
    os.environ.get(
        "REPEATED_COOCCURRENCE_MIN_EVENTS",
        "2"
    )
)


# =========================================================
# CORS CONFIGURATION
# =========================================================

DEFAULT_CORS = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000"
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    DEFAULT_CORS
).split(",")

# Remove accidental spaces
CORS_ORIGINS = [
    origin.strip()
    for origin in CORS_ORIGINS
    if origin.strip()
]