"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const STORAGE_KEY = "trio-tales-cafedesk-auth";

const formatMoney = (paise) => `₹ ${(Number(paise || 0) / 100).toFixed(2)}`;

const emptyCategory = { name: "", sortOrder: 0 };
const emptyItem = {
  name: "",
  description: "",
  pricePaise: "",
  categoryId: "",
  imageUrl: ""
};
const emptyTable = { label: "" };

export default function ManagePage() {
  const [auth, setAuth] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [tableQrs, setTableQrs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerAutomation, setCustomerAutomation] = useState({
    weeklyOfferMessage: "",
    birthdayMessageTemplate: "",
    reviewMessageTemplate: ""
  });
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [itemImageFile, setItemImageFile] = useState(null);
  const [itemImagePreview, setItemImagePreview] = useState("");
  const itemImageInputRef = useRef(null);
  const [tableForm, setTableForm] = useState(emptyTable);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [payingOrderId, setPayingOrderId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const savedAuth = localStorage.getItem(STORAGE_KEY);

    if (!savedAuth) {
      setLoading(false);
      setError("Please sign in to manage the cafe.");
      return;
    }

    try {
      const parsed = JSON.parse(savedAuth);
      setAuth(parsed);

      if (parsed.user?.role === "KITCHEN") {
        setLoading(false);
        setError("Kitchen staff can use the queue, but management tools require owner or manager access.");
        return;
      }

      loadData(parsed.token);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
      setError("Authentication was invalid. Please sign in again.");
    }
  }, []);

  useEffect(() => {
    if (!itemImagePreview) return undefined;
    return () => URL.revokeObjectURL(itemImagePreview);
  }, [itemImagePreview]);

  const loadData = async (token) => {
    try {
      setLoading(true);
      const [menuResponse, tablesResponse, tableQrResponse, ordersResponse, customersResponse] = await Promise.all([
        fetch(`${API_BASE}/api/menu/admin`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        fetch(`${API_BASE}/api/tables`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        fetch(`${API_BASE}/api/tables/qr`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        fetch(`${API_BASE}/api/orders`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        fetch(`${API_BASE}/api/customers`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
      ]);

      if ([menuResponse, tablesResponse, tableQrResponse, ordersResponse, customersResponse].some((response) => response.status === 401)) {
        localStorage.removeItem(STORAGE_KEY);
        setAuth(null);
        throw new Error("Your session expired. Please sign in again.");
      }

      if (!menuResponse.ok || !tablesResponse.ok || !tableQrResponse.ok || !ordersResponse.ok || !customersResponse.ok) {
        throw new Error("Could not load cafe data");
      }

      const menuData = await menuResponse.json();
      const tablesData = await tablesResponse.json();
      const tableQrData = await tableQrResponse.json();
      const ordersData = await ordersResponse.json();
      const customersData = await customersResponse.json();

      setCategories(menuData.categories || []);
      setTables(tablesData.tables || []);
      setTableQrs(tableQrData.tables || []);
      setOrders(ordersData.orders || []);
      setCustomers(customersData.customers || []);
      setCustomerAutomation(customersData.automation || {
        weeklyOfferMessage: "",
        birthdayMessageTemplate: "",
        reviewMessageTemplate: ""
      });
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Unable to load cafe data");
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    if (!auth?.token) return;

    try {
      const response = await fetch(`${API_BASE}/api/menu/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify(categoryForm)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create category");
      }

      setCategoryForm(emptyCategory);
      setSuccess("Menu category created.");
      await loadData(auth.token);
    } catch (requestError) {
      setError(requestError.message || "Could not create category");
    }
  };

  const handleItemSubmit = async (event) => {
    event.preventDefault();
    if (!auth?.token) {
      setError("Sign in as the owner or manager before adding menu items.");
      return;
    }

    try {
      let imageUrl = itemForm.imageUrl.trim();

      if (itemImageFile) {
        const uploadResponse = await fetch(`${API_BASE}/api/menu/images`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${auth.token}`,
            "Content-Type": itemImageFile.type
          },
          body: itemImageFile
        });
        const uploadData = await uploadResponse.json();

        if (!uploadResponse.ok) {
          throw new Error(uploadData.error || "Could not upload menu image");
        }

        imageUrl = new URL(uploadData.imageUrl, API_BASE).toString();
      }

      if (!imageUrl) {
        const categoryName = categories.find((category) => category.id === itemForm.categoryId)?.name.toLowerCase() || "";
        imageUrl = categoryName.includes("pizza")
          ? "/images/pizza.svg"
          : categoryName.includes("burger")
            ? "/images/burger.svg"
            : categoryName.includes("drink")
              ? "/images/drink.svg"
              : categoryName.includes("dessert")
                ? "/images/dessert.svg"
                : "/images/pizza.svg";
      }

      const response = await fetch(`${API_BASE}/api/menu/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          ...itemForm,
          pricePaise: Number(itemForm.pricePaise),
          imageUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create item");
      }

      setItemForm(emptyItem);
      setItemImageFile(null);
      setItemImagePreview("");
      if (itemImageInputRef.current) itemImageInputRef.current.value = "";
      setSuccess("Menu item created.");
      await loadData(auth.token);
    } catch (requestError) {
      setSuccess("");
      setError(requestError.message || "Could not create item");
    }
  };

  const handleItemImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP photo.");
      setItemImageFile(null);
      setItemImagePreview("");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Menu photos must be 5 MB or smaller.");
      setItemImageFile(null);
      setItemImagePreview("");
      event.target.value = "";
      return;
    }

    setItemImageFile(file);
    setItemImagePreview(URL.createObjectURL(file));
    setItemForm((current) => ({ ...current, imageUrl: "" }));
    setError("");
    setSuccess("");
  };

  const handleTableSubmit = async (event) => {
    event.preventDefault();
    if (!auth?.token) return;

    try {
      const response = await fetch(`${API_BASE}/api/tables`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify(tableForm)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create table");
      }

      setTableForm(emptyTable);
      setSuccess("Table added.");
      await loadData(auth.token);
    } catch (requestError) {
      setError(requestError.message || "Could not create table");
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!auth?.token) return;

    try {
      const response = await fetch(`${API_BASE}/api/menu/items/${itemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not delete item");
      }

      setSuccess("Item removed.");
      await loadData(auth.token);
    } catch (requestError) {
      setError(requestError.message || "Could not delete item");
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (!auth?.token) return;

    try {
      const response = await fetch(`${API_BASE}/api/tables/${tableId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not delete table");
      }

      setSuccess("Table removed.");
      await loadData(auth.token);
    } catch (requestError) {
      setError(requestError.message || "Could not delete table");
    }
  };

  const handleOrderStatusUpdate = async (orderId, options = {}) => {
    if (!auth?.token) return;

    try {
      setUpdatingOrderId(orderId);
      setError("");

      const response = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify(options)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update order status");
      }

      setSuccess(`Order status updated to ${data.order.status}.`);
      await loadData(auth.token);
    } catch (requestError) {
      setError(requestError.message || "Could not update order status");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handlePaymentUpdate = async (orderId) => {
    if (!auth?.token) return;

    try {
      setPayingOrderId(orderId);
      setError("");

      const response = await fetch(`${API_BASE}/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          method: "CASH",
          status: "PAID",
          amountPaise: orders.find((order) => order.id === orderId)?.totalPaise || 0
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not record payment");
      }

      setSuccess(`Payment recorded for ${data.payment.method}.`);
      await loadData(auth.token);
    } catch (requestError) {
      setError(requestError.message || "Could not record payment");
    } finally {
      setPayingOrderId(null);
    }
  };

  if (auth?.user?.role === "KITCHEN") {
    return (
      <main className="manage-shell">
        <header className="topbar">
          <div className="brandmark">☕</div>
          <div className="brandcopy">
            <div className="eyebrow">CAFE CONTROL</div>
            <div className="brand">TRIO TALES <span>· Manage</span></div>
          </div>
          <div className="topbar-actions">
            <a className="nav-link" href="/kitchen">Kitchen queue</a>
            <a className="nav-link" href="/">Dashboard</a>
          </div>
        </header>

        <section className="dashboard-hero">
          <div>
            <p className="eyebrow goldtext">KITCHEN ACCESS</p>
            <h1>Queue only</h1>
          </div>
          <div className="user-badge">{auth.user.role}</div>
        </section>

        <div className="manage-panel" style={{ marginTop: 22 }}>
          <p className="empty-state">Kitchen staff can use the queue, but the cafe management tools are restricted to owner or manager roles.</p>
        </div>
      </main>
    );
  }

  if (!auth?.token) {
    return (
      <main className="manage-shell">
        <header className="topbar">
          <div className="brandmark">☕</div>
          <div className="brandcopy">
            <div className="eyebrow">CAFE CONTROL</div>
            <div className="brand">TRIO TALES <span>· Manage</span></div>
          </div>
        </header>
        <section className="manage-panel" style={{ marginTop: 22 }}>
          {loading ? (
            <p className="empty-state">Checking owner access…</p>
          ) : (
            <>
              <h2>Owner sign-in required</h2>
              <p className="empty-state">Sign in as the cafe owner or manager to add menu items and photos.</p>
              <a className="primary-button" href="/">Go to sign in</a>
            </>
          )}
        </section>
      </main>
    );
  }

  if (!["OWNER", "MANAGER"].includes(auth.user?.role)) {
    return (
      <main className="manage-shell">
        <section className="manage-panel" style={{ marginTop: 22 }}>
          <h2>Management access required</h2>
          <p className="empty-state">Only the cafe owner or a manager can add menu items and photos.</p>
          <a className="primary-button" href="/">Back to dashboard</a>
        </section>
      </main>
    );
  }

  return (
    <main className="manage-shell">
      <header className="topbar">
        <div className="brandmark">☕</div>
        <div className="brandcopy">
          <div className="eyebrow">CAFE CONTROL</div>
          <div className="brand">TRIO TALES <span>· Manage</span></div>
        </div>
        <div className="topbar-actions">
          <a className="nav-link" href="/kitchen">Kitchen</a>
          <a className="nav-link" href="/">Dashboard</a>
          <a className="nav-link" href="/">Back home</a>
        </div>
      </header>

      <section className="dashboard-hero">
        <div>
          <p className="eyebrow goldtext">OWNER PANEL</p>
          <h1>Cafe operations</h1>
        </div>
        <div className="user-badge">{auth?.user?.role || "ADMIN"}</div>
      </section>

      {error && <p className="form-message error">{error}</p>}
      {success && <p className="form-message success">{success}</p>}

      {loading ? (
        <p className="empty-state">Loading cafe setup…</p>
      ) : (
        <div id="menu" className="manage-grid">
          <section className="manage-panel">
            <div className="manage-panel-header">
              <h3>Add category</h3>
            </div>
            <form className="manage-form" onSubmit={handleCategorySubmit}>
              <label>
                Category name
                <input
                  value={categoryForm.name}
                  onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
                  placeholder="Espresso"
                  required
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  value={categoryForm.sortOrder}
                  onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: Number(event.target.value) || 0 })}
                />
              </label>
              <button className="primary-button" type="submit">Create category</button>
            </form>
          </section>

          <section className="manage-panel">
            <div className="manage-panel-header">
              <h3>Add menu item</h3>
            </div>
            <form className="manage-form" onSubmit={handleItemSubmit}>
              <label>
                Item name
                <input
                  value={itemForm.name}
                  onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })}
                  placeholder="Cold Brew"
                  required
                />
              </label>
              <label>
                Category
                <select
                  value={itemForm.categoryId}
                  onChange={(event) => setItemForm({ ...itemForm, categoryId: event.target.value })}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
              {categories.length === 0 && (
                <p className="form-message error">Create a menu category before adding an item.</p>
              )}
              <label>
                Description
                <textarea
                  value={itemForm.description}
                  onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })}
                  placeholder="Smooth and citrus-forward coffee"
                />
              </label>
              <label>
                Price (₹)
                <input
                  type="number"
                  min="0"
                  value={itemForm.pricePaise ? Number(itemForm.pricePaise) / 100 : ""}
                  onChange={(event) => setItemForm({ ...itemForm, pricePaise: Math.round(Number(event.target.value || 0) * 100) })}
                  placeholder="299"
                  required
                />
              </label>
              <label>
                Upload photo (JPG, PNG, or WebP; up to 5 MB)
                <input
                  ref={itemImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleItemImageChange}
                />
              </label>
              {itemImagePreview && (
                <img className="item-image-preview" src={itemImagePreview} alt="Selected menu item preview" />
              )}
              {itemImageFile && <p className="manage-status">{itemImageFile.name}</p>}
              <label>
                Or image URL
                <input
                  value={itemForm.imageUrl}
                  onChange={(event) => {
                    setItemForm({ ...itemForm, imageUrl: event.target.value });
                    setItemImageFile(null);
                    setItemImagePreview("");
                    if (itemImageInputRef.current) itemImageInputRef.current.value = "";
                  }}
                  placeholder="Optional"
                />
              </label>
              <button className="primary-button" type="submit">Create item</button>
            </form>
          </section>

          <section className="manage-panel">
            <div className="manage-panel-header">
              <h3>Add table</h3>
            </div>
            <form className="manage-form" onSubmit={handleTableSubmit}>
              <label>
                Table label
                <input
                  value={tableForm.label}
                  onChange={(event) => setTableForm({ label: event.target.value })}
                  placeholder="Table 9"
                  required
                />
              </label>
              <button className="primary-button" type="submit">Create table</button>
            </form>
          </section>
        </div>
      )}

      <section className="manage-panel" style={{ marginTop: 22 }}>
        <div className="manage-panel-header">
          <h3>Menu catalog</h3>
        </div>

        {categories.length === 0 ? (
          <p className="empty-state">No categories yet.</p>
        ) : (
          <div className="manage-list">
            {categories.map((category) => (
              <div key={category.id} className="manage-list-item" style={{ display: "block" }}>
                <div className="data-row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <strong>{category.name}</strong>
                    <span>{category.items?.length || 0} items</span>
                  </div>
                  <span className="manage-status">#{category.sortOrder}</span>
                </div>
                {category.items?.length ? (
                  <div className="manage-list" style={{ marginTop: 14 }}>
                    {category.items.map((item) => (
                      <div key={item.id} className="manage-list-item">
                        {item.imageUrl && <img className="menu-catalog-image" src={item.imageUrl} alt={item.name} />}
                        <div>
                          <strong>{item.name}</strong>
                          <span>{item.description || "No description"}</span>
                          <br />
                          <span>{(item.pricePaise / 100).toFixed(2)} INR</span>
                        </div>
                        <button type="button" className="small-button" onClick={() => handleDeleteItem(item.id)}>Delete</button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="tables" className="manage-panel" style={{ marginTop: 22 }}>
        <div className="manage-panel-header">
          <h3>Tables</h3>
        </div>

        {tables.length === 0 ? (
          <p className="empty-state">No tables yet.</p>
        ) : (
          <div className="manage-list">
            {tables.map((table) => {
              const qr = tableQrs.find((entry) => entry.qrToken === table.qrToken);

              return (
                <div key={table.id} className="manage-list-item table-management-item">
                  <div>
                    <strong>{table.label}</strong>
                    <span>{table.active ? "Active" : "Inactive"}</span>
                    <span className="manage-status">{table.qrToken}</span>
                  </div>
                  {qr && (
                    <div className="table-qr-block">
                      <img className="table-qr-image" src={qr.qrImage} alt={`QR code for ${table.label}`} />
                      <div className="table-qr-actions">
                        <a className="small-button" href={qr.qrImage} download={`trio-tales-${table.label.replace(/\s+/g, "-").toLowerCase()}-qr.png`}>Download QR</a>
                        <a className="small-button" href={qr.menuUrl} target="_blank" rel="noreferrer">Open menu</a>
                      </div>
                    </div>
                  )}
                  <button type="button" className="small-button" onClick={() => handleDeleteTable(table.id)}>Delete table</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section id="customers" className="manage-panel" style={{ marginTop: 22 }}>
        <div className="manage-panel-header">
          <h3>Customer CRM</h3>
        </div>

        <div className="info-grid" style={{ marginBottom: 18 }}>
          <div className="mini-stat-card">
            <span>Total guests</span>
            <strong>{customers.length}</strong>
          </div>
          <div className="mini-stat-card">
            <span>Birthday today</span>
            <strong>{customers.filter((customer) => customer.birthdayToday).length}</strong>
          </div>
          <div className="mini-stat-card">
            <span>Top spend</span>
            <strong>{customers.length ? formatMoney(Math.max(...customers.map((customer) => Number(customer.totalSpentPaise || 0)))) : formatMoney(0)}</strong>
          </div>
        </div>

        <div className="automation-panel">
          <div>
            <h4>Weekly offer</h4>
            <p>{customerAutomation.weeklyOfferMessage || "No weekly offer message created yet."}</p>
          </div>
          <div>
            <h4>Birthday message</h4>
            <p>{customerAutomation.birthdayMessageTemplate || "No birthday automation text created yet."}</p>
          </div>
          <div>
            <h4>Review prompt</h4>
            <p>{customerAutomation.reviewMessageTemplate || "No review prompt created yet."}</p>
          </div>
        </div>

        {customers.length === 0 ? (
          <p className="empty-state">No customer records yet.</p>
        ) : (
          <div className="customer-list">
            {customers.map((customer) => (
              <article key={customer.id} className="customer-card">
                <div className="data-row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <strong>{customer.name}</strong>
                    <span>{customer.phone}</span>
                  </div>
                  <span className={`status-pill ${customer.birthdayToday ? "ready" : "pending"}`}>
                    {customer.birthdayToday ? "Birthday today" : "Regular guest"}
                  </span>
                </div>

                <div className="manage-grid" style={{ marginTop: 12 }}>
                  <div className="mini-stat-card">
                    <span>Visits</span>
                    <strong>{customer.visits || 0}</strong>
                  </div>
                  <div className="mini-stat-card">
                    <span>Spent</span>
                    <strong>{customer.totalSpentDisplay || formatMoney(0)}</strong>
                  </div>
                  <div className="mini-stat-card">
                    <span>Birthday</span>
                    <strong>{customer.birthdayLabel || "No entry"}</strong>
                  </div>
                </div>

                <div className="data-row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                  <a className="small-button" href={customer.whatsappBirthdayLink} target="_blank" rel="noreferrer">WhatsApp birthday</a>
                  <a className="small-button" href={customer.whatsappWeeklyOfferLink} target="_blank" rel="noreferrer">Weekly offer</a>
                  <a className="small-button" href={customer.reviewLink} target="_blank" rel="noreferrer">Google review</a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="orders" className="manage-panel" style={{ marginTop: 22 }}>
        <div className="manage-panel-header">
          <h3>Live orders</h3>
        </div>

        {orders.length === 0 ? (
          <p className="empty-state">No orders have been placed yet.</p>
        ) : (
          <div className="order-list">
            {orders.map((order) => (
              <article key={order.id} className="order-card">
                <div className="data-row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <strong>Order {order.id.slice(0, 8)}</strong>
                    <span>{order.table} · {order.customer}</span>
                  </div>
                  <span className={`status-pill ${String(order.status).toLowerCase()}`}>{order.status}</span>
                </div>

                <div className="order-items">
                  {order.items.map((item) => (
                    <div key={item.id} className="order-item-row">
                      <span>{item.name} × {item.quantity}</span>
                      <strong>{(item.lineTotalPaise / 100).toFixed(2)} INR</strong>
                    </div>
                  ))}
                </div>

                <div className="data-row" style={{ justifyContent: "space-between", marginTop: 10 }}>
                  <span className="manage-status">{new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <strong>{(order.totalPaise / 100).toFixed(2)} INR</strong>
                </div>

                <div className="data-row" style={{ justifyContent: "space-between", marginTop: 12 }}>
                  <span className={`status-pill ${order.payment?.status ? String(order.payment.status).toLowerCase() : "pending"}`}>
                    {order.payment ? `Paid: ${order.payment.status}` : "Unpaid"}
                  </span>

                  {(!order.payment || order.payment.status !== "PAID") && (
                    <button
                      type="button"
                      className="small-button"
                      disabled={payingOrderId === order.id}
                      onClick={() => handlePaymentUpdate(order.id)}
                    >
                      {payingOrderId === order.id ? "Recording..." : "Mark paid"}
                    </button>
                  )}
                </div>

                <div className="data-row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                  {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                    <button
                      type="button"
                      className="small-button"
                      disabled={updatingOrderId === order.id}
                      onClick={() => handleOrderStatusUpdate(order.id, { advance: true })}
                    >
                      {updatingOrderId === order.id ? "Updating..." : "Advance"}
                    </button>
                  )}

                  {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
                    <button
                      type="button"
                      className="small-button"
                      disabled={updatingOrderId === order.id}
                      onClick={() => handleOrderStatusUpdate(order.id, { status: "CANCELLED" })}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
