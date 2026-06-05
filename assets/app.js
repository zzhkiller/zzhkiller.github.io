const state = {
  data: null,
  query: "",
  activeFilter: "all"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function setText(selector, value) {
  $$(selector).forEach((node) => {
    node.textContent = value || "";
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
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

function highlight(text, query) {
  const safe = escapeHtml(text);
  const needle = query.trim();
  if (!needle) return safe;
  const escapedNeedle = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${escapedNeedle})`, "ig"), "<mark>$1</mark>");
}

function renderProfile(data) {
  const profile = data.profile || {};
  const site = data.site || {};
  const name = profile.name || site.title || "Personal Homepage";
  const headline = profile.headline || "Personal Homepage";
  const summary = profile.summary || site.description || "";

  document.title = site.title || `${name} | Personal Homepage`;
  setText("[data-profile-name]", name);
  setText("[data-page-title]", name);
  setText("[data-profile-headline]", headline);
  setText("[data-profile-summary]", summary);
  setText("[data-stat-docs]", data.stats?.count ?? 0);
  setText("[data-stat-tags]", data.stats?.tags?.length ?? 0);
  setText("[data-stat-updated]", data.generatedAt ? formatDate(data.generatedAt) : "-");

  const avatar = $("[data-avatar]");
  if (avatar && profile.avatar) {
    avatar.src = profile.avatar;
  }

  renderMeta(profile);
  renderLinks("[data-contact-links]", profile.contacts || []);
  renderLinks("[data-quick-links]", profile.quickLinks || [], true, "More links will be added later.");
  renderTimeline(profile.highlights || profile.news || []);
  renderTags("[data-skills]", profile.skills || [], "Research interests and skills will be added here.");
  renderEntries("[data-experience]", profile.experience || []);
  renderEntries("[data-projects]", profile.projects || []);
  renderSimpleList("[data-publications]", profile.publications || [], "Publications will be added later.");
  renderSimpleList("[data-patents]", profile.patents || [], "Patent and software copyright summaries will be added later.");
  renderSimpleList("[data-services]", profile.services || [], "Professional services will be added later.");
  renderSimpleList("[data-honors]", profile.honors || [], "Honors will be added later.");
}

function renderMeta(profile) {
  const meta = $("[data-profile-meta]");
  if (!meta) return;
  const items = [
    profile.location,
    profile.organization,
    profile.role
  ].filter(Boolean);
  meta.innerHTML = items.length
    ? items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")
    : '<span>Public profile in progress</span>';
}

function renderLinks(selector, links, asList = false, fallback = "") {
  const container = $(selector);
  if (!container) return;
  if (!links.length) {
    container.innerHTML = fallback
      ? `<${asList ? "li" : "span"} class="empty-state">${escapeHtml(fallback)}</${asList ? "li" : "span"}>`
      : "";
    return;
  }

  const html = links.map((link) => {
    const label = escapeHtml(link.label || link.url || "Link");
    const url = escapeHtml(link.url || "#");
    const external = /^https?:\/\//i.test(link.url || "");
    const anchor = external
      ? `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`
      : `<a href="${url}">${label}</a>`;
    return asList ? `<li>${anchor}</li>` : anchor;
  }).join("");
  container.innerHTML = html;
}

function isExternalUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

function isReadableMaterial(url) {
  return /^content\/materials\/.+\.(md|markdown|txt)$/i.test(String(url || "").split(/[?#]/)[0]);
}

function displayUrl(url) {
  if (!isReadableMaterial(url)) return url;
  return `material.html?src=${encodeURIComponent(url)}`;
}

function renderTimeline(items) {
  const container = $("[data-highlights]");
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<li class="empty-state">Recent highlights will be added here.</li>';
    return;
  }

  container.innerHTML = items.map((item) => {
    if (typeof item === "string") {
      return `<li>${escapeHtml(item)}</li>`;
    }
    const date = item.date ? `<strong>${escapeHtml(item.date)}</strong> ` : "";
    const text = escapeHtml(item.text || item.title || "");
    const url = item.url ? ` <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">View</a>` : "";
    return `<li>${date}${text}${url}</li>`;
  }).join("");
}

function renderSimpleList(selector, items, fallback = "") {
  const container = $(selector);
  if (!container) return;
  container.innerHTML = items.length
    ? items.map((item) => renderListItem(item)).join("")
    : `<li class="empty-state">${escapeHtml(fallback)}</li>`;
}

function renderListItem(item) {
  if (typeof item === "string") {
    return `<li>${escapeHtml(item)}</li>`;
  }
  const title = item.title || item.label || "Untitled";
  const url = item.url || "";
  const href = displayUrl(url);
  const meta = [
    item.authors,
    item.venue,
    item.year,
    item.publication,
    item.role,
    item.status
  ].filter(Boolean).join(" · ");
  const summary = item.summary || item.note || "";
  const titleHtml = url
    ? `<a href="${escapeHtml(href)}"${isExternalUrl(href) ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(title)}</a>`
    : escapeHtml(title);
  return `
    <li>
      <span class="list-title">${titleHtml}</span>
      ${meta ? `<span class="list-meta">${escapeHtml(meta)}</span>` : ""}
      ${summary ? `<span class="list-summary">${escapeHtml(summary)}</span>` : ""}
    </li>
  `;
}

function renderTags(selector, items, fallback = "") {
  const container = $(selector);
  if (!container) return;
  container.innerHTML = items.length
    ? items.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")
    : `<span class="empty-state">${escapeHtml(fallback)}</span>`;
}

function renderEntries(selector, items, compact = false) {
  const container = $(selector);
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<div class="empty-state">This section will be updated later.</div>';
    return;
  }

  container.innerHTML = items.map((item) => {
    const period = item.period ? `<div class="entry-period">${escapeHtml(item.period)}</div>` : "";
    const title = item.title || item.role || item.degree || "Untitled";
    const href = displayUrl(item.url || "");
    const titleHtml = item.url
      ? `<a href="${escapeHtml(href)}"${isExternalUrl(href) ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(title)}</a>`
      : escapeHtml(title);
    const org = item.organization || item.school || "";
    const orgHtml = renderOrganization(item, org);
    const role = item.role && item.title ? `<p class="entry-role">${escapeHtml(item.role)}</p>` : "";
    const summary = item.summary || item.details || "";
    const outcome = item.outcome ? `<p class="entry-outcome">${escapeHtml(item.outcome)}</p>` : "";
    const bullets = Array.isArray(item.bullets) && item.bullets.length
      ? `<ul>${item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
      : "";
    return `
      <article class="entry-item${compact ? " compact" : ""}">
        ${period}
        <div class="entry-body">
          <h3>${titleHtml}</h3>
          ${orgHtml}
          ${role}
          ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
          ${outcome}
          ${bullets}
        </div>
      </article>
    `;
  }).join("");
}

function renderOrganization(item, fallback) {
  if (Array.isArray(item.organizationLinks) && item.organizationLinks.length) {
    return `
      <p class="entry-org">
        ${item.organizationLinks.map((link) => (
          `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`
        )).join('<span class="org-divider">/</span>')}
      </p>
    `;
  }
  if (item.organizationUrl && fallback) {
    return `<p class="entry-org"><a href="${escapeHtml(item.organizationUrl)}" target="_blank" rel="noreferrer">${escapeHtml(fallback)}</a></p>`;
  }
  return fallback ? `<p class="entry-org">${escapeHtml(fallback)}</p>` : "";
}

function buildFilters(data) {
  const filters = $("[data-filters]");
  if (!filters) return;
  const tags = data?.stats?.tags || [];
  const types = Object.keys(data?.stats?.types || {});
  const chips = [
    { id: "all", label: "All" },
    ...types.map((type) => ({ id: `type:${type}`, label: type })),
    ...tags.map((tag) => ({ id: `tag:${tag}`, label: `#${tag}` }))
  ];

  filters.hidden = chips.length <= 1;
  filters.innerHTML = chips.map((chip) => `
    <button class="filter-chip${chip.id === state.activeFilter ? " is-active" : ""}" type="button" data-filter="${escapeHtml(chip.id)}">
      ${escapeHtml(chip.label)}
    </button>
  `).join("");

  $$("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter || "all";
      buildFilters(state.data);
      renderResults();
    });
  });
}

function scoreDocument(doc, query) {
  if (!query) return 1;
  const q = normalize(query);
  const title = normalize(doc.title);
  const summary = normalize(doc.summary);
  const tags = normalize((doc.tags || []).join(" "));
  const text = normalize(doc.text);
  let score = 0;
  if (title.includes(q)) score += 10;
  if (tags.includes(q)) score += 6;
  if (summary.includes(q)) score += 4;
  if (text.includes(q)) score += 1;
  return score;
}

function matchesFilter(doc) {
  const filter = state.activeFilter;
  if (filter === "all") return true;
  if (filter.startsWith("type:")) return doc.type === filter.slice(5);
  if (filter.startsWith("tag:")) return (doc.tags || []).includes(filter.slice(4));
  return true;
}

function renderResults() {
  const list = $("[data-results]");
  const template = $("#result-card-template");
  if (!list || !template) return;
  const docs = state.data?.documents || [];
  const query = state.query;

  const results = docs
    .map((doc) => ({ doc, score: scoreDocument(doc, query) }))
    .filter((item) => item.score > 0 && matchesFilter(item.doc))
    .sort((a, b) => b.score - a.score || String(b.doc.updatedAt || "").localeCompare(String(a.doc.updatedAt || "")))
    .map((item) => item.doc);

  setText("[data-results-title]", query ? "Search Results" : "All Materials");
  setText("[data-results-count]", `${results.length} item${results.length === 1 ? "" : "s"}`);

  if (!results.length) {
    list.innerHTML = docs.length
      ? '<div class="empty-state">No matching materials. Try another keyword or clear the filters.</div>'
      : '<div class="empty-state">No public materials yet. Add Markdown, text, JSON, CSV, or HTML files to content/materials and rebuild the index.</div>';
    return;
  }

  list.innerHTML = "";
  results.forEach((doc) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const link = card.querySelector("[data-doc-link]");
    const type = card.querySelector("[data-doc-type]");
    const date = card.querySelector("[data-doc-date]");
    const summary = card.querySelector("[data-doc-summary]");
    const tags = card.querySelector("[data-doc-tags]");

    link.href = displayUrl(doc.url || doc.path || "#");
    link.textContent = doc.title || "Untitled Material";
    type.textContent = doc.type || "Material";
    date.textContent = formatDate(doc.updatedAt || doc.date);
    summary.innerHTML = highlight(doc.summary || "", query);
    tags.innerHTML = (doc.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    list.append(card);
  });
}

async function boot() {
  try {
    const response = await fetch("data/search-index.json", { cache: "no-store" });
    state.data = await response.json();
    renderProfile(state.data);
    buildFilters(state.data);
    renderResults();
  } catch (error) {
    const list = $("[data-results]");
    if (list) {
      list.innerHTML = '<div class="empty-state">The material index could not be loaded. Rebuild data/search-index.json first.</div>';
    }
  }

  const input = $("[data-search-input]");
  const reset = $("[data-reset-search]");
  if (input) {
    input.addEventListener("input", (event) => {
      state.query = event.target.value;
      renderResults();
    });
  }

  if (reset && input) {
    reset.addEventListener("click", () => {
      state.query = "";
      state.activeFilter = "all";
      input.value = "";
      buildFilters(state.data);
      renderResults();
      input.focus();
    });
  }
}

boot();
