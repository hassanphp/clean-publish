import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface DealerPreferences {
  logo_corner_enabled: boolean;
  logo_corner_position: "left" | "right";
  license_plate_enabled: boolean;
  logo_3d_wall_enabled: boolean;
  default_studio_id: number | null;
}

export interface Dealer {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  preferences?: DealerPreferences | null;
  assets?: Array<{
    id: number;
    asset_type: string;
    file_path: string | null;
    data_b64: string | null;
    created_at: string;
  }>;
}

export interface BrandingOptions {
  logo_corner_enabled?: boolean;
  logo_corner_position?: "left" | "right";
  license_plate_enabled?: boolean;
  logo_3d_wall_enabled?: boolean;
}

interface DealerState {
  selectedDealerId: number | null;
  useDealerSettings: boolean;
}

const initialState: DealerState = {
  selectedDealerId: null,
  useDealerSettings: false,
};

const dealerSlice = createSlice({
  name: "dealer",
  initialState,
  reducers: {
    setSelectedDealer: (state, action: PayloadAction<number | null>) => {
      state.selectedDealerId = action.payload;
    },
    setUseDealerSettings: (state, action: PayloadAction<boolean>) => {
      state.useDealerSettings = action.payload;
    },
    clearDealerSelection: (state) => {
      state.selectedDealerId = null;
      state.useDealerSettings = false;
    },
  },
});

export const { setSelectedDealer, setUseDealerSettings, clearDealerSelection } =
  dealerSlice.actions;
export default dealerSlice.reducer;
