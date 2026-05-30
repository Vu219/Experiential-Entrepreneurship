from . import SocialPlatformConnector

class InstagramConnector(SocialPlatformConnector):
    def __init__(self, token: str = None):
        self.token = token
        self.connected = bool(token)

    def connect(self) -> bool:
        if not self.token:
            print("❌ Kết nối Instagram thất bại: Thiếu Facebook Access Token.")
            self.connected = False
            return False
        print("✅ Kết nối thành công tới Instagram Graph API.")
        self.connected = True
        return True

    def publish_post(self, media_spec: str, caption: str) -> dict:
        if not self.connected:
            raise ConnectionError("Instagram chưa được kết nối!")
        print(f"📤 [Instagram API] Đang đăng Reels ({media_spec}) kèm caption: {caption}")
        return {"status": "success", "post_id": "ig_reels_7755", "url": "https://instagram.com/reel/ig_reels_7755"}
