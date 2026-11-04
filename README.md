# Redfern's Outpost

The Redfern's Outpost website: projects (games and apps), game patches, and
links. Visitors can download a patch, or patch their own copy of the game right
in the browser (powered by [Rom Patcher JS](https://github.com/marcrobledo/RomPatcher.js), MIT).

No build step: GitHub Pages serves these files as they are. Three data files
drive everything:

| File | Drives | Pages |
|---|---|---|
| `projects.json` | Projects grid + one page per project | `index.html`, `project.html?id=…` |
| `patches.json` | Patch catalog + one page per patch | `patches.html`, `patch.html?id=…` (latest 3 also on the home page) |
| `links.json` | The Links section | `index.html` |

Images live in `projects/<id>/` and `patches/<id>/`. The look (woodsmoke,
parchment, rust and pine; Alegreya + Pixelify Sans) is all in `assets/site.css`.
Redfern in the banner and header is the first idle frame of his PixelLab sheet
from the Godot game.

`incoming/` (git-ignored, never published) is the drop folder for new patch
files before they're checked and turned into pages.

## Projects and links

A project entry: `id`, `title`, `kind` (Game / App / Port), `platform`, `status`
(optional), `order`, `featured` (optional, one wide card), `summary`,
`description` (blank line between paragraphs), `features` (list), `cover` +
`coverStyle` (`"icon"` for app icons), `screenshots`, `screenshotNote`, `note`
(shown in the sidebar, e.g. disclaimers), `links` (`[{ "label", "url" }]`).

A link entry: `title`, `url`, `description`.

Never put game assets from commercial games on the site (screenshots of your own
port running SEGA's data included). Emulator pages never offer games or BIOS files.

## The one rule: patches only

Never upload a ROM, ISO or any game file to this repository. A patch only
contains the *differences* between the original game and your hacked version,
which is why sharing patches is the accepted way to distribute hacks.

## Making a patch

1. Keep an untouched copy of the original ROM (the "clean" ROM).
2. Create a **`.bps`** patch from the clean ROM and your modified ROM, using either:
   - **Floating IPS** (Windows): *Create Patch* → pick the clean ROM, then your
     modified ROM, and save as `.bps`.
   - **Rom Patcher JS online**: open its *Creator mode*, pick both files, choose BPS.
3. Note the clean ROM's **CRC32** checksum. The online patcher shows it when you
   pick a file, or in 7-Zip: right-click the file → *CRC SHA* → *CRC-32*.

`.bps` is recommended: it records the original game's checksum, so the site can
refuse the wrong version of the game before patching.

## Adding a patch (on the GitHub website)

1. **Upload the files.** In the repository, open the `patches` folder → *Add file*
   → *Upload files*. Drag in your `.bps` file and any screenshots. Before
   committing, put them in their own folder by editing the path at the top to
   `patches/your-patch-id/` (lowercase, dashes instead of spaces).
2. **Describe it.** Open `patches.json` → the pencil (edit) icon. Copy the template
   below inside the outer `[` `]`. If there's already a patch listed, separate
   the entries with a comma.
3. **Commit.** The site updates on its own within a minute or two.

Or just ask Claude to add it for you.

```json
{
  "id": "my-cool-hack",
  "title": "My Cool Hack",
  "game": "Pokemon FireRed Version (USA)",
  "platform": "GBA",
  "version": "1.0",
  "released": "2026-10-31",
  "summary": "One sentence shown on the patch card.",
  "description": "A longer description.\n\nLeave a blank line (\\n\\n) between paragraphs.",
  "file": "patches/my-cool-hack/my-cool-hack-v1.0.bps",
  "baseRom": "Pokemon - FireRed Version (USA).gba",
  "baseCrc32": "dd88761c",
  "screenshots": ["patches/my-cool-hack/shot1.png"],
  "changelog": [
    { "version": "1.0", "date": "2026-10-31", "notes": "First release." }
  ],
  "credits": "Made by Redfern."
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Used in the page address. Lowercase and dashes only. |
| `title`, `game`, `platform`, `version` | yes | Shown on the card and page. |
| `file` | yes | Path to the patch file in this repo. |
| `summary` | yes | One sentence for the catalog card. |
| `released` | recommended | `YYYY-MM-DD`; the newest patches are listed first. |
| `baseRom`, `baseCrc32` | recommended | The exact original ROM needed; with a CRC32 the site rejects the wrong file. |
| `description`, `screenshots`, `changelog`, `credits`, `cover` | optional | `cover` picks the card image; otherwise the first screenshot is used. |

### Releasing a new version

Upload the new patch file (e.g. `...-v1.1.bps`), then in `patches.json` update
`file` and `version`, and add a new entry at the **top** of `changelog`. Keep or
delete the old file as you like.

## Previewing on your PC

From this folder run `python -m http.server 8765` and open <http://localhost:8765>.
(Opening `index.html` directly as a file won't work: browsers block the page
from reading `patches.json` that way.)

## Credits

Patching engine: [Rom Patcher JS](https://github.com/marcrobledo/RomPatcher.js) by
Marc Robledo, MIT License (see `rom-patcher-js/LICENSE`).
