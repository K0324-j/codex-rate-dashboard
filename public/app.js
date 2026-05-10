const state = {
  days: 7,
  limit: "primary",
  data: null,
};

const elements = {
  primaryValue: document.querySelector("#primaryValue"),
  secondaryValue: document.querySelector("#secondaryValue"),
  primaryReset: document.querySelector("#primaryReset"),
  secondaryReset: document.querySelector("#secondaryReset"),
  scanTime: document.querySelector("#scanTime"),
  scanCount: document.querySelector("#scanCount"),
  scanButton: document.querySelector("#scanButton"),
  chart: document.querySelector("#chart"),
  emptyState: document.querySelector("#emptyState"),
  chartTitle: document.querySelector("#chartTitle"),
  chartScope: document.querySelector("#chartScope"),
  activeLegend: document.querySelector("#activeLegend"),
  dailyTitle: document.querySelector("#dailyTitle"),
  dailyRows: document.querySelector("#dailyRows"),
  generatedAt: document.querySelector("#generatedAt"),
};

function formatPercent(value) {
  if (typeof value !== "number") return "--%";
  return `${Math.round(value)}%`;
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function setActiveDays(days) {
  document.querySelectorAll("[data-days]").forEach((button) => {
    button.classList.toggle("active", button.dataset.days === String(days));
  });
}

function setActiveLimit(limit) {
  document.querySelectorAll("[data-limit]").forEach((button) => {
    button.classList.toggle("active", button.dataset.limit === limit);
  });
}

function getLimitMeta() {
  if (state.limit === "secondary") {
    return {
      label: "1週間枠",
      usedKey: "secondaryUsedPercent",
      colorClass: "line-secondary",
    };
  }

  return {
    label: "5時間枠",
    usedKey: "primaryUsedPercent",
    colorClass: "line-primary",
  };
}

function remainingFromUsed(value) {
  return typeof value === "number" ? Math.max(0, Math.min(100, 100 - value)) : null;
}

async function loadSummary() {
  const response = await fetch(`/api/summary?days=${state.days}`);
  if (!response.ok) throw new Error("summary request failed");
  state.data = await response.json();
  render();
}

async function runScan() {
  elements.scanButton.disabled = true;
  elements.scanButton.textContent = "スキャン中";
  try {
    const response = await fetch("/api/scan", { method: "POST" });
    if (!response.ok) throw new Error("scan request failed");
    await loadSummary();
  } finally {
    elements.scanButton.disabled = false;
    elements.scanButton.textContent = "再スキャン";
  }
}

function render() {
  const data = state.data;
  const latest = data?.latest;
  const limit = getLimitMeta();

  elements.primaryValue.textContent = formatPercent(remainingFromUsed(latest?.primaryUsedPercent));
  elements.secondaryValue.textContent = formatPercent(remainingFromUsed(latest?.secondaryUsedPercent));
  elements.primaryReset.textContent = `reset ${formatDateTime(latest?.primaryResetsAt)}`;
  elements.secondaryReset.textContent = `reset ${formatDateTime(latest?.secondaryResetsAt)}`;
  elements.scanTime.textContent = formatDateTime(data?.lastScan?.scannedAt);
  elements.scanCount.textContent = `${data?.totals?.snapshotCount ?? 0} snapshots`;
  elements.chartTitle.textContent = `${limit.label}の残量推移`;
  elements.chartScope.textContent =
    state.days === "all"
      ? `全期間の ${limit.label} remaining`
      : state.days === "24h"
        ? `直近24時間の ${limit.label} remaining`
      : `直近${state.days}日の ${limit.label} remaining`;
  elements.activeLegend.innerHTML = `<i class="${limit.colorClass}"></i>${limit.label}`;
  elements.dailyTitle.textContent = `${limit.label}の日別最低残量`;
  elements.generatedAt.textContent = `generated ${formatDateTime(data?.generatedAt)}`;

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

function renderChart(rawPoints) {
  const limit = getLimitMeta();
  const points = rawPoints
    .map((point) => ({
      eventTimestamp: point.eventTimestamp,
      remainingPercent: remainingFromUsed(point[limit.usedKey]),
    }))
    .filter((point) => typeof point.remainingPercent === "number");
  const svg = elements.chart;
  svg.replaceChildren();
  elements.emptyState.hidden = points.length > 0;
  if (points.length === 0) return;

  const width = 1060;
  const height = 390;
  const padding = { top: 18, right: 28, bottom: 42, left: 46 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const timestamps = points.map((point) => new Date(point.eventTimestamp).getTime());
  const minX = Math.min(...timestamps);
  const maxX = Math.max(...timestamps);
  const spanX = Math.max(maxX - minX, 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const scaleX = (value) => padding.left + ((value - minX) / spanX) * plotWidth;
  const scaleY = (value) => padding.top + (1 - Math.max(0, Math.min(100, value)) / 100) * plotHeight;

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

  const pathData = pointsToPath(points, scaleX, scaleY);

  make("path", { class: state.limit === "secondary" ? "path-secondary" : "path-primary", d: pathData });

  const sampled = points.filter((_, index) => index % Math.max(1, Math.floor(points.length / 80)) === 0);
  for (const point of sampled) {
    const x = scaleX(new Date(point.eventTimestamp).getTime());
    make("circle", {
      class: state.limit === "secondary" ? "dot-secondary" : "dot-primary",
      cx: x,
      cy: scaleY(point.remainingPercent),
      r: 2.4,
    });
  }

  const first = new Date(minX);
  const last = new Date(maxX);
  make("text", { class: "axis-label", x: padding.left, y: height - 12 }).textContent = formatDateTime(first);
  make("text", {
    class: "axis-label",
    x: width - padding.right - 86,
    y: height - 12,
  }).textContent = formatDateTime(last);
}

function renderDaily(days) {
  elements.dailyRows.replaceChildren();
  const limit = getLimitMeta();
  const key = state.limit === "secondary" ? "secondaryMax" : "primaryMax";
  const fillClass = state.limit === "secondary" ? "secondary-fill" : "primary-fill";

  if (days.length === 0) {
    const row = document.createElement("div");
    row.className = "daily-row";
    row.textContent = "日別データはまだありません。";
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

document.querySelectorAll("[data-limit]").forEach((button) => {
  button.addEventListener("click", () => {
    state.limit = button.dataset.limit;
    setActiveLimit(state.limit);
    render();
  });
});

document.querySelectorAll(".segment").forEach((button) => {
  if (!button.dataset.days) return;
  button.addEventListener("click", () => {
    state.days =
      button.dataset.days === "all" || button.dataset.days === "24h"
        ? button.dataset.days
        : Number(button.dataset.days);
    setActiveDays(state.days);
    loadSummary().catch(console.error);
  });
});

elements.scanButton.addEventListener("click", () => {
  runScan().catch(console.error);
});

setActiveDays(state.days);
setActiveLimit(state.limit);
loadSummary().catch(console.error);
