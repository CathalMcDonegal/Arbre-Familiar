/**
 * Arbre genealògic piramidal (dalt = grans, baix = joves)
 * Parelles al costat · Fills pengen a sota
 * Les dades NO s'esborren en actualitzar (migra claus antigues)
 */
const STORAGE_KEY = "arbre-genealogic-data";
const OLD_KEYS = [
  "arbre-genealogic-v5",
  "arbre-genealogic-v4",
  "arbre-genealogic-v3",
  "arbre-genealogic-v2",
  "arbre-genealogic-v1",
  "arbol-genealogico-v1",
];

let people = [];
let focusId = null;
let scale = 1;
let menuPersonId = null;

const $ = (id) => document.getElementById(id);
const form = $("person-form");
const personIdInput = $("person-id");
const nameInput = $("name");
const birthInput = $("birth");
const deathInput = $("death");
const genderInput = $("gender");
const notesInput = $("notes");
const saveBtn = $("save-btn");
const cancelBtn = $("cancel-btn");
const peopleList = $("people-list");
const peopleCount = $("people-count");
const searchInput = $("search");
const rootSelect = $("root-select");
const treeCanvas = $("tree-canvas");

const personMenu = document.createElement("div");
personMenu.className = "person-menu";
personMenu.innerHTML = `
  <button data-a="father">➕ Pare</button>
  <button data-a="mother">➕ Mare</button>
  <button data-a="sibling">➕ Germà / germana</button>
  <button data-a="child">➕ Fill / filla</button>
  <button data-a="spouse">💍 Parella</button>
  <div class="sep"></div>
  <button data-a="edit">✏️ Editar</button>
  <button data-a="focus">📍 Punt de partida</button>
  <div class="sep"></div>
  <button data-a="del" style="color:#8b3a2a">🗑️ Eliminar</button>
`;
document.body.appendChild(personMenu);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ people, focusId }));
}

function normalizePerson(p) {
  return {
    id: p.id,
    name: p.name || "Sense nom",
    birth: p.birth ?? null,
    death: p.death ?? null,
    gender: p.gender || "unknown",
    notes: p.notes || "",
    fatherId: p.fatherId || null,
    motherId: p.motherId || null,
    spouseId: p.spouseId || null,
  };
}

function load() {
  // 1) Clau actual
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        people = data.map(normalizePerson);
        focusId = people[0]?.id || null;
        return;
      }
      if (data && Array.isArray(data.people)) {
        people = data.people.map(normalizePerson);
        focusId = data.focusId || data.meId || people[0]?.id || null;
        return;
      }
    }
  } catch (_) {}

  // 2) Migrar claus antigues (NO perdre dades en actualitzar)
  for (const key of OLD_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      let list = null;
      let fid = null;
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.people)) {
        list = data.people;
        fid = data.focusId || data.meId || null;
      }
      if (list && list.length) {
        people = list.map(normalizePerson);
        focusId = fid || people[0]?.id || null;
        save(); // desar a la clau nova
        return;
      }
    } catch (_) {}
  }

  people = [];
  focusId = null;
}

function get(id) {
  return people.find((p) => p.id === id);
}
function years(p) {
  if (p.birth && p.death) return `${p.birth} – ${p.death}`;
  if (p.birth) return `n. ${p.birth}`;
  if (p.death) return `† ${p.death}`;
  return "";
}
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function isDead(p) {
  return p.death != null && p.death !== "";
}
function childrenOf(...ids) {
  const set = new Set(ids.filter(Boolean));
  return people.filter((p) => set.has(p.fatherId) || set.has(p.motherId));
}

function promptPerson(label, defaultGender) {
  const name = prompt(`Nom (${label}):`);
  if (!name || !name.trim()) return null;
  const gIn = (prompt("Gènere: d=dona, h=home (buit=no dit)", "") || "").toLowerCase();
  let gender = defaultGender || "unknown";
  if (gIn.startsWith("d")) gender = "female";
  else if (gIn.startsWith("h")) gender = "male";
  else if (gIn.startsWith("a")) gender = "other";
  else if (!defaultGender) gender = "unknown";
  const p = {
    id: uid(),
    name: name.trim(),
    birth: null,
    death: null,
    gender,
    notes: "",
    fatherId: null,
    motherId: null,
    spouseId: null,
  };
  people.push(p);
  return p;
}

function linkSpouse(a, b) {
  a.spouseId = b.id;
  b.spouseId = a.id;
}

function addFather(id) {
  const p = get(id);
  if (!p) return;
  if (p.fatherId) return alert("Ja té pare.");
  const n = promptPerson("pare", "male");
  if (!n) return;
  p.fatherId = n.id;
  if (p.motherId) {
    const m = get(p.motherId);
    if (m && !m.spouseId) linkSpouse(n, m);
  }
  save();
  render();
}
function addMother(id) {
  const p = get(id);
  if (!p) return;
  if (p.motherId) return alert("Ja té mare.");
  const n = promptPerson("mare", "female");
  if (!n) return;
  p.motherId = n.id;
  if (p.fatherId) {
    const f = get(p.fatherId);
    if (f && !f.spouseId) linkSpouse(n, f);
  }
  save();
  render();
}
function addSibling(id) {
  const p = get(id);
  if (!p) return;
  if (!p.fatherId && !p.motherId) return alert("Primer afegeix el pare o la mare.");
  const n = promptPerson("germà/germana");
  if (!n) return;
  n.fatherId = p.fatherId;
  n.motherId = p.motherId;
  save();
  render();
}
function addChild(id) {
  const p = get(id);
  if (!p) return;
  const n = promptPerson("fill/a");
  if (!n) return;
  if (p.gender === "female") {
    n.motherId = p.id;
    if (p.spouseId) n.fatherId = p.spouseId;
  } else {
    n.fatherId = p.id;
    if (p.spouseId) n.motherId = p.spouseId;
  }
  save();
  render();
}
function addSpouse(id) {
  const p = get(id);
  if (!p) return;
  if (p.spouseId) return alert("Ja té parella.");
  const def = p.gender === "male" ? "female" : p.gender === "female" ? "male" : null;
  const n = promptPerson("parella", def);
  if (!n) return;
  linkSpouse(p, n);
  save();
  render();
}

function showMenu(id, x, y) {
  menuPersonId = id;
  personMenu.classList.add("open");
  const w = 200, h = 310;
  let left = x, top = y;
  if (left + w > innerWidth) left = innerWidth - w - 8;
  if (top + h > innerHeight) top = innerHeight - h - 8;
  personMenu.style.left = Math.max(4, left) + "px";
  personMenu.style.top = Math.max(4, top) + "px";
}
function hideMenu() {
  personMenu.classList.remove("open");
  menuPersonId = null;
}

personMenu.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || !menuPersonId) return;
  const a = b.dataset.a;
  const id = menuPersonId;
  hideMenu();
  if (a === "father") addFather(id);
  else if (a === "mother") addMother(id);
  else if (a === "sibling") addSibling(id);
  else if (a === "child") addChild(id);
  else if (a === "spouse") addSpouse(id);
  else if (a === "edit") startEdit(id);
  else if (a === "focus") {
    focusId = id;
    save();
    render();
  } else if (a === "del") {
    const p = get(id);
    if (!p || !confirm(`Eliminar ${p.name}?`)) return;
    people.forEach((o) => {
      if (o.fatherId === id) o.fatherId = null;
      if (o.motherId === id) o.motherId = null;
      if (o.spouseId === id) o.spouseId = null;
    });
    people = people.filter((x) => x.id !== id);
    if (focusId === id) focusId = people[0]?.id || null;
    save();
    render();
  }
});
document.addEventListener("click", (e) => {
  if (!personMenu.contains(e.target) && !e.target.closest(".person")) hideMenu();
});

/* ——— Pyramid layout ——— */

function makeCard(p) {
  const el = document.createElement("div");
  let cls = `person ${p.gender || "unknown"}`;
  if (isDead(p)) cls += " dead";
  if (p.id === focusId) cls += " focus";
  el.className = cls;
  el.dataset.id = p.id;
  el.innerHTML = `
    <div class="pname">${esc(p.name)}</div>
    <div class="pyears">${years(p)}</div>
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    showMenu(p.id, e.clientX, e.clientY);
  });
  return el;
}

/** Puja fins als ancestres sense pares (cims de la piràmide) */
function findRoots(startId) {
  const start = get(startId);
  if (!start) return [];

  // Collect connected component via family links
  const connected = new Set();
  const queue = [startId];
  while (queue.length) {
    const id = queue.pop();
    if (connected.has(id)) continue;
    connected.add(id);
    const p = get(id);
    if (!p) continue;
    [p.fatherId, p.motherId, p.spouseId].forEach((x) => {
      if (x && !connected.has(x)) queue.push(x);
    });
    childrenOf(id).forEach((c) => {
      if (!connected.has(c.id)) queue.push(c.id);
    });
  }

  // Roots = people in component with no parent in component
  const roots = [];
  connected.forEach((id) => {
    const p = get(id);
    if (!p) return;
    const hasFather = p.fatherId && connected.has(p.fatherId);
    const hasMother = p.motherId && connected.has(p.motherId);
    if (!hasFather && !hasMother) roots.push(p);
  });

  // Prefer not listing both spouses as separate roots if one is spouse of another root
  const rootIds = new Set(roots.map((r) => r.id));
  const filtered = roots.filter((r) => {
    if (r.spouseId && rootIds.has(r.spouseId)) {
      // keep the one that appears first by name, or the focus lineage
      return r.id < r.spouseId;
    }
    return true;
  });

  return filtered.length ? filtered : [start];
}

/**
 * Render recursive node:
 * [Person] —dot— [Spouse]
 *        |
 *   [child1] [child2] ...
 * each child can have spouse and own children
 */
function renderBranch(person, used) {
  if (!person || used.has(person.id)) return null;
  used.add(person.id);

  const node = document.createElement("div");
  node.className = "tree-node";

  // Couple row
  const couple = document.createElement("div");
  couple.className = "couple";
  couple.appendChild(makeCard(person));

  let spouse = null;
  if (person.spouseId) {
    spouse = get(person.spouseId);
    if (spouse && !used.has(spouse.id)) {
      used.add(spouse.id);
      const dot = document.createElement("div");
      dot.className = "pair-dot";
      dot.title = "Parella";
      couple.appendChild(dot);
      couple.appendChild(makeCard(spouse));
    } else {
      spouse = null;
    }
  }
  node.appendChild(couple);

  // Children of this person and/or spouse
  const kids = childrenOf(person.id, spouse?.id).filter((c) => !used.has(c.id));
  // stable order: by birth year then name
  kids.sort((a, b) => {
    if (a.birth && b.birth) return a.birth - b.birth;
    if (a.birth) return -1;
    if (b.birth) return 1;
    return a.name.localeCompare(b.name, "ca");
  });

  if (kids.length) {
    const stem = document.createElement("div");
    stem.className = "stem";
    node.appendChild(stem);

    const wrap = document.createElement("div");
    wrap.className = "children-wrap";

    const row = document.createElement("div");
    row.className = "children-row";

    kids.forEach((kid) => {
      const slot = document.createElement("div");
      slot.className = "child-slot";
      const cStem = document.createElement("div");
      cStem.className = "child-stem";
      slot.appendChild(cStem);
      const branch = renderBranch(kid, used);
      if (branch) slot.appendChild(branch);
      row.appendChild(slot);
    });

    // Horizontal bar width approximation after layout
    wrap.appendChild(row);
    node.appendChild(wrap);

    // Draw horizontal connector after DOM is ready
    requestAnimationFrame(() => {
      if (row.children.length < 2) return;
      const first = row.children[0];
      const last = row.children[row.children.length - 1];
      const rowRect = row.getBoundingClientRect();
      const fRect = first.getBoundingClientRect();
      const lRect = last.getBoundingClientRect();
      const bar = document.createElement("div");
      bar.className = "children-bar";
      const left = fRect.left + fRect.width / 2 - rowRect.left;
      const right = lRect.left + lRect.width / 2 - rowRect.left;
      bar.style.width = Math.max(0, right - left) + "px";
      bar.style.marginLeft = left + "px";
      bar.style.marginBottom = "0";
      wrap.insertBefore(bar, row);
    });
  }

  return node;
}

function renderTree() {
  treeCanvas.innerHTML = "";
  treeCanvas.style.transform = `scale(${scale})`;

  if (!people.length) {
    treeCanvas.innerHTML =
      `<p class="empty-state">Afegeix persones amb el formulari.<br>Després tria un punt de partida.</p>`;
    return;
  }

  if (!focusId || !get(focusId)) focusId = people[0].id;

  const roots = findRoots(focusId);
  const used = new Set();

  const rootsRow = document.createElement("div");
  rootsRow.className = "roots-row";

  roots.forEach((r) => {
    // If spouse already used as part of another root, skip
    if (used.has(r.id)) return;
    const branch = renderBranch(r, used);
    if (branch) rootsRow.appendChild(branch);
  });

  // Anyone not yet shown (disconnected) → small secondary roots
  const rest = people.filter((p) => !used.has(p.id));
  if (rest.length) {
    rest.forEach((p) => {
      if (used.has(p.id)) return;
      const branch = renderBranch(p, used);
      if (branch) rootsRow.appendChild(branch);
    });
  }

  treeCanvas.appendChild(rootsRow);
}

function renderList(filter = "") {
  const q = filter.trim().toLowerCase();
  const list = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
  peopleCount.textContent = people.length;
  peopleList.innerHTML = "";
  if (!list.length) {
    peopleList.innerHTML = `<li style="color:var(--soft);cursor:default">Cap persona</li>`;
    return;
  }
  list
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ca"))
    .forEach((p) => {
      const li = document.createElement("li");
      if (p.id === focusId) li.classList.add("active");
      li.innerHTML = `<span class="name">${esc(p.name)}${isDead(p) ? " †" : ""}</span>
        <span class="actions">
          <button data-menu="${p.id}" title="Menú">⋮</button>
          <button data-edit="${p.id}" title="Editar">✏️</button>
        </span>`;
      li.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        focusId = p.id;
        save();
        render();
      });
      peopleList.appendChild(li);
    });
}

function fillSelect() {
  rootSelect.innerHTML =
    `<option value="">— Tria una persona —</option>` +
    people
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "ca"))
      .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
      .join("");
  if (focusId) rootSelect.value = focusId;
}

function startEdit(id) {
  const p = get(id);
  if (!p) return;
  personIdInput.value = p.id;
  nameInput.value = p.name;
  birthInput.value = p.birth || "";
  deathInput.value = p.death || "";
  genderInput.value = p.gender || "unknown";
  notesInput.value = p.notes || "";
  saveBtn.textContent = "Actualitzar";
  cancelBtn.hidden = false;
  nameInput.focus();
}
function resetForm() {
  form.reset();
  personIdInput.value = "";
  saveBtn.textContent = "Desar";
  cancelBtn.hidden = true;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = personIdInput.value || uid();
  const data = {
    id,
    name: nameInput.value.trim(),
    birth: birthInput.value ? Number(birthInput.value) : null,
    death: deathInput.value ? Number(deathInput.value) : null,
    gender: genderInput.value,
    notes: notesInput.value.trim(),
    fatherId: null,
    motherId: null,
    spouseId: null,
  };
  const ex = get(id);
  if (ex) {
    data.fatherId = ex.fatherId;
    data.motherId = ex.motherId;
    data.spouseId = ex.spouseId;
    Object.assign(ex, data);
  } else {
    people.push(data);
    if (!focusId) focusId = id;
  }
  save();
  resetForm();
  render();
});
cancelBtn.addEventListener("click", resetForm);

peopleList.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  e.stopPropagation();
  if (b.dataset.edit) startEdit(b.dataset.edit);
  if (b.dataset.menu) {
    const r = b.getBoundingClientRect();
    showMenu(b.dataset.menu, r.left, r.bottom + 4);
  }
});
searchInput.addEventListener("input", () => renderList(searchInput.value));
rootSelect.addEventListener("change", () => {
  focusId = rootSelect.value || people[0]?.id || null;
  save();
  render();
});

$("zoom-in").onclick = () => {
  scale = Math.min(1.5, scale + 0.1);
  treeCanvas.style.transform = `scale(${scale})`;
};
$("zoom-out").onclick = () => {
  scale = Math.max(0.5, scale - 0.1);
  treeCanvas.style.transform = `scale(${scale})`;
};
$("zoom-reset").onclick = () => {
  scale = 1;
  treeCanvas.style.transform = `scale(1)`;
};

$("export-btn").onclick = () => {
  const blob = new Blob([JSON.stringify({ people, focusId }, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `familia-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
};
$("import-btn").onclick = () => $("import-file").click();
$("import-file").onchange = () => {
  const f = $("import-file").files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (Array.isArray(data)) {
        people = data.map(normalizePerson);
        focusId = people[0]?.id || null;
      } else {
        people = (data.people || []).map(normalizePerson);
        focusId = data.focusId || data.meId || people[0]?.id || null;
      }
      save();
      render();
      alert("Importat correctament");
    } catch (err) {
      alert("Error: " + err.message);
    }
    $("import-file").value = "";
  };
  r.readAsText(f);
};
$("clear-btn").onclick = () => {
  if (!confirm("Esborrar TOT l'arbre?")) return;
  people = [];
  focusId = null;
  save();
  render();
};

function render() {
  renderList(searchInput.value);
  fillSelect();
  renderTree();
}

load();
render();
