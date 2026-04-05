export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 환경 변수 확인
  const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_SURVEY_TABLE_ID } = process.env;

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_SURVEY_TABLE_ID) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: '서버 설정 오류입니다. 관리자에게 문의해주세요.' });
  }

  try {
    const {
      session,
      satisfaction,
      bestPart,
      improvement,
      difficulty,
      learned,
      reParticipation,
      nps,
      comments
    } = req.body;

    // 필수 필드 검증
    if (!session) {
      return res.status(400).json({ error: '세션 정보가 없습니다.' });
    }

    if (!satisfaction || satisfaction < 1 || satisfaction > 5) {
      return res.status(400).json({ error: '만족도를 선택해주세요. (1-5)' });
    }

    if (nps === undefined || nps === null || nps < 0 || nps > 10) {
      return res.status(400).json({ error: '추천 점수를 선택해주세요. (0-10)' });
    }

    const validDifficulties = ['너무 쉬움', '적절함', '약간 어려움', '너무 어려움'];
    if (!difficulty || !validDifficulties.includes(difficulty)) {
      return res.status(400).json({ error: '난이도를 선택해주세요.' });
    }

    const validReParticipation = ['꼭 다시 참여하고 싶다', '기회가 되면 참여하겠다', '잘 모르겠다', '참여하지 않을 것 같다'];
    if (!reParticipation || !validReParticipation.includes(reParticipation)) {
      return res.status(400).json({ error: '재참여 의향을 선택해주세요.' });
    }

    // Airtable API 호출
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_SURVEY_TABLE_ID}`;

    const response = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: {
            '세션ID': session,
            '전반적 만족도': Number(satisfaction),
            '가장 좋았던 점': bestPart || '',
            '개선할 점': improvement || '',
            '난이도 체감': difficulty,
            '가장 많이 배운 것': learned || '',
            '재참여 의향': reParticipation,
            '추천 점수': Number(nps),
            '추가 의견': comments || ''
          }
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Airtable error:', errorData);
      return res.status(500).json({ error: '설문 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
    }

    const data = await response.json();
    return res.status(200).json({
      success: true,
      message: '설문이 제출되었습니다! 감사합니다.',
      recordId: data.records[0].id
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
}
