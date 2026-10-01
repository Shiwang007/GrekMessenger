import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SocketProvider } from "./socket/SocketProvider.jsx";
import { PresenceProvider } from "./context/PresenceContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <SocketProvider>
        <PresenceProvider>
          <App />
        </PresenceProvider>
      </SocketProvider>
    </AuthProvider>
  </StrictMode>
);
