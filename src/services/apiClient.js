import axios from "axios";

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

console.log("API Client configured with SERVER_URL:", SERVER_URL);

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
  console.log("Making request to:", config.baseURL + config.url, "Method:", config.method);
  return config;
});

// Log responses and errors
apiClient.interceptors.response.use(
  (response) => {
    console.log("Response successful:", response.status);
    return response;
  },
  (error) => {
    console.error("API Error:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
    });
    return Promise.reject(error);
  }
);

export default apiClient;
