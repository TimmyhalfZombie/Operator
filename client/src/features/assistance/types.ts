export type AssistanceRequest = {
  id: string;
  clientName: string;
  placeName: string;
  address: string;
  coords?: { lat: number; lng: number } | null; // ← nullable
};
