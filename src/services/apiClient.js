import axios from "axios";

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

const apiClient = axios.create({
  baseURL: SERVER_URL,
  withCredentials: true,
  headers: {
    "ngrok-skip-browser-warning": "true",
    "Content-Type": "application/json",
  },
});

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.response?.status, error.config?.url, error.message);
    return Promise.reject(error);
  }
);

export default apiClient;
