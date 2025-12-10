import axios from "axios";

export const API_BASE = "http://10.0.2.2:5000";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export function attachAuthInterceptors(onUnauthorized: () => void) {
  api.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err?.response?.status === 401) {
        onUnauthorized();
      }
      return Promise.reject(err);
    }
  );
}
