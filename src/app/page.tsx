"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { parseMarketplaceText } from "@/lib/parse-marketplace";
import { compareListing, expirationAt, isLegendaryDeal, isNightExpiration, normalizeName, normalizeRarity, priceKey } from "@/lib/deals";
import { compareSortValues, nextSort, type Sort } from "@/lib/sort";
import type { AveragePrice, ExtractedCard } from "@/lib/types";

type PricesState =
  | { userId: string; token: string; status: "ready"; prices: AveragePrice[] }
  | { userId: string; token: string; status: "error"; message: string };

type ListingColumn = "name" | "rarity" | "price" | "kind" | "average" | "comparison" | "alerts" | "duration";
type PriceColumn = "name" | "rarity" | "average";

type ListingRow = {
  card: ExtractedCard;
  reference: AveragePrice | undefined;
  expiration: Date | null;
  comparison: ReturnType<typeof compareListing>;
  legendary: boolean;
  night: boolean;
};

function listingSortValue(row: ListingRow, column: ListingColumn): string | number | null {
  switch (column) {
    case "name": return row.card.cardName.trim() || null;
    case "rarity": return normalizeRarity(row.card.cardType ?? "") || null;
    case "price": return row.card[row.card.bidKind];
    case "kind": return row.card.bidKind === "currentPrice" ? "Actuelle" : "Départ";
    case "average": return row.reference?.average_price ?? null;
    case "comparison": return row.comparison ? -row.comparison.discount : null;
    case "alerts": return (Number(row.legendary) * 2 + Number(row.night)) || null;
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
  return /^(?:L|UR|SR|R|PC|C)$/u.test(normalized) ? `rarity-${normalized}` : "";
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
  const pendingPaste = useRef<number | null>(null);
  const [textPastedAt, setTextPastedAt] = useState<number | null>(null);
  const [cardsPastedAt, setCardsPastedAt] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [pricesState, setPricesState] = useState<PricesState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [priceMessage, setPriceMessage] = useState("");

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

  function handleAnalyze() {
    const result = parseMarketplaceText(text);
    setCards(result.cards.map((card) => ({ ...card, id: crypto.randomUUID() })));
    setCardsPastedAt(textPastedAt);
    setNotice([
      result.cards.length ? `${result.cards.length} annonce(s) détectée(s).` : "",
      ...result.warnings,
    ].filter(Boolean).join(" "));
  }

  function updateCard(id: string, field: "cardName" | "cardType" | "currentPrice" | "startingPrice" | "remainingTime", value: string) {
    setCards((current) => current.map((card) => card.id === id ? {
      ...card,
      [field]: field === "currentPrice" || field === "startingPrice"
        ? value === "" ? null : Number(value)
        : value,
    } : card));
  }

  function updateBidKind(id: string, kind: ExtractedCard["bidKind"]) {
    setCards((current) => current.map((card) => {
      if (card.id !== id) return card;
      const price = card[card.bidKind];
      return {
        ...card,
        bidKind: kind,
        startingPrice: kind === "startingPrice" ? price : null,
        currentPrice: kind === "currentPrice" ? price : null,
      };
    }));
  }

  const currentState = session && pricesState?.userId === session.user.id &&
    pricesState.token === session.access_token ? pricesState : null;
  const prices = currentState?.status === "ready" ? currentState.prices : [];
  const priceMap = new Map(prices.map((price) => [priceKey(price.card_name, price.card_type), price]));
  const loadingPrices = Boolean(session && !currentState);

  async function savePrice(name: string, rarity: string) {
    if (!session || currentState?.status !== "ready" || savingKey) return;
    const key = JSON.stringify([session.user.id, priceKey(name, rarity)]);
    const raw = drafts[key] ?? "";
    const value = Number(raw);
    if (!normalizeName(name) || normalizeName(name).length > 200 ||
        !/^(?:L|UR|SR|R|PC|C)$/u.test(normalizeRarity(rarity)) ||
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
    const value = draft ?? (saved ? String(saved.average_price) : "");
    const validIdentity = Boolean(normalizeName(name)) && /^(?:L|UR|SR|R|PC|C)$/u.test(normalizeRarity(rarity));
    return (
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
    );
  }

  const rows: ListingRow[] = cards.map((card) => {
    const reference = priceMap.get(priceKey(card.cardName, card.cardType ?? ""));
    const expiration = expirationAt(cardsPastedAt, card.remainingTime);
    return {
      card, reference, expiration,
      comparison: compareListing(card, reference?.average_price ?? null),
      legendary: isLegendaryDeal(card),
      night: isNightExpiration(expiration),
    };
  });
  const dealCount = rows.filter((row) => row.legendary || row.comparison?.good).length;
  const sortedRows = [...rows].sort((a, b) => listingSort
    ? compareSortValues(listingSortValue(a, listingSort.column), listingSortValue(b, listingSort.column), listingSort.direction)
    : Number(b.legendary) - Number(a.legendary) ||
      Number(Boolean(b.comparison?.good)) - Number(Boolean(a.comparison?.good)));
  const sortedPrices = [...prices].sort((a, b) => {
    const column = priceSort?.column ?? "name";
    const value = (price: AveragePrice) => column === "name" ? price.card_name
      : column === "rarity" ? price.card_type : price.average_price;
    return compareSortValues(value(a), value(b), priceSort?.direction ?? "ascending");
  });

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
        <button type="button" aria-pressed={activeTab === "prices"} onClick={() => setActiveTab("prices")}>Mes prix moyens</button>
      </nav>

      {activeTab === "annonces" && <>
      <section className="list-section" aria-labelledby="list-heading">
        <div className="section-heading">
          <div><h1 id="list-heading">Annonces</h1><p>{listingSort ? "Tri par colonne activé." : "Les bonnes affaires apparaissent en premier."}</p></div>
          <div className="counts"><span>{cards.length} annonce(s)</span><span className="deal-count">{dealCount} bonne(s) affaire(s)</span></div>
        </div>
        {cards.length === 0 ? <div className="empty-state">Aucune annonce pour le moment. Collez le texte du marché ci-dessous.</div> :
          <div className="table-scroll"><table className="review-table">
            <thead><tr>
              <SortHeader label="Carte" column="name" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Rareté" column="rarity" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix" column="price" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Type de mise" column="kind" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix moyen" column="average" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Comparaison" column="comparison" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Alertes" column="alerts" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Durée au collage" column="duration" sort={listingSort} onSort={(column) => setListingSort((sort) => nextSort(sort, column))} />
              <th><span className="sr-only">Supprimer</span></th>
            </tr></thead>
            <tbody>{sortedRows.map(({ card, reference, comparison, legendary, expiration, night }) => <tr key={card.id}>
              <td><label className="sr-only" htmlFor={`name-${card.id}`}>Nom de la carte</label><input id={`name-${card.id}`} className="table-input name-input" value={card.cardName} onChange={(event) => updateCard(card.id, "cardName", event.target.value)} /></td>
              <td><label className="sr-only" htmlFor={`type-${card.id}`}>Rareté</label><input id={`type-${card.id}`} className={`table-input type-input rarity-badge ${rarityClass(card.cardType)}`} value={card.cardType ?? ""} onChange={(event) => updateCard(card.id, "cardType", event.target.value)} /></td>
              <td><label className="sr-only" htmlFor={`bid-${card.id}`}>Prix de la mise</label><input id={`bid-${card.id}`} className="table-input number-input" type="number" min="0" step="1" value={card[card.bidKind] ?? ""} onChange={(event) => updateCard(card.id, card.bidKind, event.target.value)} /></td>
              <td><label className="sr-only" htmlFor={`kind-${card.id}`}>Type de mise</label><select id={`kind-${card.id}`} className="bid-kind" value={card.bidKind} onChange={(event) => updateBidKind(card.id, event.target.value === "currentPrice" ? "currentPrice" : "startingPrice")}>
                <option value="startingPrice">Départ</option><option value="currentPrice">Actuelle</option>
              </select></td>
              <td>{priceEditor(card.cardName, card.cardType ?? "", `average-${card.id}`)}</td>
              <td>{comparison ? <span className={comparison.good ? "deal-badge" : "comparison"}>{comparison.good ? "Bonne affaire · " : ""}{comparison.discount >= 0 ? "−" : "+"}{Math.abs(comparison.discount).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</span> : <span className="muted">{reference ? "Mise à renseigner" : "Sans prix moyen"}</span>}</td>
              <td><div className="flags">{legendary && <span className="flag legendary-flag">L &lt; 234</span>}{night && <span className="flag night-flag">Expire entre 3h et 7h</span>}{!legendary && !night && <span className="muted">—</span>}</div></td>
              <td><label className="sr-only" htmlFor={`time-${card.id}`}>Durée au collage</label><input id={`time-${card.id}`} className="table-input time-input" value={card.remainingTime ?? ""} onChange={(event) => updateCard(card.id, "remainingTime", event.target.value)} />
                {expiration && <span className="expiration">Expire le {expiration.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
                {cardsPastedAt !== null && !expiration && <span className="expiration">Durée invalide</span>}</td>
              <td><button className="remove-row" type="button" aria-label={`Retirer ${card.cardName || "l’annonce"}`} onClick={() => setCards((current) => current.filter((entry) => entry.id !== card.id))}>×</button></td>
            </tr>)}</tbody>
          </table></div>}
        <p className="footnote">Seuils : départ ≤ −20 % ; actuelle ≤ −30 % ; légendaire &lt; 234. Cliquez sur un en-tête pour trier (trois clics pour revenir au tri des bonnes affaires). Expiration estimée selon l’heure du collage et le fuseau local, de 3h inclus à 7h exclu. Les annonces restent temporaires.</p>
        {cards.length > 0 && cardsPastedAt === null && <p className="notice">Heure du collage inconnue : collez à nouveau le texte pour calculer les expirations.</p>}
      </section>

      <section className="import-section" aria-labelledby="import-heading">
        <div className="section-heading"><h2 id="import-heading">Importer des annonces</h2></div>
        <label className="sr-only" htmlFor="market-text">Texte du marché WikiMasters</label>
        <div className="import-controls">
          <textarea id="market-text" value={text} onPaste={() => { pendingPaste.current = Date.now(); }} onChange={(event) => {
            setText(event.target.value);
            setTextPastedAt(pendingPaste.current);
            pendingPaste.current = null;
          }} placeholder="Collez ici le texte copié du marché WikiMasters…" />
          <button className="primary-button" disabled={!text.trim()} onClick={handleAnalyze} type="button">Analyser</button>
        </div>
        {notice && <p className="notice" role="status">{notice}</p>}
      </section>
      </>}

      {activeTab === "prices" && <section className="saved-section" aria-labelledby="saved-heading">
        <div className="section-heading"><h1 id="saved-heading">Mes prix moyens</h1>{currentState?.status === "ready" && <span className="muted">{prices.length} référence(s)</span>}</div>
        {!session && <div className="empty-state">Connectez-vous pour consulter vos prix moyens.</div>}
        {session && currentState?.status === "ready" && (prices.length === 0 ? <div className="empty-state">Renseignez un prix moyen sur une annonce pour le retrouver ici.</div> :
          <div className="table-scroll"><table className="review-table saved-table">
            <thead><tr>
              <SortHeader label="Carte" column="name" sort={priceSort} onSort={(column) => setPriceSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Rareté" column="rarity" sort={priceSort} onSort={(column) => setPriceSort((sort) => nextSort(sort, column))} />
              <SortHeader label="Prix moyen" column="average" sort={priceSort} onSort={(column) => setPriceSort((sort) => nextSort(sort, column))} />
            </tr></thead>
            <tbody>{sortedPrices.map((price) => <tr key={priceKey(price.card_name, price.card_type)}>
              <td>{price.card_name}</td><td><span className={`rarity-badge ${rarityClass(price.card_type)}`}>{price.card_type}</span></td><td>{priceEditor(price.card_name, price.card_type, `saved-${priceKey(price.card_name, price.card_type)}`)}</td>
            </tr>)}</tbody>
          </table></div>)}
      </section>}

      {priceMessage && <p className="notice" role="status">{priceMessage}</p>}
      {loadingPrices && <p className="notice" role="status">Chargement des prix moyens…</p>}
      {currentState?.status === "error" && <p className="notice error" role="alert">{currentState.message} Actualisez la page pour réessayer.</p>}

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
