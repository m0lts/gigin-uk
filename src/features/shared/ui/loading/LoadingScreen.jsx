import '@styles/shared/loading.styles.css';

export function AccountLoadError({ onRetry }) {
  return (
    <div className="account-load-error">
      <div className="account-load-error__card" role="alert">
        <p>We couldn&apos;t load your account</p>
        <button type="button" onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}

export const LoadingScreen = ({ text = null }) => {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-skeleton" aria-hidden="true">
        <div className="loading-skeleton__bar" />
        <div className="loading-skeleton__card">
          <div className="loading-skeleton__line is-title" />
          <div className="loading-skeleton__line" />
          <div className="loading-skeleton__line is-short" />
        </div>
      </div>
      {text ? <p className="loading-screen__text">{text}</p> : <span className="visually-hidden">Loading</span>}
    </div>
  );
};
