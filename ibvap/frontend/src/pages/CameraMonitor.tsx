import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { cameraApi } from '../api/cameraApi';
import { Camera } from '../types';
import { useCameraStream } from '../hooks/useCameraStream';
import { BoundingBoxOverlay } from '../components/camera/BoundingBoxOverlay';
import { DetectionFeed } from '../components/camera/DetectionFeed';

export const CameraMonitor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cameraId = id || 'CAM-01';

  const [camera, setCamera] = useState<Camera | null>(null);
  const [allCameras, setAllCameras] = useState<Camera[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [videoNaturalDimensions, setVideoNaturalDimensions] = useState({ width: 0, height: 0 });

  // Stream Hook
  const {
    videoRef,
    canvasRef,
    isStreaming,
    cameraError,
    detections,
    fpsActual,
    restartStream,
  } = useCameraStream({
    cameraId,
    fps: 6,
    enabled: true,
  });

  // Fetch camera record & all available cameras for quick switching
  useEffect(() => {
    let isMounted = true;
    const loadCameraData = async () => {
      try {
        const [single, all] = await Promise.all([
          cameraApi.getCamera(cameraId).catch(() => null),
          cameraApi.getCameras().catch(() => []),
        ]);

        if (isMounted) {
          if (single) setCamera(single);
          else {
            setCamera({
              id: 0,
              camera_id: cameraId,
              name: `${cameraId} Primary Optical Feed`,
              location: 'Primary Security Sector',
              status: 'ONLINE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
          if (all) setAllCameras(all);
        }
      } catch {
        // Safe fallback
      }
    };

    loadCameraData();
    return () => {
      isMounted = false;
    };
  }, [cameraId]);

  // Keep track of container & video resolution for responsive bounding box placement
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        setVideoNaturalDimensions({
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    const interval = setInterval(updateDimensions, 500);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearInterval(interval);
    };
  }, [videoRef]);

  return (
    <div className="space-y-3 font-mono">
      {/* 1. Tactical Viewport Control Header */}
      <div className="bg-surface border border-surface-border p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-tactical">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/cameras')}
            className="p-1.5 rounded bg-surface-subtle hover:bg-surface-elevated text-slate-300 transition-colors border border-surface-border"
            title="Return to Surveillance Grid"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-sm font-bold text-white tracking-wide">
                {camera?.name || cameraId}
              </h1>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-elevated text-tactical-blue border border-surface-border font-bold">
                {cameraId}
              </span>
            </div>
            <div className="text-[11px] text-tactical-slate mt-0.5">
              SEC-ZONE: {camera?.location || 'GATE-01 PERIMETER'}
            </div>
          </div>
        </div>

        {/* Quick Camera Switcher Bar */}
        <div className="flex items-center gap-2">
          {allCameras.length > 1 && (
            <div className="flex items-center gap-1 bg-surface-subtle border border-surface-border px-2 py-1 rounded">
              <span className="text-[10px] text-tactical-slate">CHANNEL:</span>
              <div className="flex items-center gap-1">
                {allCameras.map((c) => (
                  <button
                    key={c.camera_id}
                    onClick={() => navigate(`/cameras/${c.camera_id}`)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      c.camera_id === cameraId
                        ? 'bg-tactical-blue text-white'
                        : 'text-slate-400 hover:text-white hover:bg-surface-elevated'
                    }`}
                  >
                    {c.camera_id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Telemetry Stream Diagnostics */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-surface-subtle border border-surface-border text-xs text-slate-300">
            <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-[11px] text-tactical-slate">{isStreaming ? 'STREAM: LIVE' : 'STANDBY'}</span>
            <span className="text-surface-border">|</span>
            <span className="flex items-center gap-1 text-[11px] text-tactical-cyan">
              <Activity className="w-3 h-3" />
              {fpsActual} FPS AI
            </span>
          </div>

          <button
            onClick={restartStream}
            className="p-1.5 rounded bg-surface-subtle hover:bg-surface-elevated text-slate-300 transition-colors border border-surface-border"
            title="Recalibrate optical stream"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Surveillance Dual Viewport (Video + Live Targets Rail) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Primary Camera Viewport (8 Cols) */}
        <div className="lg:col-span-8 bg-surface border border-surface-border rounded-lg p-2.5 shadow-tactical flex flex-col justify-between">
          <div
            ref={containerRef}
            className="relative w-full aspect-video bg-black rounded border border-surface-border overflow-hidden flex items-center justify-center tactical-reticle"
          >
            {/* Top Viewport Status Overlay */}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/80 border border-surface-border text-[10px] text-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="font-bold">REC · LIVE 1080p</span>
              </div>
              <div className="px-2 py-0.5 rounded bg-black/80 border border-surface-border text-[10px] text-tactical-slate">
                {videoNaturalDimensions.width || 1280}x{videoNaturalDimensions.height || 720}
              </div>
            </div>

            <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
              <div className="px-2 py-0.5 rounded bg-black/80 border border-surface-border text-[10px] text-emerald-400">
                AI RECOGNITION: ACTIVE
              </div>
            </div>

            {/* Video Stream Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />

            {/* Hidden capture canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Real-time Bounding Box & Identity Tag Layer */}
            <BoundingBoxOverlay
              detections={detections}
              containerWidth={containerDimensions.width}
              containerHeight={containerDimensions.height}
              videoNaturalWidth={videoNaturalDimensions.width || 1280}
              videoNaturalHeight={videoNaturalDimensions.height || 720}
            />

            {/* Error or Standby Overlay */}
            {cameraError && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-black/85 text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                <div className="text-sm font-bold text-white">OPTICAL INGESTION OFFLINE</div>
                <div className="text-xs text-slate-400 mt-1 max-w-md">{cameraError}</div>
                <button
                  onClick={restartStream}
                  className="mt-3 px-3 py-1.5 bg-surface-elevated hover:bg-tactical-blue text-white rounded text-xs transition-colors border border-surface-border"
                >
                  Retry Connection
                </button>
              </div>
            )}
          </div>

          {/* Bottom Telemetry Bar */}
          <div className="flex items-center justify-between text-[10px] text-tactical-slate pt-2 border-t border-surface-border mt-2">
            <span>OPTICAL SENSOR: HIGH DEF SONY EXMOR · PROTOCOL: WEBRTC / MJPEG</span>
            <span className="text-slate-300 font-bold">TARGETS IN SECTOR: {detections.length}</span>
          </div>
        </div>

        {/* Live Detections Side Rail (4 Cols) */}
        <div className="lg:col-span-4 h-full">
          <DetectionFeed
            detections={detections}
            cameraName={camera?.name || cameraId}
          />
        </div>
      </div>
    </div>
  );
};
