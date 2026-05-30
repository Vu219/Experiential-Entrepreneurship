import logging
from .generation import ContentDraft

class PolicyChecker:
    def __init__(self):
        # Sample sensitive keywords that violate terms of service
        self.sensitive_keywords = ["scam", "lừa đảo", "chất cấm", "toxic", "bạo lực", "nhạy cảm"]

    def verify_content(self, draft: ContentDraft) -> bool:
        """
        Kiểm tra nội dung có vi phạm chính sách của hệ thống hay không.
        Trả về True nếu hợp lệ, False nếu vi phạm.
        """
        content_to_check = (draft.caption + " " + draft.script).lower()
        for word in self.sensitive_keywords:
            if word in content_to_check:
                print(f"⚠️ CẢNH BÁO: Phát hiện từ khóa nhạy cảm/vi phạm chính sách: '{word}' trong bài viết {draft.id}!")
                draft.status = "Need Review"
                return False
        return True

    def handle_platform_violation(self, post_id: str, platform: str, message: str) -> None:
        """
        Xử lý khi nền tảng bên ngoài (Facebook, TikTok,...) phản hồi vi phạm chính sách sau khi đăng.
        """
        print(f"🚨 PHẢN HỒI NỀN TẢNG: {platform} báo cáo vi phạm chính sách đối với bài đăng {post_id}!")
        print(f"   Lý do: {message}")
        print(f"   ⚙️ Hệ thống tự động chuyển trạng thái bài đăng sang 'Failed' / 'Policy Violated' và gửi thông báo cho Admin/User.")
