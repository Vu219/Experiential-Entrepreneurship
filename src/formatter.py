from dataclasses import dataclass
from typing import List
from .generation import ContentDraft

@dataclass
class FormattedPost:
    platform: str
    media_spec: str      # e.g., "9:16 vertical video", "1:1 image"
    caption: str
    hashtags: List[str]

class PlatformFormatter:
    def format_post(self, draft: ContentDraft, platform: str) -> FormattedPost:
        print(f"📐 Đang định dạng bài viết cho nền tảng: {platform}...")
        
        if platform == "TikTok":
            return FormattedPost(
                platform="TikTok",
                media_spec="Video dọc 9:16, tối đa 60 giây",
                caption=draft.caption[:150],  # Short caption rule
                hashtags=draft.hashtags + ["tiktoktrend"]
            )
        elif platform == "Instagram":
            return FormattedPost(
                platform="Instagram",
                media_spec="Video dọc 9:16 (Instagram Reels)",
                caption=f"{draft.caption}\n\n📸 {draft.cta}",
                hashtags=draft.hashtags + ["instadaily", "reels"]
            )
        elif platform == "Facebook":
            return FormattedPost(
                platform="Facebook",
                media_spec="Video dọc/ngang hoặc Album ảnh",
                caption=f"{draft.caption}\n\n🔗 Click để đặt mua: {draft.cta}",
                hashtags=draft.hashtags
            )
        elif platform == "LinkedIn":
            return FormattedPost(
                platform="LinkedIn",
                media_spec="Tài liệu PDF hoặc Hình ảnh đính kèm",
                caption=f"Góc nhìn chuyên môn: {draft.caption}",
                hashtags=[tag for tag in draft.hashtags if tag not in ["xuhuong", "trend"]]
            )
        else:
            return FormattedPost(
                platform=platform,
                media_spec="Tiêu chuẩn",
                caption=draft.caption,
                hashtags=draft.hashtags
            )
