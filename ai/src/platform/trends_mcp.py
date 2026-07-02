"""
Cross-platform trending-content connector (YouTube, TikTok, Instagram Reels).

Adapted from the Trends-MCP project (https://github.com/rugvedp/Trends-MCP), which
exposes these lookups as MCP tools. The same data sources are integrated here as a
plain connector so the Trend Research agent can mix cross-platform trending signal
with the Facebook signal (FR-19..FR-22). This is a research data source only —
publishing stays limited to Facebook / Instagram / Threads.

Tool mapping (Trends-MCP -> this module):
- get_yt_trending_global / get_yt_trending_by_region -> fetch_youtube_trending()
- get_comments_yt                                    -> fetch_youtube_comments()
- get_yt_video_info                                  -> fetch_youtube_video_info()
- tiktok_trending_global                             -> fetch_tiktok_trending()
- get_this_weeks_reels_trends                        -> fetch_reels_trends()

Data sources & credentials:
- YouTube: yt-dlp + youtube-comment-downloader (public data, no API key).
- TikTok: RapidAPI "tiktok-best-experience" endpoint — requires TIKTOK_RAPIDAPI_KEY.
- Instagram Reels trends: parsed from Later.com's public weekly roundup.

Like FacebookTrendAnalyzer, every fetcher falls back to mock data when credentials
are missing or a live call fails, so trend research stays demoable offline.
"""

import datetime
import logging
import os
from typing import Any, Dict, List, Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()


class TrendsMCPConnector:
    """
    Fetches trending content from YouTube, TikTok, and Instagram Reels and
    normalizes it to the same internal item shape used by FacebookTrendAnalyzer
    (text / likes_count / comments_count / shares_count / views_count / type /
    source), so all signal can be aggregated by `analyze_trends`.
    """

    TIKTOK_API_HOST = "tiktok-best-experience.p.rapidapi.com"
    REELS_TRENDS_URL = "https://later.com/blog/instagram-reels-trends/"

    def __init__(
        self,
        tiktok_api_key: Optional[str] = None,
        use_mock_fallback: bool = True,
    ):
        """
        Args:
            tiktok_api_key: RapidAPI key for the TikTok trending endpoint. If None,
                            read from environment variable 'TIKTOK_RAPIDAPI_KEY'.
            use_mock_fallback: If True, falls back to simulated data when a key is
                               missing or a live fetch fails.
        """
        self.tiktok_api_key = tiktok_api_key or os.getenv("TIKTOK_RAPIDAPI_KEY")
        self.use_mock_fallback = use_mock_fallback

        if not self.tiktok_api_key:
            if self.use_mock_fallback:
                logger.warning(
                    "No TIKTOK_RAPIDAPI_KEY found in environment. TikTok trending will use MOCK FALLBACK mode."
                )
            else:
                logger.error("No TikTok RapidAPI key provided. TikTok API calls will fail.")

    # ==========================================
    # YouTube (yt-dlp / youtube-comment-downloader)
    # ==========================================

    def fetch_youtube_trending(
        self, region: Optional[str] = None, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Fetch trending YouTube videos, globally or for an ISO region code (e.g. 'VN').

        Uses yt-dlp flat extraction of the public trending feed — no API key needed.
        NOTE: YouTube retired the /feed/trending page in mid-2025, so the live fetch
        (inherited from Trends-MCP) currently falls back to mock data.
        """
        try:
            import yt_dlp  # heavy import — only load for live fetches

            url = "https://www.youtube.com/feed/trending"
            if region:
                url += f"?gl={region.upper()}"
            opts = {
                "extract_flat": True,
                "force_generic_extractor": True,
                "quiet": True,
                "socket_timeout": 15,
            }
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)

            entries = [e for e in (info.get("entries") or []) if e.get("id")][:limit]
            if not entries:
                raise RuntimeError("no trending entries parsed from the feed")

            normalized = []
            for entry in entries:
                video_id = entry["id"]
                normalized.append({
                    "id": f"yt_{video_id}",
                    "video_id": video_id,
                    "text": entry.get("title", ""),
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "likes_count": 0,
                    "comments_count": 0,
                    "shares_count": 0,
                    "views_count": int(entry.get("view_count") or 0),
                    "type": "video",
                    "source": "youtube_trending",
                    "raw": {},
                })
            return normalized

        except Exception as e:
            logger.error(f"Failed to fetch YouTube trending ({region or 'global'}): {e}")
            if self.use_mock_fallback:
                logger.info("Falling back to MOCK data for YouTube trending.")
                return self._generate_mock_youtube_trending(limit)
            raise

    def fetch_youtube_comments(self, video_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch public comments of a YouTube video, normalized like Facebook comments."""
        try:
            from youtube_comment_downloader import YoutubeCommentDownloader

            downloader = YoutubeCommentDownloader()
            comments: List[Dict[str, Any]] = []
            for c in downloader.get_comments_from_url(
                f"https://www.youtube.com/watch?v={video_id}"
            ):
                comments.append({
                    "id": f"yt_comment_{video_id}_{len(comments)}",
                    "text": c.get("text", ""),
                    "created_time": c.get("time", ""),
                    "likes_count": 0,
                    "parent_id": f"yt_{video_id}",
                    "type": "comment",
                    "raw": {},
                })
                if len(comments) >= limit:
                    break
            return comments

        except Exception as e:
            logger.error(f"Failed to fetch YouTube comments for {video_id}: {e}")
            if self.use_mock_fallback:
                logger.info("Falling back to MOCK data for YouTube comments.")
                return self._generate_mock_youtube_comments(video_id, limit)
            raise

    def fetch_youtube_video_info(self, url: str) -> Optional[Dict[str, Any]]:
        """Fetch metadata of a single YouTube video (title, channel, views, likes...)."""
        try:
            import yt_dlp

            opts = {"quiet": True, "skip_download": True, "socket_timeout": 15}
            with yt_dlp.YoutubeDL(opts) as ydl:
                i = ydl.extract_info(url, download=False)
            return {
                "title": i.get("title", ""),
                "channel": i.get("uploader", ""),
                "description": i.get("description", ""),
                "views": int(i.get("view_count") or 0),
                "likes": int(i.get("like_count") or 0),
                "upload_date": i.get("upload_date", ""),
                "duration_seconds": int(i.get("duration") or 0),
                "url": i.get("webpage_url", url),
            }

        except Exception as e:
            logger.error(f"Failed to fetch YouTube video info for {url}: {e}")
            if self.use_mock_fallback:
                logger.info("Falling back to MOCK data for YouTube video info.")
                return self._generate_mock_youtube_video_info(url)
            raise

    # ==========================================
    # TikTok (RapidAPI)
    # ==========================================

    def fetch_tiktok_trending(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Fetch globally trending TikTok videos with engagement metrics and hashtags.

        Requires TIKTOK_RAPIDAPI_KEY (RapidAPI 'tiktok-best-experience').
        """
        if not self.tiktok_api_key:
            if self.use_mock_fallback:
                return self._generate_mock_tiktok_trending(limit)
            raise ValueError("TikTok RapidAPI key required. Set TIKTOK_RAPIDAPI_KEY.")

        try:
            headers = {
                "x-rapidapi-key": self.tiktok_api_key,
                "x-rapidapi-host": self.TIKTOK_API_HOST,
            }
            response = requests.get(
                f"https://{self.TIKTOK_API_HOST}/trending", headers=headers, timeout=15
            )
            response.raise_for_status()
            data = response.json()
            if data.get("status") != "ok" or "data" not in data:
                raise RuntimeError(f"unexpected TikTok API response status: {data.get('status')}")

            videos = data["data"].get("list", [])[:limit]
            return [self._normalize_tiktok_video(v) for v in videos]

        except Exception as e:
            logger.error(f"Failed to fetch TikTok trending: {e}")
            if self.use_mock_fallback:
                logger.info("Falling back to MOCK data for TikTok trending.")
                return self._generate_mock_tiktok_trending(limit)
            raise

    def _normalize_tiktok_video(self, video: Dict[str, Any]) -> Dict[str, Any]:
        """Map a raw TikTok API video to the normalized internal item shape."""
        hashtags = {
            tag["cha_name"] for tag in video.get("cha_list") or [] if tag.get("cha_name")
        }
        hashtags.update(
            tag["hashtag_name"]
            for tag in video.get("text_extra") or []
            if tag.get("type") == 1 and tag.get("hashtag_name")
        )

        # Append hashtags missing from the description so hashtag mining sees them.
        text = video.get("desc") or ""
        extra_tags = " ".join(f"#{t}" for t in sorted(hashtags) if f"#{t}" not in text)
        if extra_tags:
            text = f"{text} {extra_tags}".strip()

        stats = video.get("statistics", {})
        return {
            "id": f"tiktok_{video.get('aweme_id', '')}",
            "text": text,
            "url": video.get("share_url", ""),
            "likes_count": stats.get("digg_count", 0),
            "comments_count": stats.get("comment_count", 0),
            "shares_count": stats.get("share_count", 0),
            "views_count": stats.get("play_count", 0),
            "type": "video",
            "source": "tiktok_trending",
            "raw": {},
        }

    # ==========================================
    # Instagram Reels trends (Later.com roundup)
    # ==========================================

    def fetch_reels_trends(self) -> List[Dict[str, Any]]:
        """
        Fetch this week's curated Instagram Reels trends (name, date, description)
        from Later.com's public roundup. Trends older than 30 days are skipped.

        Returns curated trend descriptions (not post items) — feed these to the LLM
        as-is rather than through engagement aggregation.
        """
        try:
            r = requests.get(
                self.REELS_TRENDS_URL,
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=15,
            )
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            today = datetime.date.today()

            trends = []
            for h in soup.select("h3"):
                heading = h.get_text(strip=True)
                if not heading.startswith("Trend:"):
                    continue
                try:
                    name, date_str = heading[len("Trend:"):].split("—")
                    trend_date = datetime.datetime.strptime(date_str.strip(), "%B %d, %Y").date()
                    if (today - trend_date).days > 30:
                        continue
                    ps = h.find_next_siblings("p", limit=2)
                    trends.append({
                        "date": str(trend_date),
                        "trend": name.strip(),
                        "description": ps[0].get_text(strip=True) if ps else "",
                        "posts_info": ps[1].get_text(strip=True) if len(ps) > 1 else "",
                    })
                except ValueError:
                    continue

            # An empty parse almost always means the blog layout changed, not that
            # there are no trends this week — treat it like a failed fetch.
            if not trends:
                raise RuntimeError("no recent trends parsed from the roundup page")
            return trends

        except Exception as e:
            logger.error(f"Failed to fetch Instagram Reels trends: {e}")
            if self.use_mock_fallback:
                logger.info("Falling back to MOCK data for Instagram Reels trends.")
                return self._generate_mock_reels_trends()
            raise

    # ==========================================
    # MOCK DATA GENERATORS (Development support)
    # ==========================================

    def _generate_mock_youtube_trending(self, limit: int) -> List[Dict[str, Any]]:
        """Simulates the YouTube trending feed (titles + view counts only)."""
        titles = [
            ("Thử thách skincare 7 ngày cùng chuyên gia da liễu — kết quả gây sốc!", 1_250_000),
            ("Review TẤT TẦN TẬT bộ sưu tập son hot nhất hè này | Beauty Vlog", 480_000),
            ("GRWM: Makeup trong 10 phút đi làm mà vẫn xinh 💄", 320_000),
            ("Vlog: Một ngày làm chủ tiệm mỹ phẩm nhỏ — behind the scenes", 150_000),
            ("Top 5 xu hướng làm đẹp thuần chay đang viral toàn cầu", 890_000),
        ]
        videos = []
        for i in range(min(limit, len(titles))):
            title, views = titles[i]
            videos.append({
                "id": f"yt_mock_video_{i}",
                "video_id": f"mock_video_{i}",
                "text": title,
                "url": f"https://www.youtube.com/watch?v=mock_video_{i}",
                "likes_count": 0,
                "comments_count": 0,
                "shares_count": 0,
                "views_count": views,
                "type": "video",
                "source": "youtube_trending",
                "raw": {},
            })
        return videos

    def _generate_mock_youtube_comments(self, video_id: str, limit: int) -> List[Dict[str, Any]]:
        """Simulates YouTube comments reacting to trending beauty content."""
        sample_comments = [
            "Da mình nhạy cảm mà dùng theo routine này thấy cải thiện hẳn luôn!",
            "Xin link mua sản phẩm ở phút 3:20 với ạ 🙏",
            "Trend son thuần chay năm nay đúng là mạnh thật sự.",
            "Makeup 10 phút mà xinh vậy thì mai mình thử liền.",
            "Chờ mãi video behind the scenes như này, làm thêm phần 2 đi chị!",
        ]
        return [
            {
                "id": f"yt_comment_{video_id}_{i}",
                "text": sample_comments[i % len(sample_comments)],
                "created_time": "1 day ago",
                "likes_count": 0,
                "parent_id": f"yt_{video_id}",
                "type": "comment",
                "raw": {},
            }
            for i in range(min(limit, 10))
        ]

    def _generate_mock_youtube_video_info(self, url: str) -> Dict[str, Any]:
        """Simulates single-video metadata."""
        return {
            "title": "Top 5 xu hướng làm đẹp thuần chay đang viral toàn cầu",
            "channel": "Beauty Insider VN",
            "description": "Cùng điểm qua 5 xu hướng vegan beauty nổi bật nhất. #VeganBeauty #XuHuong",
            "views": 890_000,
            "likes": 45_000,
            "upload_date": "20260628",
            "duration_seconds": 612,
            "url": url,
        }

    def _generate_mock_tiktok_trending(self, limit: int) -> List[Dict[str, Any]]:
        """Simulates trending TikTok videos with engagement metrics and hashtags."""
        samples = [
            ("POV: em son mới về là phải swatch liền cho cả nhà xem 💋 #SonMoi #SwatchSon #BeautyTok", 2_400_000, 310_000, 8_200, 15_000),
            ("Biến hình theo trend 'Glow Up 2026' — ai đu trend chưa? ✨ #GlowUp2026 #BienHinh #Trend", 5_100_000, 720_000, 21_000, 43_000),
            ("Skincare routine tối giản cho da dầu mụn, 3 bước là đủ! #SkincareToiGian #DaDauMun", 1_800_000, 260_000, 12_500, 9_800),
            ("Thử món 'matcha strawberry latte' đang viral — 10 điểm không nhưng! #MatchaLatte #FoodTok", 3_600_000, 540_000, 17_000, 28_000),
        ]
        videos = []
        for i in range(min(limit, len(samples))):
            desc, plays, likes, comments, shares = samples[i]
            videos.append({
                "id": f"tiktok_mock_{i}",
                "text": desc,
                "url": f"https://www.tiktok.com/@mock/video/{i}",
                "likes_count": likes,
                "comments_count": comments,
                "shares_count": shares,
                "views_count": plays,
                "type": "video",
                "source": "tiktok_trending",
                "raw": {},
            })
        return videos

    def _generate_mock_reels_trends(self) -> List[Dict[str, Any]]:
        """Simulates this week's curated Instagram Reels trends."""
        today = datetime.date.today()
        samples = [
            ("Nostalgia Cut", "Creators pair childhood photos with a slow-zoom transition into the present day.", "Best for brand-story and founder-journey content."),
            ("5-Second Tutorial", "Ultra-short how-to Reels that deliver one tip before the viewer can scroll away.", "Works well for beauty tips and product demos."),
            ("Sound-On Unboxing", "ASMR-style unboxings using the trending audio, letting packaging sounds carry the video.", "Popular with small product brands this week."),
        ]
        return [
            {
                "date": str(today - datetime.timedelta(days=2 + i * 3)),
                "trend": name,
                "description": description,
                "posts_info": info,
            }
            for i, (name, description, info) in enumerate(samples)
        ]


# ==========================================
# Run Demonstration
# ==========================================
if __name__ == "__main__":
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

    print("--- Running Trends-MCP Connector Standalone Test ---")
    connector = TrendsMCPConnector(use_mock_fallback=True)

    print("\n1. YouTube trending (global):")
    for v in connector.fetch_youtube_trending(limit=5):
        print(f" - [{v['views_count']:,} views] {v['text'][:70]}")

    print("\n2. TikTok trending:")
    for v in connector.fetch_tiktok_trending(limit=4):
        print(f" - [plays: {v['views_count']:,}, likes: {v['likes_count']:,}] {v['text'][:70]}")

    print("\n3. Instagram Reels trends (curated):")
    for t in connector.fetch_reels_trends():
        print(f" - [{t['date']}] {t['trend']}: {t['description'][:70]}")
