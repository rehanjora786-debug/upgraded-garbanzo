"use client";

import { useEffect, useState } from "react";

const EMPTY_CARDS = [
  { label: "Today's Orders", value: "—", icon: "🧾", note: "Live data connects after API modules are added" },
  { label: "Today's Revenue", value: "₹—", icon: "💰", note: "INR reporting foundation" },
  { label: "Repeat Customers", value: "—", icon: "👥", note: "Customer CRM module pending" },
  { label: "Active Rewards", value: "—", icon: "🎟️", note: "5 coffee stamps = 1 free coffee" }
];

const MODULES = [
  { number: "01", title: "QR Ordering", description: "Open the customer menu, cart, and ordering flow.", href: "qr-ordering", roles: ["OWNER", "MANAGER"] },
  { number: "02", title: "Menu & photos", description: "Add menu items, prices, and photos.", href: "/manage#menu", roles: ["OWNER", "MANAGER"] },
  { number: "03", title: "Tables & QR codes", description: "Manage tables and download their customer QR codes.", href: "/manage#tables", roles: ["OWNER", "MANAGER"] },
  { number: "04", title: "Live orders & payments", description: "Track orders, change status, and record payments.", href: "/manage#orders", roles: ["OWNER", "MANAGER"] },
  { number: "05", title: "Kitchen queue", description: "View and update orders being prepared.", href: "/kitchen", roles: ["OWNER", "MANAGER", "KITCHEN"] },
  { number: "06", title: "Customer CRM", description: "View customer visits, birthday offers, and review links.", href: "/manage#customers", roles: ["OWNER", "MANAGER"] },
  { number: "07", title: "Cash desk", description: "View unpaid orders and record payments.", href: "/cashier", roles: ["OWNER", "MANAGER", "CASHIER"] }
];

const STORAGE_KEY = "trio-tales-cafedesk-auth";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function Home() {
  const [auth, setAuth] = useState(null);
  const [cards, setCards] = useState(EMPTY_CARDS);
  const [qrOrderingHref, setQrOrderingHref] = useState("/manage#tables");
  const [mode, setMode] = useState("login");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    name: "Md Samee I Jora",
    email: "owner@trio-tales.com",
    password: "Samee1234",
    setupKey: "trio-tales-setup-key"
  });

  const fillDemoCredentials = (role) => {
    const profiles = {
      owner: {
        name: "Md Samee I Jora",
        email: "owner@trio-tales.com",
        password: "Samee1234"
      },
      kitchen: {
        name: "Kitchen Staff",
        email: "kitchen@trio-tales.com",
        password: "Kitchen1234"
      },
      cashier: {
        name: "Cashier Staff",
        email: "cashier@trio-tales.com",
        password: "Cashier1234"
      }
    };

    const profile = profiles[role] || profiles.owner;

    setForm((current) => ({
      ...current,
      name: profile.name,
      email: profile.email,
      password: profile.password
    }));
  };

  const formatCurrency = (paise) => {
    const rupees = paise / 100;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(rupees);
  };

  useEffect(() => {
    const savedAuth = localStorage.getItem(STORAGE_KEY);

    if (savedAuth) {
      try {
        setAuth(JSON.parse(savedAuth));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!auth?.token) {
      return;
    }

    if (["OWNER", "MANAGER"].includes(auth.user?.role)) {
      fetch(`${API_BASE}/api/tables`, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Unable to load table QR links");
          }

          return response.json();
        })
        .then((payload) => {
          const firstActiveTable = payload.tables?.find((table) => table.active);
          if (firstActiveTable) {
            setQrOrderingHref(`/menu?table=${encodeURIComponent(firstActiveTable.qrToken)}`);
          }
        })
        .catch((requestError) => {
          setError(requestError.message || "Unable to load table QR links.");
        });
    }

    const fetchOverview = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/dashboard/overview`, {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        });

        if (!response.ok) {
          throw new Error("Unable to load dashboard metrics");
        }

        const payload = await response.json();
        const overview = payload?.overview || {};

        setCards([
          {
            label: "Today's Orders",
            value: String(overview.todayOrders ?? 0),
            icon: "🧾",
            note: "Orders already completed today"
          },
          {
            label: "Today's Revenue",
            value: formatCurrency(overview.todayRevenuePaise ?? 0),
            icon: "💰",
            note: "Gross sales for the current day"
          },
          {
            label: "Repeat Customers",
            value: `${overview.repeatCustomers ?? 0}`,
            icon: "👥",
            note: "Customers with more than one order"
          },
          {
            label: "Active Rewards",
            value: String(overview.activeRewards ?? 0),
            icon: "🎟️",
            note: "Reward codes available to redeem"
          }
        ]);
      } catch {
        setCards(EMPTY_CARDS);
      }
    };

    fetchOverview();
  }, [auth]);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
    setError("");
    setSuccess("You have been signed out.");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const endpoint =
        mode === "setup"
          ? `${API_BASE}/api/auth/setup-owner`
          : `${API_BASE}/api/auth/login`;

      const payload =
        mode === "setup"
          ? {
              name: form.name,
              email: form.email,
              password: form.password,
              setupKey: form.setupKey || "trio-tales-setup-key"
            }
          : {
              email: form.email,
              password: form.password
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Authentication failed");
      }

      if (mode === "setup") {
        setSuccess("Owner account created. You can now sign in.");
        setMode("login");
        setForm((current) => ({ ...current, name: "", email: "", password: "" }));
      } else {
        const nextAuth = {
          token: data.token,
          user: data.user
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAuth));
        setAuth(nextAuth);
        setSuccess("Welcome back to CafeDesk.");
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to authenticate right now.");
    } finally {
      setIsLoading(false);
    }
  };

  if (auth) {
    return (
      <main className="shell">
        <header className="topbar">
          <div className="brandmark">☕</div>
          <div className="brandcopy">
            <div className="eyebrow">CAFE MANAGEMENT</div>
            <div className="brand">TRIO TALES <span>· CafeDesk V2</span></div>
          </div>
          <div className="topbar-actions">
            {auth.user.role === "KITCHEN" && <a className="nav-link" href="/kitchen">Kitchen queue</a>}
            {auth.user.role === "CASHIER" && <a className="nav-link" href="/cashier">Cash desk</a>}
            {(auth.user.role === "OWNER" || auth.user.role === "MANAGER") && (
              <>
                <a className="nav-link" href="/kitchen">Kitchen</a>
                <a className="nav-link" href="/manage">Manage cafe</a>
              </>
            )}
            <button className="logout-button" onClick={handleLogout} type="button">Log out</button>
          </div>
        </header>

        <section className="dashboard-hero">
          <div>
            <p className="eyebrow goldtext">OWNER DASHBOARD</p>
            <h1>Welcome back, {auth.user.name}.</h1>
          </div>
          <div className="user-badge">{auth.user.role}</div>
        </section>

        {error && <p className="form-message error">{error}</p>}

        <section className="stats">
          {cards.map((card) => (
            <article className="stat" key={card.label}>
              <div className="stat-top"><span>{card.label}</span><b>{card.icon}</b></div>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
            </article>
          ))}
        </section>

        <section className="section-head modules-head">
          <div><p className="eyebrow">WORKSPACE</p><h2>Management modules</h2></div>
          <span className="pill">Open a module</span>
        </section>

        <section className="modules">
          {MODULES.filter((module) => module.roles.includes(auth.user.role)).map((module) => (
            <a
              className="module module-link"
              key={module.number}
              href={module.href === "qr-ordering" ? qrOrderingHref : module.href}
            >
              <span className="module-no">{module.number}</span>
              <div className="module-copy"><h3>{module.title}</h3><p>{module.description}</p></div>
              <span className="module-status">Open</span>
            </a>
          ))}
        </section>

        <footer>
          <strong>TRIO TALES</strong>
          <span>Every Cup Tells a Tale.</span>
          <span>Contact · 9380160062</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brandmark">☕</div>
          <div>
            <p className="eyebrow">CAFE MANAGEMENT</p>
            <h1>TRIO TALES</h1>
          </div>
        </div>

        <div className="auth-header">
          <div>
            <p className="eyebrow goldtext">EVERY CUP TELLS A TALE</p>
            <h2>{mode === "setup" ? "Create owner account" : "Owner / kitchen sign in"}</h2>
          </div>
          <button
            type="button"
            className="mode-toggle"
            onClick={() => {
              setMode((current) => (current === "login" ? "setup" : "login"));
              setError("");
              setSuccess("");
            }}
          >
            {mode === "login" ? "Set up owner" : "Back to login"}
          </button>
        </div>

        {mode === "login" && (
          <div className="demo-role-buttons" style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <button type="button" className="small-button" onClick={() => fillDemoCredentials("owner")}>Owner demo</button>
            <button type="button" className="small-button" onClick={() => fillDemoCredentials("kitchen")}>Kitchen demo</button>
            <button type="button" className="small-button" onClick={() => fillDemoCredentials("cashier")}>Cashier demo</button>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "setup" && (
            <label>
              Full name
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleFieldChange}
                placeholder="Trio Tales owner"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleFieldChange}
              placeholder="owner@trio-tales.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleFieldChange}
              placeholder="Minimum 8 characters"
              minLength={8}
              required
            />
          </label>

          {mode === "setup" && (
            <label>
              Setup key
              <input
                type="text"
                name="setupKey"
                value={form.setupKey}
                onChange={handleFieldChange}
                placeholder="Use the project setup key"
                required
              />
            </label>
          )}

          {error && <p className="form-message error">{error}</p>}
          {success && <p className="form-message success">{success}</p>}

          <button className="cta-button" type="submit" disabled={isLoading}>
            {isLoading ? "Please wait..." : mode === "setup" ? "Create owner account" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
