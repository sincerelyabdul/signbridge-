import React from "react";
import { useNavigate } from "react-router-dom";
import { useSignBridge } from "../context/SignBridgeContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faSun,
  faMoon,
  faGear,
  faRightFromBracket,
  faGrip,
  faRightToBracket,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";

// ─── Variant definitions ──────────────────────────────────────────────────────

export type NavbarVariant =
  | "landing"        // public: logo + theme toggle + login/dashboard CTA
  | "dashboard"      // authenticated: logo + user info + settings + logout
  | "settings"       // back arrow + logo + page context label
  | "review"         // back arrow + logo + session title + export button
  | "auth"           // back arrow only (minimal)
  | "workspace";     // back arrow + logo + context label + right slot

export interface NavbarProps {
  variant: NavbarVariant;

  // Context label shown after the separator (e.g. "Lecturer Portal")
  contextLabel?: string;

  // Session title (used in review and workspace)
  sessionTitle?: string;

  // Right-side slot for workspace navbars (e.g. status badges, action buttons)
  rightSlot?: React.ReactNode;

  // Review page: export transcript action
  onExportTranscript?: () => void;

  // Back button destination override (defaults to sensible page-specific route)
  onBack?: () => void;

  // auth/landing variant: show "I'm a Lecturer" or "Dashboard" button
  // (auto-detected from context, but can be overridden)
  showAuthCta?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Navbar: React.FC<NavbarProps> = ({
  variant,
  contextLabel,
  sessionTitle,
  rightSlot,
  onExportTranscript,
  onBack,
  showAuthCta = true,
}) => {
  const navigate = useNavigate();
  const { user, profile, theme, toggleTheme, logout } = useSignBridge();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleBack = onBack ?? (() => navigate(-1));

  // ── Logo wordmark ──────────────────────────────────────────────────────────
  const Logo = ({ size = "md" }: { size?: "sm" | "md" }) => (
    <button
      onClick={() => navigate(user ? "/dashboard" : "/")}
      className="font-bold tracking-tight select-none cursor-pointer shrink-0 hover:opacity-80 transition-opacity"
      style={{ fontSize: size === "sm" ? "15px" : "18px" }}
    >
      sign
      <span className="text-[var(--primary)]">bridge</span>
      <span className="text-[var(--primary)] font-black">.</span>
    </button>
  );

  // ── Back button ────────────────────────────────────────────────────────────
  const BackButton = ({ label }: { label?: string }) => (
    <button
      onClick={handleBack}
      className="h-8 flex items-center gap-1.5 px-2 rounded-md hover:bg-[var(--background)] transition-colors text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer shrink-0 text-xs font-medium"
      aria-label="Go back"
    >
      <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );

  // ── Theme toggle ───────────────────────────────────────────────────────────
  const ThemeToggle = () => (
    <button
      onClick={toggleTheme}
      className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <FontAwesomeIcon icon={faSun} className="text-xs" /> : <FontAwesomeIcon icon={faMoon} className="text-xs" />}
    </button>
  );

  // ── Divider ────────────────────────────────────────────────────────────────
  const Divider = () => (
    <span className="h-4 w-px bg-[var(--border)] shrink-0 hidden sm:block" />
  );

  // ── Context label ──────────────────────────────────────────────────────────
  const ContextLabel = ({ label }: { label: string }) => (
    <span className="text-[11px] text-[var(--text-muted)] hidden sm:block truncate max-w-[200px]">
      {label}
    </span>
  );

  // ── Base wrapper ───────────────────────────────────────────────────────────
  const base = "fixed top-0 left-0 right-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-4 sm:px-6 h-12 flex items-center justify-between";

  // ─────────────────────────────────────────────────────────────────────────
  // LANDING
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === "landing") {
    return (
      <header className={base}>
        <Logo size="sm" />

        <div className="flex items-center gap-1">
          {showAuthCta && (
            <>
              {user ? (
                <button
                  onClick={() => navigate("/dashboard")}
                  className="h-8 px-3 rounded-md border border-[var(--border)] hover:bg-[var(--background)] text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <FontAwesomeIcon icon={faGrip} className="text-[13px]" />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate("/auth")}
                  className="h-8 px-3 rounded-md border border-[var(--border)] hover:bg-[var(--background)] text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <FontAwesomeIcon icon={faRightToBracket} className="text-[13px]" />
                  <span className="hidden sm:inline">Lecturer sign in</span>
                </button>
              )}
            </>
          )}
          <ThemeToggle />
        </div>
      </header>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH (minimal — just a back arrow)
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === "auth") {
    return (
      <header className={base}>
        <BackButton label="Back" />
        <Logo size="sm" />
        <ThemeToggle />
      </header>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === "dashboard") {
    return (
      <header className={base}>
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <Logo />
          <Divider />
          <span className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] text-[var(--text-muted)] rounded font-mono uppercase hidden sm:block tracking-wide">
            {contextLabel ?? "Dashboard"}
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* User info */}
          {profile?.fullName && (
            <div className="text-right hidden md:block mr-1">
              <span className="text-xs font-semibold block text-[var(--text)]">{profile.fullName}</span>
              {profile.institution && (
                <span className="text-[9px] text-[var(--text-muted)] block font-mono">{profile.institution}</span>
              )}
            </div>
          )}

          <div className="h-4 w-px bg-[var(--border)] hidden md:block" />

          <button
            onClick={() => navigate("/settings")}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            title="Settings"
          >
            <FontAwesomeIcon icon={faGear} className="text-xs" />
          </button>

          <button
            onClick={handleLogout}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors cursor-pointer"
            title="Log out"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="text-xs" />
          </button>
        </div>
      </header>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SETTINGS
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === "settings") {
    return (
      <header className={base}>
        <div className="flex items-center gap-2.5">
          <BackButton />
          <Divider />
          <Logo />
          <Divider />
          <ContextLabel label={contextLabel ?? "Settings"} />
        </div>

        <button
          onClick={handleLogout}
          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors cursor-pointer"
          title="Log out"
        >
          <FontAwesomeIcon icon={faRightFromBracket} className="text-xs" />
        </button>
      </header>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REVIEW (lecture archive)
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === "review") {
    return (
      <header className={base}>
        {/* Left */}
        <div className="flex items-center gap-2.5 min-w-0">
          <BackButton />
          <Divider />
          <Logo />
          {(sessionTitle ?? contextLabel) && (
            <>
              <Divider />
              <ContextLabel label={sessionTitle ?? contextLabel ?? ""} />
            </>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-1">
          {onExportTranscript && (
            <button
              onClick={onExportTranscript}
              className="h-8 px-2.5 rounded-md border border-[var(--border)] hover:bg-[var(--background)] text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Export transcript"
            >
              <FontAwesomeIcon icon={faDownload} className="text-[13px]" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
        </div>
      </header>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKSPACE (lecturer & student live sessions)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <header className={base}>
      {/* Left */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Logo />
        {contextLabel && (
          <>
            <Divider />
            <ContextLabel label={contextLabel} />
          </>
        )}
        {sessionTitle && (
          <>
            <Divider />
            <span className="text-[11px] text-[var(--text)] font-medium truncate max-w-[150px] sm:max-w-[280px] hidden xs:block">
              {sessionTitle}
            </span>
          </>
        )}
      </div>

      {/* Right: custom slot */}
      {rightSlot && (
        <div className="flex items-center gap-2 shrink-0">
          {rightSlot}
        </div>
      )}
    </header>
  );
};
