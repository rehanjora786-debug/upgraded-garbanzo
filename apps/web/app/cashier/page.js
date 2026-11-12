"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const STORAGE_KEY = "trio-tales-cafedesk-auth";

export default function CashierPage() {
  const [auth, setAuth] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [payingId, setPayingId] = useState(null);

  useEffect(() => {
    const savedAuth = localStorage.getItem(STORAGE_KEY);

    if (!savedAuth) {
      setLoading(false);
      setError("Please sign in to use the cash desk.");
      return;
    }

    try {
      const parsed = JSON.parse(savedAuth);
      setAuth(parsed);
      if (parsed.user?.role && parsed.user.role !== "CASHIER") {
        setError("This page is for cashier staff only.");
      }
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
      const response = await fetch(`${API_BASE}/api/orders`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Could not load cashier view");
      }

      setOrders(data.orders || []);
      setError("");
      setSuccess("");
    } catch (requestError) {
      setError(requestError.message || "Unable to load cashier orders.");
    } finally {
      setLoading(false);
    }
  };

  const paidOrders = useMemo(
    () => orders.filter((order) => order.payment?.status === "PAID" || order.status === "COMPLETED").length,
    [orders]
  );

  const outstandingTotal = useMemo(
    () => orders.reduce((sum, order) => {
      const unpaid = !order.payment || order.payment.status !== "PAID";
      return sum + (unpaid ? order.totalPaise : 0);
    }, 0),
    [orders]
  );

  const markPaid = async (orderId) => {
    if (!auth?.token) return;

    try {
      setPayingId(orderId);
      const order = orders.find((entry) => entry.id === orderId);
      const response = await fetch(`${API_BASE}/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          method: "CASH",
          status: "PAID",
          amountPaise: order?.totalPaise || 0
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Could not record payment");
      }

      setSuccess(`Payment marked as paid for order ${orderId.slice(0, 8)}.`);
      await loadOrders(auth.token);
    } catch (requestError) {
      setError(requestError.message || "Could not record payment.");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <main className="cashier-shell">
      <header className="topbar">
        <div className="brandmark">☕</div>
        <div className="brandcopy">
          <div className="eyebrow">CASH DESK</div>
          <div className="brand">TRIO TALES <span>· Cashier</span></div>
        </div>
        <div className="topbar-actions">
          <a className="nav-link" href="/">Dashboard</a>
          <a className="nav-link" href="/kitchen">Kitchen</a>
        </div>
      </header>

      <section className="dashboard-hero">
        <div>
          <p className="eyebrow goldtext">SALES READY</p>
          <h1>Cash desk</h1>
        </div>
        <div className="user-badge">{auth?.user?.role || "CASHIER"}</div>
      </section>

      <section className="cashier-summary">
        <div className="summary-pill accent">
          <span>Open bills</span>
          <strong>{orders.filter((order) => !order.payment || order.payment.status !== "PAID").length}</strong>
        </div>
        <div className="summary-pill amber">
          <span>Paid today</span>
          <strong>{paidOrders}</strong>
        </div>
        <div className="summary-pill success">
          <span>Outstanding</span>
          <strong>{(outstandingTotal / 100).toFixed(2)} INR</strong>
        </div>
      </section>

      {error && <p className="form-message error">{error}</p>}
      {success && <p className="form-message success">{success}</p>}

      {loading ? (
        <p className="empty-state">Loading cash desk…</p>
      ) : (
        <section className="cashier-orders">
          {orders.length === 0 ? (
            <div className="manage-panel">
              <p className="empty-state">No orders yet.</p>
            </div>
          ) : (
            orders.map((order) => {
              const isPaid = order.payment?.status === "PAID";

              return (
                <article key={order.id} className="cashier-card">
                  <div className="data-row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <strong>Order {order.id.slice(0, 8)}</strong>
                      <span>{order.table} · {order.customer}</span>
                    </div>
                    <span className={`status-pill ${isPaid ? "paid" : "pending"}`}>{isPaid ? "Paid" : "Unpaid"}</span>
                  </div>

                  <div className="order-items">
                    {order.items.map((item) => (
                      <div key={item.id} className="order-item-row">
                        <span>{item.name} × {item.quantity}</span>
                        <strong>{(item.lineTotalPaise / 100).toFixed(2)} INR</strong>
                      </div>
                    ))}
                  </div>

                  <div className="data-row" style={{ justifyContent: "space-between", marginTop: 12 }}>
                    <span className="manage-status">{new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <strong>{(order.totalPaise / 100).toFixed(2)} INR</strong>
                  </div>

                  {!isPaid && (
                    <button
                      type="button"
                      className="primary-button"
                      style={{ width: "100%", marginTop: 14 }}
                      disabled={payingId === order.id}
                      onClick={() => markPaid(order.id)}
                    >
                      {payingId === order.id ? "Recording..." : "Mark paid"}
                    </button>
                  )}
                </article>
              );
            })
          )}
        </section>
      )}
    </main>
  );
}
