import { useEffect, useRef, useState, useCallback } from 'react';
import { aiApi } from '../api/aiApi';
import { AIDetection, SurveillanceEventPayload } from '../types';
import { useAlerts } from '../context/AlertContext';

interface UseCameraStreamOptions {
  cameraId: string;
  fps?: number; // Target 5–8 FPS for AI processing
  enabled?: boolean;
}

export const useCameraStream = ({
  cameraId,
  fps = 6,
  enabled = true,
}: UseCameraStreamOptions) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detections, setDetections] = useState<AIDetection[]>([]);
  const [recentEvents, setRecentEvents] = useState<SurveillanceEventPayload[]>([]);
  const [fpsActual, setFpsActual] = useState(0);

  const { triggerAlertFromDetection } = useAlerts();

  // Stable reference to triggerAlertFromDetection
  const onDetectionsReceived = useCallback(
    (newDetections: AIDetection[], newEvents: SurveillanceEventPayload[]) => {
      setDetections(newDetections);
      if (newEvents && newEvents.length > 0) {
        setRecentEvents((prev) => [...newEvents, ...prev].slice(0, 30));
      }

      // Check for alerts: KNOWN entities NEVER trigger alerts!
      newDetections.forEach((det) => {
        triggerAlertFromDetection(det, cameraId);
      });
    },
    [cameraId, triggerAlertFromDetection]
  );

  // Stop media stream and cleanup all active requests
  const stopStream = useCallback(() => {
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    isProcessingRef.current = false;
    setIsStreaming(false);
    setDetections([]);
  }, []);

  // Frame capture loop
  const processNextFrame = useCallback(async () => {
    if (!enabled || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
      loopTimeoutRef.current = setTimeout(processNextFrame, 1000 / fps);
      return;
    }

    if (isProcessingRef.current) {
      // Skip this frame if previous inference is still in-flight
      loopTimeoutRef.current = setTimeout(processNextFrame, 1000 / fps);
      return;
    }

    isProcessingRef.current = true;
    const tStart = performance.now();

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to JPEG blob
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.85)
        );

        if (blob) {
          abortControllerRef.current = new AbortController();
          const response = await aiApi.processFrame(
            blob,
            cameraId,
            abortControllerRef.current.signal
          );

          if (response && response.detections) {
            onDetectionsReceived(response.detections, response.events || []);
          }

          const elapsed = performance.now() - tStart;
          setFpsActual(Math.round(1000 / Math.max(elapsed, 1000 / fps)));
        }
      }
    } catch (err: any) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        // AI endpoint error, don't crash video
      }
    } finally {
      isProcessingRef.current = false;
      const intervalMs = Math.max(10, 1000 / fps - (performance.now() - tStart));
      loopTimeoutRef.current = setTimeout(processNextFrame, intervalMs);
    }
  }, [cameraId, enabled, fps, onDetectionsReceived]);

  // Start webcam feed
  const startStream = useCallback(async () => {
    stopStream();
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setIsStreaming(true);
            processNextFrame();
          });
        };
      }
    } catch (err: any) {
      setCameraError(err.message || 'Unable to access camera hardware');
      setIsStreaming(false);
    }
  }, [processNextFrame, stopStream]);

  useEffect(() => {
    if (enabled) {
      startStream();
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [cameraId, enabled, startStream, stopStream]);

  return {
    videoRef,
    canvasRef,
    isStreaming,
    cameraError,
    detections,
    recentEvents,
    fpsActual,
    restartStream: startStream,
    stopStream,
  };
};
