# Client — Note Refiner

This is the Vite + React frontend for the Note Refiner app. The UI allows pasting rough notes, refining them via the local server, and copying the cleaned bullet points.

## Development

Install dependencies and run the dev server:

```bash
cd client
npm install
npm run dev
```

The app is a small single-page interface located under `src/` — `App.tsx` contains the main UI components.

## Build

To build the static client for production:

```bash
cd client
npm run build
```

The built files will be in `client/dist` and can be served by any static file server or integrated into a backend.

## Notes

- UI files: `src/App.tsx`, `src/main.tsx`.
- Styling: `src/index.css`.
