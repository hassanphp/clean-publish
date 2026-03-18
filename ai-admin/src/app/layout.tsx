export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, sans-serif', margin: 0 }}>
        <div style={{ padding: '16px', maxWidth: 1200, margin: '0 auto' }}>{children}</div>
      </body>
    </html>
  )
}
