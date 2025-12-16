import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ConsultorRoute } from "@/lib/consultor-route";
import { AdminRoute } from "@/lib/admin-route";
import { ManagerRoute } from "@/lib/manager-route";
import { FaturistaRoute } from "@/lib/faturista-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Vendas from "@/pages/vendas";
import Comissoes from "@/pages/comissoes";
import Clientes from "@/pages/clientes";
import Safras from "@/pages/safras";
import Produtos from "@/pages/produtos";
import Relatorios from "@/pages/relatorios";
import Parametros from "@/pages/parametros";
import Metas from "@/pages/metas";
import Mercado from "@/pages/mercado";
import HistoricoCompras from "@/pages/historico-compras";
import AdminPage from "@/pages/admin";
import ManagerPage from "@/pages/manager";
import BarterPage from "@/pages/barter";
import FaturistaPage from "@/pages/faturista";
import KanbanMetasPage from "@/pages/kanban-metas";
import GestaoPotencialPage from "@/pages/gestao-potencial";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import CRMLogin from "@/pages/crm/login";
import CRMHome from "@/pages/crm/home";
import CRMAgenda from "@/pages/crm/agenda";
import CRMClientes from "@/pages/crm/clientes";
import CRMHistorico from "@/pages/crm/historico";
import CRMPerfil from "@/pages/crm/perfil";
import CRMSettings from "@/pages/crm/settings";
import CRMFarms from "@/pages/crm/farms";
import CRMChecklists from "@/pages/crm/checklists";
import CRMReports from "@/pages/crm/reports";
import CRMAtendimento from "@/pages/crm/atendimento";
import CRMLayout from "@/components/crm/layout";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password/:token" component={ResetPassword} />
      <AdminRoute path="/admin" component={AdminPage} />
      <ManagerRoute path="/manager" component={ManagerPage} />
      <FaturistaRoute path="/faturista" component={FaturistaPage} />

      {/* CRM Routes */}
      <Route path="/crm">
        {() => {
          window.location.href = "/crm/login";
          return null;
        }}
      </Route>
      <Route path="/crm/login" component={CRMLogin} />
      <Route path="/crm/home">
        {() => <CRMLayout><CRMHome /></CRMLayout>}
      </Route>
      <Route path="/crm/agenda">
        {() => <CRMLayout><CRMAgenda /></CRMLayout>}
      </Route>
      <Route path="/crm/clientes">
        {() => <CRMLayout><CRMClientes /></CRMLayout>}
      </Route>
      <Route path="/crm/historico">
        {() => <CRMLayout><CRMHistorico /></CRMLayout>}
      </Route>
      <Route path="/crm/perfil">
        {() => <CRMLayout><CRMPerfil /></CRMLayout>}
      </Route>
      <Route path="/crm/settings">
        {() => <CRMLayout><CRMSettings /></CRMLayout>}
      </Route>
      <Route path="/crm/farms">
        {() => <CRMLayout><CRMFarms /></CRMLayout>}
      </Route>
      <Route path="/crm/checklists">
        {() => <CRMLayout><CRMChecklists /></CRMLayout>}
      </Route>
      <Route path="/crm/reports">
        {() => <CRMLayout><CRMReports /></CRMLayout>}
      </Route>
      <Route path="/crm/atendimento/:visitId" component={CRMAtendimento} />
      <ConsultorRoute path="/" component={Dashboard} />
      <ConsultorRoute path="/dashboard" component={Dashboard} />
      <ConsultorRoute path="/vendas" component={Vendas} />
      <ConsultorRoute path="/comissoes" component={Comissoes} />
      <ConsultorRoute path="/clientes" component={Clientes} />
      <ConsultorRoute path="/safras" component={Safras} />
      <ConsultorRoute path="/produtos" component={Produtos} />
      <ConsultorRoute path="/relatorios" component={Relatorios} />
      <ConsultorRoute path="/parametros" component={Parametros} />
      <ConsultorRoute path="/metas" component={Metas} />
      <ConsultorRoute path="/mercado" component={Mercado} />
      <ConsultorRoute path="/historico-compras" component={HistoricoCompras} />
      <ConsultorRoute path="/barter" component={BarterPage} />
      <ConsultorRoute path="/kanban-metas" component={KanbanMetasPage} />
      <ManagerRoute path="/gestao-potencial" component={GestaoPotencialPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
