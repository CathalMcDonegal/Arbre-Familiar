/**
 * Arbre Genealògic - App senzilla i privada (versió muntanya)
 * Dades desades a localStorage
 */

const STORAGE_KEY = "arbre-genealogic-v2";

// ---------- Estat ----------
let people = []; // { id, name, birth, death, gender, notes, fatherId, motherId, spouseId }
let currentRootId = null;
let scale = 1;
let menuPersonId = null;

// ---------- DOM ----------
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

// Menú contextual flotant
const personMenu = document.createElement("div");
personMenu.className = "person-menu";
personMenu.innerHTML = `
  <button data-action="add-father">➕ Afegir pare</button>
  <button data-action="add-mother">➕ Afegir mare</button>
  <button data-action="add-sibling">➕ Afegir germà/germana</button>
  <button data-action="add-child">➕ Afegir fill/a</button>
  <div class="menu-divider"></div>
  <button data-action="add-spouse">➕ Afegir cònjuge</button>
  <button data-action="edit">✏️ Editar</button>
  <button data-action="center">🎯 Centrar a l'arbre</button>
  <div class="menu-divider"></div>
  <button data-action="delete" style="color:#8b3a3a">🗑️ Eliminar</button>
`;
document.body.appendChild(personMenu);

// ---------- Utilitats ----------
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
  } catch {
    people = [];
  }
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- Crear persona ràpida (des del menú) ----------
function promptNewPerson(relationLabel) {
  const name = prompt(`Nom del/de la ${relationLabel}:`);
  if (!name || !name.trim()) return null;
  const gender = prompt("Gènere (d = dona, h = home, deixar buit = no especificat):", "") || "unknown";
  let g = "unknown";
  if (gender.toLowerCase().startsWith("d")) g = "female";
  else if (gender.toLowerCase().startsWith("h")) g = "male";
  else if (gender.toLowerCase().startsWith("a")) g = "other";

  const p = {
    id: uid(),
    name: name.trim(),
    birth: null,
    death: null,
    gender: g,
    notes: "",
    fatherId: null,
    motherId: null,
    spouseId: null,
  };
  people.push(p);
  return p;
}

function addFather(ofId) {
  const of = getPerson(ofId);
  if (!of) return;
  if (of.fatherId) {
    alert("Aquesta persona ja té pare. Edita les relacions si vols canviar-lo.");
    return;
  }
  const neu = promptNewPerson("pare");
  if (!neu) return;
  neu.gender = neu.gender === "unknown" ? "male" : neu.gender;
  of.fatherId = neu.id;
  // si ja té mare, opcionalment enllaçar cònjuge
  if (of.motherId) {
    const mare = getPerson(of.motherId);
    if (mare && !mare.spouseId) {
      mare.spouseId = neu.id;
      neu.spouseId = mare.id;
    }
  }
  currentRootId = ofId; // mantenim centrats a la persona original
  save();
  renderAll();
}

function addMother(ofId) {
  const of = getPerson(ofId);
  if (!of) return;
  if (of.motherId) {
    alert("Aquesta persona ja té mare. Edita les relacions si vols canviar-la.");
    return;
  }
  const neu = promptNewPerson("mare");
  if (!neu) return;
  neu.gender = neu.gender === "unknown" ? "female" : neu.gender;
  of.motherId = neu.id;
  if (of.fatherId) {
    const pare = getPerson(of.fatherId);
    if (pare && !pare.spouseId) {
      pare.spouseId = neu.id;
      neu.spouseId = pare.id;
    }
  }
  currentRootId = ofId;
  save();
  renderAll();
}

function addSibling(ofId) {
  const of = getPerson(ofId);
  if (!of) return;
  if (!of.fatherId && !of.motherId) {
    alert("Primer afegeix el pare o la mare d'aquesta persona per poder afegir germans.");
    return;
  }
  const neu = promptNewPerson("germà/germana");
  if (!neu) return;
  neu.fatherId = of.fatherId;
  neu.motherId = of.motherId;
  currentRootId = ofId;
  save();
  renderAll();
}

function addChild(ofId) {
  const of = getPerson(ofId);
  if (!of) return;
  const neu = promptNewPerson("fill/a");
  if (!neu) return;
  // assignem com a fill: si és home → pare, si dona → mare, si no → segons gènere preferent
  if (of.gender === "male") {
    neu.fatherId = of.id;
    if (of.spouseId) neu.motherId = of.spouseId;
  } else if (of.gender === "female") {
    neu.motherId = of.id;
    if (of.spouseId) neu.fatherId = of.spouseId;
  } else {
    // desconegut: posem com a pare per defecte
    neu.fatherId = of.id;
    if (of.spouseId) neu.motherId = of.spouseId;
  }
  currentRootId = ofId;
  save();
  renderAll();
}

function addSpouse(ofId) {
  const of = getPerson(ofId);
  if (!of) return;
  if (of.spouseId) {
    alert("Aquesta persona ja té cònjuge. Edita les relacions si vols canviar-lo.");
    return;
  }
  const neu = promptNewPerson("cònjuge");
  if (!neu) return;
  of.spouseId = neu.id;
  neu.spouseId = of.id;
  // gènere complementari si es pot
  if (of.gender === "male" && neu.gender === "unknown") neu.gender = "female";
  if (of.gender === "female" && neu.gender === "unknown") neu.gender = "male";
  currentRootId = ofId;
  save();
  renderAll();
}

// ---------- Menú contextual ----------
function showPersonMenu(personId, x, y) {
  menuPersonId = personId;
  personMenu.classList.add("open");
  // posicionar
  const menuW = 210;
  const menuH = 320;
  let left = x;
  let top = y;
  if (left + menuW > window.innerWidth) left = window.innerWidth - menuW - 8;
  if (top + menuH > window.innerHeight) top = window.innerHeight - menuH - 8;
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
  else if (action === "center") {
    currentRootId = id;
    renderAll();
  } else if (action === "delete") {
    const p = getPerson(id);
    if (!p) return;
    if (!confirm(`Vols eliminar ${p.name}?`)) return;
    people.forEach((other) => {
      if (other.fatherId === id) other.fatherId = null;
      if (other.motherId === id) other.motherId = null;
      if (other.spouseId === id) other.spouseId = null;
    });
    people = people.filter((x) => x.id !== id);
    if (currentRootId === id) {
      currentRootId = people.length ? people[0].id : null;
    }
    save();
    renderAll();
  }
});

document.addEventListener("click", (e) => {
  if (!personMenu.contains(e.target) && !e.target.closest(".person-card")) {
    hidePersonMenu();
  }
});

// ---------- Render llista de persones ----------
function renderPeopleList(filter = "") {
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? people.filter((p) => p.name.toLowerCase().includes(q))
    : people;

  peopleCount.textContent = people.length;
  peopleList.innerHTML = "";

  if (filtered.length === 0) {
    peopleList.innerHTML = `<li style="color:var(--muted);cursor:default">No hi ha persones</li>`;
    return;
  }

  filtered
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ca"))
    .forEach((p) => {
      const li = document.createElement("li");
      if (p.id === currentRootId) li.classList.add("active");
      li.innerHTML = `
        <span class="name" title="${p.name}">${p.name}</span>
        <span class="actions">
          <button title="Menú" data-menu="${p.id}">⋮</button>
          <button title="Editar" data-edit="${p.id}">✏️</button>
          <button title="Eliminar" data-del="${p.id}">🗑️</button>
        </span>
      `;
      li.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        currentRootId = p.id;
        renderAll();
      });
      peopleList.appendChild(li);
    });
}

// ---------- Selectors ----------
function fillPersonSelects() {
  rootSelect.innerHTML =
    `<option value="">— Selecciona una persona —</option>` +
    people
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "ca"))
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join("");

  if (currentRootId) rootSelect.value = currentRootId;
}

function fillRelationSelects(excludeId) {
  const opts =
    `<option value="">— Cap —</option>` +
    people
      .filter((p) => p.id !== excludeId)
      .sort((a, b) => a.name.localeCompare(b.name, "ca"))
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join("");

  fatherSelect.innerHTML = opts;
  motherSelect.innerHTML = opts;
  spouseSelect.innerHTML = opts;
}

// ---------- Formulari persona ----------
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
  // centrar també
  currentRootId = id;
  renderTree();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = personIdInput.value || uid();
  const isNew = !personIdInput.value;
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

  const existing = getPerson(id);
  if (existing) {
    data.fatherId = existing.fatherId;
    data.motherId = existing.motherId;
    data.spouseId = existing.spouseId;
    Object.assign(existing, data);
  } else {
    people.push(data);
  }

  // Cada persona nova (o actualitzada) va directament a l'arbre
  currentRootId = id;
  save();
  resetForm();
  renderAll();
});

cancelBtn.addEventListener("click", resetForm);

// ---------- Esdeveniments llista ----------
peopleList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  e.stopPropagation();

  if (btn.dataset.edit) {
    editPerson(btn.dataset.edit);
  } else if (btn.dataset.del) {
    const id = btn.dataset.del;
    const p = getPerson(id);
    if (!p) return;
    if (!confirm(`Vols eliminar ${p.name}?`)) return;
    people.forEach((other) => {
      if (other.fatherId === id) other.fatherId = null;
      if (other.motherId === id) other.motherId = null;
      if (other.spouseId === id) other.spouseId = null;
    });
    people = people.filter((x) => x.id !== id);
    if (currentRootId === id) {
      currentRootId = people.length ? people[0].id : null;
    }
    save();
    renderAll();
  } else if (btn.dataset.menu) {
    const rect = btn.getBoundingClientRect();
    showPersonMenu(btn.dataset.menu, rect.left, rect.bottom + 4);
  }
});

searchInput.addEventListener("input", () => {
  renderPeopleList(searchInput.value);
});

// ---------- Relacions (modal antic, encara disponible) ----------
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

  save();
  relationsModal.close();
  renderAll();
});

closeRelationsBtn.addEventListener("click", () => relationsModal.close());

// ---------- Arbre visual ----------
function createCard(p) {
  const div = document.createElement("div");
  div.className = `person-card ${p.gender || "unknown"}`;
  if (p.id === currentRootId) div.classList.add("selected");
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
  return people.filter(
    (p) => p.fatherId === parentId || p.motherId === parentId
  );
}

function renderTree() {
  treeCanvas.innerHTML = "";
  treeCanvas.style.transform = `scale(${scale})`;

  // Si no hi ha root però hi ha persones → agafem la primera
  if (!currentRootId && people.length > 0) {
    currentRootId = people[0].id;
  }

  if (!currentRootId || people.length === 0) {
    treeCanvas.innerHTML = `<p class="empty-state">Afegeix una persona amb el formulari de l'esquerra.<br>Després clica-la a l'arbre per afegir família.</p>`;
    return;
  }

  const root = getPerson(currentRootId);
  if (!root) {
    currentRootId = people.length ? people[0].id : null;
    if (!currentRootId) {
      treeCanvas.innerHTML = `<p class="empty-state">Afegeix una persona amb el formulari de l'esquerra.</p>`;
      return;
    }
    return renderTree();
  }

  // --- Avantpassats (màx 3 generacions) ---
  const ancestorLevels = [];
  let currentLevel = [root];
  for (let i = 0; i < 3; i++) {
    const next = [];
    currentLevel.forEach((p) => {
      if (p.fatherId) {
        const f = getPerson(p.fatherId);
        if (f && !next.find((x) => x.id === f.id)) next.push(f);
      }
      if (p.motherId) {
        const m = getPerson(p.motherId);
        if (m && !next.find((x) => x.id === m.id)) next.push(m);
      }
    });
    if (next.length === 0) break;
    ancestorLevels.unshift(next);
    currentLevel = next;
  }

  ancestorLevels.forEach((level) => {
    const gen = document.createElement("div");
    gen.className = "generation";
    level.forEach((p) => {
      const unit = document.createElement("div");
      unit.className = "family-unit";
      const couple = document.createElement("div");
      couple.className = "couple";
      couple.appendChild(createCard(p));
      if (p.spouseId) {
        const s = getPerson(p.spouseId);
        if (s) couple.appendChild(createCard(s));
      }
      unit.appendChild(couple);
      gen.appendChild(unit);
    });
    treeCanvas.appendChild(gen);
  });

  // --- Persona central + cònjuge ---
  const centerGen = document.createElement("div");
  centerGen.className = "generation";
  const centerUnit = document.createElement("div");
  centerUnit.className = "family-unit";

  const couple = document.createElement("div");
  couple.className = "couple";
  couple.appendChild(createCard(root));
  if (root.spouseId) {
    const spouse = getPerson(root.spouseId);
    if (spouse) couple.appendChild(createCard(spouse));
  }
  centerUnit.appendChild(couple);

  // Fills
  const children = getChildren(root.id);
  if (root.spouseId) {
    getChildren(root.spouseId).forEach((c) => {
      if (!children.find((x) => x.id === c.id)) children.push(c);
    });
  }

  if (children.length > 0) {
    const line = document.createElement("div");
    line.className = "connector-line";
    centerUnit.appendChild(line);

    const kidsRow = document.createElement("div");
    kidsRow.className = "children-row";
    children.forEach((c) => kidsRow.appendChild(createCard(c)));
    centerUnit.appendChild(kidsRow);

    // Néts
    const grandKids = [];
    children.forEach((c) => {
      getChildren(c.id).forEach((g) => {
        if (!grandKids.find((x) => x.id === g.id)) grandKids.push(g);
      });
    });
    if (grandKids.length > 0) {
      const line2 = document.createElement("div");
      line2.className = "connector-line";
      centerUnit.appendChild(line2);
      const gkRow = document.createElement("div");
      gkRow.className = "children-row";
      grandKids.forEach((g) => gkRow.appendChild(createCard(g)));
      centerUnit.appendChild(gkRow);
    }
  }

  centerGen.appendChild(centerUnit);
  treeCanvas.appendChild(centerGen);
}

// ---------- Zoom ----------
function applyZoom() {
  treeCanvas.style.transform = `scale(${scale})`;
}

zoomInBtn.addEventListener("click", () => {
  scale = Math.min(2, scale + 0.15);
  applyZoom();
});
zoomOutBtn.addEventListener("click", () => {
  scale = Math.max(0.4, scale - 0.15);
  applyZoom();
});
zoomResetBtn.addEventListener("click", () => {
  scale = 1;
  applyZoom();
});

rootSelect.addEventListener("change", () => {
  currentRootId = rootSelect.value || null;
  renderTree();
  renderPeopleList(searchInput.value);
});

// ---------- Export / Import / Clear ----------
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(people, null, 2)], {
    type: "application/json",
  });
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
      save();
      renderAll();
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

// ---------- Render complet ----------
function renderAll() {
  renderPeopleList(searchInput.value);
  fillPersonSelects();
  renderTree();
}

// ---------- Inici ----------
load();
if (people.length > 0 && !currentRootId) {
  currentRootId = people[0].id;
}
renderAll();
