import axios from "axios";

export const PLANT_CONTEXT_KEY = 'ecmPlantContext';

const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
  withCredentials: true,
});

export const readPlantContext = () => {
  try {
    if (typeof window === 'undefined') return {};

    const stored = window.sessionStorage?.getItem(PLANT_CONTEXT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        plantCode: parsed.plantCode || '',
        plantScopeFilter: parsed.plantScopeFilter,
      };
    }

    if (window.name) {
      const parsed = JSON.parse(window.name);
      return {
        plantCode: parsed.plantCode || '',
        plantScopeFilter: parsed.plantScopeFilter,
      };
    }
  } catch (err) {
    console.warn('Failed to read plant context:', err);
  }

  return { plantCode: '', plantScopeFilter: undefined };
};

export const persistPlantContext = (context) => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;

    if (context && context.plantCode) {
      const payload = {
        plantCode: context.plantCode,
        plantScopeFilter:
          typeof context.plantScopeFilter === 'boolean'
            ? context.plantScopeFilter
            : undefined,
      };
      window.sessionStorage.setItem(PLANT_CONTEXT_KEY, JSON.stringify(payload));
    } else {
      window.sessionStorage.removeItem(PLANT_CONTEXT_KEY);
    }
  } catch (err) {
    console.warn('Failed to persist plant context:', err);
  }
};

instance.interceptors.request.use((config) => {
  const { plantCode, plantScopeFilter } = readPlantContext();
  config.headers = config.headers || {};

  if (plantCode) {
    config.headers['X-Plant-Code'] = plantCode;
  }

  if (typeof plantScopeFilter === 'boolean') {
    config.headers['X-Plant-Scope-Filter'] = plantScopeFilter ? 'true' : 'false';
  }

  return config;
});

export default instance;
