// V2: Re-export from new location
import App from "./app/App";
import { AppProviders } from "./app/providers";
import { ErrorBoundary } from "./components/ErrorBoundary";

function WrappedApp() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  );
}

export default WrappedApp;
