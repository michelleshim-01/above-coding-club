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
  const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID } = process.env;

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: '서버 설정 오류입니다. 관리자에게 문의해주세요.' });
  }

  try {
    const { name, email, phone, macbook, job, goal, motivation } = req.body;

    // 필수 필드 검증
    if (!name || !email || !phone || !macbook || !job || !goal) {
      return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '올바른 이메일 주소를 입력해주세요.' });
    }

    // Airtable API 호출
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

    const response = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: {
            '이름': name,
            '이메일': email,
            '연락처': phone,
            '맥북 모델': macbook,
            '하시는 일': job,
            '만들고 싶은 것': goal,
            '참가 동기': motivation || ''
          }
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Airtable error:', errorData);
      return res.status(500).json({ error: '신청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
    }

    const data = await response.json();
    return res.status(200).json({
      success: true,
      message: '신청이 완료되었습니다!',
      recordId: data.records[0].id
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
}
