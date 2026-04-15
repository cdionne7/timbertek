# Stow Barn Remodel — Project Plan

A client-safe, public-facing project plan and schedule for the **Stow Barn Remodel**, managed by **Timber Tek LLC**.

Static site — no backend, no build step. Vanilla HTML / CSS / JS.

## Local preview

Just open `index.html` in a browser, or serve the folder:

```bash
# from the repo root
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Deploy to GitHub Pages

1. Push this repo to GitHub (e.g. `cdionne7/timbertek`).
2. In the repo on GitHub: **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Set **Branch** to `main` and folder to `/ (root)`. Save.
5. Within a minute or two the site will be published at
   `https://cdionne7.github.io/timbertek/`.

### Custom domain (optional)

To publish on a Timber Tek subdomain such as `projects.timbertekllc.com`:

1. In your DNS provider, add a `CNAME` record pointing
   `projects.timbertekllc.com` → `cdionne7.github.io`.
2. In **Settings → Pages → Custom domain**, enter `projects.timbertekllc.com`
   and save. GitHub will create a `CNAME` file in the repo automatically.
3. Once DNS propagates, enable **Enforce HTTPS**.

## Updating the schedule

All schedule content lives in **`app.js`** — no HTML changes required.

- `overview` — high-level scope bullets on the Overview section
- `schedule` — array of phase objects; each has `phase`, `timeframe`,
  `categories` (array of tag names), `focus`, and `tasks`
- `scopeCategories` — cards shown in the Scope Categories section

Available category tags (must match these to pick up styling):
`Milestone`, `Structural`, `Concrete`, `Roofing`, `Exterior`, `Electrical`, `Finish`.

To add a new category tag, also add a `.tag-<Name>` rule in `styles.css`.

## Files

```
index.html    — page structure
styles.css    — theme and layout (warm neutrals, wood/slate/forest palette)
app.js        — schedule data + timeline rendering + filters
assets/       — logos or images (optional)
```

## Privacy

This site intentionally omits: client name, property address, contract/estimate
dollar amounts, permit numbers, and raw internal notes. Keep it that way when
editing.

## Contact

- Scott — scott@timbertekllc.com
- Craig — craig@timbertekllc.com
- General — build@timbertekllc.com
- Website — https://www.timbertekllc.com
