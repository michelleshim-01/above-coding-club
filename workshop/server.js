const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const PORT = 3000;

// .env 파일 로드 (있으면)
const envPath = path.join(DIR, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── 신청 API 엔드포인트 ──
  if (req.method === 'POST' && req.url === '/api/apply') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { name, phone, email, job, macbook, paid, tool, message } = data;

        // 필수 필드 검증
        if (!name || !phone || !email || !job) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '필수 항목을 모두 입력해주세요.' }));
          return;
        }

        // 환경 변수 확인
        const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID } = process.env;
        if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID) {
          console.log('⚠️  환경 변수가 설정되지 않음 - 테스트 모드');
          console.log('   신청 데이터:', { name, phone, email, job, macbook, paid, tool, message });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: '테스트 모드 - 신청 완료', testMode: true }));
          return;
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
                '맥북 확인': macbook === true || macbook === 'true',
                '입금 확인': paid === true || paid === 'true',
                '만들어보고 싶은 도구': tool || '',
                '하고 싶은 말': message || ''
              }
            }]
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Airtable error:', errorData);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '신청 처리 중 오류가 발생했습니다.' }));
          return;
        }

        const result = await response.json();
        console.log(`✅ 신청 완료: ${name} (${email})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '신청이 완료되었습니다!', recordId: result.records[0].id }));

      } catch (e) {
        console.error('Server error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '서버 오류가 발생했습니다.' }));
      }
    });
    return;
  }

  // ── 파일 저장 엔드포인트 ──
  if (req.method === 'POST' && req.url === '/__save') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { file, html } = JSON.parse(body);
        const filePath = path.join(DIR, path.basename(file));
        if (!filePath.endsWith('.html')) { res.writeHead(400); res.end('html 파일만 저장 가능'); return; }
        fs.writeFileSync(filePath, html, 'utf8');
        console.log(`저장됨: ${path.basename(file)}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500); res.end(e.message);
      }
    });
    return;
  }

  // ── 정적 파일 서빙 ──
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(DIR, urlPath);
  // 보안: 워크샵 폴더 밖으로 나가지 못하게
  if (!filePath.startsWith(DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
  const ext = path.extname(filePath);

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n✅ 워크샵 서버 실행 중`);
  console.log(`   브라우저에서 열기: http://localhost:${PORT}\n`);
  console.log(`   DevTools에서 수정 후 Cmd+S 또는 "파일 저장" 버튼으로 저장\n`);
});
