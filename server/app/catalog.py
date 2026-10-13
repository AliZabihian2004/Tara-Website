"""Courses and the instructors who teach them.

Keep in sync with COURSES in assets/js/course-request.js.
"""

INSTRUCTORS = {
    "sara-moradi": "سارا مرادی",
    "hossein-karimi": "حسین کریمی",
    "mina-ahmadi": "مینا احمدی",
    "reza-fallahi": "رضا فلاحی",
}

COURSES = {
    "ai-for-managers": {"title": "هوش مصنوعی برای مدیران", "instructors": ["sara-moradi", "reza-fallahi"]},
    "ai-data-driven-decisions": {"title": "تصمیم‌گیری داده‌محور با هوش مصنوعی", "instructors": ["sara-moradi", "reza-fallahi"]},
    "managerial-accounting": {"title": "حسابداری مدیریتی برای غیرمالی‌ها", "instructors": ["hossein-karimi"]},
    "financial-analysis": {"title": "تحلیل مالی پیشرفته", "instructors": ["hossein-karimi"]},
    "tax-and-budgeting": {"title": "مالیات و بودجه‌ریزی سازمانی", "instructors": ["hossein-karimi"]},
    "leadership-skills": {"title": "مهارت‌های رهبری سازمانی", "instructors": ["mina-ahmadi"]},
}
