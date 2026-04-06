export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.query;
  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

  if (!DASHBOARD_PASSWORD || password !== DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  }

  const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_SURVEY_TABLE_ID } = process.env;

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_SURVEY_TABLE_ID) {
    return res.status(500).json({ error: '서버 설정 오류입니다.' });
  }

  try {
    // Airtable에서 모든 설문 레코드 가져오기 (페이지네이션 포함)
    let allRecords = [];
    let offset = null;
    const airtableBase = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_SURVEY_TABLE_ID}`;

    do {
      const url = offset ? `${airtableBase}?offset=${offset}` : airtableBase;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      });

      if (!response.ok) {
        return res.status(500).json({ error: 'Airtable 데이터를 불러올 수 없습니다.' });
      }

      const data = await response.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || null;
    } while (offset);

    // 테스트 데이터 필터링 (모든 텍스트 필드가 "테스트"인 레코드 제외)
    const records = allRecords.filter(r => {
      const f = r.fields;
      return !(f['가장 좋았던 점'] === '테스트' && f['개선할 점'] === '테스트' && f['가장 많이 배운 것'] === '테스트');
    });

    // 기본 매핑
    const surveys = records.map(r => ({
      session: r.fields['세션ID'] || '',
      satisfaction: Number(r.fields['전반적 만족도']) || 0,
      bestPart: r.fields['가장 좋았던 점'] || '',
      improvement: r.fields['개선할 점'] || '',
      difficulty: r.fields['난이도 체감'] || '',
      learned: r.fields['가장 많이 배운 것'] || '',
      reParticipation: r.fields['재참여 의향'] || '',
      nps: Number(r.fields['추천 점수']) ?? 0,
      referral: r.fields['알게 된 경로 (텍스트)'] || '',
      comments: r.fields['추가 의견'] || '',
      createdTime: r.createdTime || ''
    }));

    const total = surveys.length;

    // 평균 만족도
    const avgSatisfaction = total > 0
      ? (surveys.reduce((sum, s) => sum + s.satisfaction, 0) / total).toFixed(1)
      : 0;

    // NPS 계산 (0-6: Detractor, 7-8: Passive, 9-10: Promoter)
    const promoters = surveys.filter(s => s.nps >= 9).length;
    const detractors = surveys.filter(s => s.nps <= 6).length;
    const npsScore = total > 0
      ? Math.round(((promoters - detractors) / total) * 100)
      : 0;

    // 분포 계산
    const satisfactionDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const npsDist = {};
    for (let i = 0; i <= 10; i++) npsDist[i] = 0;
    const difficultyDist = {};
    const reParticipationDist = {};
    const referralDist = {};

    surveys.forEach(s => {
      if (s.satisfaction >= 1 && s.satisfaction <= 5) satisfactionDist[s.satisfaction]++;
      if (s.nps >= 0 && s.nps <= 10) npsDist[s.nps]++;
      if (s.difficulty) difficultyDist[s.difficulty] = (difficultyDist[s.difficulty] || 0) + 1;
      if (s.reParticipation) reParticipationDist[s.reParticipation] = (reParticipationDist[s.reParticipation] || 0) + 1;
      if (s.referral) referralDist[s.referral] = (referralDist[s.referral] || 0) + 1;
    });

    // 텍스트 응답
    const textResponses = {
      bestPart: surveys.filter(s => s.bestPart.trim()).map(s => s.bestPart),
      improvement: surveys.filter(s => s.improvement.trim()).map(s => s.improvement),
      learned: surveys.filter(s => s.learned.trim()).map(s => s.learned),
      comments: surveys.filter(s => s.comments.trim()).map(s => s.comments)
    };

    return res.status(200).json({
      stats: {
        total,
        avgSatisfaction: Number(avgSatisfaction),
        npsScore,
        promoters,
        detractors,
        passives: total - promoters - detractors
      },
      distributions: {
        satisfaction: satisfactionDist,
        nps: npsDist,
        difficulty: difficultyDist,
        reParticipation: reParticipationDist,
        referral: referralDist
      },
      textResponses
    });

  } catch (error) {
    console.error('Survey dashboard API error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
