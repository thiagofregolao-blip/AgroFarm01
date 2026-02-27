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
import { AdminFarmerRoute } from "@/lib/admin-farmer-route";
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
import AdminFarmersPage from "@/pages/admin-farmers";
import AdminProductsPage from "@/pages/admin-products";
import ManagerPage from "@/pages/manager";
import BarterPage from "@/pages/barter";
import FaturistaPage from "@/pages/faturista";
import KanbanMetasPage from "@/pages/kanban-metas";
import GestaoPotencialPage from "@/pages/gestao-potencial";
import PlanejamentoPage from "@/pages/planejamento";
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

// Farm Stock Management
import FarmDashboard from "@/pages/fazenda/dashboard";
import FarmProperties from "@/pages/fazenda/properties";
import FarmProducts from "@/pages/fazenda/products";
import FarmInvoices from "@/pages/fazenda/invoices";
import FarmStock from "@/pages/fazenda/stock";
import FarmApplications from "@/pages/fazenda/applications";
import FarmExpenses from "@/pages/fazenda/expenses";
import FarmTerminals from "@/pages/fazenda/terminals";
import FarmPlotCosts from "@/pages/fazenda/plot-costs";
import FarmSeasons from "@/pages/fazenda/seasons";
import FarmProfile from "@/pages/fazenda/profile";
import FarmEquipment from "@/pages/fazenda/equipment";
import FarmLogin from "@/pages/fazenda/login";
import FarmReports from "@/pages/fazenda/reports";
import LandingPage from "@/pages/landing";
import FieldNotebook from "@/pages/fazenda/field-notebook";
import QuotationNetwork from "@/pages/fazenda/quotation-network";

// PDV (Point of Sale)
import PdvLogin from "@/pages/pdv/login";
import PdvTerminal from "@/pages/pdv/terminal";

function Router() {
  return (
    <Switch>
      <Route path="/landing" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password/:token" component={ResetPassword} />
      <AdminRoute path="/admin" component={AdminPage} />
      <AdminRoute path="/admin-products" component={AdminProductsPage} />
      <AdminFarmerRoute path="/admin-farmers" component={AdminFarmersPage} />
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

      {/* Farm Stock Management Routes */}
      <Route path="/fazenda/login" component={FarmLogin} />
      <Route path="/fazenda" component={FarmDashboard} />
      <Route path="/fazenda/propriedades" component={FarmProperties} />
      <Route path="/fazenda/produtos" component={FarmProducts} />
      <Route path="/fazenda/faturas" component={FarmInvoices} />
      <Route path="/fazenda/estoque" component={FarmStock} />
      <Route path="/fazenda/equipamentos" component={FarmEquipment} />
      <Route path="/fazenda/aplicacoes" component={FarmApplications} />
      <Route path="/fazenda/despesas" component={FarmExpenses} />
      <Route path="/fazenda/custos" component={FarmPlotCosts} />
      <Route path="/fazenda/terminais" component={FarmTerminals} />
      <Route path="/fazenda/safras" component={FarmSeasons} />
      <Route path="/fazenda/relatorios" component={FarmReports} />
      <Route path="/fazenda/caderno-campo" component={FieldNotebook} />
      <Route path="/fazenda/cotacoes" component={QuotationNetwork} />
      <Route path="/fazenda/perfil" component={FarmProfile} />

      {/* PDV Routes (Tablet) */}
      <Route path="/pdv/login" component={PdvLogin} />
      <Route path="/pdv" component={PdvTerminal} />

      <ConsultorRoute path="/" component={Dashboard} />
      <ConsultorRoute path="/dashboard" component={Dashboard} />
      <ConsultorRoute path="/vendas" component={Vendas} />
      <ConsultorRoute path="/comissoes" component={Comissoes} />
      <ConsultorRoute path="/clientes" component={Clientes} />
      <ConsultorRoute path="/safras" component={Safras} />
      <ConsultorRoute path="/produtos" component={Produtos} />
      <ConsultorRoute path="/relatorios" component={Relatorios} />
      <ConsultorRoute path="/planejamento" component={PlanejamentoPage} />
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
