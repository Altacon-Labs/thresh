import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Inventory from "../pages/inventory/Inventory";

function RouteError() {
  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <section className="workspace-card space-y-3 p-5">
        <h1 className="text-xl font-semibold">Thresh couldn’t open this page</h1>
        <p className="text-sm text-slate-600">Reload to try again, or return to Markets.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="workspace-button" onClick={() => window.location.reload()}>Reload page</button>
          <a className="workspace-button secondary inline-flex items-center" href="/">Back to Markets</a>
        </div>
      </section>
    </main>
  );
}

const router = createBrowserRouter([
  {
    path: "/", element: <Inventory />, errorElement: <RouteError />,
    children: [
      { index: true, element: null },
      { path: "real-world-assets", element: null },
      { path: "real-world-assets/:assetId", element: null },
      { path: "dashboard/inventory", element: null },
    ],
  },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
