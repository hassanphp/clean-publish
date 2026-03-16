export type CameraAngle =
  | "front"
  | "rear"
  | "left"
  | "right"
  | "front_left_34"
  | "front_right_34"
  | "rear_left_34"
  | "rear_right_34"
  | "interior"
  | "interior_1"
  | "interior_2"
  | "interior_3"
  | "interior_4"
  | "interior_5"
  | "interior_6"
  | "interior_7"
  | "interior_8"
  | "detail"
  | "AUTO";

export interface StudioTemplate {
  id: string;
  name: string;
  thumbnail: string;
  description: string;
  category: "Indoor" | "Outdoor" | "Premium";
  isFavorite: boolean;
}

export interface ProcessingJob {
  id: string;
  originalImage: string;
  processedImage?: string;
  angle: CameraAngle;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

export interface BrandingConfig {
  logoUrl: string | null;
  isEnabled: boolean;
  /** When true, apply logo to 3D wall and license plate (V11). Separate from logo corner overlay. */
  logo3dWallEnabled: boolean;
}

export interface Order {
  id: string;
  title: string;
  vin: string;
  createdAt: string;
  status: "active" | "completed" | "draft";
  jobs: ProcessingJob[];
  studioId: string;
  taskType: string;
  branding?: BrandingConfig;
  thumbnailUrl?: string;
  /** Backend project ID when persisted */
  projectId?: number;
}

export interface TaskType {
  id: string;
  label: string;
  icon: string;
  description: string;
}
