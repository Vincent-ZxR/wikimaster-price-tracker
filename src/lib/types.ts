export type Confidence = "high" | "medium" | "low";

export interface ExtractedCard {
  id: string;
  cardName: string;
  cardType: string | null;
  bidKind: "startingPrice" | "currentPrice";
  currentPrice: number | null;
  startingPrice: number | null;
  remainingTime: string | null;
  confidence: Confidence;
}

export type AveragePrice = {
  user_id: string;
  card_name: string;
  name_key: string;
  card_type: string;
  average_price: number;
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
