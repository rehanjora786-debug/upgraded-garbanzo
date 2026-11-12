import "./globals.css";

export const metadata = {
  title: "Trio Tales | CafeDesk",
  description: "Every Cup Tells a Tale. CafeDesk V2 for Trio Tales."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
