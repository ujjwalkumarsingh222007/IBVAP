export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'MAINTENANCE';

export interface Camera {
  id: string; // e.g. "CAM-01"
  name: string; // e.g. "North Border Sector 4"
  location: string; // e.g. "Post Delta-9"
  stream_url: string; // e.g. "rtsp://admin:pass@192.168.1.101:554/live"
  status: CameraStatus;
  fps: number;
  resolution: string; // e.g. "1920x1080"
  zone: string; // e.g. "Sector-North"
  last_ping: string;
  thumbnail_url?: string;
  ai_enabled: boolean;
}

export interface CreateCameraInput {
  name: string;
  location: string;
  stream_url: string;
  zone: string;
  resolution?: string;
  ai_enabled?: boolean;
}
