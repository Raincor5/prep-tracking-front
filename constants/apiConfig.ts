const API_BASE_URL = "https://586eb02b5d1c.ngrok.app/api"; // Replace with your server's base URL

const apiEndpoints = {
  recipes: `${API_BASE_URL}/recipes`,
  scale: `${API_BASE_URL}/scale`,
  processImage: `${API_BASE_URL}/process-image`,
};

export default apiEndpoints;
