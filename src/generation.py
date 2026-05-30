from dataclasses import dataclass
from typing import List
from .brand import BrandPersona

@dataclass
class ContentDraft:
    id: str
    idea: str
    script: str
    caption: str
    hashtags: List[str]
    media_prompt: str
    cta: str
    status: str  # "Draft", "Need Review", "Approved"

class ContentGenerator:
    def generate_content(self, persona: BrandPersona, idea: str) -> ContentDraft:
        print(f"🤖 Đang tạo nội dung dựa trên brand voice: '{persona.tone}'...")
        # Simulating generation of content drafts
        draft = ContentDraft(
            id="draft_content_101",
            idea=idea,
            script=f"[Kịch bản video dọc] Giọng đọc {persona.tone}: Hãy bắt đầu ngày mới cùng chúng tôi!",
            caption=f"Bí mật đằng sau dịch vụ hàng đầu về {persona.industry} của chúng tôi là gì? 🤔 Hãy xem hết video nhé!",
            hashtags=["xuhuong", persona.industry.lower(), persona.tone.lower()],
            media_prompt=f"A high-quality 9:16 video showing modern environment for {persona.industry}",
            cta="Nhấn vào link bio để nhận voucher giảm giá hôm nay!",
            status="Draft"
        )
        return draft
