# Above Coding Club

## 프로젝트 개요
Above Coding Club 워크샵 랜딩 페이지. AI 코딩 도구(Claude Code)를 배우는 오프라인 워크샵 신청 사이트.

## 기술 스택
- **호스팅**: Vercel (GitHub 연동 자동 배포)
- **프론트엔드**: 순수 HTML/CSS/JS (빌드 없음)
- **백엔드**: Vercel Serverless Functions (`/api/apply.js`)
- **데이터베이스**: Airtable

## 주요 파일
| 파일 | 설명 |
|------|------|
| `index.html` | 메인 랜딩 페이지 (신청 폼 포함) |
| `api/apply.js` | 신청 폼 → Airtable 저장 서버리스 함수 |
| `vercel.json` | Vercel 라우팅 설정 |
| `style.css` | 스타일시트 |

## 환경 변수 (Vercel Dashboard)
- `AIRTABLE_TOKEN` - Airtable Personal Access Token
- `AIRTABLE_BASE_ID` - `app93p7FUveIFphFH`
- `AIRTABLE_TABLE_ID` - `tblaDJAL8doJJOCZK`

## Airtable 필드
이름, 연락처, 이메일, 하시는 일, 맥북 확인, 참가비 입금, 만들어보고 싶은 도구, 하고 싶은 말

## 배포
```bash
git push  # GitHub에 푸시하면 Vercel 자동 배포
```

## URL
- 프로덕션: https://above-coding-club.vercel.app/
- GitHub: https://github.com/michelleshim-01/above-coding-club
