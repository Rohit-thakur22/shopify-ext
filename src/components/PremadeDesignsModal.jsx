import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Search, Loader2 } from "lucide-react";

/** Normalize tags from Shopify API — can be an array or comma-separated string. */
function parseTags(tags) {
  if (Array.isArray(tags)) return tags.map((t) => t.trim()).filter(Boolean);
  if (typeof tags === "string") return tags.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

const PremadeDesignsModal = ({ open, onClose, onSelectImage }) => {
  const [products, setProducts] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [activeTag, setActiveTag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingImageId, setLoadingImageId] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchProducts = useCallback(async (pageNum = 1, append = false) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/collections/premade-designs/products.json?limit=24&page=${pageNum}`
      );
      if (!res.ok) throw new Error("Failed to fetch premade designs");
      const data = await res.json();
      const fetched = data.products || [];

      // Extract all unique tags
      if (!append) {
        const tagSet = new Set();
        fetched.forEach((p) => parseTags(p.tags).forEach((t) => tagSet.add(t)));
        setAllTags(Array.from(tagSet).sort());
      } else {
        setAllTags((prev) => {
          const tagSet = new Set(prev);
          fetched.forEach((p) => parseTags(p.tags).forEach((t) => tagSet.add(t)));
          return Array.from(tagSet).sort();
        });
      }

      setProducts((prev) => (append ? [...prev, ...fetched] : fetched));
      setHasMore(fetched.length === 24);
      setPage(pageNum);
    } catch (err) {
      console.error("Error fetching premade designs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchProducts(1, false);
    } else {
      // Reset state when modal closes
      setProducts([]);
      setActiveTag(null);
      setSearchQuery("");
      setPage(1);
    }
  }, [open, fetchProducts]);

  const handleSelectImage = async (product) => {
    const image = product.images?.[0];
    if (!image) return;

    const imageUrl = image.src;
    setLoadingImageId(product.id);

    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error("Failed to fetch image");
      const blob = await res.blob();
      const ext = (blob.type || "image/png").split("/")[1] || "png";
      const file = new File([blob], `premade-${product.handle}.${ext}`, {
        type: blob.type || "image/png",
      });
      const blobUrl = URL.createObjectURL(blob);
      onSelectImage(blobUrl, file);
      onClose();
    } catch (err) {
      console.error("Error loading premade design:", err);
    } finally {
      setLoadingImageId(null);
    }
  };

  // Filter products by active tag and search query
  const filtered = products.filter((p) => {
    const tags = parseTags(p.tags).map((t) => t.toLowerCase());
    const matchesTag = !activeTag || tags.includes(activeTag.toLowerCase());
    const matchesSearch =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tags.some((t) => t.includes(searchQuery.toLowerCase()));
    return matchesTag && matchesSearch;
  });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "1rem",
          width: "min(95vw, 800px)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #e5e7eb",
            background: "linear-gradient(135deg, #7b2cbf 0%, #9d4edd 100%)",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#fff",
              }}
            >
              Pre-made Designs
            </h2>
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.8125rem",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              Click any design to use it
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.5rem",
              cursor: "pointer",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search + Tag Filters */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #f3f4f6",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9ca3af",
              }}
            />
            <input
              type="text"
              placeholder="Search designs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem 0.625rem 2.25rem",
                borderRadius: "0.5rem",
                border: "1px solid #e5e7eb",
                fontSize: "0.875rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <button
                onClick={() => setActiveTag(null)}
                style={{
                  padding: "0.375rem 0.875rem",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "1px solid",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  borderColor: !activeTag ? "#7b2cbf" : "#e5e7eb",
                  backgroundColor: !activeTag ? "#7b2cbf" : "#fff",
                  color: !activeTag ? "#fff" : "#374151",
                }}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                  style={{
                    padding: "0.375rem 0.875rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "1px solid",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    borderColor:
                      activeTag === tag ? "#7b2cbf" : "#e5e7eb",
                    backgroundColor:
                      activeTag === tag ? "#7b2cbf" : "#fff",
                    color: activeTag === tag ? "#fff" : "#374151",
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Image Grid */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.25rem 1.5rem",
          }}
        >
          {loading && products.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "3rem",
                gap: "1rem",
                color: "#6b7280",
              }}
            >
              <Loader2 size={32} className="animate-spin" />
              <p style={{ margin: 0, fontSize: "0.875rem" }}>
                Loading designs...
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem",
                color: "#6b7280",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>
                No designs found
              </p>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem" }}>
                Try a different tag or search term
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: "1rem",
                }}
              >
                {filtered.map((product) => {
                  const image = product.images?.[0];
                  if (!image) return null;
                  const isLoading = loadingImageId === product.id;

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isLoading && handleSelectImage(product)}
                      style={{
                        cursor: isLoading ? "wait" : "pointer",
                        borderRadius: "0.75rem",
                        border: "1px solid #e5e7eb",
                        overflow: "hidden",
                        transition: "all 0.2s",
                        opacity: isLoading ? 0.6 : 1,
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        if (!isLoading) {
                          e.currentTarget.style.borderColor = "#7b2cbf";
                          e.currentTarget.style.boxShadow =
                            "0 4px 12px rgba(123,44,191,0.15)";
                          e.currentTarget.style.transform = "translateY(-2px)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e5e7eb";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.transform = "none";
                      }}
                    >
                      {isLoading && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(255,255,255,0.7)",
                            zIndex: 2,
                            borderRadius: "0.75rem",
                          }}
                        >
                          <Loader2
                            size={24}
                            className="animate-spin"
                            style={{ color: "#7b2cbf" }}
                          />
                        </div>
                      )}
                      <div
                        style={{
                          aspectRatio: "1",
                          backgroundImage: `url(${image.src})`,
                          backgroundSize: "contain",
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                          backgroundColor: "#f9fafb",
                        }}
                      />
                      <div
                        style={{
                          padding: "0.5rem 0.625rem",
                          borderTop: "1px solid #f3f4f6",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "#374151",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {product.title}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load more */}
              {hasMore && (
                <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                  <button
                    onClick={() => fetchProducts(page + 1, true)}
                    disabled={loading}
                    style={{
                      padding: "0.625rem 1.5rem",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      color: "#374151",
                      cursor: loading ? "wait" : "pointer",
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PremadeDesignsModal;
