import type { ChecklistDiscipline } from "@qa/db";

/**
 * Kurert beste-praksis-katalog per fagområde. Faste poster som alltid bør
 * sjekkes — også de validatoren ikke kan måle automatisk. `why`/`how` er
 * opplæringslaget (forklarer hvorfor det betyr noe og hvordan man fikser det),
 * og er det samme uansett prosjekt. State (status/ansvarlig/notat) lagres per
 * prosjekt på `key`.
 */
export interface CatalogItem {
  key: string;
  discipline: ChecklistDiscipline;
  title: string;
  why: string;
  how: string;
  ref?: { label: string; url: string };
}

const WCAG = (label: string, url: string) => ({ label, url });

export const CATALOG: CatalogItem[] = [
  /* ---------- Tilgjengelighet (WCAG) ---------- */
  {
    key: "a11y:alt-text",
    discipline: "a11y",
    title: "Alle meningsbærende bilder har alt-tekst",
    why: "Skjermlesere leser opp alt-teksten. Uten den får blinde og svaksynte ingen informasjon om bildet, og dekorative bilder må tvert imot skjules.",
    how: 'Gi informative bilder en kort, beskrivende alt-tekst. Rent dekorative bilder får tom alt (alt="") så de hoppes over.',
    ref: WCAG("WCAG 1.1.1", "https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html"),
  },
  {
    key: "a11y:contrast",
    discipline: "a11y",
    title: "Tekst har tilstrekkelig fargekontrast",
    why: "Lav kontrast gjør tekst uleselig for svaksynte og i sollys. Krav: 4.5:1 for vanlig tekst, 3:1 for stor tekst.",
    how: "Sjekk tekst mot bakgrunn med et kontrastverktøy. Vær ekstra obs på lysegrå tekst, tekst over bilder og knapper.",
    ref: WCAG("WCAG 1.4.3", "https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html"),
  },
  {
    key: "a11y:keyboard",
    discipline: "a11y",
    title: "Alt kan betjenes med tastatur",
    why: "Mange navigerer kun med tastatur. Alle lenker, knapper, skjema og menyer må kunne nås og brukes uten mus, uten at fokus blir fanget.",
    how: "Tab gjennom hele siden. Sjekk at alt interaktivt kan nås, at rekkefølgen er logisk, og at du aldri sitter fast.",
    ref: WCAG("WCAG 2.1.1", "https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html"),
  },
  {
    key: "a11y:focus-visible",
    discipline: "a11y",
    title: "Synlig fokusmarkør",
    why: "Tastaturbrukere må se hvor de er. Fjernes outline uten en synlig erstatning, blir siden umulig å navigere.",
    how: "Tab gjennom siden og sjekk at det aktive elementet alltid har en tydelig markering. Ikke skjul :focus-visible.",
    ref: WCAG("WCAG 2.4.7", "https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html"),
  },
  {
    key: "a11y:headings",
    discipline: "a11y",
    title: "Logisk overskriftsstruktur (én h1, ingen hopp)",
    why: "Skjermlesere navigerer via overskrifter. Hopp i nivåer (h2→h4) eller flere h1 gjør strukturen forvirrende.",
    how: "Bruk én h1 per side, og gå nedover i nivåer uten å hoppe over. Ikke velg overskrift kun for å få større tekst.",
    ref: WCAG(
      "WCAG 1.3.1",
      "https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html",
    ),
  },
  {
    key: "a11y:forms-labels",
    discipline: "a11y",
    title: "Alle skjemafelt har synlige ledetekster",
    why: "Uten <label> vet hverken skjermleser eller bruker hva feltet er. Placeholder alene er ikke nok — den forsvinner ved skriving.",
    how: "Knytt hver input til en <label> (eller aria-label). Vis feilmeldinger som tekst, ikke bare farge.",
    ref: WCAG(
      "WCAG 3.3.2",
      "https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html",
    ),
  },

  /* ---------- SEO ---------- */
  {
    key: "seo:title",
    discipline: "seo",
    title: "Unik, beskrivende sidetittel",
    why: "Tittelen er det viktigste enkeltsignalet til Google og det første brukeren ser i søkeresultatet og i fanen.",
    how: "Gi hver side en unik <title> på ~50–60 tegn som beskriver innholdet og inneholder de viktigste ordene først.",
  },
  {
    key: "seo:meta-description",
    discipline: "seo",
    title: "Meta-beskrivelse på alle viktige sider",
    why: "Beskrivelsen vises ofte under tittelen i søk og påvirker hvor mange som klikker, selv om den ikke rangerer direkte.",
    how: "Skriv en lokkende beskrivelse på ~120–155 tegn per side. Unngå duplikater på tvers av sider.",
  },
  {
    key: "seo:canonical",
    discipline: "seo",
    title: "Riktig canonical og én vert (www vs non-www)",
    why: "Duplikat-URL-er (www/non-www, med/uten slash) splitter rangeringssignalene. Canonical samler dem på én adresse.",
    how: "Velg én kanonisk vert og rediriger resten. Sett <link rel=canonical> til den foretrukne URL-en.",
  },
  {
    key: "seo:sitemap-robots",
    discipline: "seo",
    title: "sitemap.xml og robots.txt er på plass og korrekte",
    why: "Sitemap hjelper søkemotorer å finne alle sider; feil i robots.txt kan utilsiktet blokkere hele nettstedet.",
    how: "Sjekk at sitemap.xml lister gjeldende URL-er, og at robots.txt ikke blokkerer viktige sider eller hele siten.",
  },
  {
    key: "seo:structured-data",
    discipline: "seo",
    title: "Relevant strukturert data (schema.org)",
    why: "Strukturert data gir rike resultater (stjerner, FAQ, brødsmuler) og hjelper søkemotorer forstå innholdet.",
    how: "Legg til JSON-LD for relevante typer (Organization, Article, Product, BreadcrumbList) og valider den.",
  },

  /* ---------- Innhold ---------- */
  {
    key: "content:language",
    discipline: "content",
    title: "Korrekt og konsekvent språk",
    why: "Riktig lang-attributt styrer uttale i skjermlesere og gir riktig stavekontroll. Konsekvent tone bygger tillit.",
    how: "Sett <html lang> riktig. Korrekturles for skrivefeil og hold en konsistent tiltaleform gjennom hele siten.",
  },
  {
    key: "content:links-work",
    discipline: "content",
    title: "Ingen brutte lenker",
    why: "Døde lenker skaper blindveier, svekker tilliten og sløser med søkemotorenes crawl-budsjett.",
    how: "Gå gjennom interne og eksterne lenker. Rett opp eller fjern 404-er; rediriger flyttet innhold.",
  },
  {
    key: "content:cta",
    discipline: "content",
    title: "Tydelige kall-til-handling",
    why: "Brukeren skal alltid forstå neste steg. Vage eller manglende CTA-er gir tapte konverteringer.",
    how: "Gi hver viktig side en tydelig, handlingsrettet knapp/lenke med konkret tekst («Bestill time», ikke «Klikk her»).",
  },
  {
    key: "content:legal",
    discipline: "content",
    title: "Personvern, cookies og kontaktinfo er på plass",
    why: "Personvernerklæring, samtykke for sporing og synlig kontaktinfo er ofte lovpålagt og bygger tillit.",
    how: "Sjekk at personvernerklæring finnes, at cookie-samtykke er korrekt, og at kontaktinformasjon er lett å finne.",
  },

  /* ---------- Design ---------- */
  {
    key: "design:responsive",
    discipline: "design",
    title: "Fungerer på mobil og store skjermer",
    why: "Mesteparten av trafikken er mobil. Innhold som flyter over, bryter eller krever zoom mister brukere.",
    how: "Test på smal og bred skjerm. Sjekk at intet flyter ut, at tekst er lesbar uten zoom, og at touch-mål er store nok.",
  },
  {
    key: "design:consistency",
    discipline: "design",
    title: "Konsistent visuelt språk",
    why: "Sprikende farger, typografi og knappestiler får siten til å virke uprofesjonell og gjør den vanskeligere å bruke.",
    how: "Hold deg til designsystemet: samme avstander, farger, knapper og overskriftsstiler på tvers av sidene.",
  },
  {
    key: "design:touch-targets",
    discipline: "design",
    title: "Klikkflater er store nok",
    why: "Små eller tettpakkede knapper er vanskelige å treffe på touch og for folk med motoriske utfordringer.",
    how: "Gjør interaktive mål minst ~44×44 px med nok avstand mellom dem.",
    ref: WCAG("WCAG 2.5.8", "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html"),
  },
  {
    key: "design:empty-error-states",
    discipline: "design",
    title: "Gjennomtenkte tom- og feiltilstander",
    why: "Tomme lister, lasting og feil er en del av opplevelsen. Uten design blir de forvirrende blindveier.",
    how: "Design hva som vises ved ingen data, under lasting og ved feil — med forklaring og vei videre.",
  },

  /* ---------- Ytelse ---------- */
  {
    key: "performance:images",
    discipline: "performance",
    title: "Optimaliserte bilder (riktig format og størrelse)",
    why: "Bilder er som regel den tyngste ressursen. Overstore bilder gir treg last, særlig på mobil.",
    how: "Lever bilder i riktig visningsstørrelse, bruk moderne format (WebP/AVIF) og lazy-load det som er under skjermkanten.",
  },
  {
    key: "performance:load-time",
    discipline: "performance",
    title: "Rask lastetid (Core Web Vitals)",
    why: "Treg last øker frafall og svekker rangeringen. Google måler LCP, CLS og INP.",
    how: "Hold LCP under ~2,5 s. Reduser sidevekt, fjern ubrukt JS/CSS og unngå layout-hopp.",
    ref: WCAG("web.dev: Core Web Vitals", "https://web.dev/articles/vitals"),
  },
  {
    key: "performance:caching",
    discipline: "performance",
    title: "Caching og komprimering aktivert",
    why: "Uten caching og komprimering lastes alt på nytt hver gang, og filene er større enn nødvendig.",
    how: "Slå på gzip/brotli og fornuftige cache-headere for statiske ressurser (CDN der det er mulig).",
  },

  /* ---------- Sikkerhet ---------- */
  {
    key: "security:https",
    discipline: "security",
    title: "HTTPS overalt, uten blandet innhold",
    why: "Uten HTTPS kan trafikk avlyttes og endres. Blandet innhold (http på en https-side) blokkeres av nettleseren.",
    how: "Tving HTTPS med redirect, og sørg for at alle ressurser (bilder, skript) lastes over https.",
  },
  {
    key: "security:headers",
    discipline: "security",
    title: "Sikkerhets-headere er satt",
    why: "Headere som CSP, HSTS og X-Content-Type-Options beskytter mot vanlige angrep som XSS og clickjacking.",
    how: "Sett minst HSTS, X-Content-Type-Options og en Content-Security-Policy tilpasset siten.",
  },
  {
    key: "security:dependencies",
    discipline: "security",
    title: "Avhengigheter er oppdatert (ingen kjente sårbarheter)",
    why: "Utdaterte pakker er den vanligste angrepsvektoren. Kjente sårbarheter utnyttes raskt etter publisering.",
    how: "Følg med på Dependabot-funn (kobles til under «Funn»), og oppgrader sårbare pakker fortløpende.",
  },
];
