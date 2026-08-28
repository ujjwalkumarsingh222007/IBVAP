export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiError {
  status: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  camera_id?: string;
  start_time?: string;
  end_time?: string;
}
