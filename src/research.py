from dataclasses import dataclass
from typing import List
from .brand import BrandPersona

@dataclass
class Trend:
    keyword: str
    platform: str
    relevance: str  # "Cao", "Trung bình", "Thấp"
    idea_concept: str

class TrendResearcher:
    def research_trends(self, persona: BrandPersona) -> List[Trend]:
        print(f"🔄 Đang nghiên cứu xu hướng cho ngành hàng: {persona.industry}...")
        # Simulating data collection for trends
        trends = [
            Trend(
                keyword="Một ngày làm...",
                platform="TikTok",
                relevance="Cao",
                idea_concept=f"Một ngày làm việc/trải nghiệm tại thương hiệu {persona.industry}"
            ),
            Trend(
                keyword="Before/After",
                platform="Instagram",
                relevance="Cao",
                idea_concept="Trước và sau khi trải nghiệm sản phẩm/dịch vụ"
            ),
            Trend(
                keyword="Tips nhanh",
                platform="LinkedIn",
                relevance="Trung bình",
                idea_concept=f"Mẹo hữu ích về {persona.industry} cho người đi làm"
            )
        ]
        # Filter trends based on connected platform list for the brand
        filtered_trends = [t for t in trends if t.platform in persona.platforms]
        return filtered_trends
