const form = document.querySelector("#config-form");
const previewFrame = document.querySelector("#preview");
const saveBtn = document.querySelector("#save-btn");
const resetBtn = document.querySelector("#reset-btn");
const statusText = document.querySelector("#status-text");
const speakingUserSelect = document.querySelector("#speakingUser");
const userList = document.querySelector("#user-list");
const addUserBtn = document.querySelector("#add-user-btn");
const fontFamilySelect = document.querySelector("#fontFamily");
const fontStyleSelect = document.querySelector("#fontStyle");
const fontSearchInput = document.querySelector("#fontSearch");
const fontListMeta = document.querySelector("#fontList-meta");
const refreshFontsBtn = document.querySelector("#refresh-fonts-btn");

const FALLBACK_FAMILIES = [
  {
    family: "Microsoft YaHei",
    styles: [
      { style: "Regular", fullName: "Microsoft YaHei" },
      { style: "Bold", fullName: "Microsoft YaHei Bold" },
      { style: "Light", fullName: "Microsoft YaHei Light" },
    ],
  },
  {
    family: "Segoe UI",
    styles: [
      { style: "Regular", fullName: "Segoe UI" },
      { style: "Bold", fullName: "Segoe UI Bold" },
      { style: "Light", fullName: "Segoe UI Light" },
      { style: "SemiBold", fullName: "Segoe UI Semibold" },
    ],
  },
  {
    family: "Arial",
    styles: [
      { style: "Regular", fullName: "Arial" },
      { style: "Bold", fullName: "Arial Bold" },
      { style: "Italic", fullName: "Arial Italic" },
      { style: "Bold Italic", fullName: "Arial Bold Italic" },
    ],
  },
  {
    family: "system-ui",
    styles: [{ style: "Regular", fullName: "system-ui" }],
  },
];

const defaultOverlay = {
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

const defaultPreviewUsers = [
  { id: "player-001", displayName: "Player One", muted: false },
  { id: "player-002", displayName: "Player Two", muted: false },
  { id: "Butterfly", displayName: "蝴蝶玩家", muted: false },
  { id: "very-long-display-name-demo", displayName: "这是一个很长的昵称用于测试省略号", muted: true },
];

const palette = ["#ff6b6b", "#ffd166", "#06d6a0", "#4cc9f0", "#a78bfa", "#f472b6", "#fb923c", "#84cc16"];

let savedOverlay = { ...defaultOverlay };
let savedMockUsers = [];
let previewUsers = [];
let previewReady = false;
let configReady = false;
let nextUserCounter = 1;
let fontCatalog = structuredClone(FALLBACK_FAMILIES);
let preferredFontFamily = defaultOverlay.fontFamily;
let preferredFontStyle = defaultOverlay.fontStyle;

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusText.classList.remove("is-success", "is-error");
  if (type) {
    statusText.classList.add(type);
  }
}

function stableColor(userId) {
  let hash = 0;
  for (const char of String(userId)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return palette[hash % palette.length];
}

function cloneUsers(users) {
  return users.map((user) => ({
    id: user.id ?? "",
    displayName: user.displayName ?? user.id ?? "",
    muted: Boolean(user.muted),
    avatarUrl: user.avatarUrl ?? "",
  }));
}

function normalizeUsers(users) {
  const normalized = [];
  const seenIds = new Set();

  users.forEach((user, index) => {
    const id = String(user.id ?? "").trim() || `user-${index + 1}`;
    const uniqueId = seenIds.has(id) ? `${id}-${index + 1}` : id;
    seenIds.add(uniqueId);
    normalized.push({
      id: uniqueId,
      displayName: String(user.displayName ?? uniqueId).trim() || uniqueId,
      muted: Boolean(user.muted),
      avatarUrl: String(user.avatarUrl ?? "").trim(),
    });
  });

  return normalized;
}

function formatValue(name, value) {
  if (name === "dimOpacity" || name === "inactiveGrayscale" || name === "highlightScale") {
    return Number(value).toFixed(2);
  }
  if (name === "speakFloatDuration") {
    return `${Number(value).toFixed(2)}s`;
  }
  if (name === "nameLetterSpacing" || name === "idLetterSpacing") {
    return `${Number(value).toFixed(2)}em`;
  }
  if (name === "avatarSize" || name === "nameFontSize" || name === "idFontSize" || name === "speakFloatAmplitude") {
    return `${value}px`;
  }
  return String(value);
}

function updateValueLabels(overlay) {
  for (const [name, value] of Object.entries(overlay)) {
    const label = document.querySelector(`#${name}-value`);
    if (label) {
      label.textContent = formatValue(name, value);
    }
  }
}

function extractPrimaryFont(fontFamily) {
  const raw = String(fontFamily ?? "").trim();
  if (!raw) {
    return defaultOverlay.fontFamily;
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

function syncSpeakFloatControls() {
  const enabled = form.elements.speakFloatEnabled.checked;
  form.elements.speakFloatAmplitude.disabled = !enabled;
  form.elements.speakFloatDuration.disabled = !enabled;
  form.elements.speakFloatEase.disabled = !enabled;
}

function findFamilyEntry(familyName) {
  const target = extractPrimaryFont(familyName).toLowerCase();
  return fontCatalog.find((entry) => entry.family.toLowerCase() === target) ?? null;
}

function stylesForFamily(familyName) {
  const entry = findFamilyEntry(familyName);
  if (entry?.styles?.length) {
    return entry.styles;
  }
  return [{ style: "Regular", fullName: extractPrimaryFont(familyName) }];
}

function resolveFontFace(familyName, styleName) {
  const family = extractPrimaryFont(familyName);
  const style = canonicalizeFontStyle(styleName);
  const match = stylesForFamily(family).find((item) => canonicalizeFontStyle(item.style) === style);
  if (match?.fullName) {
    return match.fullName;
  }
  return style === "Regular" ? family : `${family} ${style}`;
}

function ensureFamilyInCatalog(familyName, styleName = "Regular", fullName = "") {
  const family = extractPrimaryFont(familyName);
  const style = canonicalizeFontStyle(styleName);
  const face = String(fullName || "").trim() || (style === "Regular" ? family : `${family} ${style}`);
  let entry = findFamilyEntry(family);
  if (!entry) {
    entry = { family, styles: [{ style: "Regular", fullName: family }] };
    fontCatalog = [entry, ...fontCatalog];
  }
  if (!entry.styles.some((item) => canonicalizeFontStyle(item.style) === style)) {
    entry.styles.push({ style, fullName: face });
  }
}

function filteredFamilies() {
  const query = String(fontSearchInput.value ?? "").trim().toLowerCase();
  if (!query) {
    return fontCatalog;
  }
  return fontCatalog.filter((entry) => {
    if (entry.family.toLowerCase().includes(query)) {
      return true;
    }
    return entry.styles.some(
      (item) => item.style.toLowerCase().includes(query) || String(item.fullName).toLowerCase().includes(query),
    );
  });
}

function renderFontStyleOptions(familyName, selectedStyle = preferredFontStyle) {
  const styles = stylesForFamily(familyName);
  const preferred = canonicalizeFontStyle(selectedStyle);
  fontStyleSelect.replaceChildren(
    ...styles.map((item) => {
      const option = document.createElement("option");
      option.value = item.style;
      option.textContent = item.style;
      option.dataset.fullName = item.fullName;
      option.style.fontFamily = `"${String(item.fullName).replaceAll('"', "")}", sans-serif`;
      return option;
    }),
  );

  const exact = styles.find((item) => canonicalizeFontStyle(item.style) === preferred);
  if (exact) {
    fontStyleSelect.value = exact.style;
    preferredFontStyle = exact.style;
  } else if (styles.length > 0) {
    fontStyleSelect.value = styles[0].style;
    preferredFontStyle = styles[0].style;
  }
}

function renderFontOptions(selectedFont = preferredFontFamily, selectedStyle = preferredFontStyle) {
  const preferred = extractPrimaryFont(selectedFont || preferredFontFamily || defaultOverlay.fontFamily);
  ensureFamilyInCatalog(preferred, selectedStyle);
  preferredFontFamily = preferred;
  preferredFontStyle = canonicalizeFontStyle(selectedStyle);

  const families = filteredFamilies();
  fontFamilySelect.replaceChildren(
    ...families.map((entry) => {
      const option = document.createElement("option");
      option.value = entry.family;
      option.textContent = entry.family;
      option.style.fontFamily = `"${entry.family.replaceAll('"', "")}", sans-serif`;
      return option;
    }),
  );

  const exact = families.find((entry) => entry.family.toLowerCase() === preferred.toLowerCase());
  if (exact) {
    fontFamilySelect.value = exact.family;
    preferredFontFamily = exact.family;
  } else if (families.length > 0) {
    fontFamilySelect.selectedIndex = 0;
    preferredFontFamily = fontFamilySelect.value;
  }

  renderFontStyleOptions(preferredFontFamily, preferredFontStyle);

  const total = fontCatalog.length;
  const shown = families.length;
  fontListMeta.textContent = shown === total ? `${total} 个` : `${shown} / ${total}`;
}

function normalizeCatalog(rawFamilies) {
  if (!Array.isArray(rawFamilies)) {
    return structuredClone(FALLBACK_FAMILIES);
  }
  const normalized = [];
  for (const item of rawFamilies) {
    const family = String(item?.family ?? "").trim();
    if (!family) {
      continue;
    }
    const styles = Array.isArray(item.styles)
      ? item.styles
          .map((styleItem) => ({
            style: canonicalizeFontStyle(styleItem?.style),
            fullName: String(styleItem?.fullName ?? "").trim() || family,
          }))
          .filter((styleItem) => styleItem.style)
      : [];
    if (!styles.length) {
      styles.push({ style: "Regular", fullName: family });
    }
    normalized.push({ family, styles });
  }
  return normalized.length ? normalized : structuredClone(FALLBACK_FAMILIES);
}

async function loadSystemFonts({ keepStatus = true } = {}) {
  try {
    const response = await fetch("/api/fonts", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`无法读取本机字体 (${response.status})`);
    }
    const data = await response.json();
    fontCatalog = normalizeCatalog(data.families);
    renderFontOptions(preferredFontFamily, preferredFontStyle);
    if (!keepStatus) {
      setStatus(`已加载本机字体 ${fontCatalog.length} 个字族`, "is-success");
    }
  } catch (error) {
    fontCatalog = structuredClone(FALLBACK_FAMILIES);
    renderFontOptions(preferredFontFamily, preferredFontStyle);
    if (!keepStatus) {
      setStatus(error.message, "is-error");
    }
  }
}

function readOverlayFromForm() {
  const data = new FormData(form);
  const selectedFont = extractPrimaryFont(data.get("fontFamily") || preferredFontFamily);
  const selectedStyle = canonicalizeFontStyle(data.get("fontStyle") || preferredFontStyle);
  preferredFontFamily = selectedFont;
  preferredFontStyle = selectedStyle;
  const fontFace = resolveFontFace(selectedFont, selectedStyle);
  return {
    layout: data.get("layout"),
    avatarSize: Number(data.get("avatarSize")),
    dimOpacity: Number(data.get("dimOpacity")),
    inactiveGrayscale: Number(data.get("inactiveGrayscale")),
    highlightScale: Number(data.get("highlightScale")),
    showIds: form.elements.showIds.checked,
    showDisplayNames: form.elements.showDisplayNames.checked,
    fontFamily: selectedFont,
    fontStyle: selectedStyle,
    fontFace,
    idFontSize: Number(data.get("idFontSize")),
    nameFontSize: Number(data.get("nameFontSize")),
    nameFontWeight: Number(data.get("nameFontWeight")),
    idFontWeight: Number(data.get("idFontWeight")),
    nameLetterSpacing: Number(data.get("nameLetterSpacing")),
    idLetterSpacing: Number(data.get("idLetterSpacing")),
    nameEllipsis: form.elements.nameEllipsis.checked,
    speakFloatEnabled: form.elements.speakFloatEnabled.checked,
    speakFloatAmplitude: Number(data.get("speakFloatAmplitude")),
    speakFloatDuration: Number(data.get("speakFloatDuration")),
    speakFloatEase: data.get("speakFloatEase") || "ease-in-out",
  };
}

function writeOverlayToForm(overlay) {
  form.elements.layout.value = overlay.layout;
  form.elements.avatarSize.value = overlay.avatarSize;
  form.elements.dimOpacity.value = overlay.dimOpacity;
  form.elements.inactiveGrayscale.value = overlay.inactiveGrayscale;
  form.elements.highlightScale.value = overlay.highlightScale;
  form.elements.showIds.checked = overlay.showIds;
  form.elements.showDisplayNames.checked = overlay.showDisplayNames;

  preferredFontFamily = extractPrimaryFont(overlay.fontFamily || defaultOverlay.fontFamily);
  preferredFontStyle = canonicalizeFontStyle(overlay.fontStyle ?? defaultOverlay.fontStyle);
  ensureFamilyInCatalog(preferredFontFamily, preferredFontStyle, overlay.fontFace);
  renderFontOptions(preferredFontFamily, preferredFontStyle);

  form.elements.idFontSize.value = overlay.idFontSize;
  form.elements.nameFontSize.value = overlay.nameFontSize;
  form.elements.nameFontWeight.value = overlay.nameFontWeight ?? defaultOverlay.nameFontWeight;
  form.elements.idFontWeight.value = overlay.idFontWeight ?? defaultOverlay.idFontWeight;
  form.elements.nameLetterSpacing.value = overlay.nameLetterSpacing ?? defaultOverlay.nameLetterSpacing;
  form.elements.idLetterSpacing.value = overlay.idLetterSpacing ?? defaultOverlay.idLetterSpacing;
  form.elements.nameEllipsis.checked = overlay.nameEllipsis;
  form.elements.speakFloatEnabled.checked = overlay.speakFloatEnabled ?? defaultOverlay.speakFloatEnabled;
  form.elements.speakFloatAmplitude.value = overlay.speakFloatAmplitude ?? defaultOverlay.speakFloatAmplitude;
  form.elements.speakFloatDuration.value = overlay.speakFloatDuration ?? defaultOverlay.speakFloatDuration;
  form.elements.speakFloatEase.value = overlay.speakFloatEase || defaultOverlay.speakFloatEase;
  syncSpeakFloatControls();
  updateValueLabels(overlay);
}

function readUsersFromList() {
  return Array.from(userList.querySelectorAll(".user-row")).map((row) => ({
    id: row.querySelector(".user-id").value.trim(),
    displayName: row.querySelector(".user-display-name").value.trim(),
    muted: row.querySelector(".user-muted").checked,
    avatarUrl: "",
  }));
}

function createUserRow(user, index) {
  const row = document.createElement("div");
  row.className = "user-row";
  row.dataset.index = String(index);
  row.innerHTML = `
    <div class="user-row__header">
      <span class="user-row__index">用户 ${index + 1}</span>
      <button type="button" class="btn btn--ghost btn--small user-remove">删除</button>
    </div>
    <label class="field">
      <span>ID</span>
      <input class="user-id" type="text" value="${escapeHtml(user.id)}" placeholder="例如 player-004" />
    </label>
    <label class="field">
      <span>昵称</span>
      <input class="user-display-name" type="text" value="${escapeHtml(user.displayName)}" placeholder="显示名称" />
    </label>
    <label class="field field--checkbox">
      <input class="user-muted" type="checkbox" ${user.muted ? "checked" : ""} />
      <span>静音状态</span>
    </label>
  `;

  row.querySelector(".user-remove").addEventListener("click", () => {
    removeUser(index);
  });

  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", handleUserListChange);
    input.addEventListener("change", handleUserListChange);
  });

  return row;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderUserList(users = previewUsers) {
  previewUsers = normalizeUsers(users);
  userList.replaceChildren(...previewUsers.map((user, index) => createUserRow(user, index)));
  refreshSpeakingUserOptions();
}

function handleUserListChange() {
  previewUsers = normalizeUsers(readUsersFromList());
  refreshSpeakingUserOptions();
  syncPreview();
}

function refreshSpeakingUserOptions() {
  const previous = speakingUserSelect.value;
  speakingUserSelect.replaceChildren(
    ...previewUsers.map((user) => {
      const option = document.createElement("option");
      option.value = user.id;
      option.textContent = user.displayName || user.id;
      return option;
    }),
  );

  if (previewUsers.some((user) => user.id === previous)) {
    speakingUserSelect.value = previous;
  } else if (previewUsers.length > 0) {
    speakingUserSelect.value = previewUsers[0].id;
  }
}

function createNewUser() {
  const id = `user-${String(nextUserCounter).padStart(3, "0")}`;
  nextUserCounter += 1;
  return { id, displayName: `用户 ${nextUserCounter - 1}`, muted: false, avatarUrl: "" };
}

function addUser() {
  previewUsers = normalizeUsers([...readUsersFromList(), createNewUser()]);
  renderUserList(previewUsers);
  speakingUserSelect.value = previewUsers[previewUsers.length - 1].id;
  syncPreview();
}

function removeUser(index) {
  const users = readUsersFromList();
  if (users.length <= 1) {
    setStatus("至少保留一个虚拟用户", "is-error");
    return;
  }
  users.splice(index, 1);
  previewUsers = normalizeUsers(users);
  renderUserList(previewUsers);
  syncPreview();
}

function buildPreviewState() {
  const speakingId = speakingUserSelect.value;
  return {
    connected: true,
    voice: true,
    users: previewUsers.map((user) => ({
      id: user.id,
      displayName: user.displayName || user.id,
      speaking: user.id === speakingId,
      muted: user.muted,
      color: stableColor(user.id),
      avatarUrl: user.avatarUrl || "",
    })),
  };
}

function postToPreview(message) {
  if (!previewReady || !previewFrame.contentWindow) {
    return;
  }
  previewFrame.contentWindow.postMessage(message, window.location.origin);
}

function syncPreview() {
  syncSpeakFloatControls();
  const overlay = readOverlayFromForm();
  updateValueLabels(overlay);
  postToPreview({ type: "overlay-config-update", overlay });
  postToPreview({ type: "overlay-preview-state", state: buildPreviewState() });
}

function trySyncPreview() {
  if (!previewReady || !configReady) {
    return;
  }
  syncPreview();
}

function usersForSave() {
  return normalizeUsers(readUsersFromList()).map((user) => ({
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  }));
}

function normalizeSavedOverlay(overlay) {
  const next = { ...defaultOverlay, ...overlay };
  next.fontFamily = extractPrimaryFont(next.fontFamily);
  next.fontStyle = canonicalizeFontStyle(next.fontStyle);
  next.fontFace = String(next.fontFace ?? "").trim() || resolveFontFace(next.fontFamily, next.fontStyle);
  return next;
}

async function loadConfig() {
  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`无法读取配置 (${response.status})`);
  }
  const data = await response.json();
  savedOverlay = normalizeSavedOverlay(data.overlay ?? {});
  preferredFontFamily = savedOverlay.fontFamily;
  preferredFontStyle = savedOverlay.fontStyle;
  const loadedUsers = data.mock?.users?.length ? data.mock.users : defaultPreviewUsers;
  savedMockUsers = cloneUsers(loadedUsers);
  previewUsers = cloneUsers(savedMockUsers);
  nextUserCounter = previewUsers.length + 1;
  writeOverlayToForm(savedOverlay);
  renderUserList(previewUsers);
  if (previewUsers.length > 1) {
    speakingUserSelect.value = previewUsers[1].id;
  }
  configReady = true;
  trySyncPreview();
}

async function saveConfig() {
  const overlay = readOverlayFromForm();
  const mockUsers = usersForSave();
  saveBtn.disabled = true;
  setStatus("正在保存…");

  try {
    const response = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overlay, mockUsers }),
    });
    if (!response.ok) {
      throw new Error(`保存失败 (${response.status})`);
    }
    const data = await response.json();
    savedOverlay = normalizeSavedOverlay(data.overlay ?? overlay);
    preferredFontFamily = savedOverlay.fontFamily;
    preferredFontStyle = savedOverlay.fontStyle;
    savedMockUsers = cloneUsers(data.mock?.users ?? mockUsers);
    previewUsers = cloneUsers(savedMockUsers);
    writeOverlayToForm(savedOverlay);
    renderUserList(previewUsers);
    syncPreview();
    setStatus("配置与虚拟用户已保存到 config.json", "is-success");
  } catch (error) {
    setStatus(error.message, "is-error");
  } finally {
    saveBtn.disabled = false;
  }
}

form.addEventListener("input", (event) => {
  if (event.target === fontSearchInput) {
    renderFontOptions(preferredFontFamily, preferredFontStyle);
    return;
  }
  syncPreview();
});
form.addEventListener("change", syncPreview);
fontFamilySelect.addEventListener("change", () => {
  preferredFontFamily = extractPrimaryFont(fontFamilySelect.value);
  renderFontStyleOptions(preferredFontFamily, preferredFontStyle);
  preferredFontStyle = canonicalizeFontStyle(fontStyleSelect.value);
  syncPreview();
});
fontStyleSelect.addEventListener("change", () => {
  preferredFontStyle = canonicalizeFontStyle(fontStyleSelect.value);
  syncPreview();
});
refreshFontsBtn.addEventListener("click", async () => {
  refreshFontsBtn.disabled = true;
  setStatus("正在刷新本机字体…");
  await loadSystemFonts({ keepStatus: false });
  syncPreview();
  refreshFontsBtn.disabled = false;
});
saveBtn.addEventListener("click", saveConfig);
addUserBtn.addEventListener("click", addUser);
resetBtn.addEventListener("click", () => {
  writeOverlayToForm(savedOverlay);
  previewUsers = cloneUsers(savedMockUsers);
  renderUserList(previewUsers);
  syncPreview();
  setStatus("已恢复为上次保存的配置");
});

previewFrame.addEventListener("load", () => {
  previewReady = true;
  trySyncPreview();
});

try {
  await loadSystemFonts();
  await loadConfig();
  setStatus("可添加虚拟用户测试多成员场景，修改后点击“保存配置”");
} catch (error) {
  setStatus(error.message, "is-error");
}
