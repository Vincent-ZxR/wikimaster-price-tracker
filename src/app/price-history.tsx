"use client";

import { useEffect, useState } from "react";
import { priceChart } from "@/lib/price-chart";
import type { HistoricalAverage, HistoricalBid } from "@/lib/types";

type HistoryResult = {
  token: string;
  revision: number;
  retry: number;
} & ({ observations: HistoricalBid[]; averages: HistoricalAverage[]; error: null } | { observations: null; averages: null; error: string });

function formatTime(value: string | number) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function PriceHistory({ name, rarity, token, revision, onClose }: {
  name: string;
  rarity: string;
  token: string;
  revision: number;
  onClose: () => void;
}) {
  const [result, setResult] = useState<HistoryResult | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/price-observations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "history", name, rarity }),
        });
        const data: { observations?: HistoricalBid[]; averages?: HistoricalAverage[]; error?: string } = await response.json();
        if (!response.ok || !data.observations || !data.averages) throw new Error(data.error || "Impossible de charger l’historique.");
        if (active) setResult({ token, revision, retry, observations: data.observations, averages: data.averages, error: null });
      } catch (error) {
        if (active) setResult({
          token, revision, retry, observations: null, averages: null,
          error: error instanceof Error ? error.message : "Impossible de charger l’historique.",
        });
      }
    })();
    return () => { active = false; };
  }, [name, rarity, token, revision, retry]);

  const current = result?.token === token && result.revision === revision && result.retry === retry ? result : null;
  const bids = current?.observations ?? [];
  const averages = current?.averages ?? [];
  const datedAverages = averages.filter((average): average is HistoricalAverage & { recorded_at: string } => average.recorded_at !== null);
  const chart = priceChart(bids, averages);

  return <section id="price-history" className="history-panel" aria-labelledby="history-heading">
    <div className="section-heading">
      <div><h2 id="history-heading">Historique : {name} <span className="muted">({rarity})</span></h2>
        <p>Les mises peuvent provenir d’enchères différentes et ne sont pas des prix de vente. Les moyennes saisies sont personnelles.</p></div>
      <button className="text-button" type="button" onClick={onClose}>Fermer</button>
    </div>
    {!current && <p className="notice" role="status">Chargement de l’historique…</p>}
    {current?.error && <div role="alert" className="notice error">{current.error}{" "}
      <button className="text-button" type="button" onClick={() => setRetry((value) => value + 1)}>Réessayer</button></div>}
    {current && !current.error && !chart && <div className="empty-state">Aucune observation datée à afficher sur la courbe.</div>}
    {bids.length === 1 && <p className="notice">Mise actuelle enregistrée : {bids[0].current_price.toLocaleString("fr-FR")} · {formatTime(bids[0].observed_at)}</p>}
    {chart && <>
      <div className="chart-legend"><span className="legend-bid">Mises actuelles ({bids.length})</span><span className="legend-average">Moyennes personnelles datées ({datedAverages.length})</span></div>
      <div className="chart-layout">
        <div className="chart-values"><span>{chart.maximum.toLocaleString("fr-FR")}</span>
          {chart.minimum !== chart.maximum && <span>{chart.minimum.toLocaleString("fr-FR")}</span>}</div>
        <svg className="price-chart" viewBox="0 0 800 200" role="img"
          aria-label={`Courbes de ${bids.length} mises observées et ${datedAverages.length} moyennes personnelles, de ${chart.minimum.toLocaleString("fr-FR")} à ${chart.maximum.toLocaleString("fr-FR")}. Le détail est disponible ci-dessous.`}>
          <line x1="8" y1="188" x2="792" y2="188" className="chart-grid" />
          {bids.length > 1 && <polyline className="chart-line" points={chart.bidPoints.map(({ x, y }) => `${x},${y}`).join(" ")} />}
          {bids.map((bid, index) => <circle key={index} cx={chart.bidPoints[index].x} cy={chart.bidPoints[index].y} r="3" className="chart-point">
            <title>Mise actuelle · {formatTime(bid.observed_at)} : {bid.current_price.toLocaleString("fr-FR")}</title>
          </circle>)}
          {datedAverages.length > 1 && <polyline className="chart-line chart-average-line" points={chart.averagePoints.map(({ x, y }) => `${x},${y}`).join(" ")} />}
          {datedAverages.map((average, index) => <circle key={index} cx={chart.averagePoints[index].x} cy={chart.averagePoints[index].y} r="4" className="chart-average-point">
            <title>Moyenne personnelle · {formatTime(average.recorded_at)} : {average.average_price.toLocaleString("fr-FR")}</title>
          </circle>)}
        </svg>
      </div>
      <div className="chart-dates"><span>{formatTime(chart.first)}</span>{chart.first !== chart.last && <span>{formatTime(chart.last)}</span>}</div>
    </>}
    {current && !current.error && <>
      <details className="history-details">
        <summary>Voir les {bids.length} mise(s) actuelle(s)</summary>
        <div className="history-table-scroll"><table className="review-table">
          <thead><tr><th>Date de l’analyse</th><th>Mise actuelle</th></tr></thead>
          <tbody>{bids.map((bid, index) => <tr key={index}><td>{formatTime(bid.observed_at)}</td><td>{bid.current_price.toLocaleString("fr-FR")}</td></tr>)}</tbody>
        </table></div>
      </details>
      <details className="history-details">
        <summary>Voir les {averages.length} moyenne(s) personnelle(s)</summary>
        <div className="history-table-scroll"><table className="review-table">
          <thead><tr><th>Date de saisie</th><th>Prix moyen personnel</th></tr></thead>
          <tbody>{averages.map((average, index) => <tr key={index}><td>{average.recorded_at === null ? "Date inconnue" : formatTime(average.recorded_at)}</td><td>{average.average_price.toLocaleString("fr-FR")}</td></tr>)}</tbody>
        </table></div>
      </details>
      {averages.some((average) => average.recorded_at === null) && <p className="footnote">La date de la moyenne enregistrée avant l’activation de l’historique est inconnue : elle apparaît dans le détail, mais pas sur la courbe.</p>}
    </>}
  </section>;
}
