import AfriTradeApp from "../banking/AfriTradeApp";
import { navigateToApp } from "../platform/AppSwitcher";

export const AfriTradeModuleApp = () => {
  const routeToModule = (target) => {
    navigateToApp(target);
  };

  return (
    <AfriTradeApp
      initialScreen="main"
      onOpenWasiTerminal={() => routeToModule("wasi")}
      onOpenDex={() => routeToModule("dex")}
      onOpenAfriTax={() => routeToModule("afritax")}
      onOpenOhadaCompta={() => routeToModule("compta")}
      onExitAfriTrade={() => routeToModule("banking")}
    />
  );
};
