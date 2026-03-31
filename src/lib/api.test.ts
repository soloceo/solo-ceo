import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, ApiError } from "./api";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("api.get", () => {
  it("fetches JSON data", async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: 1 }]));
    const data = await api.get<{ id: number }[]>("/api/tasks");
    expect(data).toEqual([{ id: 1 }]);
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks", undefined);
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValue(new Response("Not Found", { status: 404 }));
    await expect(api.get("/api/missing")).rejects.toThrow(ApiError);
    await expect(api.get("/api/missing")).rejects.toMatchObject({ status: 404 });
  });
});

describe("api.post", () => {
  it("sends JSON body with POST method", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 2 }));
    const data = await api.post("/api/tasks", { title: "New" });
    expect(data).toEqual({ id: 2 });
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"title":"New"}',
    });
  });
});

describe("api.put", () => {
  it("sends JSON body with PUT method", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));
    await api.put("/api/tasks/1", { title: "Updated" });
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: '{"title":"Updated"}',
    });
  });
});

describe("api.del", () => {
  it("sends DELETE request", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));
    await api.del("/api/tasks/1");
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/1", { method: "DELETE" });
  });
});

describe("edge cases", () => {
  it("handles 204 No Content", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const result = await api.del("/api/tasks/1");
    expect(result).toBeUndefined();
  });

  it("includes URL in error", async () => {
    mockFetch.mockResolvedValue(new Response("Server Error", { status: 500 }));
    try {
      await api.get("/api/broken");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).url).toBe("/api/broken");
    }
  });
});
