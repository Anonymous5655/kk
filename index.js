import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced, getRequestHeaders } from '../../../../script.js';
import { SECRET_KEYS, secret_state } from '../../../secrets.js';
import { installTransport } from './transport.mjs';
import { accountRows } from './display.mjs';
const ID = 'sharednai_bridge', API = '/api/plugins/sharednai-bridge';
extension_settings[ID] ??= {enabled: false};
const settings = extension_settings[ID];
delete settings.sizeLabels;
let connected = false, previousNovelState, ownsGate = false, container;
let accountVersion = 0, refreshTimer;
const el = id => container?.querySelector('#snb-' + id);
const show = message => { if (el('status')) el('status').textContent = message; };
function updateGate() {
    if (settings.enabled && connected && !ownsGate) {
        previousNovelState = secret_state[SECRET_KEYS.NOVEL]; secret_state[SECRET_KEYS.NOVEL] = true; ownsGate = true;
    } else if ((!settings.enabled || !connected) && ownsGate) {
        secret_state[SECRET_KEYS.NOVEL] = previousNovelState; ownsGate = false;
    }
}
function clearAccount(message) {
    accountVersion++;
    el('account')?.replaceChildren();
    if (el('account-status')) el('account-status').textContent = message;
}
async function api(path, body) {
    const response = await fetch(API + path, {method: body === undefined ? 'GET' : 'POST', headers: getRequestHeaders(), ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    if (!response.ok) {
        if (response.status === 401 && path !== '/connect') {connected = false; updateGate(); clearAccount('다시 로그인하세요.');}
        let message = response.status === 404 ? 'SharedNAI 서버 플러그인 1.3을 설치하고 enableServerPlugins를 켠 뒤 서버를 재시작하세요.' : `HTTP ${response.status}`;
        try { message = (await response.json()).message || message; } catch { /* HTML errors */ }
        throw new Error(message);
    }
    return response;
}
async function refreshAccount() {
    if (!container || !connected) return;
    const version = ++accountVersion;
    el('account-status').textContent = '계정 정보 조회 중…';
    try {
        const data = await (await api('/account')).json();
        if (version !== accountVersion || !connected) return;
        el('account').replaceChildren();
        for (const [label, value] of accountRows(data.account)) {
            const dt = document.createElement('dt'), dd = document.createElement('dd');
            dt.textContent = label; dd.textContent = value; el('account').append(dt, dd);
        }
        el('account-status').textContent = `조회 시각: ${new Date(data.updatedAt).toLocaleString()}`;
    } catch (error) {
        if (version !== accountVersion) return;
        el('account').replaceChildren(); el('account-status').textContent = error.message;
    }
}
// Install before AutoPic to retain its injected characters and reference fields.
installTransport(window, () => settings.enabled, API + '/generate', status => {
    if (status === 401) {connected = false; updateGate(); clearAccount('로그인이 만료되었습니다. 다시 연결하세요.'); return;}
    clearTimeout(refreshTimer); refreshTimer = setTimeout(() => void refreshAccount(), 800);
});
jQuery(async () => {
    const response = await fetch(new URL('./settings.html', import.meta.url));
    container = document.createElement('div'); container.innerHTML = await response.text();
    document.querySelector('#extensions_settings').append(container);
    el('enabled').checked = !!settings.enabled;
    el('enabled').addEventListener('change', () => {settings.enabled = el('enabled').checked; saveSettingsDebounced(); updateGate();});
    el('remember').addEventListener('change', async () => {
        if (!connected) return;
        const remember = el('remember').checked;
        el('remember').disabled = true;
        try {
            await api('/remember', {remember});
            show(remember ? '로그인을 저장했습니다. 서버 재시작 후 자동으로 연결됩니다.' : '저장된 토큰을 삭제했습니다. 현재 연결은 서버 종료까지 유지됩니다.');
        } catch (error) {el('remember').checked = !remember; show(error.message);}
        finally {el('remember').disabled = false;}
    });
    el('connect').addEventListener('click', async () => {
        el('connect').disabled = true; el('disconnect').disabled = true; el('remember').disabled = true; show('사이트 로그인 확인 중…');
        const password = el('password').value; el('password').value = '';
        clearAccount('계정 연결 중…');
        try {
            await api('/connect', {username: el('username').value, password, remember: el('remember').checked});
            connected = true; settings.enabled = true; el('enabled').checked = true;
            saveSettingsDebounced(); updateGate(); show('연결되었습니다. 계정에 등록된 키를 사용합니다.'); await refreshAccount();
        } catch (error) { show(error.message); }
        finally {el('connect').disabled = false; el('disconnect').disabled = false; el('remember').disabled = false;}
    });
    el('check').addEventListener('click', async () => {
        try {await api('/check', {}); connected = true; updateGate(); show('계정 인증 정상'); await refreshAccount();} catch(error) {show(error.message);}
    });
    el('refresh').addEventListener('click', () => {if (!connected) show('먼저 계정을 연결하세요.'); else void refreshAccount();});
    el('disconnect').addEventListener('click', async () => {
        el('connect').disabled = true; el('disconnect').disabled = true; el('remember').disabled = true;
        try {await api('/disconnect', {}); connected = false; updateGate(); clearAccount('연결이 해제되었습니다.'); show('연결을 해제했습니다.');} catch(error) {show(error.message);}
        finally {el('connect').disabled = false; el('disconnect').disabled = false; el('remember').disabled = false;}
    });
    try {
        const status = await (await api('/status')).json();
        connected = status.connected; updateGate();
        if (connected) el('remember').checked = !!status.remembered;
        show(connected ? (status.remembered ? '저장된 로그인으로 연결되었습니다.' : '계정 연결됨 · 로그인 유지를 켜면 재시작 후에도 연결됩니다.') : '계정을 연결하세요.'); await refreshAccount();
    } catch (error) {connected = false; updateGate(); show(error.message);}
});
