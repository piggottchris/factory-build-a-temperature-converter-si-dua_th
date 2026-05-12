import "./globals.css";

export const metadata = {
  title: "darkpoc spike",
  description: "MAF + FastAPI + CopilotKit verification",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
