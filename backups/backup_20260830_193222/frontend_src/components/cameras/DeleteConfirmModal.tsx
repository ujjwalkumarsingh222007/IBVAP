import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Camera } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  camera: Camera | null;
  loading?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  camera,
  loading = false,
}) => {
  if (!camera) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Camera Stream"
      maxWidth="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold text-red-200 block mb-1">
              Are you sure you want to delete camera {camera.camera_id}?
            </span>
            <span>
              This will remove the camera registry entry for{' '}
              <strong className="text-white font-mono">{camera.name}</strong>.
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300">
          <span className="font-semibold text-emerald-400 block mb-1">
            Historical Data Retention Policy:
          </span>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Existing events and detection alerts associated with{' '}
            <code className="text-slate-200">{camera.camera_id}</code> will{' '}
            <strong>NOT</strong> be deleted and remain safely archived in the database.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-surface-border/60">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" loading={loading} onClick={onConfirm}>
            Confirm Deletion
          </Button>
        </div>
      </div>
    </Modal>
  );
};
