/**
 * registryStorage.ts — Local persistence service for Registered People and Registered Vehicles.
 * Provides clean CRUD access without hardcoded fake data, emitting custom events for real-time sync.
 */

import { RegisteredPerson, RegisteredVehicle } from '../types';

const PEOPLE_STORAGE_KEY = 'ibvap_registered_people';
const VEHICLES_STORAGE_KEY = 'ibvap_registered_vehicles';

// In-memory fallback for environments without browser localStorage (e.g. Node tests)
const _memoryStore = new Map<string, string>();

function getItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // fallback
  }
  return _memoryStore.get(key) || null;
}

function setItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // fallback
  }
  _memoryStore.set(key, value);
}

function dispatchCustomEvent(name: string): void {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(name));
    }
  } catch {
    // ignore
  }
}

export const registryStorage = {
  // Clear all for testing
  clearAll(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(PEOPLE_STORAGE_KEY);
        localStorage.removeItem(VEHICLES_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    _memoryStore.clear();
    dispatchCustomEvent('ibvap_people_updated');
    dispatchCustomEvent('ibvap_vehicles_updated');
  },

  // --- PEOPLE ---
  getPeople(): RegisteredPerson[] {
    try {
      const data = getItem(PEOPLE_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addPerson(person: Omit<RegisteredPerson, 'created_at'>): RegisteredPerson {
    const people = this.getPeople();
    const newPerson: RegisteredPerson = {
      ...person,
      created_at: new Date().toISOString(),
    };
    // If ID exists, replace; else append
    const existingIdx = people.findIndex((p) => p.id === person.id);
    if (existingIdx >= 0) {
      people[existingIdx] = newPerson;
    } else {
      people.unshift(newPerson);
    }
    setItem(PEOPLE_STORAGE_KEY, JSON.stringify(people));
    dispatchCustomEvent('ibvap_people_updated');
    return newPerson;
  },

  deletePerson(id: string): void {
    const people = this.getPeople().filter((p) => p.id !== id);
    setItem(PEOPLE_STORAGE_KEY, JSON.stringify(people));
    dispatchCustomEvent('ibvap_people_updated');
  },

  lookupPerson(query: string): RegisteredPerson | undefined {
    if (!query) return undefined;
    const clean = query.trim().toLowerCase();
    return this.getPeople().find(
      (p) => p.id.toLowerCase() === clean || p.name.toLowerCase().includes(clean)
    );
  },

  // --- VEHICLES ---
  getVehicles(): RegisteredVehicle[] {
    try {
      const data = getItem(VEHICLES_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addVehicle(vehicle: Omit<RegisteredVehicle, 'created_at'>): RegisteredVehicle {
    const vehicles = this.getVehicles();
    const cleanPlate = vehicle.plate_number.replace(/\s+/g, '').toUpperCase();
    const newVehicle: RegisteredVehicle = {
      ...vehicle,
      plate_number: cleanPlate,
      created_at: new Date().toISOString(),
    };
    const existingIdx = vehicles.findIndex((v) => v.plate_number === cleanPlate || v.id === vehicle.id);
    if (existingIdx >= 0) {
      vehicles[existingIdx] = newVehicle;
    } else {
      vehicles.unshift(newVehicle);
    }
    setItem(VEHICLES_STORAGE_KEY, JSON.stringify(vehicles));
    dispatchCustomEvent('ibvap_vehicles_updated');
    return newVehicle;
  },

  deleteVehicle(idOrPlate: string): void {
    const clean = idOrPlate.replace(/\s+/g, '').toUpperCase();
    const vehicles = this.getVehicles().filter(
      (v) => v.id !== idOrPlate && v.plate_number !== clean
    );
    setItem(VEHICLES_STORAGE_KEY, JSON.stringify(vehicles));
    dispatchCustomEvent('ibvap_vehicles_updated');
  },

  lookupVehicle(plate: string): RegisteredVehicle | undefined {
    if (!plate) return undefined;
    const clean = plate.replace(/\s+/g, '').toUpperCase();
    return this.getVehicles().find((v) => v.plate_number === clean);
  },
};
