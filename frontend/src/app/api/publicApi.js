import { apiUrl } from "./http.js";

export const publicApi = {
  getHomeData: async () => {
    const res = await fetch(apiUrl("/api/public/home-data"));
    return { data: await res.json() };
  },
};
