import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { createApiClient } from "./ApiClient";

describe("API client", () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it("joins the base URL and decodes successful JSON responses", async () => {
    const fetchFunction = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ files: [] }), { status: 200 }),
    );
    const client = createApiClient("http://localhost:8000/", fetchFunction);

    await expect(client.request<{ files: unknown[] }>("/files")).resolves.toEqual({ files: [] });
    expect(fetchFunction).toHaveBeenCalledWith("http://localhost:8000/files", {
      headers: {},
    });
  });

  it("sends JSON request bodies and content type", async () => {
    const fetchFunction = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ scanned: 3 }), { status: 200 }),
    );
    const client = createApiClient("http://localhost:8000", fetchFunction);

    await client.request("/scan", { method: "POST", body: JSON.stringify({ root_path: "C:/data" }) });

    expect(fetchFunction).toHaveBeenCalledWith("http://localhost:8000/scan", {
      method: "POST",
      body: JSON.stringify({ root_path: "C:/data" }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("surfaces the API detail when a request fails", async () => {
    const fetchFunction = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Folder does not exist" }), { status: 404 }),
    );
    const client = createApiClient("http://localhost:8000", fetchFunction);

    await expect(client.request("/scan")).rejects.toThrow("Folder does not exist");
  });

  it("returns undefined for a successful no-content response", async () => {
    const fetchFunction = jest.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createApiClient("http://localhost:8000", fetchFunction);

    await expect(client.request<void>("/files/1", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
