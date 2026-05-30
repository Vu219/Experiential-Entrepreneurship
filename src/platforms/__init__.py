from abc import ABC, abstractmethod

class SocialPlatformConnector(ABC):
    @abstractmethod
    def connect(self) -> bool:
        """Kết nối tới API của nền tảng"""
        pass

    @abstractmethod
    def publish_post(self, media_spec: str, caption: str) -> dict:
        """Đăng tải bài viết lên nền tảng"""
        pass
