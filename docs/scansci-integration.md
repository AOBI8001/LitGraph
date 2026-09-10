# Shared literature retrieval core

## Scope and retained upstream components

LitGraph retains the public WebVPN registry and ports the necessary publisher routing and browser-acquisition patterns from [scansci-pdf](https://github.com/Rimagination/scansci-pdf). Publisher rules were reviewed against revision `5bce70619ae1392f48f3d8e58b6af18e3bf31550`; the registry retains its original `c7022a8` provenance. The registry, original license and provenance are distributed under `vendor/scansci/`. A registry entry is configuration, not proof that an institution has been tested or that its subscriptions permit a particular download.

The application does not execute the upstream Python package or its all-source download race. There is no Python runtime, additional download browser, proprietary compiled core, exported-cookie worker, or upstream shadow-library fallback in the active integration. `scripts/scansci-service.js` is a compatibility facade over native LitGraph services:

- `scripts/scholarly-service.js`: real source searches, complete supplied metadata and official PMC lookup.
- `scripts/acquisition-core.js`: bounded, source-directed open-access PDF acquisition.
- `scripts/institution-routing.js`: recognized WebVPN gateways and explicit EZProxy templates.
- `desktop/institution.mjs`: authenticated acquisition within the same Electron session used for institution login.
- `desktop/publisher-routes.mjs`: adapted public publisher profiles and PDF-route logic for ScienceDirect, Springer/Nature, Wiley, ACS and IEEE, with LitGraph additions for SAGE and Taylor & Francis. Metadata and observed controls rank before path-based fallbacks. Every derived route retains the observed institution gateway origin/path. Wrong DOI, PII, IEEE article identifiers, supplementary material and explicitly marked previews are rejected.
- `desktop/browser-pdf.mjs`: task-scoped response and native-download capture across the primary institution page and its descendant popups, authenticated PDF-link navigation, embedded/PDF.js document discovery, publisher routing and an unambiguous PDF-button action. Both API and MCP share a serialized acquisition queue. Login/challenge pages are brought forward for manual input. No subsequent source request starts while waiting. The cumulative per-paper manual wait is limited to 120 seconds; timeout or an explicit block skips the item and releases the next queued request. Saved stage outputs remain intact. Manual waiting is excluded from the active network timeout. Closing the main app or explicitly pausing cancels the wait. Remote pages remain sandboxed and credentials are never passed to models.

Both model-API and external-Agent workflows call the same authenticated local service. The model plans searches; the program retrieves and displays verified records without an additional model relevance-assessment stage. Model choice does not confer additional institution permissions.

The browser download task retains an immutable requested-article identity alongside the current publisher page. Undeclared PDF prefetches are not accepted as the paper, and HTML DOI validation precedes accepting subresource responses. If a derived PDF route fails, the task can return once to the real article and use its explicit PDF control. Named popup reuse is re-associated with the current task before a download begins. During owned top-level PDF requests only, an inline response is handed to Chromium's native downloader instead of the built-in PDF viewer; authentication, redirects and response bytes are unchanged. Matching DOI metadata in a streamed page can expose its PDF before unrelated publisher scripts finish loading.

## Search and original processing

Public-source browser/API and MCP callers share a 45-second source-search budget and a 12-second per-provider request limit. Authenticated native browser search has a 60-second active budget, excluding user authentication waits, and waits for an observed changed/stable result state rather than accepting the previous query's links. Partial results after pagination trouble are retained with a warning. Explicit user cancellation still aborts the search. These limits cover source retrieval, not the model's separate planning time.

1. OA mode searches the full original input first, with exact-title verification and supplementary model keywords. Institution mode submits the original input to the last saved browser page's actual search form, then optionally enriches those observed candidates with public metadata. A real catalogue record is not discarded merely because public metadata is absent. Conflicting enrichment is rejected; no author, citation count, language or abstract is fabricated. Unsupported forms or unreadable result layouts produce explicit errors, distinct from a confirmed empty result, without silently substituting a public-index search. Preserve every supplied author, the complete supplied abstract and source-specific citation provenance.
2. Apply year, language, article-type, access and count filters. Unrestricted language prioritizes English. Unknown language does not satisfy an English-only or Chinese-only filter. Do not relax filters or invent records to fill a requested count.
3. After user confirmation, use the cached source-issued record ID and current project/node identity. Try existing verified OA PDF locations before performing additional DOI lookups.
4. If a direct source fails, resolve official PMC article metadata and other verified alternatives where available. A PMC result must match the PMCID and, when supplied, DOI. Follow PDF links explicitly advertised by the article's verified OA landing page; do not crawl arbitrary reference lists or guess file addresses.
   Candidate order is: two initial direct copies, a newly resolved repository copy, a metadata-derived alternative, one article landing page plus its advertised PDF, then any remaining direct candidates within the shared budget. A long list of stale publisher links must not consume the slots needed to discover or fetch a valid repository copy.
5. Save a complete, size-limited PDF to `data/originals`. PDF.js extraction, Markdown storage, source-grounded model analysis, relationship validation and graph refresh remain separate application import stages.
6. Resume reuses saved originals and completed stages. Failure or cancellation preserves finished library files. Download success never implies Markdown conversion or AI analysis success.

The frontend can index at most two OA papers concurrently; source acquisition is serialized across API and MCP callers so an institution verification wait holds subsequent downloads. Every saved original is converted to Markdown immediately, then AI analysis runs in sequence after the available originals are indexed so relationship comparisons can use their source evidence. The frontend does not start a second institutional download when the shared service fails or its response is interrupted.

Metadata marked open access may describe readable HTML, an unavailable repository copy or a source that declines automated requests. It does not guarantee a downloadable PDF.

## Bounded open-access acquisition

The default core limits are 30 seconds for a paper's OA acquisition, 12 seconds per candidate request, at most six distinct candidate URLs and at most two simultaneous candidates. The initial pass uses at most two direct candidates, reserving capacity for the independent repository fallback. A repository identity is resolved at most once per acquisition. Resolver operations have their own bounded slice of the overall budget. The first complete PDF wins; outstanding candidate requests are canceled before acquisition ends. A candidate is visited once per acquisition, rather than repeatedly retrying the same failing download. Underlying metadata endpoints may apply their separately bounded and cancelable transient-error policy.

Public downloads use HTTPS with TLS verification, public-address validation, DNS pinning and redirect checks. The maximum original is 40 MB. A successful response must include a PDF signature and end-of-file marker; a login page, error document or truncated PDF is not a saved original. HTML link extraction is limited to the article page and its explicit PDF link. No institution cookie or model key is attached to public requests.

An HTTP 403 means the source denied the request; 404/410 indicates a missing or moved resource; 429 indicates rate limiting. A timeout does not establish whether the paper is closed access. Preserve the specific failure, continue the batch, and let the user supply an authorized original or resume later. These outcomes must not be relabeled as successful downloads.

## Institution access and session ownership

### Catalogue and publisher adapters

`desktop/institution-dom.mjs` contains serializable DOM adapters for Primo/Ex Libris, ScienceDirect, Springer/Nature, Wiley, Taylor & Francis, SAGE, IEEE, CNKI, EBSCO/ProQuest and generic catalogue result cards. URL recognition uses record paths and observed title/card structure, not one school's hostname. A normal `fulldisplay` record with `CitationCount` in its query is a result, not a citation action. Exact action labels, reference sections and unrelated navigation are excluded separately. Embedded catalogues, task-created search popups, asynchronous results, and observed next-page buttons/links are handled in the existing browser. A supported structural pattern is not a guarantee that every current deployment has been tested.

`desktop/institution-fulltext.mjs` follows bounded, observed **Full text / View online / resolver service** controls from a library record to its publisher. Browser actions preserve the actual gateway URL, parameters, current renderer and persistent session; publisher PDF discovery then runs in that same session. Observed record URLs are not rewritten through another proxy. Authenticated PDF URLs remain institution-specific metadata and are never relabelled as public OA links. Explicit article-target EZProxy entry links remain valid routes; account authentication itself is completed by the user.

The current application provides the same institution transport to API models and external Agents. Neither model receives browser cookies or gains broader publisher permissions. Unknown language/type/year cannot satisfy a restrictive filter; exclusions and already-imported duplicates are reported separately from extraction failure.

The installed desktop application opens an isolated institution browser after the user saves a publisher, institution or university library URL. The user completes institution account login, MFA and database authorization in that window, continuing from a library portal into the required database when necessary. **Save session & close** flushes session storage and the encrypted cookie snapshot before closing. The window close button follows the same persistence path. Neither action signs the user out; **Clear sign-in** explicitly removes authorization state. Saving a URL alone cannot establish subscription access.

The same persistent Electron/Chromium session owns both that window and automatic authenticated requests. Its separate session-cookie snapshot is encrypted with the operating system's credential facility and restored when eligible. No cookies are exported to Python, a second browser, an external Agent, model messages, logs or project exports. Server-side expiration and school authentication rules still apply.

For a recognized WebVPN gateway, URL routing uses the pinned school configuration. EZProxy requires the institution's actual proxy entry/template containing `{url}`; a generic library homepage cannot be treated as a proxy template. Direct publisher access works only when that publisher session actually has access. LitGraph does not implement a universal CARSI login automaton or infer subscription entitlement from the presence of cookies.

Institution mode first uses the shared OA path, then attempts the authorized institution path with the same existing session. OA has a 30-second budget and institution acquisition has a separate 30-second budget: a paper that needs both paths can use up to approximately 60 seconds for acquisition, not 30 seconds for the entire import/conversion/analysis workflow. Time spent waiting for user authentication is excluded from the institution budget. Both paths are cancelable and are not automatically repeated as whole stages. Different verified source URLs are alternatives within one operation, not repeated retries of the same URL. User-facing history reports processing states and failure reasons, not attempt counters.

The software detects authentication requirements and reports `needs_access` rather than presenting a login page as a PDF or silently claiming a complete download. CAPTCHA, expired authorization, unsupported proxy layouts and missing subscriptions may require user action. Neither mode bypasses access controls or guarantees every institution or publication.

The user can also download an authorized PDF inside the institution window. Its inbox retains the original under `data/incoming`, associates a known project/node when possible, and hands it to the existing save/convert/analyze workflow. An explicitly paused import remains paused.

## Web preview versus desktop

Publisher denial pages carrying both the Elsevier content-problem message and `CPE00001` are classified as blocked, not as article HTML or a solvable JavaScript challenge. Explicit blocking skips the current paper without prompting for an unsolvable challenge. Interactive authentication waits for the user's Save session & close with a cumulative two-minute limit per paper; expiry also skips the item. Neither path automatically retries the same paper. Save session & close hides browser windows while retaining the live renderer, sessionStorage and JavaScript session state. Reopening the saved page reuses that renderer without reloading it; normal automation runs in the background. All descendant windows share the same persistent Chromium partition. Persistent storage and an OS-encrypted cookie snapshot retain eligible login state across application restart; transient JavaScript state is not serialized, and server-side expiry still requires authentication. No CAPTCHA-solving service is bundled.

The browser preview can use the local service's OA retrieval and file storage. It does not own the installed application's Electron institution session and cannot borrow the normal browser's institution login cookies. Saving an institution address in a preview does not enable desktop authenticated acquisition there. A preview must report this limitation, not imply an institution was tried successfully.

The installed application includes the native JS core and pinned gateway registry. It does not require a separate Python installation or download runtime preparation. Actual institution coverage still requires a valid session and compatible routing; packaging availability is not evidence of universal authentication compatibility.

## External Agent tools

- `litgraph_download_status`: inspect core availability and capability boundaries, without secrets.
- `litgraph_scholarly_search`: retrieve verified records when the user explicitly requests direct search. Ordinary search-plan tasks return the requested JSON; the app performs retrieval afterward.
- `litgraph_acquire_start`: after authorization, start acquisition for a verified record matching an existing node in the current project; return `taskId` immediately.
- `litgraph_acquire_status`: report state and persisted original identity, not PDF bytes or cookies.
- `litgraph_acquire_cancel`: cancel that acquisition.

Do not start competing downloads while the application is importing. `originalSaved` does not authorize a claim that Markdown or analysis exists. Continue the existing import task to perform remaining stages. Existing model task/result contracts and connection-file-based reconnection remain authoritative.

## Verification boundary

### Human handoff (1.1.8)

On authentication or a challenge, search and acquisition release their owned debugging connections in all task windows and stop automated navigation, PDF clicks and periodic page inspection. A completed page load receives a read-only check for an explicit denial so it can be skipped promptly. New authentication popups stay under manual control until the user explicitly saves. Native downloads remain associated with the current paper; cookies and the browser partition are neither cleared nor replaced.

Saving requires three nonblank, challenge-free checks of the same URL over one second. Loading pages and transient blank redirects cannot resume a queue. Resume reconnects to the existing document without reloading it. Starting an acquisition on an already-open matching article also preserves that live document. These changes remove application interference; they do not bypass verification or guarantee that a publisher will accept an embedded browser or network.

Tests include repeated local verification pages, blank-page rejection, debugger release in parent and popup windows, no subsequent queued request during a handoff, and successful PDF delivery after explicit resume. Tests also cover the production 120-second wait constant, shortened deterministic timeout fixtures, immediate/post-navigation blocking, listener cleanup, late Save rejection and continuing the next paper. Real Cloudflare verification is performed only by the user; fixtures cannot establish its success.

Automated Electron fixtures verify session-cookie restoration after restart, live renderer/sessionStorage reuse after Save, PDF response/attachment/blob/viewer/popup delivery, exact authentication-popup focus, manual resume, no duplicate manual import and cancellation while queued. Pure route tests cover the publisher path mappings and reject cross-article and supplementary URLs. These tests do not authenticate a real institution or establish universal publisher compatibility. A publisher may reject Electron, expire authorization or deny a subscribed article; those outcomes remain visible and require user action.

`tests/institution-public-live.mjs` is an optional real-network test with a fresh isolated profile. It has retrieved and validated the openly licensed PLOS paper `10.1371/journal.pone.0000308` through the native browser. This establishes one real publisher download, not institution subscription access. The deterministic desktop suite additionally covers a stalled streamed article, an inline PDF, a failed publisher route followed by the actual PDF button, repeated named popups, and rejection of wrong-DOI early responses and cross-PII redirects.

`tests/institution-dom.mjs`, `tests/institution-search-desktop.mjs` and `tests/institution-fulltext-desktop.mjs` exercise multi-platform result structures, the complete original query, delayed results, real-empty versus unsupported status, button pagination, embedded/popup search, catalogue-to-resolver-to-publisher downloads, and identity guards. All fixture authentication uses isolated temporary profiles and local test servers, not copied user credentials. Service tests cover both model transports, optional metadata failure, filter diagnostics, and preservation of institution routes.

## Distribution and licensing

The packaging allowlist includes the three native core modules and `vendor/scansci/`, alongside the existing source service and Electron institution implementation. Desktop preparation checks that these assets exist and copies the upstream license and provenance into bundled third-party notices. Development output directories and previous experimental Python environments are not installer payloads.

The top-level LitGraph MIT license is unchanged. Retained upstream data and adapted logic keep their Apache-2.0 attribution and terms. The full upstream license is retained verbatim; separately licensed proprietary compiled components are not included. See `THIRD_PARTY_NOTICES.md` and `vendor/scansci/SOURCE.md` for the included subset.

## 联合检索

文献发现支持 combined / open / institution。combined 复用同一公共检索服务与同一内置机构浏览器，先公共、后机构，避免人机认证等待时启动后续渠道。原始输入优先，AI 生成 2–3 组英文和 2–3 组中文主题组合。两条路径都执行多组查询，真实来源记录合并后统一排序及截取，保留每组查询的来源、名次、完成状态和机构原始访问链接。

任一路失败不丢弃另一条已取得结果；来源报告与项目检索历史一起保存。联合导入开放全文不可用时使用原来的机构会话继续获取。右上角浏览器入口复用现有会话管理，不另起独立浏览器或导出用户 Cookie。

AI 策略的 subject_terms 同时提供中文和英文核心主题名称。应用在标题／可用摘要中校验主题，完整标题精确匹配优先；综合排序先比较标题主题匹配，再融合真实来源名次。未命中核心对象的记录不用于凑数。
