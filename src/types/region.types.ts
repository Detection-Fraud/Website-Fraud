export interface Branch {
  id: string;
  name: string;
  regionId: string;
}

export interface RegionWithBranches {
  id: string;
  name: string;
  branches: Branch[];
}
