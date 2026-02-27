import { h } from "https://esm.sh/preact";
import { useState, useEffect, useCallback, useRef } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
import { fetchEnvVars, saveEnvVars, restartGateway } from "../lib/api.js";
import { showToast } from "./toast.js";
import { SecretInput } from "./secret-input.js";
const html = htm.bind(h);

const kGroupLabels = {
  github: "GitHub",
  channels: "Channels",
  tools: "Tools",
  custom: "Custom",
};

const kGroupOrder = ["github", "channels", "tools", "custom"];
const normalizeEnvVarKey = (raw) => raw.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
const getVarsSignature = (items) =>
  JSON.stringify(
    (items || [])
      .map((v) => ({
        key: String(v?.key || ""),
        value: String(v?.value || ""),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  );

const kHintByKey = {
  ANTHROPIC_API_KEY: html`from <a href="https://console.anthropic.com" target="_blank" class="hover:underline" style="color: var(--accent-link)">console.anthropic.com</a>`,
  ANTHROPIC_TOKEN: html`from <code class="text-xs bg-black/30 px-1 rounded">claude setup-token</code>`,
  OPENAI_API_KEY: html`from <a href="https://platform.openai.com" target="_blank" class="hover:underline" style="color: var(--accent-link)">platform.openai.com</a>`,
  GEMINI_API_KEY: html`from <a href="https://aistudio.google.com" target="_blank" class="hover:underline" style="color: var(--accent-link)">aistudio.google.com</a>`,
  GITHUB_TOKEN: html`classic PAT · <code class="text-xs bg-black/30 px-1 rounded">repo</code> scope · <a href="https://github.com/settings/tokens" target="_blank" class="hover:underline" style="color: var(--accent-link)">github settings</a>`,
  GITHUB_WORKSPACE_REPO: html`use <code class="text-xs bg-black/30 px-1 rounded">owner/repo</code> or <code class="text-xs bg-black/30 px-1 rounded">https://github.com/owner/repo</code>`,
  TELEGRAM_BOT_TOKEN: html`from <a href="https://t.me/BotFather" target="_blank" class="hover:underline" style="color: var(--accent-link)">@BotFather</a> · <a href="https://docs.openclaw.ai/channels/telegram" target="_blank" class="hover:underline" style="color: var(--accent-link)">full guide</a>`,
  DISCORD_BOT_TOKEN: html`from <a href="https://discord.com/developers/applications" target="_blank" class="hover:underline" style="color: var(--accent-link)">developer portal</a> · <a href="https://docs.openclaw.ai/channels/discord" target="_blank" class="hover:underline" style="color: var(--accent-link)">full guide</a>`,
  BRAVE_API_KEY: html`from <a href="https://brave.com/search/api/" target="_blank" class="hover:underline" style="color: var(--accent-link)">brave.com/search/api</a> — free tier available`,
};

const getHintContent = (envVar) => kHintByKey[envVar.key] || envVar.hint || "";

const EnvRow = ({ envVar, onChange, onDelete, disabled }) => {
  const hint = getHintContent(envVar);

  return html`
    <div class="flex items-start gap-4 px-4 py-3">
      <div class="shrink-0 flex items-center gap-2 pt-1.5" style="width: 200px">
        <span
          class="inline-block w-1.5 h-1.5 rounded-full shrink-0 ${envVar.value
            ? "bg-green-500"
            : "bg-gray-600"}"
        />
        <code class="text-sm truncate">${envVar.key}</code>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1">
          <${SecretInput}
            value=${envVar.value}
            onInput=${(e) => onChange(envVar.key, e.target.value)}
            placeholder=${envVar.value ? "" : "not set"}
            isSecret=${!!envVar.value}
            inputClass="flex-1 min-w-0 bg-black/30 border border-border rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-gray-500 font-mono"
            disabled=${disabled}
          />
          ${envVar.group === "custom"
            ? html`<button
                onclick=${() => onDelete(envVar.key)}
                class="text-gray-600 hover:text-red-400 px-1 text-xs shrink-0"
                title="Delete"
              >
                ✕
              </button>`
            : null}
        </div>
        ${hint
          ? html`<p class="text-xs text-gray-600 mt-1">${hint}</p>`
          : null}
      </div>
    </div>
  `;
};

export const Envars = () => {
  const [vars, setVars] = useState([]);
  const [reservedKeys, setReservedKeys] = useState(() => new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restartingGateway, setRestartingGateway] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);
  const [newKey, setNewKey] = useState("");
  const baselineSignatureRef = useRef("[]");

  const load = useCallback(async () => {
    try {
      const data = await fetchEnvVars();
      const nextVars = data.vars || [];
      baselineSignatureRef.current = getVarsSignature(nextVars);
      setVars(nextVars);
      setReservedKeys(new Set(data.reservedKeys || []));
      setRestartRequired(!!data.restartRequired);
    } catch (err) {
      console.error("Failed to load env vars:", err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setDirty(getVarsSignature(vars) !== baselineSignatureRef.current);
  }, [vars]);

  const handleChange = (key, value) => {
    setVars((prev) => prev.map((v) => (v.key === key ? { ...v, value } : v)));
  };

  const handleDelete = (key) => {
    setVars((prev) => prev.filter((v) => v.key !== key));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const toSave = vars
        .filter((v) => v.editable)
        .map((v) => ({ key: v.key, value: v.value }));
      const result = await saveEnvVars(toSave);
      const needsRestart = !!result?.restartRequired;
      setRestartRequired(needsRestart);
      showToast(
        needsRestart
          ? "Environment variables saved. Restart gateway to apply."
          : "Environment variables saved",
        "success",
      );
      baselineSignatureRef.current = getVarsSignature(vars);
      setDirty(false);
    } catch (err) {
      showToast("Failed to save: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRestartGateway = async () => {
    if (restartingGateway) return;
    setRestartingGateway(true);
    try {
      await restartGateway();
      setRestartRequired(false);
      showToast("Gateway restarted", "success");
    } catch (err) {
      showToast("Restart failed: " + err.message, "error");
    } finally {
      setRestartingGateway(false);
    }
  };

  const [newVal, setNewVal] = useState("");

  const parsePaste = (input) => {
    const lines = input
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !l.startsWith("#"));
    const pairs = [];
    for (const line of lines) {
      const eqIdx = line.indexOf("=");
      if (eqIdx > 0)
        pairs.push({
          key: line.slice(0, eqIdx).trim(),
          value: line.slice(eqIdx + 1).trim(),
        });
    }
    return pairs;
  };

  const addVars = (pairs) => {
    let added = 0;
    const blocked = [];
    setVars((prev) => {
      const next = [...prev];
      for (const { key: rawKey, value } of pairs) {
        const key = normalizeEnvVarKey(rawKey);
        if (!key) continue;
        if (reservedKeys.has(key)) {
          blocked.push(key);
          continue;
        }
        const existing = next.find((v) => v.key === key);
        if (existing) {
          existing.value = value;
        } else {
          next.push({
            key,
            value,
            label: key,
            group: "custom",
            hint: "",
            source: "env_file",
            editable: true,
          });
        }
        added++;
      }
      return next;
    });
    return { added, blocked };
  };

  const handlePaste = (e, fallbackField) => {
    const text = (e.clipboardData || window.clipboardData).getData("text");
    const pairs = parsePaste(text);
    if (pairs.length > 1) {
      e.preventDefault();
      const { added, blocked } = addVars(pairs);
      setNewKey("");
      setNewVal("");
      if (blocked.length) {
        const uniqueBlocked = Array.from(new Set(blocked));
        showToast(
          `Reserved vars can't be added: ${uniqueBlocked.join(", ")}`,
          "error",
        );
      }
      if (added) {
        showToast(`Added ${added} variable${added !== 1 ? "s" : ""}`, "success");
      }
      return;
    }
    if (pairs.length === 1) {
      e.preventDefault();
      setNewKey(pairs[0].key);
      setNewVal(pairs[0].value);
      return;
    }
  };

  const handleKeyInput = (raw) => {
    const pairs = parsePaste(raw);
    if (pairs.length === 1) {
      setNewKey(pairs[0].key);
      setNewVal(pairs[0].value);
      return;
    }
    setNewKey(raw);
  };

  const handleValInput = (raw) => {
    const pairs = parsePaste(raw);
    if (pairs.length === 1) {
      setNewKey(pairs[0].key);
      setNewVal(pairs[0].value);
      return;
    }
    setNewVal(raw);
  };

  const handleAddVar = () => {
    const key = normalizeEnvVarKey(newKey);
    if (!key) return;
    if (reservedKeys.has(key)) {
      showToast(`Reserved var can't be added: ${key}`, "error");
      return;
    }
    addVars([{ key, value: newVal }]);
    setNewKey("");
    setNewVal("");
  };

  // Group vars
  const grouped = {};
  for (const v of vars) {
    const g = v.group || "custom";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(v);
  }

  return html`
    <div class="space-y-4">
      ${kGroupOrder
        .filter((g) => grouped[g]?.length)
        .map(
          (g) => html`
            <div class="bg-surface border border-border rounded-xl overflow-hidden">
              <h3 class="card-label text-xs px-4 pt-3 pb-2">
                ${kGroupLabels[g] || g}
              </h3>
              <div class="divide-y divide-border">
                ${grouped[g].map(
                  (v) =>
                    html`<${EnvRow}
                      envVar=${v}
                      onChange=${handleChange}
                      onDelete=${handleDelete}
                      disabled=${saving}
                    />`,
                )}
              </div>
            </div>
          `,
        )}

      <div class="bg-surface border border-border rounded-xl overflow-hidden">
        <div class="flex items-center justify-between px-4 pt-3 pb-2">
          <h3 class="card-label text-xs">Add Variable</h3>
          <span class="text-xs" style="color: var(--text-dim)">Paste KEY=VALUE or multiple lines</span>
        </div>
        <div class="flex items-start gap-4 px-4 py-3 border-t border-border">
          <div class="shrink-0" style="width: 200px">
            <input
              type="text"
              value=${newKey}
              placeholder="KEY"
              onInput=${(e) => handleKeyInput(e.target.value)}
              onPaste=${(e) => handlePaste(e, "key")}
              onKeyDown=${(e) => e.key === "Enter" && handleAddVar()}
              class="w-full bg-black/30 border border-border rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-gray-500 font-mono uppercase"
            />
          </div>
          <div class="flex-1 flex gap-2">
            <input
              type="text"
              value=${newVal}
              placeholder="value"
              onInput=${(e) => handleValInput(e.target.value)}
              onPaste=${(e) => handlePaste(e, "val")}
              onKeyDown=${(e) => e.key === "Enter" && handleAddVar()}
              class="flex-1 bg-black/30 border border-border rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-gray-500 font-mono"
            />
            <button
              onclick=${handleAddVar}
              class="text-xs px-3 py-1.5 rounded-lg border border-border text-gray-400 hover:text-gray-200 hover:border-gray-500 shrink-0"
            >
              + Add
            </button>
          </div>
        </div>
      </div>

      ${restartRequired
        ? html`<div
            class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center justify-between gap-3"
          >
            <p class="text-sm text-yellow-200">
              Gateway restart required to apply env changes.
            </p>
            <button
              onclick=${handleRestartGateway}
              disabled=${restartingGateway}
              class="text-xs px-2.5 py-1 rounded-lg border border-yellow-500/40 text-yellow-200 hover:border-yellow-400 hover:text-yellow-100 transition-colors shrink-0 ${restartingGateway
                ? "opacity-60 cursor-not-allowed"
                : ""}"
            >
              ${restartingGateway ? "Restarting..." : "Restart Gateway"}
            </button>
          </div>`
        : null}

      <button
        onclick=${handleSave}
        disabled=${!dirty || saving || restartingGateway}
        class="w-full text-sm font-medium px-4 py-2.5 rounded-xl transition-all ac-btn-cyan"
      >
        ${saving
          ? html`<span class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Saving...
            </span>`
          : "Save changes"}
      </button>
    </div>
  `;
};
