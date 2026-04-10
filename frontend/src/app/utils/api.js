const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const apiGet = async (path) => {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json();
};

export { API_BASE_URL };
