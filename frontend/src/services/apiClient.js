import axios from "axios";

// Backend is running on port 8080
const apiClient = axios.create({
  baseURL: "http://localhost:8080/api",
});

// --- API Functions ---

export const getPendingRequests = () => {
  return apiClient.get("/requests/pending");
};

export const getUnresolvedRequests = () => {
  return apiClient.get("/requests/unresolved");
};

export const getResolvedRequests = () => {
  return apiClient.get("/requests/resolved");
};

export const getKnowledgeBase = () => {
  return apiClient.get("/knowledge");
};

// Sends the supervisor's answer to the backend
export const resolveRequest = (id, answer) => {
  return apiClient.post(`/requests/${id}/resolve`, { answer: answer });
};
