from . import SocialPlatformConnector

class TikTokConnector(SocialPlatformConnector):
    def __init__(self, token: str = None):
        self.token = token
        self.connected = bool(token)

    def connect(self) -> bool:
        if not self.token:
            print("❌ Kết nối TikTok thất bại: Thiếu Access Token.")
            self.connected = False
            return False
        print("✅ Kết nối thành công tới TikTok API.")
        self.connected = True
        return True

    def publish_post(self, media_spec: str, caption: str) -> dict:
        if not self.connected:
            raise ConnectionError("TikTok chưa được kết nối!")
        print(f"📤 [TikTok API] Đang tải lên video dọc ({media_spec}) kèm caption: {caption}")
        return {"status": "success", "post_id": "tt_post_9988", "url": "https://tiktok.com/@user/video/tt_post_9988"}
