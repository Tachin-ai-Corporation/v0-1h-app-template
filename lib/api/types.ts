// Generic API Error Types
export interface ApiError {
  message: string
  status?: number
  code?: string
  details?: any
}
