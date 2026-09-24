import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced, getRequestHeaders } from '../../../../script.js';
import { saveBase64AsFile } from '../../../utils.js';
import { SECRET_KEYS, secret_state } from '../../../secrets.js';
import { installTransport } from './transport.mjs';

const ID = 'sharednai_bridge';
const API = '/api/plugins/sharednai-bridge';
extension_settings[ID] ??= {enabled: false};
const settings = extension_settings[ID];
// Must install before AutoPic so its injected character/reference fields reach us.
installTransport(window, () => settings.enabled);
let connected = false;
let previousNovelState;
let ownsGate = false;
function updateGate() {
    if (settings.enabled && connected && !ownsGate) {
        previousNovelState = secret_state[SECRET_KEYS.NOVEL];
        secret_state[SECRET_KEYS.NOVEL] = true;
        ownsGate = true;
    } else if ((!settings.enabled || !connected) && ownsGate) {
        secret_state[SECRET_KEYS.NOVEL] = previousNovelState;
        ownsGate = false;
    }
}
async function api(path, body) {
    const response = await fetch(API + path, {method: body === undefined ? 'GET' : 'POST', headers: getRequestHeaders(), ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    if (!response.ok) {
        let message = response.status === 404 ? 'SharedNAI 서버 플러그인을 설치하고 enableServerPlugins를 켠 뒤 서버를 재시작하세요.' : `HTTP ${response.status}`;
        try { message = (await response.json()).message || message; } catch { /* HTML errors */ }
        throw new Error(message);
    }
    return response;
}
function show(message) { document.querySelector('#snb-status').textContent = message; }
async function syncStatus() {
    try { connected = (await (await api('/status')).json()).connected; updateGate(); show(connected ? '계정 연결됨 · 서버 재시작 시 다시 로그인하세요.' : '계정을 연결하세요.'); }
    catch (error) { connected = false; updateGate(); show(error.message); }
}
jQuery(async () => {
    const response = await fetch(new URL('./settings.html', import.meta.url));
    const container = document.createElement('div');
    container.innerHTML = await response.text();
    document.querySelector('#extensions_settings').append(container);
    const el = id => container.querySelector('#snb-' + id);
    el('enabled').checked = !!settings.enabled;
    el('enabled').addEventListener('change', () => {settings.enabled = el('enabled').checked; saveSettingsDebounced(); updateGate();});
    el('connect').addEventListener('click', async () => {
        el('connect').disabled = true; show('사이트 로그인 확인 중…');
        const password = el('password').value;
        el('password').value = '';
        try { await api('/connect', {username: el('username').value, password}); connected = true; settings.enabled = true; el('enabled').checked = true; saveSettingsDebounced(); updateGate(); show('연결되었습니다. 계정에 등록된 키를 사용합니다.'); }
        catch (error) { show(error.message); }
        finally {el('connect').disabled = false;}
    });
    el('check').addEventListener('click', async () => {try {await api('/check', {}); show('계정 인증 정상 · 이미지 생성 비용이 발생하지 않는 확인입니다.');} catch(error) {show(error.message);}});
    el('disconnect').addEventListener('click', async () => {try {await api('/disconnect', {}); connected = false; updateGate(); show('연결을 해제했습니다.');} catch(error) {show(error.message);}});
    el('generate').addEventListener('click', async () => {
        el('generate').disabled = true; show('이미지 생성 중… 사이트 대기열에 따라 최대 6분 걸릴 수 있습니다.');
        try {
            const [width, height] = el('size').value.split('x').map(Number);
            const body = {prompt: el('prompt').value, negative_prompt: el('negative').value, model: el('model').value, width, height, steps: 28, scale: 5, sampler: 'k_euler_ancestral', scheduler: 'karras'};
            const base64 = await (await api('/generate', body)).text();
            const context = getContext();
            const name = context.characters?.[context.characterId]?.name || 'SharedNAI';
            const path = await saveBase64AsFile(base64, name, `sharednai_${Date.now()}`, 'png');
            el('preview').src = path; el('preview').hidden = false;
            el('download').href = path; el('download').hidden = false;
            show('생성 완료 · SillyTavern 이미지 폴더에 저장했습니다. 채팅 자동 삽입은 AutoPic을 사용하세요.');
        } catch(error) {show(error.message);} finally {el('generate').disabled = false;}
    });
    await syncStatus();
});
