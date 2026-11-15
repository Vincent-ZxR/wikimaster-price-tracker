"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { parseMarketplaceText } from "@/lib/parse-marketplace";
import { compareListing, effectiveAveragePrice, estimatePrice, expirationAt, isEnded, isNightExpiration, isValidRarity, matchesCardSearch, normalizeName, normalizeRarity, priceKey } from "@/lib/deals";
import { compareSortValues, nextSort, type Sort } from "@/lib/sort";
import { PriceHistory } from "./price-history";
import type { AveragePrice, ExtractedCard, PriceSummary, TrackedPrice } from "@/lib/types";

type PricesState =
  | { userId: string; token: string; status: "ready"; prices: AveragePrice[] }
  | { userId: string; token: string; status: "error"; message: string };

type ListingColumn = "name" | "rarity" | "price" | "kind" | "personal" | "average" | "comparison" | "alerts" | "duration";
type PriceColumn = "name" | "rarity" | "personal" | "reference";

type ListingRow = {
  card: ExtractedCard;
  average: number | null;
  personal: number | null;
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
    case "personal": return row.personal;
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

type DataStatus = "ready" | "loading" | "error" | "signed-out";

function ReferencePrice({ estimate, personal, summary, available, personalStatus, observationStatus }: {
  estimate: ReturnType<typeof estimatePrice>;
  personal: number | null;
  summary: PriceSummary | undefined;
  available: boolean;
  personalStatus: DataStatus;
  observationStatus: DataStatus;
}) {
  const statusText = (status: DataStatus) =>
    status === "loading" ? "Chargement…" : status === "error" ? "Indisponible" : "Connexion requise";
  const manual = personalStatus === "ready" ? personal === null ? "—" : personal.toLocaleString("fr-FR") : statusText(personalStatus);
  const observations = observationStatus !== "ready" ? statusText(observationStatus)
    : estimate.market === null ? `— (${summary?.sample_count ?? 0}/5)`
    : `${estimate.market.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} (${summary?.sample_count ?? 0} obs.)`;
  return <>
    {available && estimate.value !== null
      ? <><strong>{estimate.value.toLocaleString("fr-FR")}</strong><span className="default-price-note">{estimate.source}{estimate.quality ? ` · fiabilité indicative ${estimate.quality}` : ""}</span></>
      : <span className="muted">{available ? "Estimation indisponible"
        : personalStatus === "loading" || observationStatus === "loading" ? "Chargement…" : "Prix indisponible"}</span>}
    <span className="default-price-note">Manuel : {manual}</span>
    <span className="default-price-note">Observations : {observations}</span>
  </>;
}

function CopyNameButton({ name }: { name: string }) {
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
      aria-label={`Copier le nom ${name || "de la carte"}`} onClick={() => void copyName()}>
      {visibleFeedback?.success ? "Copié" : "Copier"}
    </button>
    <span role="status" className={visibleFeedback && !visibleFeedback.success ? "copy-error" : "sr-only"}>
      {visibleFeedback ? visibleFeedback.success ? "Nom copié." : "Copie impossible. Vérifiez les autorisations du navigateur." : ""}
    </span>
  </span>;
}

export default function Home() {
  const [supabase] = useState(createSupabaseBrowserClient);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [text, setText] = useState("");
  const [cards, setCards] = useState<ExtractedCard[]>([]);
  const [activeTab, setActiveTab] = useState<"annonces" | "prices">("annonces");
  const [listingSort, setListingSort] = useState<Sort<ListingColumn> | null>(null);
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
    userId: string; token: string; query: string; revision: number;
    summaries: PriceSummary[]; error: string | null;
  } | null>(null);
  const [trackedState, setTrackedState] = useState<{
    userId: string; token: string; revision: number; retry: number;
    tracked: TrackedPrice[]; error: string | null;
  } | null>(null);
  const [trackingRetry, setTrackingRetry] = useState(0);
  const [selectedCard, setSelectedCard] = useState<{ userId: string; name: string; rarity: string } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setAuthReady(true);
      }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthMessage("Impossible de vérifier la connexion. Actualisez la page.");
      setSession(data.session);
      setAuthReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const { id: userId } = session.user;
    const token = session.access_token;
    void (async () => {
      try {
        const response = await fetch("/api/average-prices", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result: { prices?: AveragePrice[]; error?: string } = await response.json();
        if (!response.ok || !result.prices) {
          throw new Error(result.error || "Impossible de charger les prix moyens.");
        }
        if (active) setPricesState({ userId, token, status: "ready", prices: result.prices });
      } catch (error) {
        if (active) setPricesState({
          userId, token, status: "error",
          message: error instanceof Error ? error.message : "Impossible de charger les prix moyens.",
        });
      }
    })();
    return () => { active = false; };
  }, [session]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setAuthBusy(false);
    if (error) {
      setAuthMessage(error.message);
    } else {
      setEmailSent(true);
      setAuthMessage("Consultez votre boîte mail pour vous connecter.");
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthMessage("Impossible de se déconnecter. Réessayez.");
    } else {
      setDrafts({});
      setPriceMessage("");
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
    if (!session) {
      setHistoryMessage("Connectez-vous pour enregistrer les mises actuelles dans l’historique partagé.");
      return;
    }
    setRecording(true);
    try {
      const response = await fetch("/api/price-observations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
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

  const currentState = session && pricesState?.userId === session.user.id &&
    pricesState.token === session.access_token ? pricesState : null;
  const prices = currentState?.status === "ready" ? currentState.prices : [];
  const priceMap = new Map(prices.map((price) => [priceKey(price.card_name, price.card_type), price]));
  const loadingPrices = Boolean(session && !currentState);
  const historyQuery = JSON.stringify(cards.map((card) => ({ name: card.cardName, rarity: card.cardType ?? "" })));
  useEffect(() => {
    if (!session || historyQuery === "[]") return;
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/price-observations", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: "lookup", keys: JSON.parse(historyQuery) }),
          });
          const result: { summaries?: PriceSummary[]; error?: string } = await response.json();
          if (!response.ok || !result.summaries) throw new Error(result.error || "Impossible de charger l’historique des prix.");
          if (active) setHistoryState({ userId: session.user.id, token: session.access_token, query: historyQuery, revision: historyRevision, summaries: result.summaries, error: null });
        } catch (error) {
          if (active) setHistoryState({
            userId: session.user.id, token: session.access_token, query: historyQuery, revision: historyRevision, summaries: [],
            error: error instanceof Error ? error.message : "Impossible de charger l’historique des prix.",
          });
        }
      })();
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [session, historyQuery, historyRevision]);
  const currentHistory = session && historyState?.userId === session.user.id && historyState.token === session.access_token &&
    historyState.query === historyQuery && historyState.revision === historyRevision ? historyState : null;
  const summaries = new Map((currentHistory?.summaries ?? []).map((summary) => [priceKey(summary.name_key, summary.card_type), summary]));
  const averagesAvailable = authReady && (!session || (currentState?.status === "ready" && (historyQuery === "[]" || currentHistory !== null)));
  const personalStatus: DataStatus = !authReady ? "loading" : !session ? "signed-out"
    : !currentState ? "loading" : currentState.status === "error" ? "error" : "ready";
  const observationStatus: DataStatus = !authReady ? "loading" : !session ? "signed-out"
    : !currentHistory ? "loading" : currentHistory.error ? "error" : "ready";
  useEffect(() => {
    if (!session || activeTab !== "prices") return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/price-observations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: "tracking" }),
        });
        const result: { tracked?: TrackedPrice[]; error?: string } = await response.json();
        if (!response.ok || !result.tracked) throw new Error(result.error || "Impossible de charger les cartes suivies.");
        if (active) setTrackedState({ userId: session.user.id, token: session.access_token, revision: historyRevision, retry: trackingRetry, tracked: result.tracked, error: null });
      } catch (error) {
        if (active) setTrackedState({
          userId: session.user.id, token: session.access_token, revision: historyRevision, retry: trackingRetry, tracked: [],
          error: error instanceof Error ? error.message : "Impossible de charger les cartes suivies.",
        });
      }
    })();
    return () => { active = false; };
  }, [session, activeTab, historyRevision, trackingRetry]);
  const currentTracking = session && trackedState?.userId === session.user.id && trackedState.token === session.access_token &&
    trackedState.revision === historyRevision && trackedState.retry === trackingRetry ? trackedState : null;

  async function savePrice(name: string, rarity: string) {
    if (!session || currentState?.status !== "ready" || savingKey) return;
    const key = JSON.stringify([session.user.id, priceKey(name, rarity)]);
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ cardName: name, cardType: rarity, averagePrice: value }),
      });
      const result: { price?: AveragePrice; error?: string } = await response.json();
      if (!response.ok || !result.price) throw new Error(result.error || "Impossible d’enregistrer le prix moyen.");
      const saved = result.price;
      setPricesState((state) => state?.status === "ready" && state.userId === session.user.id && state.token === session.access_token
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
    const key = JSON.stringify([session?.user.id, priceKey(name, rarity)]);
    const saved = priceMap.get(priceKey(name, rarity));
    const draft = drafts[key];
    const average = authReady && (!session || currentState?.status === "ready") ? effectiveAveragePrice(rarity, saved?.average_price ?? null) : null;
    const value = draft ?? (average === null ? "" : String(average));
    const validIdentity = Boolean(normalizeName(name)) && isValidRarity(rarity);
    return (
      <div>
      <div className="price-editor">
        <label className="sr-only" htmlFor={id}>Prix moyen de {name || "la carte"} {rarity}</label>
        <input id={id} className="table-input number-input" type="number" min="1" max="1000000000" step="1"
          placeholder="À renseigner" value={value}
          disabled={!session || currentState?.status !== "ready" || !validIdentity || savingKey !== null}
          onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))} />
        <button className="small-button" type="button" onClick={() => void savePrice(name, rarity)}
          disabled={!session || currentState?.status !== "ready" || !validIdentity || savingKey !== null || draft === undefined || draft === String(saved?.average_price ?? "")}>
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
      card, average, personal: reference?.average_price ?? null, summary, estimate, expiration,
      comparison: compareListing(card, average),
      night: isNightExpiration(expiration),
    };
  });
  const dealCount = rows.filter((row) => row.comparison?.good).length;
  const sortedRows = [...rows].sort((a, b) => listingSort
    ? compareSortValues(listingSortValue(a, listingSort.column), listingSortValue(b, listingSort.column), listingSort.direction)
    : Number(Boolean(b.comparison?.good)) - Number(Boolean(a.comparison?.good)));
  const trackedCards = new Map<string, { name: string; rarity: string; personal: number | null; summary?: PriceSummary }>();
  for (const entry of currentTracking?.tracked ?? []) {
    const summary = entry.lower_quartile === null || entry.upper_quartile === null ? undefined : {
      ...entry, lower_quartile: entry.lower_quartile, upper_quartile: entry.upper_quartile,
    };
    trackedCards.set(priceKey(entry.name_key, entry.card_type), {
      name: entry.name_key, rarity: entry.card_type, personal: null, summary,
    });
  }
  for (const price of prices) {
    const key = priceKey(price.card_name, price.card_type);
    trackedCards.set(key, {
      name: price.card_name, rarity: price.card_type, personal: price.average_price,
      summary: trackedCards.get(key)?.summary,
    });
  }
  const sortedPrices = [...trackedCards.values()].filter((price) => matchesCardSearch(price.name, trackingSearch)).sort((a, b) => {
    const column = priceSort?.column ?? "name";
    const value = (price: typeof a) => column === "name" ? price.name
      : column === "rarity" ? price.rarity
      : column === "personal" ? price.personal
      : currentTracking && !currentTracking.error ? estimatePrice(price.rarity, price.personal, price.summary).value : null;
    return compareSortValues(value(a), value(b), priceSort?.direction ?? "ascending");
  });
  const selected = session && selectedCard?.userId === session.user.id ? selectedCard : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="WikiTrack accueil">
          <span className="brand-mark">W</span><span className="brand-name">WIKI<span>TRACK</span></span>
        </a>
        {session && <div className="account-chip">
          <span className="account-email">{session.user.email}</span>
          <button className="text-button" onClick={() => void handleSignOut()} type="button">Déconnexion</button>
        </div>}
      </header>

      <nav className="tabs" aria-label="Sections">
        <button type="button" aria-pressed={activeTab === "annonces"} onClick={() => setActiveTab("annonces")}>Annonces</button>
        <button type="button" aria-pressed={activeTab === "prices"} onClick={() => setActiveTab("prices")}>Suivi de prix</button>
      </nav>

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
        {cards.length === 0 ? <div className="empty-state">Aucune annonce pour le moment. Collez le texte du marché ci-dessus.</div> :
          <div className="table-scroll listing-scroll"><table className="review-table listing-table">
            <colgroup>
              <col className="listing-name" /><col className="listing-rarity" /><col className="listing-price" />
              <col className="listing-kind" /><col className="listing-personal" /><col className="listing-reference" />
              <col className="listing-comparison" /><col className="listing-alerts" /><col className="listing-duration" />
              <col className="listing-remove" />
            </colgroup>
            <thead><tr>
              <SortHeader label="Carte" column="name" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Rareté" column="rarity" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix" column="price" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Type de mise" column="kind" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix moyen personnel" column="personal" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix de référence" column="average" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Comparaison" column="comparison" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Alertes" column="alerts" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Durée au collage" column="duration" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <th><span className="sr-only">Supprimer</span></th>
            </tr></thead>
            <tbody>{sortedRows.map(({ card, average, personal, estimate, summary, comparison, expiration, night }) => <tr key={card.id}>
              <td><div className="name-cell"><strong>{card.cardName || "Nom non reconnu"}</strong><CopyNameButton name={card.cardName} /></div></td>
              <td><span className={`rarity-badge ${rarityClass(card.cardType)}`}>{card.cardType || "—"}</span></td>
              <td>{card[card.bidKind] !== null ? card[card.bidKind]?.toLocaleString("fr-FR") : "—"}</td>
              <td><span className="bid-kind">{card.bidKind === "currentPrice" ? "Actuelle" : "Départ"}</span></td>
              <td>{priceEditor(card.cardName, card.cardType ?? "", `average-${card.id}`)}</td>
              <td><ReferencePrice estimate={estimate} personal={personal} summary={summary} available={averagesAvailable}
                personalStatus={personalStatus} observationStatus={observationStatus} /></td>
              <td>{isEnded(card.remainingTime) ? <span className="muted">Terminée</span> : comparison ? <span className={comparison.good ? "deal-badge" : "comparison"}>{comparison.good ? "Bonne affaire · " : ""}{comparison.discount >= 0 ? "−" : "+"}{Math.abs(comparison.discount).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</span> : <span className="muted">{!averagesAvailable ? "Prix indisponibles" : average !== null ? "Mise à renseigner" : "Sans prix moyen"}</span>}</td>
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
        {!session && <div className="empty-state">Connectez-vous pour consulter le suivi de prix.</div>}
        {session && !currentTracking && <p className="notice" role="status">Chargement des cartes suivies…</p>}
        {currentTracking?.error && <p className="notice error" role="alert">{currentTracking.error}{" "}
          <button type="button" className="text-button" onClick={() => setTrackingRetry((value) => value + 1)}>Réessayer</button></p>}
        {session && currentState?.status === "ready" && currentTracking && (sortedPrices.length === 0 ? <div className="empty-state">{currentTracking.error ? "Les cartes suivies sont indisponibles." : !trackingSearch.trim() ? "Recherchez une carte pour afficher les résultats." : trackedCards.size === 0 ? "Aucune carte suivie. Analysez des mises actuelles reconnues ou renseignez un prix moyen." : "Aucune carte ne correspond à cette recherche."}</div> :
          <div className="table-scroll"><table className="review-table saved-table">
            <thead><tr>
              <SortHeader label="Carte" column="name" sort={priceSort} onSort={(column) => setPriceSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Rareté" column="rarity" sort={priceSort} onSort={(column) => setPriceSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix moyen personnel" column="personal" sort={priceSort} onSort={(column) => setPriceSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix de référence" column="reference" sort={priceSort} onSort={(column) => setPriceSort((sort) => nextSort(sort, column))} />
              <th scope="col">Historique</th>
            </tr></thead>
            <tbody>{sortedPrices.map((price) => {
              const key = priceKey(price.name, price.rarity);
              const isSelected = selected !== null && priceKey(selected.name, selected.rarity) === key;
              const estimate = estimatePrice(price.rarity, price.personal, price.summary);
              const toggleHistory = () => setSelectedCard(isSelected ? null : { userId: session.user.id, name: price.name, rarity: price.rarity });
              return <tr key={key}>
                <td><div className="name-cell"><button type="button" className="card-history-button" aria-expanded={isSelected}
                  aria-controls={isSelected ? "price-history" : undefined}
                  onClick={toggleHistory}>{price.name}</button><CopyNameButton name={price.name} /></div></td>
                <td><span className={`rarity-badge ${rarityClass(price.rarity)}`}>{price.rarity}</span></td>
                <td>{priceEditor(price.name, price.rarity, `saved-${key}`)}</td>
                <td><ReferencePrice estimate={estimate} personal={price.personal} summary={price.summary} available={!currentTracking.error}
                  personalStatus="ready" observationStatus={currentTracking.error ? "error" : "ready"} /></td>
                <td><button type="button" className="card-history-button" aria-expanded={isSelected}
                  aria-controls={isSelected ? "price-history" : undefined} aria-label={`${isSelected ? "Fermer" : "Voir"} l’historique de ${price.name} (${price.rarity})`}
                  onClick={toggleHistory}>{isSelected ? "Fermer" : "Voir l’historique"}</button></td>
              </tr>;
            })}</tbody>
          </table></div>)}
        {selected && session && <PriceHistory key={priceKey(selected.name, selected.rarity)} name={selected.name} rarity={selected.rarity}
          token={session.access_token} revision={historyRevision} onClose={() => setSelectedCard(null)} />}
      </section>}

      {priceMessage && <p className="notice" role="status">{priceMessage}</p>}
      {loadingPrices && <p className="notice" role="status">Chargement des prix moyens…</p>}
      {currentState?.status === "error" && <p className="notice error" role="alert">{currentState.message} Actualisez la page pour réessayer.</p>}
      {currentHistory?.error && <p className="notice error" role="alert">{currentHistory.error} Les références personnelles et par défaut restent disponibles ; actualisez la page pour réessayer.</p>}

      {!supabase && <p className="notice error">Configurez Supabase pour enregistrer vos prix moyens. L’analyse reste disponible sans connexion.</p>}
      {supabase && !authReady && <p className="notice">Vérification de la connexion…</p>}
      {supabase && !session && authReady && <section className="account-section">
        <h2>Enregistrer mes prix moyens</h2>
        <form className="signin-form" onSubmit={(event) => void handleSignIn(event)}>
          <label className="sr-only" htmlFor="email">Adresse email</label>
          <input id="email" autoComplete="email" type="email" required value={email} placeholder="Votre adresse email" onChange={(event) => { setEmail(event.target.value); setEmailSent(false); }} />
          <button className="primary-button" disabled={authBusy || emailSent} type="submit">{authBusy ? "Envoi…" : emailSent ? "Lien envoyé" : "Recevoir un lien de connexion"}</button>
        </form>
      </section>}
      {authMessage && <p className="notice" role="status">{authMessage}</p>}

      <footer className="footer">WIKITRACK · Analyse gratuite dans votre navigateur</footer>
    </main>
  );
}
