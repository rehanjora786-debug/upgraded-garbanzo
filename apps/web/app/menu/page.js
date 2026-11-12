"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const getStorageKey = (tableToken) => `trio-tales-customer-${tableToken}`;

const isBirthdayToday = (dobValue) => {
  if (!dobValue) return false;

  const value = new Date(dobValue);
  if (Number.isNaN(value.getTime())) return false;

  const today = new Date();
  return value.getMonth() === today.getMonth() && value.getDate() === today.getDate();
};

export default function MenuPage() {
  return (
    <Suspense fallback={<main className="menu-page"><div className="menu-header"><strong>TRIO TALES</strong><h1>QR Menu</h1></div><p className="empty-state">Loading menu…</p></main>}>
      <MenuContent />
    </Suspense>
  );
}

function MenuContent() {
  const searchParams = useSearchParams();
  const tableToken = useMemo(() => searchParams.get("table") || "", [searchParams]);

  const [menu, setMenu] = useState({ cafe: "", table: "", categories: [] });
  const [cart, setCart] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [customerProfile, setCustomerProfile] = useState({ name: "", phone: "", dob: "" });
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (!tableToken) {
      setError("No table QR token was provided.");
      setIsLoading(false);
      return;
    }

    const savedProfile = localStorage.getItem(getStorageKey(tableToken));
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setCustomerProfile({
          name: parsed.name || "",
          phone: parsed.phone || "",
          dob: parsed.dob || ""
        });
        setProfileReady(Boolean(parsed.name && parsed.phone && parsed.dob));
      } catch (storageError) {
        console.warn("Unable to parse saved customer profile", storageError);
      }
    }

    const fetchMenu = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/menu?table=${encodeURIComponent(tableToken)}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load menu");
        }

        setMenu(data);
      } catch (requestError) {
        setError(requestError.message || "Unable to load menu");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMenu();
  }, [tableToken]);

  const handleProfileChange = (field, value) => {
    setCustomerProfile((current) => ({ ...current, [field]: value }));
  };

  const handleProfileSubmit = (event) => {
    event.preventDefault();

    const name = customerProfile.name.trim();
    const phone = customerProfile.phone.trim();
    const dob = customerProfile.dob;

    if (!name || !phone || !dob) {
      setError("Please enter your name, phone number, and date of birth to continue.");
      return;
    }

    const profile = { name, phone, dob };
    localStorage.setItem(getStorageKey(tableToken), JSON.stringify(profile));
    setProfileReady(true);
    setError("");
    setSuccess("");
  };

  const addToCart = (item) => {
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);

      if (existing) {
        return current.map((entry) =>
          entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry
        );
      }

      return [...current, { id: item.id, name: item.name, pricePaise: item.pricePaise, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId, delta) => {
    setCart((current) =>
      current
        .map((entry) =>
          entry.id === itemId ? { ...entry, quantity: Math.max(0, entry.quantity + delta) } : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  };

  const total = cart.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  const birthdayOfferActive = isBirthdayToday(customerProfile.dob);
  const discountPaise = birthdayOfferActive ? Math.round(total * 0.3) : 0;
  const payableTotal = Math.max(0, total - discountPaise);

  const placeOrder = async () => {
    if (!cart.length) {
      setError("Add at least one item to the cart before ordering.");
      return;
    }

    if (!profileReady) {
      setError("Please complete your customer profile before placing an order.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          table: tableToken,
          items: cart.map((item) => ({
            menuItemId: item.id,
            quantity: item.quantity
          })),
          customerName: customerProfile.name,
          customerPhone: customerProfile.phone,
          customerDob: customerProfile.dob,
          notes: birthdayOfferActive ? "Birthday 30% discount applied" : "Order placed from QR menu"
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Order could not be placed");
      }

      const orderMessage = birthdayOfferActive
        ? `Birthday offer applied: Order #${data.order.id.slice(0, 8)} placed successfully.`
        : `Order #${data.order.id.slice(0, 8)} placed successfully.`;

      setSuccess(orderMessage);
      setCart([]);
    } catch (requestError) {
      setError(requestError.message || "Could not place order");
    }
  };

  if (!tableToken) {
    return (
      <main className="menu-page">
        <div className="menu-header">
          <strong>TRIO TALES</strong>
          <h1>QR Menu</h1>
        </div>
        <p className="empty-state">No table code was supplied. Scan a valid QR code to order.</p>
      </main>
    );
  }

  if (!profileReady) {
    return (
      <main className="menu-page">
        <div className="menu-header">
          <strong>{menu.cafe || "Trio Tales"}</strong>
          <h1>{menu.table ? `Table ${menu.table}` : "Cafe Menu"}</h1>
        </div>

        <div className="customer-profile-card">
          <h2>Before you order</h2>
          <p className="birthday-offer-banner">Birthday special: 30% off on your birthday.</p>
          <form onSubmit={handleProfileSubmit} className="customer-profile-form">
            <label>
              <span>Name</span>
              <input
                type="text"
                value={customerProfile.name}
                onChange={(event) => handleProfileChange("name", event.target.value)}
                placeholder="Enter your full name"
              />
            </label>
            <label>
              <span>Phone number</span>
              <input
                type="tel"
                value={customerProfile.phone}
                onChange={(event) => handleProfileChange("phone", event.target.value)}
                placeholder="Enter your mobile number"
              />
            </label>
            <label>
              <span>Date of birth</span>
              <input
                type="date"
                value={customerProfile.dob}
                onChange={(event) => handleProfileChange("dob", event.target.value)}
              />
            </label>
            {error && <p className="form-message error">{error}</p>}
            <button type="submit" className="cta-button">Continue to menu</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="menu-page">
      <header className="menu-header">
        <div>
          <strong>{menu.cafe || "Trio Tales"}</strong>
          <h1>{menu.table ? `Table ${menu.table}` : "Cafe Menu"}</h1>
        </div>
      </header>

      {error && <p className="form-message error">{error}</p>}
      {success && <p className="form-message success">{success}</p>}
      {birthdayOfferActive && <p className="form-message success">Happy birthday! You received 30% off today.</p>}

      {isLoading ? (
        <p className="empty-state">Loading menu…</p>
      ) : (
        <div className="menu-grid-wrapper">
          <section className="menu-grid">
            {menu.categories?.length ? (
              menu.categories.map((category) => (
                <div key={category.id} className="menu-category-block">
                  <h2>{category.name}</h2>
                  <div className="menu-items">
                    {category.items?.map((item) => {
                      const itemQuantity = cart.find((entry) => entry.id === item.id)?.quantity || 0;

                      return (
                        <article key={item.id} className="menu-item">
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <div className="menu-image-placeholder">☕</div>}
                          <div className="menu-copy">
                            <h3>{item.name}</h3>
                            <p>{item.description || "Freshly prepared and served hot."}</p>
                            <div className="menu-row">
                              <strong>{(item.pricePaise / 100).toFixed(2)} INR</strong>
                              <div className="menu-actions">
                                <div className="item-qty-picker" aria-label={`Quantity for ${item.name}`}>
                                  <button type="button" onClick={() => updateQuantity(item.id, -1)} aria-label={`Decrease ${item.name} quantity`}>−</button>
                                  <span>{itemQuantity}</span>
                                  <button type="button" onClick={() => addToCart(item)} aria-label={`Increase ${item.name} quantity`}>+</button>
                                </div>
                                <button type="button" onClick={() => addToCart(item)}>Add</button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">No menu items available for this table yet.</p>
            )}
          </section>

          <aside className="cart-panel">
            <h2>Your order</h2>
            <p className="customer-summary">Customer: {customerProfile.name}</p>
            <p className="customer-summary">Phone: {customerProfile.phone}</p>
            {cart.length === 0 ? (
              <p className="empty-state">Your cart is empty.</p>
            ) : (
              <div className="cart-items">
                {cart.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div>
                      <strong>{item.name}</strong>
                      <span>{(item.pricePaise / 100).toFixed(2)} INR each</span>
                    </div>
                    <div className="cart-controls">
                      <button type="button" onClick={() => updateQuantity(item.id, -1)}>-</button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="totals">
              <span>Subtotal</span>
              <strong>{(total / 100).toFixed(2)} INR</strong>
            </div>
            {discountPaise > 0 && (
              <div className="totals discount-row">
                <span>Birthday 30% off</span>
                <strong>-{(discountPaise / 100).toFixed(2)} INR</strong>
              </div>
            )}
            <div className="totals total-row">
              <span>Total</span>
              <strong>{(payableTotal / 100).toFixed(2)} INR</strong>
            </div>

            <button type="button" className="cta-button" onClick={placeOrder} disabled={!cart.length}>Place order</button>
          </aside>
        </div>
      )}
    </main>
  );
}
