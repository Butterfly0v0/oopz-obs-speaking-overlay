const overlay = document.querySelector("#overlay");
const usersContainer = document.querySelector("#users");
const status = document.querySelector("#status");
const template = document.querySelector("#user-card-template");

let overlayConfig = {
  layout: "horizontal",
  avatarSize: 72,
  dimOpacity: 0.34,
  inactiveGrayscale: 0.7,
  highlightScale: 1.06,
  showIds: true,
  showDisplayNames: true,
  idFontSize: 11,
  nameFontSize: 15,
  nameEllipsis: true,
};

const cards = new Map();

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
  overlay.className = `overlay overlay--${overlayConfig.layout}`;
  document.documentElement.style.setProperty("--avatar-size", `${overlayConfig.avatarSize}px`);
  document.documentElement.style.setProperty("--dim-opacity", String(overlayConfig.dimOpacity));
  document.documentElement.style.setProperty("--inactive-grayscale", String(clamp01(overlayConfig.inactiveGrayscale)));
  document.documentElement.style.setProperty("--highlight-scale", String(overlayConfig.highlightScale));
  document.documentElement.style.setProperty("--id-font-size", `${overlayConfig.idFontSize}px`);
  document.documentElement.style.setProperty("--name-font-size", `${overlayConfig.nameFontSize}px`);
  document.documentElement.style.setProperty("--name-ellipsis", overlayConfig.nameEllipsis ? "ellipsis" : "clip");
  document.documentElement.style.setProperty("--name-white-space", overlayConfig.nameEllipsis ? "nowrap" : "normal");
}

function setStatus(message, isError = false) {
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

  displayName.textContent = user.displayName || user.id;
  displayName.hidden = !overlayConfig.showDisplayNames;
  userId.textContent = user.id;
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

await loadConfig();
connectEvents();
