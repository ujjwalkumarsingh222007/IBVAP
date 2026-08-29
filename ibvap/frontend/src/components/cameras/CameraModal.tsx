import React, { useState, useEffect } from 'react';
import { Camera, CameraCreateInput, CameraStatus, CameraUpdateInput } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CameraCreateInput | CameraUpdateInput) => Promise<void>;
  camera?: Camera | null;
  loading?: boolean;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  camera,
  loading = false,
}) => {
  const isEditing = Boolean(camera);
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<'Webcam' | 'RTSP' | 'URL'>('Webcam');
  const [cameraUrl, setCameraUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cameraId, setCameraId] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<CameraStatus>('ONLINE');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (camera) {
      setName(camera.name);
      setCameraId(camera.camera_id);
      setLocation(camera.location || '');
      setStatus(camera.status);
    } else {
      setName('');
      setCameraId('');
      setLocation('');
      setCameraUrl('');
      setSourceType('Webcam');
      setStatus('ONLINE');
      setShowAdvanced(false);
    }
    setFormError(null);
  }, [camera, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Please enter a camera name.');
      return;
    }

    // Auto-generate camera ID if creating and not explicitly provided
    const effectiveId = isEditing
      ? camera!.camera_id
      : (cameraId.trim() || `CAM-${trimmedName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().slice(0, 16)}-${Math.floor(100 + Math.random() * 900)}`);

    const effectiveLocation = location.trim() || (sourceType === 'Webcam' ? 'Local Laptop Sensor' : `${sourceType} Stream: ${cameraUrl || 'Default'}`);

    try {
      if (isEditing) {
        await onSubmit({
          name: trimmedName,
          location: effectiveLocation,
          status,
        });
      } else {
        await onSubmit({
          camera_id: effectiveId,
          name: trimmedName,
          location: effectiveLocation,
          status,
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('An error occurred while saving the camera.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Camera' : 'Add Camera'}
      subtitle={isEditing ? `Configure ${camera?.name}` : 'Connect a new camera feed for AI monitoring'}
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
        {/* Camera Name */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1 font-sans">
            Camera Name
          </label>
          <input
            type="text"
            placeholder="e.g. Main Gate, Watchtower 1, Parking Area"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
            required
          />
        </div>

        {/* Camera Source */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1 font-sans">
            Camera Source
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as 'Webcam' | 'RTSP' | 'URL')}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
          >
            <option value="Webcam">Webcam (Browser Built-in Sensor)</option>
            <option value="RTSP">RTSP Stream (IP Camera)</option>
            <option value="URL">HTTP / MJPEG Video URL</option>
          </select>
        </div>

        {/* Camera URL (only if required) */}
        {sourceType !== 'Webcam' && (
          <div>
            <label className="block text-slate-400 font-semibold mb-1 font-sans">
              Camera Stream URL
            </label>
            <input
              type="text"
              placeholder={sourceType === 'RTSP' ? 'rtsp://admin:pass@192.168.1.100:554/stream1' : 'http://192.168.1.100:8080/video'}
              value={cameraUrl}
              onChange={(e) => setCameraUrl(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* Advanced toggle */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] text-blue-400 hover:text-blue-300 font-sans font-medium"
          >
            {showAdvanced ? '− Hide Advanced Settings' : '+ Advanced Settings (ID, Zone, Status)'}
          </button>
        </div>

        {showAdvanced && (
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-3">
            {!isEditing && (
              <div>
                <label className="block text-slate-400 font-semibold mb-1 font-sans">
                  Custom Camera ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CAM-GATE-01"
                  value={cameraId}
                  onChange={(e) => setCameraId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 uppercase"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-400 font-semibold mb-1 font-sans">
                Location / Zone
              </label>
              <input
                type="text"
                placeholder="e.g. North Perimeter, Checkpoint 1"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-sans"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1 font-sans">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CameraStatus)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100"
              >
                <option value="ONLINE">ONLINE</option>
                <option value="OFFLINE">OFFLINE</option>
              </select>
            </div>
          </div>
        )}

        {/* Error message */}
        {formError && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200">
            {formError}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-surface-border/60">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={loading}>
            {isEditing ? 'Save Changes' : 'Add Camera'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CameraModal;
