export function resolutionLabel(width, height) {
    const w = Number(width), h = Number(height);
    return `${w}x${h} (${w > h ? '가로' : w < h ? '세로' : '정사각형'})`;
}
export function accountRows(a = {}) {
    const num = (value, unit = '') => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ko-KR') + unit : '정보 없음';
    const rows = [
        ['계정 크레딧', num(a.anlas_balance, ' Anlas')],
        ['공식 계정 크레딧', num(a.official_anlas_balance, ' Anlas')],
        ['공유 계정 사용 가능 크레딧', num(a.shared_available_anlas_balance ?? a.shared_anlas_balance, ' Anlas')],
        ['요금제', a.tier_name || '정보 없음'],
    ];
    if (a.uses_official_token !== true) {
        rows.push(['V5 남은 할당량', a.is_trial_vip === true ? num(a.trial_v5_quota, '장 (체험)') : num(a.v5_remaining_images, '장')]);
        if (a.is_trial_vip !== true) rows.push(['V5 최대 할당량', num(a.v5_max_images, '장')], ['V5 에너지', num(a.v5_energy_percent, '%')], ['V5 일일 보충량', num(a.v5_daily_refill_images, '장')]);
    }
    if (a.expires_at) rows.push(['계정 만료', a.expires_at]);
    return rows;
}
// Preserve option values and ST's change handlers; restore labels when disabled.
export function installResolutionLabels(root, enabled) {
    const originals = new Map();
    function refresh() {
        for (const [option, original] of originals) {
            if (!option.isConnected) originals.delete(option);
            else if (!enabled()) { if (option.textContent !== original) option.textContent = original; originals.delete(option); }
        }
        if (!enabled()) return;
        for (const option of root.querySelectorAll('#sd_resolution option')) {
            const match = option.value.match(/(\d+)x(\d+)/) || option.textContent.match(/(\d+)\s*[x×]\s*(\d+)/);
            if (!match) continue;
            if (!originals.has(option)) originals.set(option, option.textContent);
            const text = resolutionLabel(match[1], match[2]);
            if (option.textContent !== text) option.textContent = text;
        }
    }
    const observer = new MutationObserver(refresh);
    observer.observe(root, {childList: true, subtree: true}); refresh();
    return refresh;
}
