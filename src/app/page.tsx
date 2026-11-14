"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { parseMarketplaceText } from "@/lib/parse-marketplace";
import type { ExtractedCard, MarketListing } from "@/lib/types";

function formatPrice(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function toDraft(card: Omit<ExtractedCard, "id">): ExtractedCard {
  return { ...card, id: crypto.randomUUID() };
}

function updateCard(
  cards: ExtractedCard[],
  id: string,
  field: keyof ExtractedCard,
  value: string,
): ExtractedCard[] {
  return cards.map((card) =>
    card.id === id
      ? {
          ...card,
          [field]:
            field === "startingPrice" || field === "currentPrice"
              ? value === ""
                ? null
                : Number(value)
              : value,
        }
      : card,
  );
}

type SavedState =
  | { userId: string; status: "ready"; listings: MarketListing[] }
  | { userId: string; status: "error" };

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.75h7.5L19 8.3v11.95H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z" />
      <path d="M14 4v4.5h4.5M9 13h6m-6 3.5h6" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export default function Home() {
  const [supabase] = useState<SupabaseClient | null>(() =>
    createSupabaseBrowserClient(),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(
    () =>
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [text, setText] = useState("");
  const [cards, setCards] = useState<ExtractedCard[]>([]);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [savedState, setSavedState] = useState<SavedState | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setAuthReady(true);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthMessage("Could not check your sign-in. Please refresh.");
      setSession(data.session);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session) return;

    let active = true;
    void supabase
      .from("market_listings")
      .select(
        "id, card_name, card_type, subtitle, current_price, starting_price, remaining_time, seller, confidence, captured_at, created_at",
      )
      .order("captured_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setSavedState({ userId: session.user.id, status: "error" });
          setNotice("Could not load saved cards. Check that the database setup is complete.");
        } else {
          setSavedState({
            userId: session.user.id,
            status: "ready",
            listings: (data ?? []) as MarketListing[],
          });
        }
      });

    return () => {
      active = false;
    };
  }, [session, supabase]);

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
      return;
    }
    setEmailSent(true);
    setAuthMessage("Check your inbox for your sign-in link.");
  }

  async function handleSignOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setAuthMessage("Could not sign out. Please try again.");
  }

  function handleAnalyze() {
    const result = parseMarketplaceText(text);
    setCards(result.cards.map(toDraft));
    setNotice(
      [
        result.cards.length
          ? `${result.cards.length} annonce(s) détectée(s). Vérifiez tous les champs avant l'enregistrement.`
          : "",
        ...result.warnings,
      ].filter(Boolean).join(" "),
    );
  }

  async function handleSave() {
    if (!supabase || !session || !capturedAt || cards.length === 0) return;
    if (cards.some((card) => !card.cardName.trim())) {
      setNotice("Every card needs a name before it can be saved.");
      return;
    }

    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ capturedAt, cards }),
      });
      const result = (await response.json()) as {
        saved?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Could not save these cards.");
      }

      setNotice(`${result.saved ?? cards.length} cards saved to your database.`);
      setCards([]);
      const { data, error } = await supabase
        .from("market_listings")
        .select(
          "id, card_name, card_type, subtitle, current_price, starting_price, remaining_time, seller, confidence, captured_at, created_at",
        )
        .order("captured_at", { ascending: false })
        .limit(20);
      if (error) {
        setNotice("Cards were saved, but the recent-card list could not be refreshed.");
      } else {
        setSavedState({
          userId: session.user.id,
          status: "ready",
          listings: (data ?? []) as MarketListing[],
        });
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save these cards.");
    } finally {
      setSaving(false);
    }
  }

  const supabaseConfigured = Boolean(supabase);
  const visibleSavedListings =
    session && savedState?.userId === session.user.id && savedState.status === "ready"
      ? savedState.listings
      : [];
  const savedLoading = Boolean(session && savedState?.userId !== session.user.id);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Wikimaster price tracker home">
          <span className="brand-mark"><CardIcon /></span>
          <span className="brand-name">WIKI<span>TRACK</span></span>
        </a>
        <div className="topbar-right">
          <span className="topbar-caption"><span className="status-dot" /> MARKET ARCHIVE</span>
          {session ? (
            <div className="account-chip">
              <span className="account-email">{session.user.email}</span>
              <button className="text-button" onClick={handleSignOut} type="button">
                Sign out
              </button>
            </div>
          ) : (
            <span className="topbar-caption">PERSONAL WORKSPACE</span>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span>01</span> LE MARCHÉ EN UN COPIER-COLLER</div>
          <h1>Chaque carte.<br /><span>Suivie.</span></h1>
          <p>
            Copiez le texte du marché WikiMasters pour créer votre historique
            de prix en quelques secondes.
          </p>
        </div>
        <div className="hero-side">
          <div className="hero-stat">
            <span className="stat-number">{visibleSavedListings.length.toString().padStart(2, "0")}</span>
            <span className="stat-label">ANNONCES RÉCENTES</span>
          </div>
          <div className="hero-rule" />
          <div className="hero-steps">
            <span><b>01</b> Copier</span><span><b>02</b> Vérifier</span><span><b>03</b> Enregistrer</span>
          </div>
        </div>
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
      </section>

      {!supabaseConfigured && (
        <div className="setup-notice" role="status">
          <strong>Configuration nécessaire</strong>
          <span>
            L’analyse fonctionne sans compte. Pour enregistrer les annonces,
            configurez Supabase avec <code>.env.example</code>, puis redémarrez.
          </span>
        </div>
      )}

      {supabaseConfigured && !session && authReady && (
        <section className="auth-panel" aria-labelledby="signin-heading">
          <div className="section-index">ACCESS <span>01</span></div>
          <div>
            <h2 id="signin-heading">Votre historique privé</h2>
            <p>Connectez-vous par email pour enregistrer et consulter vos annonces.</p>
          </div>
          <form className="signin-form" onSubmit={handleSignIn}>
            <label className="sr-only" htmlFor="email">Adresse email</label>
            <input
              autoComplete="email"
              id="email"
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailSent(false);
              }}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
            <button className="primary-button" disabled={authBusy || emailSent} type="submit">
              {authBusy ? "Envoi…" : emailSent ? "Lien envoyé" : "Recevoir un lien de connexion"}
              {!authBusy && !emailSent && <ArrowIcon />}
            </button>
          </form>
          {authMessage && <p className="inline-message" role="status">{authMessage}</p>}
        </section>
      )}

      {supabaseConfigured && !authReady && (
        <div className="loading-panel">Vérification de la connexion…</div>
      )}

      <>
          <section className="workspace-grid" id="import">
            <div className="section-intro">
              <div className="section-index">IMPORT <span>02</span></div>
              <h2>Collez le texte du marché</h2>
              <p>
                Sur WikiMasters, sélectionnez et copiez le texte du marché,
                puis collez-le ici avec <kbd>Ctrl</kbd> + <kbd>V</kbd>.
              </p>
              <ul className="privacy-points">
                <li><span>✓</span> Analyse gratuite dans votre navigateur</li>
                <li><span>✓</span> Aucune image ni IA payante</li>
                <li><span>✓</span> Vérifiez les données avant l’enregistrement</li>
              </ul>
            </div>
            <div className="text-import">
              <label htmlFor="market-text">Texte copié depuis WikiMasters</label>
              <textarea
                id="market-text"
                value={text}
                disabled={saving}
                onChange={(event) => {
                  setText(event.target.value);
                  setCapturedAt(new Date().toISOString());
                  setCards([]);
                  setNotice("");
                }}
                placeholder="Collez ici le texte des annonces du marché…"
              />
              <span>Copiez le texte des cartes, y compris les mises, durées et vendeurs.</span>
            </div>
          </section>

          <section className="analysis-bar" aria-live="polite">
            <div className="analysis-note">
              <span className="sparkle">✳</span>
              <span>Le texte est analysé localement. Seules les annonces confirmées sont envoyées à Supabase.</span>
            </div>
            <button
              className="primary-button analyze-button"
              disabled={!text.trim() || saving}
              onClick={handleAnalyze}
              type="button"
            >
              Analyser le texte <ArrowIcon />
            </button>
          </section>

          {notice && <div className="notice" role="status">{notice}</div>}

          {cards.length > 0 && (
            <section className="review-section" aria-labelledby="review-heading">
              <div className="section-heading">
                <div>
                  <div className="section-index">REVIEW <span>03</span></div>
                  <h2 id="review-heading">Vérifiez les annonces</h2>
                </div>
                <span className="record-count">{cards.length} DETECTED</span>
              </div>
              <div className="table-scroll">
                <table className="review-table">
                  <thead>
                    <tr>
                      <th>Carte / description</th>
                      <th>Type</th>
                      <th>Mise actuelle</th>
                      <th>Mise de départ</th>
                      <th>Durée restante</th>
                      <th>Vendeur</th>
                      <th>Vérification</th>
                      <th aria-label="Remove card" />
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((card, index) => (
                      <tr key={card.id}>
                        <td>
                          <label className="sr-only" htmlFor={`name-${card.id}`}>Card or player name</label>
                          <input
                            id={`name-${card.id}`}
                            className="table-input name-input"
                            onChange={(event) => setCards((current) => updateCard(current, card.id, "cardName", event.target.value))}
                            value={card.cardName}
                          />
                          <label className="sr-only" htmlFor={`subtitle-${card.id}`}>Description de l’annonce {index + 1}</label>
                          <input
                            id={`subtitle-${card.id}`}
                            className="table-input subtitle-input"
                            onChange={(event) => setCards((current) => updateCard(current, card.id, "subtitle", event.target.value))}
                            placeholder="Description"
                            value={card.subtitle ?? ""}
                          />
                        </td>
                        <td>
                          <label className="sr-only" htmlFor={`type-${card.id}`}>Card type</label>
                          <input
                            id={`type-${card.id}`}
                            className="table-input type-input"
                            onChange={(event) => setCards((current) => updateCard(current, card.id, "cardType", event.target.value))}
                            value={card.cardType ?? ""}
                          />
                        </td>
                        <td>
                          <label className="sr-only" htmlFor={`current-${card.id}`}>Current price</label>
                          <input
                            id={`current-${card.id}`}
                            className="table-input number-input"
                            min="0"
                            onChange={(event) => setCards((current) => updateCard(current, card.id, "currentPrice", event.target.value))}
                            type="number"
                            value={card.currentPrice ?? ""}
                          />
                        </td>
                        <td>
                          <label className="sr-only" htmlFor={`starting-${card.id}`}>Starting price</label>
                          <input
                            id={`starting-${card.id}`}
                            className="table-input number-input"
                            min="0"
                            onChange={(event) => setCards((current) => updateCard(current, card.id, "startingPrice", event.target.value))}
                            type="number"
                            value={card.startingPrice ?? ""}
                          />
                        </td>
                        <td>
                          <label className="sr-only" htmlFor={`remaining-${card.id}`}>Time remaining</label>
                          <input
                            id={`remaining-${card.id}`}
                            className="table-input time-input"
                            onChange={(event) => setCards((current) => updateCard(current, card.id, "remainingTime", event.target.value))}
                            value={card.remainingTime ?? ""}
                          />
                        </td>
                        <td>
                          <label className="sr-only" htmlFor={`seller-${card.id}`}>Seller</label>
                          <input
                            id={`seller-${card.id}`}
                            className="table-input seller-input"
                            onChange={(event) => setCards((current) => updateCard(current, card.id, "seller", event.target.value))}
                            value={card.seller ?? ""}
                          />
                        </td>
                        <td><span className={`confidence confidence-${card.confidence}`}>À vérifier</span></td>
                        <td>
                          <button
                            aria-label={`Remove ${card.cardName || "card"}`}
                            className="remove-row"
                            onClick={() => setCards((current) => current.filter((entry) => entry.id !== card.id))}
                            type="button"
                          >×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="review-footer">
                <span className="review-footnote">Les noms et vendeurs peuvent être collés : vérifiez toutes les valeurs. L’heure de copie sert de référence pour la durée.</span>
                <button className="primary-button save-button" disabled={saving || !session} onClick={handleSave} type="button">
                  {!session ? "Connectez-vous pour enregistrer" : saving ? "Enregistrement…" : `Enregistrer ${cards.length} annonce(s)`}
                  {!saving && <ArrowIcon />}
                </button>
              </div>
            </section>
          )}

          {session && <section className="saved-section" id="recent">
            <div className="section-heading">
              <div>
                <div className="section-index">ARCHIVE <span>04</span></div>
                <h2>Recently tracked</h2>
              </div>
              <span className="record-count">{visibleSavedListings.length} SHOWN</span>
            </div>
            {savedLoading ? (
              <div className="empty-state">Loading your saved cards…</div>
            ) : savedState?.status === "error" &&
              session?.user.id === savedState.userId ? (
              <div className="empty-state">Could not load your saved cards. Please refresh.</div>
            ) : visibleSavedListings.length === 0 ? (
              <div className="empty-state">
                <span className="empty-mark">—</span>
                <span>Votre historique est vide. Analysez le texte du marché pour ajouter des annonces.</span>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="review-table saved-table">
                  <thead>
                    <tr>
                      <th>Carte</th>
                      <th>Type</th>
                      <th>Mise actuelle</th>
                      <th>Mise de départ</th>
                      <th>Durée lors de la copie</th>
                      <th>Vendeur</th>
                      <th>Copié le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSavedListings.map((listing) => (
                      <tr key={listing.id}>
                        <td>
                          <span className="saved-name">{listing.card_name}</span>
                          {listing.subtitle && <span className="table-subtext">{listing.subtitle}</span>}
                        </td>
                        <td>{listing.card_type || "—"}</td>
                        <td className="price-cell">{formatPrice(listing.current_price)}</td>
                        <td>{formatPrice(listing.starting_price)}</td>
                        <td>{listing.remaining_time || "—"}</td>
                        <td>{listing.seller || "—"}</td>
                        <td>{new Date(listing.captured_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>}
        </>

      <footer className="footer">
        <span>WIKITRACK <span className="footer-separator">/</span> PRIVATE MARKET ARCHIVE</span>
        <span>Built for your collection.</span>
      </footer>
    </main>
  );
}
