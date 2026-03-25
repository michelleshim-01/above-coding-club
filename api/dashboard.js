export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 비밀번호 검증
  const { password } = req.query;
  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

  if (!DASHBOARD_PASSWORD || password !== DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  }

  const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID } = process.env;

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID) {
    return res.status(500).json({ error: '서버 설정 오류입니다.' });
  }

  try {
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
    const response = await fetch(airtableUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`
      }
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'Airtable 데이터를 불러올 수 없습니다.' });
    }

    const data = await response.json();
    const records = data.records || [];

    // 참가자 목록 매핑
    const participants = records.map(r => ({
      name: r.fields['이름'] || '',
      phone: r.fields['연락처'] || '',
      email: r.fields['이메일'] || '',
      job: r.fields['하시는 일'] || '',
      macbook: r.fields['맥북 확인'] || false,
      paid: r.fields['참가비 입금'] || false,
      tool: r.fields['만들어보고 싶은 도구'] || '',
      message: r.fields['하고 싶은 말'] || '',
      signupDate: r.createdTime || ''
    })).sort((a, b) => new Date(b.signupDate) - new Date(a.signupDate));

    // 통계
    const stats = {
      total: participants.length,
      paid: participants.filter(p => p.paid).length,
      macbook: participants.filter(p => p.macbook).length
    };

    // 직군 분포
    const jobDistribution = {};
    participants.forEach(p => {
      const job = p.job.trim();
      if (job) {
        jobDistribution[job] = (jobDistribution[job] || 0) + 1;
      }
    });

    // 만들어보고 싶은 도구
    const toolWishes = participants
      .filter(p => p.tool.trim())
      .map(p => ({ name: p.name, tool: p.tool.trim() }));

    return res.status(200).json({ stats, participants, jobDistribution, toolWishes });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
