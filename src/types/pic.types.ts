export interface PicSearchResult {
  id: string;
  name: string;
  username: string | null;
  unitId: string | null;
  unit: {
    id: string;
    name: string;
    type: string;
  } | null;
}
