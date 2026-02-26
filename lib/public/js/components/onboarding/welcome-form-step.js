import { h } from "https://esm.sh/preact";
import htm from "https://esm.sh/htm";
import { SecretInput } from "../secret-input.js";

const html = htm.bind(h);

export const WelcomeFormStep = ({
  activeGroup,
  vals,
  hasAi,
  setValue,
  modelOptions,
  modelsLoading,
  modelsError,
  canToggleFullCatalog,
  showAllModels,
  setShowAllModels,
  selectedProvider,
  codexLoading,
  codexStatus,
  startCodexAuth,
  handleCodexDisconnect,
  codexAuthStarted,
  codexAuthWaiting,
  codexManualInput,
  setCodexManualInput,
  completeCodexAuth,
  codexExchanging,
  visibleAiFieldKeys,
  error,
  step,
  totalGroups,
  currentGroupValid,
  goBack,
  goNext,
  loading,
  allValid,
  handleSubmit,
}) => html`
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-sm font-medium text-gray-200">${activeGroup.title}</h2>
      <p class="text-xs text-gray-500">${activeGroup.description}</p>
    </div>
    ${activeGroup.validate(vals, { hasAi })
      ? html`<span
          class="text-xs font-medium px-2 py-0.5 rounded-full bg-green-900/50 text-green-400"
          >✓</span
        >`
      : activeGroup.id !== "tools"
        ? html`<span
            class="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400"
            >Required</span
          >`
        : null}
  </div>

  ${activeGroup.id === "ai" &&
  html`
    <div class="space-y-1">
      <label class="text-xs font-medium text-gray-400">Model</label>
      <select
        value=${vals.MODEL_KEY || ""}
        onInput=${(e) => setValue("MODEL_KEY", e.target.value)}
        class="w-full bg-black/30 border border-border rounded-lg pl-3 pr-8 py-2 text-sm text-gray-200 outline-none focus:border-gray-500"
      >
        <option value="">Select a model</option>
        ${modelOptions.map(
          (model) => html`
            <option value=${model.key}>${model.label || model.key}</option>
          `,
        )}
      </select>
      <p class="text-xs text-gray-600">
        ${modelsLoading
          ? "Loading model catalog..."
          : modelsError
            ? modelsError
            : ""}
      </p>
      ${canToggleFullCatalog &&
      html`
        <button
          type="button"
          onclick=${() => setShowAllModels((prev) => !prev)}
          class="text-xs text-gray-500 hover:text-gray-300"
        >
          ${showAllModels
            ? "Show recommended models"
            : "Show full model catalog"}
        </button>
      `}
    </div>
  `}
  ${activeGroup.id === "ai" &&
  selectedProvider === "openai-codex" &&
  html`
    <div class="bg-black/20 border border-border rounded-lg p-3 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-400">Codex OAuth</span>
        ${codexLoading
          ? html`<span class="text-xs text-gray-500">Checking...</span>`
          : codexStatus.connected
            ? html`<span class="text-xs text-green-400">Connected</span>`
            : html`<span class="text-xs text-yellow-400">Not connected</span>`}
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          onclick=${startCodexAuth}
          class="text-xs font-medium px-3 py-1.5 rounded-lg ${codexStatus.connected
            ? "border border-border text-gray-300 hover:border-gray-500"
            : "ac-btn-cyan"}"
        >
          ${codexStatus.connected ? "Reconnect Codex" : "Connect Codex OAuth"}
        </button>
        ${codexStatus.connected &&
        html`
          <button
            type="button"
            onclick=${handleCodexDisconnect}
            class="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-gray-300 hover:border-gray-500"
          >
            Disconnect
          </button>
        `}
      </div>
      ${!codexStatus.connected &&
      codexAuthStarted &&
      html`
        <div class="space-y-1 pt-1">
          <p class="text-xs text-gray-500">
            ${codexAuthWaiting
              ? "Complete login in the popup, then paste the full redirect URL from the address bar (starts with "
              : "Paste the full redirect URL from the address bar (starts with "}
            <code class="text-xs bg-black/30 px-1 rounded"
              >http://localhost:1455/auth/callback</code
            >) ${codexAuthWaiting ? " to finish setup." : " to finish setup."}
          </p>
          <input
            type="text"
            value=${codexManualInput}
            onInput=${(e) => setCodexManualInput(e.target.value)}
            placeholder="http://localhost:1455/auth/callback?code=...&state=..."
            class="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-gray-500"
          />
          <button
            type="button"
            onclick=${completeCodexAuth}
            disabled=${!codexManualInput.trim() || codexExchanging}
            class="text-xs font-medium px-3 py-1.5 rounded-lg ac-btn-cyan"
          >
            ${codexExchanging ? "Completing..." : "Complete Codex OAuth"}
          </button>
        </div>
      `}
    </div>
  `}
  ${(activeGroup.id === "ai"
    ? activeGroup.fields.filter((field) => visibleAiFieldKeys.has(field.key))
    : activeGroup.fields
  ).map(
    (field) => html`
      <div class="space-y-1" key=${field.key}>
        <label class="text-xs font-medium text-gray-400">${field.label}</label>
        <${SecretInput}
          key=${field.key}
          value=${vals[field.key] || ""}
          onInput=${(e) => setValue(field.key, e.target.value)}
          placeholder=${field.placeholder || ""}
          isSecret=${!field.isText}
          inputClass="flex-1 bg-black/30 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-gray-500 font-mono"
        />
        <p class="text-xs text-gray-600">${field.hint}</p>
      </div>
    `,
  )}
  ${error
    ? html`<div
        class="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-300 text-sm"
      >
        ${error}
      </div>`
    : null}
  ${step === totalGroups - 1 && (!vals.OPENAI_API_KEY || !vals.GEMINI_API_KEY)
    ? html`
        ${!vals.OPENAI_API_KEY
          ? html`<div class="space-y-1">
              <label class="text-xs font-medium text-gray-400"
                >OpenAI API Key</label
              >
              <${SecretInput}
                value=${vals.OPENAI_API_KEY || ""}
                onInput=${(e) => setValue("OPENAI_API_KEY", e.target.value)}
                placeholder="sk-..."
                isSecret=${true}
                inputClass="flex-1 bg-black/30 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-gray-500 font-mono"
              />
              <p class="text-xs text-gray-600">
                Used for memory embeddings -${" "}
                <a
                  href="https://platform.openai.com"
                  target="_blank"
                  class="hover:underline"
                  style="color: var(--accent-link)"
                  >get key</a
                >
              </p>
            </div>`
          : null}
        ${!vals.GEMINI_API_KEY
          ? html`<div class="space-y-1">
              <label class="text-xs font-medium text-gray-400"
                >Gemini API Key</label
              >
              <${SecretInput}
                value=${vals.GEMINI_API_KEY || ""}
                onInput=${(e) => setValue("GEMINI_API_KEY", e.target.value)}
                placeholder="AI..."
                isSecret=${true}
                inputClass="flex-1 bg-black/30 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-gray-500 font-mono"
              />
              <p class="text-xs text-gray-600">
                Used for memory embeddings and Nano Banana -${" "}
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  class="hover:underline"
                  style="color: var(--accent-link)"
                  >get key</a
                >
              </p>
            </div>`
          : null}
      `
    : null}

  <div class="grid grid-cols-2 gap-2 pt-3">
    ${step < totalGroups - 1
      ? html`
          ${step > 0
            ? html`<button
                onclick=${goBack}
                class="w-full text-sm font-medium px-4 py-2 rounded-xl transition-all border border-border text-gray-300 hover:border-gray-500"
              >
                Back
              </button>`
            : html`<div class="w-full"></div>`}
          <button
            onclick=${goNext}
            disabled=${!currentGroupValid}
            class="w-full text-sm font-medium px-4 py-2 rounded-xl transition-all ${currentGroupValid
              ? "bg-white text-black hover:opacity-85"
              : "bg-gray-800 text-gray-500 cursor-not-allowed"}"
          >
            Next
          </button>
        `
      : html`
          ${step > 0
            ? html`<button
                onclick=${goBack}
                class="w-full text-sm font-medium px-4 py-2 rounded-xl transition-all border border-border text-gray-300 hover:border-gray-500"
              >
                Back
              </button>`
            : html`<div class="w-full"></div>`}
          <button
            onclick=${handleSubmit}
            disabled=${!allValid || loading}
            class="w-full text-sm font-medium px-4 py-2 rounded-xl transition-all ${allValid &&
            !loading
              ? "bg-white text-black hover:opacity-85"
              : "bg-gray-800 text-gray-500 cursor-not-allowed"}"
          >
            ${loading ? "Starting..." : "Complete Setup"}
          </button>
        `}
  </div>
`;
