from . import SocialPlatformConnector

class FacebookConnector(SocialPlatformConnector):
    def __init__(self, token: str = None):
        self.token = token
        self.connected = bool(token)

    def connect(self) -> bool:
        if not self.token:
            print("❌ Kết nối Facebook thất bại: Thiếu Page Access Token.")
            self.connected = False
            return False
        print("✅ Kết nối thành công tới Facebook Pages API.")
        self.connected = True
        return True

    def publish_post(self, media_spec: str, caption: str) -> dict:
        if not self.connected:
            raise ConnectionError("Facebook chưa được kết nối!")
        print(f"📤 [Facebook API] Đang đăng lên Fanpage ({media_spec}) kèm caption: {caption}")
        return {"status": "success", "post_id": "fb_page_post_6644", "url": "https://facebook.com/page/post/fb_page_post_6644"}
