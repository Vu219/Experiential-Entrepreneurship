import random
from dataclasses import dataclass
from typing import Dict

@dataclass
class PostMetrics:
    views: int
    likes: int
    comments: int
    shares: int
    ctr: float
    conversion_rate: float

class AnalyticsSystem:
    def collect_metrics(self, post_id: str, platform: str) -> PostMetrics:
        print(f"📊 [Analytics] Thu thập dữ liệu tương tác từ {platform} cho bài đăng {post_id}...")
        # Simulating metrics gathered from platform API hooks
        return PostMetrics(
            views=random.randint(1000, 50000),
            likes=random.randint(50, 4000),
            comments=random.randint(5, 500),
            shares=random.randint(2, 300),
            ctr=round(random.uniform(0.01, 0.15), 4),
            conversion_rate=round(random.uniform(0.001, 0.05), 4)
        )

class StrategyOptimizer:
    def optimize_strategy(self, metrics_data: Dict[str, PostMetrics]) -> str:
        print("🧠 [Optimizer] Agent AI đang phân tích dữ liệu hiệu suất để cải thiện chiến lược...")
        best_platform = None
        best_ctr = -1.0
        
        for platform, metrics in metrics_data.items():
            if metrics.ctr > best_ctr:
                best_ctr = metrics.ctr
                best_platform = platform
                
        recommendation = (
            f"💡 Đề xuất tối ưu: Tập trung tăng tần suất đăng bài và phát triển video định dạng ngắn trên {best_platform} "
            f"do tỷ lệ click-through-rate (CTR) đạt mức tối ưu nhất ({best_ctr * 100:.2f}%)."
        )
        print(recommendation)
        return recommendation
