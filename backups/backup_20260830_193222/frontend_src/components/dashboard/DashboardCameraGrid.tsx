import React, { useState, useEffect, useCallback } from 'react';
import { Video, Radio, User, Car } from 'lucide-react';
import { Camera, SurveillanceEvent } from '../../types';
import { cameraApi } from '../../api/cameraApi';
import { eventsApi } from '../../api/eventsApi';
import { LiveCameraPreview } from '../cameras/LiveCameraPreview';

export const DashboardCameraGrid: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeLiveCamera, setActiveLiveCamera] = useState<Camera | null>(null);
  const [cameraAiRunning, setCameraAiRunning] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    try {
      const [camList, evList] = await Promise.all([
        cameraApi.getCameras(),
        eventsApi.getEvents({ limit: 50 }),
      ]);
      setCameras(camList);
      setEvents(evList);
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, [loadData]);

  const toggleAiRunning = (camId: string) => {
    setCameraAiRunning((prev) => ({
      ...prev,
      [camId]: !prev[camId],
    }));
  };

  // Compute detected person & vehicle counts for each camera from recent events
  const getCameraDetections = (camId: string) => {
    const camEvents = events.filter((e) => e.camera_id === camId);
    const personCount = camEvents.filter(
      (e) => e.event_type === 'PERSON_DETECTED' || e.event_type === 'INTRUSION_DETECTED'
    ).length;
    const vehicleCount = camEvents.filter(
      (e) => e.event_type === 'VEHICLE_DETECTED' || e.event_type === 'ANPR_DETECTED' || e.event_type === 'WATCHLIST_MATCH'
    ).length;
    return { personCount, vehicleCount };
  };

  if (loading && cameras.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-44 bg-surface border border-surface-border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="p-8 text-center bg-surface border border-surface-border rounded-xl text-slate-400 text-xs font-mono">
        No cameras registered. Add a camera from the Cameras page to start monitoring.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameras.map((camera) => {
          const isOnline = camera.status === 'ONLINE';
          const isRunning = cameraAiRunning[camera.camera_id] ?? isOnline;
          const { personCount, vehicleCount } = getCameraDetections(camera.camera_id);

          return (
            <div
              key={camera.camera_id}
              className="bg-surface border border-surface-border rounded-xl p-4 shadow-md flex flex-col justify-between transition-all duration-200 hover:border-slate-500/60 font-mono"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-surface-border/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <Video className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-bold text-slate-100 text-sm truncate">
                      {camera.name}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isOnline
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    {isOnline ? 'ON' : 'OFF'}
                  </span>
                </div>

                {/* Live Preview Placeholder or Video Feed Box */}
                <div className="my-3 h-28 bg-slate-950/80 border border-slate-800/80 rounded-lg flex flex-col items-center justify-center relative overflow-hidden group">
                  <div className="text-center space-y-1">
                    <Video className="w-6 h-6 text-slate-600 mx-auto" />
                    <span className="text-[11px] text-slate-400 block">
                      {camera.location || camera.camera_id}
                    </span>
                  </div>
                  {/* Overlay on hover to open camera */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => setActiveLiveCamera(camera)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-transform transform scale-95 group-hover:scale-100"
                    >
                      Open Live Feed
                    </button>
                  </div>
                </div>

                {/* AI & Detection Status */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 py-1">
                  <div className="flex items-center gap-1.5">
                    <Radio className={`w-3 h-3 ${isRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
                    <span className="text-slate-300">
                      AI: <strong className={isRunning ? 'text-emerald-400' : 'text-slate-500'}>{isRunning ? 'ACTIVE' : 'IDLE'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="flex items-center gap-0.5" title="Detected Persons">
                      <User className="w-3 h-3 text-blue-400" />
                      {personCount}
                    </span>
                    <span className="flex items-center gap-0.5" title="Detected Vehicles">
                      <Car className="w-3 h-3 text-amber-400" />
                      {vehicleCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-surface-border/60">
                <button
                  onClick={() => setActiveLiveCamera(camera)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors text-center"
                >
                  Open Camera
                </button>
                <button
                  onClick={() => toggleAiRunning(camera.camera_id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    isRunning
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border-emerald-800'
                  }`}
                >
                  {isRunning ? 'Stop' : 'Start'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Preview Modal */}
      {activeLiveCamera && (
        <LiveCameraPreview
          camera={activeLiveCamera}
          onClose={() => setActiveLiveCamera(null)}
        />
      )}
    </>
  );
};

export default DashboardCameraGrid;
