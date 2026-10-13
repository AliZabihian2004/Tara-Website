"""Write web-sized WebP copies of the site photos to assets/img/optimized/.

The originals in assets/img/ stay untouched as sources. Re-run after adding or
replacing a photo:  python3 scripts/optimize-images.py
"""
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "img"
TARGET = SOURCE / "optimized"

# (source file, output name, max width)
IMAGES = [
    ("StockSnap_IHBPBLYUFE.jpg", "hero-workshop", 1600),
    ("course-ai.jpg", "course-ai", 1600),
    ("course-accouting.jpg", "course-accounting", 1600),
    ("course-finance.jpg", "course-finance", 1600),
    ("course-data.jpg", "course-data", 1600),
    ("course-leadership.jpg", "course-leadership", 1600),
    ("course-tax.jpg", "course-tax", 1600),
    ("instructor-sara.jpg", "instructor-sara", 400),
    ("instructor-hossein.jpg", "instructor-hossein", 400),
    ("instructor-mina.jpg", "instructor-mina", 400),
    ("instructor-reza.jpg", "instructor-reza", 400),
]


def main() -> None:
    TARGET.mkdir(exist_ok=True)
    total_before = total_after = 0
    for src_name, out_name, max_width in IMAGES:
        src = SOURCE / src_name
        out = TARGET / f"{out_name}.webp"
        with Image.open(src) as img:
            img = ImageOps.exif_transpose(img).convert("RGB")  # respect camera rotation
            if max_width <= 400:
                # Portraits are shown as circles: crop to a centred square first
                side = min(img.size)
                img = ImageOps.fit(img, (side, side), centering=(0.5, 0.35))
            if img.width > max_width:
                img = img.resize((max_width, round(img.height * max_width / img.width)), Image.LANCZOS)
            img.save(out, "WEBP", quality=80, method=6)
        before, after = src.stat().st_size, out.stat().st_size
        total_before += before
        total_after += after
        print(f"{src_name:32} {before / 1e6:6.2f} MB → {out.name:26} {after / 1e3:6.0f} KB")
    print(f"{'total':32} {total_before / 1e6:6.2f} MB → {total_after / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
