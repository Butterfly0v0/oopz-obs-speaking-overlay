const form = document.querySelector("#config-form");
const previewFrame = document.querySelector("#preview");
const saveBtn = document.querySelector("#save-btn");
const resetBtn = document.querySelector("#reset-btn");
const statusText = document.querySelector("#status-text");
const speakingUserSelect = document.querySelector("#speakingUser");
const userList = document.querySelector("#user-list");
const addUserBtn = document.querySelector("#add-user-btn");

const defaultOverlay = {
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
  if (name === "avatarSize" || name === "nameFontSize" || name === "idFontSize") {
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

function readOverlayFromForm() {
  const data = new FormData(form);
  return {
    layout: data.get("layout"),
    avatarSize: Number(data.get("avatarSize")),
    dimOpacity: Number(data.get("dimOpacity")),
    inactiveGrayscale: Number(data.get("inactiveGrayscale")),
    highlightScale: Number(data.get("highlightScale")),
    showIds: form.elements.showIds.checked,
    showDisplayNames: form.elements.showDisplayNames.checked,
    idFontSize: Number(data.get("idFontSize")),
    nameFontSize: Number(data.get("nameFontSize")),
    nameEllipsis: form.elements.nameEllipsis.checked,
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
  form.elements.idFontSize.value = overlay.idFontSize;
  form.elements.nameFontSize.value = overlay.nameFontSize;
  form.elements.nameEllipsis.checked = overlay.nameEllipsis;
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

async function loadConfig() {
  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`无法读取配置 (${response.status})`);
  }
  const data = await response.json();
  savedOverlay = { ...defaultOverlay, ...(data.overlay ?? {}) };
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
    savedOverlay = { ...defaultOverlay, ...(data.overlay ?? overlay) };
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

form.addEventListener("input", syncPreview);
form.addEventListener("change", syncPreview);
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
  await loadConfig();
  setStatus("可添加虚拟用户测试多成员场景，修改后点击“保存配置”");
} catch (error) {
  setStatus(error.message, "is-error");
}
