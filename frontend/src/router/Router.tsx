import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Inventory from "../pages/inventory/Inventory";

function StellarWorkspace() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-8">
      <Inventory />
    </main>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <StellarWorkspace /> },
  { path: "/dashboard/inventory", element: <StellarWorkspace /> },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
