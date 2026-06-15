# apps/web — Next.js (App Router)

Den visuelle delen. Scaffoldes inn her med shadcn:

```bash
cd apps/web
bunx create-next-app@latest . --ts --app --tailwind --no-eslint --use-bun
bunx shadcn@latest init        # shadcn/ui
```

Ansvar:
- Lese fra `@qa/db` (server components) og vise prosjekter, kjøringer, sammenligning gammel/ny, oppfølging.
- Trigge nye kjøringer (skriver `run` + `enqueue` via `@qa/core` RunQueue).
- GitHub/Dependabot-synk kan ligge her som server action / route handler (kun API-kall).

Bruk `@qa/db` og `@qa/core` som workspace-avhengigheter:
```jsonc
// apps/web/package.json
"dependencies": {
  "@qa/db": "workspace:*",
  "@qa/core": "workspace:*"
}
```

Fase 1 (ingen DB ennå): la en route lese en `report.json` fra dagens
Python-validator og render sammenligningsvisningen med shadcn-komponenter.
Det gjenbruker alt vi allerede har laget, med minimal ny infra.
