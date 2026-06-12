import axios from "axios";

// Unified backend response format (API-01)
export interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
}

export const TOKEN_KEY = "aima_token";

const client = axios.create({ baseURL: "/api" });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ?? "Cannot reach the server. Please try again.";
    return Promise.reject(new Error(message));
  }
);

export default client;
