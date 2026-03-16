import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import dealerReducer from "./slices/dealerSlice";
import { dealerApi } from "./api/dealerApi";
import { apiSlice } from "@/lib/store/apiSlice";

export const store = configureStore({
  reducer: {
    dealer: dealerReducer,
    [dealerApi.reducerPath]: dealerApi.reducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(dealerApi.middleware, apiSlice.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
