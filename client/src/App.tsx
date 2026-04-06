import { Switch, Route } from "wouter";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Setup from "@/pages/Setup";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Products from "@/pages/Products";
import Reports from "@/pages/Reports";
import Tasks from "@/pages/Tasks";
import SettingsPage from "@/pages/Settings";
import ClientOrders from "@/pages/ClientOrders";
import Orders from "@/pages/Orders";
import Tracking from "@/pages/Tracking";
import Scanner from "@/pages/Scanner";
import { MainLayout } from "@/components/layout/MainLayout";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";

const catalogPersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "makira_catalog_rq_v1",
});

function Router() {
  return (
    <Switch>
      <Route path="/setup" component={Setup} />
      <Route path="/login" component={Login} />
      <Route path="/pedidos" component={ClientOrders} />
      <Route path="/scanner/:token" component={Scanner} />
      
      {/* Protected Routes wrapped in MainLayout */}
      <Route path="/">
        <MainLayout><Dashboard /></MainLayout>
      </Route>
      <Route path="/pos">
        <MainLayout><POS /></MainLayout>
      </Route>
      <Route path="/products">
        <MainLayout><Products /></MainLayout>
      </Route>
      <Route path="/reports">
        <MainLayout><Reports /></MainLayout>
      </Route>
      <Route path="/tasks">
        <MainLayout><Tasks /></MainLayout>
      </Route>
      <Route path="/settings">
        <MainLayout><SettingsPage /></MainLayout>
      </Route>
      <Route path="/orders">
        <MainLayout><Orders /></MainLayout>
      </Route>
      <Route path="/tracking">
        <MainLayout><Tracking /></MainLayout>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: catalogPersister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => {
            const k = q.queryKey[0];
            return k === "/api/products" || k === "/api/categories";
          },
        },
      }}
    >
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
