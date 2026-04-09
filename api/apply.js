// 슬랙 알림 발송
async function sendSlackNotification({ name, phone, email, job, tool }) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const text = `🎉 새 워크샵 신청!\n이름: ${name}\n하시는 일: ${job}\n이메일: ${email}\n연락처: ${phone}${tool ? `\n만들고 싶은 도구: ${tool}` : ''}`;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
}

// 신청 확인 이메일 발송
async function sendConfirmationEmail({ name, email }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || 'Above Coding Club <onboarding@resend.dev>',
      to: email,
      subject: '[어보브 코딩 클럽] 워크샵 신청이 완료되었습니다',
      text: `${name}님, 어보브 코딩 클럽 워크샵 신청이 완료되었습니다!\n\n신청 내역을 확인한 후 상세 안내 메일을 보내드릴게요.\n궁금한 점은 이 메일로 편하게 답장 주세요.\n\n어보브 코딩 클럽 드림`
    })
  });
}

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
    const { name, phone, email, job, macbook, paid, tool, message } = req.body;

    // 필수 필드 검증
    if (!name || !phone || !email || !job) {
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
            '연락처': phone,
            '이메일': email,
            '하시는 일': job,
            '맥북 확인': macbook === true,
            '참가비 입금': paid === true,
            '만들어보고 싶은 도구': tool || '',
            '하고 싶은 말': message || ''
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

    // 슬랙 알림 + 확인 이메일 (응답 차단 없이 비동기 실행)
    Promise.allSettled([
      sendSlackNotification({ name, phone, email, job, tool }),
      sendConfirmationEmail({ name, email })
    ]).catch(err => console.error('Notification error:', err));

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
