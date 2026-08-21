/**
 * Arbre Genealògic – versió amb fletxes, anells i difunts en gris
 */
const STORAGE_KEY = "arbre-genealogic-v3";

let people = [];
let currentRootId = null;
let scale = 1;
let menuPersonId = null;

const form = document.getElementById("person-form");
const personIdInput = document.getElementById("person-id");
const nameInput = document.getElementById("name");
const birthInput = document.getElementById("birth");
const deathInput = document.getElementById("death");
const genderInput = document.getElementById("gender");
const notesInput = document.getElementById("notes");
const saveBtn = document.getElementById("save-btn");
const cancelBtn = document.getElementById("cancel-btn");
const peopleList = document.getElementById("people-list");
const peopleCount = document.getElementById("people-count");
const searchInput = document.getElementById("search");
const rootSelect = document.getElementById("root-select");
const treeCanvas = document.getElementById("tree-canvas");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");
const clearBtn = document.getElementById("clear-btn");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const zoomResetBtn = document.getElementById("zoom-reset");

const relationsModal = document.getElementById("relations-modal");
const relationsTitle = document.getElementById("relations-title");
const fatherSelect = document.getElementById("father-select");
const motherSelect = document.getElementById("mother-select");
const spouseSelect = document.getElementById("spouse-select");
const relationsForm = document.getElementById("relations-form");
const closeRelationsBtn = document.getElementById("close-relations");
let editingRelationsId = null;

// Menú contextual
const personMenu = document.createElement("div");
personMenu.className = "person-menu";
personMenu.innerHTML = `
  <button data-action="add-father">➕ Afegir pare</button>
  <button data-action="add-mother">➕ Afegir mare</button>
  <button data-action="add-sibling">➕ Afegir germà/germana</button>
  <button data-action="add-child">➕ Afegir fill/a</button>
  <div class="menu-divider"></div>
  <button data-action="add-spouse">💍 Afegir cònjuge</button>
  <button data-action="edit">✏️ Editar</button>
  <button data-action="center">🎯 Centrar a l'arbre</button>
  <div class="menu-divider"></div>
  <button data-action="delete" style="color:#8b3a3a">🗑️ Eliminar</button>
`;
document.body.appendChild(personMenu);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    people = raw ? JSON.parse(raw) : [];
  } catch { people = []; }
}
function getPerson(id) {
  return people.find((p) => p.id === id);
}
function yearsStr(p) {
  if (!p.birth && !p.death) return "";
  if (p.birth && p.death) return `${p.birth} – ${p.death}`;
  if (p.birth) return `n. ${p.birth}`;
  return `† ${p.death}`;
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function isDeceased(p) {
  return p.death != null && p.death !== "";
}

// ---------- Crear persona ràpida ----------
function promptNewPerson(label) {
  const name = prompt(`Nom del/de la ${label}:`);
  if (!name || !name.trim()) return null;
  const gRaw = (prompt("Gènere (d = dona, h = home, deixar buit = no especificat):", "") || "").toLowerCase();
  let g = "unknown";
  if (gRaw.startsWith("d")) g = "female";
  else if (gRaw.startsWith("h")) g = "male";
  else if (gRaw.startsWith("a")) g = "other";
  const p = {
    id: uid(), name: name.trim(), birth: null, death: null,
    gender: g, notes: "", fatherId: null, motherId: null, spouseId: null,
  };
  people.push(p);
  return p;
}

function addFather(ofId) {
  const of = getPerson(ofId);
  if (!of) return;
  if (of.fatherId) { alert("Ja té pare. Edita les relacions per canviar-lo."); return; }
  const neu = promptNewPerson("pare");
  if (!neu) return;
  if (neu.gender === "unknown") neu.gender = "male";
  of.fatherId = neu.id;
  if (of.motherId) {
    const mare = getPerson(of.motherId);
    if (mare && !mare.spouseId) { mare.spouseId = neu.id; neu.spouseId = mare.id; }
  }
  currentRootId = ofId;
  save(); renderAll();
}
function addMother(ofId) {
  const of = getPerson(ofId);
  if (!of) return;
  if (of.motherId) { alert("Ja té mare. Edita les relacions per canviar-la."); return; }
  const neu = promptNewPerson("mare");
  if (!neu) return;
  if (neu.gender === "unknown") neu.gender = "female";
  of.motherId = neu.id;
  if (of.fatherId) {
    const pare = getPerson(of.fatherId);
    if (pare && !pare.spouseId) { pare.spouseId = neu.id; neu.spouseId = pare.id; }
  }
  currentRootId = ofId;
  save(); renderAll();
}
function addSibling(ofId) {
  const of = getPerson(ofId);
  if (!of) return;
  if (!of.fatherId && !of.motherId) {
    alert("Primer afegeix el pare o la mare per poder afegir germans.");
    return;
  }
  const neu = promptNewPerson("germà/germana");
  if (!neu) return;
  neu.fatherId = of.fatherId;
  neu.motherId = of.motherId;
  currentRootId = ofId;
  save(); renderAll();
}
function addChild(ofId) {
  const of = getPerson(ofId);
  if (!of) return;
  const neu = promptNewPerson("fill/a");
  if (!neu) return;
  if (of.gender === "male") {
    neu.fatherId = of.id;
    if (of.spouseId) neu.motherId = of.spouseId;
  } else if (of.gender === "female") {
    neu.motherId = of.id;
    if (of.spouseId) neu.fatherId = of.spouseId;
  } else {
    neu.fatherId = of.id;
    if (of.spouseId) neu.motherId = of.spouseId;
  }
  currentRootId = ofId;
  save(); renderAll();
}
function addSpouse(ofId) {
  const of = getPerson(ofId);
  if (!of) return;
  if (of.spouseId) { alert("Ja té cònjuge. Edita les relacions per canviar-lo."); return; }
  const neu = promptNewPerson("cònjuge");
  if (!neu) return;
  of.spouseId = neu.id;
  neu.spouseId = of.id;
  if (of.gender === "male" && neu.gender === "unknown") neu.gender = "female";
  if (of.gender === "female" && neu.gender === "unknown") neu.gender = "male";
  currentRootId = ofId;
  save(); renderAll();
}

// ---------- Menú ----------
function showPersonMenu(personId, x, y) {
  menuPersonId = personId;
  personMenu.classList.add("open");
  const menuW = 220, menuH = 340;
  let left = x, top = y;
  if (left + menuW > window.innerWidth) left = window.innerWidth - menuW - 8;
  if (top + menuH > window.innerHeight) top = window.innerHeight - menuH - 8;
  if (left < 4) left = 4;
  if (top < 4) top = 4;
  personMenu.style.left = left + "px";
  personMenu.style.top = top + "px";
}
function hidePersonMenu() {
  personMenu.classList.remove("open");
  menuPersonId = null;
}

personMenu.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || !menuPersonId) return;
  const action = btn.dataset.action;
  const id = menuPersonId;
  hidePersonMenu();
  if (action === "add-father") addFather(id);
  else if (action === "add-mother") addMother(id);
  else if (action === "add-sibling") addSibling(id);
  else if (action === "add-child") addChild(id);
  else if (action === "add-spouse") addSpouse(id);
  else if (action === "edit") editPerson(id);
  else if (action === "center") { currentRootId = id; renderAll(); }
  else if (action === "delete") {
    const p = getPerson(id);
    if (!p) return;
    if (!confirm(`Vols eliminar ${p.name}?`)) return;
    people.forEach((o) => {
      if (o.fatherId === id) o.fatherId = null;
      if (o.motherId === id) o.motherId = null;
      if (o.spouseId === id) o.spouseId = null;
    });
    people = people.filter((x) => x.id !== id);
    if (currentRootId === id) currentRootId = people.length ? people[0].id : null;
    save(); renderAll();
  }
});
document.addEventListener("click", (e) => {
  if (!personMenu.contains(e.target) && !e.target.closest(".person-card")) hidePersonMenu();
});

// ---------- Llista ----------
function renderPeopleList(filter = "") {
  const q = filter.trim().toLowerCase();
  const filtered = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
  peopleCount.textContent = people.length;
  peopleList.innerHTML = "";
  if (filtered.length === 0) {
    peopleList.innerHTML = `<li style="color:var(--muted);cursor:default">No hi ha persones</li>`;
    return;
  }
  filtered.slice().sort((a, b) => a.name.localeCompare(b.name, "ca")).forEach((p) => {
    const li = document.createElement("li");
    if (p.id === currentRootId) li.classList.add("active");
    li.innerHTML = `
      <span class="name" title="${p.name}">${p.name}${isDeceased(p) ? " †" : ""}</span>
      <span class="actions">
        <button title="Menú" data-menu="${p.id}">⋮</button>
        <button title="Editar" data-edit="${p.id}">✏️</button>
        <button title="Eliminar" data-del="${p.id}">🗑️</button>
      </span>`;
    li.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      currentRootId = p.id;
      renderAll();
    });
    peopleList.appendChild(li);
  });
}

function fillPersonSelects() {
  rootSelect.innerHTML =
    `<option value="">— Selecciona una persona —</option>` +
    people.slice().sort((a, b) => a.name.localeCompare(b.name, "ca"))
      .map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  if (currentRootId) rootSelect.value = currentRootId;
}
function fillRelationSelects(excludeId) {
  const opts = `<option value="">— Cap —</option>` +
    people.filter((p) => p.id !== excludeId)
      .sort((a, b) => a.name.localeCompare(b.name, "ca"))
      .map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  fatherSelect.innerHTML = opts;
  motherSelect.innerHTML = opts;
  spouseSelect.innerHTML = opts;
}

function resetForm() {
  form.reset();
  personIdInput.value = "";
  saveBtn.textContent = "Desar persona";
  cancelBtn.hidden = true;
}
function editPerson(id) {
  const p = getPerson(id);
  if (!p) return;
  personIdInput.value = p.id;
  nameInput.value = p.name;
  birthInput.value = p.birth || "";
  deathInput.value = p.death || "";
  genderInput.value = p.gender || "unknown";
  notesInput.value = p.notes || "";
  saveBtn.textContent = "Actualitzar persona";
  cancelBtn.hidden = false;
  nameInput.focus();
  currentRootId = id;
  renderTree();
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
    fatherId: null, motherId: null, spouseId: null,
  };
  const existing = getPerson(id);
  if (existing) {
    data.fatherId = existing.fatherId;
    data.motherId = existing.motherId;
    data.spouseId = existing.spouseId;
    Object.assign(existing, data);
  } else {
    people.push(data);
  }
  currentRootId = id;
  save();
  resetForm();
  renderAll();
});
cancelBtn.addEventListener("click", resetForm);

peopleList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  e.stopPropagation();
  if (btn.dataset.edit) editPerson(btn.dataset.edit);
  else if (btn.dataset.del) {
    const id = btn.dataset.del;
    const p = getPerson(id);
    if (!p) return;
    if (!confirm(`Vols eliminar ${p.name}?`)) return;
    people.forEach((o) => {
      if (o.fatherId === id) o.fatherId = null;
      if (o.motherId === id) o.motherId = null;
      if (o.spouseId === id) o.spouseId = null;
    });
    people = people.filter((x) => x.id !== id);
    if (currentRootId === id) currentRootId = people.length ? people[0].id : null;
    save(); renderAll();
  } else if (btn.dataset.menu) {
    const rect = btn.getBoundingClientRect();
    showPersonMenu(btn.dataset.menu, rect.left, rect.bottom + 4);
  }
});
searchInput.addEventListener("input", () => renderPeopleList(searchInput.value));

// Relacions modal
function openRelations(id) {
  const p = getPerson(id);
  if (!p) return;
  editingRelationsId = id;
  relationsTitle.textContent = `Relacions de ${p.name}`;
  fillRelationSelects(id);
  fatherSelect.value = p.fatherId || "";
  motherSelect.value = p.motherId || "";
  spouseSelect.value = p.spouseId || "";
  relationsModal.showModal();
}
relationsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const p = getPerson(editingRelationsId);
  if (!p) return;
  p.fatherId = fatherSelect.value || null;
  p.motherId = motherSelect.value || null;
  const newSpouse = spouseSelect.value || null;
  if (p.spouseId && p.spouseId !== newSpouse) {
    const old = getPerson(p.spouseId);
    if (old && old.spouseId === p.id) old.spouseId = null;
  }
  p.spouseId = newSpouse;
  if (newSpouse) {
    const s = getPerson(newSpouse);
    if (s) {
      if (s.spouseId && s.spouseId !== p.id) {
        const prev = getPerson(s.spouseId);
        if (prev) prev.spouseId = null;
      }
      s.spouseId = p.id;
    }
  }
  save(); relationsModal.close(); renderAll();
});
closeRelationsBtn.addEventListener("click", () => relationsModal.close());

// ---------- Arbre + fletxes SVG ----------
function createCard(p) {
  const div = document.createElement("div");
  let cls = `person-card ${p.gender || "unknown"}`;
  if (isDeceased(p)) cls += " deceased";
  if (p.id === currentRootId) cls += " selected";
  div.className = cls;
  div.dataset.id = p.id;
  div.innerHTML = `
    <div class="pname">${escapeHtml(p.name)}</div>
    <div class="pyears">${yearsStr(p)}</div>
    ${p.notes ? `<div class="pnotes" title="${escapeHtml(p.notes)}">${escapeHtml(p.notes)}</div>` : ""}
  `;
  div.addEventListener("click", (e) => {
    e.stopPropagation();
    showPersonMenu(p.id, e.clientX, e.clientY);
  });
  return div;
}

function getChildren(parentId) {
  return people.filter((p) => p.fatherId === parentId || p.motherId === parentId);
}

function centerOf(el, canvasRect) {
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width / 2 - canvasRect.left,
    y: r.top + r.height / 2 - canvasRect.top,
    top: r.top - canvasRect.top,
    bottom: r.bottom - canvasRect.top,
    left: r.left - canvasRect.left,
    right: r.right - canvasRect.left,
  };
}

function drawConnectors() {
  const old = document.getElementById("connectors");
  if (old) old.remove();

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "connectors";
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  // marker de fletxa
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" class="arrow-head"/>
    </marker>
  `;
  svg.appendChild(defs);
  treeCanvas.insertBefore(svg, treeCanvas.firstChild);

  // Després del layout, calculem posicions
  requestAnimationFrame(() => {
    const canvasRect = treeCanvas.getBoundingClientRect();
    const cards = [...treeCanvas.querySelectorAll(".person-card")];
    const byId = {};
    cards.forEach((c) => { byId[c.dataset.id] = c; });

    // Línies pares → fills
    people.forEach((child) => {
      const childEl = byId[child.id];
      if (!childEl) return;
      const parents = [];
      if (child.fatherId && byId[child.fatherId]) parents.push(byId[child.fatherId]);
      if (child.motherId && byId[child.motherId]) parents.push(byId[child.motherId]);
      if (parents.length === 0) return;

      const cPos = centerOf(childEl, canvasRect);
      parents.forEach((parEl) => {
        const pPos = centerOf(parEl, canvasRect);
        // Línia des de sota del pare fins a dalt del fill, amb fletxa
        const x1 = pPos.x;
        const y1 = pPos.bottom;
        const x2 = cPos.x;
        const y2 = cPos.top;
        const midY = (y1 + y2) / 2;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
        path.setAttribute("marker-end", "url(#arrow)");
        path.setAttribute("stroke", "#6b5e4f");
        path.setAttribute("stroke-width", "2.2");
        path.setAttribute("fill", "none");
        svg.appendChild(path);
      });
    });

    // Actualitzar mida SVG
    const h = Math.max(treeCanvas.scrollHeight, treeCanvas.offsetHeight);
    const w = Math.max(treeCanvas.scrollWidth, treeCanvas.offsetWidth);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.style.width = w + "px";
    svg.style.height = h + "px";
  });
}

function renderTree() {
  treeCanvas.innerHTML = "";
  treeCanvas.style.transform = `scale(${scale})`;

  if (!currentRootId && people.length > 0) currentRootId = people[0].id;

  if (!currentRootId || people.length === 0) {
    treeCanvas.innerHTML = `<p class="empty-state">Afegeix una persona amb el formulari de l'esquerra.<br>Després clica-la per afegir pare, mare, germans o fills.</p>`;
    return;
  }

  const root = getPerson(currentRootId);
  if (!root) {
    currentRootId = people.length ? people[0].id : null;
    if (!currentRootId) {
      treeCanvas.innerHTML = `<p class="empty-state">Afegeix una persona amb el formulari.</p>`;
      return;
    }
    return renderTree();
  }

  // Avantpassats (fins a 3 nivells)
  const ancestorLevels = [];
  let level = [root];
  for (let i = 0; i < 3; i++) {
    const next = [];
    level.forEach((p) => {
      if (p.fatherId) {
        const f = getPerson(p.fatherId);
        if (f && !next.find((x) => x.id === f.id)) next.push(f);
      }
      if (p.motherId) {
        const m = getPerson(p.motherId);
        if (m && !next.find((x) => x.id === m.id)) next.push(m);
      }
    });
    if (!next.length) break;
    ancestorLevels.unshift(next);
    level = next;
  }

  ancestorLevels.forEach((lvl) => {
    const gen = document.createElement("div");
    gen.className = "generation";
    lvl.forEach((p) => {
      const unit = document.createElement("div");
      unit.className = "family-unit";
      const row = document.createElement("div");
      row.className = "couple-row";
      row.appendChild(createCard(p));
      if (p.spouseId) {
        const s = getPerson(p.spouseId);
        if (s) {
          const ring = document.createElement("div");
          ring.className = "couple-ring";
          ring.title = "Parella";
          row.appendChild(ring);
          row.appendChild(createCard(s));
        }
      }
      unit.appendChild(row);
      gen.appendChild(unit);
    });
    treeCanvas.appendChild(gen);
  });

  // Centre
  const centerGen = document.createElement("div");
  centerGen.className = "generation";
  const centerUnit = document.createElement("div");
  centerUnit.className = "family-unit";

  const coupleRow = document.createElement("div");
  coupleRow.className = "couple-row";
  coupleRow.appendChild(createCard(root));
  if (root.spouseId) {
    const spouse = getPerson(root.spouseId);
    if (spouse) {
      const ring = document.createElement("div");
      ring.className = "couple-ring";
      ring.title = "Parella";
      coupleRow.appendChild(ring);
      coupleRow.appendChild(createCard(spouse));
    }
  }
  centerUnit.appendChild(coupleRow);

  // Fills
  let children = getChildren(root.id);
  if (root.spouseId) {
    getChildren(root.spouseId).forEach((c) => {
      if (!children.find((x) => x.id === c.id)) children.push(c);
    });
  }

  if (children.length) {
    const kidsBlock = document.createElement("div");
    kidsBlock.className = "children-block";
    const kidsRow = document.createElement("div");
    kidsRow.className = "children-row";
    children.forEach((c) => kidsRow.appendChild(createCard(c)));
    kidsBlock.appendChild(kidsRow);

    // Néts
    const grandKids = [];
    children.forEach((c) => {
      getChildren(c.id).forEach((g) => {
        if (!grandKids.find((x) => x.id === g.id)) grandKids.push(g);
      });
    });
    if (grandKids.length) {
      const gkRow = document.createElement("div");
      gkRow.className = "children-row";
      grandKids.forEach((g) => gkRow.appendChild(createCard(g)));
      kidsBlock.appendChild(gkRow);
    }
    centerUnit.appendChild(kidsBlock);
  }

  centerGen.appendChild(centerUnit);
  treeCanvas.appendChild(centerGen);

  // Dibuixar fletxes
  drawConnectors();
}

function applyZoom() {
  treeCanvas.style.transform = `scale(${scale})`;
  // redibuixar connectors després del zoom
  setTimeout(drawConnectors, 50);
}
zoomInBtn.addEventListener("click", () => { scale = Math.min(2, scale + 0.15); applyZoom(); });
zoomOutBtn.addEventListener("click", () => { scale = Math.max(0.4, scale - 0.15); applyZoom(); });
zoomResetBtn.addEventListener("click", () => { scale = 1; applyZoom(); });
rootSelect.addEventListener("change", () => {
  currentRootId = rootSelect.value || null;
  renderTree();
  renderPeopleList(searchInput.value);
});

exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(people, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `arbre-genealogic-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("Format invàlid");
      if (!confirm(`Vols importar ${data.length} persones? Es reemplaçaran les dades actuals.`)) return;
      people = data;
      currentRootId = people.length ? people[0].id : null;
      save(); renderAll();
      alert("Importació correcta");
    } catch (err) {
      alert("Error en importar: " + err.message);
    }
    importFile.value = "";
  };
  reader.readAsText(file);
});
clearBtn.addEventListener("click", () => {
  if (!confirm("Vols esborrar TOT l'arbre? Aquesta acció no es pot desfer.")) return;
  people = [];
  currentRootId = null;
  save();
  renderAll();
});

function renderAll() {
  renderPeopleList(searchInput.value);
  fillPersonSelects();
  renderTree();
}

load();
if (people.length > 0 && !currentRootId) currentRootId = people[0].id;
renderAll();
