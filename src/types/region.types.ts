export interface UnitChild {
  id: string;
  name: string;
  type: string;
}

export interface DivisiOption {
  id: string;
  name: string;
}

export interface RegionWithBranches {
  id: string;
  name: string;
  type?: string;
  children: UnitChild[];
}
