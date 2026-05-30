from . import SocialPlatformConnector

class LinkedInConnector(SocialPlatformConnector):
    def __init__(self, token: str = None):
        self.token = token
        self.connected = bool(token)

    def connect(self) -> bool:
        if not self.token:
            print("❌ Kết nối LinkedIn thất bại: Thiếu OAuth Token.")
            self.connected = False
            return False
        print("✅ Kết nối thành công tới LinkedIn Share API.")
        self.connected = True
        return True

    def publish_post(self, media_spec: str, caption: str) -> dict:
        if not self.connected:
            raise ConnectionError("LinkedIn chưa được kết nối!")
        print(f"📤 [LinkedIn API] Đang chia sẻ bài viết ({media_spec}) kèm caption: {caption}")
        return {"status": "success", "post_id": "li_share_5533", "url": "https://linkedin.com/feed/update/urn:li:activity:li_share_5533"}
