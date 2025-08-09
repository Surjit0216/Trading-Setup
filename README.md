
# Algo Trading Dashboard (Vite + React + Tailwind + Recharts)

Live dashboard that reads your Google Sheet (UT Bot Journal) via the Google Visualization JSON endpoint
— no backend or API keys required.

## Quick Deploy on Vercel (non‑tech friendly)

1) **Download this project as ZIP** and extract it.
2) Create a **new GitHub repo**, then upload these files (drag & drop works on github.com).
3) Open **vercel.com → New Project → Import Git Repository** and select your repo.
4) Framework Preset: **Vite** (auto-detected).  
   - Install Command: `npm install`  
   - Build Command: `npm run build`  
   - Output Directory: `dist`
5) Click **Deploy**. Done 🎉

### Change your Google Sheet tab (optional)
Edit `src/config.js`:
```js
export const SHEET_ID = "YOUR_SHEET_ID";
export const GID = "YOUR_GID";
```
Make sure the sheet/tab is shared as **Anyone with the link → Viewer**.

### Local run (optional)
```bash
npm install
npm run dev
```

## Notes
- Uses only client-side fetch to: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:json&gid=<GID>`
- Charts: Recharts
- Styling: Tailwind CSS
