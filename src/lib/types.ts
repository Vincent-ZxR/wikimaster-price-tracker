export type Confidence = "high" | "medium" | "low";

export interface ExtractedCard {
  id: string;
  cardName: string;
  cardType: string | null;
  subtitle: string | null;
  currentPrice: number | null;
  startingPrice: number | null;
  remainingTime: string | null;
  seller: string | null;
  confidence: Confidence;
}

export type MarketListing = {
  id: string;
  card_name: string;
  card_type: string | null;
  subtitle: string | null;
  current_price: number | null;
  starting_price: number | null;
  remaining_time: string | null;
  seller: string | null;
  confidence: Confidence;
  captured_at: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      market_listings: {
        Row: MarketListing & { user_id: string };
        Insert: Omit<MarketListing, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
          user_id: string;
        };
        Update: Partial<MarketListing>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
