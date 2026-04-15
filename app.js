/* Stow Barn Remodel — schedule data and rendering
   Edit the `schedule` array below to update the timeline. */

const overview = [
  "Structural stabilization and repair",
  "Timber frame repairs",
  "New sill work",
  "New footings and slab work",
  "New floor structure",
  "Roofing and sheathing",
  "Window and door installation",
  "Siding and trim repair",
  "Garage door installation",
  "Electrical work",
  "Painting and finish completion",
];

const schedule = [
  {
    phase: "Pre-Start",
    timeframe: "Once Permit Is in Hand",
    categories: ["Milestone"],
    focus: "Preconstruction alignment and long-lead coordination.",
    tasks: [
      "Permit approval received",
      "Confirm inspection path and required inspection sequence",
      "Order long-lead materials",
      "Confirm subcontractor timing",
      "Set site logistics, dumpster, staging, and access plan",
      "Confirm temporary bracing / shoring approach",
    ],
  },
  {
    phase: "Weeks 1-2",
    timeframe: "Demo, Access, Stabilization",
    categories: ["Structural"],
    focus: "Expose structure and prepare repair areas.",
    tasks: [
      "Demo of existing floor structure",
      "Demo of siding as needed to allow for new sill work",
      "Open driveway side of barn in preparation for new doors",
      "New sill work begins",
      "Start timber frame repairs",
      "Basement clean up",
      "Removal of brick wall",
      "Temporary shoring / bracing as needed",
    ],
  },
  {
    phase: "Week 3",
    timeframe: "Footing Prep and Roof Demo",
    categories: ["Concrete", "Roofing", "Structural"],
    focus: "Prepare new support work and continue opening the structure.",
    tasks: [
      "Prep for new footings",
      "Form new footings",
      "Inspection coordination for footings",
      "Pour footings",
      "Continue timber frame repairs",
      "Strip asphalt roof and remove roof sheathing",
    ],
  },
  {
    phase: "Weeks 4-5",
    timeframe: "Roof Dry-In and Floor Structure Start",
    categories: ["Roofing", "Structural"],
    focus: "Dry in the barn and begin rebuilding the structural floor system.",
    tasks: [
      "Install new roof sheathing",
      "Install new roofing",
      "Start install of new floor structure",
      "Continue structural framing and support work",
      "Coordinate framing progress with required inspections",
    ],
  },
  {
    phase: "Week 6",
    timeframe: "Structural Framing Continuation",
    categories: ["Structural"],
    focus: "Continue framing and structural repair work.",
    tasks: [
      "Continue new floor structure",
      "Continue timber frame repairs",
      "Resolve field-discovered framing conditions",
      "Prep for slab and support areas as framing allows",
    ],
  },
  {
    phase: "Week 7",
    timeframe: "Complete Timber Frame Repairs",
    categories: ["Structural"],
    focus: "Finish major structural repair work.",
    tasks: [
      "Finish timber frame repairs",
      "Complete remaining sill and connection work",
      "Address structural punch list items before slab work",
    ],
  },
  {
    phase: "Week 8",
    timeframe: "Pour Garage and Basement Floor",
    categories: ["Concrete"],
    focus: "Concrete slab work.",
    tasks: [
      "Prep slab areas",
      "Install stone base, reinforcement, and under-slab layers as required",
      "Coordinate any required inspections",
      "Pour garage slab",
      "Pour basement floor",
      "Protect and cure concrete",
    ],
  },
  {
    phase: "Week 9",
    timeframe: "Exterior Openings and Exterior Repair Work",
    categories: ["Exterior"],
    focus: "Close up the building envelope.",
    tasks: [
      "Install windows",
      "Repair necessary trim and siding",
      "Build / repair front and back barn doors for historic appearance",
      "Continue exterior weatherproofing details",
      "Prepare garage door openings for final install",
    ],
  },
  {
    phase: "Week 10",
    timeframe: "Garage Doors and Project Close-In",
    categories: ["Exterior", "Electrical", "Finish"],
    focus: "Major opening closures and finish-out progression.",
    tasks: [
      "Install garage doors",
      "Complete exterior trim and siding repairs",
      "Continue electrical scope for lighting, outlets, and garage door openers",
      "Prepare for remaining finish and paint work",
      "Site cleanup and punch list progression",
    ],
  },
];

const scopeCategories = [
  {
    name: "Structural / Framing",
    items: [
      "Demo of floor structure",
      "Temporary bracing and stabilization",
      "New sill work",
      "Timber frame repairs",
      "New floor framing and support system",
      "Stair framing",
    ],
  },
  {
    name: "Concrete / Foundation",
    items: [
      "Footing prep and pours",
      "Basement slab work",
      "Garage slab work",
      "Excavation and crushed stone prep where required",
    ],
  },
  {
    name: "Roofing",
    items: [
      "Strip existing asphalt roof",
      "Remove and replace roof sheathing",
      "Install new architectural shingle roof",
    ],
  },
  {
    name: "Exterior Envelope",
    items: [
      "New windows",
      "Entry door work",
      "Front and rear barn door build-outs for historic look",
      "Siding repair and replacement",
      "Trim repair",
      "Painting",
    ],
  },
  {
    name: "Electrical",
    items: [
      "General lighting",
      "Exterior lights at doors",
      "Interior and exterior outlets to code",
      "Wiring for garage door openers",
    ],
  },
  {
    name: "Treatment / Preservation",
    items: [
      "Bora-Care treatment after structural repairs",
      "Bora-Care treatment again at project completion",
    ],
  },
];

/* -----------------------------
   Rendering
----------------------------- */

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}

function renderOverview() {
  const grid = document.getElementById("overviewGrid");
  if (!grid) return;
  overview.forEach((label) => {
    grid.appendChild(
      h("div", { class: "overview-card", role: "listitem" }, [
        h("span", { class: "overview-dot" }),
        h("span", {}, label),
      ])
    );
  });
}

function renderFilters() {
  const group = document.getElementById("filterGroup");
  if (!group) return;

  const categories = Array.from(
    new Set(schedule.flatMap((p) => p.categories))
  );

  categories.forEach((cat) => {
    const btn = h(
      "button",
      {
        type: "button",
        class: "chip",
        "data-filter": cat,
        onclick: () => applyFilter(cat),
      },
      cat
    );
    group.appendChild(btn);
  });

  group.querySelector('[data-filter="all"]').addEventListener("click", () => applyFilter("all"));
}

function applyFilter(filter) {
  document.querySelectorAll("#filterGroup .chip").forEach((chip) => {
    chip.classList.toggle("chip-active", chip.dataset.filter === filter);
  });
  document.querySelectorAll(".phase").forEach((el) => {
    const cats = (el.dataset.categories || "").split("|");
    const match = filter === "all" || cats.includes(filter);
    el.classList.toggle("is-hidden", !match);
  });
}

function renderTimeline() {
  const list = document.getElementById("timeline");
  if (!list) return;

  schedule.forEach((phase, idx) => {
    const id = `phase-${idx}`;

    const tags = h(
      "div",
      { class: "phase-tags" },
      phase.categories.map((c) => h("span", { class: `tag tag-${c}` }, c))
    );

    const caret = h(
      "span",
      { class: "phase-caret", "aria-hidden": "true", html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' }
    );

    const head = h(
      "button",
      {
        type: "button",
        class: "phase-head",
        "aria-expanded": "false",
        "aria-controls": `${id}-body`,
      },
      [
        h("span", { class: "phase-index" }, String(idx + 1).padStart(2, "0")),
        h("div", { class: "phase-title-wrap" }, [
          h("div", { class: "phase-timeframe" }, phase.phase),
          h("h3", { class: "phase-title" }, phase.timeframe),
        ]),
        h("div", { class: "phase-meta" }, [tags, caret]),
      ]
    );

    const body = h("div", { class: "phase-body", id: `${id}-body` }, [
      phase.focus ? h("p", { class: "phase-focus" }, phase.focus) : null,
      h(
        "ul",
        { class: "phase-tasks" },
        phase.tasks.map((t) => h("li", {}, t))
      ),
    ]);

    const card = h(
      "li",
      {
        class: "phase",
        id,
        "data-categories": phase.categories.join("|"),
      },
      [head, body]
    );

    head.addEventListener("click", () => {
      const open = card.classList.toggle("phase-open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
    });

    list.appendChild(card);
  });
}

function renderScope() {
  const grid = document.getElementById("scopeGrid");
  if (!grid) return;
  scopeCategories.forEach((s) => {
    grid.appendChild(
      h("article", { class: "scope-card" }, [
        h("h3", {}, s.name),
        h("ul", {}, s.items.map((i) => h("li", {}, i))),
      ])
    );
  });
}

function setAllPhases(open) {
  document.querySelectorAll(".phase").forEach((card) => {
    card.classList.toggle("phase-open", open);
    const head = card.querySelector(".phase-head");
    if (head) head.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

function init() {
  renderOverview();
  renderFilters();
  renderTimeline();
  renderScope();

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  document.getElementById("printBtn")?.addEventListener("click", () => window.print());
  document.getElementById("expandAllBtn")?.addEventListener("click", () => setAllPhases(true));
  document.getElementById("collapseAllBtn")?.addEventListener("click", () => setAllPhases(false));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
