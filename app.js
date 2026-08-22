/**
 * Arbre genealògic – vista completa per generacions, sense repeticions
 */
const STORAGE_KEY = "arbre-genealogic-v5";

let people = [];
let meId = null; // "Jo sóc"
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
const exportBtn = $("export-btn");
const importBtn = $("import-btn");
const importFile = $("import-file");
const clearBtn = $("clear-btn");

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
  <button data-a="me">👤 Jo sóc aquesta persona</button>
  <div class="sep"></div>
  <button data-a="del" style="color:#8b3a2a">🗑️ Eliminar</button>
`;
document.body.appendChild(personMenu);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ people, meId }));
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      people = data;
      meId = people[0]?.id || null;
    } else {
      people = data.people || [];
      meId = data.meId || (people[0]?.id ?? null);
    }
  } catch {
    people = [];
    meId = null;
  }
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
function dead(p) {
  return p.death != null && p.death !== "";
}
function childrenOf(id) {
  return people.filter((p) => p.fatherId === id || p.motherId === id);
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
  if (!p || p.fatherId) return alert(p?.fatherId ? "Ja té pare." : "");
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
  if (!p || p.motherId) return alert(p?.motherId ? "Ja té mare." : "");
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
  if (!p || p.spouseId) return alert(p?.spouseId ? "Ja té parella." : "");
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
  const w = 210, h = 320;
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
  else if (a === "me") {
    meId = id;
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
    if (meId === id) meId = people[0]?.id || null;
    save();
    render();
  }
});
document.addEventListener("click", (e) => {
  if (!personMenu.contains(e.target) && !e.target.closest(".person")) hideMenu();
});

/**
 * Construeix generacions sense repeticions al voltant de "me".
 * Inclou: avis, pares, sogres, jo+parella, germans, cunyats, fills, néts.
 */
function buildGenerations(me) {
  const used = new Set();
  const mark = (p) => {
    if (!p || used.has(p.id)) return false;
    used.add(p.id);
    return true;
  };

  const gens = []; // { label, units: [{ members: person[], role }] }

  // Helpers
  const parentsOf = (p) => {
    const arr = [];
    if (p.fatherId) {
      const f = get(p.fatherId);
      if (f) arr.push(f);
    }
    if (p.motherId) {
      const m = get(p.motherId);
      if (m) arr.push(m);
    }
    return arr;
  };

  // —— Besavis (pares dels avis) ——
  const gp = parentsOf(me);
  const ggp = [];
  gp.forEach((g) => parentsOf(g).forEach((x) => ggp.push(x)));
  const spouse = me.spouseId ? get(me.spouseId) : null;
  if (spouse) {
    parentsOf(spouse).forEach((sg) => parentsOf(sg).forEach((x) => ggp.push(x)));
  }
  if (ggp.length) {
    const units = [];
    const seen = new Set();
    ggp.forEach((p) => {
      if (seen.has(p.id)) return;
      const pair = [p];
      seen.add(p.id);
      if (p.spouseId) {
        const s = get(p.spouseId);
        if (s && !seen.has(s.id)) {
          pair.push(s);
          seen.add(s.id);
        }
      }
      pair.forEach((x) => mark(x));
      units.push({ members: pair, role: "Besavis" });
    });
    if (units.length) gens.push({ label: "Besavis", units });
  }

  // —— Avis (paterns + materns + de la parella) ——
  const grandparents = [];
  gp.forEach((g) => grandparents.push(g));
  if (spouse) parentsOf(spouse).forEach((g) => grandparents.push(g));
  if (grandparents.length) {
    const units = [];
    const seen = new Set();
    grandparents.forEach((p) => {
      if (seen.has(p.id) || used.has(p.id)) return;
      const pair = [p];
      seen.add(p.id);
      if (p.spouseId) {
        const s = get(p.spouseId);
        if (s && !seen.has(s.id) && !used.has(s.id)) {
          pair.push(s);
          seen.add(s.id);
        }
      }
      pair.forEach((x) => mark(x));
      units.push({ members: pair, role: "Avis" });
    });
    if (units.length) gens.push({ label: "Avis", units });
  }

  // —— Pares i sogres ——
  const parentGen = [];
  parentsOf(me).forEach((p) => parentGen.push({ p, role: p.gender === "female" ? "Mare" : p.gender === "male" ? "Pare" : "Progenitor" }));
  if (spouse) {
    parentsOf(spouse).forEach((p) =>
      parentGen.push({ p, role: p.gender === "female" ? "Sogra" : p.gender === "male" ? "Sogre" : "Sogre/a" })
    );
  }
  if (parentGen.length) {
    const units = [];
    const seen = new Set();
    // agrupar en parelles si són cònjuges
    parentGen.forEach(({ p, role }) => {
      if (seen.has(p.id) || used.has(p.id)) return;
      const pair = [{ person: p, role }];
      seen.add(p.id);
      if (p.spouseId) {
        const s = get(p.spouseId);
        if (s && !seen.has(s.id) && !used.has(s.id)) {
          const r2 = parentGen.find((x) => x.p.id === s.id)?.role || "Parella";
          pair.push({ person: s, role: r2 });
          seen.add(s.id);
        }
      }
      pair.forEach((x) => mark(x.person));
      units.push({ members: pair.map((x) => x.person), roles: pair.map((x) => x.role) });
    });
    if (units.length) gens.push({ label: "Pares i sogres", units });
  }

  // —— Generació actual: jo, parella, germans, cunyats ——
  const mySibs = childrenOf(me.fatherId || me.motherId || "___").filter(
    (c) => c.id !== me.id && (c.fatherId === me.fatherId || c.motherId === me.motherId)
  );
  // millor: germans reals
  const siblings = people.filter(
    (c) =>
      c.id !== me.id &&
      ((me.fatherId && c.fatherId === me.fatherId) || (me.motherId && c.motherId === me.motherId))
  );

  const currentUnits = [];
  // Jo + parella
  {
    const pair = [me];
    mark(me);
    const roles = ["Jo"];
    if (spouse && mark(spouse)) {
      pair.push(spouse);
      roles.push("Parella");
    }
    currentUnits.push({ members: pair, roles });
  }
  // Germans
  siblings.forEach((s) => {
    if (used.has(s.id)) return;
    const pair = [s];
    const roles = ["Germà/na"];
    mark(s);
    if (s.spouseId) {
      const sp = get(s.spouseId);
      if (sp && mark(sp)) {
        pair.push(sp);
        roles.push("Cunyat/da");
      }
    }
    currentUnits.push({ members: pair, roles });
  });
  // Germans de la parella (cunyats)
  if (spouse) {
    const inLaws = people.filter(
      (c) =>
        c.id !== spouse.id &&
        ((spouse.fatherId && c.fatherId === spouse.fatherId) ||
          (spouse.motherId && c.motherId === spouse.motherId))
    );
    inLaws.forEach((s) => {
      if (used.has(s.id)) return;
      const pair = [s];
      const roles = ["Cunyat/da"];
      mark(s);
      if (s.spouseId) {
        const sp = get(s.spouseId);
        if (sp && mark(sp)) {
          pair.push(sp);
          roles.push("Parella");
        }
      }
      currentUnits.push({ members: pair, roles });
    });
  }
  if (currentUnits.length) gens.push({ label: "La meva generació", units: currentUnits });

  // —— Fills ——
  let kids = childrenOf(me.id);
  if (spouse) {
    childrenOf(spouse.id).forEach((c) => {
      if (!kids.find((k) => k.id === c.id)) kids.push(c);
    });
  }
  kids = kids.filter((k) => mark(k) || !used.has(k.id));
  kids.forEach((k) => mark(k));
  if (kids.length) {
    const units = kids.map((k) => {
      const pair = [k];
      const roles = ["Fill/a"];
      if (k.spouseId) {
        const sp = get(k.spouseId);
        if (sp && mark(sp)) {
          pair.push(sp);
          roles.push("Gendre/Nora");
        }
      }
      return { members: pair, roles };
    });
    gens.push({ label: "Fills", units });
  }

  // —— Néts ——
  const grandkids = [];
  kids.forEach((k) => {
    childrenOf(k.id).forEach((g) => {
      if (!used.has(g.id)) {
        grandkids.push(g);
        mark(g);
      }
    });
  });
  if (grandkids.length) {
    gens.push({
      label: "Néts",
      units: grandkids.map((g) => ({ members: [g], roles: ["Nét/a"] })),
    });
  }

  // —— Resta (no encaixats) ——
  const rest = people.filter((p) => !used.has(p.id));
  if (rest.length) {
    gens.push({
      label: "Altres",
      units: rest.map((p) => {
        mark(p);
        const pair = [p];
        if (p.spouseId) {
          const s = get(p.spouseId);
          if (s && !used.has(s.id)) {
            pair.push(s);
            mark(s);
          }
        }
        return { members: pair, roles: pair.map(() => "") };
      }),
    });
  }

  return gens;
}

function makeCard(p, role) {
  const el = document.createElement("div");
  let cls = `person ${p.gender || "unknown"}`;
  if (dead(p)) cls += " dead";
  if (p.id === meId) cls += " me";
  el.className = cls;
  el.dataset.id = p.id;
  el.innerHTML = `
    <div class="pname">${esc(p.name)}</div>
    <div class="pyears">${years(p)}</div>
    ${role ? `<div class="prole">${esc(role)}</div>` : ""}
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    showMenu(p.id, e.clientX, e.clientY);
  });
  return el;
}

function renderTree() {
  treeCanvas.innerHTML = "";
  treeCanvas.style.transform = `scale(${scale})`;

  if (!people.length) {
    treeCanvas.innerHTML = `<p class="empty-state">Afegeix la primera persona més avall.<br>Després tria “Jo sóc” per veure tot l’arbre.</p>`;
    return;
  }

  if (!meId || !get(meId)) meId = people[0].id;

  const me = get(meId);
  const gens = buildGenerations(me);

  gens.forEach((g, gi) => {
    if (gi > 0) {
      const conn = document.createElement("div");
      conn.className = "gen-connector";
      treeCanvas.appendChild(conn);
    }
    const block = document.createElement("div");
    block.className = "gen-block";
    const label = document.createElement("div");
    label.className = "gen-label";
    label.textContent = g.label;
    block.appendChild(label);

    const row = document.createElement("div");
    row.className = "gen-row";

    g.units.forEach((u) => {
      const unit = document.createElement("div");
      unit.className = "unit";
      const pair = document.createElement("div");
      pair.className = "pair";
      u.members.forEach((p, i) => {
        if (i > 0) {
          const link = document.createElement("div");
          link.className = "pair-link";
          link.title = "Parella";
          pair.appendChild(link);
        }
        const role = u.roles?.[i] || "";
        pair.appendChild(makeCard(p, role));
      });
      unit.appendChild(pair);
      row.appendChild(unit);
    });

    block.appendChild(row);
    treeCanvas.appendChild(block);
  });
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
      if (p.id === meId) li.classList.add("active");
      li.innerHTML = `<span class="name">${esc(p.name)}${dead(p) ? " †" : ""}</span>
        <span class="actions">
          <button data-menu="${p.id}" title="Menú">⋮</button>
          <button data-edit="${p.id}" title="Editar">✏️</button>
        </span>`;
      li.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        meId = p.id;
        save();
        render();
      });
      peopleList.appendChild(li);
    });
}

function fillSelect() {
  rootSelect.innerHTML =
    `<option value="">— Tria’t a tu —</option>` +
    people
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "ca"))
      .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
      .join("");
  if (meId) rootSelect.value = meId;
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
    if (!meId) meId = id;
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
  meId = rootSelect.value || people[0]?.id || null;
  save();
  render();
});

$("zoom-in").onclick = () => {
  scale = Math.min(1.6, scale + 0.12);
  treeCanvas.style.transform = `scale(${scale})`;
};
$("zoom-out").onclick = () => {
  scale = Math.max(0.55, scale - 0.12);
  treeCanvas.style.transform = `scale(${scale})`;
};
$("zoom-reset").onclick = () => {
  scale = 1;
  treeCanvas.style.transform = `scale(1)`;
};

exportBtn.onclick = () => {
  const blob = new Blob([JSON.stringify({ people, meId }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `familia-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
};
importBtn.onclick = () => importFile.click();
importFile.onchange = () => {
  const f = importFile.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (Array.isArray(data)) {
        people = data;
        meId = people[0]?.id || null;
      } else {
        people = data.people || [];
        meId = data.meId || people[0]?.id || null;
      }
      save();
      render();
      alert("Importat");
    } catch (err) {
      alert("Error: " + err.message);
    }
    importFile.value = "";
  };
  r.readAsText(f);
};
clearBtn.onclick = () => {
  if (!confirm("Esborrar TOT?")) return;
  people = [];
  meId = null;
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
