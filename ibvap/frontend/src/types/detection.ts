export type ObjectCategory =
  | 'person'
  | 'vehicle'
  | 'car'
  | 'truck'
  | 'motorcycle'
  | 'license_plate'
  | 'Unidentified Package'
  | 'Animal'
  | 'Drone';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  id: string;
  tracking_id: string; // e.g. "TRK-9801"
  camera_id: string;
  camera_name: string;
  object_class: ObjectCategory;
  confidence: number;
  bbox: BoundingBox;
  timestamp: string;
  snapshot_url?: string;
  event_reference_id?: string;
  details?: string;
}
