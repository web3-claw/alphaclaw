import { h } from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';
import { Badge } from './badge.js';
const html = htm.bind(h);

const ALL_CHANNELS = ['telegram', 'discord'];
const kChannelMeta = {
  telegram: { label: 'Telegram', iconSrc: '/assets/icons/telegram.svg' },
  discord: { label: 'Discord', iconSrc: '/assets/icons/discord.svg' },
};

export function Channels({ channels, onSwitchTab, onNavigate }) {
  return html`
    <div class="bg-surface border border-border rounded-xl p-4">
      <h2 class="card-label mb-3">Channels</h2>
      <div class="space-y-2">
        ${channels ? ALL_CHANNELS.map(ch => {
          const info = channels[ch];
          const channelMeta = kChannelMeta[ch] || { label: ch.charAt(0).toUpperCase() + ch.slice(1), iconSrc: '' };
          const isClickable = ch === 'telegram' && info?.status === 'paired' && onNavigate;
          let badge;
          if (!info) {
            badge = html`<a
              href="#"
              onclick=${(e) => { e.preventDefault(); onSwitchTab?.('envars'); }}
              class="text-xs text-gray-500 hover:text-gray-300"
            >Add token</a>`;
          } else if (info.status === 'paired') {
            badge = html`<${Badge} tone="success">Paired (${info.paired})</${Badge}>`;
          } else {
            badge = html`<${Badge} tone="warning">Awaiting pairing</${Badge}>`;
          }
          return html`<div
            class="flex justify-between items-center py-1.5 ${isClickable ? 'cursor-pointer hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors' : ''}"
            onclick=${isClickable ? () => onNavigate('telegram') : undefined}
          >
            <span class="font-medium text-sm flex items-center gap-2">
              ${channelMeta.iconSrc
                ? html`<img src=${channelMeta.iconSrc} alt="" class="w-4 h-4 rounded-sm" aria-hidden="true" />`
                : null}
              ${channelMeta.label}
            </span>
            <span class="flex items-center gap-2">
              ${badge}
              ${isClickable && html`
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="text-gray-600">
                  <path d="M5.646 3.354a.5.5 0 01.708 0l4.5 4.5a.5.5 0 010 .708l-4.5 4.5a.5.5 0 01-.708-.708L9.793 8 5.646 3.854a.5.5 0 010-.5z"/>
                </svg>
              `}
            </span>
          </div>`;
        }) : html`<div class="text-gray-500 text-sm text-center py-2">Loading...</div>`}
      </div>
    </div>`;
}

export { ALL_CHANNELS };
