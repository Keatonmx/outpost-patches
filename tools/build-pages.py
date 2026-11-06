"""Pages for sharing: projects/<id>/index.html (each with its own link preview), the share images, and sitemap.xml.

Run it after changing projects.json or a project's cover:  python tools/build-pages.py   (needs Pillow)
Link previews (Discord, iMessage, ...) don't run the site's JavaScript, so each project gets a static page
made from project.html with its own title, description and picture.
"""
import html
import json
import pathlib

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://redfernsoutpost.com/"
NAME = "Redfern's Outpost"
W, H = 1200, 630
BG, TEXT, MUTED, ACCENT = (19, 17, 14), (239, 230, 214), (168, 154, 136), (207, 122, 58)
FONTS = pathlib.Path("C:/Windows/Fonts")


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def cover(im, anchor="center", resample=Image.LANCZOS):
    """Scale to fill W x H, then crop the overflow (anchor "top" keeps the top of the picture)."""
    s = max(W / im.width, H / im.height)
    im = im.convert("RGB").resize((round(im.width * s), round(im.height * s)), resample)
    x = (im.width - W) // 2
    y = 0 if anchor == "top" else (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def wrap(draw, text, fnt, width):
    lines, line = [], ""
    for word in text.split():
        test = (line + " " + word).strip()
        if draw.textlength(test, font=fnt) <= width:
            line = test
        else:
            lines.append(line)
            line = word
    return lines + [line] if line else lines


def shadowed(draw, xy, text, fnt, fill):
    draw.text((xy[0] + 3, xy[1] + 3), text, font=fnt, fill=(10, 8, 6))
    draw.text(xy, text, font=fnt, fill=fill)


def banner_image(title, subtitle):
    """The home banner (the cabin at dusk) with a title over the sky."""
    banner = Image.open(ROOT / "assets/img/banner.png")
    crop_w = round(banner.height * W / H)
    im = cover(banner.crop((banner.width - crop_w, 0, banner.width, banner.height)), resample=Image.NEAREST)
    draw = ImageDraw.Draw(im)
    shadowed(draw, (64, 56), title, font("georgiab.ttf", 84), TEXT)
    shadowed(draw, (68, 160), subtitle, font("segoeuib.ttf", 36), TEXT)
    return im


def icon_image(p):
    """An app: its icon beside its name and summary."""
    im = Image.new("RGB", (W, H), BG)
    icon = Image.open(ROOT / p["cover"]).convert("RGBA")
    size = 384
    # sharp pixels first, then down to size, so pixel-art icons stay crisp without uneven pixels
    icon = icon.resize((icon.width * 3, icon.height * 3), Image.NEAREST).resize((size, size), Image.LANCZOS)
    top = (H - size) // 2
    im.paste(icon, (80, top), icon)
    draw = ImageDraw.Draw(im)
    x, width = 80 + size + 64, W - (80 + size + 64) - 72
    draw.text((x, top + 8), p["title"], font=font("georgiab.ttf", 72), fill=TEXT)
    y = top + 112
    body = font("segoeui.ttf", 32)
    for line in wrap(draw, p.get("summary", ""), body, width)[:5]:
        draw.text((x, y), line, font=body, fill=MUTED)
        y += 44
    draw.text((x, top + size - 36), "redfernsoutpost.com", font=font("segoeuib.ttf", 28), fill=ACCENT)
    return im


def project_image(p):
    if p.get("coverStyle") == "icon":
        return icon_image(p)
    # a website's screenshot keeps its top (the header); a game's keeps its middle
    return cover(Image.open(ROOT / p["cover"]), "top" if p.get("kind") == "Website" else "center")


def save(im, rel):
    im.save(ROOT / rel, "JPEG", quality=88, optimize=True, progressive=True)


def meta(title, desc, url, image):
    e = lambda s: html.escape(s, quote=True)
    return "\n".join([
        f'<meta name="description" content="{e(desc)}">',
        f'<link rel="canonical" href="{e(url)}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:site_name" content="{e(NAME)}">',
        f'<meta property="og:title" content="{e(title)}">',
        f'<meta property="og:description" content="{e(desc)}">',
        f'<meta property="og:url" content="{e(url)}">',
        f'<meta property="og:image" content="{e(image)}">',
        f'<meta property="og:image:width" content="{W}">',
        f'<meta property="og:image:height" content="{H}">',
        '<meta name="twitter:card" content="summary_large_image">',
    ])


def project_page(template, p):
    url = SITE + "projects/" + p["id"] + "/"
    title = p["title"] if p["title"] == NAME else p["title"] + " · " + NAME
    page = template
    for old, new in [
        ("<!doctype html>\n", "<!doctype html>\n<!-- Made by tools/build-pages.py from project.html: edit that, then run the script -->\n"),
        # the page sits in projects/<id>/, so every link and file starts from the site root
        ('<meta charset="utf-8">\n', '<meta charset="utf-8">\n<base href="/">\n'),
        ("<title>Project · Redfern's Outpost</title>\n",
         f"<title>{html.escape(title, quote=False)}</title>\n"
         + meta(p["title"], p.get("summary", ""), url, SITE + "projects/" + p["id"] + "/share.jpg") + "\n"),
        ("<script>renderProject();</script>", f"<script>renderProject({json.dumps(p['id'])});</script>"),
    ]:
        assert page.count(old) == 1, old
        page = page.replace(old, new)
    return page


def main():
    projects = sorted(json.loads((ROOT / "projects.json").read_text(encoding="utf-8")), key=lambda p: p.get("order", 99))
    patches = json.loads((ROOT / "patches.json").read_text(encoding="utf-8"))
    template = (ROOT / "project.html").read_text(encoding="utf-8").replace("\r\n", "\n")

    save(banner_image(NAME, "Games, apps and ROM patches"), "assets/img/share.jpg")
    save(banner_image("Patch a ROM", "IPS, BPS, UPS, xdelta and more, in your browser"), "assets/img/share-patcher.jpg")

    for p in projects:
        folder = ROOT / "projects" / p["id"]
        folder.mkdir(exist_ok=True)
        save(project_image(p), f"projects/{p['id']}/share.jpg")
        (folder / "index.html").write_text(project_page(template, p), encoding="utf-8", newline="\n")

    urls = [SITE, SITE + "patches.html"]
    urls += [SITE + "projects/" + p["id"] + "/" for p in projects]
    urls += [SITE + "patch.html?id=" + p["id"] for p in patches]
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{html.escape(u)}</loc></url>\n" for u in urls)
        + "</urlset>\n", encoding="utf-8", newline="\n")
    print(f"{len(projects)} project pages, {len(urls)} sitemap entries")


if __name__ == "__main__":
    main()
