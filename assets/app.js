const state = {
  data: null,
  i18n: {},
  language: "en",
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

function setHtml(selector, value) {
  $$(selector).forEach((node) => {
    node.innerHTML = value || "";
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

function bilingualMarkup(primaryHtml, secondaryText, className = "", secondaryHtml = "") {
  if (!secondaryText) return primaryHtml;
  return `
    <span class="bilingual${className ? ` ${className}` : ""}">
      <span class="bilingual-en">${primaryHtml}</span>
      <span class="bilingual-zh" lang="zh-CN">${secondaryHtml || escapeHtml(secondaryText)}</span>
    </span>
  `;
}

function bilingualText(primary, secondary, className = "") {
  return bilingualMarkup(escapeHtml(primary), secondary, className);
}

function itemKey(item) {
  return item?.title || item?.role || item?.degree || item?.label || "";
}

function itemTranslation(item, field) {
  const key = itemKey(item);
  return item?.[`${field}Zh`] || state.i18n?.items?.[key]?.[field] || "";
}

function materialTranslation(doc) {
  return state.i18n?.materials?.[doc?.path] || {};
}

function getStoredLanguage() {
  try {
    return localStorage.getItem("zzhkiller-language") === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

function getStaticLabel(key, language = state.language) {
  return state.i18n?.ui?.static?.[key]?.[language] || "";
}

function applyStaticLanguage() {
  $$('[data-i18n]').forEach((node) => {
    const label = getStaticLabel(node.dataset.i18n);
    if (label) node.textContent = label;
  });
  $$('[data-i18n-placeholder]').forEach((node) => {
    const label = getStaticLabel(node.dataset.i18nPlaceholder);
    if (label) node.placeholder = label;
  });
  $$('[data-i18n-aria]').forEach((node) => {
    const label = getStaticLabel(node.dataset.i18nAria);
    if (label) node.setAttribute("aria-label", label);
  });

  const toggle = $("[data-language-toggle]");
  if (toggle) {
    toggle.textContent = getStaticLabel(state.language === "en" ? "toggle.toChinese" : "toggle.toEnglish") || (state.language === "en" ? "中文" : "English");
    toggle.setAttribute("aria-label", state.language === "en" ? "Switch to Chinese / 切换到中文" : "Switch to English / 切换到英文");
  }
}

function setLanguage(language, persist = true) {
  state.language = language === "zh" ? "zh" : "en";
  document.documentElement.dataset.language = state.language;
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  if (persist) {
    try {
      localStorage.setItem("zzhkiller-language", state.language);
    } catch {
      // Language preference remains available for the current page.
    }
  }
  applyStaticLanguage();
  if (state.data) {
    renderProfile(state.data);
    buildFilters(state.data);
    renderResults();
  }
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
  const profileZh = state.i18n?.profile || {};

  document.title = site.title || `${name} | Personal Homepage`;
  setText("[data-profile-name]", name);
  setText("[data-page-title]", name);
  setHtml("[data-profile-headline]", bilingualText(headline, profileZh.headline));
  setHtml("[data-profile-summary]", bilingualText(summary, profileZh.summary));
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
  renderTags("[data-skills]", profile.skills || [], "Research interests and skills will be added here.", "研究方向与技能将陆续补充。");
  renderEntries("[data-experience]", profile.experience || []);
  renderEntries("[data-projects]", profile.projects || []);
  renderSimpleList("[data-publications]", profile.publications || [], "Publications will be added later.", "论文将陆续补充。");
  renderSimpleList("[data-patents]", profile.patents || [], "Patent and software copyright summaries will be added later.", "专利与软件著作权摘要将陆续补充。");
  renderSimpleList("[data-services]", profile.services || [], "Professional services will be added later.", "专业服务经历将陆续补充。");
  renderSimpleList("[data-honors]", profile.honors || [], "Honors will be added later.", "荣誉信息将陆续补充。");
}

function renderMeta(profile) {
  const meta = $("[data-profile-meta]");
  if (!meta) return;
  const profileZh = state.i18n?.profile || {};
  const items = [
    [profile.location, profileZh.location],
    [profile.organization, profileZh.organization],
    [profile.role, profileZh.role]
  ].filter(([primary]) => primary);
  meta.innerHTML = items.length
    ? items.map(([primary, secondary]) => bilingualText(primary, secondary, "meta-line")).join("")
    : bilingualText("Public profile in progress", "个人公开资料正在整理中。");
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
  const materialPath = String(url || "").split(/[?#]/)[0];
  return `material.html?src=${encodeURIComponent(materialPath)}`;
}

function renderTimeline(items) {
  const container = $("[data-highlights]");
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<li class="empty-state">${bilingualText("Recent highlights will be added here.", "近期动态将陆续补充。")}</li>`;
    return;
  }

  container.innerHTML = items.map((item) => {
    if (typeof item === "string") {
      return `<li>${escapeHtml(item)}</li>`;
    }
    const date = item.date ? `<strong>${escapeHtml(item.date)}</strong> ` : "";
    const text = escapeHtml(item.text || item.title || "");
    const textZh = state.i18n?.highlights?.[item.text || item.title] || "";
    const url = item.url
      ? ` <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${bilingualText("View", "查看")}</a>`
      : "";
    return `<li>${date}${bilingualMarkup(text, textZh)}${url}</li>`;
  }).join("");
}

function renderSimpleList(selector, items, fallback = "", fallbackZh = "") {
  const container = $(selector);
  if (!container) return;
  container.innerHTML = items.length
    ? items.map((item) => renderListItem(item)).join("")
    : `<li class="empty-state">${bilingualText(fallback, fallbackZh)}</li>`;
}

function renderListItem(item) {
  if (typeof item === "string") {
    return `<li>${escapeHtml(item)}</li>`;
  }
  const title = item.title || item.label || "Untitled";
  const titleZh = itemTranslation(item, "title");
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
  const metaZh = [
    item.authorsZh,
    itemTranslation(item, "venue"),
    itemTranslation(item, "year"),
    item.publicationZh,
    itemTranslation(item, "role"),
    itemTranslation(item, "status")
  ].filter(Boolean).join(" · ");
  const summary = item.summary || item.note || "";
  const summaryZh = item.summaryZh || itemTranslation(item, "summary");
  const titleHtml = url
    ? `<a href="${escapeHtml(href)}"${isExternalUrl(href) ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(title)}</a>`
    : escapeHtml(title);
  const titleZhHtml = titleZh && url
    ? `<a href="${escapeHtml(href)}"${isExternalUrl(href) ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(titleZh)}</a>`
    : "";
  return `
    <li>
      <span class="list-title">${bilingualMarkup(titleHtml, titleZh, "", titleZhHtml)}</span>
      ${meta ? `<span class="list-meta">${bilingualMarkup(escapeHtml(meta), metaZh)}</span>` : ""}
      ${summary ? `<span class="list-summary">${bilingualMarkup(escapeHtml(summary), summaryZh)}</span>` : ""}
    </li>
  `;
}

function renderTags(selector, items, fallback = "", fallbackZh = "") {
  const container = $(selector);
  if (!container) return;
  container.innerHTML = items.length
    ? items.map((item) => `<span class="tag">${bilingualMarkup(escapeHtml(item), state.i18n?.profile?.skills?.[item] || "")}</span>`).join("")
    : `<span class="empty-state">${bilingualText(fallback, fallbackZh)}</span>`;
}

function renderEntries(selector, items, compact = false) {
  const container = $(selector);
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">${bilingualText("This section will be updated later.", "本栏目将持续更新。")}</div>`;
    return;
  }

  container.innerHTML = items.map((item) => {
    const period = item.period ? `<div class="entry-period">${escapeHtml(item.period)}</div>` : "";
    const title = item.title || item.role || item.degree || "Untitled";
    const titleZh = itemTranslation(item, "title") || itemTranslation(item, "role") || itemTranslation(item, "degree");
    const href = displayUrl(item.url || "");
    const titleHtml = item.url
      ? `<a href="${escapeHtml(href)}"${isExternalUrl(href) ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(title)}</a>`
      : escapeHtml(title);
    const titleZhHtml = titleZh && item.url
      ? `<a href="${escapeHtml(href)}"${isExternalUrl(href) ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(titleZh)}</a>`
      : "";
    const org = item.organization || item.school || "";
    const orgHtml = renderOrganization(item, org);
    const roleZh = itemTranslation(item, "role");
    const role = item.role && item.title
      ? `<p class="entry-role">${bilingualMarkup(escapeHtml(item.role), roleZh)}</p>`
      : "";
    const summary = item.summary || item.details || "";
    const summaryZh = item.summaryZh || itemTranslation(item, "summary") || itemTranslation(item, "details");
    const outcomeZh = item.outcomeZh || itemTranslation(item, "outcome");
    const outcome = item.outcome
      ? `<p class="entry-outcome">${bilingualMarkup(escapeHtml(item.outcome), outcomeZh)}</p>`
      : "";
    const bulletsZh = item.bulletsZh || itemTranslation(item, "bullets") || [];
    const bullets = Array.isArray(item.bullets) && item.bullets.length
      ? `<ul>${item.bullets.map((bullet, index) => `<li>${bilingualMarkup(escapeHtml(bullet), bulletsZh[index] || "")}</li>`).join("")}</ul>`
      : "";
    return `
      <article class="entry-item${compact ? " compact" : ""}">
        ${period}
        <div class="entry-body">
          <h3>${bilingualMarkup(titleHtml, titleZh, "", titleZhHtml)}</h3>
          ${orgHtml}
          ${role}
          ${summary ? `<p>${bilingualMarkup(escapeHtml(summary), summaryZh)}</p>` : ""}
          ${outcome}
          ${bullets}
        </div>
      </article>
    `;
  }).join("");
}

function renderOrganization(item, fallback) {
  const translated = itemTranslation(item, "organization") || itemTranslation(item, "school");
  if (Array.isArray(item.organizationLinks) && item.organizationLinks.length) {
    const links = item.organizationLinks.map((link) => (
      `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`
    )).join('<span class="org-divider">/</span>');
    return `
      <p class="entry-org">
        ${bilingualMarkup(links, translated)}
      </p>
    `;
  }
  if (item.organizationUrl && fallback) {
    const link = `<a href="${escapeHtml(item.organizationUrl)}" target="_blank" rel="noreferrer">${escapeHtml(fallback)}</a>`;
    return `<p class="entry-org">${bilingualMarkup(link, translated)}</p>`;
  }
  return fallback ? `<p class="entry-org">${bilingualMarkup(escapeHtml(fallback), translated)}</p>` : "";
}

function buildFilters(data) {
  const filters = $("[data-filters]");
  if (!filters) return;
  const tags = data?.stats?.tags || [];
  const types = Object.keys(data?.stats?.types || {});
  const chips = [
    { id: "all", labelHtml: bilingualMarkup("All", "全部") },
    ...types.map((type) => ({
      id: `type:${type}`,
      labelHtml: bilingualMarkup(escapeHtml(type), state.i18n?.ui?.types?.[type] || type)
    })),
    ...tags.map((tag) => ({ id: `tag:${tag}`, labelHtml: escapeHtml(`#${tag}`) }))
  ];

  filters.hidden = chips.length <= 1;
  filters.innerHTML = chips.map((chip) => `
    <button class="filter-chip${chip.id === state.activeFilter ? " is-active" : ""}" type="button" data-filter="${escapeHtml(chip.id)}">
      ${chip.labelHtml}
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

  setHtml(
    "[data-results-title]",
    query
      ? bilingualText("Search Results", state.i18n?.ui?.searchResultsZh || "搜索结果")
      : bilingualText("All Materials", state.i18n?.ui?.allMaterialsZh || "全部资料")
  );
  const countLabel = state.language === "zh"
    ? `${results.length}项`
    : `${results.length} item${results.length === 1 ? "" : "s"}`;
  setText("[data-results-count]", countLabel);

  if (!results.length) {
    list.innerHTML = docs.length
      ? `<div class="empty-state">${bilingualText("No matching materials. Try another keyword or clear the filters.", state.i18n?.ui?.messages?.noMatches)}</div>`
      : `<div class="empty-state">${bilingualText("No public materials yet. Add Markdown, text, JSON, CSV, or HTML files to content/materials and rebuild the index.", state.i18n?.ui?.messages?.materialsFallback)}</div>`;
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
    const translation = materialTranslation(doc);

    link.href = displayUrl(doc.url || doc.path || "#");
    link.innerHTML = bilingualMarkup(escapeHtml(doc.title || "Untitled Material"), translation.title || "");
    type.innerHTML = bilingualMarkup(escapeHtml(doc.type || "Material"), translation.type || state.i18n?.ui?.types?.[doc.type] || "");
    date.textContent = formatDate(doc.updatedAt || doc.date);
    summary.innerHTML = bilingualMarkup(highlight(doc.summary || "", query), translation.summary || "");
    tags.innerHTML = (doc.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    list.append(card);
  });
}

async function boot() {
  const toggle = $("[data-language-toggle]");
  if (toggle) {
    toggle.addEventListener("click", () => setLanguage(state.language === "en" ? "zh" : "en"));
  }
  try {
    const [response, i18nResponse] = await Promise.all([
      fetch("data/search-index.json", { cache: "no-store" }),
      fetch("content/i18n.json", { cache: "no-store" })
    ]);
    state.data = await response.json();
    state.i18n = i18nResponse.ok ? await i18nResponse.json() : {};
    setLanguage(getStoredLanguage(), false);
  } catch (error) {
    const list = $("[data-results]");
    if (list) {
      list.innerHTML = `<div class="empty-state">${bilingualText("The material index could not be loaded. Rebuild data/search-index.json first.", "资料索引无法加载，请先重新生成 data/search-index.json。")}</div>`;
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
