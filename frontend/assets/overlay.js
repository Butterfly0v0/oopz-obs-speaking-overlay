const overlay = document.querySelector("#overlay");
const usersContainer = document.querySelector("#users");
const status = document.querySelector("#status");
const template = document.querySelector("#user-card-template");
const isPreviewMode = new URLSearchParams(window.location.search).get("preview") === "1";

let overlayConfig = {
  layout: "horizontal",
  avatarSize: 72,
  dimOpacity: 0.34,
  inactiveGrayscale: 0.7,
  highlightScale: 1.06,
  showIds: true,
  showDisplayNames: true,
  fontFamily: "Microsoft YaHei",
  fontStyle: "Regular",
  fontFace: "Microsoft YaHei",
  idFontSize: 11,
  nameFontSize: 15,
  nameFontWeight: 800,
  idFontWeight: 600,
  nameLetterSpacing: 0,
  idLetterSpacing: 0.02,
  nameEllipsis: true,
  speakFloatEnabled: true,
  speakFloatAmplitude: 6,
  speakFloatDuration: 1.2,
  speakFloatEase: "ease-in-out",
};

const cards = new Map();
let lastUsers = [];

async function loadConfig() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    const data = await response.json();
    overlayConfig = { ...overlayConfig, ...(data.overlay ?? {}) };
    applyConfig();
  } catch (error) {
    setStatus(`Config unavailable: ${error.message}`, true);
  }
}

function applyConfig() {
  const floatEnabled = Boolean(overlayConfig.speakFloatEnabled);
  overlay.className = `overlay overlay--${overlayConfig.layout}${floatEnabled ? " overlay--speak-float" : ""}`;
  document.documentElement.style.setProperty("--avatar-size", `${overlayConfig.avatarSize}px`);
  document.documentElement.style.setProperty("--dim-opacity", String(overlayConfig.dimOpacity));
  document.documentElement.style.setProperty("--inactive-grayscale", String(clamp01(overlayConfig.inactiveGrayscale)));
  document.documentElement.style.setProperty("--highlight-scale", String(overlayConfig.highlightScale));
  document.documentElement.style.setProperty(
    "--overlay-font-family",
    toCssFontFamily(resolveFontFace(overlayConfig)),
  );
  document.documentElement.style.setProperty(
    "--overlay-font-style",
    cssFontStyleFromFaceStyle(overlayConfig.fontStyle),
  );
  document.documentElement.style.setProperty("--id-font-size", `${overlayConfig.idFontSize}px`);
  document.documentElement.style.setProperty("--name-font-size", `${overlayConfig.nameFontSize}px`);
  document.documentElement.style.setProperty("--name-font-weight", String(overlayConfig.nameFontWeight ?? 800));
  document.documentElement.style.setProperty("--id-font-weight", String(overlayConfig.idFontWeight ?? 600));
  document.documentElement.style.setProperty("--name-letter-spacing", `${Number(overlayConfig.nameLetterSpacing ?? 0)}em`);
  document.documentElement.style.setProperty("--id-letter-spacing", `${Number(overlayConfig.idLetterSpacing ?? 0.02)}em`);
  document.documentElement.style.setProperty("--name-ellipsis", overlayConfig.nameEllipsis ? "ellipsis" : "clip");
  document.documentElement.style.setProperty("--name-white-space", overlayConfig.nameEllipsis ? "nowrap" : "normal");
  document.documentElement.style.setProperty("--speak-float-amplitude", `${Number(overlayConfig.speakFloatAmplitude ?? 6)}px`);
  document.documentElement.style.setProperty("--speak-float-duration", `${Number(overlayConfig.speakFloatDuration ?? 1.2)}s`);
  document.documentElement.style.setProperty("--speak-float-ease", overlayConfig.speakFloatEase || "ease-in-out");
  refreshVisibleCards();
}

function refreshVisibleCards() {
  lastUsers.forEach((user) => {
    const card = cards.get(user.id);
    if (card) {
      updateCard(card, user);
    }
  });
}

function handlePreviewMessage(event) {
  if (event.origin !== window.location.origin) {
    return;
  }

  const message = event.data ?? {};
  if (message.type === "overlay-config-update" && message.overlay) {
    overlayConfig = { ...overlayConfig, ...message.overlay };
    applyConfig();
  }
  if (message.type === "overlay-preview-state" && message.state) {
    renderState(message.state);
  }
}

function setStatus(message, isError = false) {
  if (isPreviewMode) {
    return;
  }
  status.textContent = message;
  status.classList.toggle("status--error", isError);
  status.hidden = !message;
}

function connectEvents() {
  const events = new EventSource("/events");

  events.addEventListener("open", () => {
    setStatus("");
  });

  events.addEventListener("state", (event) => {
    const state = JSON.parse(event.data);
    renderState(state);
  });

  events.addEventListener("error", () => {
    setStatus("Disconnected. Reconnecting...", true);
  });
}

function renderState(state) {
  const seenIds = new Set();
  const users = state.users ?? [];
  lastUsers = users;

  users.forEach((user) => {
    seenIds.add(user.id);
    const card = getOrCreateCard(user);
    updateCard(card, user);
  });

  for (const [id, card] of cards.entries()) {
    if (!seenIds.has(id)) {
      card.remove();
      cards.delete(id);
    }
  }

  if (isPreviewMode) {
    return;
  }

  if (!state.connected && users.length === 0) {
    setStatus(`Waiting for OOPZ overlay data${state.lastError ? `: ${state.lastError}` : ""}`, true);
  } else if (!state.voice) {
    setStatus("OOPZ voice channel is not active");
  } else if (users.length === 0) {
    setStatus("No users in current OOPZ channel");
  } else {
    setStatus("");
  }
}

function getOrCreateCard(user) {
  if (cards.has(user.id)) {
    return cards.get(user.id);
  }

  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".user-card");
  card.dataset.userId = user.id;
  usersContainer.appendChild(card);
  cards.set(user.id, card);
  return card;
}

function updateCard(card, user) {
  const color = user.color || "#4cc9f0";
  const avatar = card.querySelector(".avatar");
  const fallback = card.querySelector(".avatar-fallback");
  const displayName = card.querySelector(".display-name");
  const userId = card.querySelector(".user-id");

  card.classList.toggle("user-card--speaking", Boolean(user.speaking));
  card.classList.toggle("user-card--muted", Boolean(user.muted));
  card.style.setProperty("--user-color", color);

  const label = user.displayName || user.id;
  displayName.textContent = label;
  displayName.title = label;
  displayName.hidden = !overlayConfig.showDisplayNames;
  userId.textContent = user.id;
  userId.title = user.id;
  userId.hidden = !overlayConfig.showIds || sameText(user.id, user.displayName);

  fallback.textContent = initials(user.displayName || user.id);
  fallback.style.background = color;

  if (user.avatarUrl) {
    avatar.hidden = false;
    avatar.src = user.avatarUrl;
    avatar.alt = `${user.displayName || user.id} avatar`;
    fallback.hidden = true;
  } else {
    avatar.hidden = true;
    fallback.hidden = false;
  }
}

function initials(value) {
  const clean = String(value).trim();
  if (!clean) {
    return "?";
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function sameText(left, right) {
  return String(left ?? "").trim() === String(right ?? "").trim();
}

function clamp01(value) {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return 0.7;
  }
  return Math.min(1, Math.max(0, number));
}

function extractPrimaryFont(fontFamily) {
  const raw = String(fontFamily ?? "").trim();
  if (!raw) {
    return "Microsoft YaHei";
  }
  const match = raw.match(/"([^"]+)"|'([^']+)'|([^,]+)/);
  return String(match?.[1] || match?.[2] || match?.[3] || raw).trim();
}

function canonicalizeFontStyle(value) {
  const raw = String(value ?? "Regular").trim();
  if (!raw) {
    return "Regular";
  }
  const lowered = raw.toLowerCase();
  const legacy = {
    normal: "Regular",
    regular: "Regular",
    book: "Regular",
    roman: "Regular",
    italic: "Italic",
    oblique: "Oblique",
    bold: "Bold",
    light: "Light",
    medium: "Medium",
    black: "Black",
    thin: "Thin",
    heavy: "Heavy",
    semibold: "SemiBold",
    "semi bold": "SemiBold",
    demibold: "SemiBold",
    extrabold: "ExtraBold",
    "extra bold": "ExtraBold",
    extralight: "ExtraLight",
    "extra light": "ExtraLight",
    "bold italic": "Bold Italic",
    bolditalic: "Bold Italic",
  };
  if (legacy[lowered]) {
    return legacy[lowered];
  }
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveFontFace(config) {
  const face = String(config.fontFace ?? "").trim();
  if (face) {
    return extractPrimaryFont(face);
  }
  const family = extractPrimaryFont(config.fontFamily);
  const style = canonicalizeFontStyle(config.fontStyle);
  if (style === "Regular") {
    return family;
  }
  return `${family} ${style}`;
}

function toCssFontFamily(fontFamily) {
  const primary = extractPrimaryFont(fontFamily);
  if (!primary || primary === "system-ui") {
    return "system-ui, sans-serif";
  }
  const escaped = primary.replaceAll('"', '\\"');
  return `"${escaped}", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif`;
}

function cssFontStyleFromFaceStyle(value) {
  const style = canonicalizeFontStyle(value).toLowerCase();
  if (style.includes("oblique")) {
    return "oblique";
  }
  if (style.includes("italic")) {
    return "italic";
  }
  return "normal";
}

if (isPreviewMode) {
  status.hidden = true;
  window.addEventListener("message", handlePreviewMessage);
}

await loadConfig();

if (!isPreviewMode) {
  connectEvents();
}
