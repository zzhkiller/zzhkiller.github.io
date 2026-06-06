const params = new URLSearchParams(window.location.search);
const sourcePath = params.get("src") || "";

const sourceLink = document.querySelector("[data-source-link]");
const titleNode = document.querySelector("[data-material-title]");
const typeNode = document.querySelector("[data-material-type]");
const summaryNode = document.querySelector("[data-material-summary]");
const tagsNode = document.querySelector("[data-material-tags]");
const contentNode = document.querySelector("[data-material-content]");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function safeSourcePath(value) {
  let decoded = String(value || "").trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return "";
  }
  if (!decoded || decoded.includes("..") || /^https?:\/\//i.test(decoded)) return "";
  if (!/^content\/materials\/.+\.(md|markdown|txt)$/i.test(decoded)) return "";
  return decoded;
}

function stripFrontmatter(text) {
  if (!text.startsWith("---\n")) return text;
  const end = text.indexOf("\n---", 4);
  if (end === -1) return text;
  return text.slice(end + 4).trimStart();
}

function safeHref(value) {
  const href = String(value || "").trim();
  if (/^https?:\/\//i.test(href) || /^[./#]?[\w./#?=&%-]+$/i.test(href)) {
    return escapeHtml(href);
  }
  return "#";
}

function renderInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const cleanHref = safeHref(href);
    const target = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noreferrer"' : "";
    return `<a href="${cleanHref}"${target}>${label}</a>`;
  });
  return html;
}

function renderReadableText(rawText) {
  const lines = stripFrontmatter(rawText).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let listItems = [];
  let codeLines = [];
  let inCode = false;

  function flushList() {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
    listItems = [];
  }

  function flushCode() {
    if (!codeLines.length) return;
    blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
  }

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        inCode = false;
        flushCode();
      } else {
        flushList();
        inCode = true;
      }
      return;
    }

    if (inCode) {
      codeLines.push(line);
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = Math.min(heading[1].length + 1, 4);
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      return;
    }

    const list = trimmed.match(/^[-*]\s+(.+)$/);
    if (list) {
      listItems.push(list[1]);
      return;
    }

    flushList();
    const label = trimmed.match(/^([A-Z][A-Za-z /-]{1,36}):\s+(.+)$/);
    if (label) {
      blocks.push(`<p><strong>${escapeHtml(label[1])}:</strong> ${renderInline(label[2])}</p>`);
      return;
    }
    blocks.push(`<p>${renderInline(trimmed)}</p>`);
  });

  flushList();
  flushCode();
  return blocks.join("");
}

async function loadMaterial() {
  const safePath = safeSourcePath(sourcePath);
  if (!safePath) {
    throw new Error("Missing or unsupported material path.");
  }

  const indexResponse = await fetch("data/search-index.json", { cache: "no-store" });
  const index = await indexResponse.json();
  const doc = (index.documents || []).find((item) => item.path === safePath || item.url === safePath) || {};
  const rawResponse = await fetch(safePath, { cache: "no-store" });
  if (!rawResponse.ok) {
    throw new Error("The material file could not be loaded.");
  }
  const rawText = await rawResponse.text();

  const title = doc.title || safePath.split("/").pop().replace(/\.(md|markdown|txt)$/i, "");
  document.title = `${title} | Zhouxing Zhao`;
  titleNode.textContent = title;
  typeNode.textContent = doc.type || "Material";
  summaryNode.textContent = doc.summary || "";
  tagsNode.innerHTML = (doc.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  sourceLink.href = safePath;
  sourceLink.textContent = `Source file${doc.updatedAt ? ` · ${formatDate(doc.updatedAt)}` : ""}`;
  contentNode.innerHTML = renderReadableText(rawText);
}

loadMaterial().catch((error) => {
  titleNode.textContent = "Material unavailable";
  summaryNode.textContent = "";
  tagsNode.innerHTML = "";
  if (sourceLink) sourceLink.hidden = true;
  contentNode.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
