from __future__ import annotations
import logging
import requests
from src import config

logger = logging.getLogger(__name__)

def analyze_image(data_uri: str, api_key: str | None = None) -> str:
    """Extract structured objective visual features from an image Data URI.

    Used as a fallback for text-only foundation models.
    """
    key = api_key or config.MISTRAL_API_KEY
    if not key:
        return "[Image attached: visual inspection unavailable without configured API key]"

    prompt = (
        "Analyze this image with maximum detail and zero fictional bias:\n"
        "1. Primary Subjects: appearance, clothing, expressions, poses, colors.\n"
        "2. Setting & Environment: indoor/outdoor, objects, background layout, lighting.\n"
        "3. Visible Text & Graphics: transcribe any readable text, logos, or signs verbatim.\n"
        "4. Composition & Style: photo, illustration, screenshot, perspective."
    )

    try:
        url = "https://api.mistral.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "pixtral-12b-2409",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_uri}},
                    ],
                }
            ],
            "max_tokens": 600,
        }
        resp = requests.post(url, json=payload, headers=headers, timeout=15.0)
        if resp.status_code == 200:
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        else:
            logger.warning("Mistral vision API returned %d: %s", resp.status_code, resp.text)
            return "[Image attached: unable to parse visual details]"
    except Exception as e:
        logger.error("Image analysis error: %s", e)
        return f"[Image attached: analysis error: {e}]"
