import { h } from "https://esm.sh/preact";
import { useState, useEffect, useRef } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
import {
  runOnboard,
  fetchModels,
  fetchCodexStatus,
  disconnectCodex,
  exchangeCodexOAuth,
} from "../lib/api.js";
import {
  getModelProvider,
  getFeaturedModels,
  getVisibleAiFieldKeys,
} from "../lib/model-config.js";
import { kWelcomeGroups } from "./onboarding/welcome-config.js";
import { WelcomeHeader } from "./onboarding/welcome-header.js";
import { WelcomeSetupStep } from "./onboarding/welcome-setup-step.js";
import { WelcomeFormStep } from "./onboarding/welcome-form-step.js";
const html = htm.bind(h);
const kOnboardingStorageKey = "openclaw_setup";
const kOnboardingStepKey = "_step";

export const Welcome = ({ onComplete }) => {
  const [initialSetupState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(kOnboardingStorageKey) || "{}");
    } catch {
      return {};
    }
  });
  const [vals, setVals] = useState(() => ({ ...initialSetupState }));
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState(null);
  const [showAllModels, setShowAllModels] = useState(false);
  const [codexStatus, setCodexStatus] = useState({ connected: false });
  const [codexLoading, setCodexLoading] = useState(true);
  const [codexManualInput, setCodexManualInput] = useState("");
  const [codexExchanging, setCodexExchanging] = useState(false);
  const [codexAuthStarted, setCodexAuthStarted] = useState(false);
  const [codexAuthWaiting, setCodexAuthWaiting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const codexPopupPollRef = useRef(null);

  useEffect(() => {
    fetchModels()
      .then((result) => {
        const list = Array.isArray(result.models) ? result.models : [];
        const featured = getFeaturedModels(list);
        setModels(list);
        if (!vals.MODEL_KEY && list.length > 0) {
          const defaultModel = featured[0] || list[0];
          setVals((prev) => ({ ...prev, MODEL_KEY: defaultModel.key }));
        }
      })
      .catch(() => setModelsError("Failed to load models"))
      .finally(() => setModelsLoading(false));
  }, []);

  const refreshCodexStatus = async () => {
    try {
      const status = await fetchCodexStatus();
      setCodexStatus(status);
      if (status?.connected) {
        setCodexAuthStarted(false);
        setCodexAuthWaiting(false);
      }
    } catch {
      setCodexStatus({ connected: false });
    } finally {
      setCodexLoading(false);
    }
  };

  useEffect(() => {
    refreshCodexStatus();
  }, []);

  useEffect(() => {
    const onMessage = async (e) => {
      if (e.data?.codex === "success") {
        await refreshCodexStatus();
      }
      if (e.data?.codex === "error") {
        setError(`Codex auth failed: ${e.data.message || "unknown error"}`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(
    () => () => {
      if (codexPopupPollRef.current) {
        clearInterval(codexPopupPollRef.current);
        codexPopupPollRef.current = null;
      }
    },
    [],
  );

  const set = (key, value) => setVals((prev) => ({ ...prev, [key]: value }));

  const selectedProvider = getModelProvider(vals.MODEL_KEY);
  const featuredModels = getFeaturedModels(models);
  const baseModelOptions = showAllModels
    ? models
    : featuredModels.length > 0
      ? featuredModels
      : models;
  const selectedModelOption = models.find(
    (model) => model.key === vals.MODEL_KEY,
  );
  const modelOptions =
    selectedModelOption &&
    !baseModelOptions.some((model) => model.key === selectedModelOption.key)
      ? [...baseModelOptions, selectedModelOption]
      : baseModelOptions;
  const canToggleFullCatalog =
    featuredModels.length > 0 && models.length > featuredModels.length;
  const visibleAiFieldKeys = getVisibleAiFieldKeys(selectedProvider);
  const hasAi =
    selectedProvider === "anthropic"
      ? !!(vals.ANTHROPIC_API_KEY || vals.ANTHROPIC_TOKEN)
      : selectedProvider === "openai"
        ? !!vals.OPENAI_API_KEY
        : selectedProvider === "google"
          ? !!vals.GEMINI_API_KEY
          : selectedProvider === "openai-codex"
            ? !!(codexStatus.connected || vals.OPENAI_API_KEY)
            : false;

  const allValid = kWelcomeGroups.every((g) => g.validate(vals, { hasAi }));
  const kFinalSetupStep = kWelcomeGroups.length;
  const [step, setStep] = useState(() => {
    const parsedStep = Number.parseInt(
      String(initialSetupState?.[kOnboardingStepKey] || ""),
      10,
    );
    if (!Number.isFinite(parsedStep)) return 0;
    return Math.max(0, Math.min(kFinalSetupStep, parsedStep));
  });
  const isSetupStep = step === kFinalSetupStep;
  const activeGroup = !isSetupStep ? kWelcomeGroups[step] : null;
  const currentGroupValid = activeGroup
    ? activeGroup.validate(vals, { hasAi })
    : false;

  useEffect(() => {
    localStorage.setItem(
      kOnboardingStorageKey,
      JSON.stringify({
        ...vals,
        [kOnboardingStepKey]: step,
      }),
    );
  }, [vals, step]);

  const startCodexAuth = () => {
    if (codexStatus.connected) return;
    setCodexAuthStarted(true);
    setCodexAuthWaiting(true);
    const authUrl = "/auth/codex/start";
    const popup = window.open(
      authUrl,
      "codex-auth",
      "popup=yes,width=640,height=780",
    );
    if (!popup || popup.closed) {
      setCodexAuthWaiting(false);
      window.location.href = authUrl;
      return;
    }
    if (codexPopupPollRef.current) {
      clearInterval(codexPopupPollRef.current);
    }
    codexPopupPollRef.current = setInterval(() => {
      if (popup.closed) {
        clearInterval(codexPopupPollRef.current);
        codexPopupPollRef.current = null;
        setCodexAuthWaiting(false);
      }
    }, 500);
  };

  const completeCodexAuth = async () => {
    if (!codexManualInput.trim() || codexExchanging) return;
    setCodexExchanging(true);
    setError(null);
    try {
      const result = await exchangeCodexOAuth(codexManualInput.trim());
      if (!result.ok)
        throw new Error(result.error || "Codex OAuth exchange failed");
      setCodexManualInput("");
      setCodexAuthStarted(false);
      setCodexAuthWaiting(false);
      await refreshCodexStatus();
    } catch (err) {
      setError(err.message || "Codex OAuth exchange failed");
    } finally {
      setCodexExchanging(false);
    }
  };

  const handleCodexDisconnect = async () => {
    const result = await disconnectCodex();
    if (!result.ok) {
      setError(result.error || "Failed to disconnect Codex");
      return;
    }
    setCodexAuthStarted(false);
    setCodexAuthWaiting(false);
    setCodexManualInput("");
    await refreshCodexStatus();
  };

  const handleSubmit = async () => {
    if (!allValid || loading) return;
    setStep(kFinalSetupStep);
    setLoading(true);
    setError(null);

    try {
      const vars = Object.entries(vals)
        .filter(
          ([key]) => key !== "MODEL_KEY" && !String(key || "").startsWith("_"),
        )
        .filter(([, v]) => v)
        .map(([key, value]) => ({ key, value }));
      const result = await runOnboard(vars, vals.MODEL_KEY);
      if (!result.ok) throw new Error(result.error || "Onboarding failed");
      localStorage.removeItem(kOnboardingStorageKey);
      onComplete();
    } catch (err) {
      console.error("Onboard error:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const goBack = () => {
    if (isSetupStep) return;
    setStep((prev) => Math.max(0, prev - 1));
  };

  const goNext = () => {
    if (!activeGroup || !currentGroupValid) return;
    setStep((prev) => Math.min(kWelcomeGroups.length - 1, prev + 1));
  };

  const activeStepLabel = isSetupStep
    ? "Initializing"
    : activeGroup?.title || "Setup";
  const stepNumber = isSetupStep ? kWelcomeGroups.length + 1 : step + 1;

  return html`
    <div class="max-w-lg w-full space-y-5">
      <${WelcomeHeader}
        groups=${kWelcomeGroups}
        step=${step}
        isSetupStep=${isSetupStep}
        stepNumber=${stepNumber}
        activeStepLabel=${activeStepLabel}
        vals=${vals}
        hasAi=${hasAi}
      />

      <div class="bg-surface border border-border rounded-xl p-4 space-y-3">
        ${isSetupStep
          ? html`<${WelcomeSetupStep}
              error=${error}
              loading=${loading}
              onRetry=${handleSubmit}
            />`
          : html`
              <${WelcomeFormStep}
                activeGroup=${activeGroup}
                vals=${vals}
                hasAi=${hasAi}
                setValue=${set}
                modelOptions=${modelOptions}
                modelsLoading=${modelsLoading}
                modelsError=${modelsError}
                canToggleFullCatalog=${canToggleFullCatalog}
                showAllModels=${showAllModels}
                setShowAllModels=${setShowAllModels}
                selectedProvider=${selectedProvider}
                codexLoading=${codexLoading}
                codexStatus=${codexStatus}
                startCodexAuth=${startCodexAuth}
                handleCodexDisconnect=${handleCodexDisconnect}
                codexAuthStarted=${codexAuthStarted}
                codexAuthWaiting=${codexAuthWaiting}
                codexManualInput=${codexManualInput}
                setCodexManualInput=${setCodexManualInput}
                completeCodexAuth=${completeCodexAuth}
                codexExchanging=${codexExchanging}
                visibleAiFieldKeys=${visibleAiFieldKeys}
                error=${error}
                step=${step}
                totalGroups=${kWelcomeGroups.length}
                currentGroupValid=${currentGroupValid}
                goBack=${goBack}
                goNext=${goNext}
                loading=${loading}
                allValid=${allValid}
                handleSubmit=${handleSubmit}
              />
            `}
      </div>
    </div>
  `;
};
