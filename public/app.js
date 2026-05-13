const LANGUAGE_STORAGE_KEY = "codex-rate-dashboard-language";

const translations = {
  ja: {
    languageName: "日本語",
    locale: "ja-JP",
    primaryShort: "5時間",
    secondaryShort: "1週間",
    primaryLabel: "5時間枠",
    secondaryLabel: "1週間枠",
    primaryMetric: "5時間枠 残量",
    secondaryMetric: "1週間枠 残量",
    scanMetric: "最終スキャン",
    scan: "再スキャン",
    scanning: "スキャン中",
    snapshots: "snapshots",
    reset: "リセット",
    resetMark: "リセット予定",
    recordedAt: "記録",
    remaining: "残量",
    remainingTrend: (label) => `${label}の残量推移`,
    scopeAll: (label) => `全期間の ${label} 残量`,
    scope24h: (label) => `直近24時間の ${label} 残量`,
    scopeDays: (days, label) => `直近${days}日の ${label} 残量`,
    dailyTitle: (label) => `${label}の日別最低残量`,
    generated: "生成",
    emptyChart: "表示できる rate_limits がまだありません。",
    emptyDaily: "日別データはまだありません。",
    limitGroup: "表示するレート枠",
    periodGroup: "表示期間",
    statusRegion: "現在の状態",
    chartRegion: "レート制限グラフ",
    chartImage: "Codex rate limit 残量グラフ",
    dailyRegion: "日別最低残量",
    dashboardControls: "ダッシュボード操作",
    localOnly: "Local only",
    all: "全期間",
    daysLabel: (days) => `${days}日`,
  },
  en: {
    languageName: "English",
    locale: "en-US",
    primaryShort: "5h",
    secondaryShort: "1w",
    primaryLabel: "5-hour window",
    secondaryLabel: "Weekly window",
    primaryMetric: "5-hour remaining",
    secondaryMetric: "Weekly remaining",
    scanMetric: "Last scan",
    scan: "Rescan",
    scanning: "Scanning",
    snapshots: "snapshots",
    reset: "Reset",
    resetMark: "Reset",
    recordedAt: "Recorded",
    remaining: "Remaining",
    remainingTrend: (label) => `${label} remaining`,
    scopeAll: (label) => `All ${label} remaining`,
    scope24h: (label) => `Last 24 hours of ${label} remaining`,
    scopeDays: (days, label) => `Last ${days} days of ${label} remaining`,
    dailyTitle: (label) => `${label} daily lowest remaining`,
    generated: "Generated",
    emptyChart: "No rate_limits snapshots to display yet.",
    emptyDaily: "No daily data yet.",
    limitGroup: "Rate window",
    periodGroup: "Display period",
    statusRegion: "Current status",
    chartRegion: "Rate limit chart",
    chartImage: "Codex rate limit remaining chart",
    dailyRegion: "Daily lowest remaining",
    dashboardControls: "Dashboard controls",
    localOnly: "Local only",
    all: "All",
    daysLabel: (days) => `${days}d`,
  },
};

const getInitialLanguage = () => {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "ja" || stored === "en") return stored;
  return navigator.language?.toLowerCase().startsWith("ja") ? "ja" : "en";
};

const state = {
  days: 7,
  limit: "primary",
  language: getInitialLanguage(),
  data: null,
  scanToken: null,
};

let chartState = null;

const elements = {
  primaryMetricLabel: document.querySelector("#primaryMetricLabel"),
  secondaryMetricLabel: document.querySelector("#secondaryMetricLabel"),
  scanMetricLabel: document.querySelector("#scanMetricLabel"),
  primaryValue: document.querySelector("#primaryValue"),
  secondaryValue: document.querySelector("#secondaryValue"),
  primaryReset: document.querySelector("#primaryReset"),
  secondaryReset: document.querySelector("#secondaryReset"),
  scanTime: document.querySelector("#scanTime"),
  scanCount: document.querySelector("#scanCount"),
  scanButton: document.querySelector("#scanButton"),
  chart: document.querySelector("#chart"),
  chartWrap: document.querySelector(".chart-wrap"),
  emptyState: document.querySelector("#emptyState"),
  chartTitle: document.querySelector("#chartTitle"),
  chartScope: document.querySelector("#chartScope"),
  activeLegend: document.querySelector("#activeLegend"),
  dailyTitle: document.querySelector("#dailyTitle"),
  dailyRows: document.querySelector("#dailyRows"),
  generatedAt: document.querySelector("#generatedAt"),
  toolbar: document.querySelector(".toolbar"),
  statusStrip: document.querySelector(".status-strip"),
  workspace: document.querySelector(".workspace"),
  dailyBand: document.querySelector(".daily-band"),
  limitSegments: document.querySelector(".limit-segments"),
  periodSegments: document.querySelector(".period-segments"),
  languageButtons: document.querySelectorAll("[data-lang]"),
  limitButtons: document.querySelectorAll("[data-limit]"),
  dayButtons: document.querySelectorAll("[data-days]"),
  eyebrow: document.querySelector(".eyebrow"),
};

function text(key) {
  return translations[state.language][key];
}

function formatPercent(value) {
  if (typeof value !== "number") return "--%";
  return `${Math.round(value)}%`;
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return new Intl.DateTimeFormat(text("locale"), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAxisDate(value) {
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return new Intl.DateTimeFormat(text("locale"), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getUnixSeconds(value) {
  if (typeof value !== "number") return null;
  return value > 10_000_000_000 ? Math.round(value / 1000) : value;
}

function setActiveDays(days) {
  elements.dayButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.days === String(days));
  });
}

function setActiveLimit(limit) {
  elements.limitButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.limit === limit);
  });
}

function setActiveLanguage(language) {
  elements.languageButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === language);
  });
}

function getLimitMeta() {
  if (state.limit === "secondary") {
    return {
      label: text("secondaryLabel"),
      usedKey: "secondaryUsedPercent",
      resetKey: "secondaryResetsAt",
      colorClass: "line-secondary",
    };
  }

  return {
    label: text("primaryLabel"),
    usedKey: "primaryUsedPercent",
    resetKey: "primaryResetsAt",
    colorClass: "line-primary",
  };
}

function remainingFromUsed(value) {
  return typeof value === "number" ? Math.max(0, Math.min(100, 100 - value)) : null;
}

function updateStaticText() {
  document.documentElement.lang = state.language;
  elements.eyebrow.textContent = text("localOnly");
  elements.primaryMetricLabel.textContent = text("primaryMetric");
  elements.secondaryMetricLabel.textContent = text("secondaryMetric");
  elements.scanMetricLabel.textContent = text("scanMetric");
  elements.scanButton.textContent = elements.scanButton.disabled ? text("scanning") : text("scan");
  elements.emptyState.textContent = text("emptyChart");
  elements.toolbar.setAttribute("aria-label", text("dashboardControls"));
  elements.statusStrip.setAttribute("aria-label", text("statusRegion"));
  elements.workspace.setAttribute("aria-label", text("chartRegion"));
  elements.chart.setAttribute("aria-label", text("chartImage"));
  elements.dailyBand.setAttribute("aria-label", text("dailyRegion"));
  elements.limitSegments.setAttribute("aria-label", text("limitGroup"));
  elements.periodSegments.setAttribute("aria-label", text("periodGroup"));

  elements.limitButtons.forEach((button) => {
    button.textContent = button.dataset.limit === "secondary" ? text("secondaryShort") : text("primaryShort");
  });
  elements.dayButtons.forEach((button) => {
    if (button.dataset.days === "all") {
      button.textContent = text("all");
      return;
    }
    if (button.dataset.days === "24h") {
      button.textContent = "24h";
      return;
    }
    button.textContent = text("daysLabel")(button.dataset.days);
  });
}

async function loadSummary() {
  const response = await fetch(`/api/summary?days=${state.days}`);
  if (!response.ok) throw new Error("summary request failed");
  state.data = await response.json();
  render();
}

async function loadConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error("config request failed");
  const config = await response.json();
  state.scanToken = config.scanToken || null;
}

async function runScan() {
  if (!state.scanToken) throw new Error("scan token is not ready");

  elements.scanButton.disabled = true;
  elements.scanButton.textContent = text("scanning");
  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: {
        "x-codex-rate-dashboard-token": state.scanToken,
      },
    });
    if (!response.ok) throw new Error("scan request failed");
    await loadSummary();
  } finally {
    elements.scanButton.disabled = false;
    elements.scanButton.textContent = text("scan");
  }
}

function render() {
  const data = state.data;
  const latest = data?.latest;
  const limit = getLimitMeta();

  updateStaticText();
  elements.primaryValue.textContent = formatPercent(remainingFromUsed(latest?.primaryUsedPercent));
  elements.secondaryValue.textContent = formatPercent(remainingFromUsed(latest?.secondaryUsedPercent));
  elements.primaryReset.textContent = `${text("reset")} ${formatDateTime(latest?.primaryResetsAt)}`;
  elements.secondaryReset.textContent = `${text("reset")} ${formatDateTime(latest?.secondaryResetsAt)}`;
  elements.scanTime.textContent = formatDateTime(data?.lastScan?.scannedAt);
  elements.scanCount.textContent = `${data?.totals?.snapshotCount ?? 0} ${text("snapshots")}`;
  elements.chartTitle.textContent = text("remainingTrend")(limit.label);
  elements.chartScope.textContent =
    state.days === "all"
      ? text("scopeAll")(limit.label)
      : state.days === "24h"
        ? text("scope24h")(limit.label)
        : text("scopeDays")(state.days, limit.label);
  elements.activeLegend.innerHTML = `<i class="${limit.colorClass}"></i>${limit.label} <span class="reset-legend"><i class="line-reset"></i>${text("resetMark")}</span>`;
  elements.dailyTitle.textContent = text("dailyTitle")(limit.label);
  elements.generatedAt.textContent = `${text("generated")} ${formatDateTime(data?.generatedAt)}`;

  renderChart(data?.points || []);
  renderDaily(data?.daily || []);
}

function pointsToPath(points, scaleX, scaleY) {
  return points
    .filter((point) => typeof point.remainingPercent === "number")
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${scaleX(new Date(point.eventTimestamp).getTime()).toFixed(2)} ${scaleY(point.remainingPercent).toFixed(2)}`;
    })
    .join(" ");
}

function getResetMarkers(points, minX, maxX) {
  const seen = new Set();
  return points
    .map((point) => getUnixSeconds(point.resetAt))
    .filter((seconds) => typeof seconds === "number")
    .map((seconds) => seconds * 1000)
    .filter((timestamp) => timestamp >= minX && timestamp <= maxX)
    .filter((timestamp) => {
      const key = Math.round(timestamp / 60_000);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a - b);
}

function getTimeTicks(minX, maxX, desiredCount = 5) {
  const span = Math.max(maxX - minX, 1);
  const count = Math.max(2, desiredCount);
  return Array.from({ length: count }, (_, index) => minX + (span * index) / (count - 1));
}

function findNearestPoint(points, timestamp) {
  let nearest = null;
  let smallestDistance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const distance = Math.abs(point.timestampMs - timestamp);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearest = point;
    }
  }
  return nearest;
}

function ensureTooltip() {
  let tooltip = elements.chartWrap.querySelector(".chart-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    tooltip.hidden = true;
    elements.chartWrap.append(tooltip);
  }
  return tooltip;
}

function hideTooltip() {
  const tooltip = elements.chartWrap.querySelector(".chart-tooltip");
  if (tooltip) tooltip.hidden = true;
  elements.chart.querySelectorAll(".hover-line, .hover-dot").forEach((node) => node.remove());
}

function showTooltip(point, event) {
  if (!chartState || !point) return;
  const tooltip = ensureTooltip();
  const resetAt = getUnixSeconds(point.resetAt);
  tooltip.innerHTML = `
    <strong>${formatPercent(point.remainingPercent)}</strong>
    <span>${text("recordedAt")} ${formatDateTime(point.eventTimestamp)}</span>
    <span>${text("remaining")} ${formatPercent(point.remainingPercent)}</span>
    <span>${text("resetMark")} ${resetAt ? formatDateTime(resetAt) : "--"}</span>
  `;

  const wrapRect = elements.chartWrap.getBoundingClientRect();
  const svgRect = elements.chart.getBoundingClientRect();
  const x = chartState.scaleX(point.timestampMs);
  const y = chartState.scaleY(point.remainingPercent);
  const left = svgRect.left - wrapRect.left + (x / chartState.width) * svgRect.width;
  const top = svgRect.top - wrapRect.top + (y / chartState.height) * svgRect.height;
  const preferLeft = event.clientX - wrapRect.left > wrapRect.width * 0.62;
  tooltip.style.left = `${Math.max(12, Math.min(wrapRect.width - 210, left + (preferLeft ? -220 : 14)))}px`;
  tooltip.style.top = `${Math.max(12, Math.min(wrapRect.height - 116, top - 84))}px`;
  tooltip.hidden = false;

  elements.chart.querySelectorAll(".hover-line, .hover-dot").forEach((node) => node.remove());
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("class", "hover-line");
  line.setAttribute("x1", x);
  line.setAttribute("x2", x);
  line.setAttribute("y1", chartState.padding.top);
  line.setAttribute("y2", chartState.height - chartState.padding.bottom);
  elements.chart.append(line);

  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("class", state.limit === "secondary" ? "hover-dot dot-secondary" : "hover-dot dot-primary");
  dot.setAttribute("cx", x);
  dot.setAttribute("cy", y);
  dot.setAttribute("r", 5);
  elements.chart.append(dot);
}

function renderChart(rawPoints) {
  const limit = getLimitMeta();
  const points = rawPoints
    .map((point) => ({
      eventTimestamp: point.eventTimestamp,
      timestampMs: new Date(point.eventTimestamp).getTime(),
      remainingPercent: remainingFromUsed(point[limit.usedKey]),
      resetAt: point[limit.resetKey],
    }))
    .filter((point) => Number.isFinite(point.timestampMs) && typeof point.remainingPercent === "number");
  const svg = elements.chart;
  svg.replaceChildren();
  hideTooltip();
  chartState = null;
  elements.emptyState.hidden = points.length > 0;
  if (points.length === 0) return;

  const width = 1060;
  const height = 390;
  const padding = { top: 18, right: 28, bottom: 42, left: 46 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const timestamps = points.map((point) => point.timestampMs);
  const minX = Math.min(...timestamps);
  const maxX = Math.max(...timestamps);
  const spanX = Math.max(maxX - minX, 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const scaleX = (value) => padding.left + ((value - minX) / spanX) * plotWidth;
  const scaleY = (value) => padding.top + (1 - Math.max(0, Math.min(100, value)) / 100) * plotHeight;
  chartState = { width, height, padding, minX, maxX, spanX, scaleX, scaleY, points };

  const make = (name, attributes = {}) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attributes)) {
      node.setAttribute(key, value);
    }
    svg.append(node);
    return node;
  };

  for (const tick of [0, 25, 50, 75, 100]) {
    const y = scaleY(tick);
    make("line", {
      class: "grid-line",
      x1: padding.left,
      x2: width - padding.right,
      y1: y,
      y2: y,
    });
    make("text", {
      class: "axis-label",
      x: 8,
      y: y + 4,
    }).textContent = `${tick}%`;
  }

  const timeTicks = getTimeTicks(minX, maxX, state.days === "24h" ? 7 : 5);
  for (const tick of timeTicks) {
    const x = scaleX(tick);
    make("line", {
      class: "x-grid-line",
      x1: x,
      x2: x,
      y1: padding.top,
      y2: height - padding.bottom,
    });
    make("text", {
      class: "axis-label axis-label-x",
      x,
      y: height - 12,
      "text-anchor": x > width - padding.right - 80 ? "end" : x < padding.left + 80 ? "start" : "middle",
    }).textContent = formatAxisDate(tick);
  }

  make("line", {
    class: "threshold",
    x1: padding.left,
    x2: width - padding.right,
    y1: scaleY(20),
    y2: scaleY(20),
  });
  make("line", {
    class: "limit-line",
    x1: padding.left,
    x2: width - padding.right,
    y1: scaleY(0),
    y2: scaleY(0),
  });

  const resetMarkers = getResetMarkers(points, minX, maxX);
  const resetLabelStep = Math.max(1, Math.ceil(resetMarkers.length / 8));
  resetMarkers.forEach((marker, index) => {
    const x = scaleX(marker);
    make("line", {
      class: "reset-marker",
      x1: x,
      x2: x,
      y1: padding.top,
      y2: height - padding.bottom,
    });
    make("circle", {
      class: "reset-marker-dot",
      cx: x,
      cy: padding.top,
      r: 3,
    });
    if (index % resetLabelStep !== 0) return;
    make("text", {
      class: "reset-marker-label",
      x: Math.min(width - padding.right - 4, x + 6),
      y: padding.top + 14,
    }).textContent = text("resetMark");
  });

  const pathData = pointsToPath(points, scaleX, scaleY);

  make("path", { class: state.limit === "secondary" ? "path-secondary" : "path-primary", d: pathData });

  const sampled = points.filter((_, index) => index % Math.max(1, Math.floor(points.length / 80)) === 0);
  for (const point of sampled) {
    const x = scaleX(point.timestampMs);
    make("circle", {
      class: state.limit === "secondary" ? "dot-secondary" : "dot-primary",
      cx: x,
      cy: scaleY(point.remainingPercent),
      r: 2.4,
    });
  }

  svg.onmousemove = (event) => {
    const rect = svg.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const timestamp = minX + ((relativeX - padding.left) / plotWidth) * spanX;
    showTooltip(findNearestPoint(points, timestamp), event);
  };
  svg.onmouseleave = hideTooltip;
}

function renderDaily(days) {
  elements.dailyRows.replaceChildren();
  const limit = getLimitMeta();
  const key = state.limit === "secondary" ? "secondaryMax" : "primaryMax";
  const fillClass = state.limit === "secondary" ? "secondary-fill" : "primary-fill";

  if (days.length === 0) {
    const row = document.createElement("div");
    row.className = "daily-row";
    row.textContent = text("emptyDaily");
    elements.dailyRows.append(row);
    return;
  }

  for (const day of days) {
    const row = document.createElement("div");
    row.className = "daily-row";

    const label = document.createElement("span");
    label.textContent = day.day;

    const track = document.createElement("div");
    track.className = "bar-track";
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("span");
    fill.className = fillClass;
    const remaining = remainingFromUsed(day[key]) || 0;
    fill.style.width = `${remaining}%`;
    bar.append(fill);
    track.append(bar);

    const value = document.createElement("span");
    value.textContent = `${Math.round(remaining)}%`;
    value.title = limit.label;
    row.append(label, track, value);
    elements.dailyRows.append(row);
  }
}

elements.limitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.limit = button.dataset.limit;
    setActiveLimit(state.limit);
    render();
  });
});

elements.dayButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.days =
      button.dataset.days === "all" || button.dataset.days === "24h"
        ? button.dataset.days
        : Number(button.dataset.days);
    setActiveDays(state.days);
    loadSummary().catch(console.error);
  });
});

elements.languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.language = button.dataset.lang;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
    setActiveLanguage(state.language);
    render();
  });
});

elements.scanButton.addEventListener("click", () => {
  runScan().catch(console.error);
});

setActiveDays(state.days);
setActiveLimit(state.limit);
setActiveLanguage(state.language);
updateStaticText();
loadConfig().catch(console.error);
loadSummary().catch(console.error);
