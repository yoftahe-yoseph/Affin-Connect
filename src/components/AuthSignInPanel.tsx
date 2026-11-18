import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Inbox,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MailCheck,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Store,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  HAWASSA_NEIGHBORHOODS,
  normalizePhoneToE164,
} from '../utils/marketplaceLogic';

type AuthTab = 'signin' | 'register' | 'phone';

interface AuthSignInPanelProps {
  variant?: 'glass' | 'onboarding' | 'card' | 'compact';
  onSuccess?: () => void;
  defaultTab?: AuthTab;
}

const GoogleGIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const AuthSignInPanel: React.FC<AuthSignInPanelProps> = ({
  variant = 'card',
  onSuccess,
  defaultTab = 'signin',
}) => {
  const {
    firebaseUser,
    userProfile,
    needsEmailVerification,
    emailVerificationCooldown,
    emailVerificationNotice,
    clearEmailVerificationNotice,
    resendVerificationEmail,
    checkEmailVerificationStatus,
    welcomeBackNotice,
    clearWelcomeBackNotice,
    signOutUser,
    continueAsGuest,
    signInWithGoogle,
    signInWithEmailPassword,
    resetPasswordByEmail,
    registerWithEmailPassword,
    phoneOtpState,
    sendPhoneOtp,
    verifyPhoneOtp,
    resetPhoneOtp,
    selectedNeighborhood,
    language,
    authError,
    clearAuthError,
    t,
  } = useMarketplace();

  const [activeTab, setActiveTab] = useState<AuthTab>(
    phoneOtpState.step === 'code_sent' || phoneOtpState.step === 'verifying'
      ? 'phone'
      : defaultTab
  );

  // Email Verification Card State
  const [checkingVerify, setCheckingVerify] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);
  const [verifyPromptMsg, setVerifyPromptMsg] = useState<string | null>(null);

  // Sign In Tab State
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [signInBusy, setSignInBusy] = useState(false);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Forgot Password State
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmailInput, setResetEmailInput] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Register Tab State
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regNeighborhood, setRegNeighborhood] = useState<string>(
    selectedNeighborhood !== 'All Hawassa' ? selectedNeighborhood : HAWASSA_NEIGHBORHOODS[0]
  );
  const [accountType, setAccountType] = useState<'customer' | 'seller'>('customer');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regBusy, setRegBusy] = useState(false);

  // Phone OTP Tab State
  const [displayName, setDisplayName] = useState(phoneOtpState.pendingDisplayName || '');
  const [phoneInput, setPhoneInput] = useState(phoneOtpState.formattedPhone || '');
  const [otpInput, setOtpInput] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const isCodeSent =
    phoneOtpState.step === 'code_sent' || phoneOtpState.step === 'verifying';
  const isSending = phoneOtpState.step === 'sending';
  const isVerifying = phoneOtpState.step === 'verifying';
  const isCompact = variant === 'compact';
  const isGlass = variant === 'glass' || variant === 'onboarding';

  const normalizedPhonePreview = normalizePhoneToE164(phoneInput);
  const normalizedRegPhonePreview = normalizePhoneToE164(regPhone);

  useEffect(() => {
    if (selectedNeighborhood !== 'All Hawassa') {
      setRegNeighborhood(selectedNeighborhood);
    }
  }, [selectedNeighborhood]);

  useEffect(() => {
    if (phoneOtpState.step === 'code_sent' || phoneOtpState.step === 'verifying') {
      setActiveTab('phone');
    }
    if (phoneOtpState.step === 'code_sent' && resendCooldown === 0) {
      setResendCooldown(30);
    }
  }, [phoneOtpState.step]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const switchTab = (next: AuthTab) => {
    setActiveTab(next);
    setForgotPasswordMode(false);
    setResetSuccessMsg(null);
    setAuthSuccessMsg(null);
    clearAuthError();
  };

  const handleOpenForgotPassword = () => {
    clearAuthError();
    setAuthSuccessMsg(null);
    setResetSuccessMsg(null);
    if (emailOrPhone.includes('@')) {
      setResetEmailInput(emailOrPhone.trim());
    }
    setForgotPasswordMode(true);
  };

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetSuccessMsg(null);
    setResetBusy(true);
    try {
      const targetEmail = resetEmailInput.trim().toLowerCase();
      const res = await resetPasswordByEmail(targetEmail);
      if (res.ok) {
        setResetSuccessMsg(t('authResetLinkSent', { email: targetEmail }));
      }
    } finally {
      setResetBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthSuccessMsg(null);
    setGoogleBusy(true);
    try {
      const ok = await signInWithGoogle();
      if (ok) {
        setAuthSuccessMsg(t('authSignInSuccess'));
        onSuccess?.();
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthSuccessMsg(null);
    setSignInBusy(true);
    try {
      const res = await signInWithEmailPassword({
        emailOrPhone,
        password: signInPassword,
        rememberMe,
      });
      if (res.switchToPhoneOtp) {
        setPhoneInput(res.switchToPhoneOtp);
        setActiveTab('phone');
        return;
      }
      if (res.ok) {
        setAuthSuccessMsg(t('authSignInSuccess'));
        onSuccess?.();
      }
    } finally {
      setSignInBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthSuccessMsg(null);
    setRegBusy(true);
    try {
      const res = await registerWithEmailPassword({
        fullName,
        email: regEmail,
        phoneNumber: regPhone,
        neighborhood: regNeighborhood,
        accountType,
        password: regPassword,
      });
      if (res.ok) {
        setAuthSuccessMsg(t('authSignInSuccess'));
        onSuccess?.();
      }
    } finally {
      setRegBusy(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthSuccessMsg(null);
    const res = await sendPhoneOtp(phoneInput, displayName);
    if (res.ok) {
      setOtpInput('');
      setResendCooldown(30);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthSuccessMsg(null);
    const res = await verifyPhoneOtp(otpInput, displayName);
    if (res.ok) {
      setOtpInput('');
      setAuthSuccessMsg(t('authSignInSuccess'));
      onSuccess?.();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isSending) return;
    const targetPhone = phoneOtpState.formattedPhone || phoneInput;
    const res = await sendPhoneOtp(targetPhone, displayName);
    if (res.ok) {
      setOtpInput('');
      setResendCooldown(30);
    }
  };

  const handleShortcutToPhoneOtp = () => {
    const trimmed = emailOrPhone.trim();
    if (trimmed && !trimmed.includes('@')) {
      setPhoneInput(trimmed);
    }
    switchTab('phone');
  };

  const handleCheckEmailVerified = async () => {
    setVerifyPromptMsg(null);
    clearAuthError();
    setCheckingVerify(true);
    try {
      const res = await checkEmailVerificationStatus();
      if (res.verified) {
        onSuccess?.();
      } else {
        setVerifyPromptMsg(res.error ?? t('emailVerifyNotYetPrompt'));
      }
    } finally {
      setCheckingVerify(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (resendingVerify || emailVerificationCooldown > 0) return;
    setVerifyPromptMsg(null);
    clearEmailVerificationNotice();
    clearAuthError();
    setResendingVerify(true);
    try {
      await resendVerificationEmail();
    } finally {
      setResendingVerify(false);
    }
  };

  const handleChangeEmailOrSignOut = async () => {
    setVerifyPromptMsg(null);
    clearAuthError();
    clearEmailVerificationNotice();
    await signOutUser();
  };

  // Shared style tokens based on variant (glass obsidian vs embedded card)
  const labelClass = isGlass
    ? 'block text-xs font-semibold text-[#CBE3E4] mb-1.5'
    : 'block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1';

  const iconClass = isGlass
    ? 'w-4 h-4 text-[#00C8D7]/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none'
    : 'w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none';

  const inputBaseClass = isGlass
    ? 'w-full min-h-[46px] rounded-xl border border-[#123E42] bg-[#021113]/75 text-sm font-medium text-[#F5FAFA] placeholder:text-[#6B9396] focus:outline-none focus:border-[#00C8D7] focus:ring-4 focus:ring-[#00C8D7]/15 transition-all duration-200'
    : 'w-full min-h-[44px] rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs font-medium text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981] transition-colors';

  const primaryGradientBtnClass = isGlass
    ? 'w-full min-h-[48px] px-4 rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C8D7] hover:brightness-105 active:scale-[0.99] disabled:opacity-70 text-[#031719] text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#00D68F]/20 transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C8D7]'
    : 'w-full min-h-[46px] px-4 rounded-xl bg-gradient-to-r from-[#047857] via-[#059669] to-[#0D9488] hover:from-[#065F46] hover:to-[#047857] disabled:opacity-85 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-emerald-900/15 transition-all duration-200 cursor-pointer';

  const errorBannerClass = isGlass
    ? 'p-3 rounded-xl bg-rose-500/12 border border-rose-400/35 text-xs text-rose-200 flex items-start gap-2.5 leading-relaxed'
    : 'p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 text-[11px] text-rose-800 dark:text-rose-200 flex items-start gap-2 leading-relaxed';

  const successBannerClass = isGlass
    ? 'p-3 rounded-xl bg-[#00D68F]/12 border border-[#00D68F]/35 text-xs text-[#9EF5D7] flex items-start gap-2.5 leading-relaxed font-medium'
    : 'p-2.5 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#047857]/25 dark:border-[#10B981]/35 text-[11px] text-[#065F46] dark:text-[#6EE7B7] flex items-start gap-2 leading-relaxed font-medium';

  if (firebaseUser && needsEmailVerification) {
    const resolvedDisplayName =
      userProfile?.displayName?.trim() ||
      firebaseUser.displayName?.trim() ||
      'Hawassa Shopper';

    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center space-y-2.5 pt-1">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${
              isGlass
                ? 'bg-gradient-to-br from-[#00D68F] to-[#00C8D7] text-[#031719] ring-4 ring-[#00C8D7]/20 shadow-[#00D68F]/20'
                : 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] ring-4 ring-[#047857]/10'
            }`}
          >
            <MailCheck className="w-7 h-7" />
          </div>

          <span
            className={`text-xs font-semibold tracking-wide ${
              isGlass ? 'text-[#00D68F]' : 'text-[#047857] dark:text-[#10B981]'
            }`}
          >
            {t('emailVerifySubtitle')}
          </span>

          <div className="space-y-1.5">
            <h2
              className={`text-lg font-display font-bold ${
                isGlass ? 'text-[#F5FAFA]' : 'text-stone-900 dark:text-stone-100'
              }`}
            >
              {t('emailVerifyWelcomeTitle')}
            </h2>
            <p
              className={`text-xs leading-relaxed max-w-[340px] mx-auto ${
                isGlass ? 'text-[#A7C4C5]' : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              {t('emailVerifyGreeting', {
                name: resolvedDisplayName,
                email: firebaseUser.email || '',
              })}
            </p>
          </div>
        </div>

        {emailVerificationNotice && (
          <div role="status" className={successBannerClass}>
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#00D68F]" />
            <span>{emailVerificationNotice}</span>
          </div>
        )}

        {verifyPromptMsg && (
          <div
            role="status"
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 leading-relaxed font-medium ${
              isGlass
                ? 'bg-[#F59E0B]/12 border-[#F59E0B]/35 text-[#FDE68A]'
                : 'bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border-[#FDE68A] dark:border-[#F59E0B]/30 text-[#9A3412] dark:text-[#FCD34D]'
            }`}
          >
            <Inbox className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{verifyPromptMsg}</span>
          </div>
        )}

        {authError && (
          <div role="alert" className={errorBannerClass}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={checkingVerify}
            onClick={handleCheckEmailVerified}
            className={primaryGradientBtnClass}
          >
            {checkingVerify ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('emailVerifyCheckingBtn')}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>{t('emailVerifyContinueBtn')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={resendingVerify || emailVerificationCooldown > 0}
            onClick={handleResendVerificationEmail}
            className={`w-full min-h-[44px] px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer ${
              isGlass
                ? 'bg-[#03191B] border-[#123E42] hover:border-[#00C8D7]/45 text-[#E8F6F6]'
                : 'bg-white dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] hover:border-[#047857] text-stone-800 dark:text-stone-100'
            }`}
          >
            {resendingVerify ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>
              {emailVerificationCooldown > 0
                ? t('emailVerifyResendCooldown', { seconds: emailVerificationCooldown })
                : t('emailVerifyResendBtn')}
            </span>
          </button>
        </div>

        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleChangeEmailOrSignOut}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold py-1 transition-colors cursor-pointer ${
              isGlass
                ? 'text-[#A7C4C5] hover:text-white'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('emailVerifyChangeEmailBtn')}</span>
          </button>

          <button
            type="button"
            onClick={continueAsGuest}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold hover:underline py-1 cursor-pointer ${
              isGlass ? 'text-[#00C8D7]' : 'text-[#047857] dark:text-[#10B981]'
            }`}
          >
            <span>{t('browseAsGuest')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Interactive 3-Tab Segmented Switcher */}
      <div
        role="tablist"
        aria-label="Authentication methods"
        className={`grid grid-cols-3 gap-1 p-1 rounded-2xl border ${
          isGlass
            ? 'bg-[#021113]/85 border-[#123E42]'
            : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630]'
        }`}
      >
        {(
          [
            { id: 'signin', label: t('authTabSignIn'), Icon: LogIn },
            { id: 'register', label: t('authTabRegister'), Icon: UserPlus },
            { id: 'phone', label: t('authTabPhoneOtp'), Icon: Phone },
          ] as const
        ).map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => switchTab(id)}
              className={`min-h-[42px] px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-200 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#00C8D7] ${
                isGlass
                  ? isActive
                    ? 'bg-gradient-to-r from-[#00D68F]/22 to-[#00C8D7]/22 border border-[#00C8D7]/40 text-[#F5FAFA] shadow-sm font-semibold'
                    : 'text-[#89AFB2] hover:text-[#DCEFEF] font-medium'
                  : isActive
                  ? 'bg-white dark:bg-[#1C2420] text-[#047857] dark:text-[#10B981] shadow-xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 font-medium'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback Alerts */}
      {authError && (
        <div role="alert" className={errorBannerClass}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{authError}</span>
        </div>
      )}

      {authSuccessMsg && !authError && (
        <div role="status" className={successBannerClass}>
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{authSuccessMsg}</span>
        </div>
      )}

      {/* TAB 1: STANDARD SIGN IN OR FORGOT PASSWORD */}
      {activeTab === 'signin' &&
        (forgotPasswordMode ? (
          <form onSubmit={handleSendPasswordReset} className="space-y-3.5" noValidate>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <KeyRound
                  className={`w-4 h-4 ${
                    isGlass ? 'text-[#00C8D7]' : 'text-[#047857] dark:text-[#10B981]'
                  }`}
                />
                <h2
                  className={`text-sm font-display font-bold ${
                    isGlass ? 'text-[#F5FAFA]' : 'text-stone-900 dark:text-stone-100'
                  }`}
                >
                  {t('authForgotPasswordTitle')}
                </h2>
              </div>
              <p
                className={`text-xs leading-relaxed ${
                  isGlass ? 'text-[#9AC2C4]' : 'text-stone-500 dark:text-stone-400'
                }`}
              >
                {t('authForgotPasswordDesc')}
              </p>
            </div>

            {resetSuccessMsg && (
              <div role="status" className={successBannerClass}>
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resetSuccessMsg}</span>
              </div>
            )}

            <div>
              <label htmlFor={`reset-email-${variant}`} className={labelClass}>
                {t('authEmailLabel')}
              </label>
              <div className="relative">
                <Mail className={iconClass} />
                <input
                  id={`reset-email-${variant}`}
                  type="email"
                  autoComplete="email"
                  value={resetEmailInput}
                  onChange={(e) => setResetEmailInput(e.target.value)}
                  placeholder={t('authEmailPlaceholder')}
                  className={`${inputBaseClass} pl-10 pr-3`}
                />
              </div>
            </div>

            <button type="submit" disabled={resetBusy} className={primaryGradientBtnClass}>
              {resetBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('authSendingResetLink')}</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>{t('authSendResetLinkBtn')}</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  clearAuthError();
                  setResetSuccessMsg(null);
                  setForgotPasswordMode(false);
                }}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold py-1.5 cursor-pointer transition-colors ${
                  isGlass
                    ? 'text-[#00C8D7] hover:text-[#66E5F0]'
                    : 'text-[#047857] dark:text-[#10B981] hover:underline'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('authBackToSignIn')}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleEmailSignIn} className="space-y-3.5" noValidate>
            <div>
              <label htmlFor={`signin-id-${variant}`} className={labelClass}>
                {t('authEmailOrPhoneLabel')}
              </label>
              <div className="relative">
                <Mail className={iconClass} />
                <input
                  id={`signin-id-${variant}`}
                  type="text"
                  autoComplete="username"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder={t('authEmailOrPhonePlaceholder')}
                  className={`${inputBaseClass} ${isGlass ? 'pl-10' : 'pl-9'} pr-3`}
                />
              </div>
            </div>

            <div>
              <label htmlFor={`signin-password-${variant}`} className={labelClass}>
                {t('authPasswordLabel')}
              </label>
              <div className="relative">
                <Lock className={iconClass} />
                <input
                  id={`signin-password-${variant}`}
                  type={showSignInPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder={t('authPasswordPlaceholder')}
                  className={`${inputBaseClass} ${isGlass ? 'pl-10' : 'pl-9'} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowSignInPassword((v) => !v)}
                  aria-label={
                    showSignInPassword ? t('authHidePassword') : t('authShowPassword')
                  }
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors cursor-pointer ${
                    isGlass
                      ? 'text-[#7DA4A7] hover:text-[#00C8D7]'
                      : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                  }`}
                >
                  {showSignInPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me (Firebase Persistence) & Forgot Password */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none group">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={rememberMe}
                  onClick={() => setRememberMe((v) => !v)}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                    isGlass
                      ? rememberMe
                        ? 'bg-[#00D68F] border-[#00D68F] text-[#031719]'
                        : 'bg-[#021113]/80 border-[#1A5156] group-hover:border-[#00C8D7]'
                      : rememberMe
                      ? 'bg-[#047857] dark:bg-[#10B981] border-[#047857] dark:border-[#10B981] text-white dark:text-[#0B1410]'
                      : 'bg-white dark:bg-[#141A17] border-stone-300 dark:border-stone-600'
                  }`}
                >
                  {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
                <span
                  onClick={() => setRememberMe((v) => !v)}
                  className={`text-xs font-medium ${
                    isGlass ? 'text-[#A7C4C5]' : 'text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {t('authRememberMe')}
                </span>
              </label>

              <button
                type="button"
                onClick={handleOpenForgotPassword}
                className={`text-xs font-semibold transition-colors cursor-pointer py-1 ${
                  isGlass
                    ? 'text-[#00C8D7] hover:text-[#6EEAF3]'
                    : 'text-[#047857] dark:text-[#10B981] hover:underline'
                }`}
              >
                {t('authForgotPassword')}
              </button>
            </div>

            <button type="submit" disabled={signInBusy} className={primaryGradientBtnClass}>
              {signInBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('authSigningIn')}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{t('authSignInBtn')}</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={handleShortcutToPhoneOtp}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors py-1 cursor-pointer ${
                  isGlass
                    ? 'text-[#00D68F] hover:text-[#5FF2BE]'
                    : 'text-[#047857] dark:text-[#10B981] hover:underline'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{t('authUsePhoneOtpShortcut')}</span>
              </button>
            </div>
          </form>
        ))}

      {/* TAB 2: CREATE ACCOUNT (REGISTER) */}
      {activeTab === 'register' && (
        <form onSubmit={handleRegister} className="space-y-3" noValidate>
          <div>
            <label htmlFor={`reg-name-${variant}`} className={labelClass}>
              {t('authFullNameLabel')}
            </label>
            <div className="relative">
              <User className={iconClass} />
              <input
                id={`reg-name-${variant}`}
                type="text"
                autoComplete="name"
                maxLength={100}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('authFullNamePlaceholder')}
                className={`${inputBaseClass} ${isGlass ? 'pl-10' : 'pl-9'} pr-3`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label htmlFor={`reg-email-${variant}`} className={labelClass}>
                {t('authEmailLabel')}
              </label>
              <div className="relative">
                <Mail className={iconClass} />
                <input
                  id={`reg-email-${variant}`}
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder={t('authEmailPlaceholder')}
                  className={`${inputBaseClass} ${isGlass ? 'pl-10' : 'pl-9'} pr-3`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <label
                  htmlFor={`reg-phone-${variant}`}
                  className={`truncate ${
                    isGlass
                      ? 'text-xs font-semibold text-[#CBE3E4]'
                      : 'text-[11px] font-semibold text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {t('phoneAuthNumberLabel')}
                </label>
                {normalizedRegPhonePreview.valid && (
                  <span
                    className={`text-[10px] font-mono font-semibold tabular-nums shrink-0 ${
                      isGlass ? 'text-[#00D68F]' : 'text-[#047857] dark:text-[#10B981]'
                    }`}
                  >
                    {normalizedRegPhonePreview.e164}
                  </span>
                )}
              </div>
              <div className="relative">
                <Phone className={iconClass} />
                <input
                  id={`reg-phone-${variant}`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="0911 234 567"
                  className={`${inputBaseClass} ${isGlass ? 'pl-10' : 'pl-9'} pr-3 tabular-nums`}
                />
              </div>
            </div>
          </div>

          {/* Hawassa Neighborhood Selector */}
          <div>
            <label htmlFor={`reg-neighborhood-${variant}`} className={labelClass}>
              {t('selectNeighborhood')}
            </label>
            <div className="relative">
              <MapPin
                className={
                  isGlass
                    ? 'w-4 h-4 text-[#00D68F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none'
                    : 'w-3.5 h-3.5 text-[#047857] dark:text-[#10B981] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none'
                }
              />
              <select
                id={`reg-neighborhood-${variant}`}
                value={regNeighborhood}
                onChange={(e) => setRegNeighborhood(e.target.value)}
                className={`${inputBaseClass} ${isGlass ? 'pl-10' : 'pl-9'} pr-3`}
              >
                {HAWASSA_NEIGHBORHOODS.map((n) => (
                  <option
                    key={n}
                    value={n}
                    className={isGlass ? 'bg-[#052023] text-[#F5FAFA]' : undefined}
                  >
                    {getLocalizedNeighborhood(n, language)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Account Type: Customer vs Merchant / Seller */}
          <div>
            <div className={labelClass}>{t('authAccountTypeLabel')}</div>
            <div
              role="radiogroup"
              aria-label={t('authAccountTypeLabel')}
              className="grid grid-cols-2 gap-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={accountType === 'customer'}
                onClick={() => setAccountType('customer')}
                className={`p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                  isGlass
                    ? accountType === 'customer'
                      ? 'border-[#00D68F] bg-[#00D68F]/14 text-[#F5FAFA] shadow-sm shadow-[#00D68F]/10'
                      : 'border-[#123E42] bg-[#021113]/75 text-[#B4CFD1] hover:border-[#00C8D7]/45'
                    : accountType === 'customer'
                    ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981]'
                    : 'border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-stone-700 dark:text-stone-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('authAccountTypeCustomer')}</span>
                </div>
                <div className="text-[11px] opacity-80 mt-0.5 leading-snug line-clamp-2">
                  {t('authAccountTypeCustomerHint')}
                </div>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={accountType === 'seller'}
                onClick={() => setAccountType('seller')}
                className={`p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                  isGlass
                    ? accountType === 'seller'
                      ? 'border-[#00C8D7] bg-[#00C8D7]/14 text-[#F5FAFA] shadow-sm shadow-[#00C8D7]/10'
                      : 'border-[#123E42] bg-[#021113]/75 text-[#B4CFD1] hover:border-[#00C8D7]/45'
                    : accountType === 'seller'
                    ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981]'
                    : 'border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-stone-700 dark:text-stone-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Store className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('authAccountTypeSeller')}</span>
                </div>
                <div className="text-[11px] opacity-80 mt-0.5 leading-snug line-clamp-2">
                  {t('authAccountTypeSellerHint')}
                </div>
              </button>
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor={`reg-password-${variant}`} className={labelClass}>
              {t('authPasswordLabel')}
            </label>
            <div className="relative">
              <Lock className={iconClass} />
              <input
                id={`reg-password-${variant}`}
                type={showRegPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder={t('authPasswordPlaceholder')}
                className={`${inputBaseClass} ${isGlass ? 'pl-10' : 'pl-9'} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowRegPassword((v) => !v)}
                aria-label={showRegPassword ? t('authHidePassword') : t('authShowPassword')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors cursor-pointer ${
                  isGlass
                    ? 'text-[#7DA4A7] hover:text-[#00C8D7]'
                    : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                }`}
              >
                {showRegPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p
              className={`text-[11px] mt-1 ${
                isGlass ? 'text-[#7CA3A6]' : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {t('authPasswordRegisterHint')}
            </p>
          </div>

          <button type="submit" disabled={regBusy} className={primaryGradientBtnClass}>
            {regBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('authCreatingAccount')}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{t('authCreateAccountBtn')}</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* TAB 3: PHONE OTP */}
      {activeTab === 'phone' &&
        (isCodeSent ? (
          <form onSubmit={handleVerifyOtp} className="space-y-3.5">
            <div className={`${successBannerClass} items-center justify-between`}>
              <div className="min-w-0 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {t('phoneAuthOtpSentTo', { phone: phoneOtpState.formattedPhone })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetPhoneOtp();
                  setOtpInput('');
                  setResendCooldown(0);
                }}
                className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline shrink-0 cursor-pointer ${
                  isGlass ? 'text-[#00C8D7]' : 'text-[#047857] dark:text-[#10B981]'
                }`}
              >
                <ArrowLeft className="w-3 h-3" />
                <span>{t('phoneAuthChangeNumber')}</span>
              </button>
            </div>

            <div>
              <label htmlFor={`otp-code-${variant}`} className={labelClass}>
                {t('phoneAuthOtpLabel')}
              </label>
              <input
                id={`otp-code-${variant}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('phoneAuthOtpPlaceholder')}
                className={`${inputBaseClass} text-center text-base font-mono font-bold tracking-[0.35em] px-3`}
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || otpInput.length !== 6}
              className={primaryGradientBtnClass}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('phoneAuthVerifying')}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('phoneAuthVerifyBtn')}</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center pt-0.5">
              <button
                type="button"
                disabled={resendCooldown > 0 || isSending}
                onClick={handleResend}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50 cursor-pointer ${
                  isGlass
                    ? 'text-[#A7C4C5] hover:text-[#00C8D7]'
                    : 'text-stone-600 dark:text-stone-300 hover:text-[#047857] dark:hover:text-[#10B981]'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {resendCooldown > 0
                    ? t('phoneAuthResendIn', { seconds: resendCooldown })
                    : t('phoneAuthResendBtn')}
                </span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSendOtp} className="space-y-3.5">
            {!isCompact && (
              <div>
                <label htmlFor={`phone-name-${variant}`} className={labelClass}>
                  {t('phoneAuthNameLabel')}
                </label>
                <div className="relative">
                  <User className={iconClass} />
                  <input
                    id={`phone-name-${variant}`}
                    type="text"
                    maxLength={100}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('phoneAuthNamePlaceholder')}
                    className={`${inputBaseClass} ${isGlass ? 'pl-10' : 'pl-9'} pr-3`}
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label
                  htmlFor={`phone-number-${variant}`}
                  className={
                    isGlass
                      ? 'text-xs font-semibold text-[#CBE3E4]'
                      : 'text-[11px] font-semibold text-stone-600 dark:text-stone-300'
                  }
                >
                  {t('phoneAuthNumberLabel')}
                </label>
                {normalizedPhonePreview.valid && (
                  <span
                    className={`text-[11px] font-mono font-semibold tabular-nums ${
                      isGlass ? 'text-[#00D68F]' : 'text-[#047857] dark:text-[#10B981]'
                    }`}
                  >
                    {normalizedPhonePreview.e164}
                  </span>
                )}
              </div>
              <div className="relative">
                <Phone className={iconClass} />
                <input
                  id={`phone-number-${variant}`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder={t('phoneAuthNumberPlaceholder')}
                  className={`${inputBaseClass} ${isGlass ? 'pl-10' : 'pl-9'} pr-3 tabular-nums`}
                />
              </div>
              {!isCompact && (
                <p
                  className={`text-[11px] mt-1.5 leading-relaxed ${
                    isGlass ? 'text-[#7CA3A6]' : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  {t('phoneAuthHint')}
                </p>
              )}
            </div>

            <button type="submit" disabled={isSending} className={primaryGradientBtnClass}>
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('phoneAuthSendingOtp')}</span>
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  <span>{t('phoneAuthSendOtpBtn')}</span>
                </>
              )}
            </button>
          </form>
        ))}

      {/* Alternative Authentication: Configured Google Provider Only */}
      {!(activeTab === 'phone' && isCodeSent) && !forgotPasswordMode && (
        <div className="space-y-3 pt-1">
          <div
            className={`flex items-center gap-2.5 text-[11px] font-medium ${
              isGlass ? 'text-[#7DA4A7]' : 'text-stone-400 dark:text-stone-500'
            }`}
          >
            <span
              className={`flex-1 h-px ${
                isGlass ? 'bg-[#123E42]' : 'bg-[#E7E5E4] dark:bg-[#2A3630]'
              }`}
            />
            <span>{t('authOrDivider')}</span>
            <span
              className={`flex-1 h-px ${
                isGlass ? 'bg-[#123E42]' : 'bg-[#E7E5E4] dark:bg-[#2A3630]'
              }`}
            />
          </div>

          <button
            type="button"
            disabled={googleBusy}
            onClick={handleGoogleSignIn}
            className={`w-full min-h-[46px] px-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer ${
              isGlass
                ? 'bg-[#03191B] border-[#13464B] hover:border-[#00C8D7]/55 hover:bg-[#06272A] text-[#F5FAFA] shadow-sm shadow-black/25'
                : 'bg-white dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] hover:border-[#047857] dark:hover:border-[#10B981] text-stone-800 dark:text-stone-100'
            }`}
          >
            {googleBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleGIcon className="w-4 h-4 shrink-0" />
            )}
            <span>{t('signInWithGoogle')}</span>
          </button>

          {/* Security & Trust Assurance */}
          <p
            className={`flex items-center justify-center gap-1.5 text-[11px] text-center pt-0.5 ${
              isGlass ? 'text-[#7CA3A6]' : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            <ShieldCheck
              className={`w-3.5 h-3.5 shrink-0 ${
                isGlass ? 'text-[#00D68F]' : 'text-[#047857] dark:text-[#10B981]'
              }`}
            />
            <span>{t('authSecurityNotice')}</span>
          </p>
        </div>
      )}

      {welcomeBackNotice && (
        <div
          role="status"
          className={`${successBannerClass} items-start justify-between`}
        >
          <div className="flex items-start gap-2 min-w-0">
            <MailCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold">
                {t('welcomeBackSubtitle', { name: welcomeBackNotice.displayName })}
              </div>
              <div className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                {t('welcomeBackBannerDetail', {
                  neighborhood: getLocalizedNeighborhood(
                    welcomeBackNotice.neighborhood,
                    language
                  ),
                  email: welcomeBackNotice.email,
                })}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={clearWelcomeBackNotice}
            aria-label="Dismiss welcome notice"
            className="p-1 opacity-75 hover:opacity-100 shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
