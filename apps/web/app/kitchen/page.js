"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const STORAGE_KEY = "trio-tales-cafedesk-auth";
const STATUS_ORDER = ["PLACED", "ACCEPTED", "PREPARING", "READY"];

const formatTime = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function KitchenPage() {
  const [auth, setAuth] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    const savedAuth = localStorage.getItem(STORAGE_KEY);

    if (!savedAuth) {
      setLoading(false);
      setError("Please sign in to view the kitchen queue.");
      return;
    }

    try {
      const parsed = JSON.parse(savedAuth);
      setAuth(parsed);
      loadOrders(parsed.token);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
      setError("Authentication was invalid. Please sign in again.");
    }
  }, []);

  const loadOrders = async (token) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/orders/kitchen`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Could not load kitchen queue");
      }

      setOrders(data.orders || []);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Unable to load the kitchen queue.");
    } finally {
      setLoading(false);
    }
  };

  const groupedOrders = useMemo(() => {
    const byStatus = {};

    STATUS_ORDER.forEach((status) => {
      byStatus[status] = [];
    });

    orders.forEach((order) => {
      const current = byStatus[order.status] || [];
      current.push(order);
      byStatus[order.status] = current;
    });

    return byStatus;
  }, [orders]);

  const readyCount = groupedOrders.READY?.length || 0;
  const prepCount = (groupedOrders.ACCEPTED?.length || 0) + (groupedOrders.PREPARING?.length || 0);
  const newCount = groupedOrders.PLACED?.length || 0;

  const advanceOrder = async (orderId) => {
    if (!auth?.token) return;

    try {
      setUpdatingId(orderId);
      const response = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({ advance: true })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Could not update order status");
      }

      await loadOrders(auth.token);
    } catch (requestError) {
      setError(requestError.message || "Could not update the kitchen queue.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="kitchen-shell">
      <header className="topbar">
        <div className="brandmark">☕</div>
        <div className="brandcopy">
          <div className="eyebrow">KITCHEN VIEW</div>
          <div className="brand">TRIO TALES <span>· Queue</span></div>
        </div>
        <div className="topbar-actions">
          <a className="nav-link" href="/manage">Manage</a>
          <a className="nav-link" href="/">Dashboard</a>
        </div>
      </header>

      <section className="dashboard-hero">
        <div>
          <p className="eyebrow goldtext">LIVE PREP</p>
          <h1>Kitchen queue</h1>
        </div>
        <button type="button" className="small-button" onClick={() => auth?.token && loadOrders(auth.token)}>
          Refresh
        </button>
      </section>

      <section className="kitchen-summary" aria-live="polite">
        <div className="summary-pill accent">
          <span>New</span>
          <strong>{newCount}</strong>
        </div>
        <div className="summary-pill amber">
          <span>In prep</span>
          <strong>{prepCount}</strong>
        </div>
        <div className="summary-pill success">
          <span>Ready now</span>
          <strong>{readyCount}</strong>
        </div>
      </section>

      {readyCount > 0 && (
        <div className="kitchen-alert">
          {readyCount} order{readyCount === 1 ? "" : "s"} ready for pickup.
        </div>
      )}

      {error && <p className="form-message error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading kitchen queue…</p>
      ) : (
        <section className="kitchen-grid">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="kitchen-column">
              <div className="kitchen-column-header">
                <h3>{status}</h3>
                <span>{groupedOrders[status]?.length || 0}</span>
              </div>

              {groupedOrders[status]?.length ? (
                groupedOrders[status].map((order) => (
                  <article key={order.id} className="kitchen-order-card">
                    <div className="data-row" style={{ justifyContent: "space-between" }}>
                      <strong>#{order.id.slice(0, 8)}</strong>
                      <small>{formatTime(order.createdAt)}</small>
                    </div>

                    <p className="kitchen-table">{order.table || "Takeaway"}</p>

                    <div className="order-items">
                      {order.items.map((item) => (
                        <div key={item.id} className="order-item-row">
                          <span>{item.name} × {item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {status !== "READY" && (
                      <button
                        type="button"
                        className="small-button"
                        style={{ marginTop: 12, width: "100%" }}
                        disabled={updatingId === order.id}
                        onClick={() => advanceOrder(order.id)}
                      >
                        {updatingId === order.id ? "Updating..." : "Advance"}
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <div className="kitchen-empty">No orders</div>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
