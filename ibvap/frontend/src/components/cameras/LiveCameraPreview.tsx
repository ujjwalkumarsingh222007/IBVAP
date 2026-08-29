import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  AlertCircle,
  RefreshCw,
  Radio,
  Camera as CameraIcon,
  Bot,
  User,
  Car,
  AlertTriangle,
} from 'lucide-react';
import { Camera, AIDetectionItem, SurveillanceEvent } from '../../types';
import { Button } from '../common/Button';
import { aiApi } from '../../api';
import { registryStorage } from '../../services/registryStorage';

interface LiveCameraPreviewProps {
  camera: Camera | null;
  onClose: () => void;
}

export const LiveCameraPreview: React.FC<LiveCameraPreviewProps> = ({ camera, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const aiTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stream states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [timestamp, setTimestamp] = useState<string>('');

  // AI Pipeline states
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [aiBackendStatus, setAiBackendStatus] = useState<'ONLINE' | 'OFFLINE' | 'IDLE'>('IDLE');
  const [aiFps, setAiFps] = useState<number>(0);
  const [lastEvent, setLastEvent] = useState<string>('NONE');
  const [latestDetections, setLatestDetections] = useState<AIDetectionItem[]>([]);
  const [, setLatestEvents] = useState<SurveillanceEvent[]>([]);
  const [activeThreat, setActiveThreat] = useState<{ title: string; score: number; severity: string } | null>(null);
  const [totalProcessedFrames, setTotalProcessedFrames] = useState<number>(0);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  // FPS calculation helpers
  const frameCountRef = useRef<number>(0);
  const lastFpsCalcTimeRef = useRef<number>(Date.now());

  const stopStream = useCallback(() => {
    if (aiTimerRef.current) {
      clearInterval(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {
        // ignore
      }
      abortControllerRef.current = null;
    }
    isProcessingRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLive(false);
  }, []);

  const startWebcam = useCallback(async () => {
    stopStream();
    setLoading(true);
    setError(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setError('Webcam capture is not supported or permitted in this browser environment.');
      setLoading(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setIsLive(true);
      setLoading(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Permission denied or webcam busy.';
      setError(`Cannot start video feed: ${msg}`);
      setLoading(false);
    }
  }, [stopStream]);

  // Frame Capture & Ingestion
  const captureAndProcessFrame = useCallback(async () => {
    if (!aiEnabled || !isLive || !videoRef.current || isProcessingRef.current || !camera) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    const canvas = captureCanvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob || blob.size === 0) return;

        isProcessingRef.current = true;
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const result = await aiApi.processFrame(
            camera.camera_id,
            blob,
            controller.signal
          );

          setAiBackendStatus('ONLINE');
          setTotalProcessedFrames((prev) => prev + 1);
          setLatestDetections(result.detections || []);
          setLatestEvents(result.events || []);

          if (result.events && result.events.length > 0) {
            setLastEvent(result.events[0].event_type);
          }

          if (result.correlated_threat) {
            setActiveThreat({
              title: result.correlated_threat.title,
              score: result.correlated_threat.score,
              severity: result.correlated_threat.severity,
            });
          } else {
            setActiveThreat(null);
          }

          // Compute FPS
          frameCountRef.current += 1;
          const now = Date.now();
          const elapsed = (now - lastFpsCalcTimeRef.current) / 1000;
          if (elapsed >= 1.0) {
            setAiFps(Math.round(frameCountRef.current / elapsed));
            frameCountRef.current = 0;
            lastFpsCalcTimeRef.current = now;
          }
        } catch {
          setAiBackendStatus('OFFLINE');
        } finally {
          isProcessingRef.current = false;
          abortControllerRef.current = null;
        }
      },
      'image/jpeg',
      0.85
    );
  }, [aiEnabled, isLive, camera]);

  // Periodic AI loop
  useEffect(() => {
    if (aiEnabled && isLive) {
      aiTimerRef.current = setInterval(() => {
        captureAndProcessFrame();
      }, 500);
    } else {
      if (aiTimerRef.current) {
        clearInterval(aiTimerRef.current);
        aiTimerRef.current = null;
      }
      setLatestDetections([]);
      setActiveThreat(null);
    }

    return () => {
      if (aiTimerRef.current) {
        clearInterval(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
  }, [aiEnabled, isLive, captureAndProcessFrame]);

  // Draw Bounding Boxes Overlay on Canvas
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !isLive || !aiEnabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.clientWidth || 640;
    canvas.height = video.clientHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const videoW = video.videoWidth || 640;
    const videoH = video.videoHeight || 480;
    const scaleX = canvas.width / videoW;
    const scaleY = canvas.height / videoH;

    latestDetections.forEach((det) => {
      const bbox = det.bbox || { x1: 0, y1: 0, x2: 0, y2: 0 };
      let x1 = bbox.x1 * scaleX;
      let y1 = bbox.y1 * scaleY;
      let x2 = bbox.x2 * scaleX;
      let y2 = bbox.y2 * scaleY;

      // If coordinates are invalid or zero, create representative center box
      if (x2 <= x1 || y2 <= y1) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        x1 = cx - 100;
        x2 = cx + 100;
        y1 = cy - 130;
        y2 = cy + 130;
      }

      const confPct = Math.round((det.plate_confidence || det.confidence || 0.9) * 100);
      let labelText = '';
      let strokeColor = '#f59e0b'; // amber default
      let badgeBg = 'rgba(245, 158, 11, 0.95)';

      const clsName = (det.class_name || '').toLowerCase();
      const isVehicle = Boolean(det.plate_number) || ['license_plate', 'car', 'truck', 'bus', 'vehicle'].includes(clsName);
      const isKnown = Boolean(det.is_known) || det.status === 'KNOWN';
      const isFlagged = Boolean(det.is_flagged) || det.status === 'FLAGGED' || Boolean(det.watchlist_match);

      if (isVehicle) {
        const plate = det.plate_number;
        if (isFlagged) {
          labelText = `🚨 FLAGGED VEHICLE ${plate ? `[${plate}]` : ''} • ${confPct}%`;
          strokeColor = '#ef4444'; // Red
          badgeBg = 'rgba(239, 68, 68, 0.95)';
        } else if (isKnown) {
          labelText = `KNOWN VEHICLE ${plate ? `[${plate}]` : ''} • ${confPct}%`;
          strokeColor = '#10b981'; // Emerald
          badgeBg = 'rgba(16, 185, 129, 0.95)';
        } else {
          labelText = `UNKNOWN VEHICLE ${plate ? `[${plate}]` : ''} • ${confPct}%`;
          strokeColor = '#f59e0b'; // Amber
          badgeBg = 'rgba(245, 158, 11, 0.95)';
        }
      } else {
        // Person
        const pName = det.person_name && det.person_name !== 'Unknown' ? det.person_name : '';
        if (isFlagged) {
          labelText = `⚠ FLAGGED PERSON`;
          strokeColor = '#ef4444';
          badgeBg = 'rgba(239, 68, 68, 0.95)';
        } else if (isKnown) {
          labelText = `✓ ${pName || 'Known'}`;
          strokeColor = '#10b981';
          badgeBg = 'rgba(16, 185, 129, 0.95)';
        } else {
          labelText = `? Unknown Person`;
          strokeColor = '#f59e0b';
          badgeBg = 'rgba(245, 158, 11, 0.95)';
        }
      }

      // Draw bounding box
      ctx.lineWidth = 3;
      ctx.strokeStyle = strokeColor;
      ctx.beginPath();
      ctx.roundRect(x1, y1, x2 - x1, y2 - y1, 8);
      ctx.stroke();

      // Draw corner accents
      const cornerLen = 14;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      // Top Left
      ctx.beginPath();
      ctx.moveTo(x1, y1 + cornerLen);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + cornerLen, y1);
      ctx.stroke();
      // Top Right
      ctx.beginPath();
      ctx.moveTo(x2 - cornerLen, y1);
      ctx.lineTo(x2, y1);
      ctx.lineTo(x2, y1 + cornerLen);
      ctx.stroke();
      // Bottom Left
      ctx.beginPath();
      ctx.moveTo(x1, y2 - cornerLen);
      ctx.lineTo(x1, y2);
      ctx.lineTo(x1 + cornerLen, y2);
      ctx.stroke();
      // Bottom Right
      ctx.beginPath();
      ctx.moveTo(x2 - cornerLen, y2);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 - cornerLen);
      ctx.stroke();

      // Draw compact top label badge
      ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      const textMetrics = ctx.measureText(labelText);
      const tagW = textMetrics.width + 16;
      const tagH = 22;
      const tagX = Math.max(0, x1);
      const tagY = Math.max(tagH, y1 - 6);

      ctx.fillStyle = badgeBg;
      ctx.beginPath();
      ctx.roundRect(tagX, tagY - tagH, tagW, tagH, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, tagX + 8, tagY - 6);
    });
  }, [latestDetections, isLive, aiEnabled]);

  // Start webcam on camera mount
  useEffect(() => {
    if (camera) {
      startWebcam();
    }
    return () => {
      stopStream();
    };
  }, [camera, startWebcam, stopStream]);

  // Live HUD clock timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimestamp(new Date().toISOString().replace('T', ' ').substring(0, 19));
    }, 1000);
    setTimestamp(new Date().toISOString().replace('T', ' ').substring(0, 19));
    return () => clearInterval(timer);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!camera) return null;

  const detectedPersonsCount = latestDetections.filter(
    (d) => d.class_name === 'person' && !d.plate_number
  ).length;

  const detectedVehiclesCount = latestDetections.filter(
    (d) => Boolean(d.plate_number) || ['car', 'truck', 'bus', 'vehicle'].includes(d.class_name || '')
  ).length;

  const registeredPeople = registryStorage.getPeople();

  // Evaluate if active alert banner should show on top
  const activeAlertDetections = latestDetections.filter((det) => {
    if (det.watchlist_match) return true;
    if (det.plate_number) {
      const regV = registryStorage.lookupVehicle(det.plate_number);
      return !regV || regV.status === 'WATCHLIST';
    }
    if (det.class_name === 'person') {
      const isKnown = registeredPeople.some((p) => p.status === 'KNOWN');
      return !isKnown;
    }
    return false;
  });

  const hasActiveAlert = activeAlertDetections.length > 0 || (activeThreat && activeThreat.severity !== 'LOW');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
      {/* Hidden off-screen canvas for frame extraction */}
      <canvas ref={captureCanvasRef} className="hidden" />

      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header HUD Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/95 border-b border-surface-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-950/80 border border-blue-800/80 rounded-lg text-blue-400 shrink-0">
              <CameraIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-100 truncate">
                  {camera.name}
                </span>
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/90 text-red-400 border border-red-800 text-[10px] font-bold uppercase animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    LIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                    <Radio className="w-3 h-3 text-slate-500" />
                    OFFLINE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {camera.location || camera.camera_id} • {timestamp}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Toggle */}
            <button
              onClick={() => setAiEnabled((prev) => !prev)}
              disabled={!isLive}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                aiEnabled
                  ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              } disabled:opacity-50`}
            >
              <Bot className={`w-3.5 h-3.5 ${aiEnabled ? 'animate-pulse' : ''}`} />
              <span>AI Analysis: {aiEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Display Viewport */}
        <div className="relative bg-black flex-1 min-h-[360px] max-h-[65vh] flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${!isLive ? 'hidden' : 'block'}`}
          />

          {/* Bounding Boxes Overlay Canvas */}
          {isLive && aiEnabled && (
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 pointer-events-none w-full h-full"
            />
          )}

          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 p-6 text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-300 font-semibold">
                Initializing Live Video Stream...
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/90 text-center gap-4">
              <div className="p-3 bg-rose-950/80 border border-rose-800/80 rounded-2xl text-rose-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="text-sm font-bold text-slate-100">Camera Feed Unavailable</h4>
                <p className="text-xs text-slate-400">{error}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={startWebcam} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                  Retry Stream
                </Button>
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {/* Simple Alert Banner (Shows ONLY when actual alert exists) */}
          {isLive && aiEnabled && hasActiveAlert && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex items-center gap-2 px-4 py-1.5 rounded-xl border bg-red-950/95 border-red-500 text-red-200 text-xs font-bold shadow-2xl animate-pulse">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                🚨 ALERT:{' '}
                {activeThreat
                  ? activeThreat.title.toUpperCase()
                  : activeAlertDetections[0]?.watchlist_match
                  ? 'FLAGGED VEHICLE FOUND'
                  : activeAlertDetections[0]?.plate_number
                  ? 'UNKNOWN VEHICLE DETECTED'
                  : 'UNKNOWN PERSON DETECTED'}
              </span>
            </div>
          )}
        </div>

        {/* Technical Details Progressive Drawer */}
        {showTechnicalDetails && (
          <div className="bg-slate-950 p-4 border-t border-slate-800 text-xs font-mono space-y-2 max-h-36 overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
              <span className="text-slate-300 font-bold">Technical Diagnostics</span>
              <span>Frames Processed: {totalProcessedFrames}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block">AI Ingestion Rate</span>
                <span className="text-cyan-400 font-bold">{aiFps} FPS</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block">Backend Pipeline</span>
                <span className={aiBackendStatus === 'ONLINE' ? 'text-emerald-400' : 'text-amber-400'}>
                  {aiBackendStatus}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block">Last Event</span>
                <span className="text-slate-200 font-bold truncate block">{lastEvent}</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block">Threat Level</span>
                <span className="text-red-400 font-bold">{activeThreat?.severity || 'NORMAL'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Simplified Prototype Bottom Status Bar */}
        <div className="flex flex-wrap items-center justify-between px-5 py-3 bg-slate-900/95 border-t border-surface-border text-xs gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${aiEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-slate-200 font-bold tracking-wider uppercase">
                {aiEnabled ? 'AI ACTIVE' : 'AI PAUSED'}
              </span>
            </div>

            <div className="h-4 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-3 text-slate-300">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>People: <strong>{detectedPersonsCount}</strong></span>
              </span>
              <span className="flex items-center gap-1">
                <Car className="w-3.5 h-3.5 text-amber-400" />
                <span>Vehicles: <strong>{detectedVehiclesCount}</strong></span>
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>Alerts: <strong className={activeAlertDetections.length > 0 ? "text-red-400" : ""}>{activeAlertDetections.length}</strong></span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="text-[11px] text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 transition-colors"
            >
              {showTechnicalDetails ? 'Hide Details' : 'Technical Details'}
            </button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close Camera
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCameraPreview;
