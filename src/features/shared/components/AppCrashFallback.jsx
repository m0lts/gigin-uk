import { ErrorIcon } from "../ui/extras/Icons";

export const AppCrashFallback = ({ onRetry }) => {

    const handleRetry = () => {
        window.location.href = '/';
    };

    return (
      <div className="crash-screen">
        <ErrorIcon />
        <h2>Oops!</h2>
        <p>The app hit a snag. We’ve logged the details for you. Please try reloading the app. If the issue persists, get in touch with us.</p>
        <button className="btn primary" onClick={onRetry}>Reload</button>
        <button className="btn tertiary" onClick={handleRetry}>Go To Home</button>
      </div>
    );
  }