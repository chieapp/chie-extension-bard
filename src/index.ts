import path from 'node:path';
import {BrowserWindow, Icon, apiManager} from 'chie';

import GoogleBard from './google-bard';

export function activate() {
  apiManager.registerAPI({
    name: 'Google Bard',
    apiClass: GoogleBard,
    auth: 'login',
    icon: new Icon({filePath: path.join(__dirname, '..', 'bard.png')}),
    description: 'Chat with Google Bard, requires Google account.',
    url: 'https://bard.google.com',
    login: login,
    refresh: login,
  });
}

export function deactivate() {}

async function login() {
  const win = new BrowserWindow();
  win.window.activate();
  win.browser.loadURL('https://accounts.google.com/ServiceLogin?continue=https://bard.google.com/');
  try {
    for (;;) {
      await win.waitForNavigation(/bard\.google\.com/);
      const cookie = await win.browser.getCookie('https://bard.google.com/');
      const match = cookie.match(/(__Secure-1PSID=)[^\s;]+/);
      if (match)
        return {cookie};
    }
  } finally {
    win.close();
  }
}
