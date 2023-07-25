import {
  APICredential,
  APIError,
  ChatAPIOptions,
  ChatConversationAPI,
  ChatMessage,
  ChatRole,
} from 'chie';

const apiEndpoint = '/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate';

interface SessionData {
  SNlM0e: string;
  requestId: 0;
  conversationId?: string;
  responseId?: string;
  choiceId?: string;
}

export default class GoogleBard extends ChatConversationAPI<SessionData> {
  static badSummarizer = true;

  constructor(credential: APICredential) {
    if (credential.type != 'Google Bard')
      throw new Error(`Expect API credential for "Google Bard" but got ${credential.type}.`);
    super(credential);
  }

  async sendMessage(text: string, options: ChatAPIOptions) {
    if (!this.session) {
      this.session = {
        SNlM0e: await this.#getSession(options.signal),
        requestId: 0,
      };
    }

    const message = [
      [ text ],
      null,
      [ this.session.conversationId ?? null,
        this.session.responseId ?? null,
        this.session.choiceId ?? null, ]
    ];
    const body = {
      'f.req': JSON.stringify([null, JSON.stringify(message)]),
      at: this.session.SNlM0e,
    };
    const rawBody = Object.entries(body)
      .map(([ key, value ]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
      .join('&');
    const url = new URL(apiEndpoint, this.credential.url);
    url.searchParams.append('_reqid', String(this.session.requestId));
    url.searchParams.append('bl', 'boq_assistant-bard-web-server_20230711.08_p0');
    url.searchParams.append('rt', 'c');
    const response = await fetch(url.href, {
      signal: options.signal,
      body: rawBody,
      method: 'POST',
      headers: this.#getHeaders(),
      credentials: 'include',
    });
    const [ , , , rawData ] = (await response.text()).split('\n');
    const data = JSON.parse(JSON.parse(rawData)[0][2]);
    if (!data)
      throw new Error(`No response received: ${rawData}.`);

    this.session.requestId += 100000;
    this.session.conversationId = data[1][0];
    this.session.responseId = data[1][1];
    this.session.choiceId = data[4][0][0];

    const content = data[4][0][1][0];
    const images = data[4][0][4];
    options.onMessageDelta(
      {role: ChatRole.Assistant, content: this.#addImageLinks(content, images)},
      {pending: false, id: String(this.session.requestId)});
  }

  async #getSession(signal) {
    const response = await fetch(this.credential.url, {
      signal,
      headers: this.#getHeaders(),
      credentials: 'include',
    });
    const data = await response.text();
    const match = data.match(/SNlM0e":"(.*?)"/);
    if (!match)
      throw new Error('Failed to get Bard credentials.');
    return match[1];
  }

  #getHeaders() {
    return {
      Host: 'bard.google.com',
      'X-Same-Domain': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Origin: this.credential.url,
      Referer: this.credential.url,
      Cookie: this.credential.cookie,
    };
  }

  #addImageLinks(content, images) {
    if (!images)
      return content;
    for (const item of images) {
      const alt = item[0][4];
      const tag = item[2];
      const [ [ url ], website ] = item[1];
      const [ [ src ], , height, width ] = item[3];
      content = content.replaceAll(tag, () => `\n![${alt}](${src} "=${width}x${height}")\n[${website}](${url})\n`);
    }
    return content;
  }
}
