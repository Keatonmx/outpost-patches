/* Redfern's Outpost. Pages are drawn from projects.json, patches.json and links.json;
   no build step. Data is only ever set with textContent, never as HTML. */

const SITE = "Redfern's Outpost";

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children || [])) {
    if (child) node.append(child);
  }
  return node;
}

async function loadJson(name) {
  const resp = await fetch(name, { cache: "no-cache" });
  if (!resp.ok) throw new Error("Couldn't load " + name + " (" + resp.status + ")");
  return resp.json();
}

async function loadPatches() {
  const list = await loadJson("patches.json");
  return list.sort((a, b) => String(b.released || "").localeCompare(String(a.released || "")));
}

async function loadProjects() {
  const list = await loadJson("projects.json");
  return list.sort((a, b) => (a.order || 99) - (b.order || 99));
}

/* A dotted line of small facts, e.g. "App · iPhone · On the App Store". */
function metaLine(parts) {
  return el("div", { class: "meta" }, parts.filter(([text]) => text)
    .map(([text, cls]) => el("span", { class: cls, text })));
}

function badges(p) {
  return metaLine([[p.platform], [p.version && "v" + p.version, "good"], [p.released]]);
}

function initials(title) {
  return String(title || "?").split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase();
}

function paragraphs(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const p = el("p");
      block.split("\n").forEach((line, i) => {
        if (i) p.append(el("br"));
        p.append(line);
      });
      return p;
    });
}

function showError(where, message) {
  where.replaceChildren(el("div", { class: "empty", text: message }));
}

function safeUrl(url) {
  try {
    const u = new URL(url, document.baseURI);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch (err) {
    return null;
  }
}

function patchCard(p) {
  const cover = p.cover || (p.screenshots || [])[0];
  return el("a", { class: "item", href: "patch.html?id=" + encodeURIComponent(p.id) }, [
    cover
      ? el("img", { class: "thumb shot", src: cover, alt: "" })
      : el("span", { class: "thumb initials", "aria-hidden": "true", text: initials(p.title) }),
    el("div", {}, [
      el("h3", { text: p.title }),
      p.game && el("div", { class: "game", text: "for " + p.game }),
      el("p", { class: "summary", text: p.summary || "" }),
      badges(p),
    ]),
  ]);
}

/* ---------------- home (index.html) ---------------- */

function projectMeta(p) {
  return metaLine([[p.kind, "kind"], [p.platform], [p.status, "good"]]);
}

/* "smooth": every screenshot scales smoothly; "coverSmooth": only the cover does */
function coverClass(p) {
  return p.smooth || p.coverSmooth ? " smooth" : "";
}

function projectThumb(p) {
  if (p.cover && p.coverStyle === "icon") return el("img", { class: "thumb icon", src: p.cover, alt: "" });
  if (p.cover) return el("img", { class: "thumb shot" + coverClass(p), src: p.cover, alt: "" });
  return el("span", { class: "thumb initials", "aria-hidden": "true", text: initials(p.title) });
}

function projectCard(p) {
  const href = "projects/" + encodeURIComponent(p.id) + "/";
  if (p.featured && p.cover && p.coverStyle !== "icon") {
    return el("a", { class: "feature", href }, [
      el("img", { class: coverClass(p).trim(), src: p.cover, alt: p.title }),
      el("div", {}, [
        el("div", { class: "eyebrow", text: "The main game" }),
        el("h3", { text: p.title }),
        el("p", { class: "summary", text: p.summary || "" }),
        projectMeta(p),
        el("div", { class: "more", text: "Take a look →" }),
      ]),
    ]);
  }
  return el("a", { class: "item", href }, [
    projectThumb(p),
    el("div", {}, [
      el("h3", { text: p.title }),
      el("p", { class: "summary", text: p.summary || "" }),
      projectMeta(p),
    ]),
  ]);
}

function linkCard(link) {
  const url = safeUrl(link.url);
  if (!url) return null;
  const host = new URL(url).host.replace(/^www\./, "");
  return el("a", { class: "link", href: url, target: "_blank", rel: "noopener" }, [
    el("span", { class: "mark", "aria-hidden": "true", text: (link.title || host).trim().charAt(0).toUpperCase() }),
    el("span", {}, [
      el("strong", { text: link.title || host }),
      el("span", { class: "host", text: host }),
      link.description && el("span", { class: "desc", text: link.description }),
    ]),
  ]);
}

async function renderHome() {
  const gamesBox = document.getElementById("games");
  const projectsBox = document.getElementById("projects");
  const patchesBox = document.getElementById("latest-patches");
  const linksBox = document.getElementById("links");

  loadProjects()
    .then((list) => {
      const games = list.filter((p) => p.kind === "Game");
      const others = list.filter((p) => p.kind !== "Game");
      if (games.length) gamesBox.replaceChildren(...games.map(projectCard));
      else showError(gamesBox, "Games are on the way.");
      if (others.length) projectsBox.replaceChildren(...others.map(projectCard));
      else showError(projectsBox, "Projects are on the way.");
    })
    .catch((err) => {
      showError(gamesBox, err.message);
      showError(projectsBox, err.message);
    });

  loadPatches()
    .then((list) => list.length
      ? patchesBox.replaceChildren(...list.slice(0, 3).map(patchCard))
      : showError(patchesBox, "No patches posted yet. They're on the way."))
    .catch((err) => showError(patchesBox, err.message));

  loadJson("links.json")
    .then((list) => {
      const cards = list.map(linkCard).filter(Boolean);
      if (cards.length) linksBox.replaceChildren(...cards);
      else showError(linksBox, "No links yet.");
    })
    .catch((err) => showError(linksBox, err.message));
}

/* ---------------- project page (project.html) ---------------- */

/* pageId: set on a project's own page (projects/<id>/, made by tools/build-pages.py) */
async function renderProject(pageId) {
  const main = document.getElementById("project");
  const id = pageId || new URLSearchParams(location.search).get("id");
  let project;
  try {
    project = (await loadProjects()).find((p) => p.id === id);
  } catch (err) {
    showError(main, err.message);
    return;
  }
  if (!project) {
    showError(main, "That project doesn't exist (anymore). Head back to the outpost.");
    return;
  }
  // an old link (project.html?id=...) goes on to the project's own page, which has its link preview
  if (!pageId) {
    location.replace("projects/" + encodeURIComponent(id) + "/");
    return;
  }

  document.title = project.title === SITE ? SITE : project.title + " · " + SITE;
  if (project.kind === "Game") {
    const back = document.querySelector(".back");
    back.href = "./#games-section";
    back.textContent = "← All games";
    document.querySelectorAll(".nav a").forEach((a) => {
      if (a.hash === "#games-section") a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  const isIcon = project.cover && project.coverStyle === "icon";
  const head = el("div", { class: "detail-head" }, [
    isIcon && el("img", { class: "app-icon", src: project.cover, alt: project.title + " icon" }),
    el("div", {}, [
      el("div", { class: "eyebrow", text: project.kind || "Project" }),
      el("h1", { text: project.title }),
      el("p", { class: "lede", text: project.summary || "" }),
      metaLine([[project.platform], [project.status, "good"]]),
    ]),
  ]);

  let shots = project.screenshots || [];
  const wide = shots.length && !/\.(jpe?g)$/i.test(shots[0]);
  const parts = [head];
  if (wide && project.cover && !isIcon) {
    parts.push(el("img", { class: "hero-shot" + coverClass(project), src: project.cover, alt: project.title }));
    shots = shots.filter((src) => src !== project.cover);
  }

  const left = el("div", {}, [
    el("section", { class: "block" }, [el("h2", { text: "About" }), ...paragraphs(project.description || project.summary)]),
  ]);

  if ((project.features || []).length) {
    left.append(el("section", { class: "block" }, [
      el("h2", { text: "Features" }),
      el("ul", { class: "features" }, project.features.map((f) => el("li", { text: f }))),
    ]));
  }

  if (shots.length) {
    left.append(el("section", { class: "block" }, [
      el("h2", { text: "Screenshots" }),
      el("div", { class: "shots" + (wide ? "" : " tall") + (project.smooth ? " smooth" : "") }, shots.map((src) =>
        el("img", { src, alt: project.title + " screenshot", onclick: () => openLightbox(src, project.smooth) }))),
      project.screenshotNote && el("p", { class: "muted", style: "margin-top:14px", text: project.screenshotNote }),
    ]));
  }

  const right = el("aside", {});
  const links = (project.links || []).map((l, i) => {
    const url = safeUrl(l.url);
    return url && el("a", { class: "btn block" + (i === 0 ? " primary" : ""), href: url,
      target: "_blank", rel: "noopener", text: l.label || url });
  }).filter(Boolean);
  if (links.length) right.append(el("div", { class: "block" }, [el("h2", { text: "Links" }), ...links]));

  if (project.note) right.append(el("div", { class: "block note" }, [el("p", { class: "muted", text: project.note })]));

  const hasSide = right.childElementCount > 0;
  parts.push(el("div", { class: "layout" + (hasSide ? "" : " single") }, hasSide ? [left, right] : [left]));
  main.replaceChildren(...parts);
}

/* ---------------- patch catalog (patches.html) ---------------- */

async function renderCatalog() {
  const grid = document.getElementById("grid");
  const search = document.getElementById("search");
  const platform = document.getElementById("platform");
  let patches;
  try {
    patches = await loadPatches();
  } catch (err) {
    showError(grid, err.message);
    return;
  }

  const platforms = [...new Set(patches.map((p) => p.platform).filter(Boolean))].sort();
  platforms.forEach((name) => platform.append(el("option", { value: name, text: name })));
  document.getElementById("toolbar").hidden = patches.length < 2;

  function draw() {
    const q = search.value.trim().toLowerCase();
    const shown = patches.filter((p) =>
      (!platform.value || p.platform === platform.value) &&
      (!q || [p.title, p.game, p.summary, p.platform].join(" ").toLowerCase().includes(q)));

    if (!patches.length) {
      showError(grid, "No patches posted yet. Check back soon!");
      return;
    }
    if (!shown.length) {
      showError(grid, "No patches match that search.");
      return;
    }
    grid.replaceChildren(...shown.map(patchCard));
  }

  search.addEventListener("input", draw);
  platform.addEventListener("change", draw);
  draw();
}

/* ---------------- patch page (patch.html) ---------------- */

async function renderPatch() {
  const main = document.getElementById("patch");
  const id = new URLSearchParams(location.search).get("id");
  let patch;
  try {
    patch = (await loadPatches()).find((p) => p.id === id);
  } catch (err) {
    showError(main, err.message);
    return;
  }
  if (!patch) {
    showError(main, "That patch doesn't exist (anymore). Head back to the full list.");
    return;
  }

  document.title = patch.title + " · " + SITE + " Patches";
  const fileName = String(patch.file).split("/").pop();

  const head = el("div", { class: "detail-head" }, [
    el("div", {}, [
      el("div", { class: "eyebrow", text: "Patch" }),
      el("h1", { text: patch.title }),
      patch.game && el("p", { class: "lede", text: "A patch for " + patch.game }),
      badges(patch),
    ]),
  ]);

  const left = el("div", {}, [
    el("section", { class: "block" }, [el("h2", { text: "About" }), ...paragraphs(patch.description || patch.summary)]),
  ]);

  if ((patch.screenshots || []).length) {
    left.append(el("section", { class: "block" }, [
      el("h2", { text: "Screenshots" }),
      el("div", { class: "shots" }, patch.screenshots.map((src) =>
        el("img", { src, alt: patch.title + " screenshot", onclick: () => openLightbox(src) }))),
    ]));
  }

  if ((patch.changelog || []).length) {
    left.append(el("section", { class: "block" }, [
      el("h2", { text: "Version history" }),
      el("ul", { class: "changelog" }, patch.changelog.map((c) => el("li", {}, [
        el("span", { class: "ver", text: "v" + c.version }),
        c.date && el("span", { class: "date", text: c.date }),
        ...paragraphs(c.notes),
      ]))),
    ]));
  }

  if (patch.credits) {
    left.append(el("section", { class: "block" }, [el("h2", { text: "Credits" }), ...paragraphs(patch.credits)]));
  }

  const needs = el("dl", { class: "facts" }, [
    el("dt", { text: "Game" }), el("dd", { text: patch.game || "—" }),
    patch.baseRom && el("dt", { text: "ROM" }), patch.baseRom && el("dd", { class: "mono", text: patch.baseRom }),
    patch.baseCrc32 && el("dt", { text: "CRC32" }), patch.baseCrc32 && el("dd", { class: "mono", text: patch.baseCrc32.toLowerCase() }),
  ]);

  const right = el("aside", {}, [
    el("section", { class: "block" }, [
      el("h2", { text: "Patch it in your browser" }),
      el("p", { class: "game", text: "Pick your own copy of the original game. Nothing is uploaded; patching happens on your device." }),
      patcherMarkup(),
    ]),
    el("section", { class: "block" }, [
      el("h2", { text: "What you need" }),
      needs,
      el("p", { class: "game", style: "margin-top:12px",
        text: "Your ROM must match exactly. Patches from this site never include the game itself." }),
    ]),
    el("section", { class: "block" }, [
      el("h2", { text: "Prefer to patch yourself?" }),
      el("a", { class: "btn block", href: patch.file, download: fileName, text: "Download patch file" }),
      el("p", { class: "game", style: "margin-top:10px",
        text: "Apply it with Floating IPS or Rom Patcher JS. File: " + fileName }),
    ]),
  ]);

  main.replaceChildren(head, el("div", { class: "layout" }, [left, right]));
  startPatcher(patch);
}

/* open: any patch file (the Patches page); otherwise the patch page's own patch, embedded */
function patcherMarkup(open) {
  const patchRow = open
    ? el("div", { class: "rom-patcher-row margin-bottom", id: "rom-patcher-row-file-patch" }, [
        el("div", {}, [el("label", { for: "rom-patcher-input-file-patch", text: "Patch file:" })]),
        el("div", { class: "rom-patcher-container-input" }, [
          el("input", { type: "file", id: "rom-patcher-input-file-patch", class: "empty", disabled: "" }),
        ]),
      ])
    : el("div", { class: "rom-patcher-row margin-bottom", id: "rom-patcher-row-file-patch", style: "display:none" }, [
        el("div", {}, [el("label", { text: "Patch:" })]),
        el("div", { class: "rom-patcher-container-input" }, [el("select", { id: "rom-patcher-select-patch" })]),
      ]);
  return el("div", {}, [
    el("div", { id: "rom-patcher-container" }, [
      el("div", { class: "rom-patcher-row margin-bottom", id: "rom-patcher-row-file-rom" }, [
        el("div", {}, [el("label", { for: "rom-patcher-input-file-rom", "data-localize": "yes", text: "Your ROM file:" })]),
        el("div", { class: "rom-patcher-container-input" }, [
          el("input", { type: "file", id: "rom-patcher-input-file-rom", class: "empty", disabled: "" }),
        ]),
      ]),
      el("div", { class: "margin-bottom text-selectable text-mono text-muted", id: "rom-patcher-rom-info" }, [
        infoRow("CRC32:", "rom-patcher-span-crc32"),
        infoRow("MD5:", "rom-patcher-span-md5"),
        infoRow("SHA-1:", "rom-patcher-span-sha1"),
        el("div", { class: "rom-patcher-row", id: "rom-patcher-row-info-rom" }, [
          el("div", { text: "ROM:" }), el("div", { class: "text-truncate" }, [el("span", { id: "rom-patcher-span-rom-info" })]),
        ]),
      ]),
      open && el("div", { class: "rom-patcher-row margin-bottom", id: "rom-patcher-row-alter-header" }, [
        el("div", {}),
        el("div", {}, [
          el("input", { type: "checkbox", id: "rom-patcher-checkbox-alter-header", disabled: "" }),
          el("label", { for: "rom-patcher-checkbox-alter-header", id: "rom-patcher-span-alter-header" }),
        ]),
      ]),
      patchRow,
      el("div", { class: "rom-patcher-row margin-bottom text-selectable text-mono text-muted", id: "rom-patcher-row-patch-requirements" }, [
        el("div", { id: "rom-patcher-patch-requirements-type", text: "ROM requirements:" }),
        el("div", { class: "text-truncate", id: "rom-patcher-patch-requirements-value" }),
      ]),
      el("div", { class: "text-center", id: "rom-patcher-row-apply" }, [
        el("div", { id: "rom-patcher-row-error-message", class: "margin-bottom" }, [el("span", { id: "rom-patcher-error-message" })]),
        el("button", { id: "rom-patcher-button-apply", "data-localize": "yes", disabled: "", text: "Apply patch" }),
      ]),
    ]),
    el("div", { id: "rom-patcher-powered" }, [
      el("a", { href: "https://github.com/marcrobledo/RomPatcher.js", target: "_blank", rel: "noopener", text: "Powered by Rom Patcher JS" }),
    ]),
  ]);
}

function infoRow(label, spanId) {
  return el("div", { class: "rom-patcher-row" }, [
    el("div", { text: label }),
    el("div", { class: "text-truncate" }, [el("span", { id: spanId })]),
  ]);
}

function startPatcher(patch) {
  const info = {
    file: patch.file,
    name: patch.title,
    description: patch.summary || "",
    outputName: patch.title + (patch.version ? " v" + patch.version : ""),
  };
  if (patch.baseCrc32) info.inputCrc32 = "0x" + String(patch.baseCrc32).replace(/^0x/i, "");
  const canValidate = !!patch.baseCrc32 || /\.(bps|ups)$/i.test(patch.file);
  initPatcher({ language: "en", requireValidation: canValidate, allowDropFiles: true }, info,
    "Your browser is too old for the online patcher. Download the patch file below instead.");
}

function initPatcher(settings, info, tooOld) {
  try {
    RomPatcherWeb.initialize(settings, info);
  } catch (err) {
    const box = document.getElementById("rom-patcher-container");
    box.textContent = /incompatible browser|RomPatcherWeb/i.test(err.message) ? tooOld : err.message;
  }
}

/* ---------------- the open patcher (patches.html) ---------------- */

function renderPatcher() {
  document.getElementById("patcher-box").replaceChildren(patcherMarkup(true));
  // Rom Patcher JS finds its own folder through document.currentScript, which inside the page's inline
  // <script> is that script, so it starts once the inline script is done
  setTimeout(() => initPatcher({ language: "en", requireValidation: false, allowDropFiles: true }, undefined,
    "Your browser is too old for the online patcher. Floating IPS or Rom Patcher JS can apply patches on your computer instead."));
}

function openLightbox(src, smooth) {
  const box = el("div", { class: "lightbox" + (smooth ? " smooth" : ""), onclick: () => box.remove() }, [el("img", { src, alt: "" })]);
  document.body.append(box);
}
