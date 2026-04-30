import { useMemo } from "react";

export const useFormatDate = (
  dateString?: string | Date | null,
  locale: string = "id-ID",
) => {
  return useMemo(() => {
    if (!dateString) return "-";

    const date = new Date(dateString);

    if (isNaN(date.getTime())) return "-";

    const day = date.getDate().toString().padStart(2, "0");
    const month = date.toLocaleString(locale, { month: "short" });
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  }, [dateString, locale]);
};
