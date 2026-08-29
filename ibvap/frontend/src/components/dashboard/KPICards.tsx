import React, { useState, useEffect, useCallback } from 'react';
import {
  Video,
  Users,
  Car,
  Bell,
} from 'lucide-react';
import { DashboardSummary } from '../../types';
import { registryStorage } from '../../services/registryStorage';
import { alertRules } from '../../utils/alertRules';
import { eventsApi } from '../../api/eventsApi';

interface KPICardsProps {
  summary: DashboardSummary;
  activeThreatsCount?: number;
}

export const KPICards: React.FC<KPICardsProps> = ({ summary }) => {
  const [peopleCount, setPeopleCount] = useState<number>(0);
  const [vehiclesCount, setVehiclesCount] = useState<number>(0);
  const [actualAlertsCount, setActualAlertsCount] = useState<number>(0);

  const calculateAlerts = useCallback(async () => {
    try {
      const recent = await eventsApi.getEvents({ limit: 100 });
      const filtered = alertRules.filterAlerts(recent);
      setActualAlertsCount(filtered.length);
    } catch {
      // safe fallback
    }
  }, []);

  useEffect(() => {
    const updateCounts = () => {
      setPeopleCount(registryStorage.getPeople().length);
      setVehiclesCount(registryStorage.getVehicles().length);
      calculateAlerts();
    };
    updateCounts();
    window.addEventListener('ibvap_people_updated', updateCounts);
    window.addEventListener('ibvap_vehicles_updated', updateCounts);
    const interval = setInterval(calculateAlerts, 5000);
    return () => {
      window.removeEventListener('ibvap_people_updated', updateCounts);
      window.removeEventListener('ibvap_vehicles_updated', updateCounts);
      clearInterval(interval);
    };
  }, [calculateAlerts]);

  const cards = [
    {
      title: 'CAMERAS',
      value: summary.total_cameras,
      subtitle: `Online: ${summary.active_cameras}`,
      icon: <Video className="w-5 h-5 text-emerald-400" />,
      color: 'border-emerald-500/30',
      alert: false,
    },
    {
      title: 'PEOPLE',
      value: peopleCount,
      subtitle: 'Registered',
      icon: <Users className="w-5 h-5 text-blue-400" />,
      color: 'border-blue-500/30',
      alert: false,
    },
    {
      title: 'VEHICLES',
      value: vehiclesCount,
      subtitle: 'Registered',
      icon: <Car className="w-5 h-5 text-amber-400" />,
      color: 'border-amber-500/30',
      alert: false,
    },
    {
      title: 'ALERTS',
      value: actualAlertsCount,
      subtitle: actualAlertsCount > 0 ? 'Needs attention' : 'All clear',
      icon: <Bell className={`w-5 h-5 ${actualAlertsCount > 0 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} />,
      color: actualAlertsCount > 0 ? 'border-red-500/40' : 'border-surface-border',
      alert: actualAlertsCount > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className={`bg-surface border ${card.color} rounded-xl p-5 shadow-md overflow-hidden transition-all duration-200 hover:border-slate-500/60 font-mono`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 tracking-wider">
              {card.title}
            </span>
            <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
              {card.icon}
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span
              className={`text-3xl font-bold ${
                card.alert ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {card.value}
            </span>
            <span className="text-xs text-slate-400">{card.subtitle}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default KPICards;
