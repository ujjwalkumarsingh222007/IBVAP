export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  id: string;
  camera_id: string;
  camera_name: string;
  object_class: 'Person' | 'Vehicle' | 'License Plate' | 'Unidentified Package' | 'Animal' | 'Drone';
  confidence: number;
  bbox: BoundingBox;
  timestamp: string;
  snapshot_url?: string;
  details?: string;
}
