"""The parts of the site that can't be plain files. .github/workflows/deploy.yml runs this on every push to main,
including every save in the site editor (admin/), and publishes the result. Nothing it makes is committed.

- projects/<id>/index.html: each project's own page, made from project.html, with its own link preview (title,
  summary and a 1200 x 630 share.jpg) that Discord, iMessage and the rest can read without running JavaScript
- the home page's banner line and About section, from site.json, written into index.html
- assets/img/share.jpg, assets/img/share-patcher.jpg and sitemap.xml

To see the pages locally (needs Pillow):  python tools/build-pages.py
A problem with one project (no page address, a missing picture) is reported and skipped, so the rest still publish.
"""
import html
import json
import pathlib
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = pathlib.Path(__file__).resolve().parent / "fonts"  # Alegreya and Alegreya Sans, OFL (see the OFL files there)
SITE = "https://redfernsoutpost.com/"
NAME = "Redfern's Outpost"
W, H = 1200, 630
BG, TEXT, MUTED, ACCENT = (19, 17, 14), (239, 230, 214), (168, 154, 136), (207, 122, 58)
PAGE_ID = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")


def warn(message):
    # the ::warning:: prefix shows the message on the run's page in GitHub Actions
    print("::warning::" + message)


def title_font(size):
    fnt = ImageFont.truetype(str(FONTS / "Alegreya-Variable.ttf"), size)
    fnt.set_variation_by_axes([700])
    return fnt


def body_font(size, bold=False):
    return ImageFont.truetype(str(FONTS / ("AlegreyaSans-Bold.ttf" if bold else "AlegreyaSans-Regular.ttf")), size)


def fitted_title(draw, text, size, width):
    """The title font at `size`, made smaller until the text fits in `width`."""
    while size > 40 and draw.textlength(text, font=title_font(size)) > width:
        size -= 4
    return title_font(size)


def local(path):
    """A path from the data files ("/projects/x.png") as a file in this repository, or None."""
    if not path:
        return None
    file = (ROOT / str(path).lstrip("/")).resolve()
    return file if file.is_file() and file.is_relative_to(ROOT) else None


def load(name, default=None):
    file = ROOT / name
    if default is not None and not file.exists():
        return default
    return json.loads(file.read_text(encoding="utf-8"))


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
    shadowed(draw, (64, 50), title, fitted_title(draw, title, 92, W - 128), TEXT)
    shadowed(draw, (68, 160), subtitle, body_font(40, bold=True), TEXT)
    return im


def icon_image(p, icon_file):
    """An app: its icon beside its name and summary."""
    im = Image.new("RGB", (W, H), BG)
    icon = Image.open(icon_file).convert("RGBA")
    size = 384
    side = min(icon.size)  # a picture that isn't square is cut to its middle, not squashed
    icon = icon.crop(((icon.width - side) // 2, (icon.height - side) // 2,
                      (icon.width - side) // 2 + side, (icon.height - side) // 2 + side))
    # sharp pixels first, then down to size, so pixel-art icons stay crisp without uneven pixels
    if side <= 1024:
        icon = icon.resize((side * 3, side * 3), Image.NEAREST)
    icon = icon.resize((size, size), Image.LANCZOS)
    top = (H - size) // 2
    im.paste(icon, (80, top), icon)
    draw = ImageDraw.Draw(im)
    x, width = 80 + size + 64, W - (80 + size + 64) - 72
    draw.text((x, top), p["title"], font=fitted_title(draw, p["title"], 80, width), fill=TEXT)
    y = top + 112
    body = body_font(34)
    for line in wrap(draw, p.get("summary", ""), body, width)[:5]:
        draw.text((x, y), line, font=body, fill=MUTED)
        y += 44
    draw.text((x, top + size - 36), "redfernsoutpost.com", font=body_font(30, bold=True), fill=ACCENT)
    return im


def project_image(p):
    picture = local(p.get("cover"))
    if not picture:
        if p.get("cover"):
            warn(f"{p['title']}: its main picture {p['cover']} isn't on the site, so its link preview uses the banner")
        return banner_image(p["title"], " · ".join(filter(None, [p.get("kind"), p.get("platform")])))
    if p.get("coverStyle") == "icon":
        return icon_image(p, picture)
    # a website's screenshot keeps its top (the header); a game's keeps its middle
    return cover(Image.open(picture), "top" if p.get("kind") == "Website" else "center")


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


def paragraphs(text, indent):
    """Plain text with blank lines between paragraphs, as escaped <p> elements."""
    blocks = [b.strip() for b in re.split(r"\n\s*\n", str(text or "")) if b.strip()]
    return "".join(f"{indent}<p>{'<br>'.join(html.escape(line.strip()) for line in b.splitlines())}</p>\n" for b in blocks)


def home_page(page, site):
    """index.html with the banner line and the About section from site.json."""
    tagline = str(site.get("tagline") or "").strip()
    if tagline:
        page = re.sub(r'(<p data-edit="tagline">).*?(</p>)', lambda m: m[1] + html.escape(tagline) + m[2], page, flags=re.S)

    section = nav = ""
    text = paragraphs(site.get("about"), "        ")
    if text:
        photo = local(site.get("aboutPhoto"))
        if site.get("aboutPhoto") and not photo:
            warn(f"The About picture {site['aboutPhoto']} isn't on the site, so it was left out")
        img = f'      <img src="/{html.escape(photo.relative_to(ROOT).as_posix(), quote=True)}" alt="">\n' if photo else ""
        heading = html.escape(str(site.get("aboutTitle") or "About").strip())
        section = (
            '  <section class="section" id="about-section">\n'
            f'    <div class="section-head"><h2>{heading}</h2></div>\n'
            f'    <div class="about{"" if photo else " text-only"}">\n{img}      <div>\n{text}      </div>\n    </div>\n'
            "  </section>\n")
        nav = f'<a href="#about-section">{heading}</a>'
    page = re.sub(r"(<!-- about-nav -->).*?(<!-- /about-nav -->)", lambda m: m[1] + nav + m[2], page)
    page = re.sub(r"(<!-- about:[^\n]*-->\n).*?(  <!-- /about -->)", lambda m: m[1] + section + m[2], page, flags=re.S)
    return page


def main():
    projects = load("projects.json")
    patches = load("patches.json")
    site = load("site.json", {})
    template = (ROOT / "project.html").read_text(encoding="utf-8").replace("\r\n", "\n")

    save(banner_image(NAME, "Games, apps and ROM patches"), "assets/img/share.jpg")
    save(banner_image("Patch a ROM", "IPS, BPS, UPS, xdelta and more, in your browser"), "assets/img/share-patcher.jpg")

    built, seen = [], set()
    for p in projects:
        pid = str(p.get("id") or "")
        p.setdefault("title", pid or "Untitled")
        if not PAGE_ID.fullmatch(pid) or pid in seen:
            warn(f"{p['title']}: its page address ({pid or 'empty'}) is missing, not lowercase-and-dashes, "
                 "or used twice, so it has no page of its own")
            continue
        seen.add(pid)
        folder = ROOT / "projects" / pid
        folder.mkdir(parents=True, exist_ok=True)
        try:
            image = project_image(p)
        except Exception as err:  # a picture Pillow can't open shouldn't stop the whole site
            warn(f"{p['title']}: couldn't make its link preview picture ({err}), so it uses the banner")
            image = banner_image(p["title"], p.get("kind") or "")
        save(image, f"projects/{pid}/share.jpg")
        (folder / "index.html").write_text(project_page(template, p), encoding="utf-8", newline="\n")
        built.append(pid)

    index = ROOT / "index.html"
    index.write_text(home_page(index.read_text(encoding="utf-8").replace("\r\n", "\n"), site), encoding="utf-8", newline="\n")

    urls = [SITE, SITE + "patches.html", SITE + "hvac-trail/", SITE + "hvac-trail/privacy/", SITE + "tinbox/", SITE + "tinbox/privacy/"]
    urls += [SITE + "projects/" + pid + "/" for pid in built]
    urls += [SITE + "patch.html?id=" + str(p["id"]) for p in patches if PAGE_ID.fullmatch(str(p.get("id") or ""))]
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{html.escape(u)}</loc></url>\n" for u in urls)
        + "</urlset>\n", encoding="utf-8", newline="\n")
    print(f"{len(built)} project pages, {len(urls)} sitemap entries")


if __name__ == "__main__":
    main()
