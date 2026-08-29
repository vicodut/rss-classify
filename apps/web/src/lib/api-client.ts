import { tsRestFetchApi } from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { contract } from "@rss-agg/contract";
import { supabase } from "./supabase";

export const tsr = initTsrReactQuery(contract, {
  baseUrl: import.meta.env.VITE_API_URL,
  baseHeaders: {},
  api: async (args) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return tsRestFetchApi({
      ...args,
      headers: {
        ...args.headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
  },
});
