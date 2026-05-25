export interface UnitChild {
  id: string;
  name: string;
  type: string;
}

export interface RegionWithBranches {
  id: string;
  name: string;
  type?: string;
  children: UnitChild[];
}
