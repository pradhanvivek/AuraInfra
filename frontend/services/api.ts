import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.apiUrl || '';

const getAuthHeaders = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

// Auth API
export const authApi = {
  getProfile: async (token: string) => {
    const response = await axios.get(
      `${API_URL}/api/auth/profile`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  updateProfile: async (token: string, data: { email?: string; phone?: string; warranty_reminder_days?: number }) => {
    const response = await axios.put(
      `${API_URL}/api/auth/profile`,
      data,
      getAuthHeaders(token)
    );
    return response.data;
  },
};

// Property API
export const propertyApi = {
  getAll: async (token: string) => {
    const response = await axios.get(
      `${API_URL}/api/properties`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  getById: async (token: string, id: string) => {
    const response = await axios.get(
      `${API_URL}/api/properties/${id}`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  create: async (token: string, data: { name: string; address: string; latitude?: number; longitude?: number }) => {
    const response = await axios.post(
      `${API_URL}/api/properties`,
      data,
      getAuthHeaders(token)
    );
    return response.data;
  },

  update: async (token: string, id: string, data: { name?: string; address?: string; latitude?: number; longitude?: number }) => {
    const response = await axios.put(
      `${API_URL}/api/properties/${id}`,
      data,
      getAuthHeaders(token)
    );
    return response.data;
  },

  delete: async (token: string, id: string) => {
    const response = await axios.delete(
      `${API_URL}/api/properties/${id}`,
      getAuthHeaders(token)
    );
    return response.data;
  },
};

// Document API
export const documentApi = {
  getAll: async (token: string, propertyId: string) => {
    const response = await axios.get(
      `${API_URL}/api/properties/${propertyId}/documents`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  create: async (
    token: string,
    propertyId: string,
    data: { name: string; file_data: string; file_type: string }
  ) => {
    const response = await axios.post(
      `${API_URL}/api/properties/${propertyId}/documents`,
      data,
      getAuthHeaders(token)
    );
    return response.data;
  },

  delete: async (token: string, propertyId: string, documentId: string) => {
    const response = await axios.delete(
      `${API_URL}/api/properties/${propertyId}/documents/${documentId}`,
      getAuthHeaders(token)
    );
    return response.data;
  },
};

// Fixture API
export const fixtureApi = {
  getAll: async (token: string, propertyId: string) => {
    const response = await axios.get(
      `${API_URL}/api/properties/${propertyId}/fixtures`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  getById: async (token: string, propertyId: string, fixtureId: string) => {
    const response = await axios.get(
      `${API_URL}/api/properties/${propertyId}/fixtures/${fixtureId}`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  create: async (token: string, propertyId: string, data: any) => {
    const response = await axios.post(
      `${API_URL}/api/properties/${propertyId}/fixtures`,
      data,
      getAuthHeaders(token)
    );
    return response.data;
  },

  update: async (
    token: string,
    propertyId: string,
    fixtureId: string,
    data: any
  ) => {
    const response = await axios.put(
      `${API_URL}/api/properties/${propertyId}/fixtures/${fixtureId}`,
      data,
      getAuthHeaders(token)
    );
    return response.data;
  },

  delete: async (token: string, propertyId: string, fixtureId: string) => {
    const response = await axios.delete(
      `${API_URL}/api/properties/${propertyId}/fixtures/${fixtureId}`,
      getAuthHeaders(token)
    );
    return response.data;
  },
};

// Measurement API
export const measurementApi = {
  getAll: async (token: string, propertyId: string) => {
    const response = await axios.get(
      `${API_URL}/api/properties/${propertyId}/measurements`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  getById: async (token: string, propertyId: string, measurementId: string) => {
    const response = await axios.get(
      `${API_URL}/api/properties/${propertyId}/measurements/${measurementId}`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  create: async (token: string, propertyId: string, data: any) => {
    const response = await axios.post(
      `${API_URL}/api/properties/${propertyId}/measurements`,
      data,
      getAuthHeaders(token)
    );
    return response.data;
  },

  update: async (
    token: string,
    propertyId: string,
    measurementId: string,
    data: any
  ) => {
    const response = await axios.put(
      `${API_URL}/api/properties/${propertyId}/measurements/${measurementId}`,
      data,
      getAuthHeaders(token)
    );
    return response.data;
  },

  delete: async (token: string, propertyId: string, measurementId: string) => {
    const response = await axios.delete(
      `${API_URL}/api/properties/${propertyId}/measurements/${measurementId}`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  analyzeFloorPlan: async (token: string, imageBase64: string) => {
    const response = await axios.post(
      `${API_URL}/api/measurements/analyze-floorplan`,
      { floor_plan_image: imageBase64 },
      getAuthHeaders(token)
    );
    return response.data;
  },
};

// Notification API
export const notificationApi = {
  getAll: async (token: string) => {
    const response = await axios.get(
      `${API_URL}/api/notifications`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  markAsRead: async (token: string, notificationId: string) => {
    const response = await axios.put(
      `${API_URL}/api/notifications/${notificationId}/read`,
      {},
      getAuthHeaders(token)
    );
    return response.data;
  },

  checkWarranties: async (token: string) => {
    const response = await axios.post(
      `${API_URL}/api/notifications/check-warranties`,
      {},
      getAuthHeaders(token)
    );
    return response.data;
  },
};

// Vastu API
export const vastuApi = {
  getAll: async (token: string, propertyId: string) => {
    const response = await axios.get(
      `${API_URL}/api/properties/${propertyId}/vastu`,
      getAuthHeaders(token)
    );
    return response.data;
  },

  create: async (token: string, propertyId: string, imageBase64: string) => {
    const response = await axios.post(
      `${API_URL}/api/properties/${propertyId}/vastu`,
      { floor_plan_image: imageBase64 },
      getAuthHeaders(token)
    );
    return response.data;
  },

  delete: async (token: string, propertyId: string, vastuId: string) => {
    const response = await axios.delete(
      `${API_URL}/api/properties/${propertyId}/vastu/${vastuId}`,
      getAuthHeaders(token)
    );
    return response.data;
  },
};
