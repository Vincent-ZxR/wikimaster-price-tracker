export type Confidence = "high" | "medium" | "low";

export interface ExtractedCard {
  id: string;
  cardName: string;
  cardType: string | null;
  bidKind: "startingPrice" | "currentPrice";
  currentPrice: number | null;
  startingPrice: number | null;
  remainingTime: string | null;
  seller: string | null;
  confidence: Confidence;
}

export type AveragePrice = {
  user_id: string;
  card_name: string;
  name_key: string;
  card_type: string;
  average_price: number;
};

export type PriceSummary = {
  name_key: string;
  card_type: string;
  sample_count: number;
  lower_quartile: number;
  upper_quartile: number;
};

export type TrackedPrice = Omit<PriceSummary, "lower_quartile" | "upper_quartile"> & {
  lower_quartile: number | null;
  upper_quartile: number | null;
};

export type HistoricalBid = {
  current_price: number;
  observed_at: string;
};

export type HistoricalAverage = {
  average_price: number;
  recorded_at: string | null;
};

type AveragePriceHistory = HistoricalAverage & {
  id: string;
  user_id: string;
  name_key: string;
  card_type: string;
};

type PriceObservation = {
  capture_hash: string;
  position: number;
  name_key: string;
  card_type: string;
  current_price: number;
  observed_at: string;
  seller_key: string | null;
  expires_at: string | null;
  captured_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      average_prices: {
        Row: AveragePrice;
        Insert: AveragePrice;
        Update: Partial<AveragePrice>;
        Relationships: [];
      };
      average_price_history: {
        Row: AveragePriceHistory;
        Insert: Omit<AveragePriceHistory, "id"> & { id?: string };
        Update: Partial<AveragePriceHistory>;
        Relationships: [];
      };
      price_observations: {
        Row: PriceObservation;
        Insert: Omit<PriceObservation, "observed_at" | "seller_key" | "expires_at" | "captured_at"> & {
          observed_at?: string; seller_key?: string | null; expires_at?: string | null; captured_at?: string | null;
        };
        Update: Partial<PriceObservation>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      record_price_observations: {
        Args: {
          p_capture_hash: string;
          p_captured_at: string | null;
          p_observations: {
            position: number; name_key: string; card_type: string; current_price: number;
            seller_key: string | null; expires_at: string | null;
          }[];
        };
        Returns: { inserted: number; updated: number; unmatched: number; duplicate: boolean }[];
      };
      price_observation_summaries: {
        Args: { keys: { name_key: string; card_type: string }[] };
        Returns: PriceSummary[];
      };
      price_tracking_cards: {
        Args: Record<string, never>;
        Returns: TrackedPrice[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
