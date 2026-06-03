import { capLoginErrorMessage } from '../../lib/auth/loginRedirect';

type LandingPageProps = {
  searchParams?: { error?: string };
};

export default function LandingPage({ searchParams }: LandingPageProps) {
  const errorRaw = typeof searchParams?.error === 'string' ? searchParams.error : '';
  const error = errorRaw ? capLoginErrorMessage(errorRaw) : null;

  return (
    <main className="landing-main">
      <div className="landing-badge">
        <div className="landing-badge-mark" aria-hidden="true">
          RT
        </div>
        <div>
          <div className="landing-badge-title">RagTag</div>
          <div className="landing-badge-sub">PM Operator Grid</div>
        </div>
      </div>

      <div className="landing-panel">
        <h1>
          <span className="landing-domain">idea-impact.com</span> — internal operator dashboard
        </h1>
        <p>
          RagTag coordinates specialist agents, project workspaces, and operator tools for delivery,
          capture, and planning. Access is limited to approved operator accounts.
        </p>
        {error ? <div className="landing-error">{error}</div> : null}
        <a className="landing-cta" href="/login">
          Sign in
        </a>
      </div>
    </main>
  );
}
