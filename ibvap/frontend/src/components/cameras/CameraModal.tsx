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
  const [cameraId, setCameraId] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<CameraStatus>('ONLINE');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (camera) {
      setCameraId(camera.camera_id);
      setName(camera.name);
      setLocation(camera.location || '');
      setStatus(camera.status);
    } else {
      setCameraId('');
      setName('');
      setLocation('');
      setStatus('ONLINE');
    }
    setFormError(null);
  }, [camera, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Camera name is required.');
      return;
    }

    if (!isEditing && !cameraId.trim()) {
      setFormError('Camera ID is required.');
      return;
    }

    try {
      if (isEditing) {
        await onSubmit({
          name: name.trim(),
          location: location.trim() || undefined,
          status,
        });
      } else {
        await onSubmit({
          camera_id: cameraId.trim(),
          name: name.trim(),
          location: location.trim() || undefined,
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
      title={isEditing ? `Edit Camera — ${camera?.camera_id}` : 'Register New Surveillance Camera'}
      subtitle={
        isEditing
          ? 'Update name, physical zone, or operational status'
          : 'Add a new camera video stream identifier to IBVAP'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Camera ID (only editable during creation) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
            Camera Identifier (ID)
          </label>
          <input
            type="text"
            placeholder="e.g. CAM-01 or CAM-NORTH-GATE"
            disabled={isEditing}
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:bg-slate-950 font-mono"
          />
          {!isEditing && (
            <p className="text-[11px] text-slate-500 mt-1">
              Must be unique across all registered surveillance streams.
            </p>
          )}
        </div>

        {/* Camera Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
            Display Name
          </label>
          <input
            type="text"
            placeholder="e.g. Main Perimeter Watchtower"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
            Physical Location / Zone
          </label>
          <input
            type="text"
            placeholder="e.g. Sector 4, North Fence Line"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Status Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
            Operational Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CameraStatus)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
          >
            <option value="ONLINE">ONLINE (Active surveillance)</option>
            <option value="OFFLINE">OFFLINE (Stream down / Maintenance)</option>
            <option value="UNKNOWN">UNKNOWN (Unverified state)</option>
          </select>
        </div>

        {/* Error message */}
        {formError && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-xs text-red-200 font-mono">
            {formError}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-surface-border/60">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {isEditing ? 'Save Changes' : 'Register Camera'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
