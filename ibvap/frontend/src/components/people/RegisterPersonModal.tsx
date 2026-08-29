import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Camera as CameraIcon,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../common/Button';
import { personsApi, FaceValidationResult } from '../../api/personsApi';
import { formatApiError } from '../../api';

interface RegisterPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterPersonModal: React.FC<RegisterPersonModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isScanningRef = useRef<boolean>(false);

  // Webcam & Face Validation State
  const [streamLoading, setStreamLoading] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<FaceValidationResult>({
    valid: false,
    message: 'Initializing camera...',
    faces_count: 0,
    face_bbox: null,
  });

  // Capture & Form State
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [status, setStatus] = useState<'KNOWN' | 'FLAGGED'>('KNOWN');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Stop Webcam
  const stopWebcam = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    isScanningRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start Webcam
  const startWebcam = useCallback(async () => {
    stopWebcam();
    setStreamLoading(true);
    setStreamError(null);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setStreamError('Webcam is not supported in this browser environment.');
      setStreamLoading(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStreamLoading(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Webcam permission denied or camera busy.';
      setStreamError(msg);
      setStreamLoading(false);
    }
  }, [stopWebcam]);

  // Periodic Face Validation Scan
  const scanFace = useCallback(async () => {
    if (isScanningRef.current || !videoRef.current || capturedBlob) return;
    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = captureCanvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob || blob.size === 0) return;
        isScanningRef.current = true;
        try {
          const res = await personsApi.validateFace(blob);
          setValidationState(res);

          // Draw face bounding box on overlay canvas
          const overlay = overlayCanvasRef.current;
          if (overlay) {
            overlay.width = video.clientWidth || 640;
            overlay.height = video.clientHeight || 480;
            const oCtx = overlay.getContext('2d');
            if (oCtx) {
              oCtx.clearRect(0, 0, overlay.width, overlay.height);
              if (res.face_bbox) {
                const scaleX = overlay.width / video.videoWidth;
                const scaleY = overlay.height / video.videoHeight;
                const bx = res.face_bbox.x * scaleX;
                const by = res.face_bbox.y * scaleY;
                const bw = res.face_bbox.w * scaleX;
                const bh = res.face_bbox.h * scaleY;

                oCtx.lineWidth = 3;
                oCtx.strokeStyle = res.valid ? '#10b981' : '#f59e0b';
                oCtx.strokeRect(bx, by, bw, bh);

                oCtx.font = 'bold 12px monospace';
                oCtx.fillStyle = res.valid ? '#10b981' : '#f59e0b';
                oCtx.fillText(res.valid ? 'Face detected ✓' : 'Aligning...', bx, Math.max(16, by - 6));
              }
            }
          }
        } catch {
          // fallback
        } finally {
          isScanningRef.current = false;
        }
      },
      'image/jpeg',
      0.85
    );
  }, [capturedBlob]);

  useEffect(() => {
    if (isOpen && !capturedBlob) {
      startWebcam();
      scanTimerRef.current = setInterval(scanFace, 450);
    } else {
      stopWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [isOpen, capturedBlob, startWebcam, stopWebcam, scanFace]);

  // Capture Frame
  const handleCapture = () => {
    if (!videoRef.current || !validationState.valid) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedDataUrl(dataUrl);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          stopWebcam();
        }
      },
      'image/jpeg',
      0.92
    );
  };

  // Retake
  const handleRetake = () => {
    setCapturedBlob(null);
    setCapturedDataUrl(null);
    setSubmitError(null);
    startWebcam();
  };

  // Submit Registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setSubmitError('Please enter the person full name.');
      return;
    }
    if (!capturedBlob) {
      setSubmitError('Please capture a face photo first.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await personsApi.registerPerson(name.trim(), status, capturedBlob, notes.trim() || undefined);
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(formatApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono">
      {/* Hidden capture canvas */}
      <canvas ref={captureCanvasRef} className="hidden" />

      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-950 border border-blue-800 text-blue-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Register Person
              </h3>
              <p className="text-[11px] text-slate-400">
                Biometric face scanning and database registration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {!capturedBlob ? (
            /* STEP 1: Live Webcam Face Scan */
            <div className="space-y-3">
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-surface-border flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${streamLoading || streamError ? 'hidden' : 'block'}`}
                />

                <canvas
                  ref={overlayCanvasRef}
                  className="absolute inset-0 pointer-events-none w-full h-full"
                />

                {streamLoading && (
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                    <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>Connecting to Webcam...</span>
                  </div>
                )}

                {streamError && (
                  <div className="p-4 text-center text-rose-400 text-xs space-y-2">
                    <AlertCircle className="w-6 h-6 mx-auto text-rose-400" />
                    <p>{streamError}</p>
                    <Button variant="outline" size="sm" onClick={startWebcam}>
                      Retry Camera
                    </Button>
                  </div>
                )}
              </div>

              {/* Real-time Status Guidance */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      validationState.valid
                        ? 'bg-emerald-500 animate-pulse'
                        : validationState.faces_count > 1
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  <span
                    className={`font-semibold ${
                      validationState.valid
                        ? 'text-emerald-400'
                        : validationState.faces_count > 1
                        ? 'text-red-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {validationState.message}
                  </span>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCapture}
                  disabled={!validationState.valid}
                  icon={<CameraIcon className="w-3.5 h-3.5" />}
                >
                  Capture Face
                </Button>
              </div>
            </div>
          ) : (
            /* STEP 2: Photo Preview & Metadata Form */
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {submitError && (
                <div className="p-2.5 rounded bg-red-950/80 border border-red-800 text-red-300">
                  {submitError}
                </div>
              )}

              {/* Photo Preview & Retake */}
              <div className="flex items-center gap-4 p-3 bg-slate-900 rounded-xl border border-slate-800">
                {capturedDataUrl && (
                  <img
                    src={capturedDataUrl}
                    alt="Captured Face"
                    className="w-20 h-20 rounded-xl object-cover border-2 border-emerald-500 shadow-md shrink-0"
                  />
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Face Photo Captured</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    High quality face frame extracted and verified.
                  </p>
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-semibold pt-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retake Photo</span>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
                  required
                  autoFocus
                />
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Classification Status <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('KNOWN')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition-all ${
                      status === 'KNOWN'
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>KNOWN (Authorized)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('FLAGGED')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition-all ${
                      status === 'FLAGGED'
                        ? 'bg-red-950/90 text-red-300 border-red-500 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span>FLAGGED (Alert Target)</span>
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Notes / Role (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chief Security Officer, Staff, Wanted Subject"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-surface-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetake}
                  disabled={isSubmitting}
                >
                  Retake
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting || !name.trim()}
                  icon={isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : undefined}
                >
                  {isSubmitting ? 'Registering...' : 'Register Person'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegisterPersonModal;
