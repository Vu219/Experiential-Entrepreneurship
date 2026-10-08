"""Vietnamese marketing calendar — the predictable "trends" SMEs plan content around.

Holidays, gifting days and e-commerce double-day sales drive a large share of social
engagement in Vietnam, and unlike viral topics they are known in advance — so research
lists the moments in the coming weeks deterministically instead of hoping a search
surfaces them. Lunar-calendar holidays use a fixed Gregorian table (extend yearly).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Dict, List

# (month, day, name, note) — fixed Gregorian dates.
_FIXED = [
    (1, 1, "Tết Dương lịch", "Năm mới, tổng kết, mục tiêu"),
    (2, 14, "Valentine", "Quà tặng, cặp đôi"),
    (3, 8, "Quốc tế Phụ nữ 8/3", "Quà tặng, tôn vinh phụ nữ"),
    (4, 30, "Lễ 30/4 – 1/5", "Kỳ nghỉ dài, du lịch, khuyến mãi"),
    (6, 1, "Quốc tế Thiếu nhi 1/6", "Gia đình, trẻ em"),
    (6, 28, "Ngày Gia đình Việt Nam", "Gia đình, gắn kết"),
    (9, 2, "Quốc khánh 2/9", "Kỳ nghỉ, tự hào dân tộc"),
    (9, 9, "Sale 9.9", "Ngày đôi sàn TMĐT"),
    (10, 10, "Sale 10.10", "Ngày đôi sàn TMĐT"),
    (10, 20, "Phụ nữ Việt Nam 20/10", "Quà tặng, tri ân phụ nữ"),
    (10, 31, "Halloween", "Hoá trang, giới trẻ"),
    (11, 11, "Sale 11.11", "Ngày đôi lớn nhất năm"),
    (11, 20, "Nhà giáo Việt Nam 20/11", "Tri ân thầy cô"),
    (12, 12, "Sale 12.12", "Ngày đôi cuối năm"),
    (12, 24, "Giáng sinh", "Quà tặng, không khí lễ hội"),
]

# Lunar holidays → Gregorian date per year.
_LUNAR = {
    "Tết Nguyên Đán": ("Mùa mua sắm lớn nhất năm, sum họp", {
        2026: date(2026, 2, 17), 2027: date(2027, 2, 6), 2028: date(2028, 1, 26),
        2029: date(2029, 2, 13), 2030: date(2030, 2, 3),
    }),
    "Trung thu": ("Bánh trung thu, trẻ em, quà biếu", {
        2026: date(2026, 9, 25), 2027: date(2027, 9, 15), 2028: date(2028, 10, 3),
        2029: date(2029, 9, 22), 2030: date(2030, 9, 12),
    }),
}


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """n-th ``weekday`` (Mon=0) of a month."""
    first = date(year, month, 1)
    return first + timedelta(days=(weekday - first.weekday()) % 7 + 7 * (n - 1))


def _events_of(year: int) -> List[tuple]:
    events = [(date(year, m, d), name, note) for m, d, name, note in _FIXED]
    events.append((_nth_weekday(year, 5, 6, 2), "Ngày của Mẹ", "Tri ân mẹ"))
    events.append((_nth_weekday(year, 6, 6, 3), "Ngày của Cha", "Tri ân cha"))
    events.append((_nth_weekday(year, 11, 3, 4) + timedelta(days=1), "Black Friday", "Săn sale cuối năm"))
    for name, (note, by_year) in _LUNAR.items():
        if year in by_year:
            events.append((by_year[year], name, note))
    return events


def upcoming_moments(today: date, days_ahead: int = 45) -> List[Dict[str, object]]:
    """Moments within ``days_ahead`` days (today included), soonest first."""
    horizon = today + timedelta(days=days_ahead)
    moments = [
        {"date": d.isoformat(), "days_until": (d - today).days, "name": name, "note": note}
        for year in (today.year, today.year + 1)
        for d, name, note in _events_of(year)
        if today <= d <= horizon
    ]
    return sorted(moments, key=lambda m: m["days_until"])
