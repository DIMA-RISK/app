import { Rubik } from "next/font/google";
import Sidebar from "../components/Sidebar";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${rubik.className} flex h-screen w-full min-h-0 flex-row flex-nowrap overflow-hidden bg-[#000212] text-[#ddd7ea]`}
    >
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#000212]">
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
