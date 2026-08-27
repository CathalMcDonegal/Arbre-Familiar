/**
 * Arbre genealògic – targetes amb color per sexe + estil pergamí
 * Generacions + línies de parentiu
 * Dades preservades entre actualitzacions
 */
const STORAGE_KEY = "arbre-genealogic-data";
const OLD_KEYS = [
  "arbre-genealogic-v5", "arbre-genealogic-v4", "arbre-genealogic-v3",
  "arbre-genealogic-v2", "arbre-genealogic-v1", "arbol-genealogico-v1",
];

const GEN_NAMES = {
  "-4": "Rebesavis",
  "-3": "Besavis",
  "-2": "Avis",
  "-1": "Pares / Sogres",
  "0": "La meva generació",
  "1": "Fills",
  "2": "Néts",
  "3": "Besnéts",
};

let people = [];
let meId = null;
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
function normalize(p) {
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (Array.isArray(d)) {
        people = d.map(normalize);
        meId = people[0]?.id || null;
        return;
      }
      if (d?.people) {
        people = d.people.map(normalize);
        meId = d.meId || d.focusId || people[0]?.id || null;
        return;
      }
    }
  } catch (_) {}
  for (const key of OLD_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const d = JSON.parse(raw);
      const list = Array.isArray(d) ? d : d?.people;
      if (list?.length) {
        people = list.map(normalize);
        meId = (!Array.isArray(d) && (d.meId || d.focusId)) || people[0]?.id || null;
        save();
        return;
      }
    } catch (_) {}
  }
  people = [];
  meId = null;
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
  const s = new Set(ids.filter(Boolean));
  return people.filter((p) => s.has(p.fatherId) || s.has(p.motherId));
}

function promptPerson(label, defG) {
  const name = prompt(`Nom (${label}):`);
  if (!name?.trim()) return null;
  const gIn = (prompt("Gènere: d=dona, h=home", "") || "").toLowerCase();
  let gender = defG || "unknown";
  if (gIn.startsWith("d")) gender = "female";
  else if (gIn.startsWith("h")) gender = "male";
  else if (gIn.startsWith("a")) gender = "other";
  else if (!defG) gender = "unknown";
  const p = {
    id: uid(), name: name.trim(), birth: null, death: null,
    gender, notes: "", fatherId: null, motherId: null, spouseId: null,
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
  if (!p || p.fatherId) return p?.fatherId && alert("Ja té pare.");
  const n = promptPerson("pare", "male");
  if (!n) return;
  p.fatherId = n.id;
  if (p.motherId) {
    const m = get(p.motherId);
    if (m && !m.spouseId) linkSpouse(n, m);
  }
  save(); render();
}
function addMother(id) {
  const p = get(id);
  if (!p || p.motherId) return p?.motherId && alert("Ja té mare.");
  const n = promptPerson("mare", "female");
  if (!n) return;
  p.motherId = n.id;
  if (p.fatherId) {
    const f = get(p.fatherId);
    if (f && !f.spouseId) linkSpouse(n, f);
  }
  save(); render();
}
function addSibling(id) {
  const p = get(id);
  if (!p) return;
  if (!p.fatherId && !p.motherId) return alert("Primer afegeix pare o mare.");
  const n = promptPerson("germà/germana");
  if (!n) return;
  n.fatherId = p.fatherId;
  n.motherId = p.motherId;
  save(); render();
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
  save(); render();
}
function addSpouse(id) {
  const p = get(id);
  if (!p || p.spouseId) return p?.spouseId && alert("Ja té parella.");
  const def = p.gender === "male" ? "female" : p.gender === "female" ? "male" : null;
  const n = promptPerson("parella", def);
  if (!n) return;
  linkSpouse(p, n);
  save(); render();
}

function showMenu(id, x, y) {
  menuPersonId = id;
  personMenu.classList.add("open");
  let left = x, top = y;
  if (left + 200 > innerWidth) left = innerWidth - 208;
  if (top + 300 > innerHeight) top = innerHeight - 308;
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
  const a = b.dataset.a, id = menuPersonId;
  hideMenu();
  if (a === "father") addFather(id);
  else if (a === "mother") addMother(id);
  else if (a === "sibling") addSibling(id);
  else if (a === "child") addChild(id);
  else if (a === "spouse") addSpouse(id);
  else if (a === "edit") startEdit(id);
  else if (a === "me") { meId = id; save(); render(); }
  else if (a === "del") {
    const p = get(id);
    if (!p || !confirm(`Eliminar ${p.name}?`)) return;
    people.forEach((o) => {
      if (o.fatherId === id) o.fatherId = null;
      if (o.motherId === id) o.motherId = null;
      if (o.spouseId === id) o.spouseId = null;
    });
    people = people.filter((x) => x.id !== id);
    if (meId === id) meId = people[0]?.id || null;
    save(); render();
  }
});
document.addEventListener("click", (e) => {
  if (!personMenu.contains(e.target) && !e.target.closest(".person")) hideMenu();
});

function assignGenerations(me) {
  const gen = new Map();
  const queue = [[me.id, 0]];
  gen.set(me.id, 0);

  while (queue.length) {
    const [id, g] = queue.shift();
    const p = get(id);
    if (!p) continue;
    [p.fatherId, p.motherId].forEach((pid) => {
      if (pid && !gen.has(pid)) {
        gen.set(pid, g - 1);
        queue.push([pid, g - 1]);
      }
    });
    if (p.spouseId && !gen.has(p.spouseId)) {
      gen.set(p.spouseId, g);
      queue.push([p.spouseId, g]);
    }
    childrenOf(id).forEach((c) => {
      if (!gen.has(c.id)) {
        gen.set(c.id, g + 1);
        queue.push([c.id, g + 1]);
      }
    });
  }

  const spouse = me.spouseId ? get(me.spouseId) : null;
  if (spouse) {
    [spouse.fatherId, spouse.motherId].forEach((pid) => {
      if (pid && !gen.has(pid)) {
        gen.set(pid, -1);
        const climb = (id, g) => {
          const x = get(id);
          if (!x) return;
          [x.fatherId, x.motherId].forEach((pp) => {
            if (pp && !gen.has(pp)) {
              gen.set(pp, g - 1);
              climb(pp, g - 1);
            }
          });
        };
        climb(pid, -1);
      }
    });
    childrenOf(spouse.fatherId, spouse.motherId).forEach((c) => {
      if (!gen.has(c.id)) gen.set(c.id, 0);
      if (c.spouseId && !gen.has(c.spouseId)) gen.set(c.spouseId, 0);
    });
  }
  childrenOf(me.fatherId, me.motherId).forEach((c) => {
    if (!gen.has(c.id)) gen.set(c.id, 0);
    if (c.spouseId && !gen.has(c.spouseId)) gen.set(c.spouseId, 0);
  });

  people.forEach((p) => {
    if (gen.has(p.id)) return;
    const kids = childrenOf(p.id);
    for (const k of kids) {
      if (gen.has(k.id)) {
        gen.set(p.id, gen.get(k.id) - 1);
        return;
      }
    }
    if (p.fatherId && gen.has(p.fatherId)) gen.set(p.id, gen.get(p.fatherId) + 1);
    else if (p.motherId && gen.has(p.motherId)) gen.set(p.id, gen.get(p.motherId) + 1);
    else if (p.spouseId && gen.has(p.spouseId)) gen.set(p.id, gen.get(p.spouseId));
    else gen.set(p.id, 99);
  });

  return gen;
}

/** Targeta amb color segons sexe (com abans) */
function makeCard(p) {
  const el = document.createElement("div");
  let cls = `person ${p.gender || "unknown"}`;
  if (isDead(p)) cls += " dead";
  if (p.id === meId) cls += " focus";
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

function buildFamilyUnit(person, spouse, childList, used) {
  const unit = document.createElement("div");
  unit.className = "unit";

  const couple = document.createElement("div");
  couple.className = "couple-box";

  let left = person, right = spouse;
  if (spouse && person.gender === "female" && spouse.gender === "male") {
    left = spouse;
    right = person;
  }
  couple.appendChild(makeCard(left));
  used.add(left.id);
  if (right) {
    const rel = document.createElement("div");
    rel.className = "rel-line";
    rel.title = "Línia de relació";
    couple.appendChild(rel);
    couple.appendChild(makeCard(right));
    used.add(right.id);
  }
  unit.appendChild(couple);

  const kids = (childList || []).filter((c) => !used.has(c.id));
  kids.sort((a, b) => {
    if (a.birth && b.birth) return a.birth - b.birth;
    if (a.birth) return -1;
    if (b.birth) return 1;
    return a.name.localeCompare(b.name, "ca");
  });

  if (kids.length) {
    const des = document.createElement("div");
    des.className = "des-area";
    const stem = document.createElement("div");
    stem.className = "des-stem";
    stem.title = "Línia de descendència";
    des.appendChild(stem);

    const row = document.createElement("div");
    row.className = "kids-row";

    kids.forEach((k) => {
      used.add(k.id);
      const col = document.createElement("div");
      col.className = "kid-col";
      const ind = document.createElement("div");
      ind.className = "ind-stem";
      ind.title = "Línia individual";
      col.appendChild(ind);

      const kSpouse = k.spouseId ? get(k.spouseId) : null;
      if (kSpouse && !used.has(kSpouse.id)) {
        const mini = document.createElement("div");
        mini.className = "couple-box";
        let L = k, R = kSpouse;
        if (k.gender === "female" && kSpouse.gender === "male") {
          L = kSpouse; R = k;
        }
        mini.appendChild(makeCard(L));
        used.add(L.id);
        const rl = document.createElement("div");
        rl.className = "rel-line";
        mini.appendChild(rl);
        mini.appendChild(makeCard(R));
        used.add(R.id);
        col.appendChild(mini);
      } else {
        col.appendChild(makeCard(k));
      }
      row.appendChild(col);
    });

    des.appendChild(row);
    unit.appendChild(des);

    requestAnimationFrame(() => {
      if (row.children.length < 2) return;
      const first = row.children[0];
      const last = row.children[row.children.length - 1];
      const rowR = row.getBoundingClientRect();
      const fR = first.getBoundingClientRect();
      const lR = last.getBoundingClientRect();
      const bar = document.createElement("div");
      bar.className = "sib-bar";
      bar.title = "Línia de germandat";
      const leftPx = fR.left + fR.width / 2 - rowR.left;
      const rightPx = lR.left + lR.width / 2 - rowR.left;
      bar.style.width = Math.max(0, rightPx - leftPx) + "px";
      bar.style.marginLeft = leftPx + "px";
      des.insertBefore(bar, row);
    });
  }

  return unit;
}

function renderTree() {
  treeCanvas.innerHTML = "";
  treeCanvas.style.transform = `scale(${scale})`;

  if (!people.length) {
    treeCanvas.innerHTML = `<p class="empty-state">Afegeix persones i tria “Jo sóc”.</p>`;
    return;
  }
  if (!meId || !get(meId)) meId = people[0].id;
  const me = get(meId);
  const genMap = assignGenerations(me);

  const byGen = new Map();
  people.forEach((p) => {
    const g = genMap.get(p.id) ?? 99;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g).push(p);
  });

  const levels = [...byGen.keys()].sort((a, b) => a - b);
  const used = new Set();

  levels.forEach((gNum) => {
    const members = byGen.get(gNum).filter((p) => !used.has(p.id));
    if (!members.length) return;

    const row = document.createElement("div");
    row.className = "gen-row";

    const label = document.createElement("div");
    label.className = "gen-label";
    label.textContent = GEN_NAMES[String(gNum)] || (gNum === 99 ? "Altres" : `Gen. ${gNum}`);
    row.appendChild(label);

    const content = document.createElement("div");
    content.className = "gen-content";

    const localUsed = new Set();
    members.forEach((p) => {
      if (used.has(p.id) || localUsed.has(p.id)) return;
      const sp = p.spouseId ? get(p.spouseId) : null;
      const spSame = sp && (genMap.get(sp.id) === gNum || genMap.get(sp.id) === undefined);
      const kids = childrenOf(p.id, spSame ? sp.id : null).filter(
        (c) => (genMap.get(c.id) ?? 99) === gNum + 1
      );

      if (spSame && sp) {
        localUsed.add(p.id);
        localUsed.add(sp.id);
        content.appendChild(buildFamilyUnit(p, sp, kids, used));
      } else {
        localUsed.add(p.id);
        content.appendChild(buildFamilyUnit(p, null, kids, used));
      }
    });

    row.appendChild(content);
    treeCanvas.appendChild(row);

    if (gNum !== levels[levels.length - 1]) {
      const sp = document.createElement("div");
      sp.className = "gen-spacer";
      treeCanvas.appendChild(sp);
    }
  });
}

function renderList(filter = "") {
  const q = filter.trim().toLowerCase();
  const list = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
  peopleCount.textContent = people.length;
  peopleList.innerHTML = "";
  if (!list.length) {
    peopleList.innerHTML = `<li style="color:var(--ink-soft);cursor:default">Cap persona</li>`;
    return;
  }
  list.slice().sort((a, b) => a.name.localeCompare(b.name, "ca")).forEach((p) => {
    const li = document.createElement("li");
    if (p.id === meId) li.classList.add("active");
    li.innerHTML = `<span class="name">${esc(p.name)}${isDead(p) ? " †" : ""}</span>
      <span class="actions">
        <button data-menu="${p.id}">⋮</button>
        <button data-edit="${p.id}">✏️</button>
      </span>`;
    li.onclick = (e) => {
      if (e.target.closest("button")) return;
      meId = p.id; save(); render();
    };
    peopleList.appendChild(li);
  });
}
function fillSelect() {
  rootSelect.innerHTML =
    `<option value="">— Tria’t a tu —</option>` +
    people.slice().sort((a, b) => a.name.localeCompare(b.name, "ca"))
      .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
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
    fatherId: null, motherId: null, spouseId: null,
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
  save(); resetForm(); render();
});
cancelBtn.onclick = resetForm;

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
searchInput.oninput = () => renderList(searchInput.value);
rootSelect.onchange = () => {
  meId = rootSelect.value || people[0]?.id || null;
  save(); render();
};

$("zoom-in").onclick = () => { scale = Math.min(1.5, scale + 0.1); treeCanvas.style.transform = `scale(${scale})`; };
$("zoom-out").onclick = () => { scale = Math.max(0.5, scale - 0.1); treeCanvas.style.transform = `scale(${scale})`; };
$("zoom-reset").onclick = () => { scale = 1; treeCanvas.style.transform = `scale(1)`; };

$("export-btn").onclick = () => {
  const blob = new Blob([JSON.stringify({ people, meId }, null, 2)], { type: "application/json" });
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
      const d = JSON.parse(r.result);
      people = (Array.isArray(d) ? d : d.people || []).map(normalize);
      meId = Array.isArray(d) ? people[0]?.id : d.meId || d.focusId || people[0]?.id;
      save(); render();
      alert("Importat");
    } catch (err) {
      alert("Error: " + err.message);
    }
    $("import-file").value = "";
  };
  r.readAsText(f);
};
$("clear-btn").onclick = () => {
  if (!confirm("Esborrar TOT?")) return;
  people = []; meId = null; save(); render();
};

function render() {
  renderList(searchInput.value);
  fillSelect();
  renderTree();
}
load();
render();
