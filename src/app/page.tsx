"use client";

import { useEffect, useState, type FormEvent } from "react";
import { parseMarketplaceText } from "@/lib/parse-marketplace";
import { compareListing, effectiveAveragePrice, estimatePrice, expirationAt, isEnded, isNightExpiration, isValidRarity, matchesCardSearch, normalizeName, normalizeRarity, priceKey } from "@/lib/deals";
import { compareSortValues, nextSort, type Sort } from "@/lib/sort";
import { normalizeKeyword } from "@/lib/keywords";
import { PriceHistory } from "./price-history";
import type { AveragePrice, ExtractedCard, Keyword, PriceSummary, TrackedPrice } from "@/lib/types";

type PricesState =
  | { status: "ready"; prices: AveragePrice[] }
  | { status: "error"; message: string };

type ListingColumn = "name" | "rarity" | "price" | "kind" | "manual" | "average" | "comparison" | "alerts" | "duration";
type PriceColumn = "name" | "rarity" | "manual" | "reference";

type ListingRow = {
  card: ExtractedCard;
  average: number | null;
  manual: number | null;
  summary: PriceSummary | undefined;
  estimate: ReturnType<typeof estimatePrice>;
  expiration: Date | null;
  comparison: ReturnType<typeof compareListing>;
  night: boolean;
};

function listingSortValue(row: ListingRow, column: ListingColumn): string | number | null {
  switch (column) {
    case "name": return row.card.cardName.trim() || null;
    case "rarity": return normalizeRarity(row.card.cardType ?? "") || null;
    case "price": return row.card[row.card.bidKind];
    case "kind": return row.card.bidKind === "currentPrice" ? "Actuelle" : "Départ";
    case "manual": return row.manual;
    case "average": return row.average;
    case "comparison": return row.comparison ? -row.comparison.discount : null;
    case "alerts": return row.night ? 1 : null;
    case "duration": return expirationAt(0, row.card.remainingTime)?.getTime() ?? null;
  }
}

function SortHeader<Column extends string>({ label, column, sort, onSort }: {
  label: string;
  column: Column;
  sort: Sort<Column> | null;
  onSort: (column: Column) => void;
}) {
  const direction = sort?.column === column ? sort.direction : undefined;
  return <th scope="col" aria-sort={direction}>
    <button className="sort-button" type="button" onClick={() => onSort(column)}>
      {label}<span aria-hidden="true">{direction === "ascending" ? " ↑" : direction === "descending" ? " ↓" : " ↕"}</span>
    </button>
  </th>;
}

function rarityClass(rarity: string | null): string {
  const normalized = normalizeRarity(rarity ?? "");
  return normalized === "L✦" ? "rarity-L-shiny" : isValidRarity(normalized) ? `rarity-${normalized}` : "";
}

type DataStatus = "ready" | "loading" | "error";

function ReferencePrice({ estimate, manual, summary, available, manualStatus, observationStatus }: {
  estimate: ReturnType<typeof estimatePrice>;
  manual: number | null;
  summary: PriceSummary | undefined;
  available: boolean;
  manualStatus: DataStatus;
  observationStatus: DataStatus;
}) {
  const statusText = (status: DataStatus) =>
    status === "loading" ? "Chargement…" : "Indisponible";
  const manualText = manualStatus === "ready" ? manual === null ? "—" : manual.toLocaleString("fr-FR") : statusText(manualStatus);
  const observations = observationStatus !== "ready" ? statusText(observationStatus)
    : estimate.market === null ? `— (${summary?.sample_count ?? 0}/5)`
    : `${estimate.market.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} (${summary?.sample_count ?? 0} obs.)`;
  return <>
    {available && estimate.value !== null
      ? <><strong>{estimate.value.toLocaleString("fr-FR")}</strong><span className="default-price-note">{estimate.source}{estimate.quality ? ` · fiabilité indicative ${estimate.quality}` : ""}</span></>
      : <span className="muted">{available ? "Estimation indisponible"
        : manualStatus === "loading" || observationStatus === "loading" ? "Chargement…" : "Prix indisponible"}</span>}
    <span className="default-price-note">Manuel : {manualText}</span>
    <span className="default-price-note">Observations : {observations}</span>
  </>;
}

function CopyNameButton({ name, label = "nom" }: { name: string; label?: string }) {
  const [feedback, setFeedback] = useState<{ name: string; success: boolean } | null>(null);
  const visibleFeedback = feedback?.name === name ? feedback : null;

  async function copyName() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(name);
      setFeedback({ name, success: true });
    } catch {
      setFeedback({ name, success: false });
    }
  }

  return <span className="copy-control">
    <button className="copy-button" type="button" disabled={!name.trim()}
      aria-label={`Copier le ${label} ${name || "de la carte"}`} onClick={() => void copyName()}>
      {visibleFeedback?.success ? "Copié" : "Copier"}
    </button>
    <span role="status" className={visibleFeedback && !visibleFeedback.success ? "copy-error" : "sr-only"}>
      {visibleFeedback ? visibleFeedback.success ? `${label === "nom" ? "Nom" : "Mot-clé"} copié.` : "Copie impossible. Vérifiez les autorisations du navigateur." : ""}
    </span>
  </span>;
}

function Keywords() {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ revision: number; keywords: Keyword[]; error: string | null } | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const current = state?.revision === revision ? state : null;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/keywords", { cache: "no-store" });
        const result: { keywords?: Keyword[]; error?: string } = await response.json();
        if (!response.ok || !result.keywords) throw new Error(result.error || "Impossible de charger les mots-clés.");
        if (active) setState({ revision, keywords: result.keywords, error: null });
      } catch (error) {
        if (active) setState({
          revision, keywords: [], error: error instanceof Error ? error.message : "Impossible de charger les mots-clés.",
        });
      }
    })();
    return () => { active = false; };
  }, [revision]);

  async function addKeyword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !current || current.error) return;
    const keyword = normalizeKeyword(value);
    if (!keyword) {
      setMessage("Saisissez un mot-clé sur une ligne (200 caractères maximum).");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: keyword }),
      });
      const result: { keyword?: Keyword; error?: string } = await response.json();
      if (!response.ok || !result.keyword) throw new Error(result.error || "Impossible d’ajouter le mot-clé.");
      const saved = result.keyword;
      setState((previous) => previous ? { ...previous, keywords: [saved, ...previous.keywords] } : previous);
      setValue("");
      setMessage("Mot-clé ajouté à la liste partagée.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible d’ajouter le mot-clé.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="saved-section" aria-labelledby="keywords-heading">
    <div className="section-heading">
      <div><h1 id="keywords-heading">Mots-clés</h1><p>Une liste partagée pour tout le groupe. Un mot-clé peut contenir plusieurs mots.</p></div>
      <button className="copy-button" type="button" disabled={!current || saving}
        onClick={() => setRevision((previous) => previous + 1)}>Actualiser</button>
    </div>
    <form className="signin-form keyword-form" onSubmit={(event) => void addKeyword(event)}>
      <label className="sr-only" htmlFor="keyword-input">Mot-clé à ajouter</label>
      <input id="keyword-input" value={value} onChange={(event) => setValue(event.target.value)}
        placeholder="Saisissez un ou plusieurs mots" required />
      <button className="primary-button" type="submit" disabled={!current || Boolean(current.error) || saving}>
        {saving ? "Ajout…" : "Ajouter"}
      </button>
    </form>
    {message && <p className="notice" role="status">{message}</p>}
    {!current ? <p className="notice" role="status">Chargement des mots-clés…</p>
      : current.error ? <p className="notice error" role="alert">{current.error}</p>
      : current.keywords.length === 0 ? <div className="empty-state keyword-list">Aucun mot-clé pour le moment.</div>
      : <ul className="keyword-list">{current.keywords.map((keyword) =>
        <li key={keyword.id}><span>{keyword.value}</span><CopyNameButton name={keyword.value} label="mot-clé" /></li>
      )}</ul>}
  </section>;
}

export default function Home() {
  const [authorized, setAuthorized] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [text, setText] = useState("");
  const [cards, setCards] = useState<ExtractedCard[]>([]);
  const [activeTab, setActiveTab] = useState<"annonces" | "prices" | "keywords">("annonces");
  const [listingSort, setListingSort] = useState<Sort<ListingColumn> | null>(null);
  const [dealsOnly, setDealsOnly] = useState(false);
  const [priceSort, setPriceSort] = useState<Sort<PriceColumn> | null>(null);
  const [trackingSearch, setTrackingSearch] = useState("");
  const [textPastedAt, setTextPastedAt] = useState<number | null>(null);
  const [cardsPastedAt, setCardsPastedAt] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [pricesState, setPricesState] = useState<PricesState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [priceMessage, setPriceMessage] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [historyState, setHistoryState] = useState<{
    query: string; revision: number;
    summaries: PriceSummary[]; error: string | null;
  } | null>(null);
  const [trackedState, setTrackedState] = useState<{
    revision: number; retry: number;
    tracked: TrackedPrice[]; error: string | null;
  } | null>(null);
  const [trackingRetry, setTrackingRetry] = useState(0);
  const [selectedCard, setSelectedCard] = useState<{ name: string; rarity: string } | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/access").then(async (response) => {
      const result: { authorized?: boolean; error?: string } = await response.json();
      if (!response.ok || result.authorized === undefined) {
        throw new Error(result.error || "Impossible de vérifier l’accès partagé.");
      }
      if (active) {
        setAuthorized(result.authorized);
        setAuthReady(true);
      }
    }).catch((error: unknown) => {
      if (!active) return;
      setAuthMessage(error instanceof Error ? error.message : "Impossible de vérifier l’accès partagé.");
      setAuthReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/average-prices");
        const result: { prices?: AveragePrice[]; error?: string } = await response.json();
        if (!response.ok || !result.prices) {
          throw new Error(result.error || "Impossible de charger les prix moyens.");
        }
        if (active) setPricesState({ status: "ready", prices: result.prices });
      } catch (error) {
        if (active) setPricesState({
          status: "error",
          message: error instanceof Error ? error.message : "Impossible de charger les prix moyens.",
        });
      }
    })();
    return () => { active = false; };
  }, [authorized]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result: { authorized?: boolean; error?: string } = await response.json();
      if (!response.ok || !result.authorized) {
        throw new Error(result.error || "Impossible d’ouvrir l’accès partagé.");
      }
      setAuthorized(true);
      setPassword("");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Impossible d’ouvrir l’accès partagé.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      const response = await fetch("/api/access", { method: "DELETE" });
      const result: { authorized?: boolean; error?: string } = await response.json();
      if (!response.ok || result.authorized !== false) {
        throw new Error(result.error || "Impossible de verrouiller l’accès.");
      }
      setAuthorized(false);
      setPricesState(null);
      setHistoryState(null);
      setTrackedState(null);
      setSelectedCard(null);
      setDrafts({});
      setPriceMessage("");
      setAuthMessage("");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Impossible de verrouiller l’accès.");
    }
  }

  async function handleAnalyze() {
    const result = parseMarketplaceText(text);
    setCards(result.cards.map((card) => ({ ...card, id: crypto.randomUUID() })));
    setCardsPastedAt(textPastedAt);
    setNotice([
      result.cards.length ? `${result.cards.length} annonce(s) détectée(s).` : "",
      ...result.warnings,
    ].filter(Boolean).join(" "));
    setHistoryMessage("");
    if (!result.cards.length) return;
    if (!authorized) {
      setHistoryMessage("Déverrouillez l’accès pour enregistrer les mises actuelles dans l’historique partagé.");
      return;
    }
    setRecording(true);
    try {
      const response = await fetch("/api/price-observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record", text, pastedAt: textPastedAt }),
      });
      const saved: { inserted?: number; updated?: number; unmatched?: number; duplicate?: boolean; error?: string } = await response.json();
      if (!response.ok || saved.inserted === undefined || saved.updated === undefined ||
          saved.unmatched === undefined || saved.duplicate === undefined) {
        throw new Error(saved.error || "Impossible d’enregistrer les observations.");
      }
      setHistoryMessage(saved.duplicate ? "Import identique déjà enregistré." :
        `${saved.inserted} mise(s) ajoutée(s), ${saved.updated} mise(s) mise(s) à jour.${saved.unmatched ? ` ${saved.unmatched} annonce(s) sans vendeur ou heure d’expiration fiable ne peuvent pas être rapprochées.` : ""} Les annonces incertaines et les mises de départ sont exclues.`);
      setHistoryRevision((revision) => revision + 1);
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : "Impossible d’enregistrer les observations.");
    } finally {
      setRecording(false);
    }
  }

  const currentState = authorized ? pricesState : null;
  const prices = currentState?.status === "ready" ? currentState.prices : [];
  const priceMap = new Map(prices.map((price) => [priceKey(price.card_name, price.card_type), price]));
  const loadingPrices = Boolean(authorized && !currentState);
  const historyQuery = JSON.stringify(cards.map((card) => ({ name: card.cardName, rarity: card.cardType ?? "" })));
  useEffect(() => {
    if (!authorized || historyQuery === "[]") return;
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/price-observations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "lookup", keys: JSON.parse(historyQuery) }),
          });
          const result: { summaries?: PriceSummary[]; error?: string } = await response.json();
          if (!response.ok || !result.summaries) throw new Error(result.error || "Impossible de charger l’historique des prix.");
          if (active) setHistoryState({ query: historyQuery, revision: historyRevision, summaries: result.summaries, error: null });
        } catch (error) {
          if (active) setHistoryState({
            query: historyQuery, revision: historyRevision, summaries: [],
            error: error instanceof Error ? error.message : "Impossible de charger l’historique des prix.",
          });
        }
      })();
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [authorized, historyQuery, historyRevision]);
  const currentHistory = authorized && historyState?.query === historyQuery && historyState.revision === historyRevision
    ? historyState : null;
  const summaries = new Map((currentHistory?.summaries ?? []).map((summary) => [priceKey(summary.name_key, summary.card_type), summary]));
  const averagesAvailable = authorized && currentState?.status === "ready" &&
    (historyQuery === "[]" || currentHistory !== null);
  const manualStatus: DataStatus = !currentState ? "loading"
    : currentState.status === "error" ? "error" : "ready";
  const observationStatus: DataStatus = !currentHistory ? "loading"
    : currentHistory.error ? "error" : "ready";
  useEffect(() => {
    if (!authorized || activeTab !== "prices") return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/price-observations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "tracking" }),
        });
        const result: { tracked?: TrackedPrice[]; error?: string } = await response.json();
        if (!response.ok || !result.tracked) throw new Error(result.error || "Impossible de charger les cartes suivies.");
        if (active) setTrackedState({ revision: historyRevision, retry: trackingRetry, tracked: result.tracked, error: null });
      } catch (error) {
        if (active) setTrackedState({
          revision: historyRevision, retry: trackingRetry, tracked: [],
          error: error instanceof Error ? error.message : "Impossible de charger les cartes suivies.",
        });
      }
    })();
    return () => { active = false; };
  }, [authorized, activeTab, historyRevision, trackingRetry]);
  const currentTracking = authorized && trackedState?.revision === historyRevision && trackedState.retry === trackingRetry
    ? trackedState : null;

  async function savePrice(name: string, rarity: string) {
    if (!authorized || currentState?.status !== "ready" || savingKey) return;
    const key = priceKey(name, rarity);
    const raw = drafts[key] ?? "";
    const value = Number(raw);
    if (!normalizeName(name) || normalizeName(name).length > 200 ||
        !isValidRarity(rarity) ||
        !raw.trim() || !Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000) {
      setPriceMessage("Vérifiez le nom, la rareté et le prix moyen (nombre entier entre 1 et 1 000 000 000).");
      return;
    }
    setSavingKey(key);
    setPriceMessage("");
    try {
      const response = await fetch("/api/average-prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardName: name, cardType: rarity, averagePrice: value }),
      });
      const result: { price?: AveragePrice; error?: string } = await response.json();
      if (!response.ok || !result.price) throw new Error(result.error || "Impossible d’enregistrer le prix moyen.");
      const saved = result.price;
      setPricesState((state) => state?.status === "ready"
        ? { ...state, prices: [...state.prices.filter((entry) => priceKey(entry.card_name, entry.card_type) !== priceKey(name, rarity)), saved] }
        : state);
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setPriceMessage(`Prix moyen de ${saved.card_name} (${saved.card_type}) enregistré.`);
      setHistoryRevision((revision) => revision + 1);
    } catch (error) {
      setPriceMessage(error instanceof Error ? error.message : "Impossible d’enregistrer le prix moyen.");
    } finally {
      setSavingKey(null);
    }
  }

  function priceEditor(name: string, rarity: string, id: string) {
    const key = priceKey(name, rarity);
    const saved = priceMap.get(priceKey(name, rarity));
    const draft = drafts[key];
    const average = authReady && (!authorized || currentState?.status === "ready") ? effectiveAveragePrice(rarity, saved?.average_price ?? null) : null;
    const value = draft ?? (average === null ? "" : String(average));
    const validIdentity = Boolean(normalizeName(name)) && isValidRarity(rarity);
    return (
      <div>
      <div className="price-editor">
        <label className="sr-only" htmlFor={id}>Prix moyen de {name || "la carte"} {rarity}</label>
        <input id={id} className="table-input number-input" type="number" min="1" max="1000000000" step="1"
          placeholder="À renseigner" value={value}
          disabled={!authorized || currentState?.status !== "ready" || !validIdentity || savingKey !== null}
          onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))} />
        <button className="small-button" type="button" onClick={() => void savePrice(name, rarity)}
          disabled={!authorized || currentState?.status !== "ready" || !validIdentity || savingKey !== null || draft === undefined || draft === String(saved?.average_price ?? "")}>
          {savingKey === key ? "…" : "OK"}
        </button>
      </div>
      {!saved && average !== null && <span className="default-price-note">Par défaut (non enregistré)</span>}
      </div>
    );
  }

  const rows: ListingRow[] = cards.map((card) => {
    const reference = priceMap.get(priceKey(card.cardName, card.cardType ?? ""));
    const summary = summaries.get(priceKey(card.cardName, card.cardType ?? ""));
    const estimate = estimatePrice(card.cardType, reference?.average_price ?? null, summary);
    const average = averagesAvailable ? estimate.value : null;
    const expiration = expirationAt(cardsPastedAt, card.remainingTime);
    return {
      card, average, manual: reference?.average_price ?? null, summary, estimate, expiration,
      comparison: compareListing(card, average),
      night: isNightExpiration(expiration),
    };
  });
  const dealCount = rows.filter((row) => row.comparison?.good).length;
  const sortedRows = (dealsOnly ? rows.filter((row) => row.comparison?.good) : [...rows]).sort((a, b) => listingSort
    ? compareSortValues(listingSortValue(a, listingSort.column), listingSortValue(b, listingSort.column), listingSort.direction)
    : Number(Boolean(b.comparison?.good)) - Number(Boolean(a.comparison?.good)));
  const trackedCards = new Map<string, { name: string; rarity: string; manual: number | null; summary?: PriceSummary }>();
  for (const entry of currentTracking?.tracked ?? []) {
    const summary = entry.lower_quartile === null || entry.upper_quartile === null ? undefined : {
      ...entry, lower_quartile: entry.lower_quartile, upper_quartile: entry.upper_quartile,
    };
    trackedCards.set(priceKey(entry.name_key, entry.card_type), {
      name: entry.name_key, rarity: entry.card_type, manual: null, summary,
    });
  }
  for (const price of prices) {
    const key = priceKey(price.card_name, price.card_type);
    trackedCards.set(key, {
      name: price.card_name, rarity: price.card_type, manual: price.average_price,
      summary: trackedCards.get(key)?.summary,
    });
  }
  const sortedPrices = [...trackedCards.values()].filter((price) => matchesCardSearch(price.name, trackingSearch)).sort((a, b) => {
    const column = priceSort?.column ?? "name";
    const value = (price: typeof a) => column === "name" ? price.name
      : column === "rarity" ? price.rarity
      : column === "manual" ? price.manual
      : currentTracking && !currentTracking.error ? estimatePrice(price.rarity, price.manual, price.summary).value : null;
    return compareSortValues(value(a), value(b), priceSort?.direction ?? "ascending");
  });
  const selected = selectedCard;
  function openHistory(name: string, rarity: string) {
    setTrackingSearch(name);
    setSelectedCard({ name, rarity });
    setActiveTab("prices");
    window.scrollTo({ top: 0 });
  }

  if (!authReady || !authorized) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <a className="brand" href="#" aria-label="WikiTrack accueil">
            <span className="brand-mark">W</span><span className="brand-name">WIKI<span>TRACK</span></span>
          </a>
        </header>
        {!authReady ? <p className="notice" role="status">Vérification de l’accès partagé…</p> : <section className="account-section">
          <h1>Accès au groupe</h1>
          <p>Entrez le mot de passe partagé pour consulter et modifier les données communes.</p>
          <form className="signin-form" onSubmit={(event) => void handleSignIn(event)}>
            <label className="sr-only" htmlFor="shared-password">Mot de passe partagé</label>
            <input id="shared-password" autoComplete="current-password" type="password" required value={password}
              placeholder="Mot de passe partagé" onChange={(event) => setPassword(event.target.value)} />
            <button className="primary-button" disabled={authBusy} type="submit">{authBusy ? "Vérification…" : "Entrer"}</button>
          </form>
          {authMessage && <p className="notice error" role="alert">{authMessage}</p>}
        </section>}
        <footer className="footer">WIKITRACK · Accès privé du groupe</footer>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="WikiTrack accueil">
          <span className="brand-mark">W</span><span className="brand-name">WIKI<span>TRACK</span></span>
        </a>
        <div className="account-chip">
          <span className="workspace-label">Espace partagé</span>
          <button className="text-button" onClick={() => void handleSignOut()} type="button">Verrouiller</button>
        </div>
      </header>

      <nav className="tabs" aria-label="Sections">
        <button type="button" aria-pressed={activeTab === "annonces"} onClick={() => setActiveTab("annonces")}>Annonces</button>
        <button type="button" aria-pressed={activeTab === "prices"} onClick={() => setActiveTab("prices")}>Suivi de prix</button>
        <button type="button" aria-pressed={activeTab === "keywords"} onClick={() => setActiveTab("keywords")}>Mots-clés</button>
      </nav>

      {activeTab === "keywords" && <Keywords />}

      {activeTab === "annonces" && <>
      <section className="import-section" aria-labelledby="import-heading">
        <div className="section-heading"><h2 id="import-heading">Importer des annonces</h2></div>
        <label className="sr-only" htmlFor="market-text">Texte du marché WikiMasters</label>
        <div className="import-controls">
          <textarea id="market-text" value={text} onPaste={(event) => {
            event.preventDefault();
            const pastedText = event.clipboardData.getData("text/plain");
            if (!pastedText.trim()) {
              setNotice("Collez du texte provenant du marché WikiMasters.");
              return;
            }
            setText(pastedText);
            setTextPastedAt(Date.now());
            setNotice("");
          }} onChange={(event) => {
            setText(event.target.value);
            setTextPastedAt(null);
          }} placeholder="Collez ici le texte copié du marché WikiMasters…" />
          <button className="primary-button" disabled={!text.trim() || recording} onClick={() => void handleAnalyze()} type="button">Analyser</button>
        </div>
        {notice && <p className="notice" role="status">{notice}</p>}
        {historyMessage && <p className="notice" role="status">{historyMessage}</p>}
      </section>

      <section className="list-section" aria-labelledby="list-heading">
        <div className="section-heading">
          <div><h1 id="list-heading">Annonces</h1><p>{listingSort ? "Tri par colonne activé." : "Les bonnes affaires apparaissent en premier."}</p></div>
          <div className="counts"><span>{cards.length} annonce(s)</span><span className="deal-count">{dealCount} bonne(s) affaire(s)</span></div>
        </div>
        {cards.length > 0 && <label className="deals-filter">
          <input type="checkbox" checked={dealsOnly} onChange={(event) => setDealsOnly(event.target.checked)} /> Afficher uniquement les bonnes affaires
        </label>}
        {cards.length === 0 ? <div className="empty-state">Aucune annonce pour le moment. Collez le texte du marché ci-dessus.</div> :
          sortedRows.length === 0 ? <div className="empty-state">Aucune bonne affaire parmi les annonces actuelles.</div> :
          <div className="table-scroll listing-scroll"><table className="review-table listing-table">
            <colgroup>
              <col className="listing-name" /><col className="listing-rarity" /><col className="listing-price" />
              <col className="listing-kind" /><col className="listing-manual" /><col className="listing-reference" />
              <col className="listing-comparison" /><col className="listing-alerts" /><col className="listing-duration" />
              <col className="listing-remove" />
            </colgroup>
            <thead><tr>
              <SortHeader label="Carte" column="name" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Rareté" column="rarity" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix" column="price" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Type de mise" column="kind" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix moyen partagé" column="manual" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix de référence" column="average" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Comparaison" column="comparison" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Alertes" column="alerts" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Durée au collage" column="duration" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <th><span className="sr-only">Supprimer</span></th>
            </tr></thead>
            <tbody>{sortedRows.map(({ card, average, manual, estimate, summary, comparison, expiration, night }) => <tr key={card.id}>
              <td><div className="name-cell">{card.cardName && card.cardType
                ? <button type="button" className="card-history-button" title="Voir le graphique de prix"
                  onClick={() => openHistory(card.cardName, card.cardType ?? "")}><strong>{card.cardName}</strong></button>
                : <strong>{card.cardName || "Nom non reconnu"}</strong>}<CopyNameButton name={card.cardName} /></div></td>
              <td><span className={`rarity-badge ${rarityClass(card.cardType)}`}>{card.cardType || "—"}</span></td>
              <td>{card[card.bidKind] !== null ? card[card.bidKind]?.toLocaleString("fr-FR") : "—"}</td>
              <td><span className="bid-kind">{card.bidKind === "currentPrice" ? "Actuelle" : "Départ"}</span></td>
              <td>{priceEditor(card.cardName, card.cardType ?? "", `average-${card.id}`)}</td>
              <td><ReferencePrice estimate={estimate} manual={manual} summary={summary} available={averagesAvailable}
                manualStatus={manualStatus} observationStatus={observationStatus} /></td>
              <td>{isEnded(card.remainingTime) ? <span className="muted">Terminée</span> : comparison ? <>
                <span className={comparison.good ? "deal-badge" : "comparison"}>{comparison.good ? "Bonne affaire · " : ""}{comparison.discount >= 0 ? "−" : "+"}{Math.abs(comparison.discount).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</span>
                {comparison.good && <span className="default-price-note">Mise max : {comparison.maxBid.toLocaleString("fr-FR")}</span>}
              </> : <span className="muted">{!averagesAvailable ? "Prix indisponibles" : average !== null ? "Mise à renseigner" : "Sans prix moyen"}</span>}</td>
              <td><div className="flags">{night ? <span className="flag night-flag">Expire entre 3h et 7h</span> : <span className="muted">—</span>}</div></td>
              <td>{card.remainingTime || "—"}
                {expiration && <span className="expiration">Expire le {expiration.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
                {cardsPastedAt !== null && !expiration && !isEnded(card.remainingTime) && <span className="expiration">Durée invalide</span>}</td>
              <td><button className="remove-row" type="button" aria-label={`Retirer ${card.cardName || "l’annonce"}`} onClick={() => setCards((current) => current.filter((entry) => entry.id !== card.id))}>×</button></td>
            </tr>)}</tbody>
          </table></div>}
        <p className="footnote">Bonne affaire : prix ≤ −20 % du prix de référence, indicatif et non garanti ; les annonces terminées sont exclues. Les mises ne sont pas nécessairement des prix de vente. La fiabilité dépend du nombre et de la dispersion des observations, sans garantie statistique. Légendaire : 286 par défaut en l’absence de données. Expiration estimée selon l’heure du collage et le fuseau local. Les annonces restent temporaires.</p>
        {cards.length > 0 && cardsPastedAt === null && <p className="notice">Heure du collage inconnue : collez à nouveau le texte pour calculer les expirations.</p>}
      </section>

      </>}

      {activeTab === "prices" && <section className="saved-section" aria-labelledby="saved-heading">
        <div className="section-heading"><div><h1 id="saved-heading">Suivi de prix</h1><p>L’historique est disponible dès la première mise actuelle enregistrée.</p></div>{currentState?.status === "ready" && currentTracking && !currentTracking.error && <span className="muted">{sortedPrices.length} carte(s)</span>}</div>
        <label className="sr-only" htmlFor="tracking-search">Rechercher une carte</label>
        <input id="tracking-search" className="tracking-search" type="search" value={trackingSearch} placeholder="Rechercher une carte…" onChange={(event) => { setTrackingSearch(event.target.value); setSelectedCard(null); }} />
        {!currentTracking && <p className="notice" role="status">Chargement des cartes suivies…</p>}
        {currentTracking?.error && <p className="notice error" role="alert">{currentTracking.error}{" "}
          <button type="button" className="text-button" onClick={() => setTrackingRetry((value) => value + 1)}>Réessayer</button></p>}
        {currentState?.status === "ready" && currentTracking && (sortedPrices.length === 0 ? <div className="empty-state">{currentTracking.error ? "Les cartes suivies sont indisponibles." : !trackingSearch.trim() ? "Recherchez une carte pour afficher les résultats." : trackedCards.size === 0 ? "Aucune carte suivie. Analysez des mises actuelles reconnues ou renseignez un prix moyen." : "Aucune carte ne correspond à cette recherche."}</div> :
          <div className="table-scroll"><table className="review-table saved-table">
            <thead><tr>
              <SortHeader label="Carte" column="name" sort={priceSort} onSort={(column) => setPriceSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Rareté" column="rarity" sort={priceSort} onSort={(column) => setPriceSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix moyen partagé" column="manual" sort={priceSort} onSort={(column) => setPriceSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix de référence" column="reference" sort={priceSort} onSort={(column) => setPriceSort((sort) => nextSort(sort, column))} />
              <th scope="col">Historique</th>
            </tr></thead>
            <tbody>{sortedPrices.map((price) => {
              const key = priceKey(price.name, price.rarity);
              const isSelected = selected !== null && priceKey(selected.name, selected.rarity) === key;
              const estimate = estimatePrice(price.rarity, price.manual, price.summary);
              const toggleHistory = () => setSelectedCard(isSelected ? null : { name: price.name, rarity: price.rarity });
              return <tr key={key}>
                <td><div className="name-cell"><button type="button" className="card-history-button" aria-expanded={isSelected}
                  aria-controls={isSelected ? "price-history" : undefined}
                  onClick={toggleHistory}>{price.name}</button><CopyNameButton name={price.name} /></div></td>
                <td><span className={`rarity-badge ${rarityClass(price.rarity)}`}>{price.rarity}</span></td>
                <td>{priceEditor(price.name, price.rarity, `saved-${key}`)}</td>
                <td><ReferencePrice estimate={estimate} manual={price.manual} summary={price.summary} available={!currentTracking.error}
                  manualStatus="ready" observationStatus={currentTracking.error ? "error" : "ready"} /></td>
                <td><button type="button" className="card-history-button" aria-expanded={isSelected}
                  aria-controls={isSelected ? "price-history" : undefined} aria-label={`${isSelected ? "Fermer" : "Voir"} l’historique de ${price.name} (${price.rarity})`}
                  onClick={toggleHistory}>{isSelected ? "Fermer" : "Voir l’historique"}</button></td>
              </tr>;
            })}</tbody>
          </table></div>)}
        {selected && <PriceHistory key={priceKey(selected.name, selected.rarity)} name={selected.name} rarity={selected.rarity}
          revision={historyRevision} onClose={() => setSelectedCard(null)} />}
      </section>}

      {priceMessage && <p className="notice" role="status">{priceMessage}</p>}
      {loadingPrices && <p className="notice" role="status">Chargement des prix moyens…</p>}
      {currentState?.status === "error" && <p className="notice error" role="alert">{currentState.message} Actualisez la page pour réessayer.</p>}
      {currentHistory?.error && <p className="notice error" role="alert">{currentHistory.error} Les références partagées et par défaut restent disponibles ; actualisez la page pour réessayer.</p>}

      <footer className="footer">WIKITRACK · Analyse gratuite dans votre navigateur</footer>
    </main>
  );
}
