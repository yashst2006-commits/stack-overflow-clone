import axios from "axios";

const backendUrl = (
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const axiosInstance = axios.create({
  baseURL: backendUrl,
  headers: {
    "Content-Type": "application/json",
  },
});
axiosInstance.interceptors.request.use((req) => {
  if (typeof window !== "undefined") {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      try {
        const token = JSON.parse(storedUser).token;

        if (token) {
          req.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error("[api] Invalid authentication data in localStorage", {
          message: error instanceof Error ? error.message : String(error),
        });
        localStorage.removeItem("user");
      }
    }
  }
  return req;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("[api] Request failed", {
      method: error.config?.method?.toUpperCase(),
      url: `${error.config?.baseURL || backendUrl}${error.config?.url || ""}`,
      status: error.response?.status || null,
      message:
        error.response?.data?.message || error.message || "Unknown API error",
      response: error.response?.data,
    });
    return Promise.reject(error);
  }
);

export default axiosInstance;
