import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Camera as CameraIcon,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../common/Button';
import { personsApi, FaceValidationResult } from '../../api/personsApi';
import { formatApiError } from '../../api';

interface RegisterPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface EnrollmentStep {
  key: string;
  label: string;
  instruction: string;
  icon: string;
}

const ENROLLMENT_STEPS: EnrollmentStep[] = [
  { key: 'FRONT', label: 'Front', instruction: 'Look straight at the camera', icon: '👤' },
  { key: 'SLIGHT_LEFT', label: 'Slight Left', instruction: 'Turn slightly left', icon: '↖' },
  { key: 'LEFT', label: 'Left', instruction: 'Turn left', icon: '⬅' },
  { key: 'SLIGHT_RIGHT', label: 'Slight Right', instruction: 'Turn slightly right', icon: '↗' },
  { key: 'RIGHT', label: 'Right', instruction: 'Turn right', icon: '➡' },
  { key: 'LOOK_UP', label: 'Look Up', instruction: 'Look up', icon: '⬆' },
  { key: 'LOOK_DOWN', label: 'Look Down', instruction: 'Look down', icon: '⬇' },
];

interface CapturedSample {
  angle: string;
  blob: Blob;
  dataUrl: string;
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
  const steadyFramesCountRef = useRef<number>(0);

  // Enrollment Steps & Samples
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [capturedSamples, setCapturedSamples] = useState<CapturedSample[]>([]);
  const [isCapturingSample, setIsCapturingSample] = useState<boolean>(false);

  // Webcam & Face Validation State
  const [streamLoading, setStreamLoading] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<FaceValidationResult>({
    valid: false,
    message: 'Initializing camera...',
    faces_count: 0,
    face_bbox: null,
  });

  // Form State
  const [name, setName] = useState<string>('');
  const [status, setStatus] = useState<'KNOWN' | 'FLAGGED'>('KNOWN');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Stop Webcam
  const stopWebcam = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    isScanningRef.current = false;
    steadyFramesCountRef.current = 0;

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

  // Capture Current Sample
  const captureCurrentSample = useCallback(() => {
    if (!videoRef.current || !validationState.valid || isCapturingSample) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsCapturingSample(true);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const step = ENROLLMENT_STEPS[currentStepIndex];
          const newSample: CapturedSample = {
            angle: step.key,
            blob,
            dataUrl,
          };

          setCapturedSamples((prev) => {
            const next = [...prev, newSample];
            if (next.length < ENROLLMENT_STEPS.length) {
              setCurrentStepIndex(next.length);
            } else {
              stopWebcam();
            }
            return next;
          });
          steadyFramesCountRef.current = 0;
        }
        setIsCapturingSample(false);
      },
      'image/jpeg',
      0.92
    );
  }, [validationState.valid, isCapturingSample, currentStepIndex, stopWebcam]);

  // Periodic Face Validation Scan
  const scanFace = useCallback(async () => {
    if (isScanningRef.current || !videoRef.current || capturedSamples.length >= ENROLLMENT_STEPS.length) return;
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

          // Auto-capture on steady hold (3 consecutive valid scans ~1.2s)
          if (res.valid) {
            steadyFramesCountRef.current += 1;
            if (steadyFramesCountRef.current >= 3 && !isCapturingSample) {
              captureCurrentSample();
            }
          } else {
            steadyFramesCountRef.current = 0;
          }

          // Draw face bounding box and oval guide on overlay canvas
          const overlay = overlayCanvasRef.current;
          if (overlay) {
            overlay.width = video.clientWidth || 640;
            overlay.height = video.clientHeight || 480;
            const oCtx = overlay.getContext('2d');
            if (oCtx) {
              oCtx.clearRect(0, 0, overlay.width, overlay.height);

              // Target Head Oval Guide
              const cx = overlay.width / 2;
              const cy = overlay.height / 2 - 10;
              const rx = overlay.width * 0.22;
              const ry = overlay.height * 0.32;

              oCtx.beginPath();
              oCtx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
              oCtx.lineWidth = 2;
              oCtx.strokeStyle = res.valid ? 'rgba(16, 185, 129, 0.6)' : 'rgba(255, 255, 255, 0.25)';
              oCtx.stroke();

              // Detected Face Box
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
  }, [capturedSamples.length, isCapturingSample, captureCurrentSample]);

  useEffect(() => {
    if (isOpen && capturedSamples.length < ENROLLMENT_STEPS.length) {
      startWebcam();
      scanTimerRef.current = setInterval(scanFace, 400);
    } else {
      stopWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [isOpen, capturedSamples.length, startWebcam, stopWebcam, scanFace]);

  // Retake all samples
  const handleResetEnrollment = () => {
    setCapturedSamples([]);
    setCurrentStepIndex(0);
    setSubmitError(null);
    setDuplicateWarning(null);
    startWebcam();
  };

  // Submit Multi-Sample Registration
  const handleSubmit = async (e?: React.FormEvent, forceAllowDuplicate: boolean = false) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setSubmitError('Please enter the person full name.');
      return;
    }
    if (capturedSamples.length === 0) {
      setSubmitError('Please complete face enrollment first.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setDuplicateWarning(null);

    try {
      await personsApi.registerMultiSamplePerson(
        name.trim(),
        status,
        capturedSamples.map((s) => ({ blob: s.blob, angle: s.angle })),
        notes.trim() || undefined,
        forceAllowDuplicate
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const errMsg = formatApiError(err);
      if (errMsg.includes('Duplicate Face Detected') || err?.response?.status === 409) {
        setDuplicateWarning(errMsg);
      } else {
        setSubmitError(errMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentStep = ENROLLMENT_STEPS[currentStepIndex] || ENROLLMENT_STEPS[0];
  const isEnrollmentComplete = capturedSamples.length >= ENROLLMENT_STEPS.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono">
      {/* Hidden capture canvas */}
      <canvas ref={captureCanvasRef} className="hidden" />

      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-950 border border-blue-800 text-blue-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Face Enrollment</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                  {capturedSamples.length}/{ENROLLMENT_STEPS.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEnrollmentComplete
                  ? 'All 7 face angles captured successfully ✓'
                  : currentStep.instruction}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {submitError && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{submitError}</span>
            </div>
          )}

          {duplicateWarning && (
            <div className="p-3 bg-amber-950/70 border border-amber-600/80 rounded-xl text-amber-200 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>{duplicateWarning}</span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetEnrollment}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200"
                >
                  Retake Photo
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(undefined, true)}
                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-[11px] text-black font-bold"
                >
                  Enroll Anyway
                </button>
              </div>
            </div>
          )}

          {/* Video Enrollment Stage */}
          {!isEnrollmentComplete ? (
            <div className="space-y-3">
              {/* Progress Stepper Bar */}
              <div className="grid grid-cols-7 gap-1">
                {ENROLLMENT_STEPS.map((step, idx) => {
                  const isDone = idx < capturedSamples.length;
                  const isCurrent = idx === currentStepIndex;
                  return (
                    <div
                      key={step.key}
                      className={`p-1.5 rounded-lg border text-center transition-all ${
                        isDone
                          ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                          : isCurrent
                          ? 'bg-blue-950/80 border-blue-500 text-blue-200 animate-pulse'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="text-xs">{step.icon}</div>
                      <div className="text-[9px] font-bold truncate">{step.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Active Camera Viewport */}
              <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute inset-0 pointer-events-none w-full h-full"
                />

                {/* Big Step Instruction Badge */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-slate-700 text-xs font-bold text-slate-100 flex items-center gap-2 shadow-xl">
                  <span className="text-base">{currentStep.icon}</span>
                  <span>{currentStep.instruction}</span>
                </div>

                {streamLoading && (
                  <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-2">
                    <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-400">Initializing camera feed...</span>
                  </div>
                )}

                {streamError && (
                  <div className="absolute inset-0 bg-black/95 p-4 flex flex-col items-center justify-center text-center gap-2 text-rose-400">
                    <AlertCircle className="w-6 h-6" />
                    <p className="text-xs">{streamError}</p>
                    <Button variant="secondary" size="sm" onClick={startWebcam}>
                      Retry Camera
                    </Button>
                  </div>
                )}
              </div>

              {/* Real-time Validation & Capture Control */}
              <div className="flex items-center justify-between p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2 text-xs">
                  {validationState.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span className={validationState.valid ? 'text-emerald-300' : 'text-slate-400'}>
                    {validationState.message}
                  </span>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={captureCurrentSample}
                  disabled={!validationState.valid || isCapturingSample}
                  icon={<CameraIcon className="w-3.5 h-3.5" />}
                >
                  Capture Angle
                </Button>
              </div>
            </div>
          ) : (
            /* Enrollment Complete — Preview Grid */
            <div className="space-y-4 animate-fade-in">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-emerald-300 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>360° Multi-Angle Profile Ready ({capturedSamples.length} samples)</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetEnrollment}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retake</span>
                </button>
              </div>

              {/* 7-Sample Thumbnails Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {capturedSamples.map((sample, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden border border-emerald-600 bg-slate-900 aspect-square">
                    <img src={sample.dataUrl} alt={sample.angle} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-black/75 px-1 py-0.5 text-[9px] text-center font-bold text-slate-300 truncate">
                      {sample.angle}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Person Metadata Form */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ujjwal"
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Surveillance Classification
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setStatus('KNOWN')}
                    className={`py-1.5 rounded-lg font-bold transition-colors ${
                      status === 'KNOWN'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Known Person
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('FLAGGED')}
                    className={`py-1.5 rounded-lg font-bold transition-colors ${
                      status === 'FLAGGED'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Flagged Person
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Notes / Role
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Authorized Operator"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={isSubmitting || capturedSamples.length === 0}
                icon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                {isSubmitting ? 'Registering...' : 'Complete Registration'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
