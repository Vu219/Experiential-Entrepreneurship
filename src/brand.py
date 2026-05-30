from dataclasses import dataclass
from typing import List, Dict

@dataclass
class BrandPersona:
    industry: str          # e.g., "Mỹ phẩm", "F&B", "Giáo dục"
    tone: str              # e.g., "Chuyên nghiệp", "Hài hước", "Trẻ trung"
    target_audience: str   # e.g., "Gen Z", "Dân văn phòng", "Sinh viên"
    goals: List[str]       # e.g., ["Tăng nhận diện", "Kéo traffic"]
    platforms: List[str]   # e.g., ["TikTok", "Facebook", "Instagram"]
    posting_frequency: str # e.g., "2 bài/ngày", "5 bài/tuần"
    preferred_hours: List[str] # e.g., ["08:00", "12:00", "20:00"]

class BrandPersonaManager:
    def __init__(self):
        self.personas: Dict[str, BrandPersona] = {}

    def setup_persona(self, user_id: str, persona: BrandPersona) -> bool:
        if not persona.industry or not persona.tone or not persona.target_audience:
            raise ValueError("Thiếu thông tin cấu hình bắt buộc")
        self.personas[user_id] = persona
        return True

    def get_persona(self, user_id: str) -> BrandPersona:
        return self.personas.get(user_id)
