import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const getBusinessUnits = async (token: string) => {
  const res = await axios.get(`${API_URL}/business-units`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const getUsers = async (token: string) => {
  const res = await axios.get(`${API_URL}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};
