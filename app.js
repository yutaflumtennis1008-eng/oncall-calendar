// LINE の LIFF から開く入力画面（NG日入力・当直入力）の共通部分
//   データは GAS のウェブアプリ（JSON を返す API）から取り、送信も GAS に送る。
//   GAS の URL はこのページに書かず、LINE のボタンの URL に付いている g（デプロイID）から組み立てる。
//   本人の確認は GAS 側でトークン（t / duty）を毎回照合して行う。
const Page = (() => {
  let liffReady = false;
  let api = '';

  function readQuery() {
    const q = new URLSearchParams(location.search);
    const out = {};
    q.forEach((v, k) => { out[k] = v; });
    // LIFF から開くと、本来のクエリが liff.state に「?t=…&g=…」の形でまとめて入ることがある
    const st = q.get('liff.state');
    if (st) {
      const i = st.indexOf('?');
      new URLSearchParams(i >= 0 ? st.slice(i + 1) : st).forEach((v, k) => { if (!(k in out)) out[k] = v; });
    }
    return out;
  }

  /** LIFF を初期化し、URL のクエリ（t / duty / g / liff）を返す */
  async function init() {
    let q = readQuery();
    if (q.liff && window.liff) {
      try {
        await Promise.race([
          liff.init({ liffId: q.liff }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);
        liffReady = true;
      } catch (e) {
        // LIFF の外（PC のブラウザなど）や初期化に失敗したときも、画面はそのまま使える
      }
      q = Object.assign(q, readQuery()); // 初期化のあと URL が本来のクエリに戻ることがある
    }
    const g = String(q.g || '');
    api = /^[A-Za-z0-9_-]{10,200}$/.test(g) ? 'https://script.google.com/macros/s/' + g + '/exec' : '';
    return q;
  }

  async function parse(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('サーバーの応答を読めませんでした（' + res.status + '）。時間をおいて開き直してください。');
    }
  }

  return {
    init,
    hasApi: () => !!api,
    /** GAS からデータを取る（GET） */
    async get(params) {
      return parse(await fetch(api + '?' + new URLSearchParams(params), { cache: 'no-store' }));
    },
    /** GAS に送る（POST）。Content-Type を付けない（付けると別のサイトからの送信が事前確認で止まる） */
    async post(body) {
      return parse(await fetch(api, { method: 'POST', body: JSON.stringify(body) }));
    },
    /** 通信の失敗を画面に出す文にする */
    errText(e) {
      if (e instanceof TypeError) return '通信できませんでした。電波のよい所で、もう一度お試しください。';
      return e && e.message ? e.message : String(e);
    },
    canClose: () => liffReady && liff.isInClient(),
    close() {
      if (liffReady && liff.isInClient()) liff.closeWindow();
      else window.close();
    },
  };
})();
