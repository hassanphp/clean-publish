/**
 * RTK Query API slice - auth, projects, storage, process-batch.
 * Uses same-origin proxy routes so httpOnly JWT cookie is sent automatically.
 */

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const baseQuery = fetchBaseQuery({
  baseUrl: "",
  credentials: "include",
  prepareHeaders: (headers) => {
    headers.set("Content-Type", "application/json");
    return headers;
  },
});

export interface UserResponse {
  id: number;
  email: string;
  name: string | null;
  credits: number;
  created_at: string;
}

export interface ProjectResponse {
  id: number;
  user_id: number;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string | null;
}

export interface JobImageResponse {
  id: number;
  project_id: number;
  image_index: number;
  original_url: string | null;
  processed_url: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface ProcessBatchParams {
  images: string[];
  target_studio_description?: string;
  studio_reference_image?: string;
  studio_reference_data_uri?: string;
  pipeline_version?: "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "10" | "11";
  project_id?: number;
}

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["User", "Project", "ProjectList"],
  endpoints: (builder) => ({
    getMe: builder.query<UserResponse, void>({
      query: () => "/api/v1/auth/me",
      providesTags: ["User"],
    }),
    getProjects: builder.query<ProjectResponse[], { status?: string } | void>({
      query: (params) => ({
        url: "/api/v1/projects",
        params: params || {},
      }),
      providesTags: ["ProjectList"],
    }),
    createProject: builder.mutation<ProjectResponse, { title?: string }>({
      query: (body) => ({
        url: "/api/v1/projects",
        method: "POST",
        body: body || {},
      }),
      invalidatesTags: ["ProjectList"],
    }),
    getProject: builder.query<ProjectResponse, number>({
      query: (id) => `/api/v1/projects/${id}`,
      providesTags: (_, __, id) => [{ type: "Project", id }],
    }),
    updateProject: builder.mutation<
      ProjectResponse,
      { id: number; title?: string; status?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/api/v1/projects/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_, __, { id }) => [{ type: "Project", id }, "ProjectList"],
    }),
    deleteProject: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/v1/projects/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["ProjectList"],
    }),
    getProjectImages: builder.query<JobImageResponse[], number>({
      query: (projectId) => `/api/v1/projects/${projectId}/images`,
      providesTags: (_, __, id) => [{ type: "Project", id }],
    }),
    upsertProjectImages: builder.mutation<
      JobImageResponse[],
      { projectId: number; images: { image_index: number; original_url?: string; processed_url?: string; status?: string }[] }
    >({
      query: ({ projectId, images }) => ({
        url: `/api/v1/projects/${projectId}/images`,
        method: "POST",
        body: { images },
      }),
      invalidatesTags: (_, __, { projectId }) => [{ type: "Project", id: projectId }, "ProjectList"],
    }),
    getUploadUrl: builder.query<
      { upload_url: string; filename: string },
      { filename: string; content_type?: string }
    >({
      query: ({ filename, content_type = "image/jpeg" }) => ({
        url: "/api/v1/storage/upload-url",
        params: { filename, content_type },
      }),
    }),
    createCheckout: builder.mutation<
      { url: string; session_id: string },
      { plan_id: string; success_url?: string; cancel_url?: string }
    >({
      query: (body) => ({
        url: "/api/v1/billing/checkout",
        method: "POST",
        body,
      }),
    }),
    processBatch: builder.mutation<
      { job_id?: string },
      ProcessBatchParams
    >({
      query: (body) => ({
        url: "/api/v1/process-batch",
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useGetMeQuery,
  useLazyGetMeQuery,
  useGetProjectsQuery,
  useCreateProjectMutation,
  useGetProjectQuery,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectImagesQuery,
  useUpsertProjectImagesMutation,
  useLazyGetUploadUrlQuery,
  useProcessBatchMutation,
  useCreateCheckoutMutation,
} = apiSlice;
