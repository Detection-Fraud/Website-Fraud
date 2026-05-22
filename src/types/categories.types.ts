export interface CategoryProgram {
  id: string;
  name: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

export interface Categories {
  id: string;
  name: string;
  color: string;

  totalProgram: number;
  totalActive: number;
  totalInActive: number;

  programs: CategoryProgram;
}

export interface GlobalSummary {
  totalCategory: number;
  totalPrograms: number;
  activePrograms: number;
  uncategorized: number;
}

export interface CategoryResponse {
  data: Categories[];
  summary: GlobalSummary;
}
