export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 비밀번호 보호
  const authHeader = req.headers.authorization;
  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
  if (!DASHBOARD_PASSWORD || authHeader !== `Bearer ${DASHBOARD_PASSWORD}`) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, RESEND_API_KEY } = process.env;
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID || !RESEND_API_KEY) {
    return res.status(500).json({ error: '서버 설정 오류입니다.' });
  }

  // 요청 본문에서 워크샵 정보 받기
  const { workshopDate, workshopDay } = req.body || {};
  if (!workshopDate) {
    return res.status(400).json({ error: 'workshopDate가 필요합니다. (예: "2026-05-10")' });
  }

  try {
    // Airtable에서 신청자 목록 조회
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
    const airtableRes = await fetch(airtableUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    });

    if (!airtableRes.ok) {
      return res.status(500).json({ error: 'Airtable 데이터를 불러올 수 없습니다.' });
    }

    const airtableData = await airtableRes.json();
    const records = airtableData.records || [];

    const participants = records.map(r => ({
      name: r.fields['이름'] || '',
      email: r.fields['이메일'] || '',
      job: r.fields['하시는 일'] || '',
      tool: r.fields['만들어보고 싶은 도구'] || ''
    })).filter(p => p.name && p.email);

    if (participants.length === 0) {
      return res.status(400).json({ error: '발송할 신청자가 없습니다.' });
    }

    // 날짜 계산
    const date = new Date(workshopDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = workshopDay || ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

    const d1 = new Date(date);
    d1.setDate(d1.getDate() - 1);
    const d2 = new Date(date);
    d2.setDate(d2.getDate() - 2);
    const formatShort = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

    // 참석자 직업 목록
    const jobList = [...new Set(participants.map(p => p.job).filter(Boolean))].join(', ');

    // 만들고 싶은 도구 목록
    const toolList = participants
      .filter(p => p.tool.trim())
      .map(p => `• ${p.tool.trim()}`)
      .join('\n');

    // 이메일 발송
    const results = [];
    for (const p of participants) {
      const emailBody = buildEmailBody({
        name: p.name, year, month, day, dayOfWeek,
        jobList, toolList,
        d1: formatShort(d1), d2: formatShort(d2)
      });

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL || 'Above Coding Club <onboarding@resend.dev>',
          to: p.email,
          subject: `[어보브 코딩 클럽] ${month}월 ${day}일 워크샵 안내`,
          text: emailBody
        })
      });

      const emailData = await emailRes.json();
      results.push({
        name: p.name,
        email: p.email,
        success: emailRes.ok,
        id: emailData.id || null,
        error: emailRes.ok ? null : emailData
      });
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return res.status(200).json({
      message: `${sent}명 발송 완료${failed > 0 ? `, ${failed}명 실패` : ''}`,
      results
    });

  } catch (error) {
    console.error('Send info email error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}

function buildEmailBody({ name, year, month, day, dayOfWeek, jobList, toolList, d1, d2 }) {
  return `안녕하세요, 어보브 코딩 클럽 워크샵을 신청해 주셔서 감사합니다.
${month}월 ${day}일 워크샵에 대해 안내드릴게요.

■ 일시
${year}년 ${month}월 ${day}일 (${dayOfWeek}) 오후 2시 - 6시
오후 1시 30분부터 입장 가능하고, 2시 정각에 시작합니다. 시간 맞춰 도착 부탁드려요.

■ 장소
서촌 AULA 스페이스
서울 종로구 자하문로 12길 10-8, 1층
https://naver.me/55rqwMCT

■ 준비물
맥북 (충전기도 꼭 챙겨주세요!)
노트북 저장 공간은 여유 있으면 좋지만, 크게 걱정 안 하셔도 됩니다

■ Claude Code 사전 준비
워크샵에서는 Claude Code를 사용해요. Claude Code는 Claude Pro($20/월) 이상 구독이 있어야 사용할 수 있어서, 가능하시다면 사전에 구독을 권장드려요. 워크샵 이후에도 직접 만들어보고 다듬어가시려면 본인 계정이 있는 게 좋거든요!
구독이 부담스러우신 분은 편하게 말씀해 주세요. 당일 저희 계정을 공유해 드릴 수 있게 준비해 둘게요.
→ Claude 가입 및 구독: https://claude.ai

■ 워크샵은 이렇게 진행돼요
어보브 코딩 클럽을 시작하게 된 이야기
Claude Code 설치부터 기본 사용법까지 차근차근
잠깐 쉬는 시간
나만의 도구 만들기 워크샵
오픈카톡방 공유하며 마무리

■ 함께하는 분들을 미리 소개할게요
이번 워크샵에는 ${jobList}까지 다양한 분야의 분들이 모였어요. 모두 개발자가 아닌, 각자의 일에서 AI를 도구로 활용해보고 싶은 분들이에요.
신청하면서 만들어보고 싶다고 적어주신 것들도 살짝 공유드릴게요.
${toolList || '(아직 적어주신 분이 없어요 — 워크샵에서 함께 상상해봐요!)'}
아직 뭘 만들지 구체적으로 정하지 않으셔도 괜찮아요. 워크샵에서 함께 상상해 보는 시간이 있으니까요!

■ 환불 안내
2일 전(${d2})까지 전액 환불
1일 전(${d1}) 반액 환불
당일 환불 불가 (자리 양도는 가능)
궁금한 점은 이 메일로 편하게 답장 주세요.

${month}월 ${day}일에 만나요!
어보브 코딩 클럽 드림`;
}
