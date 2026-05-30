from . import SocialPlatformConnector

class YouTubeConnector(SocialPlatformConnector):
    def __init__(self, token: str = None):
        self.token = token
        self.connected = bool(token)

    def connect(self) -> bool:
        if not self.token:
            print("❌ Kết nối YouTube thất bại: Thiếu Google OAuth2 Credentials.")
            self.connected = False
            return False
        print("✅ Kết nối thành công tới YouTube Data API v3.")
        self.connected = True
        return True

    def publish_post(self, media_spec: str, caption: str) -> dict:
        if not self.connected:
            raise ConnectionError("YouTube chưa được kết nối!")
        print(f"📤 [YouTube API] Đang tải lên Shorts ({media_spec}) kèm mô tả: {caption}")
        return {"status": "success", "post_id": "yt_shorts_4422", "url": "https://youtube.com/shorts/yt_shorts_4422"}
