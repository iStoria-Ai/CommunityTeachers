import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function languageHtmlPlugin(): Plugin {
  return {
    name: 'community-teachers-language-html',
    transformIndexHtml(html) {
      const lang = (process.env.VITE_COMMUNITY_LANGUAGE || 'edo').toLowerCase();
      if (lang !== 'urhobo') {
        return html;
      }
      return html
        .replace(/Edo Community Teachers/g, 'Urhobo Community Teachers')
        .replace(/Edo Community Library/g, 'Urhobo Community Library')
        .replace(/Edo — Community Teachers/g, 'Urhobo — Community Teachers')
        .replace(/Edo — Community Library/g, 'Urhobo — Community Library')
        .replace(/Listen and learn Edo words/g, 'Listen and learn Urhobo words')
        .replace(/https:\/\/edo\.communityteachers\.info/g, 'https://urhobo.communityteachers.info')
        .replace(/assets\/edo-welcome-hero\.jpg/g, 'assets/urhobo-welcome-hero.jpg')
        .replace(/assets\/edo-bronze-icon\.jpg/g, 'assets/urhobo-emblem.jpg')
        .replace(/assets\/edo-icon-192\.png/g, 'assets/urhobo-icon-192.png')
        .replace(/assets\/edo-icon-512\.png/g, 'assets/urhobo-icon-512.png')
        .replace(/manifest-edo-library\.webmanifest/g, 'manifest-urhobo-library.webmanifest')
        .replace(/manifest-edo\.webmanifest/g, 'manifest-urhobo.webmanifest');
    }
  };
}

export default defineConfig(({ mode }) => {
  let defaultBase = '/';
  if (mode === 'capacitor') {
    defaultBase = './';
  } else if (mode === 'getrodion') {
    defaultBase = '/ai-studio/edo/';
  }

  const base = process.env.VITE_BASE_PATH || defaultBase;

  return {
    base,
    plugins: [react(), languageHtmlPlugin()],
    build: {
      rollupOptions: {
        input: { studio: 'index.html', library: 'library/index.html' }
      }
    },
    server: {
      host: true,
      port: 5173
    },
    preview: {
      host: true,
      port: 4173
    }
  };
});
