import { FiMapPin } from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";
import { MdOutlineShield } from "react-icons/md";

export const UNIT_ICON: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  KANWIL: FiMapPin,
  KANCAB: LuBuilding2,
  DIVISI: MdOutlineShield,
};
