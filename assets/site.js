/* Redfern's Outpost — patch site. Reads patches.json; no build step. */

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

async function loadPatches() {
  const resp = await fetch("patches.json", { cache: "no-cache" });
  if (!resp.ok) throw new Error("Couldn't load patches.json (" + resp.status + ")");
  const list = await resp.json();
  return list.sort((a, b) => String(b.released || "").localeCompare(String(a.released || "")));
}

function badges(p) {
  return el("div", { class: "meta" }, [
    p.platform && el("span", { class: "badge platform", text: p.platform }),
    p.version && el("span", { class: "badge version", text: "v" + p.version }),
    p.released && el("span", { class: "badge", text: p.released }),
  ]);
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

/* ---------------- catalog (index.html) ---------------- */

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
    grid.replaceChildren(...shown.map((p) => {
      const cover = p.cover || (p.screenshots || [])[0];
      const thumb = el("div", { class: "thumb" }, cover ? null : document.createTextNode(p.platform || "Patch"));
      if (cover) thumb.style.backgroundImage = "url(\"" + encodeURI(cover) + "\")";
      return el("a", { class: "card", href: "patch.html?id=" + encodeURIComponent(p.id) }, [
        thumb,
        el("div", { class: "body" }, [
          el("h3", { text: p.title }),
          p.game && el("div", { class: "game", text: "for " + p.game }),
          el("div", { class: "summary", text: p.summary || "" }),
          badges(p),
        ]),
      ]);
    }));
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

  document.title = patch.title + " · Redfern's Outpost Patches";
  const fileName = String(patch.file).split("/").pop();

  const head = el("div", { class: "patch-head" }, [
    el("h1", { text: patch.title }),
    patch.game && el("div", { class: "game", text: "A patch for " + patch.game }),
    badges(patch),
  ]);

  const left = el("div", {}, [
    el("div", { class: "panel" }, [el("h2", { text: "About" }), ...paragraphs(patch.description || patch.summary)]),
  ]);

  if ((patch.screenshots || []).length) {
    left.append(el("div", { class: "panel" }, [
      el("h2", { text: "Screenshots" }),
      el("div", { class: "shots" }, patch.screenshots.map((src) =>
        el("img", { src, alt: patch.title + " screenshot", onclick: () => openLightbox(src) }))),
    ]));
  }

  if ((patch.changelog || []).length) {
    left.append(el("div", { class: "panel" }, [
      el("h2", { text: "Version history" }),
      el("ul", { class: "changelog" }, patch.changelog.map((c) => el("li", {}, [
        el("span", { class: "ver", text: "v" + c.version }),
        c.date && el("span", { class: "date", text: c.date }),
        ...paragraphs(c.notes),
      ]))),
    ]));
  }

  if (patch.credits) {
    left.append(el("div", { class: "panel" }, [el("h2", { text: "Credits" }), ...paragraphs(patch.credits)]));
  }

  const needs = el("dl", { class: "facts" }, [
    el("dt", { text: "Game" }), el("dd", { text: patch.game || "—" }),
    patch.baseRom && el("dt", { text: "ROM" }), patch.baseRom && el("dd", { class: "mono", text: patch.baseRom }),
    patch.baseCrc32 && el("dt", { text: "CRC32" }), patch.baseCrc32 && el("dd", { class: "mono", text: patch.baseCrc32.toLowerCase() }),
  ]);

  const right = el("div", {}, [
    el("div", { class: "panel" }, [
      el("h2", { text: "Patch it in your browser" }),
      el("p", { class: "game", text: "Pick your own copy of the original game. Nothing is uploaded; patching happens on your device." }),
      patcherMarkup(),
    ]),
    el("div", { class: "panel" }, [
      el("h2", { text: "What you need" }),
      needs,
      el("p", { class: "game", style: "margin-top:12px",
        text: "Your ROM must match exactly. Patches from this site never include the game itself." }),
    ]),
    el("div", { class: "panel" }, [
      el("h2", { text: "Prefer to patch yourself?" }),
      el("a", { class: "btn block", href: patch.file, download: fileName, text: "Download patch file" }),
      el("p", { class: "game", style: "margin-top:10px",
        text: "Apply it with Floating IPS or Rom Patcher JS. File: " + fileName }),
    ]),
  ]);

  main.replaceChildren(head, el("div", { class: "layout" }, [left, right]));
  startPatcher(patch);
}

function patcherMarkup() {
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
      el("div", { class: "rom-patcher-row margin-bottom", id: "rom-patcher-row-file-patch", style: "display:none" }, [
        el("div", {}, [el("label", { text: "Patch:" })]),
        el("div", { class: "rom-patcher-container-input" }, [el("select", { id: "rom-patcher-select-patch" })]),
      ]),
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
  try {
    RomPatcherWeb.initialize({ language: "en", requireValidation: canValidate, allowDropFiles: true }, info);
  } catch (err) {
    const box = document.getElementById("rom-patcher-container");
    box.textContent = /incompatible browser|RomPatcherWeb/i.test(err.message)
      ? "Your browser is too old for the online patcher. Download the patch file below instead."
      : err.message;
  }
}

function openLightbox(src) {
  const box = el("div", { class: "lightbox", onclick: () => box.remove() }, [el("img", { src, alt: "" })]);
  document.body.append(box);
}
