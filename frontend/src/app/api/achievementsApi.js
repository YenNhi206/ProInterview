import { apiUrl } from "./http.js";
import { authFetch } from "../utils/auth/auth.js";

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export const achievementsApi = {
  getAll: async (all = false) => {
    const res = await authFetch(`/api/achievements?all=${all}`);
    return { data: await res.json() };
  },

  getById: async (id) => {
    const res = await fetch(apiUrl(`/api/achievements/${id}`));
    return { data: await res.json() };
  },

  create: async (data) => {
    const res = await authFetch("/api/achievements", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return { data: await res.json() };
  },

  update: async (id, data) => {
    const res = await authFetch(`/api/achievements/${id}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return { data: await res.json() };
  },

  delete: async (id) => {
    const res = await authFetch(`/api/achievements/${id}`, {
      method: "DELETE",
    });
    return { data: await res.json() };
  },
  
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await authFetch("/api/upload/achievement-image", {
      method: "POST",
      body: formData,
    });
    return { data: await res.json() };
  }
};
