export type ImportantInformationItem = {
  id: string;
  imageUrl: string;
  altText: string;
  width: number;
  height: number;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminImportantInformationList = {
  items: ImportantInformationItem[];
  revision: number;
};

export type PicImportantInformationList = {
  items: ImportantInformationItem[];
};

export type ImportantInformationReorderInput = {
  ids: string[];
  revision: number;
};
