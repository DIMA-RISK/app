import '../styles/bootstrap.min.css';
import '../styles/countdown.css';

export const metadata = {
  title: 'DIMA Risk',
  description: 'AI Risk Intelligence Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
