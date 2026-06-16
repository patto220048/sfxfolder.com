let searchResourcesClient, getOrBuildSearchIndex;

jest.mock("./supabase", () => {
  const mockCategories = [
    { slug: "sfx", name: "Sound Effects" },
    { slug: "meme", name: "Memes" }
  ];

  const mockResources = [
    { id: "1", name: "Fire loop sound", description: "A fire loop", category_id: "sfx", folder_id: null, file_format: "wav", tags: ["fire", "loop"], slug: "fire-loop" },
    { id: "2", name: "Water splash", description: "Water splash sound", category_id: "sfx", folder_id: "folder-1", file_format: "wav", tags: ["water"], slug: "water-splash" }
  ];

  const mockFolders = [
    { id: "folder-1", name: "Nature Sounds", parent_id: null, category_id: "sfx", categories: { slug: "sfx" } }
  ];

  const selectCategories = jest.fn().mockResolvedValue({ data: mockCategories });
  const eqResources = jest.fn().mockResolvedValue({ data: mockResources });
  const selectResources = jest.fn().mockReturnValue({ eq: eqResources });
  const selectFolders = jest.fn().mockResolvedValue({ data: mockFolders });

  const mockFrom = jest.fn((table) => {
    if (table === "categories") {
      return { select: selectCategories };
    }
    if (table === "resources") {
      return { select: selectResources };
    }
    if (table === "folders") {
      return { select: selectFolders };
    }
    return { select: jest.fn().mockResolvedValue({ data: [] }) };
  });

  return {
    supabase: {
      from: mockFrom
    }
  };
});

describe("searchUtils", () => {
  beforeEach(() => {
    jest.resetModules();
    const utils = require("./searchUtils");
    searchResourcesClient = utils.searchResourcesClient;
    getOrBuildSearchIndex = utils.getOrBuildSearchIndex;
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it("should fetch from Supabase and build index when cache is empty", async () => {
    const { supabase } = require("./supabase");
    // Use getOrBuildSearchIndex(true) first to clear module state in test
    await getOrBuildSearchIndex(true);
    const results = await searchResourcesClient("fire");
    
    expect(supabase.from).toHaveBeenCalledWith("categories");
    expect(supabase.from).toHaveBeenCalledWith("resources");
    expect(supabase.from).toHaveBeenCalledWith("folders");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain("Fire");
    expect(sessionStorage.getItem("dam_search_index_v5")).not.toBeNull();
  });

  it("should use session cache on second call", async () => {
    const { supabase } = require("./supabase");
    // Manually populate cache
    const combinedData = [
      { id: "1", type: "resource", name: "Fire loop sound", description: "A fire loop", category: "Sound Effects", categorySlug: "sfx", folderId: null, fileFormat: "wav", tags: ["fire", "loop"], slug: "fire-loop" },
      { id: "2", type: "resource", name: "Water splash", description: "Water splash sound", category: "Sound Effects", categorySlug: "sfx", folderId: "folder-1", fileFormat: "wav", tags: ["water"], slug: "water-splash" }
    ];
    sessionStorage.setItem("dam_search_index_v5", JSON.stringify(combinedData));
    sessionStorage.setItem("dam_search_index_time", Date.now().toString());

    // Call search - should NOT call Supabase
    const results = await searchResourcesClient("water");
    
    expect(supabase.from).not.toHaveBeenCalled();
    expect(results[0].name).toBe("Water splash");
  });

  it("should handle fuzzy matching correctly (typo tolerance)", async () => {
    const combinedData = [
      { id: "1", type: "resource", name: "Fire loop sound", description: "A fire loop", category: "Sound Effects", categorySlug: "sfx", folderId: null, fileFormat: "wav", tags: ["fire", "loop"], slug: "fire-loop" }
    ];
    sessionStorage.setItem("dam_search_index_v5", JSON.stringify(combinedData));
    sessionStorage.setItem("dam_search_index_time", Date.now().toString());

    // Search for "firee" instead of "fire" (fuzzy matching)
    await getOrBuildSearchIndex(true);
    const results = await searchResourcesClient("firee");
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("Fire loop sound");
  });

  it("should return all items when search term is empty", async () => {
    const combinedData = [
      { id: "1", type: "resource", name: "Fire loop sound", description: "A fire loop", category: "Sound Effects", categorySlug: "sfx", folderId: null, fileFormat: "wav", tags: ["fire", "loop"], slug: "fire-loop" }
    ];
    sessionStorage.setItem("dam_search_index_v5", JSON.stringify(combinedData));
    sessionStorage.setItem("dam_search_index_time", Date.now().toString());

    const results = await searchResourcesClient("");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Fire loop sound");
  });
});
