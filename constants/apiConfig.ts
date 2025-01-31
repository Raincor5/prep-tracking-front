// This file contains the API endpoints for the application. Replace the API_BASE_URL with your server's base URL.

const API_BASE_URL = "https://right-macaque-mutually.ngrok-free.app/api"; // Replace with your server's base URL

const apiEndpoints = {
  recipes: `${API_BASE_URL}/recipes`,
  scale: `${API_BASE_URL}/scale`,
  processImage: `${API_BASE_URL}/process-image`,
};

export default apiEndpoints;
