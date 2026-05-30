import datetime
from typing import Dict, List, Any
from .generation import ContentDraft
from .formatter import FormattedPost
from .platforms.tiktok import TikTokConnector
from .platforms.instagram import InstagramConnector
from .platforms.facebook import FacebookConnector
from .platforms.linkedin import LinkedInConnector
from .platforms.youtube import YouTubeConnector

class PostScheduler:
    def __init__(self, platform_tokens: Dict[str, str] = None):
        self.posts_queue: List[Dict[str, Any]] = []
        tokens = platform_tokens or {}
        
        # Initialize platform connectors
        self.connectors = {
            "TikTok": TikTokConnector(tokens.get("TikTok")),
            "Instagram": InstagramConnector(tokens.get("Instagram")),
            "Facebook": FacebookConnector(tokens.get("Facebook")),
            "LinkedIn": LinkedInConnector(tokens.get("LinkedIn")),
            "YouTube": YouTubeConnector(tokens.get("YouTube")),
        }
        
        # Auto-connect available tokens
        for platform, connector in self.connectors.items():
            if connector.token:
                connector.connect()

    def schedule_post(self, draft: ContentDraft, formatted_posts: List[FormattedPost], scheduled_time: datetime.datetime) -> None:
        for fp in formatted_posts:
            post_item = {
                "draft_id": draft.id,
                "platform": fp.platform,
                "content": fp,
                "scheduled_time": scheduled_time,
                "status": "Scheduled",
                "post_id": None,
                "url": None
            }
            self.posts_queue.append(post_item)
            print(f"📅 [Scheduler] Đã lên lịch bài đăng {draft.id} trên {fp.platform} vào lúc {scheduled_time.strftime('%Y-%m-%d %H:%M:%S')}")

    def execute_posting(self, current_time: datetime.datetime) -> List[Dict[str, Any]]:
        posted_items = []
        for post in self.posts_queue:
            if post["status"] == "Scheduled" and current_time >= post["scheduled_time"]:
                post["status"] = "Posting"
                platform = post["platform"]
                formatted_post: FormattedPost = post["content"]
                connector = self.connectors.get(platform)
                
                print(f"🚀 [Queue] Đến giờ đăng bài! Đang đẩy bài viết {post['draft_id']} lên {platform}...")
                
                if not connector or not connector.connected:
                    post["status"] = "Failed"
                    print(f"❌ [Error] Đăng bài thất bại trên {platform}: Tài khoản chưa được kết nối hoặc Access Token không hợp lệ.")
                    continue
                
                try:
                    res = connector.publish_post(formatted_post.media_spec, f"{formatted_post.caption} {' '.join(['#' + t for t in formatted_post.hashtags])}")
                    if res.get("status") == "success":
                        post["status"] = "Posted"
                        post["post_id"] = res["post_id"]
                        post["url"] = res["url"]
                        posted_items.append(post)
                        print(f"✅ [Success] Đăng thành công trên {platform}! ID: {post['post_id']}, Link: {post['url']}")
                    else:
                        post["status"] = "Failed"
                        print(f"❌ [Error] Đăng bài thất bại trên {platform}.")
                except Exception as e:
                    post["status"] = "Failed"
                    print(f"❌ [Error] Xảy ra ngoại lệ khi đăng bài trên {platform}: {e}")
                    
        return posted_items
