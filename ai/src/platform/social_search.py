"""Keyword search on social platforms — real posts about the brand's niche (optional).

Each source is gated by its own credential and returns [] when it is missing or the call
fails — NEVER mock data: trend research must not reason over fabricated posts.
- YouTube search   : RapidAPI "yt-api" (RAPIDAPI_KEY; host YOUTUBE_RAPIDAPI_HOST).
- Instagram hashtag: RapidAPI scraper, host swappable (INSTAGRAM_RAPIDAPI_HOST, see
  INSTAGRAM_HASHTAG_API_PRESETS) — IG scraper APIs on RapidAPI die/change owner often.
- Threads keyword  : OFFICIAL Meta API (graph.threads.net /keyword_search) —
  THREADS_ACCESS_TOKEN with the threads_keyword_search permission. Free.

Item shape: ``{text, url, views, likes, comments, source}`` (counts 0 when unknown).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

# Instagram hashtag-search APIs on RapidAPI supported out of the box, keyed by host:
# (path, query param). Another host → also set INSTAGRAM_RAPIDAPI_PATH / _PARAM.
INSTAGRAM_HASHTAG_API_PRESETS: Dict[str, tuple] = {
    "instagram-social-api.p.rapidapi.com": ("/v1/hashtag", "hashtag"),
    "real-time-instagram-scraper-api1.p.rapidapi.com": ("/v2/hashtag_media", "hashtag"),
    "instagram-scraper-stable-api.p.rapidapi.com": ("/search_hashtag.php", "hashtag"),
    "instagram-looter2.p.rapidapi.com": ("/hashtag", "tag"),
    "instagram-scraper-api2.p.rapidapi.com": ("/v1/hashtag", "hashtag"),
}


def _env_secret(*names: str) -> Optional[str]:
    """First non-empty env value; .env.example placeholders ("your_...") count as unset."""
    for name in names:
        value = (os.getenv(name) or "").strip()
        if value and not value.startswith("your_"):
            return value
    return None


def _to_int(value: Any) -> int:
    """Counts may come back as strings ("123,456")."""
    if isinstance(value, (int, float)):
        return int(value)
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    return int(digits) if digits else 0


class SocialSearch:
    def __init__(self) -> None:
        self.rapidapi_key = _env_secret("RAPIDAPI_KEY", "TIKTOK_RAPIDAPI_KEY")
        self.youtube_host = os.getenv("YOUTUBE_RAPIDAPI_HOST", "yt-api.p.rapidapi.com")
        self.instagram_host = os.getenv("INSTAGRAM_RAPIDAPI_HOST", "instagram-social-api.p.rapidapi.com")
        preset = INSTAGRAM_HASHTAG_API_PRESETS.get(self.instagram_host, ("/v1/hashtag", "hashtag"))
        self.instagram_path = os.getenv("INSTAGRAM_RAPIDAPI_PATH") or preset[0]
        self.instagram_param = os.getenv("INSTAGRAM_RAPIDAPI_PARAM") or preset[1]
        self.threads_token = _env_secret("THREADS_ACCESS_TOKEN")
        self.threads_api_base = os.getenv("THREADS_API_BASE", "https://graph.threads.net/v1.0")

    @property
    def has_rapidapi_key(self) -> bool:
        return bool(self.rapidapi_key)

    @property
    def has_threads_token(self) -> bool:
        return bool(self.threads_token)

    def _rapidapi_get(self, host: str, path: str, params: Dict[str, Any]) -> Any:
        response = requests.get(
            f"https://{host}{path}",
            headers={"x-rapidapi-key": self.rapidapi_key, "x-rapidapi-host": host},
            params=params,
            timeout=15,
        )
        response.raise_for_status()
        return response.json()

    def youtube(self, keyword: str, region: Optional[str], limit: int = 5) -> List[Dict[str, Any]]:
        if not self.rapidapi_key:
            return []
        try:
            params: Dict[str, Any] = {"query": keyword}
            if region:
                params["geo"] = region.upper()
            data = self._rapidapi_get(self.youtube_host, "/search", params)
            items = []
            for entry in data.get("data") or []:
                video_id = entry.get("videoId")
                if not video_id:  # channel / playlist / section entries
                    continue
                items.append({
                    "text": entry.get("title", ""),
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "views": _to_int(entry.get("viewCount")),
                    "likes": 0,
                    "comments": 0,
                    "source": f"youtube_search:{keyword}",
                })
                if len(items) >= limit:
                    break
            return items
        except Exception as e:  # noqa: BLE001
            logger.warning("YouTube search failed for %r: %s", keyword, type(e).__name__)
            return []

    def instagram_hashtag(self, keyword: str, limit: int = 5) -> List[Dict[str, Any]]:
        if not self.rapidapi_key:
            return []
        tag = "".join((keyword or "").split()).lstrip("#")  # "mỹ phẩm" → "mỹphẩm"
        if not tag:
            return []
        try:
            data = self._rapidapi_get(self.instagram_host, self.instagram_path, {self.instagram_param: tag})
            items: List[Dict[str, Any]] = []
            seen: set = set()
            for m in _extract_instagram_medias(data):
                caption = m.get("caption")
                text = caption.get("text", "") if isinstance(caption, dict) else str(caption or "")
                code = m.get("code") or m.get("shortcode") or ""
                media_id = str(m.get("id") or m.get("pk") or code)
                if not media_id or media_id in seen or not text:
                    continue
                seen.add(media_id)
                items.append({
                    "text": text,
                    "url": f"https://www.instagram.com/p/{code}/" if code else "",
                    "views": _to_int(m.get("play_count") or m.get("view_count")),
                    "likes": _to_int(m.get("like_count")),
                    "comments": _to_int(m.get("comment_count")),
                    "source": f"instagram_hashtag:{keyword}",
                })
                if len(items) >= limit:
                    break
            return items
        except Exception as e:  # noqa: BLE001
            logger.warning("Instagram hashtag search failed for %r: %s", keyword, type(e).__name__)
            return []

    def threads(self, keyword: str, limit: int = 5) -> List[Dict[str, Any]]:
        """The official search returns no engagement counts — the posts are still real."""
        if not self.threads_token or not (keyword or "").strip():
            return []
        try:
            response = requests.get(
                f"{self.threads_api_base}/keyword_search",
                params={
                    "q": keyword.strip(),
                    "search_type": "TOP",
                    "fields": "id,text,permalink,timestamp",
                    "access_token": self.threads_token,
                },
                timeout=15,
            )
            response.raise_for_status()
            items = []
            for p in response.json().get("data") or []:
                if p.get("text"):
                    items.append({
                        "text": p["text"],
                        "url": p.get("permalink", ""),
                        "views": 0,
                        "likes": 0,
                        "comments": 0,
                        "source": f"threads_search:{keyword}",
                    })
                if len(items) >= limit:
                    break
            return items
        except Exception as e:  # noqa: BLE001
            logger.warning("Threads keyword search failed for %r: %s", keyword, type(e).__name__)
            return []


def _extract_instagram_medias(node: Any, out: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """Collect Instagram media dicts anywhere in a RapidAPI response — every scraper wraps
    the private-API media shape (like_count/comment_count + caption/code) differently."""
    if out is None:
        out = []
    if isinstance(node, dict):
        if ("like_count" in node or "comment_count" in node) and any(
                k in node for k in ("caption", "code", "shortcode")):
            out.append(node)
            return out  # don't descend into carousel children — avoids duplicates
        for value in node.values():
            _extract_instagram_medias(value, out)
    elif isinstance(node, list):
        for value in node:
            _extract_instagram_medias(value, out)
    return out
