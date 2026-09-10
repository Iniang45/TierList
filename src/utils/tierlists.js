const STORAGE_KEY = "tierlists";
const RANKED_STORAGE_KEY = "ranked_tierlists";
const TEMP_STORAGE_KEY = "guest_tierlists";

const DEFAULT_TIER_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#64748b",
];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function createDefaultTiers() {
  return ["S", "A", "B", "C"].map((name, index) => ({
    id: uid(),
    name,
    color: DEFAULT_TIER_COLORS[index % DEFAULT_TIER_COLORS.length],
  }));
}

export function contrastTextColor(color) {
  if (!color || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
    return "#ffffff";
  }

  const normalized =
    color.length === 4
      ? `#${color
          .slice(1)
          .split("")
          .map((part) => part + part)
          .join("")}`
      : color;

  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? "#111827" : "#ffffff";
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

export async function optimizeImageDataUrl(dataUrl, options = {}) {
  if (
    !dataUrl ||
    typeof dataUrl !== "string" ||
    !dataUrl.startsWith("data:image/")
  ) {
    return dataUrl;
  }

  const maxWidth = options.maxWidth || 1200;
  const maxHeight = options.maxHeight || 1200;
  const quality = options.quality || 0.82;

  try {
    const image = await loadImage(dataUrl);
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return dataUrl;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

function normalizeTier(tier, index = 0) {
  return {
    id: tier?.id || uid(),
    name: tier?.name || tier?.label || `Tier ${index + 1}`,
    color:
      tier?.color || DEFAULT_TIER_COLORS[index % DEFAULT_TIER_COLORS.length],
  };
}

function normalizeItem(item) {
  return {
    id: item?.id || uid(),
    src: item?.src || "",
    text: item?.text || "",
    explanation: item?.explanation || "",
    tierId: Object.prototype.hasOwnProperty.call(item || {}, "tierId")
      ? item.tierId
      : null,
  };
}

function normalizeCoverImage(record, items) {
  if (record?.coverImage) {
    return {
      id: record.coverImage.id || uid(),
      src: record.coverImage.src || "",
      alt: record.coverImage.alt || record.name || "TierList",
    };
  }

  const firstImage = items[0];
  if (firstImage) {
    return {
      id: firstImage.id,
      src: firstImage.src,
      alt: firstImage.text || record?.name || "TierList",
    };
  }

  return null;
}

export function normalizeTierlist(record) {
  const sourceItems =
    Array.isArray(record?.items) && record.items.length > 0
      ? record.items
      : Array.isArray(record?.images)
        ? record.images
        : [];

  const items = sourceItems.map(normalizeItem);
  const coverImage = normalizeCoverImage(record, items);
  const tiers =
    Array.isArray(record?.tiers) && record.tiers.length > 0
      ? record.tiers.map(normalizeTier)
      : createDefaultTiers();
  const type =
    record?.type ||
    (items.some((item) => item.tierId !== null && item.tierId !== undefined)
      ? "ranking"
      : "template");

  return {
    ...record,
    id: record?.id || uid(),
    type,
    name: record?.name || "Sans titre",
    description: record?.description || "",
    coverImage,
    tiers,
    items,
    images:
      Array.isArray(record?.images) && record.images.length > 0
        ? record.images.map((image) => ({
            id: image?.id || uid(),
            src: image?.src || "",
            text: image?.text || "",
          }))
        : items.map(({ tierId, explanation, ...image }) => image),
    created: record?.created || Date.now(),
    updated: record?.updated || record?.created || Date.now(),
  };
}

function readList(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}

function writeList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function readTemporaryList() {
  return JSON.parse(sessionStorage.getItem(TEMP_STORAGE_KEY) || "[]");
}

function writeTemporaryList(list) {
  sessionStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(list));
}

function writeListSafely(key, list) {
  try {
    writeList(key, list);
    return true;
  } catch (error) {
    if (error?.name !== "QuotaExceededError") {
      throw error;
    }

    const fallback = list.map((record) => ({
      ...record,
      coverImage: record?.coverImage
        ? {
            id: record.coverImage.id,
            src: record.coverImage.src,
            alt: record.coverImage.alt,
          }
        : null,
      items: Array.isArray(record?.items)
        ? record.items.map((item) => ({
            id: item.id,
            text: item.text || "",
            explanation: item.explanation || "",
            tierId: Object.prototype.hasOwnProperty.call(item || {}, "tierId")
              ? item.tierId
              : null,
          }))
        : [],
      images: Array.isArray(record?.images)
        ? record.images.map((image) => ({
            id: image.id,
            text: image.text || "",
          }))
        : [],
    }));

    writeList(key, fallback);
    return false;
  }
}

export function loadSavedTierlists() {
  const ranked = readList(RANKED_STORAGE_KEY).map(normalizeTierlist);
  const saved = readList(STORAGE_KEY).map(normalizeTierlist);

  const merged = new Map();
  [...ranked, ...saved].forEach((record) => {
    merged.set(record.id, record);
  });

  return Array.from(merged.values()).sort(
    (left, right) =>
      (right.updated || right.created) - (left.updated || left.created),
  );
}

export function loadTemporaryTierlists() {
  return readTemporaryList()
    .map(normalizeTierlist)
    .sort(
      (left, right) =>
        (right.updated || right.created) - (left.updated || left.created),
    );
}

export function saveTemporaryTierlist(record) {
  const normalized = normalizeTierlist({ ...record, updated: Date.now() });
  const list = readTemporaryList().map(normalizeTierlist);
  const index = list.findIndex((item) => item.id === normalized.id);

  if (index >= 0) {
    list[index] = normalized;
  } else {
    list.push(normalized);
  }
  writeTemporaryList(list);
  return normalized;
}

export function deleteTemporaryTierlist(id) {
  writeTemporaryList(
    readTemporaryList()
      .map(normalizeTierlist)
      .filter((item) => item.id !== id),
  );
}

export function saveTierlistRecord(record) {
  const normalized = normalizeTierlist({ ...record, updated: Date.now() });
  const saved = readList(STORAGE_KEY).map(normalizeTierlist);
  const savedIndex = saved.findIndex((item) => item.id === normalized.id);

  if (savedIndex >= 0) {
    saved[savedIndex] = normalized;
  } else {
    saved.push(normalized);
  }
  writeListSafely(STORAGE_KEY, saved);

  if (normalized.type === "ranking") {
    const ranked = readList(RANKED_STORAGE_KEY).map(normalizeTierlist);
    const rankedIndex = ranked.findIndex((item) => item.id === normalized.id);

    if (rankedIndex >= 0) {
      ranked[rankedIndex] = normalized;
    } else {
      ranked.push(normalized);
    }
    writeListSafely(RANKED_STORAGE_KEY, ranked);
  }

  return normalized;
}

export function deleteTierlistRecord(id) {
  const saved = readList(STORAGE_KEY)
    .map(normalizeTierlist)
    .filter((item) => item.id !== id);
  const ranked = readList(RANKED_STORAGE_KEY)
    .map(normalizeTierlist)
    .filter((item) => item.id !== id);

  writeList(STORAGE_KEY, saved);
  writeList(RANKED_STORAGE_KEY, ranked);
}
