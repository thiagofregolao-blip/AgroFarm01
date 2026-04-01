const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

const APP_URL = "https://www.agrofarmdigital.com";

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: "AgroFarm Digital",
        icon: path.join(__dirname, "assets", "icon.png"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        backgroundColor: "#1a56db",
        show: false,
    });

    // Splash: mostra janela só quando carregou
    win.once("ready-to-show", () => {
        win.show();
    });

    // Links externos abrem no browser do sistema
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (!url.startsWith(APP_URL)) {
            shell.openExternal(url);
            return { action: "deny" };
        }
        return { action: "allow" };
    });

    win.loadURL(APP_URL);

    // Remove menu bar (deixa mais limpo)
    win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
