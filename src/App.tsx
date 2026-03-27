// V2: Re-export from new location
import App from "./app/App";
import { AppProviders } from "./app/providers";

function WrappedApp() {
  return (
    <AppProviders>
      <App />
    </AppProviders>
  );
}

export default WrappedApp;
