const SURVEY_TABLE_ID = 'tblsz20vWQ3R9W0zD';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, DASHBOARD_PASSWORD, RESEND_API_KEY } = process.env;

  // 인증
  let password;
  if (req.method === 'GET') {
    password = req.query.password;
  } else {
    const auth = req.headers.authorization;
    password = auth ? auth.replace('Bearer ', '') : null;
  }

  if (!DASHBOARD_PASSWORD || password !== DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ error: '서버 설정 오류입니다.' });
  }

  try {
    if (req.method === 'GET') {
      return handleGet(req, res, { AIRTABLE_TOKEN, AIRTABLE_BASE_ID });
    } else if (req.method === 'POST') {
      return handlePost(req, res, { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, RESEND_API_KEY });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}

async function handleGet(req, res, env) {
  const { action, tableId, sessionId } = req.query;

  if (action === 'tables') {
    return getTables(res, env);
  } else if (action === 'applicants' && tableId) {
    return getApplicants(res, env, tableId);
  } else if (action === 'surveys') {
    return getSurveys(res, env, sessionId);
  }

  return res.status(400).json({ error: 'action 파라미터가 필요합니다. (tables, applicants, surveys)' });
}

async function handlePost(req, res, env) {
  const { action } = req.body;

  if (action === 'send-info') {
    return sendInfoEmails(req, res, env);
  }

  return res.status(400).json({ error: 'action이 필요합니다.' });
}

// 테이블 목록 조회
async function getTables(res, env) {
  const url = `https://api.airtable.com/v0/meta/bases/${env.AIRTABLE_BASE_ID}/tables`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${env.AIRTABLE_TOKEN}` }
  });

  if (!response.ok) return res.status(500).json({ error: 'Airtable 메타데이터 조회 실패' });

  const data = await response.json();
  const workshops = data.tables
    .filter(t => t.name.startsWith('워크샵_'))
    .map(t => ({
      id: t.id,
      name: t.name,
      dateLabel: formatTableDate(t.name)
    }))
    .sort((a, b) => b.name.localeCompare(a.name));

  // 서베이 세션ID 목록도 함께 조회
  const surveyUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${SURVEY_TABLE_ID}?fields%5B%5D=${encodeURIComponent('세션ID')}`;
  const surveyRes = await fetch(surveyUrl, {
    headers: { 'Authorization': `Bearer ${env.AIRTABLE_TOKEN}` }
  });

  let sessions = [];
  if (surveyRes.ok) {
    const surveyData = await surveyRes.json();
    const sessionSet = new Set();
    (surveyData.records || []).forEach(r => {
      const sid = r.fields['세션ID'];
      if (sid) sessionSet.add(sid);
    });
    sessions = [...sessionSet].sort().reverse();
  }

  return res.status(200).json({ workshops, sessions });
}

// 워크샵 테이블 이름에서 날짜 추출
function formatTableDate(name) {
  const match = name.match(/워크샵_(\d{2})(\d{2})(\d{2})/);
  if (!match) return name;
  return `20${match[1]}년 ${parseInt(match[2])}월 ${parseInt(match[3])}일`;
}

// 신청자 목록 조회
async function getApplicants(res, env, tableId) {
  const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${tableId}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${env.AIRTABLE_TOKEN}` }
  });

  if (!response.ok) return res.status(500).json({ error: 'Airtable 데이터 조회 실패' });

  const data = await response.json();
  const records = data.records || [];

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

  const stats = {
    total: participants.length,
    paid: participants.filter(p => p.paid).length,
    macbook: participants.filter(p => p.macbook).length
  };

  const jobDistribution = {};
  participants.forEach(p => {
    const job = p.job.trim();
    if (job) jobDistribution[job] = (jobDistribution[job] || 0) + 1;
  });

  return res.status(200).json({ stats, participants, jobDistribution });
}

// 서베이 결과 조회
async function getSurveys(res, env, sessionId) {
  let url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${SURVEY_TABLE_ID}`;
  if (sessionId) {
    url += `?filterByFormula=${encodeURIComponent(`{세션ID}="${sessionId}"`)}`;
  }

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${env.AIRTABLE_TOKEN}` }
  });

  if (!response.ok) return res.status(500).json({ error: 'Airtable 데이터 조회 실패' });

  const data = await response.json();
  const records = data.records || [];

  const surveys = records.map(r => ({
    sessionId: r.fields['세션ID'] || '',
    satisfaction: r.fields['전반적 만족도'] || 0,
    bestPart: r.fields['가장 좋았던 점'] || '',
    improvement: r.fields['개선할 점'] || '',
    difficulty: r.fields['난이도 체감'] || '',
    learned: r.fields['가장 많이 배운 것'] || '',
    reJoin: r.fields['재참여 의향'] || '',
    nps: r.fields['추천 점수'] ?? null,
    extra: r.fields['추가 의견'] || '',
    source: r.fields['알게 된 경로'] || '',
    sourceText: r.fields['알게 된 경로 (텍스트)'] || ''
  }));

  const count = surveys.length;
  const avgSatisfaction = count ? (surveys.reduce((s, r) => s + r.satisfaction, 0) / count).toFixed(1) : 0;
  const npsValues = surveys.filter(r => r.nps !== null);
  const avgNps = npsValues.length ? (npsValues.reduce((s, r) => s + r.nps, 0) / npsValues.length).toFixed(1) : 0;

  const difficultyDist = {};
  surveys.forEach(r => { if (r.difficulty) difficultyDist[r.difficulty] = (difficultyDist[r.difficulty] || 0) + 1; });

  const reJoinDist = {};
  surveys.forEach(r => { if (r.reJoin) reJoinDist[r.reJoin] = (reJoinDist[r.reJoin] || 0) + 1; });

  return res.status(200).json({
    stats: { count, avgSatisfaction, avgNps },
    difficultyDist,
    reJoinDist,
    surveys
  });
}

// 상세 안내 이메일 발송
async function sendInfoEmails(req, res, env) {
  const { tableId, workshopDate } = req.body;

  if (!tableId || !workshopDate) {
    return res.status(400).json({ error: 'tableId와 workshopDate가 필요합니다.' });
  }
  if (!env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY가 설정되지 않았습니다.' });
  }

  // 해당 테이블에서 신청자 조회
  const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${tableId}`;
  const airtableRes = await fetch(url, {
    headers: { 'Authorization': `Bearer ${env.AIRTABLE_TOKEN}` }
  });

  if (!airtableRes.ok) return res.status(500).json({ error: 'Airtable 데이터 조회 실패' });

  const airtableData = await airtableRes.json();
  const participants = (airtableData.records || [])
    .map(r => ({
      name: r.fields['이름'] || '',
      email: r.fields['이메일'] || '',
      job: r.fields['하시는 일'] || '',
      tool: r.fields['만들어보고 싶은 도구'] || ''
    }))
    .filter(p => p.name && p.email);

  if (participants.length === 0) {
    return res.status(400).json({ error: '발송할 신청자가 없습니다.' });
  }

  const date = new Date(workshopDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

  const d1 = new Date(date); d1.setDate(d1.getDate() - 1);
  const d2 = new Date(date); d2.setDate(d2.getDate() - 2);
  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

  const jobList = [...new Set(participants.map(p => p.job).filter(Boolean))].join(', ');
  const toolList = participants.filter(p => p.tool.trim()).map(p => `• ${p.tool.trim()}`).join('\n');

  const results = [];
  for (const p of participants) {
    const body = buildEmailBody({ name: p.name, year, month, day, dayOfWeek, jobList, toolList, d1: fmt(d1), d2: fmt(d2) });

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'Above Coding Club <onboarding@resend.dev>',
        to: p.email,
        subject: `[어보브 코딩 클럽] ${month}월 ${day}일 워크샵 안내`,
        text: body
      })
    });

    const emailData = await emailRes.json();
    results.push({ name: p.name, email: p.email, success: emailRes.ok, error: emailRes.ok ? null : emailData });
  }

  const sent = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return res.status(200).json({
    message: `${sent}명 발송 완료${failed > 0 ? `, ${failed}명 실패` : ''}`,
    results
  });
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
