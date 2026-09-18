# Heiwa Төслийн Dashboard — техникийн баримт бичиг

Энэ төсөлтэй ажиллах хөгжүүлэгчид зориулав. Хэрэглэгчийн талын зааврыг
[`user-guide.md`](user-guide.md)-ээс, OneDrive sync-ийг анх тохируулах
дарааллыг [`onedrive-sync-setup.md`](onedrive-sync-setup.md)-ээс үзнэ үү.

---

## 1. Архитектурын тойм

```
OneDrive / SharePoint
        │  Microsoft Graph (app-only)
        ▼
GitHub Actions  "OneDrive sync"  (хоногт нэг удаа, 22:00 UTC)
        │  Claude API-аар PDF задлах
        ▼
data-private/pending-review.json      ← батлагдаагүй дараалал
        │  Админ "Баталгаажуулах" табаар батална
        ▼
worker/data/heiwa.json                ← өгөгдлийн эх сурвалж
        │  git push → Cloudflare дахин build
        ▼
Cloudflare Worker  ──  /api/*  ──  D1 (хэрэглэгчид)
        │
        └─ статик assets (out/)  ──  браузер
```

**Next.js-ийн үүрэг зөвхөн build хийх үе.** `next.config.mjs` дээр
`output: "export"` тул Next нь ажиллах үедээ ямар ч хүсэлт боловсруулдаггүй —
зөвхөн `out/` хавтас руу HTML/JS/CSS гаргана. Бүх сервер талын логик
`worker/index.ts` дотор гараар бичсэн router-т байна. **OpenNext ашигладаггүй.**

**Өгөгдөл клиентийн bundle дотор байдаггүй.** Урьд нь `src/lib/data.ts` нь
`heiwa.json`-ыг import хийдэг байсан бөгөөд статик экспортын улмаас бүх гэрээ,
төлбөрийн дүн нийтэд нээлттэй JS chunk дотор ордог байв. Одоо тэр файл
`worker/data/heiwa.json` дотор, Worker-ийн bundle-д байдаг ба зөвхөн
`GET /api/data`-аар, нэвтэрсэн хэрэглэгчид олгогдоно.

> `src/` доорх ямар нэг файлаас `heiwa.json`-ыг import хийвэл энэ хамгаалалт
> тэр дороо алдагдана. Build хийсний дараа шалгах:
> `grep -rl "<ямар нэг гэрээний дугаар>" out/` — хоосон байх ёстой.

### Хавтасны бүтэц

```
src/app/            layout.tsx, page.tsx (gate + самбарын бүрхүүл), globals.css
src/views/          9 таб: Overview, Contracts, Payments, Correspondence,
                    Documents, Drawings, Audit, Review, Users
src/components/     chart-kit, charts, DataTable, AccountLogin, login-shell,
                    SyncButton, SignOutButton, Users-ийн доторх хэсгүүд
src/lib/            data.ts (buildDataset + деривацууд), DataProvider.tsx,
                    schema.ts (zod), types.ts, format.ts, palette.ts
worker/             index.ts (router) + route бүрийн handler
worker/data/        heiwa.json — өгөгдлийн эх сурвалж
cf/lib/             session, signed-token, password, encoding, github, response
scripts/            sync-onedrive.mjs, create-admin.mjs,
                    backfill-source-files.mjs + lib/
migrations/         D1-ийн SQL
```

### Хүсэлтийн урсгал

`worker/index.ts` нь `pathname`-ийг **яг тэмдэгтээр** тааруулдаг switch.
Төгсгөлийн ташуу зураасыг хасаад тааруулна. Таарахгүй бол статик asset руу
унана.

**`/api/` угтвартай бүх хариу `Cache-Control: no-store`** авдаг — router-ийн
хилийн цэг дээр нэг удаа тавигддаг, handler бүрт биш.

---

## 2. Route-ууд

### Идэвхтэй

| Route | Метод | Эрх | Тайлбар |
|---|---|---|---|
| `/api/session/login` | POST | — | Нэвтрэх, session cookie тавина |
| `/api/session/logout` | POST | — | Cookie цэвэрлэнэ |
| `/api/session/me` | GET | — | `{authenticated, user:{id,username,role}}` |
| `/api/session/password` | POST | нэвтэрсэн | Өөрийн нууц үг солих |
| `/api/data` | GET | нэвтэрсэн | Бүх өгөгдөл JSON-оор |
| `/api/sync` | POST | editor+ | OneDrive sync workflow эхлүүлэх |
| `/api/review-list` | GET | admin | Батлагдаагүй дарааллыг унших |
| `/api/review-action` | POST | admin | Батлах / цуцлах |
| `/api/users` | GET, POST | admin | Жагсаах / үүсгэх |
| `/api/users/role` | POST | admin | Эрх өөрчлөх |
| `/api/users/password` | POST | admin | Өөр хүний нууц үг шинэчлэх |
| `/api/users/delete` | POST | admin | Устгах |

Нэвтрээгүй бол `401`, нэвтэрсэн ч эрх хүрэхгүй бол `403`.

### Хуучин, устгагдаагүй

Эдгээр нь акаунтын систем нэвтрэхээс өмнөх хувилбарууд. Интерфейс тэдгээрийг
ашиглахаа больсон ч буцах зам болгон үлдээсэн:

- `/api/view-auth/login`, `/logout`, `/me` — нийтийн ганц нэвтрэлт
- `/api/review-login` — Review табын тусдаа админ нэвтрэлт
- `/api/auth/login`, `/callback`, `/me`, `/logout` — **parked** Microsoft OAuth

Microsoft OAuth-ийн код бүрэн бүтэн (`worker/auth.ts`, `cf/lib/oauth-session.ts`,
`src/components/LoginScreen.tsx`, `MicrosoftSignInButton.tsx`, `UserMenu.tsx`,
`src/hooks/use-session.ts`). Ашиглагдахгүй, устгагдаагүй.

---

## 3. Орчны хувьсагч, secret

### Cloudflare Worker дээрх secret

`npx wrangler secret put <НЭР>` эсвэл dashboard → Settings → Variables and
Secrets.

| Нэр | Зориулалт | Хаанаас авах |
|---|---|---|
| `SESSION_SECRET` | Акаунтын session cookie-г HMAC-аар гарын үсэглэнэ | `openssl rand -hex 32` |
| `GITHUB_PAT` | Worker-ээс GitHub руу хандах fine-grained token (Contents: RW, Actions: RW) | GitHub → Settings → Developer settings |
| `ANTHROPIC_API_KEY` | **Worker дээр хэрэггүй** — зөвхөн GitHub Actions дээр | — |

### Cloudflare дээрх энгийн хувьсагч

`wrangler.jsonc`-ийн `vars` дотор, commit хийгдсэн (нууц биш):

| Нэр | Утга |
|---|---|
| `GITHUB_OWNER` | `upc-nyamdorj` |
| `GITHUB_REPO` | `Heiwa-Dashboard` |

### Cloudflare binding

`wrangler.jsonc` дотор:

| Binding | Төрөл | Утга |
|---|---|---|
| `ASSETS` | Assets | `out/` хавтас |
| `USERS_DB` | D1 | `heiwa-dashboard-users` (`4c14ba9d-351b-49b6-84fc-e6f9baf6524c`) |

### GitHub Actions secret

Settings → Secrets and variables → Actions → Secrets:

| Нэр | Зориулалт | Хаанаас авах |
|---|---|---|
| `AZURE_TENANT_ID` | Microsoft Graph app-only нэвтрэлт | Azure app registration (sync-д зориулсан) |
| `AZURE_CLIENT_ID` | мөн адил | мөн адил |
| `AZURE_CLIENT_SECRET` | мөн адил | Azure → Certificates & secrets |
| `ANTHROPIC_API_KEY` | PDF задлалтын төлбөр | console.anthropic.com |

### GitHub Actions variable

Settings → Secrets and variables → Actions → Variables (нууц биш):

| Нэр | Зориулалт |
|---|---|
| `ONEDRIVE_DRIVE_ID` | Синхрончлох drive |
| `ONEDRIVE_FOLDER_ID` | Тухайн drive доторх хавтас |

### Ашиглагдахаа больсон secret

Эдгээр нь Cloudflare дээр **одоо ч тавиастай** бөгөөд зөвхөн хуучин route-ууд
ашиглана. Хуучин route-уудыг устгасны дараа эдгээрийг ч устгана:

`VIEW_USERNAME`, `VIEW_PASSWORD`, `VIEW_SESSION_SECRET`,
`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SYNC_PASSWORD`

Мөн parked Microsoft OAuth-ийнх: `MS_OAUTH_CLIENT_ID`, `MS_OAUTH_TENANT_ID`,
`MS_OAUTH_CLIENT_SECRET`, `OAUTH_SESSION_SECRET`.

### Локал хөгжүүлэлт

`.dev.vars` файл (gitignored) нь `wrangler dev`-д зориулсан хувилбар. Дор хаяж
`SESSION_SECRET` байх шаардлагатай. Энэ файл нь `wrangler dev`-д л уншигддаг,
`next dev`-д уншигддаггүй.

---

## 4. Ажиллуулах, deploy хийх

### Локал

```bash
npm install
npm run dev      # Next зөвхөн — /api/* байхгүй тул нэвтрэх боломжгүй
npm run build    # out/ үүсгэнэ, дараа нь heiwa-dashboard.html-ийг inline хийнэ
npx wrangler dev # Worker + D1 + статик assets, бүрэн ажиллагаатай
```

**Нэвтрэлт, өгөгдөл шаардсан аливаа зүйлийг туршихдаа `wrangler dev`
ашиглана.** `npm run dev` болон `npm start` (`npx serve out`) нь Next-ийн
статик гаралтыг л үзүүлдэг — `/api/*` байхгүй тул нэвтрэх дэлгэц гарах боловч
нэвтэрч чадахгүй.

Локал D1-д хэрэглэгч үүсгэх:

```bash
npx wrangler d1 execute heiwa-dashboard-users --local --file migrations/0001_users.sql
node scripts/create-admin.mjs --local
```

### Production руу deploy хийх хоёр зам

**1. `git push origin main` — автоматаар deploy хийнэ.**
Cloudflare Workers Builds нь repo-той холбогдсон. `main` руу орсон commit бүр
build хийгдэж deploy хийгдэнэ. Хоногийн sync ч мөн `main` руу commit хийдэг тул
өдөр бүр автоматаар дахин deploy хийгддэг.

**2. `npx wrangler deploy` — шууд deploy.**
Локал `out/` болон `worker/` -ээс шууд илгээнэ. Хурдан, гэхдээ **commit
хийгээгүй өөрчлөлт нь дараагийн Git build дээр устана.**

> Аль ч тохиолдолд `npm run build`-ийг өмнө нь ажиллуулсан байх ёстой —
> `wrangler deploy` нь `out/`-ыг байгаагаар нь илгээдэг, өөрөө build хийдэггүй.

Deploy хийхэд secret дахин тавих шаардлагагүй. Харин `wrangler.jsonc`-ийн
`vars` нь deploy бүрт дахин бичигддэг.

### Шалгалт

```bash
npx tsc --noEmit
npm run build
npx vitest run     # 184 тест
npm run lint
```

CI (`.github/workflows/ci.yml`) нь `tsc`, `build`, `test` гурвыг ажиллуулна.

---

## 5. OneDrive sync pipeline

### Ажиллах давтамж

`.github/workflows/onedrive-sync.yml` — `cron: '0 22 * * *'` (22:00 UTC ≈
Улаанбаатарын 06:00). Мөн `workflow_dispatch`-аар гараар, эсвэл самбарын Sync
товчоор (`/api/sync` → `workflow_dispatch`) эхлүүлж болно.

Гараар ажиллуулахад хоёр параметр:
- `dry_run` — зөвхөн жагсааж харьцуулна, татахгүй, задлахгүй, бичихгүй
- `limit` — боловсруулах файлын дээд тоо (зардал тооцоолоход)

### Алхмууд (`scripts/sync-onedrive.mjs`)

1. Azure AD-аас app-only token авна (`client_credentials`, хэрэглэгч оролцохгүй).
2. `ONEDRIVE_FOLDER_ID` хавтсын **шууд доторх** файлуудыг жагсаана.
3. Өмнөх ажиллагааны төлөвтэй харьцуулж шинэ/өөрчлөгдсөнийг олно (eTag-аар).
   Төлөв нь `scripts/` доор `.sync-state.json` нэрээр хадгалагддаг — анхны
   ажиллагааны дараа үүснэ, тиймээс одоогоор repo дотор байхгүй.
4. Файл бүрийг татаж Claude API-аар задална (`scripts/lib/claude-extract.mjs`).
5. Үр дүнг `sourceFile: { name, webUrl, itemId }`-тэй хамт
   `data-private/pending-review.json`-д нэмнэ.
6. `src/data/sync-status.json`-ыг шинэчилж commit хийнэ.

**Өгөгдлийн санд шууд бичдэггүй.** Админ **Баталгаажуулах** табаар батлах үед
л `worker/data/heiwa.json`-д орно (`worker/review-action.ts`).

### Эх файлын холбоос

Батлах үед pending бичлэгийн `sourceFile` нь мөрөнд хавсрана. Формоос ирсэн
утгыг үл тоомсорлодог — Graph-аас ирсэн нь эх сурвалж.

Хуучин мөрүүдэд (энэ талбар үүсэхээс өмнөх) холбоос байхгүй. Тэдгээрийг нөхөх:

```
GitHub → Actions → "Backfill source-file links" → Run workflow
```

`write` тэмдэглэхгүйгээр эхлээд ажиллуулж тайланг уншина; тохирохгүй, эргэлзээтэй
нэрсийг жагсаана. Дараа нь `write` тэмдэглээд ажиллуулахад commit хийнэ.
Тааруулалт нь файлын нэр, дараа нь хавтсаар хийгддэг; шийдэгдэхгүй бол алгасаад
тайлагнадаг — буруу холбоос өгөхгүй.

---

## 6. Role-based auth

### D1 бүтэц (`migrations/0001_users.sql`)

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,   -- crypto.randomUUID()
  username      TEXT NOT NULL,      -- бичсэн хэлбэрээр нь
  username_key  TEXT NOT NULL UNIQUE, -- жижиг үсгээр, NFC — давхцал/нэвтрэлтэд
  password_hash TEXT NOT NULL,      -- pbkdf2$sha256$<iters>$<salt>$<hash>
  role          TEXT NOT NULL CHECK (role IN ('viewer','editor','admin')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
```

### Нууц үг

PBKDF2-SHA256, WebCrypto-оор (Workers-ийн native боломж, нэмэлт сан хэрэггүй).
**100,000 давталт** — OWASP-ийн 600k-аас доогуур, зориуд: Worker-ийн CPU таазанд
(Free дээр 10ms) 600k нь ~45ms, 100k нь ~7ms. Хэмжилтээр нэвтрэлтийн бүтэн
round-trip ~16ms.

Hash бүр өөрийн давталтын тоог бичиж хадгалдаг тул тогтмолыг ирээдүйд өсгөхөд
хуучин нууц үгс ажилласаар байна.

Бүх хэрэглэгч тус тусын санамсаргүй salt-тай.

### Session

`worker/auth-session.ts`:

- Cookie `heiwa_session`, `HttpOnly; Secure; SameSite=Strict; Path=/`
- Хугацаа **12 цаг**
- Payload нь base64url JSON + HMAC — `cf/lib/signed-token.ts`
- **Cookie дотор зөвхөн `userId` байна.** Эрхийг хүсэлт бүрд D1-ээс уншина

Сүүлийн цэг чухал: эрх бууруулах, акаунт устгах нь cookie дуусахыг хүлээхгүйгээр
шууд үйлчилнэ. Төлөө нь хүсэлт бүрт индексжсэн нэг lookup.

> `cf/lib/session.ts`-ийн хуучин токен формат `${username}.${exp}.${sig}` нь
> `split('.')`-ээр задалдаг тул цэгтэй нэр (UPN хэлбэрийн имэйл) дээр эвдэрдэг.
> Шинэ систем `signed-token.ts`-ийг ашигладаг тул энэ асуудалгүй.

### Эрхийн шалгалт

`atLeast(user, 'editor')` — эрхүүд зэрэглэлтэй (viewer 1, editor 2, admin 3),
тиймээс шалгалт «энэ түвшнээс дээш» гэж уншигдана.

Интерфейс дээр таб нуух нь зөвхөн харагдац. Route бүр өөрөө ижил дүрмийг
шалгадаг.

### Хамгаалалтын хашлага

`worker/user-routes.ts` дотор: өөрийгөө бууруулах/устгах, сүүлийн Админыг
бууруулах/устгах — бүгд `409`-ээр татгалзана.

### Анхны Админ

```bash
node scripts/create-admin.mjs            # production
node scripts/create-admin.mjs --local    # wrangler dev-ийн хуулбар
```

Нэр, нууц үг, эрхийг асууна. Нууц үг echo хийгддэггүй, argv-д ордоггүй
(shell history, process list-д үлдэхгүй), зөвхөн hash нь D1 руу очно.

### Олон акаунт нэг дор

```bash
node scripts/bulk-create-users.mjs --local   # эхлээд локал дээр
node scripts/bulk-create-users.mjs           # production
```

Оролтыг `scripts/.bulk-users.local.json`-оос уншина (`--file`-аар өөрчилж
болно). Тэр нэрийн загвар `.gitignore`-т орсон — **жагсаалтыг script дотор
хатуу бичиж болохгүй.** Формат нь JSON массив, эсвэл мөр бүрт
`<username> <password>`.

Онцлогууд:

- Бүх мөрийг эхлээд шалгаад, алдаатай бол **юу ч бичихгүй**. Хагас
  хэрэгжсэн багц нь татгалзсанаас дор — юу орсныг мэдэх аргагүй болно.
- Аль хэдийн байгаа хэрэглэгчийг алгасаж мэдээлнэ, тасрахгүй. Дахин
  ажиллуулахад аюулгүй.
- Нууц үгийг хэзээ ч хэвлэдэггүй. Hash-ууд түр файлаар (0600) дамжина,
  `--command`-аар биш — эс бөгөөс process list-д харагдана.
- Ажил дуусахад оролтын файлыг устгахыг сануулна. `--delete-input` өгвөл
  өөрөө устгана.

---

## 7. Өмнө тохиолдсон асуудлууд

### `wrangler pages deploy` ажиллахгүй

Энэ бол **Workers project, Pages биш.** `wrangler pages deploy` нь
«The Pages project ... does not exist» гэж алдаа өгнө. Зөв команд:
`npx wrangler deploy`.

### 404 хуудас буруу замаас chunk ачаалдаг байсан

`next.config.mjs` дээр `assetPrefix: "./"` байсан. Энэ нь export хийсэн **бүх**
хуудсанд хамаарна, `404.html` ч мөн адил. Тэр хуудсыг `/api/auth/login` гэх мэт
гүн замд үзүүлэхэд `./_next/…` нь `/api/auth/_next/…` болж хувирч, бүх chunk
404 болдог байв.

Шинж тэмдэг нь төөрөгдүүлэм: хуудас нь «хуучин» chunk ачаалж байгаа мэт
харагддаг, гэтэл chunk-ууд нь зөв, зам нь буруу байсан. `wrangler tail`-аар
`GET /api/auth/_next/static/chunks/…  404` гэсэн мөрүүд харагдсанаар илэрсэн.

Шийдэл: `assetPrefix`-ийг бүрмөсөн хасах. `inline.mjs` үүнийг шаарддаггүй —
тэр скрипт эхний `./` эсвэл `/`-г адилхан хасдаг.

### 404 хариу кэшлэгдэж, шинэ route-ыг далдалдаг байсан

Статик давхаргын 404 нь `public, max-age=0, must-revalidate`-тай ирдэг тул
браузер хуулбарыг хадгалж болдог. Route хараахан байхгүй байхад нэг удаа
хандвал, дараа нь route нэмсэн ч браузер кэшнээсээ 404 үзүүлсээр байв.

**workers.dev нь zone биш** тул энэ account дээр purge хийх API ч, dashboard-ийн
товч ч байхгүй (`/zones` жагсаалт хоосон). Ганц хөшүүрэг нь header.

Шийдэл: `/api/` угтвартай бүх хариу, мөн статик 404 нь `no-store` авдаг болсон.
Хэрэв браузерт хуучин хуулбар үлдсэн бол DevTools → Application → Clear site
data.

### Sync ба Review 502 өгдөг байсан — `/repos/undefined/undefined/`

`GITHUB_OWNER`, `GITHUB_REPO` хоёр deploy хийсэн Worker дээр огт байгаагүй.
Тэдгээрийг dashboard-ийн хувьсагч болгон тохируулахаар баримтжуулсан байсан ч
тэнд байхгүй байсан — dashboard дээр л тохируулсан зүйл нь `wrangler deploy`-д
ч, repo-д ч харагддаггүй тул хэн ч анзаараагүй.

Шийдэл: `wrangler.jsonc`-ийн `vars` дотор бичсэн. Нууц биш тул commit хийж
болно, ингэснээр deploy бүр дахин тавина.

### `wrangler tail` чимээгүй байх нь «хүсэлт ирээгүй» гэсэн үг биш

Tail холбогдоход **~25 секунд** шаардлагатай. Түүнээс өмнө ирсэн хүсэлт
бүртгэгдэхгүй. Хүсэлт 302 буцаасан ч tail юу ч харуулаагүй тохиолдол гарсан.
Туршихаасаа өмнө «Connected to …» гэсэн мөр гартал хүлээнэ.

### Локал дээр туршихад `/api/*` байхгүй

`npm run dev` (Next) болон `npm start` (`npx serve out`) хоёулаа Worker
ажиллуулдаггүй. Нэвтрэх дэлгэц гарна, гэхдээ товч дарахад Next-ийн 404 гарна.
Энэ нь production дээрх алдаа мэт харагддаг. **`npx wrangler dev` ашиглана.**

### `.dev.vars` дэх хувьсагчийн нэр давхцах

`grep 'SESSION_SECRET' .dev.vars` нь `VIEW_SESSION_SECRET`,
`OAUTH_SESSION_SECRET` хоёрт таарна. Шалгахдаа мөрийн эхлэлээр:
`grep '^SESSION_SECRET=' .dev.vars`.

### Push хийх нь deploy хийхтэй адил

Git integration идэвхтэй тул `main` руу push хийх нь шууд production руу
гаргана. Хэрэв өөрчлөлт нь урьдчилсан алхам шаардаж байвал (жишээ нь эхний
Админ үүсгэх) **push хийхээсээ өмнө** тэр алхмыг хийнэ.
