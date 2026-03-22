import "express-session";

declare module "express-session" {
  interface SessionData {
    pdvTerminalId?: string;
    pdvFarmerId?: string;
    pdvPropertyId?: string;
    pdvToken?: string;
  }
}
