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
