"""Google Trends "Trending now" — what a country is searching for in the last ~24h.

Public RSS feed (https://trends.google.com/trending/rss?geo=VN): no key, no quota, real
data. Each item = a search query with its approximate traffic and the news articles
Google attaches to it, which gives trend research a dated, verifiable "what is hot in
Vietnam today" signal for newsjacking / topical content.

Like every trend source: failures are logged and return [] — research continues.
"""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List

import requests

logger = logging.getLogger(__name__)

RSS_URL = "https://trends.google.com/trending/rss"
_HT = "{https://trends.google.com/trending/rss}"


def fetch_trending_searches(geo: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Top trending searches of ``geo`` (ISO 3166, e.g. "VN"), most recent first.

    Item: ``{query, traffic, published (ISO-8601 or ""), news: [{title, url, source}]}``.
    """
    try:
        response = requests.get(
            RSS_URL,
            params={"geo": geo.upper()},
            headers={"User-Agent": "Mozilla/5.0 (AIMA trend research)"},
            timeout=10,
        )
        response.raise_for_status()
        return parse_rss(response.content, limit)
    except Exception as e:  # noqa: BLE001 — one failing source never fails the session
        logger.warning("Google Trends RSS failed for %s: %s", geo, type(e).__name__)
        return []


def parse_rss(xml: bytes, limit: int) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for node in ET.fromstring(xml).iter("item"):
        query = (node.findtext("title") or "").strip()
        if not query:
            continue
        news = [
            {
                "title": (n.findtext(f"{_HT}news_item_title") or "").strip(),
                "url": (n.findtext(f"{_HT}news_item_url") or "").strip(),
                "source": (n.findtext(f"{_HT}news_item_source") or "").strip(),
            }
            for n in node.findall(f"{_HT}news_item")
        ]
        items.append({
            "query": query,
            "traffic": (node.findtext(f"{_HT}approx_traffic") or "").strip(),
            "published": _iso(node.findtext("pubDate")),
            "news": [n for n in news if n["title"] and n["url"]][:2],
        })
        if len(items) >= limit:
            break
    return items


def _iso(rfc822: str | None) -> str:
    try:
        return parsedate_to_datetime(rfc822).isoformat() if rfc822 else ""
    except (TypeError, ValueError):
        return ""
