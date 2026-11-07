import "server-only";
import ImageKit from "@imagekit/nodejs";

let client: ImageKit | null = null;

/**
 * @brief Returns a singleton ImageKit client.
 *
 * @description
 * The SDK client holds an HTTP agent and connection pool, so we
 * instantiate it once per process instead of per call.
 */
export function imagekitClient(): ImageKit {
  if (!client) {
    if (!process.env.IMAGEKIT_PRIVATE_KEY) {
      throw new Error("IMAGEKIT_PRIVATE_KEY is not set");
    }
    client = new ImageKit({
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    });
  }
  return client;
}
