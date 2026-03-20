import axios from "axios";
import { config } from "./config";
import { DecodedMarket } from "./types";
import { decoderLatency } from "./metrics";

const http = axios.create({
  baseURL: config.decoderUrl,
  timeout: 3000,
});

export async function decodeMarket(dataB64: string): Promise<DecodedMarket> {
  const start = Date.now();
  try {
    const { data } = await http.post<DecodedMarket>("/decode", {
      data_b64: dataB64,
    });
    return data;
  } finally {
    decoderLatency.observe(Date.now() - start);
  }
}
