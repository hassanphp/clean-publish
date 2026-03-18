import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "") || ""
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

const baseQuery = fetchBaseQuery({
  baseUrl: `${API_BASE || ""}/api/v1`,
});

export interface DealerCreate {
  name: string;
  email: string;
}

export interface DealerUpdate {
  name?: string;
  email?: string;
}

export interface DealerPreferencesUpdate {
  logo_corner_enabled?: boolean;
  logo_corner_position?: "left" | "right";
  license_plate_enabled?: boolean;
  logo_3d_wall_enabled?: boolean;
  default_studio_id?: number | null;
}

export const dealerApi = createApi({
  reducerPath: "dealerApi",
  baseQuery,
  tagTypes: ["Dealer", "DealerList"],
  endpoints: (builder) => ({
    getDealers: builder.query<
      Array<{ id: number; name: string; email: string; created_at: string; updated_at: string }>,
      { email?: string } | void
    >({
      query: (params) => ({
        url: "/dealers",
        params: params || {},
      }),
      providesTags: ["DealerList"],
    }),
    getDealer: builder.query<
      {
        id: number;
        name: string;
        email: string;
        created_at: string;
        updated_at: string;
        preferences?: {
          logo_corner_enabled: boolean;
          logo_corner_position: string;
          license_plate_enabled: boolean;
          logo_3d_wall_enabled: boolean;
          default_studio_id: number | null;
        } | null;
        assets?: Array<{
          id: number;
          asset_type: string;
          file_path: string | null;
          data_b64: string | null;
          created_at: string;
        }>;
      },
      number
    >({
      query: (id) => `/dealers/${id}`,
      providesTags: (_, __, id) => [{ type: "Dealer", id }],
    }),
    createDealer: builder.mutation<
      { id: number; name: string; email: string; created_at: string; updated_at: string },
      DealerCreate
    >({
      query: (body) => ({
        url: "/dealers",
        method: "POST",
        body,
      }),
      invalidatesTags: ["DealerList"],
    }),
    updateDealer: builder.mutation<
      { id: number; name: string; email: string; created_at: string; updated_at: string },
      { id: number; body: DealerUpdate }
    >({
      query: ({ id, body }) => ({
        url: `/dealers/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_, __, { id }) => [{ type: "Dealer", id }, "DealerList"],
    }),
    updatePreferences: builder.mutation<
      Record<string, unknown>,
      { id: number; body: DealerPreferencesUpdate }
    >({
      query: ({ id, body }) => ({
        url: `/dealers/${id}/preferences`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_, __, { id }) => [{ type: "Dealer", id }],
    }),
    getStudioAsset: builder.query<{ data_uri: string }, number>({
      query: (id) => `/dealers/${id}/assets/studio`,
      providesTags: (_, __, id) => [{ type: "Dealer", id }],
    }),
    uploadAsset: builder.mutation<
      { id: number; asset_type: string; created_at: string },
      { id: number; assetType: string; file?: File; dataB64?: string }
    >({
      query: ({ id, assetType, file, dataB64 }) => {
        const formData = new FormData();
        formData.append("asset_type", assetType);
        if (file) {
          formData.append("file", file);
        } else if (dataB64) {
          formData.append("data_b64", dataB64);
        }
        return {
          url: `/dealers/${id}/assets`,
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: (_, __, { id }) => [{ type: "Dealer", id }],
    }),
    deleteAsset: builder.mutation<
      { deleted: boolean; asset_id: number },
      { id: number; assetId: number }
    >({
      query: ({ id, assetId }) => ({
        url: `/dealers/${id}/assets/${assetId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_, __, { id }) => [{ type: "Dealer", id }],
    }),
  }),
});

export const {
  useGetDealersQuery,
  useGetDealerQuery,
  useGetStudioAssetQuery,
  useCreateDealerMutation,
  useUpdateDealerMutation,
  useUpdatePreferencesMutation,
  useUploadAssetMutation,
  useDeleteAssetMutation,
} = dealerApi;
