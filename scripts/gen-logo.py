#!/usr/bin/env python3
"""用 Pillow 程序化绘制 md66 应用图标（1024x1024，透明圆角）。

设计 v3：紫→青对角渐变底；字标 "md" 实心白 + "66" 空心描边（待书写的暗示）；
尾部青色辉光文本光标。

用法：python3 scripts/gen-logo.py [输出路径]
"""
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 1024
OUT = sys.argv[1] if len(sys.argv) > 1 else "assets/design/logo-1024.png"

# 紫 → 青 对角渐变（左上紫，右下青）
VIOLET = (124, 58, 237)  # #7c3aed
CYAN = (6, 182, 212)  # #06b6d4
CURSOR_GLOW = (34, 211, 238)  # #22d3ee

FONT_CANDIDATES = [
    ("/System/Library/Fonts/SFNS.ttf", 0),
    ("/System/Library/Fonts/HelveticaNeue.ttc", 1),  # index 1 通常为 Bold
    ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 0),
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path, index in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size, index=index)
        except Exception:
            continue
    raise SystemExit("未找到可用字体（SFNS / HelveticaNeue / Arial Bold）")


def diagonal_gradient() -> Image.Image:
    """左上紫 → 右下青的对角渐变。"""
    out = Image.new("RGB", (SIZE, SIZE))
    px = out.load()
    span = 2 * (SIZE - 1)
    for y in range(SIZE):
        for x in range(SIZE):
            t = (x + y) / span
            px[x, y] = (
                round(VIOLET[0] + (CYAN[0] - VIOLET[0]) * t),
                round(VIOLET[1] + (CYAN[1] - VIOLET[1]) * t),
                round(VIOLET[2] + (CYAN[2] - VIOLET[2]) * t),
            )
    return out


def rounded_mask(radius: int) -> Image.Image:
    m = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=radius, fill=255)
    return m


def main() -> None:
    base = diagonal_gradient().convert("RGBA")

    # 左上角轻微亮化，增加通透感
    gloss = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(gloss).ellipse(
        [-SIZE * 0.35, -SIZE * 0.45, SIZE * 0.55, SIZE * 0.3],
        fill=(255, 255, 255, 34),
    )
    base.alpha_composite(gloss.filter(ImageFilter.GaussianBlur(120)))

    # ---- 字标：md（实心白）+ 66（空心描边）---- #
    font = load_font(300)
    measure = ImageDraw.Draw(Image.new("RGBA", (1, 1)))

    solid_text, hollow_text = "md", "66"
    sb = measure.textbbox((0, 0), solid_text, font=font)
    hb = measure.textbbox((0, 0), hollow_text, font=font, stroke_width=7)
    solid_w = sb[2] - sb[0]
    hollow_w = hb[2] - hb[0]
    text_h = max(sb[3] - sb[0] and sb[3] - sb[1], hb[3] - hb[1])

    cursor_w, cursor_gap = 30, 40
    total_w = solid_w + hollow_w + cursor_gap + cursor_w
    x0 = (SIZE - total_w) / 2
    y0 = (SIZE - text_h) / 2 - sb[1] - 10

    # 字标投影
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.text((x0 - sb[0] + 6, y0 + sb[1] + 12), solid_text, font=font, fill=(30, 10, 60, 110))
    sd.text(
        (x0 + solid_w - hb[0] + 6, y0 + sb[1] + 12),
        hollow_text, font=font, fill=(30, 10, 60, 110), stroke_width=7,
    )
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(12)))

    draw = ImageDraw.Draw(base)
    # md 实心
    draw.text((x0 - sb[0], y0 + sb[1]), solid_text, font=font, fill=(255, 255, 255, 255))
    # 66 空心：填充透明、描边白（透出渐变底）
    draw.text(
        (x0 + solid_w - hb[0], y0 + sb[1]),
        hollow_text, font=font, fill=(255, 255, 255, 0),
        stroke_width=7, stroke_fill=(255, 255, 255, 255),
    )

    # ---- 青色辉光文本光标 ----
    cx = x0 + solid_w + hollow_w + cursor_gap
    top = y0 + sb[1] + text_h * 0.08
    bottom = y0 + sb[1] + text_h * 0.96

    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle(
        [cx - 8, top - 8, cx + cursor_w + 8, bottom + 8],
        radius=(cursor_w + 16) // 2, fill=CURSOR_GLOW + (170,),
    )
    base.alpha_composite(glow.filter(ImageFilter.GaussianBlur(22)))

    draw.rounded_rectangle(
        [cx, top, cx + cursor_w, bottom],
        radius=cursor_w // 2, fill=(255, 255, 255, 255),
    )

    # 应用圆角
    icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    icon.paste(base, (0, 0), rounded_mask(226))
    icon.save(OUT)
    print(f"logo 已生成: {OUT} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
