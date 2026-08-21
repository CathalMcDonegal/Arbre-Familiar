# 🌳 Arbre Genealògic

App web senzilla, privada i sense servidor per crear i visualitzar el teu arbre genealògic.

- ✅ 100% al navegador (les teves dades no surten del teu dispositiu)
- ✅ Desa automàticament a `localStorage`
- ✅ Afegir, editar i eliminar persones
- ✅ Definir pare, mare i cònjuge
- ✅ Visualització de l'arbre (avantpassats + descendents)
- ✅ Exportar / Importar JSON
- ✅ Funciona offline
- ✅ A punt per publicar a **GitHub Pages**

## Prova local

Obre el fitxer `index.html` al teu navegador (Chrome, Firefox, Edge, Safari…).

O serveix la carpeta amb qualsevol servidor estàtic:

```bash
# Amb Python
python -m http.server 8080

# Amb Node (si tens npx)
npx serve .
```

Després ves a `http://localhost:8080`

## Com pujar-la a GitHub i publicar-la

### 1. Crea un repositori nou a GitHub

1. Ves a [https://github.com/new](https://github.com/new)
2. Nom suggerit: `arbre-genealogic` o `la-meva-familia`
3. Tria **Public**
4. **No** marquís “Add a README” (ja en tenim un)
5. Prem **Create repository**

### 2. Puja els fitxers

Al teu ordinador, obre un terminal a la carpeta d’aquest projecte i executa:

```bash
git init
git add .
git commit -m "Primera versió de l'Arbre Genealògic"
git branch -M main
git remote add origin https://github.com/EL-TEU-USUARI/arbre-genealogic.git
git push -u origin main
```

(Substitueix `EL-TEU-USUARI` pel teu nom d’usuari de GitHub)

### 3. Activa GitHub Pages

1. Al teu repositori ves a **Settings → Pages**
2. A **Source** tria **Deploy from a branch**
3. Branch: `main` · carpeta: `/ (root)`
4. Desa

En 1-2 minuts la teva app estarà disponible a:

```
https://EL-TEU-USUARI.github.io/arbre-genealogic/
```

## Com utilitzar l’app

1. **Afegir persones**: omple el formulari de l’esquerra i prem “Desar persona”.
2. **Editar**: fes clic al llapis ✏️ de la llista.
3. **Relacions**: fes clic a 🔗 per assignar pare, mare i cònjuge.
4. **Veure l’arbre**: al desplegable “Centrar a” tria una persona.
5. **Exportar**: descarrega un fitxer JSON per fer còpia de seguretat o moure les dades a un altre navegador.
6. **Importar**: carrega un JSON exportat prèviament.

## Estructura del projecte

```
arbre-genealogic/
├── index.html      # Pàgina principal
├── style.css       # Estils
├── app.js          # Lògica de l’aplicació
└── README.md       # Aquest fitxer
```

## Format de les dades (JSON)

Cada persona té aquesta estructura:

```json
{
  "id": "identificador-unic",
  "name": "Nom Complet",
  "birth": 1950,
  "death": null,
  "gender": "female",
  "notes": "Notes opcionals",
  "fatherId": "id-del-pare-o-null",
  "motherId": "id-de-la-mare-o-null",
  "spouseId": "id-del-conjuje-o-null"
}
```

## Llicència

MIT – Usa-la, modifica-la i comparteix-la lliurement.

---

Fet amb ❤️ perquè qualsevol pugui preservar la seva història familiar.
